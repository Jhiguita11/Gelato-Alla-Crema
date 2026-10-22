# Gelato Alla Crema · Toma de pedidos

Aplicación web para tomar pedidos en la heladería y llevar el control de qué se
despachó y qué falta, por mesa. La carta está transcrita de las fotos en
[`Carta/`](Carta/).

**En vivo:** https://jhiguita11.github.io/Gelato-Alla-Crema/

Conviene abrirla en el celular e **instalarla** (*Instalar app* en Android,
*Compartir → Añadir a pantalla de inicio* en iPhone): queda como una app,
arranca a pantalla completa y **abre aunque no haya internet**.

## Cómo correrla

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # genera dist/ listo para publicar
bun run test     # pruebas de precios, caja y respaldo
```

## Cómo se publica

Cada `push` a `main` dispara
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que corre las
pruebas, compila y publica en GitHub Pages. Si una prueba falla, no se publica
y la app en vivo sigue con la versión anterior. No hay que subir `dist/` a mano.

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

**Copia de seguridad** — En modo local el historial de cierres vive solo en el
navegador del equipo donde se cerró la caja (en modo compartido queda en el
servidor, pero el respaldo sirve igual). Al final de Caja están **Descargar respaldo**
(un `.json` para volver a cargar), **Descargar para Excel** (un `.csv`, un
renglón por día) y **Cargar respaldo…** para restaurarlo en otro celular o
después de borrar los datos. Cargar el mismo respaldo dos veces no duplica
nada.

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

## Cómo se guardan los datos

La app tiene dos modos, y el cambio entre uno y otro es solo de configuración:

| | Modo local | Modo compartido |
| --- | --- | --- |
| Dónde viven los pedidos | En el navegador de cada equipo | En Supabase, compartidos |
| ¿La cocina ve lo que toma el mesero? | Solo si es el mismo equipo | **Sí, en todos los celulares, en ~1 s** |
| Numeración (#001…) | Una por equipo | **Una sola, la pone el servidor** |
| Caja | Una por equipo | **Una para todo el local** |
| Sin internet | Funciona | Funciona: los pedidos quedan "por enviar" y se suben solos |
| Para entrar | Nada | PIN del local, una vez por celular |

Sin configurar Supabase la app arranca en **modo local**, como siempre.

### Cómo funciona por dentro

Todas las acciones (tomar un pedido, cobrar, cerrar caja…) son operaciones de
un mismo reducer puro, [`src/sync/estado.js`](src/sync/estado.js). Los dos
modos lo usan:

- **Local** ([`motorLocal.js`](src/sync/motorLocal.js)): aplica la operación
  sobre lo último guardado en `localStorage` (claves `gac.*`, el mismo formato
  de siempre) y avisa a las otras pestañas del equipo.
- **Compartido** ([`motorRemoto.js`](src/sync/motorRemoto.js)): lo que se ve es
  *el último estado del servidor + la cola de lo que falta subir*. Cada acción
  se aplica de una en pantalla y entra en una cola guardada en el celular, que
  se sube en orden ([`remoto.js`](src/sync/remoto.js)). Sin internet la cola
  espera y se reintenta sola. Los cambios de otros celulares llegan por tiempo
  real de Supabase.

Lo que tiene que ser atómico lo hace la base de datos
([`supabase/migrations`](supabase/migrations)): el número de pedido (dos
celulares nunca reciben el mismo), el cierre de caja (si otro celular ya cerró,
o llegó un pedido mientras tanto, se rechaza con un aviso) y prender o apagar
sabores. Todas las operaciones son idempotentes: la cola puede reintentar sin
duplicar nada.

### Activar el modo compartido

1. **Proyecto**: crear un proyecto en [supabase.com](https://supabase.com)
   (plan gratis) y correr
   [`supabase/migrations/20261022000000_pedidos_compartidos.sql`](supabase/migrations/20261022000000_pedidos_compartidos.sql)
   en *SQL Editor*.
2. **Usuario del local**: en *Authentication → Users → Add user*, crear
   `local@gelatoallacrema.app` con el **PIN como contraseña** (mínimo 6
   dígitos) y marcar *Auto Confirm User*. Ese PIN es el que se pone en cada
   celular.
3. **Cerrar registros**: en *Authentication → Sign In / Providers*, desactivar
   *Allow new users to sign up*. (Aunque alguien lograra crear otra cuenta, las
   reglas de la base solo dejan entrar al email del local.)
4. **Conectar la app**: en GitHub, *Settings → Secrets and variables → Actions
   → Variables*, crear `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los valores de
   *Project Settings → API* (la clave **anon / publishable**, nunca la
   `service_role`). Volver a correr el deploy (*Actions → Publicar en GitHub
   Pages → Run workflow*).

Para cambiar el PIN: *Authentication → Users → el usuario → Reset password*.
Los celulares que ya entraron siguen conectados hasta que su sesión venza;
después piden el PIN nuevo.

Para correrlo en local: `VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… bun run dev`.

### Pruebas

- `bun run test`: reducer, modo local (compatibilidad con los datos ya
  guardados), cola y conversión de datos, precios, caja y respaldo.
- `scripts/probar-servidor.sh`: levanta un Postgres desechable con la
  migración y PostgREST adelante, y corre
  [`src/__tests__/integracion.test.js`](src/__tests__/integracion.test.js), que
  ejecuta cada operación contra el servidor y verifica que el resultado sea el
  mismo que predice el reducer. Necesita Postgres y el binario de
  [PostgREST](https://github.com/PostgREST/postgrest/releases).

## App instalable y sin internet

[`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) genera el manifest y un
service worker que guarda la app en el celular la primera vez que se abre con
conexión. Las fuentes (Inter y Fraunces) van dentro de la app, no se piden a
Google.

Cuando se publica una versión nueva, la app **no se recarga sola** (se perdería
el pedido que se esté armando): sale un aviso con el botón **Actualizar**.

Los íconos salen del logo con `bun scripts/iconos.mjs` y quedan en
`public/icons/`. Solo hay que volver a correrlo si cambia el logo.
