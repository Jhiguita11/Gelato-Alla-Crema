import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces/opsz.css'
import App from './App'
import AvisoActualizacion from './components/AvisoActualizacion'
import { DisponibilidadProvider } from './store/disponibilidad'
import { OrdersProvider } from './store/orders'
import { TurnosProvider } from './store/turnos'
import { MotorProvider } from './sync/MotorProvider'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotorProvider>
      <TurnosProvider>
        <DisponibilidadProvider>
          <OrdersProvider>
            <App />
          </OrdersProvider>
        </DisponibilidadProvider>
      </TurnosProvider>
    </MotorProvider>
    <AvisoActualizacion />
  </StrictMode>,
)
