/**
 * Flash BI — Service Worker
 *
 * Estratégia: Network First
 * - Sempre tenta buscar da rede (garante que updates chegam automaticamente)
 * - Se offline, cai para o cache
 * - A cada novo deploy o SW detecta a mudança e atualiza silenciosamente
 */

const CACHE_NAME = "flash-bi-v1";

// Arquivos essenciais para funcionar offline (shell do app)
const PRECACHE = [
  "/",
  "/index.html",
];

// ── Instalação: pré-cacheia o shell ──────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  // Ativa imediatamente sem esperar fechar outras abas
  self.skipWaiting();
});

// ── Ativação: limpa caches antigos ───────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Assume controle de todas as abas abertas imediatamente
  self.clients.claim();
});

// ── Fetch: Network First ──────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Não intercepta chamadas para a API (deixa passar direto)
  if (url.hostname.includes("api-flash") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Para recursos do próprio app: tenta rede, cai para cache se offline
  event.respondWith(
    fetch(request)
      .then(response => {
        // Salva no cache se for uma resposta válida
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Detecta update disponível e notifica o app ────────────────────────────────
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
