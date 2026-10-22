import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { escribir, leer } from '../store/almacen'
import { aplicarOp, aplicarPendientes, estadoVacio } from './estado'
import { cargarTodo, ejecutarRemoto, vaciarCola } from './remoto'

/**
 * Modo compartido: los pedidos viven en Supabase y todos los celulares ven lo
 * mismo en tiempo real.
 *
 *   lo que se ve  =  último estado del servidor  +  cola de lo que falta subir
 *
 * Cada acción se aplica de una en pantalla y se mete en una cola guardada en
 * el celular. La cola se sube en orden; si no hay internet se queda ahí y se
 * reintenta sola cuando vuelve. Así se puede seguir tomando pedidos aunque se
 * caiga la conexión un rato.
 */
const CACHE = 'gac.compartido.cache.v1' // último estado del servidor (abre sin internet)

// La caché puede venir de una versión anterior de la app, sin las partes
// nuevas del estado (p. ej. `carta`): se completa con los valores vacíos.
const desdeCache = () => ({ ...estadoVacio(), ...(leer(CACHE, null) ?? {}) })
const COLA = 'gac.compartido.cola.v1' // operaciones por subir
const TURNO = 'gac.compartido.turno.v1' // quién está conectado en ESTE celular

const REINTENTO_MAX_MS = 30_000
const REFRESCO_MS = 60_000 // red de seguridad por si se pierde un aviso de tiempo real

/**
 * Al salir de la cuenta del admin en un celular del local: borra de la caché
 * lo que solo el admin puede ver (el historial), para que no quede guardado
 * en ese teléfono.
 */
export function olvidarDatosDeAdmin() {
  const cache = leer(CACHE, null)
  if (cache?.cierres?.length) escribir(CACHE, { ...cache, cierres: [] })
}

export function useMotorRemoto(cliente, { alPerderSesion } = {}) {
  const [servidor, setServidor] = useState(() => desdeCache())
  const [cola, setCola] = useState(() => leer(COLA, []) ?? [])
  const [turnoActivo, setTurnoActivo] = useState(() => leer(TURNO, null))
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)
  const [cargado, setCargado] = useState(() => leer(CACHE, null) !== null)
  const [aviso, setAviso] = useState(null)

  const vaciando = useRef(false)
  const intentos = useRef(0)
  const reintento = useRef(null)
  const cambios = useRef(0) // sube con cada operación confirmada
  const refrescoPendiente = useRef(null)

  const guardarServidor = useCallback((fn) => {
    setServidor((s) => {
      const nuevo = fn(s)
      if (nuevo !== s) escribir(CACHE, nuevo)
      return nuevo
    })
  }, [])

  // ── Traer del servidor ────────────────────────────────────────────────────
  const refrescar = useCallback(async () => {
    const antes = cambios.current
    try {
      const datos = await cargarTodo(cliente)
      // Si mientras tanto se confirmó algo, esta foto ya está vieja: otra vez.
      if (cambios.current !== antes) return refrescar()
      guardarServidor(() => datos)
      setCargado(true)
      setEnLinea(true)
    } catch (e) {
      if (e.sesion) alPerderSesion?.()
      else setEnLinea(false)
    }
  }, [cliente, guardarServidor, alPerderSesion])

  const refrescarPronto = useCallback(() => {
    clearTimeout(refrescoPendiente.current)
    refrescoPendiente.current = setTimeout(refrescar, 150)
  }, [refrescar])

  // ── Subir la cola ─────────────────────────────────────────────────────────
  const vaciar = useCallback(async () => {
    if (vaciando.current) return
    vaciando.current = true
    clearTimeout(reintento.current)
    try {
      const r = await vaciarCola({
        leerCola: () => leer(COLA, []) ?? [],
        quitar: (uid) => {
          const resto = (leer(COLA, []) ?? []).filter((o) => o.uid !== uid)
          escribir(COLA, resto)
          setCola(resto)
        },
        ejecutar: (op) => ejecutarRemoto(cliente, op),
        alHacer: (op, parche) => {
          cambios.current += 1
          // Se pasa la operación al estado del servidor de una, para que no
          // "parpadee" entre que sale de la cola y llega la foto nueva.
          guardarServidor((s) => {
            const aplicado = aplicarOp(s, op, { asignarCodigo: false })
            return parche ? parche(aplicado) : aplicado
          })
        },
        alDescartar: (_op, error) => {
          setAviso(error.message)
          refrescarPronto()
        },
      })
      if (r.ok) {
        intentos.current = 0
        setEnLinea(true)
      } else if (r.error.sesion) {
        alPerderSesion?.()
      } else {
        setEnLinea(false)
        intentos.current += 1
        const espera = Math.min(REINTENTO_MAX_MS, 1000 * 2 ** intentos.current)
        reintento.current = setTimeout(() => vaciar(), espera)
      }
    } finally {
      vaciando.current = false
    }
  }, [cliente, guardarServidor, refrescarPronto, alPerderSesion])

  // ── Tiempo real, reconexión y red de seguridad ────────────────────────────
  useEffect(() => {
    const canal = cliente
      .channel('gelato')
      .on('postgres_changes', { event: '*', schema: 'public' }, refrescarPronto)
      .subscribe((estado) => {
        // También al reconectar: lo que pasó mientras tanto no llegó por aviso.
        if (estado === 'SUBSCRIBED') {
          refrescar()
          vaciar()
        }
      })

    const alVolver = () => {
      setEnLinea(navigator.onLine)
      if (navigator.onLine) {
        vaciar()
        refrescar()
      }
    }
    const alVer = () => document.visibilityState === 'visible' && alVolver()
    window.addEventListener('online', alVolver)
    window.addEventListener('offline', alVolver)
    document.addEventListener('visibilitychange', alVer)
    const periodico = setInterval(() => navigator.onLine && refrescar(), REFRESCO_MS)

    // Otra pestaña de este celular encoló algo o cambió de turno.
    const onStorage = (e) => {
      if (e.key === COLA) setCola(leer(COLA, []) ?? [])
      if (e.key === TURNO) setTurnoActivo(leer(TURNO, null))
      if (e.key === CACHE) setServidor(desdeCache())
    }
    window.addEventListener('storage', onStorage)

    refrescar()
    vaciar()

    return () => {
      cliente.removeChannel(canal)
      window.removeEventListener('online', alVolver)
      window.removeEventListener('offline', alVolver)
      document.removeEventListener('visibilitychange', alVer)
      window.removeEventListener('storage', onStorage)
      clearInterval(periodico)
      clearTimeout(reintento.current)
      clearTimeout(refrescoPendiente.current)
    }
  }, [cliente, refrescar, refrescarPronto, vaciar])

  // ── Ejecutar una acción ───────────────────────────────────────────────────
  const estado = useMemo(() => aplicarPendientes(servidor, cola), [servidor, cola])
  const estadoRef = useRef(estado)
  estadoRef.current = estado

  const ejecutar = useCallback(
    (op) => {
      const conUid = { ...op, uid: crypto.randomUUID() }
      const nuevaCola = [...(leer(COLA, []) ?? []), conUid]
      escribir(COLA, nuevaCola)
      setCola(nuevaCola)

      // El turno de este celular se decide aquí, no en el servidor.
      if (op.tipo === 'entrar') {
        escribir(TURNO, op.turno)
        setTurnoActivo(op.turno)
      } else if (op.tipo === 'salir') {
        escribir(TURNO, null)
        setTurnoActivo(null)
      }

      vaciar()
      return aplicarOp(estadoRef.current, op, { asignarCodigo: false })
    },
    [vaciar],
  )

  return {
    estado,
    turnoActivo,
    ejecutar,
    sync: {
      modo: 'compartido',
      enLinea,
      cargado,
      pendientes: cola.length,
      aviso,
      cerrarAviso: () => setAviso(null),
      refrescar,
    },
  }
}
