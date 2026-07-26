import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En GitHub Pages el sitio vive en una subcarpeta con el nombre del repo
// (/Gelato-Alla-Crema/), no en la raíz del dominio. Se saca de la variable que
// pone Actions para que no se desincronice si el repo cambia de nombre.
// En desarrollo se queda en "/".
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = repo ? `/${repo}/` : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
