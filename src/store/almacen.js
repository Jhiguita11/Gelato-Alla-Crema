import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Persistencia compartida entre pestañas del mismo navegador.
 *
 * Antes cada store guardaba en localStorage su copia en memoria cada vez que
 * cambiaba. Con dos pestañas abiertas eso pisa datos: la pestaña B no sabe lo
 * que acaba de escribir la A y, en su próximo guardado, la sobrescribe (así se
 * podía perder un pedido o un cierre de caja entero).
 *
 * Aquí cada cambio parte de lo último que hay guardado, no de la copia en
 * memoria: se lee, se aplica el cambio y se escribe en el mismo paso. Las demás
 * pestañas se enteran por el evento `storage`.
 *
 * Esto NO sincroniza entre celulares distintos: localStorage vive en cada
 * navegador. Para eso hace falta un backend.
 */

export function leer(clave, porDefecto = null) {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? JSON.parse(raw) : porDefecto
  } catch {
    return porDefecto
  }
}

export function escribir(clave, valor) {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(clave)
    else localStorage.setItem(clave, JSON.stringify(valor))
    return true
  } catch (error) {
    // Casi siempre es el almacenamiento lleno o bloqueado (modo privado).
    console.error(`[almacen] no se pudo guardar "${clave}"`, error)
    alert(
      'No se pudo guardar en este dispositivo (almacenamiento lleno o bloqueado).\n\n' +
        'Exporta el historial desde Caja y libera espacio antes de seguir.',
    )
    return false
  }
}

/**
 * Estado de React respaldado por una clave de localStorage.
 * Devuelve `[valor, actualizar]`, donde `actualizar(fn)` recibe lo último
 * guardado (no la copia en memoria) y devuelve el valor nuevo.
 * Si `fn` devuelve exactamente lo que recibió, no se escribe nada.
 */
export function useAlmacen(clave, porDefecto = null) {
  // El valor por defecto puede ser un literal ([] o {}) que cambia de
  // identidad en cada render; se fija la primera vez.
  const defecto = useRef(porDefecto).current
  const [valor, setValor] = useState(() => leer(clave, defecto))

  useEffect(() => {
    const onStorage = (event) => {
      // key === null significa que se borró todo el almacenamiento.
      if (event.key === clave || event.key === null) setValor(leer(clave, defecto))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [clave, defecto])

  const actualizar = useCallback(
    (fn) => {
      const actual = leer(clave, defecto)
      const nuevo = fn(actual)
      if (nuevo === actual) return actual
      escribir(clave, nuevo)
      setValor(nuevo)
      return nuevo
    },
    [clave, defecto],
  )

  return [valor, actualizar]
}
