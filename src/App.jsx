import { useEffect, useState } from 'react'
import AperturaDia from './components/AperturaDia'
import Entrada from './components/Entrada'
import { AvisosListos, BarraActivarAvisos } from './components/AvisosPedidos'
import EstadoSync, { AvisoSync } from './components/EstadoSync'
import Caja from './views/Caja'
import Carta from './views/Carta'
import Disponibilidad from './views/Disponibilidad'
import NuevoPedido from './views/NuevoPedido'
import PedidosPendientes from './views/PedidosPendientes'
import { BRAND } from './data/menu'
import { useDisponibilidad } from './store/disponibilidad'
import { useOrders } from './store/orders'
import { useTurnos } from './store/turnos'
import { useMotor } from './sync/MotorProvider'
import { hora } from './utils/describir'

export default function App() {
  const { orders } = useOrders()
  const { necesitaApertura, saboresActivos, catalogo } = useDisponibilidad()
  const { persona, desde, salir } = useTurnos()
  const { rol } = useMotor()
  const esAdmin = rol === 'admin'
  const [vista, setVista] = useState('nuevo')
  const [aviso, setAviso] = useState(null)

  // Sin entregar: en preparación o listos para recoger.
  const pendientes = orders.filter((o) => !o.oculto && o.status !== 'despachado').length
  const agotados = catalogo.length - saboresActivos.length

  // Si se sale del modo admin estando en Carta, no se queda en una pantalla vacía.
  useEffect(() => {
    if (!esAdmin && vista === 'carta') setVista('nuevo')
  }, [esAdmin, vista])

  useEffect(() => {
    if (!aviso) return
    const id = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(id)
  }, [aviso])

  return (
    <div className="min-h-dvh bg-crema-50">
      <header className="sticky top-0 z-20 border-b border-crema-200 bg-crema-50/90 backdrop-blur">
        {/* En celular la barra va en dos filas cortas; desde lg cabe todo en una. */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 lg:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <img
              src={BRAND.logo}
              alt=""
              width="48"
              height="48"
              className="h-9 w-9 shrink-0 rounded-full border-2 border-cacao-800 object-cover lg:h-12 lg:w-12"
            />
            <div className="min-w-0">
              <h1 className="truncate font-display text-base font-bold leading-tight text-cacao-900 lg:text-lg">
                {BRAND.name}
              </h1>
              <p className="hidden text-xs text-cacao-800/55 lg:block">{BRAND.tagline}</p>
            </div>
          </div>

          {/* En celular la nav ocupa su propia fila y se desliza de lado. */}
          <nav className="sin-barra order-last -mx-3 flex w-[calc(100%+1.5rem)] gap-1.5 overflow-x-auto whitespace-nowrap px-3 lg:order-none lg:mx-0 lg:w-auto lg:rounded-full lg:bg-white lg:px-1.5 lg:py-1.5 lg:shadow-sm lg:ring-1 lg:ring-crema-200">
            <BotonVista activo={vista === 'nuevo'} onClick={() => setVista('nuevo')}>
              <Etiqueta corta="Nuevo" larga="Nuevo pedido" />
            </BotonVista>
            <BotonVista activo={vista === 'pendientes'} onClick={() => setVista('pendientes')}>
              <Etiqueta corta="Pedidos" larga="Pedidos pendientes" />
              {pendientes > 0 && (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    vista === 'pendientes' ? 'bg-crema-50/20' : 'bg-cono-500 text-white'
                  }`}
                >
                  {pendientes}
                </span>
              )}
            </BotonVista>
            <BotonVista
              activo={vista === 'disponibilidad'}
              onClick={() => setVista('disponibilidad')}
            >
              <Etiqueta corta="Vitrina" larga="Disponibilidad" />
              {agotados > 0 && (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    vista === 'disponibilidad' ? 'bg-crema-50/20' : 'bg-cacao-600 text-white'
                  }`}
                >
                  {agotados}
                </span>
              )}
            </BotonVista>
            <BotonVista activo={vista === 'caja'} onClick={() => setVista('caja')}>
              Caja
            </BotonVista>
            {/* Cambiar la carta es solo del admin (la base también lo exige). */}
            {esAdmin && (
              <BotonVista activo={vista === 'carta'} onClick={() => setVista('carta')}>
                Editar carta
              </BotonVista>
            )}
          </nav>

          <EstadoSync />

          {/* Turno abierto. En celular solo van las iniciales y "Salir". */}
          {persona && (
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-2 py-1.5 shadow-sm ring-1 ring-crema-200">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-menta-700 font-display text-xs font-bold text-crema-50"
                aria-hidden="true"
              >
                {persona.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold text-cacao-900">{persona}</span>
                <span className="block text-[11px] text-cacao-800/50">desde {hora(desde)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Cerrar el turno de ${persona}?`)) salir()
                }}
                className="rounded-full px-2.5 py-2 text-xs font-semibold text-cacao-800/55 transition hover:bg-crema-100 hover:text-terracota-600"
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      <BarraActivarAvisos />

      <main>
        {vista === 'nuevo' && (
          <NuevoPedido
            onEnviado={(pedido, { agregado } = {}) =>
              setAviso(
                agregado
                  ? `Agregado al pedido${pedido.code ? ` #${pedido.code}` : ''} · Mesa ${pedido.table}`
                  : pedido.code
                    ? `Pedido #${pedido.code} enviado · Mesa ${pedido.table}`
                    : `Pedido enviado · Mesa ${pedido.table}`,
              )
            }
          />
        )}
        {vista === 'pendientes' && <PedidosPendientes />}
        {vista === 'disponibilidad' && <Disponibilidad />}
        {vista === 'caja' && <Caja />}
        {vista === 'carta' && esAdmin && <Carta />}
      </main>

      <AvisoSync />
      <AvisosListos />

      {/* Primero quién entra, y solo después qué sabores hay. */}
      {!persona && <Entrada />}
      {persona && necesitaApertura && <AperturaDia />}

      {aviso && (
        <div
          role="status"
          className="animar-entrada fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-cacao-900 px-5 py-3.5 text-sm font-semibold text-crema-50 shadow-2xl lg:bottom-8 lg:left-auto lg:right-8 lg:translate-x-0"
        >
          <div className="flex items-center gap-3">
            <span>✓ {aviso}</span>
            <button
              type="button"
              onClick={() => setVista('pendientes')}
              className="rounded-lg bg-crema-50/15 px-2.5 py-1 text-xs font-bold transition hover:bg-crema-50/25"
            >
              Ver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Nombre corto en celular, completo desde sm: así caben las cuatro vistas. */
function Etiqueta({ corta, larga }) {
  return (
    <>
      <span className="sm:hidden">{corta}</span>
      <span className="hidden sm:inline">{larga}</span>
    </>
  )
}

function BotonVista({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center rounded-full px-4 py-2.5 text-sm font-semibold transition lg:py-2 ${
        activo
          ? 'bg-menta-700 text-crema-50'
          : 'bg-white text-cacao-900/70 ring-1 ring-crema-200 hover:bg-crema-100 hover:text-cacao-900 lg:bg-transparent lg:ring-0'
      }`}
    >
      {children}
    </button>
  )
}
