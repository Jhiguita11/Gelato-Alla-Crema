/**
 * Todo lo que habla con Supabase: convertir filas ↔ objetos de la app, cargar
 * el estado y ejecutar cada operación en el servidor.
 *
 * Las columnas van en español y con fechas de Postgres; la app usa los nombres
 * de siempre (table, paid, createdAt en milisegundos…). Las conversiones viven
 * aquí y en ningún otro lado.
 */
import { estadoVacio } from './estado'

const ms = (v) => (v ? Date.parse(v) : null)
const iso = (v) => (v ? new Date(v).toISOString() : null)

export function filaAPedido(r) {
  return {
    id: r.id,
    code: r.code,
    table: r.mesa,
    customer: r.cliente ?? '',
    takenBy: r.tomado_por ?? null,
    note: r.nota ?? '',
    lines: r.lineas ?? [],
    status: r.estado,
    paid: r.pagado,
    total: r.total,
    createdAt: ms(r.creado_at),
    dispatchedAt: ms(r.despachado_at),
    paidAt: ms(r.pagado_at),
  }
}

export function filaACierre(r) {
  return { ...r.datos, id: r.id, cerradoAt: ms(r.cerrado_at) }
}

export function filaATurno(r) {
  return { id: r.id, persona: r.persona, inicio: ms(r.inicio), fin: ms(r.fin) }
}

export function filaAVitrina(r) {
  return {
    fecha: r?.fecha ?? null,
    sabores: r?.sabores ?? [],
    productosAgotados: r?.productos_agotados ?? [],
    saboresExtra: r?.sabores_extra ?? [],
  }
}

export function filaAJornada(r) {
  return { id: r?.jornada_id ?? null, contador: r?.contador ?? 0, abiertaAt: ms(r?.abierta_at) }
}

/** Lo que va en el JSON del cierre (todo menos lo que tiene columna propia). */
export function cierreADatos(cierre) {
  const { id: _id, cerradoAt: _c, ...datos } = cierre
  return datos
}

/**
 * Error al hablar con el servidor.
 * `transitorio`: vale la pena reintentar (sin internet, servidor caído).
 * Si no, la operación no va a funcionar nunca y se descarta con un aviso.
 */
export class ErrorSync extends Error {
  constructor(mensaje, { transitorio = false, codigo = null, sesion = false } = {}) {
    super(mensaje)
    this.transitorio = transitorio
    this.codigo = codigo
    this.sesion = sesion
  }
}

const MENSAJES = {
  ya_cerrada: 'Otro celular ya cerró esta caja. Se actualizó con lo que hay ahora.',
  desactualizada:
    'Llegaron pedidos de otro celular mientras se cerraba la caja. Revisa la cuenta y vuelve a cerrar.',
}

/** Convierte lo que devuelve supabase-js en ErrorSync (o nada si salió bien). */
export function clasificar(error, status) {
  if (!error) return null
  const msg = String(error.message ?? error)
  if (MENSAJES[msg]) return new ErrorSync(MENSAJES[msg], { codigo: msg })
  // Sin red, o el servidor no respondió.
  if (!status || status >= 500 || status === 408 || status === 429 || /fetch|network|Failed to/i.test(msg)) {
    return new ErrorSync('Sin conexión con el servidor.', { transitorio: true, codigo: 'red' })
  }
  // Sesión vencida o PIN cambiado: hay que volver a entrar.
  if (status === 401 || status === 403 || error.code === '42501' || error.code === 'PGRST301') {
    return new ErrorSync('Hay que volver a poner el PIN en este celular.', {
      transitorio: true,
      codigo: 'sesion',
      sesion: true,
    })
  }
  return new ErrorSync(`El servidor rechazó un cambio: ${msg}`, { codigo: error.code ?? null })
}

async function hecho(promesa) {
  const { data, error, status } = await promesa
  const e = clasificar(error, status)
  if (e) throw e
  return data
}

/** Trae todo lo que la app necesita ver. */
export async function cargarTodo(cliente) {
  const jornadaFila = await hecho(cliente.from('jornada').select('*').eq('id', 1).maybeSingle())
  // La fila siempre existe: si no se ve, las reglas no dejan entrar a esta
  // cuenta (no es la del local). Se vuelve a pedir el PIN.
  if (!jornadaFila) {
    throw new ErrorSync('Esta cuenta no tiene acceso a los pedidos del local.', {
      transitorio: true,
      sesion: true,
      codigo: 'sin_acceso',
    })
  }
  const jornada = filaAJornada(jornadaFila)
  const [pedidos, turnos, cierres, vitrina] = await Promise.all([
    hecho(
      cliente
        .from('pedidos')
        .select('*')
        .eq('jornada_id', jornada.id)
        .order('creado_at', { ascending: false }),
    ),
    hecho(cliente.from('turnos').select('*').eq('jornada_id', jornada.id).order('inicio')),
    hecho(cliente.from('cierres').select('*').order('cerrado_at', { ascending: false })),
    hecho(cliente.from('vitrina').select('*').eq('id', 1).maybeSingle()),
  ])
  return {
    ...estadoVacio(),
    jornada,
    pedidos: pedidos.map(filaAPedido),
    turnos: turnos.map(filaATurno),
    cierres: cierres.map(filaACierre),
    vitrina: filaAVitrina(vitrina),
  }
}

/**
 * Ejecuta una operación en el servidor. Devuelve, si hace falta, una función
 * que ajusta el estado local con lo que respondió el servidor (por ejemplo el
 * número de pedido que asignó).
 */
export async function ejecutarRemoto(cliente, op) {
  const rpc = (fn, args) => hecho(cliente.rpc(fn, args))
  const pedidos = () => cliente.from('pedidos')

  switch (op.tipo) {
    case 'crearPedido': {
      const fila = await rpc('crear_pedido', { p: op.pedido })
      const pedido = filaAPedido(fila)
      return (estado) => ({
        ...estado,
        pedidos: estado.pedidos.map((p) => (p.id === pedido.id ? pedido : p)),
      })
    }
    case 'marcarPago':
      await hecho(
        pedidos()
          .update({ pagado: op.paid, pagado_at: op.paid ? iso(op.at) : null })
          .eq('id', op.id),
      )
      return null
    case 'despachar':
      await hecho(
        pedidos().update({ estado: 'despachado', despachado_at: iso(op.at) }).eq('id', op.id),
      )
      return null
    case 'reabrir':
      await hecho(pedidos().update({ estado: 'pendiente', despachado_at: null }).eq('id', op.id))
      return null
    case 'borrarPedido':
      await hecho(pedidos().delete().eq('id', op.id))
      return null
    case 'limpiarDespachados':
      await rpc('limpiar_despachados')
      return null
    case 'cerrarCaja':
      await rpc('cerrar_caja', {
        p_jornada: op.jornadaId,
        p_nueva: op.nuevaJornadaId,
        p_cierre_id: op.cierre.id,
        p_cerrado_at: iso(op.cierre.cerradoAt),
        p_datos: cierreADatos(op.cierre),
      })
      return null
    case 'importarCierres':
      await hecho(
        cliente.from('cierres').upsert(
          op.cierres.map((c) => ({
            id: c.id,
            cerrado_at: iso(c.cerradoAt),
            datos: cierreADatos(c),
          })),
          { onConflict: 'id', ignoreDuplicates: true },
        ),
      )
      return null
    case 'entrar':
      await rpc('entrar', {
        p_id: op.turno.id,
        p_persona: op.turno.persona,
        p_inicio: iso(op.turno.inicio),
      })
      return null
    case 'salir':
      await hecho(cliente.from('turnos').update({ fin: iso(op.fin) }).eq('id', op.id).is('fin', null))
      return null
    case 'abrirDia':
      await hecho(
        cliente
          .from('vitrina')
          .update({ fecha: op.fecha, sabores: op.sabores, productos_agotados: [] })
          .eq('id', 1),
      )
      return null
    case 'reabrirDia':
      await hecho(
        cliente
          .from('vitrina')
          .update({ fecha: null, sabores: [], productos_agotados: [] })
          .eq('id', 1),
      )
      return null
    case 'marcarSabor':
      await rpc('vitrina_marcar', { p_lista: 'sabores', p_valor: op.id, p_activo: op.activo })
      return null
    case 'marcarProducto':
      await rpc('vitrina_marcar', { p_lista: 'agotados', p_valor: op.id, p_activo: op.agotado })
      return null
    case 'agregarSaborExtra':
      await rpc('agregar_sabor_extra', { p: op.sabor })
      return null
    case 'eliminarSaborExtra':
      await rpc('eliminar_sabor_extra', { p_id: op.id })
      return null
    default:
      throw new ErrorSync(`Operación desconocida: ${op.tipo}`)
  }
}

/**
 * Sube la cola en orden. Se detiene en el primer error transitorio (para no
 * desordenar: un "despachar" no puede llegar antes que el "crear"). Los errores
 * definitivos descartan esa operación y siguen con la próxima.
 *
 * `leerCola`/`quitar` van contra lo guardado, no contra una copia, para que dos
 * pestañas del mismo celular no suban dos veces lo mismo… y si pasa, no
 * importa: todas las operaciones son idempotentes.
 */
export async function vaciarCola({ leerCola, quitar, ejecutar, alHacer, alDescartar }) {
  for (;;) {
    const op = leerCola()[0]
    if (!op) return { ok: true }
    try {
      const parche = await ejecutar(op)
      quitar(op.uid)
      alHacer?.(op, parche)
    } catch (e) {
      const error = e instanceof ErrorSync ? e : new ErrorSync(String(e?.message ?? e))
      if (error.transitorio) return { ok: false, error }
      quitar(op.uid)
      alDescartar?.(op, error)
    }
  }
}
