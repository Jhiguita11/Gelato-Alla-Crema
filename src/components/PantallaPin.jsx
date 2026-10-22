import { useState } from 'react'
import { BRAND } from '../data/menu'

/**
 * Se pide una sola vez por celular: después la sesión queda guardada.
 * Sin el PIN nadie puede ver ni crear pedidos, aunque tenga el link.
 */
export default function PantallaPin({ onEntrar }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(event) {
    event.preventDefault()
    if (!pin || enviando) return
    setEnviando(true)
    setError(null)
    const problema = await onEntrar(pin)
    setEnviando(false)
    if (problema) {
      setError(problema)
      setPin('')
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-crema-50 px-6">
      <form onSubmit={enviar} className="w-full max-w-xs text-center">
        <img
          src={BRAND.logo}
          alt=""
          width="96"
          height="96"
          className="mx-auto h-24 w-24 rounded-full border-2 border-cacao-800 object-cover"
        />
        <h1 className="mt-5 font-display text-2xl font-bold text-cacao-900">{BRAND.name}</h1>
        <p className="mt-1 text-sm text-cacao-800/60">Pon el PIN del local para entrar.</p>

        <label htmlFor="pin" className="sr-only">
          PIN del local
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-6 w-full rounded-2xl border-2 border-crema-200 bg-white px-4 py-3.5 text-center font-display text-2xl tracking-[0.4em] text-cacao-900 outline-none focus:border-menta-500"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-cono-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!pin || enviando}
          className="mt-5 w-full rounded-2xl bg-menta-700 px-6 py-3.5 text-base font-bold text-crema-50 transition enabled:hover:bg-menta-800 disabled:opacity-40"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="mt-4 text-xs text-cacao-800/45">Solo se pide la primera vez en cada celular.</p>
      </form>
    </div>
  )
}
