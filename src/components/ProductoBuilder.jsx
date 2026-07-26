import { useMemo, useState } from 'react'
import { ADICIONES_EXTRA, SAUCES, formatCOP, lineTotal, porcionesDe } from '../data/menu'
import { useDisponibilidad } from '../store/disponibilidad'

/**
 * Panel paso a paso para armar una línea del pedido:
 * porciones → sabores → salsa → licor → adiciones → cantidad.
 * Los pasos que el producto no necesita simplemente no se muestran.
 */
export default function ProductoBuilder({ product, onAdd, onClose }) {
  const { saboresActivos } = useDisponibilidad()
  const variantes = product.variantes ?? []
  const unicaVariante = variantes.length === 1

  const [varianteId, setVarianteId] = useState(unicaVariante ? variantes[0].id : null)
  const [flavorIds, setFlavorIds] = useState([])
  const [sauceId, setSauceId] = useState(null)
  const [opciones, setOpciones] = useState({}) // recipiente, licor, …
  const [extras, setExtras] = useState({}) // maní / chips, sin costo
  const [adicionIds, setAdicionIds] = useState([])
  // Sabor elegido para las adiciones que lo piden (la porción extra de helado).
  const [adicionSabores, setAdicionSabores] = useState({})
  const [quantity, setQuantity] = useState(1)

  const eligeVariante = variantes.length > 1
  const sabores = porcionesDe(product, varianteId)
  const faltanSabores = Math.max(0, sabores - flavorIds.length)

  const linea = useMemo(
    () => ({
      productId: product.id,
      varianteId,
      flavorIds,
      sauceId,
      opciones,
      extras,
      adicionIds,
      adicionSabores,
      quantity,
    }),
    [
      product.id,
      varianteId,
      flavorIds,
      sauceId,
      opciones,
      extras,
      adicionIds,
      adicionSabores,
      quantity,
    ],
  )

  const opcionSinResponder = (product.opciones ?? []).find((o) => !opciones[o.id])

  // Adiciones marcadas que piden sabor y todavía no lo tienen.
  const adicionSinSabor = ADICIONES_EXTRA.find(
    (a) => a.pideSabor && adicionIds.includes(a.id) && !adicionSabores[a.id],
  )

  const listo =
    (!eligeVariante || varianteId !== null) &&
    faltanSabores === 0 &&
    (!product.eligeSalsa || sauceId !== null) &&
    !opcionSinResponder &&
    !adicionSinSabor

  const conteoPorSabor = useMemo(() => {
    const mapa = {}
    for (const id of flavorIds) mapa[id] = (mapa[id] ?? 0) + 1
    return mapa
  }, [flavorIds])

  function agregarSabor(id) {
    if (faltanSabores === 0) return
    setFlavorIds((prev) => [...prev, id])
  }

  function quitarSabor(id) {
    setFlavorIds((prev) => {
      const i = prev.lastIndexOf(id)
      return i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)]
    })
  }

  function cambiarVariante(variante) {
    setVarianteId(variante.id)
    // Si la variante nueva lleva menos helado, recorta los sabores ya elegidos.
    setFlavorIds((prev) => prev.slice(0, variante.porciones))
  }

  // Numera los pasos que sí se muestran, sin huecos.
  let paso = 0
  const siguientePaso = () => String(++paso)

  const textoBoton = !listo
    ? eligeVariante && varianteId === null
      ? 'Elige la versión'
      : faltanSabores > 0
        ? `Faltan ${faltanSabores} ${faltanSabores === 1 ? 'sabor' : 'sabores'}`
        : product.eligeSalsa && sauceId === null
          ? 'Elige la salsa'
          : adicionSinSabor
            ? 'Elige el sabor de la porción extra'
            : `Falta: ${opcionSinResponder?.titulo}`
    : 'Agregar al pedido'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cacao-900/45 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="animar-entrada flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-crema-50 shadow-2xl sm:rounded-3xl">
        <header className="flex items-start gap-4 border-b border-crema-200 bg-white px-5 py-4">
          <span className="text-4xl leading-none" aria-hidden="true">
            {product.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-cacao-900">{product.name}</h2>
            {product.incluye?.length > 0 && (
              <p className="mt-1 text-sm leading-snug text-cacao-800/60">
                <span className="font-medium text-cacao-800/45">Incluye:</span>{' '}
                {product.incluye.join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-cacao-800/50 transition hover:bg-crema-100 hover:text-cacao-900"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </header>

        <div className="scroll-suave flex-1 space-y-7 overflow-y-auto px-5 py-6">
          {/* Variante: X1/X2, sencilla/especial, con/sin helado… */}
          {eligeVariante && (
            <Seccion
              numero={siguientePaso()}
              titulo={product.variantesTitulo ?? '¿Cuál versión?'}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {variantes.map((variante) => {
                  const activo = varianteId === variante.id
                  return (
                    <button
                      key={variante.id}
                      type="button"
                      onClick={() => cambiarVariante(variante)}
                      className={`rounded-2xl border-2 px-3 py-4 text-center transition ${
                        activo
                          ? 'border-menta-700 bg-menta-700 text-crema-50 shadow-md'
                          : 'border-crema-200 bg-white text-cacao-900 hover:border-menta-400'
                      }`}
                    >
                      <span className="block font-display text-lg font-bold leading-tight">
                        {variante.name}
                      </span>
                      {variante.detalle && (
                        <span className="mt-0.5 block text-xs opacity-70">{variante.detalle}</span>
                      )}
                      <span
                        className={`mt-1.5 block text-sm font-semibold ${activo ? '' : 'text-menta-700'}`}
                      >
                        {formatCOP(variante.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Seccion>
          )}

          {/* Opciones propias del producto: recipiente, licor… */}
          {(product.opciones ?? []).map((opcion) => (
            <Seccion key={opcion.id} numero={siguientePaso()} titulo={opcion.titulo}>
              <div className="flex flex-wrap gap-2">
                {opcion.valores.map((valor) => (
                  <Pildora
                    key={valor}
                    activo={opciones[opcion.id] === valor}
                    onClick={() => setOpciones((prev) => ({ ...prev, [opcion.id]: valor }))}
                  >
                    {valor}
                  </Pildora>
                ))}
              </div>
            </Seccion>
          ))}

          {/* Sabores */}
          {sabores > 0 && (
            <Seccion
              numero={siguientePaso()}
              titulo={sabores === 1 ? 'Sabor' : 'Sabores'}
              ayuda={
                faltanSabores > 0
                  ? `Elige ${faltanSabores} ${faltanSabores === 1 ? 'sabor' : 'sabores'} más · puedes repetir`
                  : 'Listo ✓'
              }
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {saboresActivos.map((sabor) => {
                  const cantidad = conteoPorSabor[sabor.id] ?? 0
                  const lleno = faltanSabores === 0
                  return (
                    <div
                      key={sabor.id}
                      className={`relative flex items-center gap-2 rounded-xl border-2 pr-1 transition ${
                        cantidad > 0
                          ? 'border-menta-500 bg-menta-100'
                          : 'border-crema-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => agregarSabor(sabor.id)}
                        disabled={lleno}
                        className="flex flex-1 items-center gap-2 rounded-l-xl px-2.5 py-3.5 text-left text-sm font-medium sm:py-3 text-cacao-900 transition enabled:hover:bg-crema-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <span
                          className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: sabor.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{sabor.name}</span>
                      </button>
                      {cantidad > 0 && (
                        <button
                          type="button"
                          onClick={() => quitarSabor(sabor.id)}
                          aria-label={`Quitar una porción de ${sabor.name}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-menta-500 text-sm font-bold text-white transition hover:bg-menta-700 sm:h-7 sm:w-7"
                        >
                          {cantidad}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Seccion>
          )}

          {/* Salsa: solo si la carta dice "Salsa" genérica */}
          {product.eligeSalsa && (
            <Seccion numero={siguientePaso()} titulo="¿Cuál salsa?" ayuda="Va incluida">
              <div className="flex flex-wrap gap-2">
                {SAUCES.map((salsa) => (
                  <Pildora
                    key={salsa.id}
                    activo={sauceId === salsa.id}
                    onClick={() => setSauceId(salsa.id)}
                  >
                    {salsa.name}
                  </Pildora>
                ))}
              </div>
            </Seccion>
          )}

          {/* Extras incluidos: no cobran, se pueden elegir varios o ninguno */}
          {(product.extras ?? []).map((extra) => (
            <Seccion
              key={extra.id}
              numero={siguientePaso()}
              titulo={extra.titulo}
              ayuda={extra.ayuda}
            >
              <div className="flex flex-wrap gap-2">
                {extra.valores.map((valor) => {
                  const elegidos = extras[extra.id] ?? []
                  return (
                    <Pildora
                      key={valor}
                      activo={elegidos.includes(valor)}
                      onClick={() =>
                        setExtras((prev) => {
                          const actuales = prev[extra.id] ?? []
                          return {
                            ...prev,
                            [extra.id]: actuales.includes(valor)
                              ? actuales.filter((v) => v !== valor)
                              : [...actuales, valor],
                          }
                        })
                      }
                    >
                      {valor}
                    </Pildora>
                  )
                })}
              </div>
            </Seccion>
          ))}

          {/* Adiciones cobradas aparte */}
          {ADICIONES_EXTRA.length > 0 && (
            <Seccion numero={siguientePaso()} titulo="Adiciones" ayuda="Opcional · aparte de lo incluido">
              <div className="flex flex-wrap gap-2">
                {ADICIONES_EXTRA.map((adicion) => (
                  <Pildora
                    key={adicion.id}
                    activo={adicionIds.includes(adicion.id)}
                    onClick={() =>
                      setAdicionIds((prev) => {
                        if (!prev.includes(adicion.id)) return [...prev, adicion.id]
                        // Al quitarla se olvida el sabor que se le había puesto.
                        setAdicionSabores((sabores) => {
                          const { [adicion.id]: _, ...resto } = sabores
                          return resto
                        })
                        return prev.filter((a) => a !== adicion.id)
                      })
                    }
                  >
                    {adicion.name}
                    {adicion.price > 0 && (
                      <span className="ml-1 opacity-70">+{formatCOP(adicion.price)}</span>
                    )}
                  </Pildora>
                ))}
              </div>

              {/* Si la adición lleva helado, hay que decir de qué sabor. */}
              {ADICIONES_EXTRA.filter((a) => a.pideSabor && adicionIds.includes(a.id)).map(
                (adicion) => (
                  <div
                    key={adicion.id}
                    className="animar-entrada mt-3 rounded-2xl border-2 border-menta-400 bg-white p-3"
                  >
                    <p className="mb-2.5 text-sm font-semibold text-cacao-900">
                      ¿De qué sabor la {adicion.name.toLowerCase()}?
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {saboresActivos.map((sabor) => (
                        <button
                          key={sabor.id}
                          type="button"
                          onClick={() =>
                            setAdicionSabores((prev) => ({ ...prev, [adicion.id]: sabor.id }))
                          }
                          className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-3 text-left text-sm font-medium transition sm:py-2.5 ${
                            adicionSabores[adicion.id] === sabor.id
                              ? 'border-menta-500 bg-menta-100 text-cacao-900'
                              : 'border-crema-200 bg-white text-cacao-900 hover:border-menta-400'
                          }`}
                        >
                          <span
                            className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                            style={{ backgroundColor: sabor.color }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{sabor.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </Seccion>
          )}

          <Seccion numero={siguientePaso()} titulo="Cantidad" ayuda="Unidades iguales">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Quitar una unidad"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-crema-200 bg-white text-xl font-bold text-cacao-900 transition hover:border-menta-400"
              >
                −
              </button>
              <span className="w-10 text-center font-display text-2xl font-bold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                aria-label="Agregar una unidad"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-crema-200 bg-white text-xl font-bold text-cacao-900 transition hover:border-menta-400"
              >
                +
              </button>
            </div>
          </Seccion>
        </div>

        <footer className="border-t border-crema-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-cacao-800/50">Precio</p>
              <p className="font-display text-2xl font-bold text-cacao-900">
                {formatCOP(lineTotal(linea))}
              </p>
            </div>
            <button
              type="button"
              disabled={!listo}
              onClick={() => onAdd(linea)}
              className="rounded-2xl bg-menta-700 px-6 py-3.5 text-sm font-semibold text-crema-50 shadow-lg shadow-cacao-900/15 transition enabled:hover:bg-cacao-800 disabled:cursor-not-allowed disabled:bg-crema-300 disabled:text-cacao-900/40 disabled:shadow-none"
            >
              {textoBoton}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Seccion({ numero, titulo, ayuda, children }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cacao-900 text-xs font-bold text-crema-50">
          {numero}
        </span>
        <h3 className="font-display text-lg font-bold text-cacao-900">{titulo}</h3>
        {ayuda && <span className="text-xs text-cacao-800/55">{ayuda}</span>}
      </div>
      {children}
    </section>
  )
}

function Pildora({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 px-4 py-3 text-sm font-medium transition sm:py-2.5 ${
        activo
          ? 'border-menta-700 bg-menta-700 text-crema-50'
          : 'border-crema-200 bg-white text-cacao-900 hover:border-menta-400'
      }`}
    >
      {children}
    </button>
  )
}
