// Service Worker for Vagou PWA - Network First, Auto-Update & Dynamic Manifest Bypass
const CACHE_NAME = 'vagou-cache-v11';

// Instalação: força ativação imediata sem esperar o fechamento de abas
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Ativação: apaga compulsoriamente TODOS os caches legados
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Escuta mensagem explícita para pular espera ou limpar
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'PURGE_ALL_CACHES') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});

// Estratégia Network-First estrita com bypass total para manifestos dinâmicos, ícones PWA e APIs
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Não intercepta dev server, node_modules, APIs, manifesto dinâmico ou ícones gerados por subdomínio
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('hot-update') ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/manifest.json'
  ) {
    return;
  }

  // HTML / Navegação: SEMPRE busca da rede para ter meta tags, título e hashes mais recentes
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // Assets (CSS, JS, Imagens, Fontes): Tenta a rede primeiro; em caso de falha/offline, usa o cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
