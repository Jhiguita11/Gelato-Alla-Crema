import { useCallback, useEffect, useState } from 'react'
import { escribir, leer } from '../store/almacen'
import { CLAVES } from './claves'
import { aplicarOp } from './estado'

export { CLAVES }

/**
 * Modo local: todo vive en el navegador de este equipo, igual que antes de
 * existir el modo compartido. Usa las MISMAS claves y el mismo formato que la
 * app ya venía guardando, así que lo que hay en los celulares sigue sirviendo.
 */

/** Lee todo lo guardado y lo devuelve como estado + el turno de este equipo. */
export function leerLocal() {
  const contador = Number(leer(CLAVES.contador, 0))
  const turnos = leer(CLAVES.turnos, null) ?? { activo: null, turnos: [] }
  const vitrina = leer(CLAVES.vitrina, null)
  return {
    estado: {
      jornada: { id: null, contador: Number.isFinite(contador) && contador > 0 ? contador : 0, abiertaAt: null },
      pedidos: leer(CLAVES.pedidos, []) ?? [],
      cierres: leer(CLAVES.cierres, []) ?? [],
      turnos: turnos.turnos ?? [],
      vitrina: {
        fecha: vitrina?.fecha ?? null,
        sabores: vitrina?.sabores ?? [],
        productosAgotados: vitrina?.productosAgotados ?? [],
        saboresExtra: leer(CLAVES.saboresExtra, []) ?? [],
      },
      carta: leer(CLAVES.carta, []) ?? [],
    },
    activo: turnos.activo ?? null,
  }
}

/** Guarda solo las partes que cambiaron, en el formato de siempre. */
export function escribirLocal(antes, despues, activoAntes, activoDespues) {
  if (despues.pedidos !== antes.pedidos) escribir(CLAVES.pedidos, despues.pedidos)
  if (despues.cierres !== antes.cierres) escribir(CLAVES.cierres, despues.cierres)
  if (despues.jornada.contador !== antes.jornada.contador) {
    escribir(CLAVES.contador, despues.jornada.contador)
  }
  if (despues.turnos !== antes.turnos || activoDespues !== activoAntes) {
    escribir(CLAVES.turnos, { activo: activoDespues, turnos: despues.turnos })
  }
  const va = antes.vitrina
  const vd = despues.vitrina
  if (vd.fecha !== va.fecha || vd.sabores !== va.sabores || vd.productosAgotados !== va.productosAgotados) {
    escribir(
      CLAVES.vitrina,
      vd.fecha ? { fecha: vd.fecha, sabores: vd.sabores, productosAgotados: vd.productosAgotados } : null,
    )
  }
  if (vd.saboresExtra !== va.saboresExtra) escribir(CLAVES.saboresExtra, vd.saboresExtra)
  if (despues.carta !== antes.carta) escribir(CLAVES.carta, despues.carta)
}

/** Cómo queda el turno de ESTE equipo después de una operación. */
export function activoTras(activo, op, despues) {
  switch (op.tipo) {
    case 'entrar':
      return op.turno
    case 'salir':
      return activo?.id === op.id ? null : activo
    case 'cerrarCaja':
      // El turno sigue, pero arranca con el día nuevo.
      return activo ? (despues.turnos.find((t) => t.id === activo.id) ?? activo) : null
    default:
      return activo
  }
}

/** Ejecuta una operación sobre lo último guardado (ver store/almacen.js). */
export function ejecutarLocal(op) {
  const { estado: antes, activo } = leerLocal()
  const despues = aplicarOp(antes, op, { asignarCodigo: true })
  const activoDespues = activoTras(activo, op, despues)
  if (despues !== antes || activoDespues !== activo) {
    escribirLocal(antes, despues, activo, activoDespues)
  }
  return { estado: despues, activo: activoDespues }
}

export function useMotorLocal() {
  const [datos, setDatos] = useState(leerLocal)

  // Otras pestañas del mismo equipo.
  useEffect(() => {
    const claves = new Set(Object.values(CLAVES))
    const onStorage = (e) => {
      if (e.key === null || claves.has(e.key)) setDatos(leerLocal())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const ejecutar = useCallback((op) => {
    const r = ejecutarLocal(op)
    setDatos(r)
    return r.estado
  }, [])

  return {
    estado: datos.estado,
    turnoActivo: datos.activo,
    ejecutar,
    sync: { modo: 'local' },
  }
}
