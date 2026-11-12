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
    return /(?:\bpostagem\s*\(\s*PO\s*\)|evento\s*[:\-]?\s*PO\b|\bPO\s*[-–:]|\bobjeto\s+postad[oa]\b|\bpostad[oa]\b)/i.test(
      text
    );
  }
  function hasPoDetailFields(text) {
    if (!text) return false;
    const hasRemetente = /\bRemetente\b/i.test(text);
    const hasDestinatario = /\bDestinat[áa]rio\b/i.test(text);
    const hasMetric = /\b(?:Peso|VD|Valor\s+Declarado|CEP)\b/i.test(text);
    return hasRemetente && hasDestinatario && hasMetric;
  }
  function normalizeCodeUpper(code) {
    return (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function getAccessibleDocuments() {
    const docs = [];
    const frames = Array.from(document.querySelectorAll("iframe, frame"));
    for (const frame of frames) {
      try {
        const f = frame;
        const doc = f.contentDocument || f.contentWindow?.document;
        if (doc && doc.body && (doc.body.innerText || "").trim()) {
          docs.push(doc);
        }
      } catch {
      }
    }
    docs.push(document);
    return docs;
  }
  function collectCombinedContent() {
    const docs = getAccessibleDocuments();
    const texts = [];
    const htmls = [];
    for (const doc of docs) {
      const t = doc.body?.innerText || "";
      const h = doc.body?.innerHTML || "";
      if (t.trim()) texts.push(t);
      if (h.trim()) htmls.push(h);
    }
    return {
      text: texts.join("\n\n"),
      html: htmls.join("\n")
    };
  }
  function isElementVisible(el) {
    const win = el.ownerDocument?.defaultView || window;
    const style = win.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
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
      const matches = Array.from(document.querySelectorAll(selector));
      for (const el of matches) {
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !el.disabled && !el.readOnly && el.type !== "password" && el.type !== "hidden" && isElementVisible(el)) {
          return el;
        }
      }
    }
    return null;
  }
  function findSearchButton(input) {
    const form = input?.closest("form");
    const scope = form || input?.parentElement?.parentElement || document;
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
        el.getAttribute("title"),
        el.getAttribute("aria-label"),
        el.getAttribute("id"),
        el.getAttribute("name"),
        el.className,
        el instanceof HTMLInputElement ? el.value : ""
      ].filter(Boolean).join(" ").trim().toLowerCase();
      if (/(pesquisar|consultar|buscar|rastrear|enviar|localizar|search|lupa)/.test(rawText)) {
        return el;
      }
    }
    const nearBtn = scope.querySelector("button, a.btn");
    if (nearBtn instanceof HTMLElement && isElementVisible(nearBtn)) {
      return nearBtn;
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
      new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true })
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true })
    );
    return { inputFound: true, searchTriggered: true };
  }
  function findPostadoTrigger() {
    const docs = getAccessibleDocuments();
    for (const doc of docs) {
      const tabCandidates = Array.from(
        doc.querySelectorAll('[role="tab"], .nav-link, .tab, .ui-tabs-anchor, a, button')
      );
      for (const el of tabCandidates) {
        if (!(el instanceof HTMLElement) || !isElementVisible(el)) continue;
        const label = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        if (/^(?:postad[oa]|postagem\s*\(\s*po\s*\)|guia\s+postad[oa])$/i.test(label)) {
          return el;
        }
      }
      const rows = Array.from(doc.querySelectorAll('tr, [role="row"]'));
      for (const row of rows) {
        if (!(row instanceof HTMLElement) || !isElementVisible(row)) continue;
        const rowText = (row.innerText || row.textContent || "").replace(/\s+/g, " ").trim();
        if (/aguardando\s+postagem/i.test(rowText)) continue;
        const cells = Array.from(row.querySelectorAll('td, th, [role="cell"]'));
        const isPostadoRow = cells.some((cell) => {
          const cellText = (cell.textContent || "").replace(/\s+/g, " ").trim();
          return /^(?:postad[oa]|postagem\s*\(\s*po\s*\)|objeto\s+postad[oa])$/i.test(cellText);
        }) || /\bpostad[oa]\b/i.test(rowText);
        if (!isPostadoRow) continue;
        const firstCell = cells[0];
        if (firstCell) {
          const detLink = firstCell.querySelector(
            'a, button, input[type="button"], input[type="image"], [onclick], [ng-click]'
          );
          if (detLink instanceof HTMLElement) return detLink;
          const detIcon = firstCell.querySelector("img, svg, i, span");
          if (detIcon instanceof HTMLElement) return detIcon;
          if (firstCell instanceof HTMLElement) return firstCell;
        }
        const rowAction = row.querySelector(
          'a, button, input[type="button"], input[type="image"], [onclick], [ng-click], img'
        );
        if (rowAction instanceof HTMLElement) return rowAction;
        return row;
      }
    }
    return null;
  }
  function waitForInitialMount(trackingCode, timeoutMs) {
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
      let observer = null;
      let timer = null;
      let poll = null;
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
  function waitForSummaryOrPoDetail(trackingCode, timeoutMs) {
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
      let observer = null;
      let timer = null;
      let poll = null;
      const finish = (settled) => {
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
          characterData: true
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
  function waitForPoDetailDom(timeoutMs) {
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
      let observer = null;
      let timer = null;
      let poll = null;
      const finish = (ok) => {
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
          characterData: true
        });
      }
      poll = setInterval(() => {
        if (readyNow()) finish(true);
      }, 250);
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
    await waitForInitialMount(cleanCode, 2e3);
    let combined = collectCombinedContent();
    if (isLoginOrAuthScreen(combined.text)) {
      return {
        ok: false,
        requestId: msg.requestId,
        trackingCode: cleanCode,
        authRequired: true,
        text: combined.text,
        html: "",
        url: window.location.href
      };
    }
    let inputFound = false;
    let searchTriggered = false;
    let postadoRowFound = false;
    let postadoDetailTriggered = false;
    const hasTableOrDetailNow = hasPoDetailFields(combined.text) || combined.text.toUpperCase().includes(cleanCode) && findPostadoTrigger() !== null;
    if (!hasTableOrDetailNow && !isObjectNotFoundText(combined.text)) {
      const triggerRes = triggerInputAndSearch(cleanCode);
      inputFound = triggerRes.inputFound;
      searchTriggered = triggerRes.searchTriggered;
      await waitForSummaryOrPoDetail(cleanCode, searchTriggered ? 6500 : 800);
      combined = collectCombinedContent();
    }
    if (!isLoginOrAuthScreen(combined.text) && !isObjectNotFoundText(combined.text) && !hasPoDetailFields(combined.text)) {
      const postadoTrigger = findPostadoTrigger();
      if (postadoTrigger) {
        postadoRowFound = true;
        postadoTrigger.click();
        postadoDetailTriggered = true;
        await waitForPoDetailDom(4e3);
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
