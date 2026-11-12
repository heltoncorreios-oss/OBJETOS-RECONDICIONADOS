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
  timeoutMs: number
): Promise<{ ready: boolean; redirectedToAuth: boolean; finalUrl?: string }> {
  try {
    const currentTab = await chrome.tabs.get(tabId);
    if (isLikelyExternalSsoRedirect(currentTab.url)) {
      return { ready: false, redirectedToAuth: true, finalUrl: currentTab.url };
    }
    if (
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

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
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

      const currentUrl = changeInfo.url || tab.url;
      if (isLikelyExternalSsoRedirect(currentUrl)) {
        finish({ ready: false, redirectedToAuth: true, finalUrl: currentUrl });
        return;
      }

      if (changeInfo.status === 'complete') {
        finish({ ready: true, redirectedToAuth: false, finalUrl: currentUrl });
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

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

  const deadlineTimer = setTimeout(() => {
    queryState.cancelled = true;
  }, EXTENSION_QUERY_TIMEOUT_MS);

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
      EXTENSION_TAB_LOAD_TIMEOUT_MS
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

    const domRes = await chrome.tabs.sendMessage(tab.id, {
      type: 'SRO_EXTRACT_DOM',
      trackingCode: cleanCode,
      requestId,
    });

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

    if (!domRes.notFound && !domRes.hasTrackingMatch) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: 'INTRANET_UNREACHABLE',
        message:
          'A aba do SRO Intranet abriu, mas o resultado do objeto não carregou automaticamente na tela. Confira a aba do SRO ou cole os dados abaixo.',
      };
    }

    const rawContent = domRes.html || domRes.text || '';
    const parsed = parseSroContent(rawContent, cleanCode);

    if (!parsed.ok || !parsed.data) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: parsed.errorCode || 'PARSE_ERROR',
        message:
          parsed.message ||
          'Não foi possível localizar o evento Postagem (PO) para este objeto no SRO.',
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
  } finally {
    clearTimeout(deadlineTimer);
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
