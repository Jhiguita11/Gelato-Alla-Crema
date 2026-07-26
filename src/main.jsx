import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DisponibilidadProvider } from './store/disponibilidad'
import { OrdersProvider } from './store/orders'
import { TurnosProvider } from './store/turnos'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TurnosProvider>
      <DisponibilidadProvider>
        <OrdersProvider>
          <App />
        </OrdersProvider>
      </DisponibilidadProvider>
    </TurnosProvider>
  </StrictMode>,
)
