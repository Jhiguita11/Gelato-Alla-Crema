import { useEffect, useMemo, useState } from 'react'
import { Dato, Ranking } from './Cifras'
import ComprobanteCierre from './ComprobanteCierre'
import { formatCOP } from '../data/menu'
import { describirLinea } from '../utils/describir'
import { duracion, resumenDelDia } from '../utils/resumen'
import { descargar } from '../utils/respaldo'
import { filasReporteCSV, porDia, rangoDe } from '../utils/reporte'

const PERIODOS = [
  { id: '7d', etiqueta: 'Últimos 7 días' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mes-pasado', etiqueta: 'Mes pasado' },
  { id: 'otro', etiqueta: 'Otras fechas' },
]

/**
 * Reportes por rango de fechas, solo para el administrador. Se calculan sobre
 * los pedidos reales (no sobre las fotos de cada cierre), así que sirven para
 * cualquier periodo: una semana, un mes, "desde el 1 hasta hoy"…
 *
 * Los datos los pide `cargarRango`; la base de datos solo se los da al admin.
 */
export default function Reportes({ cargarRango }) {
  const [periodo, setPeriodo] = useState('7d')
  const [fechas, setFechas] = useState(() => rangoDe('7d').fechas)
  const [datos, setDatos] = useState(null)
  const [estado, setEstado] = useState('idle') // idle | cargando | listo | error
  const [error, setError] = useState(null)
  const [documento, setDocumento] = useState(false)

  const rango = useMemo(
    () => (periodo === 'otro' ? rangoDe('otro', fechas) : rangoDe(periodo)),
    [periodo, fechas],
  )

  useEffect(() => {
    if (!rango.valido) return
    let vivo = true
    setEstado('cargando')
    cargarRango(rango.desde, rango.hasta)
      .then((d) => {
        if (!vivo) return
        setDatos(d)
        setEstado('listo')
      })
      .catch((e) => {
        if (!vivo) return
        setError(e.message)
        setEstado('error')
      })
    return () => {
      vivo = false
    }
  }, [cargarRango, rango])

  const r = useMemo(() => (datos ? resumenDelDia(datos.pedidos, datos.turnos) : null), [datos])
  const dias = useMemo(() => (datos ? porDia(datos.pedidos) : []), [datos])

  function exportarCSV() {
    descargar(
      filasReporteCSV(datos.pedidos, describirLinea),
      `gelato-reporte-${rango.fechas.desde}_${rango.fechas.hasta}.csv`,
      'text/csv;charset=utf-8',
    )
  }

  return (
    <section className="mt-10 rounded-3xl border-2 border-crema-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-cacao-900">Reportes</h3>
          <p className="mt-0.5 text-xs text-cacao-800/50">{rango.texto}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition ${
                periodo === p.id
                  ? 'border-menta-700 bg-menta-700 text-crema-50'
                  : 'border-crema-200 text-cacao-900 hover:border-menta-400'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {periodo === 'otro' && (
        <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-cacao-800/60">Desde</span>
            <input
              type="date"
              value={fechas.desde}
              max={fechas.hasta}
              onChange={(e) => setFechas((f) => ({ ...f, desde: e.target.value }))}
              className="rounded-xl border-2 border-crema-200 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-cacao-800/60">Hasta</span>
            <input
              type="date"
              value={fechas.hasta}
              min={fechas.desde}
              onChange={(e) => setFechas((f) => ({ ...f, hasta: e.target.value }))}
              className="rounded-xl border-2 border-crema-200 px-3 py-2"
            />
          </label>
        </div>
      )}

      {estado === 'cargando' && <p className="mt-6 text-sm text-cacao-800/55">Cargando…</p>}
      {estado === 'error' && (
        <p role="alert" className="mt-6 text-sm font-medium text-cono-600">
          No se pudo cargar el reporte: {error}
        </p>
      )}

      {estado === 'listo' && r && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato valor={formatCOP(r.total)} etiqueta="Vendido" />
            <Dato valor={formatCOP(r.cobrado)} etiqueta="Cobrado" acento="menta" />
            <Dato valor={r.pedidos} etiqueta={r.pedidos === 1 ? 'Pedido' : 'Pedidos'} />
            <Dato
              valor={r.pedidos ? formatCOP(Math.round(r.total / r.pedidos)) : '—'}
              etiqueta="Ticket promedio"
            />
          </div>
          {(r.porCobrar > 0 || r.anulados > 0) && (
            <p className="mt-3 text-sm text-cacao-800/70">
              {r.porCobrar > 0 && <>Sin cobrar: {formatCOP(r.porCobrar)}. </>}
              {r.anulados > 0 && (
                <>
                  Anulados: {r.anulados} por {formatCOP(r.totalAnulado)}.
                </>
              )}
            </p>
          )}

          {r.pedidos === 0 ? (
            <p className="mt-6 text-sm text-cacao-800/55">No hay ventas en estas fechas.</p>
          ) : (
            <>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[22rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-crema-200 text-xs uppercase tracking-wide text-cacao-800/50">
                      <th className="pb-2 font-semibold">Día</th>
                      <th className="pb-2 text-right font-semibold">Pedidos</th>
                      <th className="pb-2 text-right font-semibold">Vendido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dias.map((d) => (
                      <tr key={d.fecha} className="border-b border-crema-100 last:border-0">
                        <td className="py-2 first-letter:uppercase">{d.etiqueta}</td>
                        <td className="py-2 text-right tabular-nums">{d.pedidos}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {formatCOP(d.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Ranking
                  titulo="Lo más vendido"
                  nota="Por unidades"
                  filas={r.productos.map((p) => ({
                    id: p.id,
                    etiqueta: `${p.icon} ${p.name}`,
                    valor: p.cantidad,
                    texto: `${p.cantidad} · ${formatCOP(p.total)}`,
                  }))}
                />
                <Ranking
                  titulo="Porciones por sabor"
                  nota="Para planear la producción"
                  filas={r.sabores.map((s) => ({
                    id: s.id,
                    etiqueta: s.name,
                    color: s.color,
                    valor: s.porciones,
                    texto: `${s.porciones}`,
                  }))}
                />
              </div>

              {r.personas.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-crema-200 text-xs uppercase tracking-wide text-cacao-800/50">
                        <th className="pb-2 font-semibold">Persona</th>
                        <th className="pb-2 text-right font-semibold">Pedidos</th>
                        <th className="pb-2 text-right font-semibold">Vendido</th>
                        <th className="pb-2 text-right font-semibold">Conectada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.personas.map((p) => (
                        <tr key={p.persona} className="border-b border-crema-100 last:border-0">
                          <td className="py-2 font-semibold">{p.persona}</td>
                          <td className="py-2 text-right tabular-nums">{p.pedidos}</td>
                          <td className="py-2 text-right tabular-nums">{formatCOP(p.total)}</td>
                          <td className="py-2 text-right tabular-nums">{duracion(p.minutos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDocumento(true)}
              disabled={r.pedidos === 0}
              className="rounded-xl bg-menta-700 px-4 py-2.5 text-sm font-bold text-crema-50 transition enabled:hover:bg-menta-800 disabled:opacity-40"
            >
              Ver documento / PDF
            </button>
            <button
              type="button"
              onClick={exportarCSV}
              disabled={datos.pedidos.length === 0}
              className="rounded-xl border-2 border-crema-200 px-4 py-2.5 text-sm font-bold text-cacao-900 transition enabled:hover:border-menta-500 disabled:opacity-40"
            >
              Descargar pedidos para Excel
            </button>
          </div>
        </>
      )}

      {documento && r && (
        <ComprobanteCierre
          cierre={{ ...r, cerradoAt: Date.now() }}
          etiqueta="Reporte de ventas"
          periodo={rango.texto}
          onCerrar={() => setDocumento(false)}
        />
      )}
    </section>
  )
}
