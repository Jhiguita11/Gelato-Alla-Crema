import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PantallaPin from '../components/PantallaPin'
import { EMAIL_LOCAL, MODO_COMPARTIDO, SUPABASE_KEY, SUPABASE_URL } from './config'
import { useMotorLocal } from './motorLocal'
import { useMotorRemoto } from './motorRemoto'

const MotorContext = createContext(null)

// Un solo cliente para toda la app. Guarda la sesión en el celular y la
// renueva sola: el PIN se pone una vez por celular. La librería se carga solo
// en modo compartido, así el modo local no la descarga.
let clientePromesa = null
function obtenerCliente() {
  clientePromesa ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'gac.sesion.v1' },
    }),
  )
  return clientePromesa
}

function Local({ children }) {
  const motor = useMotorLocal()
  return <MotorContext.Provider value={motor}>{children}</MotorContext.Provider>
}

function Remoto({ cliente, children, alPerderSesion, cerrarSesion }) {
  const motor = useMotorRemoto(cliente, { alPerderSesion })
  const valor = useMemo(
    () => ({ ...motor, sync: { ...motor.sync, cerrarSesion } }),
    [motor, cerrarSesion],
  )
  return <MotorContext.Provider value={valor}>{children}</MotorContext.Provider>
}

function Compartido({ children }) {
  const [cliente, setCliente] = useState(null)
  // undefined = todavía no se sabe (leyendo la sesión guardada)
  const [sesion, setSesion] = useState(undefined)

  useEffect(() => {
    let vivo = true
    let suscripcion = null
    obtenerCliente().then((c) => {
      if (!vivo) return
      setCliente(c)
      c.auth.getSession().then(({ data }) => vivo && setSesion(data.session ?? null))
      suscripcion = c.auth.onAuthStateChange((_evento, s) => vivo && setSesion(s ?? null)).data
        .subscription
    })
    return () => {
      vivo = false
      suscripcion?.unsubscribe()
    }
  }, [])

  const entrar = useCallback(async (pin) => {
    const { error } = await cliente.auth.signInWithPassword({ email: EMAIL_LOCAL, password: pin })
    if (!error) return null
    if (/invalid login credentials/i.test(error.message)) return 'PIN incorrecto.'
    if (!navigator.onLine || /fetch|network/i.test(error.message)) {
      return 'Sin internet. La primera vez en cada celular hace falta conexión.'
    }
    return `No se pudo entrar: ${error.message}`
  }, [cliente])

  const cerrarSesion = useCallback(() => cliente?.auth.signOut(), [cliente])
  const alPerderSesion = useCallback(() => setSesion(null), [])

  if (!cliente || sesion === undefined) return null
  if (!sesion) return <PantallaPin onEntrar={entrar} />
  return (
    <Remoto cliente={cliente} alPerderSesion={alPerderSesion} cerrarSesion={cerrarSesion}>
      {children}
    </Remoto>
  )
}

/** Elige el modo según si hay Supabase configurado (ver sync/config.js). */
export function MotorProvider({ children }) {
  return MODO_COMPARTIDO ? <Compartido>{children}</Compartido> : <Local>{children}</Local>
}

export function useMotor() {
  const context = useContext(MotorContext)
  if (!context) throw new Error('useMotor debe usarse dentro de <MotorProvider>')
  return context
}
