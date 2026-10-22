/**
 * Prueba de integración contra un servidor de verdad (PostgREST + la migración
 * de supabase/migrations). No corre en CI: se activa con
 *
 *   GAC_REST_URL=http://localhost:54321  GAC_TOKEN_LOCAL=…  GAC_TOKEN_INTRUSO=…  bun run test
 *
 * (ver scripts/probar-servidor.sh, que levanta todo y la corre).
 *
 * Además de probar cada operación de src/sync/remoto.js, compara lo que dice
 * el servidor con lo que predice el reducer local (sync/estado.js): así lo que
 * se ve en pantalla mientras algo está "por enviar" coincide con lo que el
 * servidor termina guardando.
 */
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { aplicarOp } from '../sync/estado'
import { cargarTodo, ejecutarRemoto } from '../sync/remoto'

const URL = process.env.GAC_REST_URL
const describir = URL ? describe : describe.skip

const clienteCon = (token) =>
  createClient(URL, 'clave-publica-de-prueba', { accessToken: async () => token })

/** Lo que importa comparar de un estado (sin ids de jornada ni milisegundos de más). */
function resumen(e) {
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
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    turnos: e.turnos.map((t) => ({ persona: t.persona, cerrado: t.fin !== null })),
    cierres: e.cierres.map((c) => ({ id: c.id, total: c.total, pedidos: c.pedidos })),
    vitrina: e.vitrina,
  }
}

describir('servidor compartido (PostgREST + migración)', () => {
  let cliente
  let previsto // lo que el reducer local cree que hay

  /** Ejecuta en el servidor y aplica lo mismo al estado previsto. */
  async function hacer(op) {
    const parche = await ejecutarRemoto(cliente, op)
    const aplicado = aplicarOp(previsto, op, { asignarCodigo: false })
    previsto = parche ? parche(aplicado) : aplicado
  }

  async function coincide() {
    const real = await cargarTodo(cliente)
    expect(resumen(real)).toEqual(resumen(previsto))
    return real
  }

  beforeAll(async () => {
    cliente = clienteCon(process.env.GAC_TOKEN_LOCAL)
    previsto = await cargarTodo(cliente)
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
    createdAt: 1_792_684_800_000 + n * 1000,
    dispatchedAt: null,
    paidAt: null,
    total: 7000,
    ...extra,
  })

  let p1, p2, p3

  it('crea pedidos y el servidor les pone número', async () => {
    p1 = pedido(1)
    p2 = pedido(2, { paid: true, paidAt: 1_792_684_802_500 })
    p3 = pedido(3)
    await hacer({ tipo: 'crearPedido', pedido: p1 })
    await hacer({ tipo: 'crearPedido', pedido: p2 })
    await hacer({ tipo: 'crearPedido', pedido: p3 })
    expect(previsto.pedidos.map((p) => p.code).sort()).toEqual(['001', '002', '003'])
    previsto = { ...previsto, jornada: { ...previsto.jornada, contador: 3 } }
    const real = await coincide()
    expect(real.pedidos.find((p) => p.id === p1.id)).toMatchObject({
      table: '1',
      customer: 'Cliente 1',
      note: 'Sin maní',
      lines: p1.lines,
    })
  })

  it('reintentar el mismo pedido no lo duplica', async () => {
    await hacer({ tipo: 'crearPedido', pedido: p1 })
    await coincide()
  })

  it('cobra, despacha, reabre, borra y limpia', async () => {
    await hacer({ tipo: 'marcarPago', id: p1.id, paid: true, at: Date.now() })
    await hacer({ tipo: 'despachar', id: p1.id, at: Date.now() })
    await hacer({ tipo: 'despachar', id: p3.id, at: Date.now() })
    await hacer({ tipo: 'reabrir', id: p3.id })
    await coincide()
    await hacer({ tipo: 'limpiarDespachados' }) // se lleva p1 (despachado y pagado)
    await hacer({ tipo: 'borrarPedido', id: p3.id })
    const real = await coincide()
    expect(real.pedidos.map((p) => p.id)).toEqual([p2.id])
  })

  it('abre y cierra turnos', async () => {
    const t1 = { id: crypto.randomUUID(), persona: 'Mariana', inicio: Date.now() - 3_600_000, fin: null }
    const t2 = { id: crypto.randomUUID(), persona: 'Fredy', inicio: Date.now() - 1_800_000, fin: null }
    await hacer({ tipo: 'entrar', turno: t1 })
    await hacer({ tipo: 'entrar', turno: t2 })
    await hacer({ tipo: 'salir', id: t2.id, fin: Date.now() })
    await coincide()
  })

  it('maneja la vitrina igual que el reducer', async () => {
    await hacer({ tipo: 'abrirDia', fecha: '2026-10-22', sabores: ['lulo', 'mora'] })
    await hacer({ tipo: 'marcarSabor', id: 'mora', activo: false })
    await hacer({ tipo: 'marcarSabor', id: 'nucita', activo: true })
    await hacer({ tipo: 'marcarSabor', id: 'nucita', activo: true })
    await hacer({ tipo: 'marcarProducto', id: 'copa-bayles', agotado: true })
    await hacer({
      tipo: 'agregarSaborExtra',
      sabor: { id: 'matcha', name: 'Té verde matcha', color: '#7a9a5a' },
    })
    await coincide()
    await hacer({ tipo: 'eliminarSaborExtra', id: 'matcha' })
    await coincide()
  })

  it('no deja cerrar con un resumen desactualizado', async () => {
    const op = {
      tipo: 'cerrarCaja',
      jornadaId: previsto.jornada.id,
      nuevaJornadaId: crypto.randomUUID(),
      cierre: { id: crypto.randomUUID(), cerradoAt: Date.now(), pedidos: 99, total: 0 },
      at: Date.now(),
    }
    await expect(ejecutarRemoto(cliente, op)).rejects.toMatchObject({
      codigo: 'desactualizada',
      transitorio: false,
    })
  })

  it('cierra la caja: historial, numeración en #001 y turnos al día nuevo', async () => {
    const jornadaVieja = previsto.jornada.id
    const cierre = { id: crypto.randomUUID(), cerradoAt: Date.now(), pedidos: 1, total: 7000 }
    const nueva = crypto.randomUUID()
    await hacer({ tipo: 'cerrarCaja', jornadaId: jornadaVieja, nuevaJornadaId: nueva, cierre, at: Date.now() })
    const real = await coincide()
    expect(real.jornada.id).toBe(nueva)
    expect(real.turnos.map((t) => t.persona)).toEqual(['Mariana'])

    // Otro celular que todavía no se enteró intenta cerrar la misma jornada.
    await expect(
      ejecutarRemoto(cliente, {
        tipo: 'cerrarCaja',
        jornadaId: jornadaVieja,
        nuevaJornadaId: crypto.randomUUID(),
        cierre: { id: crypto.randomUUID(), cerradoAt: Date.now(), pedidos: 1, total: 7000 },
        at: Date.now(),
      }),
    ).rejects.toMatchObject({ codigo: 'ya_cerrada', transitorio: false })

    // El día nuevo arranca en #001.
    await hacer({ tipo: 'crearPedido', pedido: pedido(9) })
    expect(previsto.pedidos[0].code).toBe('001')
    previsto = { ...previsto, jornada: { ...previsto.jornada, contador: 1 } }
    await coincide()
  })

  it('importa cierres de un respaldo sin duplicar', async () => {
    const viejos = [
      { id: crypto.randomUUID(), cerradoAt: Date.parse('2026-07-26T21:00:00Z'), pedidos: 14, total: 186_500 },
      { id: crypto.randomUUID(), cerradoAt: Date.parse('2026-07-27T21:00:00Z'), pedidos: 9, total: 98_000 },
    ]
    await hacer({ tipo: 'importarCierres', cierres: viejos })
    await hacer({ tipo: 'importarCierres', cierres: viejos })
    const real = await coincide()
    expect(real.cierres).toHaveLength(3)
  })

  it('otra cuenta no ve nada ni puede escribir', async () => {
    const intruso = clienteCon(process.env.GAC_TOKEN_INTRUSO)
    await expect(cargarTodo(intruso)).rejects.toMatchObject({ sesion: true, codigo: 'sin_acceso' })
    // Ni siquiera leyendo la tabla directo.
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
