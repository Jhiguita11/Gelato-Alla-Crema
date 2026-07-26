import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { FLAVORS, PRODUCTS } from '../data/menu'

const STORAGE_KEY = 'gac.disponibilidad.v1'
// Los sabores nuevos se guardan aparte del día: llegaron para quedarse.
const EXTRA_KEY = 'gac.sabores-extra.v1'

const DisponibilidadContext = createContext(null)

/** "Té verde matcha" → "te-verde-matcha" */
function aSlug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

function leer(clave, porDefecto = null) {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? JSON.parse(raw) : porDefecto
  } catch {
    return porDefecto
  }
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
  const [estado, setEstado] = useState(() => leer(STORAGE_KEY))
  const [extra, setExtra] = useState(() => leer(EXTRA_KEY, []))

  useEffect(() => {
    if (estado) localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
  }, [estado])

  useEffect(() => {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extra))
  }, [extra])

  /** Los 16 de la casa más los que se hayan agregado desde la app. */
  const catalogo = useMemo(() => [...FLAVORS, ...extra], [extra])

  // Si la caja y la cocina están en pestañas distintas del mismo equipo, que
  // se enteren cuando alguien agota un sabor.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setEstado(leer(STORAGE_KEY))
      if (event.key === EXTRA_KEY) setExtra(leer(EXTRA_KEY, []))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Se vuelve a preguntar cuando cambia el día.
  const necesitaApertura = !estado || estado.fecha !== hoy()

  /** Arranca el día con los sabores que haya en la vitrina. */
  const abrirDia = useCallback((saboresIds) => {
    setEstado({ fecha: hoy(), sabores: saboresIds, productosAgotados: [] })
  }, [])

  const toggleSabor = useCallback((id) => {
    setEstado((prev) => {
      if (!prev) return prev
      const activo = prev.sabores.includes(id)
      return {
        ...prev,
        sabores: activo ? prev.sabores.filter((s) => s !== id) : [...prev.sabores, id],
      }
    })
  }, [])

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
  }, [])

  /** Fuerza volver a preguntar los sabores sin esperar al otro día. */
  const reabrirDia = useCallback(() => setEstado(null), [])

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
      if ([...FLAVORS, ...extra].some((f) => f.id === id)) return `"${nombre}" ya está en la lista.`

      setExtra((prev) => [...prev, { id, name: nombre, color }])
      setEstado((prev) => (prev ? { ...prev, sabores: [...prev.sabores, id] } : prev))
      return null
    },
    [extra],
  )

  /** Solo se pueden borrar los agregados desde la app; los de la casa se apagan. */
  const eliminarSabor = useCallback((id) => {
    setExtra((prev) => prev.filter((f) => f.id !== id))
    setEstado((prev) => (prev ? { ...prev, sabores: prev.sabores.filter((s) => s !== id) } : prev))
  }, [])

  const esPersonalizado = useCallback((id) => extra.some((f) => f.id === id), [extra])

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
