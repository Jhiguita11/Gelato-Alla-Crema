// Se suma al service worker de la app (ver vite.config.js → workbox.importScripts).
// Al tocar la notificación de "pedido listo", abre la app o la trae al frente.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.registration.scope))
      return abierta ? abierta.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})
