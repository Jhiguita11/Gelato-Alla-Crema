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
        oculto: Boolean(p.oculto),
        anulado: Boolean(p.anuladoAt),
        anuladoPor: p.anuladoPor ?? null,
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
    await hacer({ tipo: 'despachar', id: p1.id, at: Date.now() })
    await hacer({ tipo: 'despachar', id: p3.id, at: Date.now() })
    await hacer({ tipo: 'reabrir', id: p3.id })
    await hacer({ tipo: 'limpiarDespachados' })
    await hacer({ tipo: 'borrarPedido', id: p3.id, at: Date.now(), por: 'Gloria' })
    const real = await coincide()
    expect(real.pedidos).toHaveLength(3)
    expect(real.pedidos.find((p) => p.id === p1.id).oculto).toBe(true)
    expect(real.pedidos.find((p) => p.id === p3.id)).toMatchObject({ anuladoPor: 'Gloria' })
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

  // ── Nadie más ─────────────────────────────────────────────────────────────
  it('otra cuenta no ve nada ni puede escribir', async () => {
    const intruso = clienteCon(process.env.GAC_TOKEN_INTRUSO)
    await expect(cargarTodo(intruso)).rejects.toMatchObject({ sesion: true, codigo: 'sin_acceso' })
    const { data } = await intruso.from('pedidos').select('id')
    expect(data).toEqual([])
    await expect(
      ejecutarRemoto(intruso, { tipo: 'crearPedido', pedido: pedido(5) }),
    ).rejects.toMatchObject({ sesion: true })
  })

  it('sin token (clave pública sola) no hay acceso', async () => {
    const anonimo = createClient(URL, 'clave-publica-de-prueba')
    await expect(cargarTodo(anonimo)).rejects.toBeTruthy()
  })
})
