/**
 * Qué cambió entre dos fotos de los pedidos, para decidir cuándo sonar o
 * avisar. Funciones puras: la primera foto nunca avisa (al abrir la app no
 * suena por lo que ya estaba).
 */

/** Pedidos en preparación que no estaban en la foto anterior. */
export function pedidosNuevos(anteriores, actuales) {
  if (!anteriores) return []
  const vistos = new Set(anteriores.map((p) => p.id))
  return actuales.filter((p) => p.status === 'pendiente' && !vistos.has(p.id))
}

/**
 * Pedidos que acaban de pasar a "listo" y le tocan a `persona`: los que tomó
 * ella, o los que no tienen mesero asignado. No avisa de los que se marcaron
 * listos en este mismo equipo (`propios`): quien lo marcó ya lo sabe.
 */
export function pedidosListosPara(anteriores, actuales, persona, propios = new Set()) {
  if (!anteriores || !persona) return []
  const antes = new Map(anteriores.map((p) => [p.id, p.status]))
  return actuales.filter(
    (p) =>
      p.status === 'listo' &&
      antes.get(p.id) !== 'listo' &&
      !propios.has(p.id) &&
      (!p.takenBy || p.takenBy === persona),
  )
}

/** Texto del aviso: "#004 · Mesa 2 · Juliana". */
export function tituloPedido(p) {
  const mesa = p.table === 'Para llevar' ? 'Para llevar' : `Mesa ${p.table}`
  return [p.code ? `#${p.code}` : null, mesa, p.customer || null].filter(Boolean).join(' · ')
}

/** Minutos de espera y su nivel, para el color de la tarjeta. */
export function espera(desde, ahora = Date.now()) {
  const minutos = Math.max(0, Math.floor((ahora - desde) / 60000))
  const nivel = minutos >= 15 ? 'tarde' : minutos >= 8 ? 'atento' : 'bien'
  return { minutos, nivel }
}
