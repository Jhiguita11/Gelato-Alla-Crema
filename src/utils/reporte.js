/**
 * Cálculos de los reportes del administrador (funciones puras, en hora local
 * del celular: Colombia).
 */
import { fechaLarga } from './resumen'

const p2 = (n) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD' en hora local. */
export function aFecha(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/** 'YYYY-MM-DD' → Date a las 00:00 locales. */
function deFecha(texto) {
  const [a, m, d] = texto.split('-').map(Number)
  return new Date(a, m - 1, d)
}

const diaSiguiente = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)

function textoRango(desde, hastaIncl) {
  const f = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  return aFecha(desde) === aFecha(hastaIncl) ? f(desde) : `${f(desde)} – ${f(hastaIncl)}`
}

/**
 * Rango de un periodo. `hasta` es exclusivo (00:00 del día siguiente al último
 * incluido), para consultar con creado_at >= desde y < hasta.
 */
export function rangoDe(periodo, fechas, hoy = new Date()) {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  let desde
  let ultimo
  switch (periodo) {
    case '7d':
      desde = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 6)
      ultimo = base
      break
    case 'mes':
      desde = new Date(base.getFullYear(), base.getMonth(), 1)
      ultimo = base
      break
    case 'mes-pasado':
      desde = new Date(base.getFullYear(), base.getMonth() - 1, 1)
      ultimo = new Date(base.getFullYear(), base.getMonth(), 0)
      break
    case 'otro': {
      if (!fechas?.desde || !fechas?.hasta) return { valido: false, texto: 'Elige las fechas', fechas }
      desde = deFecha(fechas.desde)
      ultimo = deFecha(fechas.hasta)
      if (ultimo < desde) return { valido: false, texto: 'La fecha final va después de la inicial', fechas }
      break
    }
    default:
      throw new Error(`Periodo desconocido: ${periodo}`)
  }
  return {
    valido: true,
    desde,
    hasta: diaSiguiente(ultimo),
    fechas: { desde: aFecha(desde), hasta: aFecha(ultimo) },
    texto: textoRango(desde, ultimo),
  }
}

/** Ventas por día (sin anulados), del más reciente al más viejo. */
export function porDia(pedidos) {
  const dias = new Map()
  for (const p of pedidos) {
    if (p.anuladoAt) continue
    const fecha = aFecha(new Date(p.createdAt))
    const d = dias.get(fecha) ?? { fecha, etiqueta: fechaLarga(p.createdAt), pedidos: 0, total: 0 }
    d.pedidos += 1
    d.total += p.total
    dias.set(fecha, d)
  }
  return [...dias.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

function celda(valor) {
  const texto = String(valor ?? '')
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Un renglón por pedido (incluidos los anulados, marcados), para armar tablas
 * dinámicas en Excel. Punto y coma y BOM, como el CSV de cierres.
 */
export function filasReporteCSV(pedidos, describir) {
  const encabezado = [
    'Fecha',
    'Hora',
    'Pedido',
    'Mesa',
    'Atendió',
    'Cliente',
    'Productos',
    'Total',
    'Pagado',
    'Despachado',
    'Anulado',
    'Anuló',
  ]
  const filas = [...pedidos]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((p) => {
      const d = new Date(p.createdAt)
      const productos = (p.lines ?? [])
        .map((l) => {
          const x = describir(l)
          return `${x.cantidad > 1 ? `${x.cantidad}× ` : ''}${x.titulo}${x.variante ? ` (${x.variante})` : ''}`
        })
        .join(', ')
      return [
        aFecha(d),
        `${p2(d.getHours())}:${p2(d.getMinutes())}`,
        p.code ?? '',
        p.table,
        p.takenBy ?? '',
        p.customer ?? '',
        productos,
        p.total,
        p.paid ? 'Sí' : 'No',
        p.status === 'despachado' ? 'Sí' : 'No',
        p.anuladoAt ? 'Sí' : 'No',
        p.anuladoPor ?? '',
      ]
    })
  return '﻿' + [encabezado, ...filas].map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n'
}
