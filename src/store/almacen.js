/**
 * Lectura y escritura en localStorage, a prueba de datos dañados y de
 * almacenamiento lleno. La usan el motor local (sync/motorLocal.js) y la cola
 * del modo compartido (sync/motorRemoto.js).
 *
 * Regla de la casa: cada cambio parte de lo último GUARDADO (se lee, se
 * modifica y se escribe en el mismo paso), nunca de la copia que una pestaña
 * tiene en memoria. Si no, con dos pestañas abiertas una le pisa los datos a
 * la otra.
 */

export function leer(clave, porDefecto = null) {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? JSON.parse(raw) : porDefecto
  } catch {
    return porDefecto
  }
}

export function escribir(clave, valor) {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(clave)
    else localStorage.setItem(clave, JSON.stringify(valor))
    return true
  } catch (error) {
    // Casi siempre es el almacenamiento lleno o bloqueado (modo privado).
    console.error(`[almacen] no se pudo guardar "${clave}"`, error)
    alert(
      'No se pudo guardar en este dispositivo (almacenamiento lleno o bloqueado).\n\n' +
        'Exporta el historial desde Caja y libera espacio antes de seguir.',
    )
    return false
  }
}
