/**
 * Content Script executado exclusivamente na aba autenticada do SRO Intranet
 * (https://srointranet.correios.com.br/*).
 *
 * Princípios:
 * - Lê apenas o DOM efetivamente renderizado após carregamento da consulta.
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
  return /(?:objeto\s+n[ãa]o\s+encontrado|nenhum\s+objeto\s+encontrado|dados\s+n[ãa]o\s+encontrados\s+para\s+o\s+objeto|c[óo]digo\s+n[ãa]o\s+encontrado)/i.test(
    text
  );
}

function hasPostagemHint(text: string): boolean {
  return /(?:\bpostagem\s*\(\s*PO\s*\)|evento\s*[:\-]?\s*PO\b|\bPO\s*[-–:]|\bobjeto\s+postad[oa]\b)/i.test(
    text
  );
}

function normalizeCodeUpper(code: string): string {
  return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function findTrackingInput(): HTMLInputElement | null {
  const selectors = [
    'input[name*="objeto" i]',
    'input[id*="objeto" i]',
    'input[name*="rastre" i]',
    'input[id*="rastre" i]',
    'input[placeholder*="objeto" i]',
    'input[placeholder*="rastre" i]',
    'input[placeholder*="código" i]',
    'input[placeholder*="codigo" i]',
    'form input[type="text"]',
    'input[type="search"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLInputElement && !el.disabled && !el.readOnly) {
      return el;
    }
  }
  return null;
}

function findSearchButton(input: HTMLInputElement | null): HTMLElement | null {
  const form = input?.closest('form');
  const scope: ParentNode = form || document;

  const submitBtn = scope.querySelector(
    'button[type="submit"], input[type="submit"], button[id*="pesq" i], button[id*="busc" i], button[id*="cons" i]'
  );
  if (submitBtn instanceof HTMLElement) {
    return submitBtn;
  }

  const buttons = Array.from(scope.querySelectorAll('button'));
  for (const btn of buttons) {
    const label = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    if (/pesquisar|consultar|buscar|rastrear|enviar/.test(label)) {
      return btn;
    }
  }

  return null;
}

function triggerInputAndSearch(trackingCode: string): boolean {
  const input = findTrackingInput();
  if (!input) return false;

  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(input, trackingCode);
  } else {
    input.value = trackingCode;
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  const button = findSearchButton(input);
  if (button) {
    button.click();
    return true;
  }

  const form = input.closest('form');
  if (form) {
    form.requestSubmit ? form.requestSubmit() : form.submit();
    return true;
  }

  return false;
}

function waitForRenderedSroDom(
  trackingCode: string,
  timeoutMs: number
): Promise<{ settled: boolean }> {
  const cleanCode = normalizeCodeUpper(trackingCode);

  const isDomReady = () => {
    const text = document.body?.innerText || '';
    if (!text.trim()) return false;
    if (isLoginOrAuthScreen(text)) return true;
    if (isObjectNotFoundText(text)) return true;

    const upperText = text.toUpperCase();
    if (upperText.includes(cleanCode)) {
      // Aguarda um evento visível ou indicador de carregamento concluir
      const loadingBusy = Boolean(
        document.querySelector('[aria-busy="true"], .loading, .spinner, mat-spinner')
      );
      if (!loadingBusy) return true;
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

    const finish = (settled: boolean) => {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      if (timer) clearTimeout(timer);
      resolve({ settled });
    };

    observer = new MutationObserver(() => {
      if (isDomReady()) {
        // Pequeno respiro para garantir finalização da renderização do frame atual
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
  let text = document.body?.innerText || '';

  if (isLoginOrAuthScreen(text)) {
    return {
      ok: false,
      requestId: msg.requestId,
      trackingCode: cleanCode,
      authRequired: true,
      text,
      html: '',
      url: window.location.href,
    };
  }

  // Se o código ainda não apareceu renderizado na página, tenta submeter o campo de consulta do SPA/formulário
  const upperInitial = text.toUpperCase();
  if (!upperInitial.includes(cleanCode) && !isObjectNotFoundText(text)) {
    triggerInputAndSearch(cleanCode);
  }

  await waitForRenderedSroDom(cleanCode, 7500);

  text = document.body?.innerText || '';
  const html = document.body?.innerHTML || '';
  const authRequired = isLoginOrAuthScreen(text);
  const notFound = isObjectNotFoundText(text);
  const hasTrackingMatch = text.toUpperCase().includes(cleanCode);

  return {
    ok: !authRequired,
    requestId: msg.requestId,
    trackingCode: cleanCode,
    authRequired,
    notFound,
    hasTrackingMatch,
    hasPostagemHint: hasPostagemHint(text),
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
