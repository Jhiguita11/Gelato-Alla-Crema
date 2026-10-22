import { describe, expect, it } from 'vitest'
import { orderTotal } from '../data/menu'
import { porcionesDeLinea, resumenDelDia, saboresDeLinea } from '../utils/resumen'

const pedido = (lines, extra = {}) => ({
  id: crypto.randomUUID(),
  table: '1',
  takenBy: 'Mariana',
  lines,
  status: 'pendiente',
  paid: false,
  createdAt: 1_000,
  total: orderTotal({ lines }),
  ...extra,
})

// Cono de 2 porciones (frutos rojos + vainilla chips) con porción extra de
// frutos rojos, pedido 2 veces.
const conExtra = {
  productId: 'cono-vaso-canasta',
  varianteId: 'x2',
  flavorIds: ['frutos-rojos', 'vainilla-chips'],
  adicionIds: ['porcion-extra'],
  adicionSabores: { 'porcion-extra': 'frutos-rojos' },
  quantity: 2,
}

describe('porción extra de helado', () => {
  it('cuenta en las porciones de la línea', () => {
    expect(porcionesDeLinea(conExtra)).toBe((2 + 1) * 2)
  })

  it('suma su sabor a los de la línea', () => {
    expect(saboresDeLinea(conExtra)).toEqual(['frutos-rojos', 'vainilla-chips', 'frutos-rojos'])
  })

  it('aparece en porciones por sabor y en el total de la caja', () => {
    const r = resumenDelDia([pedido([conExtra])])
    expect(r.porcionesTotales).toBe(6)
    const porSabor = Object.fromEntries(r.sabores.map((s) => [s.id, s.porciones]))
    expect(porSabor).toEqual({ 'frutos-rojos': 4, 'vainilla-chips': 2 })
    // Lo más pedido va primero.
    expect(r.sabores[0].id).toBe('frutos-rojos')
  })

  it('no cuenta el sabor si la adición se desmarcó después de elegirlo', () => {
    const desmarcada = { ...conExtra, adicionIds: [] }
    expect(porcionesDeLinea(desmarcada)).toBe(4)
    expect(saboresDeLinea(desmarcada)).toEqual(['frutos-rojos', 'vainilla-chips'])
  })
})

describe('resumenDelDia', () => {
  it('separa lo cobrado de lo que falta por cobrar', () => {
    const uno = { productId: 'cono-vaso-canasta', varianteId: 'x1', flavorIds: ['frutos-rojos'] }
    const r = resumenDelDia([
      pedido([uno], { paid: true }),
      pedido([{ ...uno, quantity: 2 }], { status: 'despachado' }),
    ])
    expect(r.total).toBe(3500 * 3)
    expect(r.cobrado).toBe(3500)
    expect(r.porCobrar).toBe(7000)
    expect(r.pendientes).toBe(1)
    expect(r.sinPagar).toBe(1)
  })

  it('cuenta las mesas de cada persona sin repetir', () => {
    const uno = { productId: 'brownie', quantity: 1 }
    const r = resumenDelDia([
      pedido([uno], { table: '2' }),
      pedido([uno], { table: '2' }),
      pedido([uno], { table: '3' }),
    ])
    expect(r.personas).toHaveLength(1)
    expect(r.personas[0]).toMatchObject({ persona: 'Mariana', mesas: 2, pedidos: 3 })
  })

  it('los anulados no cuentan pero se reportan; los ocultos sí cuentan', () => {
    const uno = { productId: 'cono-vaso-canasta', varianteId: 'x1', flavorIds: ['frutos-rojos'] }
    const r = resumenDelDia([
      pedido([uno], { paid: true, status: 'despachado', oculto: true }),
      pedido([{ ...uno, quantity: 2 }], { anuladoAt: 5, anuladoPor: 'Fredy' }),
    ])
    expect(r.pedidos).toBe(1)
    expect(r.total).toBe(3500)
    expect(r.porcionesTotales).toBe(1)
    expect(r.anulados).toBe(1)
    expect(r.totalAnulado).toBe(7000)
  })

  it('"sin entregar" cuenta los en preparación y los listos', () => {
    const uno = { productId: 'brownie', quantity: 1 }
    const r = resumenDelDia([
      pedido([uno], { status: 'pendiente' }),
      pedido([uno], { status: 'listo' }),
      pedido([uno], { status: 'despachado' }),
    ])
    expect(r.pendientes).toBe(2)
  })

  it('un día sin pedidos queda en cero', () => {
    const r = resumenDelDia([])
    expect(r).toMatchObject({ pedidos: 0, total: 0, porcionesTotales: 0, desde: null })
  })
})
