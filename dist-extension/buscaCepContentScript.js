(() => {
  // extension/src/buscaCepContentScript.ts
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function cleanCepDigits(raw) {
    const digits = (raw || "").replace(/\D/g, "");
    return digits.length === 8 ? digits : "";
  }
  function isElementVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }
  function isAuthScreen(text) {
    if (document.querySelector('input[type="password"]')) return true;
    return /(?:acesso\s+restrito|fa[çc]a\s+login|autentica[çc][ãa]o\s+corporativa|idcorreios|cas\s+login|usu[áa]rio\s+e\s+senha)/i.test(
      text
    );
  }
  function hasVisibleCaptchaPrompt(text) {
    const captchaInputs = Array.from(
      document.querySelectorAll('input[name*="captcha" i], input[id*="captcha" i]')
    );
    if (captchaInputs.some((el) => isElementVisible(el))) {
      return true;
    }
    return /(?:captcha\s+inv[áa]lido|digite\s+o\s+texto\s+(?:da|contido\s+na)\s+imagem|caracteres\s+da\s+imagem)/i.test(
      text
    );
  }
  function isCepNotFoundText(text) {
    return /(?:dados\s+n[ãa]o\s+encontrados|n[ãa]o\s+h[áa]\s+dados\s+a\s+serem\s+exibidos|cep\s+n[ãa]o\s+encontrado)/i.test(
      text
    );
  }
  function getResultContainer() {
    const byId = document.querySelector("#resultado-DNEC, #resultado, table.tmptabela");
    if (byId instanceof HTMLElement) return byId;
    const tables = Array.from(document.querySelectorAll("table"));
    for (const tbl of tables) {
      const txt = (tbl.innerText || tbl.textContent || "").toLowerCase();
      if (txt.includes("logradouro") && (txt.includes("localidade") || txt.includes("cidade") || txt.includes("cep"))) {
        return tbl;
      }
    }
    return null;
  }
  function tableHasMatchingCep(expectedCep) {
    const container = getResultContainer();
    if (!container) return false;
    const formatted = `${expectedCep.slice(0, 5)}-${expectedCep.slice(5)}`;
    const rows = Array.from(container.querySelectorAll("tr"));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 3) continue;
      const rowText = cells.map((c) => (c.textContent || "").trim()).join(" | ");
      if (rowText.includes(formatted) || rowText.includes(expectedCep)) {
        return true;
      }
    }
    return false;
  }
  function tableHasAnyDataRows(container) {
    if (!container) return false;
    const rows = Array.from(container.querySelectorAll("tr"));
    return rows.some((row) => row.querySelectorAll("td").length >= 3);
  }
  function findCepInput() {
    const selectors = [
      "input#endereco",
      'input[name="endereco"]',
      'input[name*="cep" i]',
      'input[id*="cep" i]',
      'input[placeholder*="CEP" i]',
      'input[placeholder*="Endere" i]',
      'input[type="text"]',
      'input[type="search"]'
    ];
    for (const sel of selectors) {
      const candidates = Array.from(document.querySelectorAll(sel));
      for (const el of candidates) {
        if (!(el instanceof HTMLInputElement)) continue;
        if (el.disabled || el.type === "hidden" || el.type === "password") continue;
        const ident = `${el.id} ${el.name} ${el.placeholder}`.toLowerCase();
        if (ident.includes("captcha")) continue;
        if (isElementVisible(el)) return el;
      }
    }
    return null;
  }
  function findNewSearchButton() {
    const direct = document.querySelector("#btn_nbusca, #btn_nova_busca");
    if (isElementVisible(direct)) return direct;
    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a'));
    for (const btn of buttons) {
      if (!isElementVisible(btn)) continue;
      const label = (btn instanceof HTMLInputElement ? btn.value : btn.textContent || "").trim().toLowerCase();
      if (/(?:nova\s+busca|nova\s+consulta|voltar)/i.test(label)) {
        return btn;
      }
    }
    return null;
  }
  function setNativeInputValue(input, value) {
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (proto?.set) {
      proto.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function findSearchButton(form) {
    const scope = form || document;
    const direct = scope.querySelector('#btn_pesquisar, button[type="submit"], input[type="submit"]');
    if (isElementVisible(direct)) return direct;
    const buttons = Array.from(scope.querySelectorAll('button, input[type="button"], input[type="submit"]'));
    for (const btn of buttons) {
      if (!isElementVisible(btn)) continue;
      const label = (btn instanceof HTMLInputElement ? btn.value : btn.textContent || "").trim().toLowerCase();
      if (/(?:nova\s+busca|limpar)/i.test(label)) continue;
      if (/(?:buscar|pesquisar|consultar|enviar)/i.test(label)) {
        return btn;
      }
    }
    return null;
  }
  function collectOutputSnapshot() {
    const container = getResultContainer();
    const bodyHtml = document.body?.innerHTML || "";
    const bodyText = document.body?.innerText || "";
    return {
      html: container ? container.outerHTML : bodyHtml,
      text: container ? container.innerText || container.textContent || bodyText : bodyText
    };
  }
  async function handleBuscaCepExtract(request) {
    const cleanCep = cleanCepDigits(request.cep);
    const currentUrl = window.location.href;
    const initialText = document.body?.innerText || "";
    if (isAuthScreen(initialText)) {
      return {
        ok: false,
        requestId: request.requestId,
        cep: cleanCep,
        authRequired: true,
        html: "",
        text: initialText,
        url: currentUrl
      };
    }
    if (cleanCep && tableHasMatchingCep(cleanCep)) {
      const snap = collectOutputSnapshot();
      return {
        ok: true,
        requestId: request.requestId,
        cep: cleanCep,
        inputFound: true,
        searchTriggered: true,
        html: snap.html,
        text: snap.text,
        url: currentUrl
      };
    }
    let inputEl = findCepInput();
    if (!inputEl) {
      const newSearchBtn = findNewSearchButton();
      if (newSearchBtn) {
        newSearchBtn.click();
        const waitStart = Date.now();
        while (Date.now() - waitStart < 2500) {
          await sleep(120);
          inputEl = findCepInput();
          if (inputEl) break;
        }
      }
    }
    if (hasVisibleCaptchaPrompt(document.body?.innerText || "")) {
      const snap = collectOutputSnapshot();
      return {
        ok: false,
        requestId: request.requestId,
        cep: cleanCep,
        captchaRequired: true,
        html: snap.html,
        text: snap.text,
        url: currentUrl
      };
    }
    if (!inputEl) {
      const snap = collectOutputSnapshot();
      return {
        ok: false,
        requestId: request.requestId,
        cep: cleanCep,
        inputFound: false,
        searchTriggered: false,
        notFound: isCepNotFoundText(initialText),
        html: snap.html,
        text: snap.text,
        url: currentUrl,
        error: "Campo de entrada do Busca CEP Intranet n\xE3o localizado na tela."
      };
    }
    const prevContainer = getResultContainer();
    const prevTableText = prevContainer ? (prevContainer.innerText || "").trim() : "";
    const tipoCepSelect = document.querySelector('select#tipoCEP, select[name="tipoCEP"]');
    if (tipoCepSelect instanceof HTMLSelectElement) {
      const allOption = Array.from(tipoCepSelect.options).find(
        (o) => o.value === "ALL" || /todos/i.test(o.textContent || "")
      );
      if (allOption && tipoCepSelect.value !== allOption.value) {
        tipoCepSelect.value = allOption.value;
        tipoCepSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    inputEl.focus();
    setNativeInputValue(inputEl, cleanCep);
    const form = inputEl.form;
    const searchBtn = findSearchButton(form);
    let searchTriggered = false;
    if (searchBtn) {
      searchBtn.click();
      searchTriggered = true;
    } else if (form) {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.submit();
      }
      searchTriggered = true;
    }
    if (!searchTriggered) {
      const snap = collectOutputSnapshot();
      return {
        ok: false,
        requestId: request.requestId,
        cep: cleanCep,
        inputFound: true,
        searchTriggered: false,
        html: snap.html,
        text: snap.text,
        url: currentUrl,
        error: "Bot\xE3o de pesquisa do Busca CEP Intranet n\xE3o encontrado."
      };
    }
    const deadline = Date.now() + 5500;
    while (Date.now() < deadline) {
      await sleep(150);
      const bodyTextNow = document.body?.innerText || "";
      if (isAuthScreen(bodyTextNow)) {
        return {
          ok: false,
          requestId: request.requestId,
          cep: cleanCep,
          authRequired: true,
          inputFound: true,
          searchTriggered: true,
          html: "",
          text: bodyTextNow,
          url: window.location.href
        };
      }
      if (hasVisibleCaptchaPrompt(bodyTextNow)) {
        const snap = collectOutputSnapshot();
        return {
          ok: false,
          requestId: request.requestId,
          cep: cleanCep,
          captchaRequired: true,
          inputFound: true,
          searchTriggered: true,
          html: snap.html,
          text: snap.text,
          url: window.location.href
        };
      }
      if (tableHasMatchingCep(cleanCep)) {
        const snap = collectOutputSnapshot();
        return {
          ok: true,
          requestId: request.requestId,
          cep: cleanCep,
          inputFound: true,
          searchTriggered: true,
          html: snap.html,
          text: snap.text,
          url: window.location.href
        };
      }
      const containerNow = getResultContainer();
      const tableTextNow = containerNow ? (containerNow.innerText || "").trim() : "";
      if (containerNow && tableTextNow && tableTextNow !== prevTableText && tableHasAnyDataRows(containerNow)) {
        const snap = collectOutputSnapshot();
        return {
          ok: true,
          requestId: request.requestId,
          cep: cleanCep,
          inputFound: true,
          searchTriggered: true,
          html: snap.html,
          text: snap.text,
          url: window.location.href
        };
      }
      if (isCepNotFoundText(bodyTextNow)) {
        const snap = collectOutputSnapshot();
        return {
          ok: false,
          requestId: request.requestId,
          cep: cleanCep,
          notFound: true,
          inputFound: true,
          searchTriggered: true,
          html: snap.html,
          text: snap.text,
          url: window.location.href
        };
      }
    }
    const finalSnap = collectOutputSnapshot();
    return {
      ok: false,
      requestId: request.requestId,
      cep: cleanCep,
      inputFound: true,
      searchTriggered: true,
      notFound: isCepNotFoundText(finalSnap.text),
      html: finalSnap.html,
      text: finalSnap.text,
      url: window.location.href,
      error: "Tempo limite aguardando tabela de resultado do Busca CEP Intranet."
    };
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || message.type !== "BUSCA_CEP_EXTRACT_DOM") {
      return false;
    }
    handleBuscaCepExtract(message).then((res) => sendResponse(res)).catch((err) => {
      sendResponse({
        ok: false,
        requestId: message.requestId || "",
        cep: cleanCepDigits(message.cep || ""),
        html: "",
        text: "",
        url: window.location.href,
        error: err?.message || "Erro ao ler o DOM do Busca CEP Intranet."
      });
    });
    return true;
  });
})();
