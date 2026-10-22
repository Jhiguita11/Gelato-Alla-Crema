import { beforeEach, describe, expect, it } from 'vitest'
import { CLAVES, ejecutarLocal, leerLocal } from '../sync/motorLocal'

const guardar = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor))
const leido = (clave) => JSON.parse(localStorage.getItem(clave))

/** Lo que un celular tiene guardado con la versión de la app de antes. */
function datosDeAntes() {
  guardar(CLAVES.pedidos, [
    { id: 'p1', code: '007', table: '2', lines: [], status: 'pendiente', paid: false, total: 7000 },
  ])
  localStorage.setItem(CLAVES.contador, '7') // así lo guardaba la versión vieja
  guardar(CLAVES.cierres, [{ id: 'c0', cerradoAt: 1, total: 50000 }])
  guardar(CLAVES.turnos, {
    activo: { id: 't1', persona: 'Gloria', inicio: 100, fin: null },
    turnos: [{ id: 't1', persona: 'Gloria', inicio: 100, fin: null }],
  })
  guardar(CLAVES.vitrina, { fecha: '2026-10-22', sabores: ['lulo'], productosAgotados: [] })
  guardar(CLAVES.saboresExtra, [{ id: 'matcha', name: 'Matcha', color: '#7a9' }])
}

beforeEach(() => localStorage.clear())

describe('modo local: compatible con lo que ya está guardado', () => {
  it('lee los datos de la versión anterior sin migrar nada', () => {
    datosDeAntes()
    const { estado, activo } = leerLocal()
    expect(estado.jornada.contador).toBe(7)
    expect(estado.pedidos[0].code).toBe('007')
    expect(estado.cierres).toHaveLength(1)
    expect(estado.vitrina).toEqual({
      fecha: '2026-10-22',
      sabores: ['lulo'],
      productosAgotados: [],
      saboresExtra: [{ id: 'matcha', name: 'Matcha', color: '#7a9' }],
    })
    expect(activo.persona).toBe('Gloria')
  })

  it('sigue la numeración donde iba y guarda en el formato de siempre', () => {
    datosDeAntes()
    ejecutarLocal({
      tipo: 'crearPedido',
      pedido: { id: 'p2', table: '3', lines: [], status: 'pendiente', paid: false, total: 3500 },
    })
    expect(leido(CLAVES.pedidos).map((p) => p.code)).toEqual(['008', '007'])
    expect(leido(CLAVES.contador)).toBe(8)
  })

  it('parte de lo último guardado, no de una copia vieja (otra pestaña)', () => {
    datosDeAntes()
    // Otra pestaña agrega un cierre por su cuenta…
    guardar(CLAVES.cierres, [{ id: 'c1', cerradoAt: 2, total: 1 }, ...leido(CLAVES.cierres)])
    // …y esta pestaña importa otro: no se pierde ninguno.
    ejecutarLocal({ tipo: 'importarCierres', cierres: [{ id: 'c9', cerradoAt: 3, total: 9 }] })
    expect(leido(CLAVES.cierres).map((c) => c.id)).toEqual(['c9', 'c1', 'c0'])
  })

  it('entrar y salir manejan el turno de este equipo', () => {
    const turno = { id: 't9', persona: 'Fredy', inicio: 5, fin: null }
    ejecutarLocal({ tipo: 'entrar', turno })
    expect(leido(CLAVES.turnos).activo).toEqual(turno)
    ejecutarLocal({ tipo: 'salir', id: 't9', fin: 9 })
    expect(leido(CLAVES.turnos)).toEqual({ activo: null, turnos: [{ ...turno, fin: 9 }] })
  })

  it('cerrar caja: historial, contador a 0 y el turno abierto con la hora nueva', () => {
    datosDeAntes()
    const { estado } = ejecutarLocal({
      tipo: 'cerrarCaja',
      jornadaId: null,
      nuevaJornadaId: 'j2',
      cierre: { id: 'c1', cerradoAt: 500, total: 7000 },
      at: 500,
    })
    expect(estado.pedidos).toEqual([])
    expect(leido(CLAVES.pedidos)).toEqual([])
    expect(leido(CLAVES.contador)).toBe(0)
    expect(leido(CLAVES.cierres).map((c) => c.id)).toEqual(['c1', 'c0'])
    expect(leido(CLAVES.turnos).activo).toMatchObject({ id: 't1', inicio: 500 })
  })

  it('volver a preguntar los sabores borra la apertura guardada', () => {
    datosDeAntes()
    ejecutarLocal({ tipo: 'reabrirDia' })
    expect(localStorage.getItem(CLAVES.vitrina)).toBeNull()
    expect(leido(CLAVES.saboresExtra)).toHaveLength(1) // los sabores nuevos se quedan
  })

  it('una operación que no cambia nada no escribe', () => {
    datosDeAntes()
    const antes = localStorage.getItem(CLAVES.pedidos)
    localStorage.setItem(CLAVES.pedidos, antes + ' ') // marca: si se reescribe, desaparece
    ejecutarLocal({ tipo: 'despachar', id: 'no-existe', at: 1 })
    expect(localStorage.getItem(CLAVES.pedidos)).toBe(antes + ' ')
  })
})
