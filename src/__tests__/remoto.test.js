import { describe, expect, it } from 'vitest'
import {
  ErrorSync,
  cierreADatos,
  clasificar,
  filaACierre,
  filaAPedido,
  vaciarCola,
} from '../sync/remoto'

describe('conversión de filas', () => {
  it('pedido: columnas en español → nombres de la app, fechas en ms', () => {
    const p = filaAPedido({
      id: 'a',
      code: '004',
      mesa: '2',
      cliente: 'Juliana',
      tomado_por: 'Mariana',
      nota: 'Sin maní',
      lineas: [{ productId: 'brownie' }],
      estado: 'despachado',
      pagado: true,
      total: 9000,
      creado_at: '2026-10-22T15:00:00+00:00',
      despachado_at: '2026-10-22T15:10:00+00:00',
      listo_at: '2026-10-22T15:05:00+00:00',
      pagado_at: null,
      oculto: true,
      anulado_at: '2026-10-22T15:20:00+00:00',
      anulado_por: 'Fredy',
    })
    expect(p).toEqual({
      id: 'a',
      code: '004',
      table: '2',
      customer: 'Juliana',
      takenBy: 'Mariana',
      note: 'Sin maní',
      lines: [{ productId: 'brownie' }],
      status: 'despachado',
      paid: true,
      total: 9000,
      createdAt: Date.parse('2026-10-22T15:00:00Z'),
      dispatchedAt: Date.parse('2026-10-22T15:10:00Z'),
      listoAt: Date.parse('2026-10-22T15:05:00Z'),
      paidAt: null,
      oculto: true,
      anuladoAt: Date.parse('2026-10-22T15:20:00Z'),
      anuladoPor: 'Fredy',
    })
  })

  it('cierre: ida y vuelta conserva el resumen', () => {
    const cierre = { id: 'c', cerradoAt: Date.parse('2026-10-22T22:00:00Z'), total: 1, pedidos: 2 }
    const datos = cierreADatos(cierre)
    expect(datos).toEqual({ total: 1, pedidos: 2 })
    expect(filaACierre({ id: 'c', cerrado_at: '2026-10-22T22:00:00Z', datos })).toEqual(cierre)
  })
})

describe('clasificar errores', () => {
  it('sin red o servidor caído → reintentar', () => {
    expect(clasificar({ message: 'TypeError: Failed to fetch' }, 0).transitorio).toBe(true)
    expect(clasificar({ message: 'Bad gateway' }, 502).transitorio).toBe(true)
  })

  it('reglas de negocio del servidor → descartar con mensaje claro', () => {
    const e = clasificar({ message: 'ya_cerrada' }, 400)
    expect(e).toMatchObject({ transitorio: false, codigo: 'ya_cerrada' })
    expect(e.message).toMatch(/Otro celular ya cerró/)
  })

  it('sin permiso → volver a pedir el PIN', () => {
    expect(clasificar({ message: 'JWT expired', code: 'PGRST301' }, 401)).toMatchObject({ sesion: true })
    expect(clasificar({ message: 'no_autorizado', code: '42501' }, 400)).toMatchObject({ sesion: true })
  })

  it('sin error no hay nada que clasificar', () => {
    expect(clasificar(null, 200)).toBeNull()
  })
})

describe('vaciarCola', () => {
  function cola(ops, ejecutar) {
    let pendientes = ops.map((tipo, i) => ({ uid: String(i), tipo }))
    const hechos = []
    const descartados = []
    const correr = () =>
      vaciarCola({
        leerCola: () => pendientes,
        quitar: (uid) => (pendientes = pendientes.filter((o) => o.uid !== uid)),
        ejecutar,
        alHacer: (op) => hechos.push(op.tipo),
        alDescartar: (op, e) => descartados.push([op.tipo, e.codigo]),
      })
    return { correr, hechos, descartados, pendientes: () => pendientes.map((o) => o.tipo) }
  }

  it('sube todo en orden', async () => {
    const c = cola(['crear', 'despachar', 'cobrar'], async () => null)
    expect(await c.correr()).toEqual({ ok: true })
    expect(c.hechos).toEqual(['crear', 'despachar', 'cobrar'])
    expect(c.pendientes()).toEqual([])
  })

  it('sin internet se detiene y conserva el orden para después', async () => {
    let red = false
    const c = cola(['crear', 'despachar'], async () => {
      if (!red) throw new ErrorSync('sin red', { transitorio: true })
      return null
    })
    const r = await c.correr()
    expect(r.ok).toBe(false)
    expect(c.pendientes()).toEqual(['crear', 'despachar'])
    red = true
    await c.correr()
    expect(c.hechos).toEqual(['crear', 'despachar'])
  })

  it('un rechazo definitivo se descarta y la cola sigue', async () => {
    const c = cola(['cerrar', 'crear'], async (op) => {
      if (op.tipo === 'cerrar') throw new ErrorSync('ya cerrada', { codigo: 'ya_cerrada' })
      return null
    })
    expect(await c.correr()).toEqual({ ok: true })
    expect(c.descartados).toEqual([['cerrar', 'ya_cerrada']])
    expect(c.hechos).toEqual(['crear'])
  })

  it('un error inesperado (bug) se trata como definitivo, no bloquea la cola', async () => {
    const c = cola(['raro', 'crear'], async (op) => {
      if (op.tipo === 'raro') throw new Error('boom')
      return null
    })
    await c.correr()
    expect(c.descartados).toHaveLength(1)
    expect(c.hechos).toEqual(['crear'])
  })
})
