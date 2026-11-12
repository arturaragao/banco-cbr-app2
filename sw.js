// Substitui o SW antigo sem apagar os caches compartilhados da origem.
function montarDestino(input) {
  const url = new URL(input);
  const prefixo = '/banco-cbr-app2/';
  if (url.pathname === '/banco-cbr-app2') url.pathname = '/radio/';
  else if (url.pathname.startsWith(prefixo)) url.pathname = '/radio/' + url.pathname.slice(prefixo.length);
  return url.href;
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.allSettled(clientes.map(client => {
      const url = new URL(client.url);
      if (url.origin !== self.location.origin) return;
      const destino = montarDestino(client.url);
      if (destino !== client.url) return client.navigate(destino);
    }));
  })());
});
