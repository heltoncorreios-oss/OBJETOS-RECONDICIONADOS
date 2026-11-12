(() => {
  // extension/src/config.ts
  var OFFICIAL_APP_ORIGIN = "https://recondicionamentodeobjetos.vercel.app";
  var OFFICIAL_APP_URL_PREFIX = `${OFFICIAL_APP_ORIGIN}/`;
  var SRO_INTRANET_ORIGIN = "https://srointranet.correios.com.br";
  var SRO_INTRANET_BASE_URL = `${SRO_INTRANET_ORIGIN}/rastreamento`;

  // extension/src/sroContentScript.ts
  function isLoginOrAuthScreen(text) {
    const hasPasswordInput = Boolean(document.querySelector('input[type="password"]'));
    if (hasPasswordInput) return true;
    return /(?:acesso\s+restrito|fa[çc]a\s+login|autentica[çc][ãa]o\s+corporativa|idcorreios|cas\s+login|usu[áa]rio\s+e\s+senha|entre\s+com\s+sua\s+conta)/i.test(
      text
    );
  }
  function isObjectNotFoundText(text) {
    return /(?:objeto\s+n[ãa]o\s+encontrado|nenhum\s+objeto\s+encontrado|dados\s+n[ãa]o\s+encontrados\s+para\s+o\s+objeto|c[óo]digo\s+n[ãa]o\s+encontrado|n[ãa]o\s+possui\s+dados)/i.test(
      text
    );
  }
  function hasPostagemHint(text) {
    return /(?:\bpostagem\s*\(\s*PO\s*\)|evento\s*[:\-]?\s*PO\b|\bPO\s*[-–:]|\bobjeto\s+postad[oa]\b)/i.test(
      text
    );
  }
  function normalizeCodeUpper(code) {
    return (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function findTrackingInput() {
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
      'input[placeholder*="c\xF3digo" i]',
      'input[placeholder*="codigo" i]',
      "textarea",
      'form input[type="text"]',
      'input[type="search"]',
      'input[type="text"]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !el.disabled && !el.readOnly && el.type !== "password" && el.type !== "hidden") {
        return el;
      }
    }
    return null;
  }
  function findSearchButton(input) {
    const form = input?.closest("form");
    const scope = form || document;
    const submitBtn = scope.querySelector(
      'button[type="submit"], input[type="submit"], button[id*="pesq" i], button[id*="busc" i], button[id*="cons" i], input[type="button"][value*="pesq" i], input[type="button"][value*="busc" i], input[type="button"][value*="cons" i]'
    );
    if (submitBtn instanceof HTMLElement) {
      return submitBtn;
    }
    const candidates = Array.from(
      scope.querySelectorAll('button, input[type="button"], a[role="button"], a.btn')
    );
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const rawText = [
        el.innerText,
        el.textContent,
        el.getAttribute("title"),
        el.getAttribute("aria-label"),
        el instanceof HTMLInputElement ? el.value : ""
      ].filter(Boolean).join(" ").trim().toLowerCase();
      if (/(pesquisar|consultar|buscar|rastrear|enviar|localizar)/.test(rawText)) {
        return el;
      }
    }
    return null;
  }
  function triggerInputAndSearch(trackingCode) {
    const input = findTrackingInput();
    if (!input) {
      return { inputFound: false, searchTriggered: false };
    }
    const proto = input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(input, trackingCode);
    } else {
      input.value = trackingCode;
    }
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const button = findSearchButton(input);
    if (button) {
      button.click();
      return { inputFound: true, searchTriggered: true };
    }
    const form = input.closest("form");
    if (form) {
      form.requestSubmit ? form.requestSubmit() : form.submit();
      return { inputFound: true, searchTriggered: true };
    }
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true })
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true })
    );
    return { inputFound: true, searchTriggered: true };
  }
  function waitForInitialMount(trackingCode, timeoutMs) {
    const cleanCode = normalizeCodeUpper(trackingCode);
    const readyNow = () => {
      const text = document.body?.innerText || "";
      if (isLoginOrAuthScreen(text) || isObjectNotFoundText(text)) return true;
      if (text.toUpperCase().includes(cleanCode) && hasPostagemHint(text)) return true;
      if (findTrackingInput() !== null) return true;
      return false;
    };
    if (readyNow()) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      let observer = null;
      let timer = null;
      const finish = () => {
        if (done) return;
        done = true;
        observer?.disconnect();
        if (timer) clearTimeout(timer);
        resolve();
      };
      observer = new MutationObserver(() => {
        if (readyNow()) finish();
      });
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
      timer = setTimeout(finish, timeoutMs);
    });
  }
  function waitForRenderedSroDom(trackingCode, timeoutMs) {
    const cleanCode = normalizeCodeUpper(trackingCode);
    const isDomReady = () => {
      const text = document.body?.innerText || "";
      if (!text.trim()) return false;
      if (isLoginOrAuthScreen(text)) return true;
      if (isObjectNotFoundText(text)) return true;
      const upperText = text.toUpperCase();
      const loadingBusy = Boolean(
        document.querySelector('[aria-busy="true"], .loading, .spinner, mat-spinner')
      );
      if (loadingBusy) return false;
      if (upperText.includes(cleanCode) && (hasPostagemHint(text) || /remetente|destinat[áa]rio|peso/i.test(text))) {
        return true;
      }
      return false;
    };
    if (isDomReady()) {
      return Promise.resolve({ settled: true });
    }
    return new Promise((resolve) => {
      let finished = false;
      let observer = null;
      let timer = null;
      const finish = (settled) => {
        if (finished) return;
        finished = true;
        observer?.disconnect();
        if (timer) clearTimeout(timer);
        resolve({ settled });
      };
      observer = new MutationObserver(() => {
        if (isDomReady()) {
          setTimeout(() => finish(true), 200);
        }
      });
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
      timer = setTimeout(() => finish(false), timeoutMs);
    });
  }
  async function handleExtractDom(msg) {
    if (window.location.origin !== SRO_INTRANET_ORIGIN) {
      return {
        ok: false,
        requestId: msg.requestId,
        trackingCode: msg.trackingCode,
        text: "",
        html: "",
        url: window.location.href,
        error: "Aba n\xE3o pertence ao dom\xEDnio oficial do SRO Intranet."
      };
    }
    const cleanCode = normalizeCodeUpper(msg.trackingCode);
    await waitForInitialMount(cleanCode, 3e3);
    let text = document.body?.innerText || "";
    if (isLoginOrAuthScreen(text)) {
      return {
        ok: false,
        requestId: msg.requestId,
        trackingCode: cleanCode,
        authRequired: true,
        text,
        html: "",
        url: window.location.href
      };
    }
    let inputFound = false;
    let searchTriggered = false;
    const upperInitial = text.toUpperCase();
    const alreadyHasResults = upperInitial.includes(cleanCode) && (hasPostagemHint(text) || /remetente|destinat[áa]rio|peso/i.test(text));
    if (!alreadyHasResults && !isObjectNotFoundText(text)) {
      const triggerRes = triggerInputAndSearch(cleanCode);
      inputFound = triggerRes.inputFound;
      searchTriggered = triggerRes.searchTriggered;
    }
    await waitForRenderedSroDom(cleanCode, 7500);
    text = document.body?.innerText || "";
    const html = document.body?.innerHTML || "";
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
      inputFound,
      searchTriggered,
      text,
      html,
      url: window.location.href
    };
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "SRO_EXTRACT_DOM") {
      return false;
    }
    void handleExtractDom(message).then((res) => sendResponse(res)).catch(
      (err) => sendResponse({
        ok: false,
        requestId: message.requestId,
        trackingCode: message.trackingCode,
        text: "",
        html: "",
        url: window.location.href,
        error: err?.message || "Erro ao ler DOM renderizado do SRO."
      })
    );
    return true;
  });
})();
