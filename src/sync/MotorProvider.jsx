import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import PantallaPin from '../components/PantallaPin'
import { EMAIL_ADMIN, EMAIL_LOCAL, MODO_COMPARTIDO, SUPABASE_KEY, SUPABASE_URL } from './config'
import { useMotorLocal } from './motorLocal'
import { olvidarDatosDeAdmin, useMotorRemoto } from './motorRemoto'
import { cargarRango } from './remoto'

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

/**
 * Rol de quien usa la app:
 *  · 'admin'    → ve todo: cifras del día, historial, reportes, respaldo.
 *  · 'personal' → toma, despacha y cobra pedidos y puede cerrar la caja, pero
 *                 no ve cifras ni historial.
 * En modo compartido sale del token (app_metadata.rol, que solo se cambia
 * desde el servidor) y la base de datos lo hace cumplir. En modo local no hay
 * cuentas ni forma de proteger nada: todo queda visible, como siempre.
 */
export function rolDeSesion(sesion) {
  return sesion?.user?.app_metadata?.rol === 'admin' ? 'admin' : 'personal'
}

function Local({ children }) {
  const motor = useMotorLocal()
  const valor = useMemo(
    () => ({ ...motor, rol: 'admin', admin: { disponible: false } }),
    [motor],
  )
  return <MotorContext.Provider value={valor}>{children}</MotorContext.Provider>
}

function Remoto({ cliente, rol, usuario, admin, children, alPerderSesion, cerrarSesion }) {
  const motor = useMotorRemoto(cliente, { alPerderSesion })

  // Al cambiar de cuenta (personal ↔ admin) se vuelve a traer todo con los
  // permisos de la cuenta nueva, sin remontar la app (se queda en la misma
  // pantalla).
  const { refrescar } = motor.sync
  useEffect(() => {
    refrescar()
  }, [usuario, refrescar])
  const valor = useMemo(
    () => ({ ...motor, rol, admin, sync: { ...motor.sync, cerrarSesion } }),
    [motor, rol, admin, cerrarSesion],
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

  /** Cambia este celular a la cuenta del administrador. */
  const entrarAdmin = useCallback(
    async (clave) => {
      const { error } = await cliente.auth.signInWithPassword({ email: EMAIL_ADMIN, password: clave })
      if (!error) return null
      if (/invalid login credentials/i.test(error.message)) return 'Contraseña incorrecta.'
      if (!navigator.onLine || /fetch|network/i.test(error.message)) return 'Sin internet.'
      return `No se pudo entrar: ${error.message}`
    },
    [cliente],
  )

  const rol = rolDeSesion(sesion)
  const admin = useMemo(
    () => ({
      disponible: true,
      entrar: entrarAdmin,
      // Al salir, el celular vuelve a pedir el PIN del personal: la cuenta del
      // admin no se queda abierta en un teléfono del local, ni su historial en
      // la caché.
      salir: () => {
        olvidarDatosDeAdmin()
        return cerrarSesion()
      },
      cargarRango: (desde, hasta) => cargarRango(cliente, desde, hasta),
    }),
    [entrarAdmin, cerrarSesion, cliente],
  )

  if (!cliente || sesion === undefined) return null
  if (!sesion) return <PantallaPin onEntrar={entrar} onEntrarAdmin={entrarAdmin} />
  return (
    <Remoto
      cliente={cliente}
      rol={rol}
      usuario={sesion.user?.id ?? null}
      admin={admin}
      alPerderSesion={alPerderSesion}
      cerrarSesion={cerrarSesion}
    >
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
