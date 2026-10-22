import { BRAND, formatCOP } from '../data/menu'
import { duracion, fechaLarga } from '../utils/resumen'
import { hora } from '../utils/describir'

/**
 * Documento del día que sale al cerrar la caja. Se ve en pantalla y al tocar
 * "Guardar PDF" se manda a imprimir: el navegador ofrece guardarlo como PDF
 * (en celular, además, compartirlo). Sin librerías ni servidor.
 */
/**
 * Documento imprimible. Sirve para un cierre de caja y, con `etiqueta` y
 * `periodo`, para un reporte de un rango de fechas.
 */
export default function ComprobanteCierre({ cierre, onCerrar, etiqueta = 'Cierre de caja', periodo }) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-cacao-900/60 p-0 backdrop-blur-sm sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* Barra de acciones: no sale impresa */}
        <div className="no-imprimir sticky top-0 z-10 border-b border-crema-200 bg-crema-50 px-4 py-3 sm:rounded-t-3xl">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-base font-bold text-cacao-900">Documento del día</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-menta-700 px-4 py-2.5 text-sm font-bold text-crema-50 transition hover:bg-menta-800"
              >
                Descargar PDF
              </button>
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-xl border-2 border-crema-200 bg-white px-4 py-2.5 text-sm font-semibold text-cacao-900 transition hover:border-terracota-600"
              >
                Cerrar
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-cacao-800/55">
            Se abre el cuadro de impresión: elige <strong>Guardar como PDF</strong> y queda en
            Descargas. En celular sale también la opción de compartirlo.
          </p>
        </div>

        <article className="comprobante bg-white px-6 py-7 text-cacao-900 sm:rounded-b-3xl sm:px-10 sm:py-9">
          <header className="flex items-center gap-4 border-b-2 border-cacao-900 pb-5">
            <img
              src={BRAND.logo}
              alt=""
              width="64"
              height="64"
              className="h-16 w-16 shrink-0 rounded-full border-2 border-cacao-800 object-cover"
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold leading-tight">Gelato Alla Crema</h1>
              <p className="text-sm text-cacao-800/60">{etiqueta}</p>
            </div>
            <div className="text-right text-sm">
              {periodo ? (
                <p className="font-semibold">{periodo}</p>
              ) : (
                <>
                  <p className="font-semibold first-letter:uppercase">{fechaLarga(cierre.cerradoAt)}</p>
                  <p className="text-cacao-800/60">
                    {cierre.abiertoAt ? `${hora(cierre.abiertoAt)} — ` : ''}
                    {hora(cierre.cerradoAt)}
                  </p>
                </>
              )}
            </div>
          </header>

          {/* Cifras del día */}
          <section className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-cacao-800/50">
              Vendido en el día
            </p>
            <p className="mt-1 font-display text-4xl font-bold leading-none">
              {formatCOP(cierre.total)}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Cifra etiqueta="Cobrado" valor={formatCOP(cierre.cobrado)} />
              <Cifra etiqueta="Sin cobrar" valor={formatCOP(cierre.porCobrar)} />
              <Cifra etiqueta="Pedidos" valor={cierre.pedidos} />
              <Cifra etiqueta="Productos" valor={cierre.unidades} />
              <Cifra etiqueta="Porciones de helado" valor={cierre.porcionesTotales} />
            </div>

            {cierre.porCobrar > 0 && (
              <p className="mt-4 rounded-xl border-2 border-cacao-600 bg-cacao-100 px-3 py-2 text-sm font-medium">
                Quedaron {formatCOP(cierre.porCobrar)} sin cobrar en {cierre.sinPagar}{' '}
                {cierre.sinPagar === 1 ? 'pedido' : 'pedidos'}.
              </p>
            )}
            {cierre.anulados > 0 && (
              <p className="mt-3 rounded-xl border-2 border-crema-200 px-3 py-2 text-sm">
                Se anularon {cierre.anulados} {cierre.anulados === 1 ? 'pedido' : 'pedidos'} por{' '}
                {formatCOP(cierre.totalAnulado)}. No cuentan en el total.
              </p>
            )}
          </section>

          <Tabla
            titulo="Productos vendidos"
            columnas={['Producto', 'Cantidad', 'Total']}
            filas={(cierre.productos ?? []).map((p) => [p.name, p.cantidad, formatCOP(p.total)])}
          />

          <Tabla
            titulo="Porciones por sabor"
            columnas={['Sabor', 'Porciones']}
            filas={(cierre.sabores ?? []).map((s) => [s.name, s.porciones])}
          />

          {cierre.personas?.length > 0 && (
            <Tabla
              titulo="Quién atendió"
              columnas={['Persona', 'Mesas', 'Pedidos', 'Vendido', 'Conectada']}
              filas={cierre.personas.map((p) => [
                p.persona,
                p.mesas,
                p.pedidos,
                formatCOP(p.total),
                duracion(p.minutos),
              ])}
            />
          )}

          <footer className="mt-8 border-t border-crema-200 pt-4 text-xs text-cacao-800/50">
            Generado por la app de pedidos de Gelato Alla Crema el{' '}
            {fechaLarga(cierre.cerradoAt)} a las {hora(cierre.cerradoAt)}
          </footer>
        </article>
      </div>
    </div>
  )
}

function Cifra({ etiqueta, valor }) {
  return (
    <div>
      <p className="font-display text-xl font-bold leading-tight">{valor}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-cacao-800/50">{etiqueta}</p>
    </div>
  )
}

function Tabla({ titulo, columnas, filas }) {
  if (filas.length === 0) return null
  return (
    <section className="mt-7">
      <h2 className="mb-2 font-display text-lg font-bold">{titulo}</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-cacao-900/20 text-xs uppercase tracking-wide text-cacao-800/50">
            {columnas.map((c, i) => (
              <th key={c} className={`pb-1.5 font-semibold ${i > 0 ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-crema-200 last:border-0">
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className={`py-1.5 tabular-nums ${j > 0 ? 'text-right' : 'font-medium'}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
