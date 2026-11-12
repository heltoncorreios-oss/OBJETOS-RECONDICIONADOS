/**
 * Content Script executado exclusivamente na aba autenticada do SRO Intranet
 * (https://srointranet.correios.com.br/*).
 *
 * Princípios:
 * - Lê apenas o DOM efetivamente renderizado após carregamento da consulta.
 * - Suporta telas SSR, SPAs (com input ou textarea), preenchimento automático da pesquisa
 *   e detecção de tela de login ou objeto não encontrado.
 * - Não lê document.cookie, não armazena credenciais e não captura senhas.
 */

import { SRO_INTRANET_ORIGIN } from './config';

interface ExtractDomRequest {
  type: 'SRO_EXTRACT_DOM';
  trackingCode: string;
  requestId: string;
}

interface ExtractDomResponse {
  ok: boolean;
  requestId: string;
  trackingCode: string;
  authRequired?: boolean;
  notFound?: boolean;
  hasTrackingMatch?: boolean;
  hasPostagemHint?: boolean;
  hasPoDetail?: boolean;
  postadoRowFound?: boolean;
  postadoDetailTriggered?: boolean;
  inputFound?: boolean;
  searchTriggered?: boolean;
  text: string;
  html: string;
  url: string;
  error?: string;
}

function isLoginOrAuthScreen(text: string): boolean {
  const hasPasswordInput = Boolean(document.querySelector('input[type="password"]'));
  if (hasPasswordInput) return true;

  return /(?:acesso\s+restrito|fa[çc]a\s+login|autentica[çc][ãa]o\s+corporativa|idcorreios|cas\s+login|usu[áa]rio\s+e\s+senha|entre\s+com\s+sua\s+conta)/i.test(
    text
  );
}

function isObjectNotFoundText(text: string): boolean {
  return /(?:objeto\s+n[ãa]o\s+encontrado|nenhum\s+objeto\s+encontrado|dados\s+n[ãa]o\s+encontrados\s+para\s+o\s+objeto|c[óo]digo\s+n[ãa]o\s+encontrado|n[ãa]o\s+possui\s+dados)/i.test(
    text
  );
}

function hasPostagemHint(text: string): boolean {
  return /(?:\bpostagem\s*\(\s*PO\s*\)|evento\s*[:\-]?\s*PO\b|\bPO\s*[-–:]|\bobjeto\s+postad[oa]\b|\bpostad[oa]\b)/i.test(
    text
  );
}

function hasPoDetailFields(text: string): boolean {
  if (!text) return false;
  const hasRemetente = /\bRemetente\b/i.test(text);
  const hasDestinatario = /\bDestinat[áa]rio\b/i.test(text);
  const hasMetric = /\b(?:Peso|VD|Valor\s+Declarado|CEP)\b/i.test(text);
  return hasRemetente && hasDestinatario && hasMetric;
}

function normalizeCodeUpper(code: string): string {
  return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getAccessibleDocuments(): Document[] {
  const docs: Document[] = [];
  const frames = Array.from(document.querySelectorAll('iframe, frame'));
  // Colocar iframes same-origin antes do documento principal para priorizar conteúdo de modais/guias abertos
  for (const frame of frames) {
    try {
      const f = frame as HTMLIFrameElement;
      const doc = f.contentDocument || f.contentWindow?.document;
      if (doc && doc.body && (doc.body.innerText || '').trim()) {
        docs.push(doc);
      }
    } catch {
      // Ignorar iframes cross-origin
    }
  }
  docs.push(document);
  return docs;
}

function collectCombinedContent(): { text: string; html: string } {
  const docs = getAccessibleDocuments();
  const texts: string[] = [];
  const htmls: string[] = [];

  for (const doc of docs) {
    const t = doc.body?.innerText || '';
    const h = doc.body?.innerHTML || '';
    if (t.trim()) texts.push(t);
    if (h.trim()) htmls.push(h);
  }

  return {
    text: texts.join('\n\n'),
    html: htmls.join('\n'),
  };
}

type TrackingInputElement = HTMLInputElement | HTMLTextAreaElement;

function isElementVisible(el: HTMLElement): boolean {
  const win = el.ownerDocument?.defaultView || window;
  const style = win.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findTrackingInput(): TrackingInputElement | null {
  const selectors = [
    'input[name*="objeto" i]',
    'input[id*="objeto" i]',
    'textarea[name*="objeto" i]',
    'textarea[id*="objeto" i]',
    'input[name*="rastre" i]',
    'input[id*="rastre" i]',
    'textarea[name*="rastre" i]',
    'textarea[id*="rastre" i]',
    'input[placeholder*="SS123" i]',
    'textarea[placeholder*="SS123" i]',
    'input[placeholder*="objeto" i]',
    'textarea[placeholder*="objeto" i]',
    'input[placeholder*="rastre" i]',
    'textarea[placeholder*="rastre" i]',
    'input[placeholder*="código" i]',
    'input[placeholder*="codigo" i]',
    'textarea',
    'form input[type="text"]',
    'input[type="search"]',
    'input[type="text"]',
  ];

  for (const selector of selectors) {
    const matches = Array.from(document.querySelectorAll(selector));
    for (const el of matches) {
      if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
        !el.disabled &&
        !el.readOnly &&
        el.type !== 'password' &&
        el.type !== 'hidden' &&
        isElementVisible(el)
      ) {
        return el;
      }
    }
  }
  return null;
}

function findSearchButton(input: TrackingInputElement | null): HTMLElement | null {
  const form = input?.closest('form');
  const scope: ParentNode = form || input?.parentElement?.parentElement || document;

  const submitBtn = scope.querySelector(
    'button[type="submit"], input[type="submit"], button[id*="pesq" i], button[id*="busc" i], button[id*="cons" i], input[type="button"][value*="pesq" i], input[type="button"][value*="busc" i], input[type="button"][value*="cons" i]'
  );
  if (submitBtn instanceof HTMLElement && isElementVisible(submitBtn)) {
    return submitBtn;
  }

  const candidates = Array.from(
    document.querySelectorAll('button, input[type="button"], a[role="button"], a.btn')
  );
  for (const el of candidates) {
    if (!(el instanceof HTMLElement) || !isElementVisible(el)) continue;
    const rawText = [
      el.innerText,
      el.textContent,
      el.getAttribute('title'),
      el.getAttribute('aria-label'),
      el.getAttribute('id'),
      el.getAttribute('name'),
      el.className,
      el instanceof HTMLInputElement ? el.value : '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toLowerCase();

    if (/(pesquisar|consultar|buscar|rastrear|enviar|localizar|search|lupa)/.test(rawText)) {
      return el;
    }
  }

  // Fallback: botão com ícone imediatamente próximo ao input
  const nearBtn = scope.querySelector('button, a.btn');
  if (nearBtn instanceof HTMLElement && isElementVisible(nearBtn)) {
    return nearBtn;
  }

  return null;
}

function triggerInputAndSearch(trackingCode: string): {
  inputFound: boolean;
  searchTriggered: boolean;
} {
  const input = findTrackingInput();
  if (!input) {
    return { inputFound: false, searchTriggered: false };
  }

  const proto =
    input instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(input, trackingCode);
  } else {
    input.value = trackingCode;
  }

  input.focus();
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  const button = findSearchButton(input);
  if (button) {
    button.click();
    return { inputFound: true, searchTriggered: true };
  }

  const form = input.closest('form');
  if (form) {
    form.requestSubmit ? form.requestSubmit() : form.submit();
    return { inputFound: true, searchTriggered: true };
  }

  // Fallback com Enter caso o SPA ouça keydown/keypress/keyup sem tag <form>
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })
  );
  input.dispatchEvent(
    new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })
  );
  input.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })
  );
  return { inputFound: true, searchTriggered: true };
}

/**
 * Localiza a guia ou linha "Postado" na tabela de histórico do SRO e encontra o botão/ícone "Det".
 */
function findPostadoTrigger(): HTMLElement | null {
  const docs = getAccessibleDocuments();

  for (const doc of docs) {
    // 1. Caso haja uma guia/aba explícita chamada "Postado" ou "Postagem (PO)"
    const tabCandidates = Array.from(
      doc.querySelectorAll('[role="tab"], .nav-link, .tab, .ui-tabs-anchor, a, button')
    );
    for (const el of tabCandidates) {
      if (!(el instanceof HTMLElement) || !isElementVisible(el)) continue;
      const label = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(?:postad[oa]|postagem\s*\(\s*po\s*\)|guia\s+postad[oa])$/i.test(label)) {
        return el;
      }
    }

    // 2. Na tabela clássica do SRO (Det | Data Hora | Local | Situação | Nº evt), localizar a linha "Postado"
    const rows = Array.from(doc.querySelectorAll('tr, [role="row"]'));
    for (const row of rows) {
      if (!(row instanceof HTMLElement) || !isElementVisible(row)) continue;
      const rowText = (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
      if (/aguardando\s+postagem/i.test(rowText)) continue;

      const cells = Array.from(row.querySelectorAll('td, th, [role="cell"]'));
      const isPostadoRow =
        cells.some((cell) => {
          const cellText = (cell.textContent || '').replace(/\s+/g, ' ').trim();
          return /^(?:postad[oa]|postagem\s*\(\s*po\s*\)|objeto\s+postad[oa])$/i.test(cellText);
        }) || /\bpostad[oa]\b/i.test(rowText);

      if (!isPostadoRow) continue;

      // Prioridade 1: ícone/link/botão clicável na primeira célula (coluna Det)
      const firstCell = cells[0];
      if (firstCell) {
        const detLink = firstCell.querySelector(
          'a, button, input[type="button"], input[type="image"], [onclick], [ng-click]'
        );
        if (detLink instanceof HTMLElement) return detLink;

        const detIcon = firstCell.querySelector('img, svg, i, span');
        if (detIcon instanceof HTMLElement) return detIcon;

        if (firstCell instanceof HTMLElement) return firstCell;
      }

      // Prioridade 2: qualquer link/botão clicável na linha
      const rowAction = row.querySelector(
        'a, button, input[type="button"], input[type="image"], [onclick], [ng-click], img'
      );
      if (rowAction instanceof HTMLElement) return rowAction;

      return row;
    }
  }

  return null;
}

function waitForInitialMount(trackingCode: string, timeoutMs: number): Promise<void> {
  const cleanCode = normalizeCodeUpper(trackingCode);
  const readyNow = () => {
    const { text } = collectCombinedContent();
    if (isLoginOrAuthScreen(text) || isObjectNotFoundText(text)) return true;
    if (hasPoDetailFields(text)) return true;
    if (text.toUpperCase().includes(cleanCode) && findPostadoTrigger() !== null) return true;
    if (findTrackingInput() !== null) return true;
    return false;
  };

  if (readyNow()) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = () => {
      if (done) return;
      done = true;
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
      resolve();
    };

    observer = new MutationObserver(() => {
      if (readyNow()) finish();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    poll = setInterval(() => {
      if (readyNow()) finish();
    }, 200);
    timer = setTimeout(finish, timeoutMs);
  });
}

function waitForSummaryOrPoDetail(
  trackingCode: string,
  timeoutMs: number
): Promise<{ settled: boolean }> {
  const cleanCode = normalizeCodeUpper(trackingCode);

  const isDomReady = () => {
    const { text } = collectCombinedContent();
    if (!text.trim()) return false;
    if (isLoginOrAuthScreen(text)) return true;
    if (isObjectNotFoundText(text)) return true;

    const loadingBusy = Boolean(
      document.querySelector('[aria-busy="true"], .loading, .spinner, mat-spinner')
    );
    if (loadingBusy) return false;

    if (hasPoDetailFields(text)) return true;
    if (text.toUpperCase().includes(cleanCode) && findPostadoTrigger() !== null) {
      return true;
    }
    return false;
  };

  if (isDomReady()) {
    return Promise.resolve({ settled: true });
  }

  return new Promise((resolve) => {
    let finished = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = (settled: boolean) => {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
      resolve({ settled });
    };

    observer = new MutationObserver(() => {
      if (isDomReady()) {
        setTimeout(() => finish(true), 150);
      }
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    poll = setInterval(() => {
      if (isDomReady()) {
        finish(true);
      }
    }, 250);

    timer = setTimeout(() => finish(false), timeoutMs);
  });
}

function waitForPoDetailDom(timeoutMs: number): Promise<boolean> {
  const readyNow = () => {
    const { text } = collectCombinedContent();
    if (isLoginOrAuthScreen(text)) return true;
    const loadingBusy = Boolean(
      document.querySelector('[aria-busy="true"], .loading, .spinner, mat-spinner')
    );
    if (loadingBusy) return false;
    return hasPoDetailFields(text);
  };

  if (readyNow()) return Promise.resolve(true);

  return new Promise((resolve) => {
    let finished = false;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      if (poll) clearInterval(poll);
      resolve(ok);
    };

    observer = new MutationObserver(() => {
      if (readyNow()) {
        setTimeout(() => finish(true), 150);
      }
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    poll = setInterval(() => {
      if (readyNow()) finish(true);
    }, 250);

    timer = setTimeout(() => finish(false), timeoutMs);
  });
}

async function handleExtractDom(msg: ExtractDomRequest): Promise<ExtractDomResponse> {
  if (window.location.origin !== SRO_INTRANET_ORIGIN) {
    return {
      ok: false,
      requestId: msg.requestId,
      trackingCode: msg.trackingCode,
      text: '',
      html: '',
      url: window.location.href,
      error: 'Aba não pertence ao domínio oficial do SRO Intranet.',
    };
  }

  const cleanCode = normalizeCodeUpper(msg.trackingCode);

  // Aguarda hidratação inicial caso a página seja SPA
  await waitForInitialMount(cleanCode, 2000);

  let combined = collectCombinedContent();

  if (isLoginOrAuthScreen(combined.text)) {
    return {
      ok: false,
      requestId: msg.requestId,
      trackingCode: cleanCode,
      authRequired: true,
      text: combined.text,
      html: '',
      url: window.location.href,
    };
  }

  let inputFound = false;
  let searchTriggered = false;
  let postadoRowFound = false;
  let postadoDetailTriggered = false;

  const hasTableOrDetailNow =
    hasPoDetailFields(combined.text) ||
    (combined.text.toUpperCase().includes(cleanCode) && findPostadoTrigger() !== null);

  if (!hasTableOrDetailNow && !isObjectNotFoundText(combined.text)) {
    const triggerRes = triggerInputAndSearch(cleanCode);
    inputFound = triggerRes.inputFound;
    searchTriggered = triggerRes.searchTriggered;

    await waitForSummaryOrPoDetail(cleanCode, searchTriggered ? 6500 : 800);
    combined = collectCombinedContent();
  }

  // Se exibiu a tabela de histórico com a linha "Postado" mas os detalhes do PO ainda estão fechados, clicar no ícone Det / guia Postado
  if (
    !isLoginOrAuthScreen(combined.text) &&
    !isObjectNotFoundText(combined.text) &&
    !hasPoDetailFields(combined.text)
  ) {
    const postadoTrigger = findPostadoTrigger();
    if (postadoTrigger) {
      postadoRowFound = true;
      postadoTrigger.click();
      postadoDetailTriggered = true;
      await waitForPoDetailDom(4000);
      combined = collectCombinedContent();
    }
  }

  const text = combined.text;
  const html = combined.html;
  const authRequired = isLoginOrAuthScreen(text);
  const notFound = isObjectNotFoundText(text);
  const hasTrackingMatch = text.toUpperCase().includes(cleanCode);
  const hasPoDetail = hasPoDetailFields(text);

  return {
    ok: !authRequired,
    requestId: msg.requestId,
    trackingCode: cleanCode,
    authRequired,
    notFound,
    hasTrackingMatch,
    hasPostagemHint: hasPostagemHint(text),
    hasPoDetail,
    postadoRowFound,
    postadoDetailTriggered,
    inputFound,
    searchTriggered,
    text,
    html,
    url: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'SRO_EXTRACT_DOM') {
    return false;
  }

  void handleExtractDom(message as ExtractDomRequest)
    .then((res) => sendResponse(res))
    .catch((err: any) =>
      sendResponse({
        ok: false,
        requestId: message.requestId,
        trackingCode: message.trackingCode,
        text: '',
        html: '',
        url: window.location.href,
        error: err?.message || 'Erro ao ler DOM renderizado do SRO.',
      })
    );

  return true;
});
