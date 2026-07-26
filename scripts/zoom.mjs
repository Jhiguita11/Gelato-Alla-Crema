/** Amplía regiones de las fotos de la carta para leer los precios pegados. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
mkdirSync('capturas/zoom', { recursive: true })

const A = 'WhatsApp Image 2026-07-26 at 3.27.13 PM.jpeg' // portada
const B = 'WhatsApp Image 2026-07-26 at 3.27.12 PM.jpeg' // reverso

// [archivo, nombre, x%, y%, ancho%, alto%]
const REGIONES = [
  [A, 'especiales-precios', 0.13, 0.23, 0.78, 0.07],
  [A, 'concha-copabayles', 0.13, 0.37, 0.78, 0.1],
  [A, 'infantiles-precios', 0.1, 0.61, 0.85, 0.07],
  [A, 'cucurucho-cono', 0.1, 0.82, 0.85, 0.15],
  [B, 'delacasa-fila1', 0.05, 0.14, 0.92, 0.07],
  [B, 'delacasa-fila2', 0.05, 0.37, 0.92, 0.07],
  [B, 'cholado-crema', 0.25, 0.52, 0.72, 0.08],
  [B, 'bebidas', 0.08, 0.6, 0.9, 0.35],
  // Zooms cerrados sobre las etiquetas sueltas que no se leen bien.
  [A, 'tight-concha-x1', 0.2, 0.435, 0.14, 0.035, 8],
  [A, 'tight-concha-x2', 0.34, 0.435, 0.16, 0.035, 8],
  [A, 'tight-cucurucho', 0.43, 0.885, 0.14, 0.035, 8],
]

const dataURI = (archivo) =>
  `data:image/jpeg;base64,${readFileSync(resolve('Carta', archivo)).toString('base64')}`

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1000 })

const ESCALA = 3

for (const [archivo, nombre, x, y, w, h, esc] of REGIONES) {
  const ESC = esc ?? ESCALA
  const html = `<body style="margin:0;background:#000"><img id="i" src="${dataURI(archivo)}"></body>`
  const tmp = resolve('capturas/zoom/_tmp.html')
  writeFileSync(tmp, html)
  await page.goto(pathToFileURL(tmp).href)
  await page.waitForFunction(() => document.getElementById('i')?.naturalWidth > 0)

  const { nw, nh } = await page.evaluate((escala) => {
    const i = document.getElementById('i')
    const d = { nw: i.naturalWidth, nh: i.naturalHeight }
    i.style.display = 'block'
    i.style.width = `${d.nw * escala}px`
    return d
  }, ESC)

  const clip = {
    x: Math.round(x * nw * ESC),
    y: Math.round(y * nh * ESC),
    width: Math.round(w * nw * ESC),
    height: Math.round(h * nh * ESC),
  }
  await page.screenshot({ path: `capturas/zoom/${nombre}.png`, clip, captureBeyondViewport: true })
  console.log('✓', nombre, `${clip.width}×${clip.height}`)
}

await browser.close()
