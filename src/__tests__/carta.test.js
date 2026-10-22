import { afterEach, describe, expect, it } from 'vitest'
import {
  PRODUCTS,
  armarCarta,
  congelarLinea,
  fijarCarta,
  lineTotal,
  precioDesde,
  productoPorId,
} from '../data/menu'
import { aplicarOp, aplicarPendientes, estadoVacio } from '../sync/estado'
import { describirLinea } from '../utils/describir'
import { resumenDelDia } from '../utils/resumen'

const nuevo = {
  id: 'affogato',
  name: 'Affogato',
  icon: '☕',
  category: 'casa',
  price: null,
  porciones: 0,
  variantesTitulo: '¿De qué tamaño?',
  variantes: [
    { id: 'chico', name: 'Chico', porciones: 1, price: 9000 },
    { id: 'grande', name: 'Grande', porciones: 2, price: 13000 },
  ],
  eligeSalsa: false,
  incluye: ['Café espresso'],
}

const conCambios = (...ops) => ops.reduce((e, op) => aplicarOp(e, op), estadoVacio())

afterEach(() => fijarCarta(null))

describe('operaciones de la carta', () => {
  it('guardar agrega un producto nuevo y es idempotente', () => {
    const op = { tipo: 'guardarProducto', producto: nuevo }
    const e1 = conCambios(op)
    expect(e1.carta).toEqual([{ id: 'affogato', datos: expect.objectContaining({ name: 'Affogato' }), oculto: false }])
    expect(aplicarOp(e1, op)).toBe(e1) // mismo objeto: no cambia nada
  })

  it('guardar no des-oculta y ocultar no borra lo editado', () => {
    const e = conCambios(
      { tipo: 'guardarProducto', producto: { ...PRODUCTS.find((p) => p.id === 'jugo'), price: 7000 } },
      { tipo: 'ocultarProducto', id: 'jugo', oculto: true },
      { tipo: 'guardarProducto', producto: { ...PRODUCTS.find((p) => p.id === 'jugo'), price: 7500 } },
    )
    expect(e.carta).toEqual([{ id: 'jugo', datos: expect.objectContaining({ price: 7500 }), oculto: true }])
  })

  it('ocultar un producto de fábrica sin editarlo deja datos en null', () => {
    const e = conCambios({ tipo: 'ocultarProducto', id: 'limonada', oculto: true })
    expect(e.carta).toEqual([{ id: 'limonada', datos: null, oculto: true }])
    expect(aplicarOp(e, { tipo: 'ocultarProducto', id: 'limonada', oculto: true })).toBe(e)
  })

  it('restaurar quita los cambios', () => {
    const e = conCambios(
      { tipo: 'ocultarProducto', id: 'limonada', oculto: true },
      { tipo: 'restaurarProducto', id: 'limonada' },
    )
    expect(e.carta).toEqual([])
    expect(aplicarOp(e, { tipo: 'restaurarProducto', id: 'limonada' })).toBe(e)
  })

  it('se pueden aplicar como pendientes encima del servidor (cola sin internet)', () => {
    const base = estadoVacio()
    const vista = aplicarPendientes(base, [
      { tipo: 'guardarProducto', producto: nuevo },
      { tipo: 'ocultarProducto', id: 'affogato', oculto: true },
    ])
    expect(vista.carta[0]).toMatchObject({ id: 'affogato', oculto: true })
  })
})

describe('armarCarta', () => {
  it('sin cambios es la carta de fábrica, en el mismo orden', () => {
    const carta = armarCarta([])
    expect(carta.map((x) => x.producto.id)).toEqual(PRODUCTS.map((p) => p.id))
    expect(carta.every((x) => x.deFabrica && !x.oculto && !x.editado)).toBe(true)
  })

  it('aplica lo editado sobre el de fábrica y conserva lo que no se edita', () => {
    const base = PRODUCTS.find((p) => p.id === 'cono-vaso-canasta')
    const { carta } = conCambios({
      tipo: 'guardarProducto',
      producto: { ...base, name: 'Helado al gusto', variantes: base.variantes.slice(0, 2) },
    })
    const x = armarCarta(carta).find((i) => i.producto.id === 'cono-vaso-canasta')
    expect(x.editado).toBe(true)
    expect(x.producto.name).toBe('Helado al gusto')
    expect(x.producto.variantes).toHaveLength(2)
    expect(x.producto.opciones).toEqual(base.opciones) // recipiente sigue ahí
  })

  it('pasar de versiones a precio único funciona (variantes: null)', () => {
    const base = PRODUCTS.find((p) => p.id === 'concha')
    const { carta } = conCambios({
      tipo: 'guardarProducto',
      producto: { ...base, variantes: null, variantesTitulo: null, price: 9000, porciones: 1 },
    })
    const p = armarCarta(carta).find((i) => i.producto.id === 'concha').producto
    expect(precioDesde(p)).toBe(9000)
  })

  it('los nuevos van al final y los ocultos se marcan', () => {
    const { carta } = conCambios(
      { tipo: 'guardarProducto', producto: nuevo },
      { tipo: 'ocultarProducto', id: 'jugo', oculto: true },
    )
    const armada = armarCarta(carta)
    expect(armada.at(-1)).toMatchObject({ deFabrica: false, oculto: false, producto: { id: 'affogato' } })
    expect(armada.find((x) => x.producto.id === 'jugo').oculto).toBe(true)
  })
})

describe('precios y nombres congelados en el pedido', () => {
  it('lo vendido no cambia si el admin cambia el precio o el nombre después', () => {
    const { carta } = conCambios({ tipo: 'guardarProducto', producto: nuevo })
    fijarCarta(armarCarta(carta))
    const linea = congelarLinea({ productId: 'affogato', varianteId: 'grande', quantity: 2 })
    expect(linea).toMatchObject({ nombre: 'Affogato', varianteNombre: 'Grande', porciones: 2, precio: 13000 })
    expect(lineTotal(linea)).toBe(26000)

    // El admin sube el precio, renombra y cambia las versiones.
    const despues = conCambios(
      { tipo: 'guardarProducto', producto: nuevo },
      {
        tipo: 'guardarProducto',
        producto: { ...nuevo, name: 'Affogato doble', variantes: [{ id: 'unico', name: 'Único', porciones: 1, price: 20000 }] },
      },
    )
    fijarCarta(armarCarta(despues.carta))
    expect(lineTotal(linea)).toBe(26000)
    const d = describirLinea(linea)
    expect(d.titulo).toBe('Affogato')
    expect(d.variante).toBe('Grande')
    expect(d.porciones).toBe('2 porciones')

    // Una línea nueva (sin congelar) sí usa la carta de ahora.
    expect(lineTotal({ productId: 'affogato', varianteId: 'unico' })).toBe(20000)
  })

  it('un producto oculto se sigue encontrando para los pedidos viejos', () => {
    const { carta } = conCambios({ tipo: 'ocultarProducto', id: 'limonada', oculto: true })
    fijarCarta(armarCarta(carta))
    expect(productoPorId('limonada')?.name).toBe('Limonada')
  })

  it('el resumen del día usa el nombre y el precio con los que se vendió', () => {
    const { carta } = conCambios({ tipo: 'guardarProducto', producto: nuevo })
    fijarCarta(armarCarta(carta))
    const linea = congelarLinea({ productId: 'affogato', varianteId: 'chico', quantity: 1 })
    fijarCarta(armarCarta([])) // el producto ya no existe en la carta
    const r = resumenDelDia([{ id: 'p', table: '1', lines: [linea], total: 9000, paid: true, createdAt: 1 }])
    const fila = r.productos.find((x) => x.id === 'affogato')
    expect(fila).toMatchObject({ name: 'Affogato', cantidad: 1, total: 9000 })
  })
})

describe('formulario de la carta (validarProducto)', async () => {
  const { validarProducto, aSlug } = await import('../utils/carta')
  const carta = armarCarta([])
  const form = (extra = {}) => ({
    name: 'Affogato',
    icon: '☕',
    category: 'casa',
    conVersiones: false,
    price: '9.000',
    porciones: 1,
    variantesTitulo: '¿Qué tamaño?',
    variantes: [],
    eligeSalsa: false,
    incluye: ' Café espresso ,  , Galleta ',
    ...extra,
  })

  it('arma un producto de precio único con id a partir del nombre', () => {
    const { producto, error } = validarProducto(form(), { item: null, carta })
    expect(error).toBeUndefined()
    expect(producto).toEqual({
      id: 'affogato',
      name: 'Affogato',
      icon: '☕',
      category: 'casa',
      eligeSalsa: false,
      incluye: ['Café espresso', 'Galleta'],
      price: 9000,
      porciones: 1,
      variantes: null,
      variantesTitulo: null,
    })
  })

  it('no repite id aunque el nombre choque con uno quitado', () => {
    const conQuitado = armarCarta([{ id: 'affogato', datos: { name: 'Viejo', category: 'casa', price: 1 }, oculto: true }])
    expect(validarProducto(form(), { item: null, carta: conQuitado }).producto.id).toBe('affogato-2')
  })

  it('rechaza nombre vacío, repetido o precio sin poner', () => {
    expect(validarProducto(form({ name: '  ' }), { item: null, carta }).error).toMatch(/nombre/)
    expect(validarProducto(form({ name: 'limonada' }), { item: null, carta }).error).toMatch(/Ya hay/)
    expect(validarProducto(form({ price: '' }), { item: null, carta }).error).toMatch(/precio/)
    expect(validarProducto(form({ price: '90000000' }), { item: null, carta }).error).toMatch(/ceros/)
  })

  it('editar no choca consigo mismo y conserva el id', () => {
    const item = carta.find((x) => x.producto.id === 'limonada')
    const r = validarProducto(form({ name: 'Limonada', price: '6500' }), { item, carta })
    expect(r.producto).toMatchObject({ id: 'limonada', price: 6500 })
  })

  it('con versiones: conserva los ids existentes y crea ids nuevos sin choques', () => {
    const item = carta.find((x) => x.producto.id === 'concha')
    const r = validarProducto(
      form({
        name: 'Concha de helado',
        conVersiones: true,
        variantes: [
          { id: 'x1', name: '1 porción', porciones: 1, price: '11000' },
          { id: 'x2', name: '2 porciones', porciones: 2, price: '15000' },
          { id: null, name: 'Familiar', porciones: 4, price: '26.000' },
        ],
      }),
      { item, carta },
    )
    expect(r.producto.price).toBeNull()
    expect(r.producto.variantes).toEqual([
      { id: 'x1', name: '1 porción', detalle: '1 porción', porciones: 1, price: 11000 },
      { id: 'x2', name: '2 porciones', detalle: '2 porciones', porciones: 2, price: 15000 },
      { id: 'familiar', name: 'Familiar', detalle: '4 porciones', porciones: 4, price: 26000 },
    ])
  })

  it('con versiones pide al menos dos, con nombre y precio, sin repetir', () => {
    const v = (name, price) => ({ id: null, name, porciones: 1, price })
    const intentar = (variantes) =>
      validarProducto(form({ conVersiones: true, variantes }), { item: null, carta }).error
    expect(intentar([v('Única', '5000')])).toMatch(/al menos dos/)
    expect(intentar([v('', '5000'), v('B', '6000')])).toMatch(/nombre/)
    expect(intentar([v('A', '5000'), v('a', '6000')])).toMatch(/mismo nombre/)
    expect(intentar([v('A', '5000'), v('B', '')])).toMatch(/precio de "B"/)
  })

  it('aSlug quita tildes y signos', () => {
    expect(aSlug('  Té verde ¡Matcha! ')).toBe('te-verde-matcha')
  })
})
