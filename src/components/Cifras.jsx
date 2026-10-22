/** Piezas para mostrar cifras: las usan la Caja y los Reportes. */

export function Dato({ valor, etiqueta, acento }) {
  const color =
    acento === 'menta' ? 'text-menta-700' : acento === 'cacao' ? 'text-cono-600' : 'text-cacao-900'
  return (
    <div className="rounded-2xl bg-crema-50 px-4 py-3">
      <p className={`font-display text-xl font-bold leading-tight ${color}`}>{valor}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-cacao-800/50">
        {etiqueta}
      </p>
    </div>
  )
}

/**
 * Lista ordenada con barra de magnitud. Un solo tono, porque lo que se compara
 * es cuánto — no quién: la identidad ya la lleva el nombre de cada fila.
 */
export function Ranking({ titulo, nota, filas }) {
  const max = Math.max(...filas.map((f) => f.valor), 1)

  return (
    <section className="rounded-3xl border-2 border-crema-200 bg-white p-5">
      <h3 className="font-display text-lg font-bold text-cacao-900">{titulo}</h3>
      <p className="mt-0.5 text-xs text-cacao-800/50">{nota}</p>

      <ul className="mt-4 space-y-3">
        {filas.map((fila) => (
          <li key={fila.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-cacao-900">
                {fila.color && (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: fila.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{fila.etiqueta}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-cacao-800/70">
                {fila.texto}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-crema-100">
              <div
                className="h-full rounded-r-[4px] bg-menta-500"
                style={{ width: `${Math.max((fila.valor / max) * 100, 3)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
