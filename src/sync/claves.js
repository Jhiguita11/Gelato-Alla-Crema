/**
 * Claves de localStorage del modo local. Son las mismas que la app venía
 * usando desde el principio: no cambiarlas, o los celulares pierden lo guardado.
 */
export const CLAVES = {
  pedidos: 'gac.orders.v1',
  contador: 'gac.counter.v1',
  cierres: 'gac.cierres.v1',
  turnos: 'gac.turnos.v1', // { activo, turnos }: el activo es de este equipo
  vitrina: 'gac.disponibilidad.v1', // { fecha, sabores, productosAgotados } | null
  saboresExtra: 'gac.sabores-extra.v1',
}
