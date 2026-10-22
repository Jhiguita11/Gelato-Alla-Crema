import { createContext, useCallback, useContext, useMemo } from 'react'
import { FLAVORS, PRODUCTS } from '../data/menu'
import { leer, useAlmacen } from './almacen'

const STORAGE_KEY = 'gac.disponibilidad.v1'
// Los sabores nuevos se guardan aparte del día: llegaron para quedarse.
const EXTRA_KEY = 'gac.sabores-extra.v1'

const DisponibilidadContext = createContext(null)

/** "Té verde matcha" → "te-verde-matcha" */
function aSlug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Fecha local en formato YYYY-MM-DD (no UTC, que correría el día). */
function hoy() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

/**
 * Catálogo completo de sabores sin pasar por React. Lo usa `describir.js`
 * para poder ponerle nombre a un sabor agregado desde la app cuando muestra
 * un pedido viejo.
 */
export function catalogoSabores() {
  return [...FLAVORS, ...(leer(EXTRA_KEY, []) ?? [])]
}

export function DisponibilidadProvider({ children }) {
  // Si la caja y la cocina están en pestañas distintas del mismo equipo, se
  // enteran solas cuando alguien agota un sabor (ver store/almacen.js).
  const [estado, setEstado] = useAlmacen(STORAGE_KEY, null)
  const [extra, setExtra] = useAlmacen(EXTRA_KEY, [])

  /** Los 16 de la casa más los que se hayan agregado desde la app. */
  const catalogo = useMemo(() => [...FLAVORS, ...(extra ?? [])], [extra])

  // Se vuelve a preguntar cuando cambia el día.
  const necesitaApertura = !estado || estado.fecha !== hoy()

  /** Arranca el día con los sabores que haya en la vitrina. */
  const abrirDia = useCallback(
    (saboresIds) => setEstado(() => ({ fecha: hoy(), sabores: saboresIds, productosAgotados: [] })),
    [setEstado],
  )

  const toggleSabor = useCallback((id) => {
    setEstado((prev) => {
      if (!prev) return prev
      const activo = prev.sabores.includes(id)
      return {
        ...prev,
        sabores: activo ? prev.sabores.filter((s) => s !== id) : [...prev.sabores, id],
      }
    })
  }, [setEstado])

  const toggleProducto = useCallback((id) => {
    setEstado((prev) => {
      if (!prev) return prev
      const agotados = prev.productosAgotados ?? []
      return {
        ...prev,
        productosAgotados: agotados.includes(id)
          ? agotados.filter((p) => p !== id)
          : [...agotados, id],
      }
    })
  }, [setEstado])

  /** Fuerza volver a preguntar los sabores sin esperar al otro día. */
  // Borra la apertura guardada: antes solo se borraba en memoria y, al recargar,
  // volvía la del día sin preguntar.
  const reabrirDia = useCallback(() => setEstado(() => null), [setEstado])

  /**
   * Registra un sabor que llegó nuevo. Queda en el catálogo para siempre y
   * disponible desde ya, sin esperar a la apertura del otro día.
   * Devuelve un mensaje de error, o null si quedó bien.
   */
  const agregarSabor = useCallback(
    ({ name, color }) => {
      const nombre = name.trim()
      if (!nombre) return 'Escribe el nombre del sabor.'

      const id = aSlug(nombre)
      if (!id) return 'Ese nombre no sirve, prueba con otro.'

      let error = null
      setExtra((prev) => {
        const lista = prev ?? []
        if ([...FLAVORS, ...lista].some((f) => f.id === id)) {
          error = `"${nombre}" ya está en la lista.`
          return prev
        }
        return [...lista, { id, name: nombre, color }]
      })
      if (error) return error
      setEstado((prev) => (prev ? { ...prev, sabores: [...prev.sabores, id] } : prev))
      return null
    },
    [setExtra, setEstado],
  )

  /** Solo se pueden borrar los agregados desde la app; los de la casa se apagan. */
  const eliminarSabor = useCallback(
    (id) => {
      setExtra((prev) => (prev ?? []).filter((f) => f.id !== id))
      setEstado((prev) =>
        prev ? { ...prev, sabores: prev.sabores.filter((s) => s !== id) } : prev,
      )
    },
    [setExtra, setEstado],
  )

  const esPersonalizado = useCallback((id) => (extra ?? []).some((f) => f.id === id), [extra])

  const saboresActivos = useMemo(() => {
    if (!estado) return []
    return catalogo.filter((f) => estado.sabores.includes(f.id))
  }, [estado, catalogo])

  const productoAgotado = useCallback(
    (id) => (estado?.productosAgotados ?? []).includes(id),
    [estado],
  )

  const productosDisponibles = useMemo(
    () => PRODUCTS.filter((p) => !productoAgotado(p.id)),
    [productoAgotado],
  )

  const value = useMemo(
    () => ({
      necesitaApertura,
      fecha: estado?.fecha ?? null,
      catalogo,
      saboresActivos,
      productosDisponibles,
      productoAgotado,
      esPersonalizado,
      abrirDia,
      toggleSabor,
      toggleProducto,
      agregarSabor,
      eliminarSabor,
      reabrirDia,
    }),
    [
      necesitaApertura,
      estado,
      catalogo,
      saboresActivos,
      productosDisponibles,
      productoAgotado,
      esPersonalizado,
      abrirDia,
      toggleSabor,
      toggleProducto,
      agregarSabor,
      eliminarSabor,
      reabrirDia,
    ],
  )

  return (
    <DisponibilidadContext.Provider value={value}>{children}</DisponibilidadContext.Provider>
  )
}

export function useDisponibilidad() {
  const context = useContext(DisponibilidadContext)
  if (!context) {
    throw new Error('useDisponibilidad debe usarse dentro de <DisponibilidadProvider>')
  }
  return context
}
