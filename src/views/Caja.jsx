import { useMemo, useRef, useState } from 'react'
import ComprobanteCierre from '../components/ComprobanteCierre'
import { formatCOP } from '../data/menu'
import { useOrders } from '../store/orders'
import { useTurnos } from '../store/turnos'
import { duracion, fechaLarga, resumenDelDia } from '../utils/resumen'
import { hora } from '../utils/describir'
import {
  cierresACSV,
  contarNuevos,
  crearRespaldo,
  descargar,
  leerRespaldo,
  nombreArchivo,
} from '../utils/respaldo'

/**
 * Cuenta del día: lo vendido desde que se abrió hasta que se cierra la caja.
 * Al cerrar, el resumen pasa al historial y la numeración vuelve a #001.
 */
export default function Caja() {
  const { orders, cierres, cerrarCaja, importarCierres } = useOrders()
  const { turnos, reiniciarTurnos } = useTurnos()
  const [ultimoCierre, setUltimoCierre] = useState(null)
  // Cierre que se está viendo como documento imprimible.
  const [comprobante, setComprobante] = useState(null)

  const r = useMemo(() => resumenDelDia(orders, turnos), [orders, turnos])
  const hayMovimiento = orders.length > 0

  function intentarCierre() {
    if (!hayMovimiento) return

    if (r.pendientes > 0) {
      const sigue = confirm(
        `Todavía hay ${r.pendientes} ${r.pendientes === 1 ? 'pedido' : 'pedidos'} sin despachar.\n\n` +
          '¿Cerrar la caja de todas formas?',
      )
      if (!sigue) return
    }

    if (r.sinPagar > 0) {
      const sigue = confirm(
        `Quedan ${r.sinPagar} ${r.sinPagar === 1 ? 'pedido' : 'pedidos'} sin cobrar, ` +
          `por ${formatCOP(r.porCobrar)}.\n\n` +
          'Si cierras, esa plata queda registrada como no cobrada. ¿Seguir?',
      )
      if (!sigue) return
    }

    const confirmado = confirm(
      `Se va a cerrar el día con ${formatCOP(r.total)} en ${r.pedidos} pedidos.\n\n` +
        'Los pedidos se archivan en el historial y la numeración vuelve a #001.',
    )
    if (!confirmado) return

    const cierre = cerrarCaja(r)
    reiniciarTurnos()
    setUltimoCierre(cierre)
    setComprobante(cierre) // el documento del día sale de una
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-cacao-900">Caja del día</h2>
          <p className="mt-1 text-sm text-cacao-800/60">
            {r.desde
              ? `Abierta desde las ${hora(r.desde)} · ${fechaLarga(r.desde)}`
              : 'Todavía no se ha vendido nada hoy.'}
          </p>
        </div>
        <button
          type="button"
          onClick={intentarCierre}
          disabled={!hayMovimiento}
          className="rounded-2xl bg-cacao-900 px-6 py-3.5 text-sm font-bold text-crema-50 shadow-lg shadow-cacao-900/15 transition enabled:hover:bg-cacao-800 disabled:cursor-not-allowed disabled:bg-crema-200 disabled:text-cacao-900/35 disabled:shadow-none"
        >
          Cerrar caja
        </button>
      </div>

      {ultimoCierre && (
        <div className="animar-entrada mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-menta-500 bg-menta-100 px-4 py-3">
          <p className="text-sm font-medium text-cacao-900">
            ✓ Caja cerrada con {formatCOP(ultimoCierre.total)} en {ultimoCierre.pedidos} pedidos.
            Está guardada abajo, en el historial.
          </p>
          <button
            type="button"
            onClick={() => setComprobante(ultimoCierre)}
            className="rounded-xl bg-menta-700 px-4 py-2 text-sm font-bold text-crema-50 transition hover:bg-menta-800"
          >
            Ver documento
          </button>
        </div>
      )}

      {/* Cifra principal del día */}
      <section className="mt-6 rounded-3xl border-2 border-crema-200 bg-white px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-cacao-800/50">
          Vendido hoy
        </p>
        <p className="mt-1 font-display text-5xl font-bold leading-none text-cacao-900">
          {formatCOP(r.total)}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato valor={formatCOP(r.cobrado)} etiqueta="Cobrado" acento="menta" />
          <Dato valor={formatCOP(r.porCobrar)} etiqueta="Por cobrar" acento="cacao" />
          <Dato valor={r.pedidos} etiqueta={r.pedidos === 1 ? 'Pedido' : 'Pedidos'} />
          <Dato valor={r.porcionesTotales} etiqueta="Porciones de helado" />
        </div>
      </section>

      {!hayMovimiento ? (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-crema-200 px-6 py-16 text-center">
          <p className="text-4xl" aria-hidden="true">
            🧾
          </p>
          <p className="mt-3 font-display text-lg font-bold text-cacao-900">La caja está en cero</p>
          <p className="mt-1 text-sm text-cacao-800/55">
            En cuanto entre el primer pedido, la cuenta empieza a correr aquí.
          </p>
        </div>
      ) : (
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
            nota="Para saber qué reponer"
            filas={r.sabores.map((s) => ({
              id: s.id,
              etiqueta: s.name,
              color: s.color,
              valor: s.porciones,
              texto: `${s.porciones}`,
            }))}
          />
        </div>
      )}

      {r.personas.length > 0 && (
        <section className="mt-6 rounded-3xl border-2 border-crema-200 bg-white p-5">
          <h3 className="font-display text-lg font-bold text-cacao-900">Quién atendió</h3>
          <p className="mt-0.5 text-xs text-cacao-800/50">
            Las mesas se cuentan sin repetir · el tiempo suma todos los turnos del día
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-crema-200 text-xs uppercase tracking-wide text-cacao-800/50">
                  <th className="pb-2 font-semibold">Persona</th>
                  <th className="pb-2 text-right font-semibold">Mesas</th>
                  <th className="pb-2 text-right font-semibold">Pedidos</th>
                  <th className="pb-2 text-right font-semibold">Vendido</th>
                  <th className="pb-2 text-right font-semibold">Conectada</th>
                </tr>
              </thead>
              <tbody>
                {r.personas.map((p) => (
                  <tr key={p.persona} className="border-b border-crema-100 last:border-0">
                    <td className="py-2.5 font-semibold text-cacao-900">{p.persona}</td>
                    <td className="py-2.5 text-right font-display text-lg font-bold text-menta-700 tabular-nums">
                      {p.mesas}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-cacao-800/70">
                      {p.pedidos}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-cacao-900">
                      {formatCOP(p.total)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-cacao-800/70">
                      {duracion(p.minutos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cierres.length > 0 && <Historial cierres={cierres} onVerDocumento={setComprobante} />}

      <Respaldo cierres={cierres} onImportar={importarCierres} />

      {comprobante && (
        <ComprobanteCierre cierre={comprobante} onCerrar={() => setComprobante(null)} />
      )}
    </div>
  )
}

function Dato({ valor, etiqueta, acento }) {
  const color =
    acento === 'menta' ? 'text-menta-700' : acento === 'cacao' ? 'text-cono-600' : 'text-cacao-900'
  return (
    <div className="rounded-2xl bg-crema-50 px-4 py-3">
      <p className={`font-display text-xl font-bold leading-tight ${color}`}>{valor}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-cacao-800/50">
        {etiqueta}
      </p>
    </div>
  )
}

/**
 * Lista ordenada con barra de magnitud. Un solo tono, porque lo que se compara
 * es cuánto — no quién: la identidad ya la lleva el nombre de cada fila.
 */
function Ranking({ titulo, nota, filas }) {
  const max = Math.max(...filas.map((f) => f.valor), 1)

  return (
    <section className="rounded-3xl border-2 border-crema-200 bg-white p-5">
      <h3 className="font-display text-lg font-bold text-cacao-900">{titulo}</h3>
      <p className="mt-0.5 text-xs text-cacao-800/50">{nota}</p>

      <ul className="mt-4 space-y-3">
        {filas.map((fila) => (
          <li key={fila.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-cacao-900">
                {fila.color && (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: fila.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{fila.etiqueta}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-cacao-800/70">
                {fila.texto}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-crema-100">
              <div
                className="h-full rounded-r-[4px] bg-menta-500"
                style={{ width: `${Math.max((fila.valor / max) * 100, 3)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Historial({ cierres, onVerDocumento }) {
  const [abierto, setAbierto] = useState(null)

  return (
    <section className="mt-10">
      <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold text-menta-700">
        Cierres anteriores
        <span className="text-sm font-medium text-cacao-800/45">{cierres.length}</span>
        <span className="h-px flex-1 bg-crema-200" />
      </h3>

      <ul className="space-y-2">
        {cierres.map((cierre) => {
          const expandido = abierto === cierre.id
          return (
            <li
              key={cierre.id}
              className="overflow-hidden rounded-2xl border-2 border-crema-200 bg-white"
            >
              <button
                type="button"
                onClick={() => setAbierto(expandido ? null : cierre.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-crema-50"
              >
                <span className="text-sm font-semibold text-cacao-900">
                  {fechaLarga(cierre.cerradoAt)}
                  <span className="ml-2 font-normal text-cacao-800/50">
                    cerrada {hora(cierre.cerradoAt)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-cacao-800/50">
                    {cierre.pedidos} {cierre.pedidos === 1 ? 'pedido' : 'pedidos'}
                  </span>
                  <span className="font-display text-lg font-bold text-cacao-900">
                    {formatCOP(cierre.total)}
                  </span>
                  <span className="text-cacao-800/40">{expandido ? '▴' : '▾'}</span>
                </span>
              </button>

              {expandido && (
                <div className="animar-entrada border-t border-crema-200 px-4 py-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Dato valor={formatCOP(cierre.cobrado)} etiqueta="Cobrado" acento="menta" />
                    <Dato valor={formatCOP(cierre.porCobrar)} etiqueta="Sin cobrar" acento="cacao" />
                    <Dato valor={cierre.unidades} etiqueta="Productos" />
                    <Dato valor={cierre.porcionesTotales} etiqueta="Porciones" />
                  </div>

                  {cierre.productos?.length > 0 && (
                    <p className="mt-4 text-sm text-cacao-800/70">
                      <span className="font-medium text-cacao-800/50">Lo más vendido:</span>{' '}
                      {cierre.productos
                        .slice(0, 3)
                        .map((p) => `${p.name} (${p.cantidad})`)
                        .join(' · ')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onVerDocumento(cierre)}
                    className="mt-4 rounded-xl bg-menta-700 px-4 py-2.5 text-sm font-bold text-crema-50 transition hover:bg-menta-800"
                  >
                    Ver documento del día
                  </button>

                  {cierre.sabores?.length > 0 && (
                    <p className="mt-1 text-sm text-cacao-800/70">
                      <span className="font-medium text-cacao-800/50">Sabores que más salieron:</span>{' '}
                      {cierre.sabores
                        .slice(0, 3)
                        .map((s) => `${s.name} (${s.porciones})`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Copia de seguridad del historial. El historial solo existe en este
 * navegador: si se borran los datos o se cambia de celular, se pierde.
 */
function Respaldo({ cierres, onImportar }) {
  const entrada = useRef(null)
  const [mensaje, setMensaje] = useState(null)
  const hayCierres = cierres.length > 0

  function exportarJSON() {
    descargar(
      JSON.stringify(crearRespaldo(cierres), null, 2),
      nombreArchivo('json'),
      'application/json',
    )
  }

  function exportarCSV() {
    descargar(cierresACSV(cierres), nombreArchivo('csv'), 'text/csv;charset=utf-8')
  }

  async function importar(event) {
    const archivo = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (!archivo) return
    try {
      const importados = leerRespaldo(await archivo.text())
      const nuevos = contarNuevos(cierres, importados)
      if (nuevos === 0) {
        setMensaje({ ok: true, texto: 'Ese respaldo ya estaba cargado: no había cierres nuevos.' })
        return
      }
      onImportar(importados)
      setMensaje({
        ok: true,
        texto: `Listo: se agregaron ${nuevos} ${nuevos === 1 ? 'cierre' : 'cierres'} al historial.`,
      })
    } catch (error) {
      setMensaje({ ok: false, texto: error.message })
    }
  }

  const boton =
    'rounded-xl border-2 border-crema-200 bg-white px-4 py-2.5 text-sm font-bold text-cacao-900 transition enabled:hover:border-menta-500 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <section className="mt-10 rounded-3xl border-2 border-dashed border-crema-200 px-5 py-5">
      <h3 className="font-display text-lg font-bold text-cacao-900">Copia de seguridad</h3>
      <p className="mt-1 max-w-2xl text-sm text-cacao-800/60">
        El historial de cierres solo se guarda en este navegador. Descarga una copia de vez en
        cuando: si se borran los datos o se cambia de celular, se puede volver a cargar.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={exportarJSON} disabled={!hayCierres} className={boton}>
          Descargar respaldo
        </button>
        <button type="button" onClick={exportarCSV} disabled={!hayCierres} className={boton}>
          Descargar para Excel
        </button>
        <button type="button" onClick={() => entrada.current?.click()} className={boton}>
          Cargar respaldo…
        </button>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          onChange={importar}
          className="hidden"
        />
      </div>

      {mensaje && (
        <p
          role="status"
          className={`mt-3 text-sm font-medium ${mensaje.ok ? 'text-menta-700' : 'text-cono-600'}`}
        >
          {mensaje.texto}
        </p>
      )}
    </section>
  )
}
