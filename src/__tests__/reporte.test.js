import { describe, expect, it } from 'vitest'
import { aFecha, filasReporteCSV, porDia, rangoDe } from '../utils/reporte'

const hoy = new Date(2026, 9, 22, 15, 30) // 22 oct 2026, 3:30 p. m. local

describe('rangoDe', () => {
  it('últimos 7 días incluye hoy y termina a medianoche de mañana', () => {
    const r = rangoDe('7d', null, hoy)
    expect(r.fechas).toEqual({ desde: '2026-10-16', hasta: '2026-10-22' })
    expect(r.hasta).toEqual(new Date(2026, 9, 23))
  })

  it('este mes y mes pasado', () => {
    expect(rangoDe('mes', null, hoy).fechas).toEqual({ desde: '2026-10-01', hasta: '2026-10-22' })
    expect(rangoDe('mes-pasado', null, hoy).fechas).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
    // Enero → diciembre del año anterior.
    expect(rangoDe('mes-pasado', null, new Date(2027, 0, 10)).fechas).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-31',
    })
  })

  it('fechas a mano: valida el orden', () => {
    expect(rangoDe('otro', { desde: '2026-10-05', hasta: '2026-10-07' }).hasta).toEqual(new Date(2026, 9, 8))
    expect(rangoDe('otro', { desde: '2026-10-07', hasta: '2026-10-05' }).valido).toBe(false)
    expect(rangoDe('otro', { desde: '', hasta: '2026-10-05' }).valido).toBe(false)
  })
})

describe('porDia', () => {
  it('agrupa por día local, sin anulados, del más reciente al más viejo', () => {
    const p = (fecha, total, extra = {}) => ({ createdAt: fecha.getTime(), total, ...extra })
    const dias = porDia([
      p(new Date(2026, 9, 21, 23, 50), 3500), // casi medianoche: sigue siendo el 21
      p(new Date(2026, 9, 22, 0, 10), 7000),
      p(new Date(2026, 9, 22, 12, 0), 1000),
      p(new Date(2026, 9, 22, 13, 0), 9999, { anuladoAt: 1 }),
    ])
    expect(dias.map((d) => [d.fecha, d.pedidos, d.total])).toEqual([
      ['2026-10-22', 2, 8000],
      ['2026-10-21', 1, 3500],
    ])
  })
})

describe('filasReporteCSV', () => {
  it('un renglón por pedido, con anulados marcados', () => {
    const csv = filasReporteCSV(
      [
        {
          createdAt: new Date(2026, 9, 22, 9, 5).getTime(),
          code: '001',
          table: '2',
          takenBy: 'Mariana',
          customer: 'Ana; Pérez',
          lines: [{ productId: 'x' }],
          total: 7000,
          paid: true,
          status: 'despachado',
          anuladoAt: 1,
          anuladoPor: 'Fredy',
        },
      ],
      () => ({ cantidad: 2, titulo: 'Cono', variante: '2' }),
    )
    const [enc, fila] = csv.replace('﻿', '').trim().split('\r\n')
    expect(enc.split(';')[0]).toBe('Fecha')
    expect(fila).toBe('2026-10-22;09:05;001;2;Mariana;"Ana; Pérez";2× Cono (2);7000;Sí;Sí;Sí;Fredy')
  })

  it('aFecha usa la fecha local', () => {
    expect(aFecha(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})
