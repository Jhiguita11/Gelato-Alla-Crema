/**
 * Respaldo del historial de cierres de caja.
 *
 * El historial vive solo en el navegador del equipo donde se cerró la caja.
 * Si se borran los datos del navegador o se cambia de celular, se pierde. Con
 * esto se descarga una copia (JSON para volver a cargarla, CSV para abrirla en
 * Excel) y se puede restaurar en cualquier equipo.
 */

export const FORMATO = 'gelato-alla-crema/cierres'
export const VERSION = 1

/** Arma el archivo de respaldo. */
export function crearRespaldo(cierres, ahora = Date.now()) {
  return { formato: FORMATO, version: VERSION, exportadoAt: ahora, cierres }
}

/**
 * Valida un respaldo leído de un archivo y devuelve sus cierres.
 * Lanza un Error con un mensaje para mostrarle al usuario si no sirve.
 */
export function leerRespaldo(texto) {
  let datos
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new Error('El archivo no es un respaldo válido (no es JSON).')
  }
  if (datos?.formato !== FORMATO) {
    throw new Error('Este archivo no es un respaldo de Gelato Alla Crema.')
  }
  if (datos.version > VERSION) {
    throw new Error('El respaldo es de una versión más nueva de la app. Actualízala primero.')
  }
  if (!Array.isArray(datos.cierres)) throw new Error('El respaldo no trae cierres.')

  const validos = datos.cierres.filter(
    (c) =>
      c &&
      typeof c.id === 'string' &&
      Number.isFinite(c.cerradoAt) &&
      Number.isFinite(c.total),
  )
  if (validos.length !== datos.cierres.length) {
    throw new Error(
      `El respaldo tiene ${datos.cierres.length - validos.length} cierres dañados. No se importó nada.`,
    )
  }
  return validos
}

/**
 * Junta el historial actual con uno importado. Los cierres se identifican por
 * `id`, así que importar el mismo archivo dos veces no duplica nada. Si un id
 * existe en los dos lados, se queda el que ya estaba en el equipo.
 * Resultado: del más reciente al más viejo.
 */
export function fusionarCierres(actuales, importados) {
  const porId = new Map()
  for (const c of importados) porId.set(c.id, c)
  for (const c of actuales) porId.set(c.id, c)
  return [...porId.values()].sort((a, b) => b.cerradoAt - a.cerradoAt)
}

/** Cuántos cierres de `importados` no estaban en `actuales`. */
export function contarNuevos(actuales, importados) {
  const ids = new Set(actuales.map((c) => c.id))
  return importados.filter((c) => !ids.has(c.id)).length
}

/** Fecha y hora locales en formato que Excel reconoce: 2026-07-26 y 21:05. */
function fechaISO(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return {
    fecha: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

function celda(valor) {
  const texto = String(valor ?? '')
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Un renglón por cierre. Separado por punto y coma porque el Excel en español
 * usa la coma como separador decimal; con BOM para que respete las tildes.
 */
export function cierresACSV(cierres) {
  const encabezado = [
    'Fecha',
    'Hora de cierre',
    'Pedidos',
    'Productos',
    'Porciones',
    'Vendido',
    'Cobrado',
    'Sin cobrar',
    'Lo más vendido',
  ]
  const filas = [...cierres]
    .sort((a, b) => a.cerradoAt - b.cerradoAt)
    .map((c) => {
      const { fecha, hora } = fechaISO(c.cerradoAt)
      const top = (c.productos ?? [])
        .slice(0, 3)
        .map((p) => `${p.name} (${p.cantidad})`)
        .join(', ')
      return [
        fecha,
        hora,
        c.pedidos ?? 0,
        c.unidades ?? 0,
        c.porcionesTotales ?? 0,
        c.total ?? 0,
        c.cobrado ?? 0,
        c.porCobrar ?? 0,
        top,
      ]
    })
  const lineas = [encabezado, ...filas].map((fila) => fila.map(celda).join(';'))
  return '﻿' + lineas.join('\r\n') + '\r\n'
}

/** Nombre de archivo con la fecha de hoy: gelato-cierres-2026-07-26.json */
export function nombreArchivo(extension, ahora = Date.now()) {
  return `gelato-cierres-${fechaISO(ahora).fecha}.${extension}`
}

/** Descarga un texto como archivo desde el navegador. */
export function descargar(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari necesita que la URL siga viva un momento después del clic.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
