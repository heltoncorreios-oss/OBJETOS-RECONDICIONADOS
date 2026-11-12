/**
 * Service Worker Manifest V3 da extensão piloto SRO Intranet.
 *
 * Garantias:
 * - Aceita mensagens exclusivamente de https://recondicionamentodeobjetos.vercel.app
 *   validando sender.origin, sender.tab.url e sender.frameId === 0.
 * - Reutiliza uma única aba do SRO Intranet sempre que possível.
 * - Implementa cancelamento de consultas anteriores, timeout e detecção de sessão expirada.
 * - Utiliza exatamente o mesmo parser sroParser.ts do sistema principal.
 */

import {
  isValidTrackingCode,
  normalizeTrackingCode,
  parseSroContent,
  SroErrorCode,
  SroPostagemData,
} from '../../src/services/sroParser';
import {
  EXTENSION_QUERY_TIMEOUT_MS,
  EXTENSION_TAB_LOAD_TIMEOUT_MS,
  EXTENSION_VERSION,
  OFFICIAL_APP_ORIGIN,
  OFFICIAL_APP_URL_PREFIX,
  SRO_INTRANET_BASE_URL,
  SRO_INTRANET_ORIGIN,
} from './config';

interface ActiveQueryState {
  requestId: string;
  trackingCode: string;
  cancelled: boolean;
}

export interface ExtensionQueryResult {
  ok: boolean;
  requestId: string;
  trackingCode: string;
  extensionVersion: string;
  data?: SroPostagemData;
  errorCode?: SroErrorCode | 'EXTENSION_TIMEOUT' | 'CANCELLED' | 'UNAUTHORIZED_ORIGIN';
  message?: string;
}

const MANAGED_TAB_STORAGE_KEY = 'sroManagedTabId';
let activeQuery: ActiveQueryState | null = null;
let cachedManagedTabId: number | null = null;

function isTrustedAppSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender) return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;

  const senderOrigin = sender.origin || '';
  const tabUrl = sender.tab?.url || '';

  return (
    senderOrigin === OFFICIAL_APP_ORIGIN &&
    tabUrl.startsWith(OFFICIAL_APP_URL_PREFIX)
  );
}

async function getSavedManagedTabId(): Promise<number | null> {
  if (cachedManagedTabId !== null) return cachedManagedTabId;
  try {
    const area = chrome.storage.session || chrome.storage.local;
    const result = await area.get(MANAGED_TAB_STORAGE_KEY);
    const tabId = result?.[MANAGED_TAB_STORAGE_KEY];
    if (typeof tabId === 'number') {
      cachedManagedTabId = tabId;
      return tabId;
    }
  } catch {
    // Ignorar falha de leitura
  }
  return null;
}

async function saveManagedTabId(tabId: number | null): Promise<void> {
  cachedManagedTabId = tabId;
  try {
    const area = chrome.storage.session || chrome.storage.local;
    await area.set({ [MANAGED_TAB_STORAGE_KEY]: tabId });
  } catch {
    // Ignorar falha de gravação
  }
}

chrome.tabs.onRemoved.addListener((closedTabId) => {
  if (cachedManagedTabId === closedTabId) {
    void saveManagedTabId(null);
  }
});

/**
 * Localiza e reutiliza uma única aba do SRO Intranet; abre uma nova somente se não houver nenhuma.
 */
async function acquireSingleSroTab(targetUrl: string): Promise<chrome.tabs.Tab> {
  const savedTabId = await getSavedManagedTabId();
  if (savedTabId !== null) {
    try {
      const existing = await chrome.tabs.get(savedTabId);
      if (existing && existing.id !== undefined) {
        return await chrome.tabs.update(existing.id, { url: targetUrl, active: false });
      }
    } catch {
      await saveManagedTabId(null);
    }
  }

  const sroTabs = await chrome.tabs.query({ url: `${SRO_INTRANET_ORIGIN}/*` });
  if (sroTabs.length > 0 && sroTabs[0].id !== undefined) {
    const reused = sroTabs[0];
    await saveManagedTabId(reused.id!);
    return await chrome.tabs.update(reused.id!, { url: targetUrl, active: false });
  }

  const created = await chrome.tabs.create({ url: targetUrl, active: false });
  if (created.id !== undefined) {
    await saveManagedTabId(created.id);
  }
  return created;
}

function isLikelyExternalSsoRedirect(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith(`${SRO_INTRANET_ORIGIN}/`)) {
    return /\/(?:login|sso|auth|cas|signin)/i.test(url);
  }
  return (
    url.startsWith('https://') &&
    /(?:idcorreios|cas|sso|login|auth|adfs|acesso\.correios)/i.test(url)
  );
}

async function waitForTabReady(
  tabId: number,
  queryState: ActiveQueryState,
  timeoutMs: number,
  waitForFreshComplete = false
): Promise<{ ready: boolean; redirectedToAuth: boolean; finalUrl?: string }> {
  try {
    const currentTab = await chrome.tabs.get(tabId);
    if (isLikelyExternalSsoRedirect(currentTab.url)) {
      return { ready: false, redirectedToAuth: true, finalUrl: currentTab.url };
    }
    if (
      !waitForFreshComplete &&
      currentTab.status === 'complete' &&
      currentTab.url?.startsWith(`${SRO_INTRANET_ORIGIN}/`)
    ) {
      return { ready: true, redirectedToAuth: false, finalUrl: currentTab.url };
    }
  } catch {
    return { ready: false, redirectedToAuth: false };
  }

  return new Promise((resolve) => {
    let settled = false;
    let sawLoading = false;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      clearTimeout(quickFallback);
      clearInterval(cancelCheck);
    };

    const finish = (res: { ready: boolean; redirectedToAuth: boolean; finalUrl?: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(res);
    };

    const onUpdated = (
      updatedTabId: number,
      changeInfo: { status?: string; url?: string },
      tab: chrome.tabs.Tab
    ) => {
      if (updatedTabId !== tabId) return;
      if (queryState.cancelled) {
        finish({ ready: false, redirectedToAuth: false });
        return;
      }

      if (changeInfo.status === 'loading') {
        sawLoading = true;
      }

      const currentUrl = changeInfo.url || tab.url;
      if (isLikelyExternalSsoRedirect(currentUrl)) {
        finish({ ready: false, redirectedToAuth: true, finalUrl: currentUrl });
        return;
      }

      if (
        changeInfo.status === 'complete' &&
        currentUrl?.startsWith(`${SRO_INTRANET_ORIGIN}/`)
      ) {
        finish({ ready: true, redirectedToAuth: false, finalUrl: currentUrl });
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    // Se tabs.update não disparou mudança de URL (ex: mesma URL já carregada), não ficar preso
    const quickFallback = setTimeout(async () => {
      if (settled || !waitForFreshComplete || sawLoading) return;
      try {
        const tabNow = await chrome.tabs.get(tabId);
        if (
          tabNow.status === 'complete' &&
          tabNow.url?.startsWith(`${SRO_INTRANET_ORIGIN}/`)
        ) {
          finish({ ready: true, redirectedToAuth: false, finalUrl: tabNow.url });
        }
      } catch {
        // Ignorar
      }
    }, 600);

    const cancelCheck = setInterval(() => {
      if (queryState.cancelled) {
        finish({ ready: false, redirectedToAuth: false });
      }
    }, 150);

    const timer = setTimeout(() => {
      finish({ ready: false, redirectedToAuth: false });
    }, timeoutMs);
  });
}

async function sendExtractDomWithRetry(
  tabId: number,
  cleanCode: string,
  requestId: string,
  queryState: ActiveQueryState
): Promise<any> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (queryState.cancelled) return null;
    try {
      return await chrome.tabs.sendMessage(tabId, {
        type: 'SRO_EXTRACT_DOM',
        trackingCode: cleanCode,
        requestId,
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      // Caso o submit da pesquisa tenha provocado recarregamento da página do SRO, aguardar nova página e tentar mais uma vez
      if (/message channel closed|back\/forward cache/i.test(msg)) {
        const reloadState = await waitForTabReady(tabId, queryState, 8000, true);
        if (!reloadState.ready) {
          if (reloadState.redirectedToAuth) {
            return { ok: false, authRequired: true };
          }
          throw err;
        }
        continue;
      }

      if (/Receiving end does not exist/i.test(msg) && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function executeSroQueryInner(
  cleanCode: string,
  requestId: string,
  queryState: ActiveQueryState
): Promise<ExtensionQueryResult> {
  try {
    const targetUrl = `${SRO_INTRANET_BASE_URL}?objeto=${encodeURIComponent(cleanCode)}`;
    const tab = await acquireSingleSroTab(targetUrl);

    if (queryState.cancelled) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'CANCELLED',
        message: 'Consulta cancelada por nova solicitação ou tempo limite.',
      };
    }

    if (tab.id === undefined) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'INTRANET_UNREACHABLE',
        message: 'Não foi possível abrir ou reutilizar a aba do SRO Intranet.',
      };
    }

    const loadState = await waitForTabReady(
      tab.id,
      queryState,
      EXTENSION_TAB_LOAD_TIMEOUT_MS,
      true
    );

    if (queryState.cancelled) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'CANCELLED',
        message: 'Consulta cancelada.',
      };
    }

    if (loadState.redirectedToAuth) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'AUTH_REQUIRED',
        message:
          'Sessão do SRO Intranet expirada ou não autenticada. Faça login na aba do SRO e tente novamente.',
      };
    }

    if (!loadState.ready) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'INTRANET_UNREACHABLE',
        message:
          'Tempo esgotado ao carregar o SRO Intranet. Verifique a conexão na rede corporativa.',
      };
    }

    const existingSroTabsBefore = await chrome.tabs
      .query({ url: `${SRO_INTRANET_ORIGIN}/*` })
      .catch(() => []);
    const existingIdsBefore = new Set(
      existingSroTabsBefore
        .map((t) => t.id)
        .filter((id): id is number => typeof id === 'number')
    );

    let openedPopupTabId: number | null = null;
    const onPopupCreated = (newTab: chrome.tabs.Tab) => {
      if (
        newTab &&
        typeof newTab.id === 'number' &&
        newTab.id !== tab.id &&
        (newTab.openerTabId === tab.id || !existingIdsBefore.has(newTab.id))
      ) {
        openedPopupTabId = newTab.id;
      }
    };
    chrome.tabs.onCreated?.addListener(onPopupCreated);

    let domRes: any;
    let usedPopupTabId: number | null = null;
    try {
      domRes = await sendExtractDomWithRetry(tab.id, cleanCode, requestId, queryState);

      // Se clicou no ícone Det / guia Postado e abriu um popup/nova aba sem renderizar na aba principal, extrair da nova aba
      if (domRes && !domRes.authRequired && !domRes.notFound && !domRes.hasPoDetail) {
        if (openedPopupTabId === null) {
          await new Promise((r) => setTimeout(r, 250));
          const tabsAfter = await chrome.tabs
            .query({ url: `${SRO_INTRANET_ORIGIN}/*` })
            .catch(() => []);
          const extraTab = tabsAfter.find(
            (t) => typeof t.id === 'number' && !existingIdsBefore.has(t.id)
          );
          if (extraTab && typeof extraTab.id === 'number') {
            openedPopupTabId = extraTab.id;
          }
        }

        if (openedPopupTabId !== null && !queryState.cancelled) {
          usedPopupTabId = openedPopupTabId;
          const popupLoad = await waitForTabReady(openedPopupTabId, queryState, 8000, false);
          if (popupLoad.redirectedToAuth) {
            domRes = { ok: false, authRequired: true };
          } else if (popupLoad.ready) {
            const popupDom = await sendExtractDomWithRetry(
              openedPopupTabId,
              cleanCode,
              requestId,
              queryState
            );
            if (popupDom && (popupDom.hasPoDetail || popupDom.authRequired)) {
              domRes = popupDom;
            }
          }
        }
      }
    } finally {
      chrome.tabs.onCreated?.removeListener(onPopupCreated);
      if (usedPopupTabId !== null) {
        try {
          await chrome.tabs.remove?.(usedPopupTabId);
        } catch {
          // Ignorar falha ao fechar aba temporária
        }
      }
    }

    if (queryState.cancelled) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'CANCELLED',
        message: 'Consulta cancelada.',
      };
    }

    if (!domRes) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'INTRANET_UNREACHABLE',
        message: 'Sem resposta do leitor da aba do SRO Intranet.',
      };
    }

    if (domRes.authRequired) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'AUTH_REQUIRED',
        message:
          'Sessão do SRO Intranet expirada. Autentique-se na aba do SRO e consulte novamente.',
      };
    }

    const allowPopupDetailWithoutCode = usedPopupTabId !== null && Boolean(domRes.hasPoDetail);

    if (!domRes.notFound && !domRes.hasTrackingMatch && !allowPopupDetailWithoutCode) {
      let diagnostic =
        'A aba do SRO Intranet abriu, mas o resultado do objeto não carregou automaticamente na tela.';
      if (domRes.inputFound === false) {
        diagnostic =
          'A aba do SRO Intranet abriu, mas o campo de pesquisa não foi localizado automaticamente na tela.';
      } else if (domRes.searchTriggered === false) {
        diagnostic =
          'A aba do SRO Intranet abriu, mas não foi possível acionar o botão de pesquisa automaticamente.';
      }

      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'INTRANET_UNREACHABLE',
        message: `${diagnostic} Confira a aba do SRO ou cole os dados abaixo.`,
      };
    }

    const rawContent = domRes.html || domRes.text || '';
    const parsed = parseSroContent(rawContent, cleanCode);

    if (!parsed.ok || !parsed.data) {
      const extraHint =
        domRes.postadoRowFound && !domRes.hasPoDetail
          ? ' A linha "Postado" apareceu na tabela, mas a guia/detalhe do evento não abriu automaticamente.'
          : '';
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: parsed.errorCode || 'PARSE_ERROR',
        message:
          (parsed.message ||
            'Não foi possível localizar o evento Postagem (PO) para este objeto no SRO.') +
          extraHint,
      };
    }

    if (normalizeTrackingCode(parsed.data.codigoRastreamento) !== cleanCode) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'OBJECT_NOT_FOUND',
        message:
          'Os dados extraídos da aba não correspondem ao código pesquisado e foram descartados.',
      };
    }

    return {
      ok: true,
      requestId,
      trackingCode: cleanCode,
      extensionVersion: EXTENSION_VERSION,
      data: parsed.data,
    };
  } catch (err: any) {
    return {
      ok: false,
      requestId,
      trackingCode: cleanCode,
      extensionVersion: EXTENSION_VERSION,
      errorCode: 'INTRANET_UNREACHABLE',
      message:
        err?.message ||
        'Não foi possível comunicar com a aba do SRO Intranet nesta estação.',
    };
  }
}

async function executeSroQuery(
  rawCode: string,
  requestId: string
): Promise<ExtensionQueryResult> {
  const cleanCode = normalizeTrackingCode(rawCode);
  if (!isValidTrackingCode(cleanCode)) {
    return {
      ok: false,
      requestId,
      trackingCode: cleanCode,
      extensionVersion: EXTENSION_VERSION,
      errorCode: 'INVALID_CODE',
      message: 'Código de rastreamento inválido para consulta no SRO.',
    };
  }

  // Cancelar consulta anterior antes de iniciar a nova
  if (activeQuery) {
    activeQuery.cancelled = true;
  }

  const queryState: ActiveQueryState = {
    requestId,
    trackingCode: cleanCode,
    cancelled: false,
  };
  activeQuery = queryState;

  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  const deadlinePromise = new Promise<ExtensionQueryResult>((resolve) => {
    deadlineTimer = setTimeout(() => {
      queryState.cancelled = true;
      resolve({
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'EXTENSION_TIMEOUT',
        message:
          'O SRO Intranet demorou para responder. Verifique se a sessão está logada na aba do SRO ou cole os dados abaixo.',
      });
    }, EXTENSION_QUERY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      executeSroQueryInner(cleanCode, requestId, queryState),
      deadlinePromise,
    ]);
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    if (activeQuery === queryState) {
      activeQuery = null;
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedAppSender(sender)) {
    sendResponse({
      ok: false,
      errorCode: 'UNAUTHORIZED_ORIGIN',
      message: 'Origem não autorizada para acessar a extensão SRO.',
      extensionVersion: EXTENSION_VERSION,
    });
    return false;
  }

  if (!message || typeof message !== 'object') {
    return false;
  }

  if (message.type === 'SRO_EXT_PING') {
    sendResponse({
      ok: true,
      extensionVersion: EXTENSION_VERSION,
      officialOrigin: OFFICIAL_APP_ORIGIN,
    });
    return false;
  }

  if (message.type === 'SRO_CANCEL_QUERY') {
    if (
      activeQuery &&
      (!message.requestId || activeQuery.requestId === message.requestId)
    ) {
      activeQuery.cancelled = true;
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'SRO_QUERY_REQUEST') {
    const requestId = typeof message.requestId === 'string' ? message.requestId : '';
    const trackingCode = typeof message.trackingCode === 'string' ? message.trackingCode : '';

    if (!requestId) {
      sendResponse({
        ok: false,
        errorCode: 'PARSE_ERROR',
        message: 'requestId ausente na solicitação.',
        extensionVersion: EXTENSION_VERSION,
      });
      return false;
    }

    void executeSroQuery(trackingCode, requestId).then((res) => sendResponse(res));
    return true;
  }

  return false;
});
