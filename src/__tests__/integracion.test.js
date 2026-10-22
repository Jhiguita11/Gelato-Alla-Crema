/**
 * Prueba de integración contra un servidor de verdad (PostgREST + las
 * migraciones de supabase/migrations). No corre en CI: se activa con
 *
 *   GAC_REST_URL=…  GAC_TOKEN_LOCAL=…  GAC_TOKEN_ADMIN=…  GAC_TOKEN_INTRUSO=…  bun run test
 *
 * (scripts/probar-servidor.sh levanta todo y la corre).
 *
 * Prueba cada operación de src/sync/remoto.js, compara lo que dice el servidor
 * con lo que predice el reducer local (sync/estado.js) y, sobre todo, que los
 * permisos los haga cumplir la BASE DE DATOS: el personal no puede leer el
 * historial ni días anteriores aunque lo intente por fuera de la app.
 */
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { aplicarOp } from '../sync/estado'
import { cargarRango, cargarTodo, ejecutarRemoto } from '../sync/remoto'

const URL = process.env.GAC_REST_URL
const describir = URL ? describe : describe.skip

const clienteCon = (token) =>
  createClient(URL, 'clave-publica-de-prueba', { accessToken: async () => token })

/** Lo que importa comparar del día en curso. */
function delDia(e) {
  return {
    contador: e.jornada.contador,
    pedidos: e.pedidos
      .map((p) => ({
        code: p.code,
        table: p.table,
        customer: p.customer,
        takenBy: p.takenBy,
        note: p.note,
        lines: p.lines,
        status: p.status,
        paid: p.paid,
        total: p.total,
        createdAt: p.createdAt,
        conPago: p.paidAt !== null,
        conDespacho: p.dispatchedAt !== null,
        conListo: p.listoAt != null,
        oculto: Boolean(p.oculto),
        anulado: Boolean(p.anuladoAt),
        anuladoPor: p.anuladoPor ?? null,
        abonado: p.abonado ?? null,
        rondaAt: p.rondaAt ?? null,
        rondaPor: p.rondaPor ?? null,
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    turnos: e.turnos.map((t) => ({ persona: t.persona, cerrado: t.fin !== null })),
    vitrina: e.vitrina,
  }
}

describir('servidor compartido (PostgREST + migraciones)', () => {
  let personal // la cuenta del local (PIN)
  let admin
  let previsto // lo que el reducer local cree que hay en el día

  /** Ejecuta en el servidor (como personal) y aplica lo mismo a lo previsto. */
  async function hacer(op, cliente = personal) {
    const parche = await ejecutarRemoto(cliente, op)
    const aplicado = aplicarOp(previsto, op, { asignarCodigo: false })
    previsto = parche ? parche(aplicado) : aplicado
  }

  async function coincide(cliente = personal) {
    const real = await cargarTodo(cliente)
    expect(delDia(real)).toEqual(delDia(previsto))
    return real
  }

  beforeAll(async () => {
    personal = clienteCon(process.env.GAC_TOKEN_LOCAL)
    admin = clienteCon(process.env.GAC_TOKEN_ADMIN)
    previsto = await cargarTodo(personal)
    expect(previsto.pedidos).toEqual([])
  })

  const pedido = (n, extra = {}) => ({
    id: crypto.randomUUID(),
    table: String(n),
    customer: `Cliente ${n}`,
    takenBy: 'Mariana',
    note: n === 1 ? 'Sin maní' : '',
    lines: [{ productId: 'cono-vaso-canasta', varianteId: 'x2', flavorIds: ['lulo', 'mora'] }],
    status: 'pendiente',
    paid: false,
    createdAt: Date.now() - (10 - n) * 60_000,
    dispatchedAt: null,
    paidAt: null,
    total: 7000,
    ...extra,
  })

  let p1, p2, p3, jornadaVieja

  // ── El día a día (personal) ───────────────────────────────────────────────
  it('crea pedidos y el servidor les pone número', async () => {
    p1 = pedido(1)
    p2 = pedido(2, { paid: true, paidAt: Date.now() })
    p3 = pedido(3)
    for (const p of [p1, p2, p3]) await hacer({ tipo: 'crearPedido', pedido: p })
    expect(previsto.pedidos.map((p) => p.code).sort()).toEqual(['001', '002', '003'])
    previsto = { ...previsto, jornada: { ...previsto.jornada, contador: 3 } }
    await coincide()
  })

  it('reintentar el mismo pedido no lo duplica', async () => {
    await hacer({ tipo: 'crearPedido', pedido: p1 })
    await coincide()
  })

  it('limpiar OCULTA y eliminar ANULA: ninguna venta desaparece', async () => {
    await hacer({ tipo: 'marcarPago', id: p1.id, paid: true, at: Date.now() })
    await hacer({ tipo: 'marcarListo', id: p1.id, at: Date.now() })
    await coincide()
    await hacer({ tipo: 'despachar', id: p1.id, at: Date.now() })
    // "Listo" sobre uno ya entregado no lo devuelve atrás (servidor = reducer).
    await hacer({ tipo: 'marcarListo', id: p1.id, at: Date.now() })
    await hacer({ tipo: 'despachar', id: p3.id, at: Date.now() })
    await hacer({ tipo: 'reabrir', id: p3.id })
    await hacer({ tipo: 'limpiarDespachados' })
    await hacer({ tipo: 'borrarPedido', id: p3.id, at: Date.now(), por: 'Gloria' })
    const real = await coincide()
    expect(real.pedidos).toHaveLength(3)
    expect(real.pedidos.find((p) => p.id === p1.id).oculto).toBe(true)
    expect(real.pedidos.find((p) => p.id === p3.id)).toMatchObject({ anuladoPor: 'Gloria' })
  })

  it('las mismas personas agregan a su pedido: servidor = reducer (tachado, reabierto, cobro)', async () => {
    const ronda = (uid, at, extra = {}) => ({
      uid,
      productId: 'jugo',
      quantity: 1,
      precio: 6000,
      nombre: 'Jugo',
      agregadaAt: at,
      ...extra,
    })
    // p1: entregado, pagado y "limpiado" → vuelve a la lista, debe solo lo nuevo.
    const at1 = Date.now()
    const op1 = { tipo: 'agregarAPedido', id: p1.id, lineas: [ronda(crypto.randomUUID(), at1)], monto: 6000, pagado: false, at: at1, por: 'Fredy' }
    await hacer(op1)
    await hacer(op1) // reintento de la cola
    let real = await coincide()
    const r1 = real.pedidos.find((p) => p.id === p1.id)
    expect(r1).toMatchObject({ status: 'pendiente', oculto: false, total: 13000, paid: false, abonado: 7000, rondaPor: 'Fredy' })
    expect(r1.lines[0].entregadaAt).toEqual(expect.any(Number))
    expect(r1.lines[1].entregadaAt).toBeUndefined()

    // p2: pagado y en preparación; lo pasan a listo y piden más, pagando de una.
    await hacer({ tipo: 'marcarListo', id: p2.id, at: Date.now() })
    const at2 = Date.now()
    await hacer({ tipo: 'agregarAPedido', id: p2.id, lineas: [ronda(crypto.randomUUID(), at2, { quantity: 2 })], monto: 12000, pagado: true, at: at2, por: 'Mariana' })
    real = await coincide()
    const r2 = real.pedidos.find((p) => p.id === p2.id)
    expect(r2).toMatchObject({ status: 'pendiente', total: 19000, paid: true, abonado: null })
    expect(r2.lines[0].listaAt).toEqual(expect.any(Number))

    // Cobrar lo que falta del p1 olvida el abonado.
    await hacer({ tipo: 'marcarPago', id: p1.id, paid: true, at: Date.now() })
    real = await coincide()
    expect(real.pedidos.find((p) => p.id === p1.id)).toMatchObject({ paid: true, abonado: null })

    // A un anulado no se le agrega nada.
    await hacer({ tipo: 'agregarAPedido', id: p3.id, lineas: [ronda(crypto.randomUUID(), Date.now())], monto: 6000, pagado: false, at: Date.now(), por: 'Fredy' })
    await coincide()
  })

  it('turnos y vitrina', async () => {
    const t1 = { id: crypto.randomUUID(), persona: 'Mariana', inicio: Date.now() - 3_600_000, fin: null }
    const t2 = { id: crypto.randomUUID(), persona: 'Fredy', inicio: Date.now() - 1_800_000, fin: null }
    await hacer({ tipo: 'entrar', turno: t1 })
    await hacer({ tipo: 'entrar', turno: t2 })
    await hacer({ tipo: 'salir', id: t2.id, fin: Date.now() })
    await hacer({ tipo: 'abrirDia', fecha: '2026-10-22', sabores: ['lulo', 'mora'] })
    await hacer({ tipo: 'marcarSabor', id: 'mora', activo: false })
    await hacer({ tipo: 'marcarProducto', id: 'copa-bayles', agotado: true })
    await hacer({ tipo: 'agregarSaborExtra', sabor: { id: 'matcha', name: 'Matcha', color: '#7a9' } })
    await hacer({ tipo: 'eliminarSaborExtra', id: 'matcha' })
    await coincide()
  })

  // ── Cierre: lo hace el personal, pero no puede leerlo ─────────────────────
  it('no deja cerrar con un resumen desactualizado', async () => {
    await expect(
      ejecutarRemoto(personal, {
        tipo: 'cerrarCaja',
        jornadaId: previsto.jornada.id,
        nuevaJornadaId: crypto.randomUUID(),
        cierre: { id: crypto.randomUUID(), cerradoAt: Date.now(), pedidos: 99, total: 0 },
        at: Date.now(),
      }),
    ).rejects.toMatchObject({ codigo: 'desactualizada', transitorio: false })
  })

  it('el personal cierra la caja (los anulados no cuentan)', async () => {
    jornadaVieja = previsto.jornada.id
    const cierre = { id: crypto.randomUUID(), cerradoAt: Date.now(), pedidos: 2, total: 14000 }
    await hacer({
      tipo: 'cerrarCaja',
      jornadaId: jornadaVieja,
      nuevaJornadaId: crypto.randomUUID(),
      cierre,
      at: Date.now(),
    })
    const real = await coincide()
    expect(real.turnos.map((t) => t.persona)).toEqual(['Mariana'])
    // …pero no puede leer el cierre que acaba de guardar.
    expect(real.cierres).toEqual([])
  })

  it('otro celular que no se enteró no puede cerrar la misma jornada', async () => {
    await expect(
      ejecutarRemoto(personal, {
        tipo: 'cerrarCaja',
        jornadaId: jornadaVieja,
        nuevaJornadaId: crypto.randomUUID(),
        cierre: { id: crypto.randomUUID(), cerradoAt: Date.now(), pedidos: 2, total: 14000 },
        at: Date.now(),
      }),
    ).rejects.toMatchObject({ codigo: 'ya_cerrada' })
  })

  it('el día nuevo arranca en #001', async () => {
    await hacer({ tipo: 'crearPedido', pedido: pedido(9) })
    expect(previsto.pedidos[0].code).toBe('001')
    previsto = { ...previsto, jornada: { ...previsto.jornada, contador: 1 } }
    await coincide()
  })

  // ── Lo que la base le niega al personal ───────────────────────────────────
  it('el personal NO ve días anteriores, ni pidiéndolos directo', async () => {
    const { data } = await personal.from('pedidos').select('id, jornada_id')
    expect(data.every((p) => p.jornada_id !== jornadaVieja)).toBe(true)
    expect(data).toHaveLength(1) // solo el del día nuevo
    const rango = await cargarRango(personal, new Date(Date.now() - 86_400_000), new Date(Date.now() + 60_000))
    expect(rango.pedidos).toHaveLength(1)
  })

  it('el personal NO ve el historial ni puede escribir en él', async () => {
    const { data } = await personal.from('cierres').select('*')
    expect(data).toEqual([])
    await expect(
      ejecutarRemoto(personal, {
        tipo: 'importarCierres',
        cierres: [{ id: crypto.randomUUID(), cerradoAt: Date.now(), pedidos: 1, total: 1 }],
      }),
    ).rejects.toBeTruthy()
  })

  // ── El admin ve todo ──────────────────────────────────────────────────────
  it('el admin ve el historial', async () => {
    const real = await cargarTodo(admin)
    expect(real.cierres).toHaveLength(1)
    expect(real.cierres[0]).toMatchObject({ pedidos: 2, total: 14000 })
  })

  it('el admin ve los pedidos de cualquier día, incluidos los anulados', async () => {
    const rango = await cargarRango(admin, new Date(Date.now() - 86_400_000), new Date(Date.now() + 60_000))
    expect(rango.pedidos).toHaveLength(4) // 3 del día cerrado + 1 del nuevo
    expect(rango.pedidos.filter((p) => p.anuladoAt)).toHaveLength(1)
    expect(rango.turnos.length).toBeGreaterThan(0)
  })

  it('el admin también puede trabajar el día (crear pedidos)', async () => {
    const p = pedido(8)
    await ejecutarRemoto(admin, { tipo: 'crearPedido', pedido: p })
    const real = await cargarTodo(personal)
    expect(real.pedidos.find((x) => x.id === p.id).code).toBe('002')
  })

  it('el admin importa respaldos sin duplicar', async () => {
    const viejos = [
      { id: crypto.randomUUID(), cerradoAt: Date.parse('2026-07-26T21:00:00Z'), pedidos: 14, total: 186_500 },
    ]
    await ejecutarRemoto(admin, { tipo: 'importarCierres', cierres: viejos })
    await ejecutarRemoto(admin, { tipo: 'importarCierres', cierres: viejos })
    expect((await cargarTodo(admin)).cierres).toHaveLength(2)
  })

  // ── Carta editable ────────────────────────────────────────────────────────
  const affogato = {
    id: 'affogato',
    name: 'Affogato',
    icon: '☕',
    category: 'casa',
    price: 9000,
    porciones: 1,
    variantes: null,
    variantesTitulo: null,
    eligeSalsa: false,
    incluye: ['Café espresso'],
  }

  it('el personal ve la carta pero NO la puede cambiar (aviso, no sesión vencida)', async () => {
    expect((await cargarTodo(personal)).carta).toEqual([])
    await expect(
      ejecutarRemoto(personal, { tipo: 'guardarProducto', producto: affogato }),
    ).rejects.toMatchObject({ codigo: 'solo_admin', transitorio: false })
    await expect(
      ejecutarRemoto(personal, { tipo: 'ocultarProducto', id: 'jugo', oculto: true }),
    ).rejects.toMatchObject({ codigo: 'solo_admin' })
    // Ni por fuera de la app, directo a la tabla.
    await personal.from('carta').insert({ id: 'pirata', datos: {} })
    expect((await cargarTodo(admin)).carta).toEqual([])
  })

  it('el admin agrega, edita, quita y restaura; el servidor coincide con el reducer', async () => {
    let previstoCarta = (await cargarTodo(admin))
    const paso = async (op) => {
      await ejecutarRemoto(admin, op)
      await ejecutarRemoto(admin, op) // reintento de la cola: idempotente
      previstoCarta = aplicarOp(previstoCarta, op)
      const real = await cargarTodo(personal) // lo ven todos los celulares
      expect(real.carta.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(
        previstoCarta.carta.toSorted((a, b) => a.id.localeCompare(b.id)),
      )
    }
    await paso({ tipo: 'guardarProducto', producto: affogato })
    await paso({ tipo: 'ocultarProducto', id: 'affogato', oculto: true })
    await paso({ tipo: 'guardarProducto', producto: { ...affogato, price: 9500 } }) // sigue oculto
    await paso({ tipo: 'ocultarProducto', id: 'limonada', oculto: true }) // de fábrica, sin editar
    await paso({ tipo: 'restaurarProducto', id: 'limonada' })
    const final = (await cargarTodo(personal)).carta
    expect(final).toEqual([
      { id: 'affogato', datos: expect.objectContaining({ price: 9500 }), oculto: true },
    ])
  })

  // ── Nadie más ─────────────────────────────────────────────────────────────
  it('otra cuenta no ve nada ni puede escribir', async () => {
    const intruso = clienteCon(process.env.GAC_TOKEN_INTRUSO)
    await expect(cargarTodo(intruso)).rejects.toMatchObject({ sesion: true, codigo: 'sin_acceso' })
    const { data } = await intruso.from('pedidos').select('id')
    expect(data).toEqual([])
    expect((await intruso.from('carta').select('id')).data).toEqual([])
    await expect(
      ejecutarRemoto(intruso, { tipo: 'crearPedido', pedido: pedido(5) }),
    ).rejects.toMatchObject({ sesion: true })
  })

  it('sin token (clave pública sola) no hay acceso', async () => {
    const anonimo = createClient(URL, 'clave-publica-de-prueba')
    await expect(cargarTodo(anonimo)).rejects.toBeTruthy()
  })
})
