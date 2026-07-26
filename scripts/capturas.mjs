/**
 * Abre la app en Chrome, la maneja como lo haría un mesero y guarda capturas
 * en capturas/. Uso:  bun run dev   (en otra terminal)  &&  bun scripts/capturas.mjs
 * OJO: borra los pedidos guardados en el navegador para partir de cero.
 */
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const URL = process.env.URL ?? 'http://localhost:5173/'
const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const DIR = 'capturas'

mkdirSync(DIR, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--force-device-scale-factor=2', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 })

let n = 0
const pausa = (ms = 200) => new Promise((r) => setTimeout(r, ms))
const shot = async (nombre) => {
  await pausa(450)
  const archivo = `${DIR}/${String(++n).padStart(2, '0')}-${nombre}.png`
  await page.screenshot({ path: archivo })
  console.log('✓', archivo)
}

/** Hace clic en un botón buscándolo por su texto (opcionalmente dentro de un paso). */
async function clic(texto, { seccion } = {}) {
  const handle = await page.evaluateHandle(
    (texto, seccion) => {
      let raiz = document
      if (seccion) {
        raiz = [...document.querySelectorAll('section')].find(
          (s) => s.querySelector('h3')?.textContent.trim() === seccion,
        )
        if (!raiz) return null
      }
      const botones = [...raiz.querySelectorAll('button')]
      return (
        botones.find((b) => b.textContent.trim() === texto) ??
        botones.find((b) => b.textContent.trim().startsWith(texto)) ??
        botones.find((b) => b.textContent.includes(texto)) ??
        null
      )
    },
    texto,
    seccion,
  )
  const el = handle.asElement()
  if (!el) {
    const estado = await page.evaluate(() => ({
      secciones: [...document.querySelectorAll('section h3')].map((h) => h.textContent.trim()),
      botones: [...document.querySelectorAll('footer button')].map((b) => b.textContent.trim()),
    }))
    throw new Error(
      `No encontré el botón "${texto}"${seccion ? ` en «${seccion}»` : ''}\n` +
        `  secciones visibles: ${JSON.stringify(estado.secciones)}\n` +
        `  botones de pie: ${JSON.stringify(estado.botones)}`,
    )
  }
  try {
    await el.click()
  } catch {
    // En las hojas que suben desde abajo el elemento a veces queda fuera del
    // área visible; ahí basta con dispararle el clic desde el DOM.
    await el.evaluate((e) => {
      e.scrollIntoView({ block: 'center' })
      e.click()
    })
  }
  await pausa(180)
}

await page.goto(URL, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await pausa(700)

// La app arranca preguntando quién entra.
await shot('entrada')
await clic('Mariana')
await pausa(400)

// y después, qué sabores hay hoy.
await shot('apertura-dia')
await clic('Empezar el día')
await pausa(400)

// ── 1 · La carta, por secciones ─────────────────────────────────────────────
await shot('carta')

// ── 2 · Armado de una Copa brownie (2 porciones + salsa a elegir) ───────────
await clic('Copa brownie')
await shot('builder-vacio')
await clic('Nucita', { seccion: 'Sabores' })
await clic('Arequipe café', { seccion: 'Sabores' })
await clic('Arequipe', { seccion: '¿Cuál salsa?' })
await shot('builder-lleno')
await clic('Agregar al pedido')

// Un cucurucho, que sí pregunta porciones
await clic('Cono, vaso o canasta')
await clic('3', { seccion: '¿Cuántas porciones?' })
await clic('Canasta', { seccion: '¿En qué va?' })
await clic('Chicle', { seccion: '¿Cuál salsa?' })
await clic('Maní', { seccion: '¿Maní o chips de colores?' })
await clic('Chips de colores', { seccion: '¿Maní o chips de colores?' })
await clic('Frutos rojos', { seccion: 'Sabores' })
await clic('Vainilla chips', { seccion: 'Sabores' })
await clic('Lulo', { seccion: 'Sabores' })
await clic('Porción extra de helado', { seccion: 'Adiciones' })
await clic('Maracuyá', { seccion: 'Adiciones' }) // sabor de la porción extra
await clic('Agregar al pedido')

await clic('4')
await page.type('input[placeholder="Ej: Juliana"]', 'Juliana')
await clic('Pagado')
await page.type('textarea', 'Sin maní, el niño es alérgico')
await shot('pedido-actual')
await clic('Enviar a pedidos pendientes')
await pausa(3800) // deja que el aviso se desvanezca

// ── 3 · Más pedidos para que la cola se vea real ────────────────────────────
await clic('Banana Split')
await clic('Frutos rojos', { seccion: 'Sabores' })
await clic('Frutos rojos', { seccion: 'Sabores' })
await clic('3 leches', { seccion: 'Sabores' })
await clic('Chocolate', { seccion: '¿Cuál salsa?' })
await clic('Agregar al pedido')
await clic('2') // queda pendiente de pago, que es el valor por defecto
await clic('Enviar a pedidos pendientes')
await pausa(3800) // deja que el aviso se desvanezca

await clic('Copa Bayles')
await clic('Arequipe café', { seccion: 'Sabores' })
await clic('Ron pasas', { seccion: 'Sabores' })
await clic('Ron', { seccion: 'Licor' })
await clic('Agregar al pedido')
await clic('Limonada')
await clic('Agregar al pedido')
await clic('Para llevar')
await clic('Enviar a pedidos pendientes')
await pausa(3800) // deja que el aviso se desvanezca

// ── 4 · Pedidos pendientes ──────────────────────────────────────────────────
await clic('Pedidos pendientes')
await shot('pendientes')

await clic('Marcar como despachado')
await pausa(400)
await clic('Todos')
await shot('pendientes-con-despachado')

// El filtro de cobro cruza el despacho: despacho uno que NO ha pagado y tiene
// que seguir apareciendo en la lista de cobro.
await clic('Sin pagar')
await clic('Marcar como despachado')
await pausa(400)
await shot('sin-pagar')

// ── 5 · Disponibilidad: se acaban cosas a media tarde ───────────────────────
await clic('Disponibilidad')
await clic('Nucita') // agota el sabor
await clic('Lulo')
await clic('Copa Bayles') // agota el producto
await clic('Agregar un sabor nuevo')
await page.type('input', 'Té verde matcha')
await clic('Agregar')
await pausa(300)
await shot('disponibilidad')

// La carta reacciona de una
await clic('Nuevo pedido')
await pausa(300)
await shot('carta-con-agotados')

// ── 6 · Caja del día ────────────────────────────────────────────────────────
await clic('Caja')
await pausa(300)
await shot('caja')

// ── 7 · Vista móvil (es la que más se usa) ──────────────────────────────────
await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2, isMobile: true })
await pausa(500)

await clic('Nuevo pedido')
await pausa(400)
await shot('movil-carta')

await clic('Cono, vaso o canasta')
await pausa(300)
await shot('movil-builder')
await clic('2', { seccion: '¿Cuántas porciones?' })
await clic('Vaso', { seccion: '¿En qué va?' })
await clic('Chocolate', { seccion: '¿Cuál salsa?' })
await clic('Frutos rojos', { seccion: 'Sabores' })
await clic('Maracuyá', { seccion: 'Sabores' })
await clic('Agregar al pedido')
await pausa(300)

// El carrito móvil es una hoja que sube desde la barra de abajo
await page.evaluate(() => {
  const barra = document.querySelector('.fixed.inset-x-0.bottom-0 button')
  barra?.click()
})
await pausa(500)
await clic('3') // mesa
await shot('movil-pedido')

// Cierra la hoja tocando por fuera
await page.mouse.click(207, 60)
await pausa(400)

await clic('Pedidos pendientes')
await pausa(400)
await shot('movil-pendientes')

await clic('Caja')
await pausa(400)
await shot('movil-caja')

// ── 8 · Cerrar caja de último, para no vaciar las vistas anteriores ─────────
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 })
await pausa(400)
await clic('Caja')
await pausa(300)
// Acepta las tres advertencias: sin despachar, sin cobrar y la confirmación.
page.on('dialog', (d) => d.accept())
await clic('Cerrar caja')
await pausa(800)
await shot('cierre-documento') // el documento del día sale solo

// Así se ve al imprimirlo, y el PDF de verdad queda en capturas/.
await page.emulateMediaType('print')
await pausa(300)
await shot('cierre-impresion')
await page.pdf({
  path: `${DIR}/cierre-del-dia.pdf`,
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
})
console.log('✓', `${DIR}/cierre-del-dia.pdf`)
await page.emulateMediaType(null)

await clic('Cerrar')
await pausa(400)
await shot('caja-cerrada')

await browser.close()
console.log('\nListo:', n, 'capturas en', DIR)
