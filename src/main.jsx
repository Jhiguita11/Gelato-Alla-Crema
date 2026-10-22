import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces/opsz.css'
import App from './App'
import AvisoActualizacion from './components/AvisoActualizacion'
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
          <AvisoActualizacion />
        </OrdersProvider>
      </DisponibilidadProvider>
    </TurnosProvider>
  </StrictMode>,
)
