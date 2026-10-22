import { describe, expect, it } from 'vitest'
import {
  cierresACSV,
  contarNuevos,
  crearRespaldo,
  fusionarCierres,
  leerRespaldo,
} from '../utils/respaldo'

const cierre = (id, cerradoAt, extra = {}) => ({ id, cerradoAt, total: 10000, ...extra })

describe('fusionarCierres', () => {
  it('no duplica al importar el mismo respaldo dos veces', () => {
    const actuales = [cierre('a', 2), cierre('b', 1)]
    const una = fusionarCierres(actuales, [cierre('b', 1), cierre('c', 3)])
    const dos = fusionarCierres(una, [cierre('b', 1), cierre('c', 3)])
    expect(dos.map((c) => c.id)).toEqual(['c', 'a', 'b'])
  })

  it('si el id ya existe, conserva el del equipo', () => {
    const r = fusionarCierres([cierre('a', 1, { total: 1 })], [cierre('a', 1, { total: 999 })])
    expect(r).toEqual([cierre('a', 1, { total: 1 })])
  })

  it('cuenta solo los nuevos', () => {
    expect(contarNuevos([cierre('a', 1)], [cierre('a', 1), cierre('b', 2)])).toBe(1)
  })
})

describe('leerRespaldo', () => {
  const valido = JSON.stringify(crearRespaldo([cierre('a', 1)], 5))

  it('devuelve los cierres de un respaldo bueno', () => {
    expect(leerRespaldo(valido)).toEqual([cierre('a', 1)])
  })

  it('rechaza lo que no es JSON', () => {
    expect(() => leerRespaldo('hola')).toThrow(/no es JSON/)
  })

  it('rechaza archivos de otra app', () => {
    expect(() => leerRespaldo(JSON.stringify({ cierres: [] }))).toThrow(/no es un respaldo/)
  })

  it('rechaza respaldos de una versión más nueva', () => {
    const futuro = { ...crearRespaldo([]), version: 99 }
    expect(() => leerRespaldo(JSON.stringify(futuro))).toThrow(/versión más nueva/)
  })

  it('no importa nada si hay cierres dañados', () => {
    const dañado = crearRespaldo([cierre('a', 1), { id: 'b' }])
    expect(() => leerRespaldo(JSON.stringify(dañado))).toThrow(/1 cierres dañados/)
  })
})

describe('cierresACSV', () => {
  it('usa punto y coma, BOM y orden cronológico', () => {
    const csv = cierresACSV([
      cierre('b', new Date(2026, 6, 27, 21, 5).getTime(), { pedidos: 3 }),
      cierre('a', new Date(2026, 6, 26, 20, 0).getTime(), { pedidos: 1 }),
    ])
    expect(csv.startsWith('﻿Fecha;Hora de cierre;')).toBe(true)
    const filas = csv.trim().split('\r\n')
    expect(filas).toHaveLength(3)
    expect(filas[1].startsWith('2026-07-26;20:00;1;')).toBe(true)
    expect(filas[2].startsWith('2026-07-27;21:05;3;')).toBe(true)
  })

  it('escapa los textos con punto y coma o comillas', () => {
    const csv = cierresACSV([
      cierre('a', 1, { productos: [{ name: 'Copa "Bayles"; grande', cantidad: 2 }] }),
    ])
    expect(csv).toContain('"Copa ""Bayles""; grande (2)"')
  })
})
