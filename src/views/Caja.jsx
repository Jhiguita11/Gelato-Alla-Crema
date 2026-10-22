import { useMemo, useRef, useState } from 'react'
import { Dato, Ranking } from '../components/Cifras'
import ComprobanteCierre from '../components/ComprobanteCierre'
import Reportes from '../components/Reportes'
import { useMotor } from '../sync/MotorProvider'
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
 *
 * Las cifras son solo del administrador. El personal ve cuántos pedidos faltan
 * por despachar o cobrar y puede cerrar la caja, pero sin montos. En modo
 * compartido la base de datos hace cumplir esto: el personal no puede leer el
 * historial ni los días anteriores aunque lo intente por fuera de la app.
 */
export default function Caja() {
  const { rol } = useMotor()
  return rol === 'admin' ? <CajaAdmin /> : <CajaPersonal />
}

/**
 * Confirma y cierra la caja. Con `conMontos` los avisos dicen cuánta plata
 * queda sin cobrar; sin él, solo cuántos pedidos (para el personal).
 */
function confirmarCierre(r, { conMontos }) {
  if (r.pendientes > 0) {
    const sigue = confirm(
      `Todavía hay ${r.pendientes} ${r.pendientes === 1 ? 'pedido' : 'pedidos'} sin entregar.\n\n` +
        '¿Cerrar la caja de todas formas?',
    )
    if (!sigue) return false
  }

  if (r.sinPagar > 0) {
    const sigue = confirm(
      `Quedan ${r.sinPagar} ${r.sinPagar === 1 ? 'pedido' : 'pedidos'} sin cobrar` +
        (conMontos ? `, por ${formatCOP(r.porCobrar)}` : '') +
        '.\n\nSi cierras, quedan registrados como no cobrados. ¿Seguir?',
    )
    if (!sigue) return false
  }

  return confirm(
    (conMontos
      ? `Se va a cerrar el día con ${formatCOP(r.total)} en ${r.pedidos} pedidos.`
      : `Se va a cerrar el día con ${r.pedidos} ${r.pedidos === 1 ? 'pedido' : 'pedidos'}.`) +
      '\n\nLos pedidos se archivan y la numeración vuelve a #001.',
  )
}

/** Lo que ve el personal: sin cifras de plata. */
function CajaPersonal() {
  const { todos, cerrarCaja } = useOrders()
  const { turnos } = useTurnos()
  const { admin } = useMotor()
  const [cerrado, setCerrado] = useState(false)
  const r = useMemo(() => resumenDelDia(todos, turnos), [todos, turnos])
  const hayMovimiento = r.pedidos > 0

  function intentarCierre() {
    if (!hayMovimiento || !confirmarCierre(r, { conMontos: false })) return
    cerrarCaja(r)
    setCerrado(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
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

      {cerrado && !hayMovimiento && (
        <p className="animar-entrada mt-5 rounded-2xl border-2 border-menta-500 bg-menta-100 px-4 py-3 text-sm font-medium text-cacao-900">
          ✓ Caja cerrada. El documento del día lo ve el administrador.
        </p>
      )}

      <section className="mt-6 grid grid-cols-3 gap-3">
        <Dato valor={r.pedidos} etiqueta={r.pedidos === 1 ? 'Pedido' : 'Pedidos'} />
        <Dato valor={r.pendientes} etiqueta="Sin entregar" acento="cacao" />
        <Dato valor={r.sinPagar} etiqueta="Sin cobrar" acento="cacao" />
      </section>

      <p className="mt-6 rounded-2xl bg-crema-100 px-4 py-3 text-sm text-cacao-800/70">
        Las cifras de venta, el historial y los reportes los ve solo el administrador.
      </p>

      {admin.disponible && <EntrarAdmin onEntrar={admin.entrar} />}
    </div>
  )
}

/** Formulario para pasar este celular a la cuenta del administrador. */
function EntrarAdmin({ onEntrar }) {
  const [abierto, setAbierto] = useState(false)
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(event) {
    event.preventDefault()
    if (!clave || enviando) return
    setEnviando(true)
    setError(null)
    const problema = await onEntrar(clave)
    setEnviando(false)
    if (problema) {
      setError(problema)
      setClave('')
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-8 text-sm font-semibold text-menta-700 underline-offset-4 hover:underline"
      >
        Entrar como administrador
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className="mt-8 max-w-sm rounded-2xl border-2 border-crema-200 bg-white p-4">
      <label htmlFor="clave-admin" className="text-sm font-semibold text-cacao-900">
        Contraseña del administrador
      </label>
      <input
        id="clave-admin"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        className="mt-2 w-full rounded-xl border-2 border-crema-200 px-3 py-2.5 text-cacao-900 outline-none focus:border-menta-500"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-cono-600">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={!clave || enviando}
          className="rounded-xl bg-menta-700 px-4 py-2.5 text-sm font-bold text-crema-50 disabled:opacity-40"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-cacao-800/60"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Lo que ve el administrador: todo. */
function CajaAdmin() {
  const { todos, cierres, cerrarCaja, importarCierres } = useOrders()
  const { admin, sync } = useMotor()
  const { turnos } = useTurnos()
  // Se guardan ids y no copias: el cierre sale del historial. En modo
  // compartido, si el servidor rechaza el cierre (otro celular cerró primero),
  // desaparece del historial y con él el aviso y el documento.
  const [ultimoCierreId, setUltimoCierreId] = useState(null)
  // Cierre que se está viendo como documento imprimible.
  const [comprobanteId, setComprobanteId] = useState(null)
  const ultimoCierre = cierres.find((c) => c.id === ultimoCierreId) ?? null
  const comprobante = cierres.find((c) => c.id === comprobanteId) ?? null

  const r = useMemo(() => resumenDelDia(todos, turnos), [todos, turnos])
  const hayMovimiento = r.pedidos > 0

  function intentarCierre() {
    if (!hayMovimiento || !confirmarCierre(r, { conMontos: true })) return

    // Archiva el día, reinicia la numeración y los turnos de quien siga conectado.
    const cierre = cerrarCaja(r)
    setUltimoCierreId(cierre.id)
    setComprobanteId(cierre.id) // el documento del día sale de una
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-cacao-900">
            Caja del día
            {admin.disponible && (
              <span className="rounded-full bg-cacao-900 px-2.5 py-0.5 font-sans text-[11px] font-bold uppercase tracking-wide text-crema-50">
                Admin
              </span>
            )}
          </h2>
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
            onClick={() => setComprobanteId(ultimoCierre.id)}
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
        {r.anulados > 0 && (
          <p className="mt-4 text-sm text-cacao-800/70">
            Anulados hoy: {r.anulados} {r.anulados === 1 ? 'pedido' : 'pedidos'} por{' '}
            {formatCOP(r.totalAnulado)} (no cuentan en el total).
          </p>
        )}
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

      {admin.disponible && <Reportes cargarRango={admin.cargarRango} />}

      {cierres.length > 0 && <Historial cierres={cierres} onVerDocumento={(c) => setComprobanteId(c.id)} />}

      <Respaldo cierres={cierres} onImportar={importarCierres} compartido={sync.modo === 'compartido'} />

      {admin.disponible && (
        <button
          type="button"
          onClick={() => {
            if (confirm('¿Salir de la cuenta del administrador?\n\nEste celular va a pedir el PIN del local.'))
              admin.salir()
          }}
          className="mt-10 text-sm font-semibold text-terracota-600 underline-offset-4 hover:underline"
        >
          Salir de la cuenta de administrador
        </button>
      )}

      {comprobante && (
        <ComprobanteCierre cierre={comprobante} onCerrar={() => setComprobanteId(null)} />
      )}
    </div>
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
function Respaldo({ cierres, onImportar, compartido }) {
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
        {compartido
          ? 'El historial está en el servidor. Igual conviene descargar una copia de vez en cuando; también sirve para subir cierres de antes del modo compartido.'
          : 'El historial de cierres solo se guarda en este navegador. Descarga una copia de vez en cuando: si se borran los datos o se cambia de celular, se puede volver a cargar.'}
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
