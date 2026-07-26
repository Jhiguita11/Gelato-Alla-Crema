import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'gac.turnos.v1'

const TurnosContext = createContext(null)

function leer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { activo: null, turnos: [] }
  } catch {
    return { activo: null, turnos: [] }
  }
}

/**
 * Quién está atendiendo y desde cuándo. Cada entrada abre un turno y cada
 * salida lo cierra, así queda registrado cuánto estuvo conectado cada quien.
 */
export function TurnosProvider({ children }) {
  const [estado, setEstado] = useState(leer)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
  }, [estado])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setEstado(leer())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const entrar = useCallback((persona) => {
    const turno = { id: crypto.randomUUID(), persona, inicio: Date.now(), fin: null }
    setEstado((prev) => ({ activo: turno, turnos: [...prev.turnos, turno] }))
  }, [])

  const salir = useCallback(() => {
    setEstado((prev) => {
      if (!prev.activo) return prev
      const fin = Date.now()
      return {
        activo: null,
        turnos: prev.turnos.map((t) => (t.id === prev.activo.id ? { ...t, fin } : t)),
      }
    })
  }, [])

  /** Al cerrar la caja se archiva el día: los turnos arrancan de cero. */
  const reiniciarTurnos = useCallback(() => {
    setEstado((prev) => {
      if (!prev.activo) return { activo: null, turnos: [] }
      // Quien esté conectado sigue conectado, pero con el turno recién abierto.
      const turno = { ...prev.activo, inicio: Date.now(), fin: null }
      return { activo: turno, turnos: [turno] }
    })
  }, [])

  const value = useMemo(
    () => ({
      persona: estado.activo?.persona ?? null,
      desde: estado.activo?.inicio ?? null,
      turnos: estado.turnos,
      entrar,
      salir,
      reiniciarTurnos,
    }),
    [estado, entrar, salir, reiniciarTurnos],
  )

  return <TurnosContext.Provider value={value}>{children}</TurnosContext.Provider>
}

export function useTurnos() {
  const context = useContext(TurnosContext)
  if (!context) throw new Error('useTurnos debe usarse dentro de <TurnosProvider>')
  return context
}
