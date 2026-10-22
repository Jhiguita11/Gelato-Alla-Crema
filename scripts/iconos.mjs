/**
 * Genera los íconos de la app instalable (PWA) a partir de public/logo.jpg.
 * Uso:  bun scripts/iconos.mjs
 * Solo hay que correrlo si cambia el logo; los PNG quedan en public/icons/.
 */
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const LOGO = 'public/logo.jpg'
const DIR = 'public/icons'
const CREMA = '#fdf6e4' // --color-crema-50, el fondo de la app
// Paleta de 256 colores: el logo es plano, se ve igual y pesa una fracción.
const COMPRESION = { compressionLevel: 9, palette: true, quality: 90 }

mkdirSync(DIR, { recursive: true })

/** Logo recortado en círculo, sin las esquinas blancas del JPG. */
async function circulo(lado) {
  const r = lado / 2
  const mascara = Buffer.from(
    `<svg width="${lado}" height="${lado}"><circle cx="${r}" cy="${r}" r="${r}"/></svg>`,
  )
  return sharp(LOGO)
    .resize(lado, lado)
    .composite([{ input: mascara, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** Logo centrado sobre fondo crema, ocupando `escala` del lado. */
async function sobreFondo(lado, escala, archivo) {
  const logo = await circulo(Math.round(lado * escala))
  await sharp({ create: { width: lado, height: lado, channels: 4, background: CREMA } })
    .composite([{ input: logo, gravity: 'center' }])
    .png(COMPRESION)
    .toFile(`${DIR}/${archivo}`)
  console.log('✓', archivo)
}

// "any": el círculo tal cual, con fondo transparente.
for (const lado of [192, 512]) {
  await sharp(await circulo(lado)).png(COMPRESION).toFile(`${DIR}/icon-${lado}.png`)
  console.log('✓', `icon-${lado}.png`)
}
// "maskable": Android recorta el ícono con su propia forma; la zona segura es
// el círculo central del 80 %, así que el logo va al 78 %.
await sobreFondo(512, 0.78, 'maskable-512.png')
// iOS no respeta la transparencia y pone fondo negro: va sobre crema.
await sobreFondo(180, 0.9, 'apple-touch-icon.png')
