import { FLAVORS } from '../data/menu'
import { leer } from '../store/almacen'
import { CLAVES } from '../sync/claves'

// Último catálogo conocido (lo actualiza DisponibilidadProvider en cada render).
let actual = null

export function fijarCatalogo(catalogo) {
  actual = catalogo
}

/**
 * Catálogo completo de sabores sin pasar por React. Lo usan `describir.js` y
 * `resumen.js` para ponerle nombre a un sabor agregado desde la app cuando
 * muestran un pedido o un cierre. Antes de que monte la app, sale de lo
 * guardado en este navegador.
 */
export function catalogoSabores() {
  return actual ?? [...FLAVORS, ...(leer(CLAVES.saboresExtra, []) ?? [])]
}
