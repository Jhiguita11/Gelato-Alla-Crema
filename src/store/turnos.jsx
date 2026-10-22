import { createContext, useCallback, useContext, useMemo } from 'react'
import { useMotor } from '../sync/MotorProvider'

const TurnosContext = createContext(null)

/**
 * Quién está atendiendo y desde cuándo. Cada entrada abre un turno y cada
 * salida lo cierra, así queda registrado cuánto estuvo conectado cada quien.
 *
 * La lista de turnos es de todo el local; quién está conectado es de cada
 * celular (cada mesero entra con su nombre en su teléfono).
 */
export function TurnosProvider({ children }) {
  const { estado, turnoActivo, ejecutar } = useMotor()

  const entrar = useCallback(
    (persona) =>
      ejecutar({
        tipo: 'entrar',
        turno: { id: crypto.randomUUID(), persona, inicio: Date.now(), fin: null },
      }),
    [ejecutar],
  )

  const salir = useCallback(() => {
    if (turnoActivo) ejecutar({ tipo: 'salir', id: turnoActivo.id, fin: Date.now() })
  }, [turnoActivo, ejecutar])

  // Si se cerró la caja, el turno sigue pero con la hora del día nuevo.
  const enLista = estado.turnos.find((t) => t.id === turnoActivo?.id)

  const value = useMemo(
    () => ({
      persona: turnoActivo?.persona ?? null,
      desde: enLista?.inicio ?? turnoActivo?.inicio ?? null,
      turnos: estado.turnos,
      entrar,
      salir,
    }),
    [turnoActivo, enLista, estado.turnos, entrar, salir],
  )

  return <TurnosContext.Provider value={value}>{children}</TurnosContext.Provider>
}

export function useTurnos() {
  const context = useContext(TurnosContext)
  if (!context) throw new Error('useTurnos debe usarse dentro de <TurnosProvider>')
  return context
}
