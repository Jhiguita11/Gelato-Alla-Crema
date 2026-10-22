import { describe, expect, it } from 'vitest'
import { aplicarOp, estadoVacio } from '../sync/estado'
import { pedidosListosPara, pedidosNuevos } from '../utils/avisos'
import { resumenDelDia } from '../utils/resumen'

const linea = (uid, precio, extra = {}) => ({ uid, productId: 'jugo', quantity: 1, precio, ...extra })

function conPedido(extra = {}) {
  return aplicarOp(estadoVacio(), {
    tipo: 'crearPedido',
    pedido: {
      id: 'a',
      table: '2',
      takenBy: 'Gloria',
      lines: [linea('l1', 32000)],
      status: 'pendiente',
      paid: false,
      createdAt: 1000,
      dispatchedAt: null,
      paidAt: null,
      total: 32000,
      ...extra,
    },
  })
}
const agregar = (e, extra = {}) =>
  aplicarOp(e, {
    tipo: 'agregarAPedido',
    id: 'a',
    lineas: [linea('l2', 15000, { agregadaAt: 9000 })],
    monto: 15000,
    pagado: false,
    at: 9000,
    por: 'Fredy',
    ...extra,
  })
const pedidoDe = (e) => e.pedidos.find((p) => p.id === 'a')

describe('agregarAPedido (la misma gente pide algo más)', () => {
  it('a un pedido entregado y pagado: tacha lo entregado, reabre y debe solo lo nuevo', () => {
    let e = conPedido()
    e = aplicarOp(e, { tipo: 'despachar', id: 'a', at: 5000 })
    e = aplicarOp(e, { tipo: 'marcarPago', id: 'a', paid: true, at: 5500 })
    const p = pedidoDe(agregar(e))
    expect(p.lines).toEqual([
      linea('l1', 32000, { entregadaAt: 5000 }),
      linea('l2', 15000, { agregadaAt: 9000 }),
    ])
    expect(p).toMatchObject({
      status: 'pendiente',
      dispatchedAt: null,
      total: 47000,
      paid: false,
      paidAt: null,
      abonado: 32000,
      rondaAt: 9000,
      rondaPor: 'Fredy',
    })
  })

  it('a un pedido entregado sin pagar: debe todo, sin abonado', () => {
    let e = aplicarOp(conPedido(), { tipo: 'despachar', id: 'a', at: 5000 })
    const p = pedidoDe(agregar(e))
    expect(p).toMatchObject({ total: 47000, paid: false, abonado: null })
  })

  it('si pagan lo nuevo de una y lo anterior ya estaba pagado, queda pagado', () => {
    let e = aplicarOp(conPedido(), { tipo: 'marcarPago', id: 'a', paid: true, at: 2000 })
    const p = pedidoDe(agregar(e, { pagado: true }))
    expect(p).toMatchObject({ total: 47000, paid: true, paidAt: 2000, abonado: null })
  })

  it('a uno que estaba listo sin entregar: lo previo queda como listo, no tachado', () => {
    let e = aplicarOp(conPedido(), { tipo: 'marcarListo', id: 'a', at: 4000 })
    const p = pedidoDe(agregar(e))
    expect(p.lines[0]).toEqual(linea('l1', 32000, { listaAt: 4000 }))
    expect(p).toMatchObject({ status: 'pendiente', listoAt: null })
  })

  it('a uno en preparación: solo suma las líneas', () => {
    const p = pedidoDe(agregar(conPedido()))
    expect(p.lines[0]).toEqual(linea('l1', 32000))
    expect(p.total).toBe(47000)
  })

  it('una segunda ronda no vuelve a cambiar lo ya marcado como entregado', () => {
    let e = aplicarOp(conPedido(), { tipo: 'despachar', id: 'a', at: 5000 })
    e = agregar(e)
    e = aplicarOp(e, { tipo: 'despachar', id: 'a', at: 12000 })
    e = agregar(e, { lineas: [linea('l3', 6000, { agregadaAt: 20000 })], monto: 6000, at: 20000 })
    expect(pedidoDe(e).lines.map((l) => l.entregadaAt)).toEqual([5000, 12000, undefined])
  })

  it('es idempotente (la cola puede reintentar) y no toca anulados', () => {
    const e1 = agregar(conPedido())
    expect(agregar(e1)).toBe(e1)
    const anulado = aplicarOp(conPedido(), { tipo: 'borrarPedido', id: 'a', at: 3000 })
    expect(agregar(anulado)).toBe(anulado)
  })

  it('marcar pagado o sin pagar olvida lo abonado', () => {
    let e = aplicarOp(conPedido(), { tipo: 'marcarPago', id: 'a', paid: true, at: 2000 })
    e = agregar(e)
    expect(pedidoDe(aplicarOp(e, { tipo: 'marcarPago', id: 'a', paid: true, at: 9500 }))).toMatchObject({
      paid: true,
      abonado: null,
    })
    expect(pedidoDe(aplicarOp(e, { tipo: 'marcarPago', id: 'a', paid: false, at: 9500 }))).toMatchObject({
      paid: false,
      abonado: null,
    })
  })
})

describe('caja y avisos con pedidos agregados', () => {
  it('el resumen cuenta lo abonado como cobrado', () => {
    let e = aplicarOp(conPedido(), { tipo: 'marcarPago', id: 'a', paid: true, at: 2000 })
    e = agregar(e)
    const r = resumenDelDia(e.pedidos)
    expect(r).toMatchObject({ total: 47000, cobrado: 32000, porCobrar: 15000 })
  })

  it('la cocina oye la ronda nueva aunque el pedido ya existía', () => {
    let antes = aplicarOp(conPedido(), { tipo: 'despachar', id: 'a', at: 5000 })
    const despues = agregar(antes)
    expect(pedidosNuevos(antes.pedidos, despues.pedidos).map((p) => p.id)).toEqual(['a'])
    // Sin cambios no vuelve a sonar.
    expect(pedidosNuevos(despues.pedidos, despues.pedidos)).toEqual([])
  })

  it('el aviso de "listo" le llega también a quien agregó la ronda', () => {
    const conRonda = agregar(conPedido())
    const listo = aplicarOp(conRonda, { tipo: 'marcarListo', id: 'a', at: 10000 })
    expect(pedidosListosPara(conRonda.pedidos, listo.pedidos, 'Fredy')).toHaveLength(1)
    expect(pedidosListosPara(conRonda.pedidos, listo.pedidos, 'Gloria')).toHaveLength(1)
    expect(pedidosListosPara(conRonda.pedidos, listo.pedidos, 'Mariana')).toHaveLength(0)
  })
})
