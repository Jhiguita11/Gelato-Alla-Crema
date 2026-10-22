import { createContext, useCallback, useContext, useMemo } from 'react'
import { FLAVORS, PRODUCTS } from '../data/menu'
import { useMotor } from '../sync/MotorProvider'
import { fijarCatalogo } from '../utils/catalogo'

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

export function DisponibilidadProvider({ children }) {
  const { estado, ejecutar } = useMotor()
  const { vitrina } = estado

  /** Los 16 de la casa más los que se hayan agregado desde la app. */
  const catalogo = useMemo(() => [...FLAVORS, ...vitrina.saboresExtra], [vitrina.saboresExtra])
  fijarCatalogo(catalogo)

  // Se vuelve a preguntar cuando cambia el día. En modo compartido, el primero
  // que abre el día lo abre para todos los celulares.
  const necesitaApertura = !vitrina.fecha || vitrina.fecha !== hoy()

  /** Arranca el día con los sabores que haya en la vitrina. */
  const abrirDia = useCallback(
    (saboresIds) => ejecutar({ tipo: 'abrirDia', fecha: hoy(), sabores: saboresIds }),
    [ejecutar],
  )

  const toggleSabor = useCallback(
    (id) => ejecutar({ tipo: 'marcarSabor', id, activo: !vitrina.sabores.includes(id) }),
    [ejecutar, vitrina.sabores],
  )

  const toggleProducto = useCallback(
    (id) =>
      ejecutar({ tipo: 'marcarProducto', id, agotado: !vitrina.productosAgotados.includes(id) }),
    [ejecutar, vitrina.productosAgotados],
  )

  /** Fuerza volver a preguntar los sabores sin esperar al otro día. */
  const reabrirDia = useCallback(() => ejecutar({ tipo: 'reabrirDia' }), [ejecutar])

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
      if (catalogo.some((f) => f.id === id)) return `"${nombre}" ya está en la lista.`

      ejecutar({ tipo: 'agregarSaborExtra', sabor: { id, name: nombre, color } })
      return null
    },
    [ejecutar, catalogo],
  )

  /** Solo se pueden borrar los agregados desde la app; los de la casa se apagan. */
  const eliminarSabor = useCallback(
    (id) => ejecutar({ tipo: 'eliminarSaborExtra', id }),
    [ejecutar],
  )

  const esPersonalizado = useCallback(
    (id) => vitrina.saboresExtra.some((f) => f.id === id),
    [vitrina.saboresExtra],
  )

  const saboresActivos = useMemo(() => {
    if (!vitrina.fecha) return []
    return catalogo.filter((f) => vitrina.sabores.includes(f.id))
  }, [vitrina.fecha, vitrina.sabores, catalogo])

  const productoAgotado = useCallback(
    (id) => vitrina.productosAgotados.includes(id),
    [vitrina.productosAgotados],
  )

  const productosDisponibles = useMemo(
    () => PRODUCTS.filter((p) => !productoAgotado(p.id)),
    [productoAgotado],
  )

  const value = useMemo(
    () => ({
      necesitaApertura,
      fecha: vitrina.fecha,
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
      vitrina.fecha,
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
