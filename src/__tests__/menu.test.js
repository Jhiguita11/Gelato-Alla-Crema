import { describe, expect, it } from 'vitest'
import { PRECIO_PORCION, lineTotal, orderTotal } from '../data/menu'

const cono = (n, extra = {}) => ({
  productId: 'cono-vaso-canasta',
  varianteId: `x${n}`,
  flavorIds: [],
  quantity: 1,
  ...extra,
})

describe('lineTotal', () => {
  it('la escalera del cono sale de $3.500 por porción', () => {
    expect(PRECIO_PORCION).toBe(3500)
    expect([1, 2, 3, 4, 5].map((n) => lineTotal(cono(n)))).toEqual([
      3500, 7000, 10500, 14000, 17500,
    ])
  })

  it('suma las adiciones que se cobran, incluida la porción extra', () => {
    const linea = cono(3, { adicionIds: ['queso', 'porcion-extra'] })
    expect(lineTotal(linea)).toBe(10500 + 1000 + 3500)
  })

  it('multiplica todo por la cantidad', () => {
    const linea = cono(2, { adicionIds: ['queso'], quantity: 3 })
    expect(lineTotal(linea)).toBe((7000 + 1000) * 3)
  })

  it('usa el precio de la variante elegida', () => {
    expect(lineTotal({ productId: 'ensalada-frutas', varianteId: 'especial' })).toBe(16000)
    expect(lineTotal({ productId: 'concha', varianteId: 'x1' })).toBe(10500)
  })

  it('un producto que ya no existe vale 0 en vez de romper la caja', () => {
    expect(lineTotal({ productId: 'no-existe', quantity: 2 })).toBe(0)
  })
})

describe('orderTotal', () => {
  it('suma todas las líneas', () => {
    expect(orderTotal({ lines: [cono(1), cono(2, { quantity: 2 })] })).toBe(3500 + 14000)
    expect(orderTotal({})).toBe(0)
  })
})
