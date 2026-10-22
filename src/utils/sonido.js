/**
 * Sonidos de la app, sintetizados con Web Audio (sin archivos que descargar,
 * funcionan sin internet).
 *
 * Los navegadores no dejan sonar nada hasta que la persona toca la pantalla
 * al menos una vez. `prepararSonido()` engancha el primer toque para
 * "desbloquear" el audio; mientras tanto `sonidoBloqueado()` es true y la
 * pantalla puede mostrar un botón para activarlo.
 */

let contexto = null
const oyentes = new Set()

function ctx() {
  if (!contexto) {
    const Ctx = window.AudioContext ?? window.webkitAudioContext
    if (!Ctx) return null
    contexto = new Ctx()
    contexto.addEventListener?.('statechange', () => oyentes.forEach((fn) => fn()))
  }
  return contexto
}

/** Intenta desbloquear el audio (tiene que llamarse desde un toque). */
export function activarSonido() {
  const c = ctx()
  if (c?.state === 'suspended') c.resume().catch(() => {})
}

/** Desbloquea el audio en el primer toque o tecla en cualquier parte. */
export function prepararSonido() {
  const uno = () => {
    activarSonido()
    window.removeEventListener('pointerdown', uno)
    window.removeEventListener('keydown', uno)
  }
  window.addEventListener('pointerdown', uno)
  window.addEventListener('keydown', uno)
}

export function sonidoBloqueado() {
  const c = ctx()
  return !c || c.state !== 'running'
}

/** Para re-renderizar cuando el audio se desbloquea. Devuelve cómo dejar de oír. */
export function alCambiarSonido(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

/** Una nota con ataque suave y caída, tipo campanita. */
function nota(c, frecuencia, inicio, duracion, volumen = 0.25) {
  const osc = c.createOscillator()
  const gan = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = frecuencia
  gan.gain.setValueAtTime(0.0001, inicio)
  gan.gain.exponentialRampToValueAtTime(volumen, inicio + 0.02)
  gan.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion)
  osc.connect(gan).connect(c.destination)
  osc.start(inicio)
  osc.stop(inicio + duracion + 0.05)
}

function tocar(notas) {
  const c = ctx()
  if (!c) return false
  if (c.state === 'suspended') c.resume().catch(() => {})
  const t = c.currentTime + 0.02
  for (const [f, desde, dur, vol] of notas) nota(c, f, t + desde, dur, vol)
  return true
}

/** Pedido nuevo en la cola de cocina: dos notas que suben (ding-ding). */
export function sonarPedidoNuevo() {
  return tocar([
    [880, 0, 0.35],
    [1175, 0.16, 0.5],
  ])
}

/** Pedido listo para recoger: tres notas, más largo y llamativo. */
export function sonarPedidoListo() {
  return tocar([
    [784, 0, 0.3, 0.3],
    [988, 0.14, 0.3, 0.3],
    [1319, 0.28, 0.7, 0.3],
    [1319, 0.75, 0.6, 0.2],
  ])
}
