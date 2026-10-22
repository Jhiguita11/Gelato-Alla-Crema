// localStorage en memoria para correr la lógica (que lee el catálogo de
// sabores guardado) fuera del navegador.
class MemoriaStorage {
  #datos = new Map()
  get length() {
    return this.#datos.size
  }
  key(i) {
    return [...this.#datos.keys()][i] ?? null
  }
  getItem(k) {
    return this.#datos.has(k) ? this.#datos.get(k) : null
  }
  setItem(k, v) {
    this.#datos.set(k, String(v))
  }
  removeItem(k) {
    this.#datos.delete(k)
  }
  clear() {
    this.#datos.clear()
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoriaStorage(),
  configurable: true,
})
