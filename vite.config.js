import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages el sitio vive en una subcarpeta con el nombre del repo
// (/Gelato-Alla-Crema/), no en la raíz del dominio. Se saca de la variable que
// pone Actions para que no se desincronice si el repo cambia de nombre.
// En desarrollo se queda en "/".
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = repo ? `/${repo}/` : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    // App instalable y que abre sin internet. El service worker guarda la app
    // completa en el celular la primera vez que se abre con conexión.
    VitePWA({
      // "prompt" y no "autoUpdate": recargar sola a media toma de pedido
      // borraría el pedido que se está armando. La app avisa y el mesero elige
      // cuándo actualizar (ver components/AvisoActualizacion.jsx).
      registerType: 'prompt',
      // Lo que la app muestra (el logo del encabezado) va al caché, más el
      // ícono chico que el navegador vuelve a pedir al abrir sin internet. Los
      // de 512 solo los pide el sistema al instalar: no hace falta
      // descargarlos en cada celular por adelantado.
      includeAssets: ['logo.jpg', 'icons/apple-touch-icon.png', 'icons/icon-192.png'],
      includeManifestIcons: false,
      manifest: {
        name: 'Gelato Alla Crema · Pedidos',
        short_name: 'Gelato',
        description: 'Toma de pedidos de la heladería Gelato Alla Crema.',
        lang: 'es-CO',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fdf6e4',
        theme_color: '#45b9a0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Solo el alfabeto latino de las fuentes: los demás subconjuntos
        // (cirílico, vietnamita…) no se usan y engordarían la descarga.
        globPatterns: [
          '**/*.{js,css,html}',
          '**/*-latin-{wght,opsz}-normal-*.woff2',
          '**/*-latin-ext-{wght,opsz}-normal-*.woff2',
        ],
        // Cualquier ruta abre la app, también sin conexión.
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/__tests__/setup.js'],
  },
})
