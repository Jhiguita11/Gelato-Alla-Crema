import { describe, expect, it } from 'vitest'
import { espera, pedidosListosPara, pedidosNuevos, tituloPedido } from '../utils/avisos'

const p = (id, status, extra = {}) => ({ id, status, table: '2', code: '004', ...extra })

describe('pedidosNuevos (sonido en la cola de cocina)', () => {
  it('al abrir la pantalla no suena por lo que ya estaba', () => {
    expect(pedidosNuevos(null, [p('a', 'pendiente')])).toEqual([])
  })

  it('suena solo por los pedidos en preparación que llegaron', () => {
    const antes = [p('a', 'pendiente')]
    const ahora = [p('a', 'pendiente'), p('b', 'pendiente'), p('c', 'listo')]
    expect(pedidosNuevos(antes, ahora).map((x) => x.id)).toEqual(['b'])
  })

  it('cambiar de estado un pedido que ya estaba no suena', () => {
    expect(pedidosNuevos([p('a', 'pendiente')], [p('a', 'listo')])).toEqual([])
  })
})

describe('pedidosListosPara (aviso al mesero)', () => {
  const antes = [p('a', 'pendiente', { takenBy: 'Mariana' }), p('b', 'pendiente', { takenBy: 'Fredy' })]

  it('le avisa a quien tomó el pedido', () => {
    const ahora = [p('a', 'listo', { takenBy: 'Mariana' }), p('b', 'listo', { takenBy: 'Fredy' })]
    expect(pedidosListosPara(antes, ahora, 'Mariana').map((x) => x.id)).toEqual(['a'])
    expect(pedidosListosPara(antes, ahora, 'Fredy').map((x) => x.id)).toEqual(['b'])
  })

  it('si el pedido no tiene mesero, le avisa a todos', () => {
    const sinMesero = [p('c', 'pendiente')]
    expect(pedidosListosPara(sinMesero, [p('c', 'listo')], 'Gloria')).toHaveLength(1)
  })

  it('no avisa dos veces ni en la primera foto', () => {
    const ahora = [p('a', 'listo', { takenBy: 'Mariana' })]
    expect(pedidosListosPara(null, ahora, 'Mariana')).toEqual([])
    expect(pedidosListosPara(ahora, ahora, 'Mariana')).toEqual([])
  })

  it('no le avisa al equipo que lo marcó listo', () => {
    const ahora = [p('a', 'listo', { takenBy: 'Mariana' })]
    expect(pedidosListosPara(antes, ahora, 'Mariana', new Set(['a']))).toEqual([])
  })

  it('sin nadie conectado no avisa', () => {
    expect(pedidosListosPara(antes, [p('a', 'listo')], null)).toEqual([])
  })
})

describe('textos y espera', () => {
  it('título del aviso', () => {
    expect(tituloPedido(p('a', 'listo', { customer: 'Juliana' }))).toBe('#004 · Mesa 2 · Juliana')
    expect(tituloPedido({ table: 'Para llevar', code: null })).toBe('Para llevar')
  })

  it('color según los minutos de espera', () => {
    const t0 = 1_000_000
    expect(espera(t0, t0 + 3 * 60000)).toEqual({ minutos: 3, nivel: 'bien' })
    expect(espera(t0, t0 + 9 * 60000)).toEqual({ minutos: 9, nivel: 'atento' })
    expect(espera(t0, t0 + 20 * 60000)).toEqual({ minutos: 20, nivel: 'tarde' })
  })
})
