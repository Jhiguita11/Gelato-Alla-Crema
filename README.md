# Gelato Alla Crema · Toma de pedidos

Aplicación web para tomar pedidos en la heladería y llevar el control de qué se
despachó y qué falta, por mesa. La carta está transcrita de las fotos en
[`Carta/`](Carta/).

**En vivo:** https://jhiguita11.github.io/Gelato-Alla-Crema/

Conviene abrirla en el celular y usar *Añadir a pantalla de inicio*: queda como
una app y arranca a pantalla completa.

## Cómo correrla

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # genera dist/ listo para publicar
```

## Cómo se publica

Cada `push` a `main` dispara
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que compila y
publica en GitHub Pages. No hay que subir `dist/` a mano.

Como el sitio vive en una subcarpeta (`/Gelato-Alla-Crema/`), `vite.config.js`
saca la ruta base del nombre del repo que expone Actions — si el repo se
renombra, la ruta se ajusta sola.

## Cómo funciona

**Entrar** — Lo primero que pide la app es **quién entra**: Jeremy, Mariana,
Gloria, Fredy o Carolina (la lista se edita en `STAFF`). Al tocar un nombre se
abre su turno, y todos los pedidos que tome quedan a su nombre. Arriba a la
derecha se ve quién está conectado y desde qué hora, con el botón **Salir** que
cierra el turno.

> El turno se cierra solo si alguien toca **Salir**. Si simplemente cierran el
> navegador, queda abierto y el tiempo sigue corriendo hasta el cierre de caja.

**Nuevo pedido** — La carta sale dividida en sus secciones (Cono/vaso/canasta,
Especiales, Infantiles, De la Casa, Bebidas y postres). Al tocar un producto se
abre el armado paso a paso, y solo aparecen los pasos que ese producto
necesita:

1. **Versión** — cuando el producto se vende en varias: 1 a 5 porciones en el
   cono/vaso/canasta, X1 / X2 en la Concha, sencilla / especial en la Ensalada
   de frutas, con / sin helado en Cholado y Salpicón.
2. **Opciones propias** — el recipiente (cono, vaso o canasta) y el licor de la
   Copa Bayles.
3. **Sabores** — uno por porción. Se puede repetir el mismo sabor.
4. **¿Cuál salsa?** — chocolate, arequipe o chicle. Va incluida, no cobra
   aparte. Sale en el cono/vaso/canasta y en todo lo que la carta marca con
   "Salsa" genérica.
5. **Extras incluidos** — en el cono/vaso/canasta pregunta si lleva maní o
   chips de colores. Se pueden pedir los dos o ninguno, y no cobran.
6. **Adiciones** — lo que sí se cobra aparte. Si se marca **porción extra de
   helado**, se abre ahí mismo la paleta de sabores para decir de cuál va; pasa
   en cualquier producto y sin elegirlo no deja agregar la línea.
7. **Cantidad**.

Lo que la preparación ya incluye (chips, barquillo, chantilly, queso…) se
muestra pero no se pregunta, porque viene fijo de fábrica.

Después se pueden seguir agregando productos al mismo pedido, elegir la
**mesa** (5 mesas o "Para llevar"), poner **a nombre de quién** va el pedido
(opcional, para llamarlo cuando esté listo), marcar si queda **pagado o
pendiente de pago**, escribir una nota para cocina y enviarlo.

**Pedidos pendientes** — Cada pedido enviado llega con su número consecutivo
(#001, #002…), la mesa, la hora y hace cuánto entró. Se filtra por
Pendientes / Despachados / Todos, y cada tarjeta tiene el botón **Marcar como
despachado** (y **Reabrir** si se marcó por error).

El **estado de pago** va aparte del de despacho, porque son cosas distintas: un
pedido puede salir de cocina sin haberse cobrado todavía. Por eso hay un filtro
**Sin pagar** que cruza el despacho — un pedido ya entregado que todavía debe
sigue apareciendo ahí hasta que se cobre. Los sin pagar llevan etiqueta naranja
en el encabezado, y arriba se ve cuántos son y **cuánto falta por cobrar**.

Por lo mismo, **"Limpiar despachados y pagados" no borra los que deben**: solo
se lleva los que ya están entregados *y* cobrados.

**Disponibilidad** — La app arranca cada día preguntando **qué sabores hay en
la vitrina**; lo que no se marque no se puede pedir. La pregunta vuelve a salir
sola cuando cambia el día.

Si algo se acaba a media tarde, en esta pantalla se apaga: sabores y productos
sueltos. Lo agotado desaparece del armado de pedidos al instante — el producto
queda tachado y no se deja tocar, y el sabor ni siquiera se ofrece. Se vuelve a
encender igual de fácil. El botón *Volver a preguntar los sabores* repite la
apertura sin esperar al otro día.

**Caja** — Lleva la cuenta del día en vivo: lo vendido, cuánto se cobró y
cuánto falta por cobrar, cuántos pedidos y cuántas porciones de helado
salieron. Abajo, dos listas ordenadas: **lo más vendido** (por unidades, con
desempate por plata) y **porciones por sabor**, que sirve para saber qué
reponer.

También lleva **quién atendió**: por persona, cuántas mesas distintas atendió
(la misma mesa dos veces cuenta una), cuántos pedidos tomó, cuánto vendió y
cuánto tiempo estuvo conectada sumando todos sus turnos del día.

**Cerrar caja** archiva el día en el historial, borra los pedidos, reinicia los
turnos y devuelve la numeración a #001.

Al cerrar sale el **documento del día**: un comprobante con el logo, las cifras,
los productos vendidos, las porciones por sabor y quién atendió. El botón
**Descargar PDF** abre el cuadro de impresión del navegador; ahí se elige
*Guardar como PDF* y el archivo queda en Descargas (en celular sale además la
opción de compartirlo por WhatsApp). Cualquier cierre viejo se puede volver a
abrir desde el historial con **Ver documento del día**.

El PDF lo genera el propio navegador, sin librerías ni servidor: pesa poco,
funciona sin internet y el texto queda seleccionable. Antes de cerrar avisa si quedan pedidos sin despachar o sin
cobrar, y hay que confirmar — nunca cierra de una. Los cierres anteriores
quedan guardados y se pueden abrir para ver cómo fue cada día.

## Precios del helado

Toda la escalera del cono/vaso/canasta sale de **$3.500 por porción**
(`PRECIO_PORCION` en `menu.js`), que es lo mismo que cuesta la adición
"Porción extra de helado":

| Porciones | 1        | 2        | 3         | 4         | 5         |
| --------- | -------- | -------- | --------- | --------- | --------- |
| Precio    | $3.500   | $7.000   | $10.500   | $14.000   | $17.500   |

Eso cuadra con la carta física: los precios impresos en azul (X1 $3.500, X2
$7.000) y las etiquetas amarillas sueltas de $10.500 y $14.000 son 3 y 4
porciones de la misma escalera.

Las demás adiciones (queso, leche condensada, chocolate derretido, chantilly,
cereza) valen **$1.000**. **Chips de colores, maní, grageas y barquillo vienen
con el helado y no se cobran**, por eso no aparecen en la lista de adiciones:
el maní y los chips se preguntan aparte (campo `extras`) y las grageas y el
barquillo salen en el `incluye` del producto.

## Otros precios de la carta

| Producto                | En la carta                         | Se cobra          |
| ----------------------- | ----------------------------------- | ----------------- |
| **Ensalada de frutas**  | Dos etiquetas: $12.000 y $16.000    | Sencilla $12.000 / Especial $16.000 |
| **Cholado**             | $11.000 impreso, $14.000 a mano     | $14.000 sin helado |
| **Salpicón con helado** | Etiqueta en blanco                  | $12.000 con helado |
| **Concha de helado**    | X1 $3.500 / X2 $7.000 + etiquetas   | $10.500 / $14.000 |

Las dos etiquetas de la Ensalada de frutas no eran precio viejo y nuevo: son
las dos versiones (sencilla con 1 bola, especial con 2).

### ⚠️ Todavía sin datos reales

- **Cholado con helado** ($17.500) y **Salpicón sin helado** ($8.500) — Son un
  supuesto: le sumé o resté una porción ($3.500) al precio conocido de cada
  uno. Confirmar los reales.
- **Sabores** — Los 16 de `FLAVORS` son los que el dueño recordó de memoria, no
  una lista oficial. Si falta alguno, se agrega ahí y sale solo en la apertura
  del día siguiente.

## Dónde cambiar precios y carta

Todo está en un solo archivo: [`src/data/menu.js`](src/data/menu.js).

| Qué cambiar                     | Dónde                     |
| ------------------------------- | ------------------------- |
| Productos, precios, secciones   | `PRODUCTS` / `CATEGORIES` |
| Precio de la porción de helado  | `PRECIO_PORCION`          |
| Versiones de un producto        | `variantes` del producto  |
| Recipiente, licor y similares   | `opciones` del producto   |
| Sabores de helado               | `FLAVORS`                 |
| Salsas                          | `SAUCES`                  |
| Adiciones que se cobran         | `ADICIONES_EXTRA`         |
| Mesas del local                 | `TABLES`                  |

Para agotar un sabor sin borrarlo, se le pone `available: false`.

## En celular

Es la vista principal, así que está pensada para el teléfono primero:

- La barra de arriba va en dos filas cortas — logo y turno arriba, las cuatro
  vistas abajo en nombres cortos (Nuevo · Pedidos · Vitrina · Caja). En
  pantalla grande todo eso vuelve a una sola fila con los nombres completos.
- El pedido en curso vive en una barra fija abajo que abre una hoja con la
  mesa, el nombre, los productos, el pago y la nota.
- Los botones que más se tocan (mesas, sabores, salsas) tienen el área ampliada
  en celular y vuelven a su tamaño normal desde tablet.

## Marca

El logo está en [`public/logo.jpg`](public/logo.jpg) (copia del que hay en
`Carta/`) y se usa en el encabezado y como ícono de la pestaña.

La paleta sale de ese mismo logo y está definida en
[`src/index.css`](src/index.css). Cada familia tiene un trabajo:

| Familia     | Sacada de           | Para qué se usa                              |
| ----------- | ------------------- | -------------------------------------------- |
| `crema`     | Lettering del logo  | Fondo de la página y de las tarjetas          |
| `cacao`     | Contorno café       | Todo el texto, y el estado "pendiente de pago" |
| `menta`     | Turquesa del fondo  | La marca: acción principal, precios, despachado |
| `cono`      | Naranja del barquillo | Mesa y el botón de enviar el pedido        |
| `terracota` | —                   | Lo que se agota, se quita o se borra          |

Para cambiar un color se toca solo el `@theme` de `index.css`; no hay colores
sueltos en los componentes.

## Scripts de apoyo

```bash
bun scripts/capturas.mjs   # maneja la app en Chrome y guarda capturas/
bun scripts/zoom.mjs       # amplía zonas de las fotos de la carta
```

`capturas.mjs` **borra los pedidos guardados** al arrancar, porque necesita
partir de cero. Ambos usan el Chrome instalado (variable `CHROME_PATH` para
cambiar la ruta).

## Nota técnica

Los pedidos se guardan en el navegador (`localStorage`), no hay servidor. Eso
significa que:

- Funciona sin internet una vez cargada.
- Si se abren dos pestañas en el **mismo** equipo (caja y cocina), se
  sincronizan solas.
- Dos **dispositivos distintos** (tablet de caja y pantalla de cocina) no
  comparten los pedidos. Para eso hace falta un backend; queda pendiente si se
  necesita.

Stack: React 19 + Vite + Tailwind CSS 4, con bun.
