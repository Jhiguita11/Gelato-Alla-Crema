import { describe, expect, it } from 'vitest'
import { aplicarOp, aplicarPendientes, estadoVacio } from '../sync/estado'

const pedido = (id, extra = {}) => ({
  id,
  table: '1',
  lines: [],
  status: 'pendiente',
  paid: false,
  createdAt: 1,
  dispatchedAt: null,
  paidAt: null,
  total: 3500,
  ...extra,
})

const conDia = (e = estadoVacio()) => ({
  ...e,
  vitrina: { ...e.vitrina, fecha: '2026-10-22', sabores: ['lulo'] },
})

describe('crearPedido', () => {
  it('en modo local numera los pedidos', () => {
    let e = aplicarOp(estadoVacio(), { tipo: 'crearPedido', pedido: pedido('a') })
    e = aplicarOp(e, { tipo: 'crearPedido', pedido: pedido('b') })
    expect(e.pedidos.map((p) => [p.id, p.code])).toEqual([
      ['b', '002'],
      ['a', '001'],
    ])
    expect(e.jornada.contador).toBe(2)
  })

  it('en modo compartido queda sin número hasta que lo ponga el servidor', () => {
    const e = aplicarOp(estadoVacio(), { tipo: 'crearPedido', pedido: pedido('a') }, { asignarCodigo: false })
    expect(e.pedidos[0].code).toBeNull()
    expect(e.jornada.contador).toBe(0)
  })

  it('es idempotente: el mismo pedido dos veces no se duplica', () => {
    const op = { tipo: 'crearPedido', pedido: pedido('a') }
    const una = aplicarOp(estadoVacio(), op)
    expect(aplicarOp(una, op)).toBe(una)
  })
})

describe('operaciones sobre pedidos', () => {
  const base = aplicarOp(estadoVacio(), { tipo: 'crearPedido', pedido: pedido('a') })

  it('marcar pago es explícito, no alterna', () => {
    const pagado = aplicarOp(base, { tipo: 'marcarPago', id: 'a', paid: true, at: 5 })
    expect(pagado.pedidos[0]).toMatchObject({ paid: true, paidAt: 5 })
    // Dos celulares marcan "pagado" a la vez: sigue pagado.
    expect(aplicarOp(pagado, { tipo: 'marcarPago', id: 'a', paid: true, at: 9 })).toBe(pagado)
    expect(aplicarOp(pagado, { tipo: 'marcarPago', id: 'a', paid: false }).pedidos[0]).toMatchObject({
      paid: false,
      paidAt: null,
    })
  })

  it('despachar y reabrir', () => {
    const d = aplicarOp(base, { tipo: 'despachar', id: 'a', at: 7 })
    expect(d.pedidos[0]).toMatchObject({ status: 'despachado', dispatchedAt: 7 })
    expect(aplicarOp(d, { tipo: 'despachar', id: 'a', at: 8 })).toBe(d)
    expect(aplicarOp(d, { tipo: 'reabrir', id: 'a' }).pedidos[0]).toMatchObject({
      status: 'pendiente',
      dispatchedAt: null,
    })
  })

  it('un pedido que no existe no cambia nada', () => {
    expect(aplicarOp(base, { tipo: 'despachar', id: 'zzz', at: 1 })).toBe(base)
    expect(aplicarOp(base, { tipo: 'borrarPedido', id: 'zzz' })).toBe(base)
  })

  it('limpiar OCULTA solo los despachados Y pagados (no los borra)', () => {
    let e = estadoVacio()
    e = aplicarOp(e, { tipo: 'crearPedido', pedido: pedido('debe', { status: 'despachado' }) })
    e = aplicarOp(e, { tipo: 'crearPedido', pedido: pedido('listo', { status: 'despachado', paid: true }) })
    e = aplicarOp(e, { tipo: 'crearPedido', pedido: pedido('cocina', { paid: true }) })
    const limpio = aplicarOp(e, { tipo: 'limpiarDespachados' })
    expect(limpio.pedidos).toHaveLength(3) // ninguna venta desaparece
    expect(limpio.pedidos.filter((p) => p.oculto).map((p) => p.id)).toEqual(['listo'])
    expect(aplicarOp(limpio, { tipo: 'limpiarDespachados' })).toBe(limpio)
  })

  it('eliminar ANULA: queda quién y cuándo, y es idempotente', () => {
    const a = aplicarOp(base, { tipo: 'borrarPedido', id: 'a', at: 50, por: 'Gloria' })
    expect(a.pedidos[0]).toMatchObject({ id: 'a', anuladoAt: 50, anuladoPor: 'Gloria' })
    expect(aplicarOp(a, { tipo: 'borrarPedido', id: 'a', at: 99, por: 'Otra' })).toBe(a)
  })
})

describe('cerrarCaja', () => {
  const abierto = () => {
    let e = { ...estadoVacio(), jornada: { id: 'j1', contador: 0, abiertaAt: 0 } }
    e = aplicarOp(e, { tipo: 'crearPedido', pedido: pedido('a') })
    e = aplicarOp(e, { tipo: 'entrar', turno: { id: 't1', persona: 'Mariana', inicio: 10, fin: null } })
    e = aplicarOp(e, { tipo: 'entrar', turno: { id: 't2', persona: 'Fredy', inicio: 20, fin: null } })
    return aplicarOp(e, { tipo: 'salir', id: 't2', fin: 30 })
  }
  const op = { tipo: 'cerrarCaja', jornadaId: 'j1', nuevaJornadaId: 'j2', cierre: { id: 'c1', total: 3500 }, at: 100 }

  it('archiva el día, numera de cero y deja el turno abierto en el día nuevo', () => {
    const e = aplicarOp(abierto(), op)
    expect(e.cierres).toEqual([{ id: 'c1', total: 3500 }])
    expect(e.pedidos).toEqual([])
    expect(e.jornada).toEqual({ id: 'j2', contador: 0, abiertaAt: 100 })
    expect(e.turnos).toEqual([{ id: 't1', persona: 'Mariana', inicio: 100, fin: null }])
    expect(aplicarOp(e, { tipo: 'crearPedido', pedido: pedido('b') }).pedidos[0].code).toBe('001')
  })

  it('reintentar el mismo cierre no hace nada', () => {
    const e = aplicarOp(abierto(), op)
    expect(aplicarOp(e, op)).toBe(e)
  })

  it('si otro celular ya cerró esa jornada, no cierra encima', () => {
    const e = aplicarOp(abierto(), op)
    const otro = { ...op, cierre: { id: 'c2' }, nuevaJornadaId: 'j3' }
    expect(aplicarOp(e, otro)).toBe(e)
  })
})

describe('vitrina', () => {
  it('marcar sabor y producto es explícito e idempotente', () => {
    const e = conDia()
    const con = aplicarOp(e, { tipo: 'marcarSabor', id: 'mora', activo: true })
    expect(con.vitrina.sabores).toEqual(['lulo', 'mora'])
    expect(aplicarOp(con, { tipo: 'marcarSabor', id: 'mora', activo: true })).toBe(con)
    const agotado = aplicarOp(con, { tipo: 'marcarProducto', id: 'copa-bayles', agotado: true })
    expect(agotado.vitrina.productosAgotados).toEqual(['copa-bayles'])
  })

  it('antes de abrir el día no se marca nada', () => {
    const e = estadoVacio()
    expect(aplicarOp(e, { tipo: 'marcarSabor', id: 'mora', activo: true })).toBe(e)
  })

  it('abrir el día limpia los productos agotados', () => {
    const e = aplicarOp(conDia(), { tipo: 'marcarProducto', id: 'x', agotado: true })
    const nuevo = aplicarOp(e, { tipo: 'abrirDia', fecha: '2026-10-23', sabores: ['mora'] })
    expect(nuevo.vitrina).toMatchObject({ fecha: '2026-10-23', sabores: ['mora'], productosAgotados: [] })
  })

  it('un sabor nuevo queda disponible de una y se puede borrar', () => {
    const sabor = { id: 'matcha', name: 'Té verde matcha', color: '#7a9' }
    const con = aplicarOp(conDia(), { tipo: 'agregarSaborExtra', sabor })
    expect(con.vitrina.saboresExtra).toEqual([sabor])
    expect(con.vitrina.sabores).toContain('matcha')
    expect(aplicarOp(con, { tipo: 'agregarSaborExtra', sabor })).toBe(con)
    const sin = aplicarOp(con, { tipo: 'eliminarSaborExtra', id: 'matcha' })
    expect(sin.vitrina.saboresExtra).toEqual([])
    expect(sin.vitrina.sabores).not.toContain('matcha')
  })

  it('volver a preguntar los sabores borra la apertura', () => {
    const e = aplicarOp(conDia(), { tipo: 'reabrirDia' })
    expect(e.vitrina).toMatchObject({ fecha: null, sabores: [], productosAgotados: [] })
  })
})

describe('aplicarPendientes', () => {
  it('lo pendiente se ve encima del estado del servidor', () => {
    const servidor = aplicarOp(estadoVacio(), { tipo: 'crearPedido', pedido: pedido('a') })
    const visto = aplicarPendientes(servidor, [
      { tipo: 'crearPedido', pedido: pedido('b') },
      { tipo: 'despachar', id: 'a', at: 3 },
    ])
    expect(visto.pedidos.map((p) => [p.id, p.code, p.status])).toEqual([
      ['b', null, 'pendiente'],
      ['a', '001', 'despachado'],
    ])
    // Sin pendientes es exactamente el del servidor.
    expect(aplicarPendientes(servidor, [])).toBe(servidor)
  })

  it('rechaza operaciones desconocidas', () => {
    expect(() => aplicarOp(estadoVacio(), { tipo: 'inventada' })).toThrow(/desconocida/)
  })
})
