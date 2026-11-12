// src/services/sroParser.ts
var TRACKING_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
function normalizeTrackingCode(code) {
  return (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function isValidTrackingCode(code) {
  const clean = normalizeTrackingCode(code);
  return TRACKING_REGEX.test(clean);
}
function normalizeCepDigits(cep) {
  if (!cep) return "";
  const digits = cep.replace(/\D/g, "");
  return digits.length === 8 ? digits : "";
}
function parseWeightToGrams(rawWeight) {
  if (rawWeight === null || rawWeight === void 0) return null;
  if (typeof rawWeight === "number") {
    if (!Number.isFinite(rawWeight) || rawWeight <= 0) return null;
    return Math.round(rawWeight);
  }
  const trimmed = rawWeight.trim();
  if (!trimmed || /^[-–—]+$/.test(trimmed) || /n[ãa]o informado/i.test(trimmed)) {
    return null;
  }
  const hasGramsUnit = /\b(g|gs|gr|grama|gramas)\b/i.test(trimmed) && !/\bkg\b/i.test(trimmed);
  const hasKgUnit = /\b(kg|kgs|quilo|quilos|kilograma|kilogramas)\b/i.test(trimmed);
  const numMatch = trimmed.match(/(\d+(?:[.,]\d+)?)/);
  if (!numMatch) return null;
  const numStr = numMatch[1];
  if (hasGramsUnit) {
    const cleanNum = parseFloat(numStr.replace(",", "."));
    return Number.isFinite(cleanNum) && cleanNum > 0 ? Math.round(cleanNum) : null;
  }
  if (hasKgUnit) {
    const cleanNum = parseFloat(numStr.replace(",", "."));
    return Number.isFinite(cleanNum) && cleanNum > 0 ? Math.round(cleanNum * 1e3) : null;
  }
  if (/[.,]\d{1,3}$/.test(numStr)) {
    const cleanNum = parseFloat(numStr.replace(",", "."));
    return Number.isFinite(cleanNum) && cleanNum > 0 ? Math.round(cleanNum * 1e3) : null;
  }
  const intVal = parseInt(numStr, 10);
  return Number.isFinite(intVal) && intVal > 0 ? intVal : null;
}
function parseValorDeclarado(rawVd) {
  if (!rawVd) return "";
  const cleaned = rawVd.trim().toUpperCase();
  if (!cleaned || /^[-–—]+$/.test(cleaned)) return "";
  if (cleaned === "S" || cleaned === "SIM" || /\bVD\s*[:=]?\s*S\b/i.test(cleaned)) {
    return "SIM";
  }
  if (cleaned === "N" || cleaned === "NAO" || cleaned === "N\xC3O" || /\bVD\s*[:=]?\s*N\b/i.test(cleaned)) {
    return "N\xC3O";
  }
  const moneyMatch = cleaned.match(/R\$\s*(\d+(?:[.,]\d+)?)/i);
  if (moneyMatch) {
    const val = parseFloat(moneyMatch[1].replace(".", "").replace(",", "."));
    if (Number.isFinite(val)) {
      return val > 0 ? "SIM" : "N\xC3O";
    }
  }
  return "";
}
function decodeHtmlEntities(text) {
  const entities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&aacute;": "\xE1",
    "&Aacute;": "\xC1",
    "&agrave;": "\xE0",
    "&Agrave;": "\xC0",
    "&acirc;": "\xE2",
    "&Acirc;": "\xC2",
    "&atilde;": "\xE3",
    "&Atilde;": "\xC3",
    "&eacute;": "\xE9",
    "&Eacute;": "\xC9",
    "&ecirc;": "\xEA",
    "&Ecirc;": "\xCA",
    "&iacute;": "\xED",
    "&Iacute;": "\xCD",
    "&oacute;": "\xF3",
    "&Oacute;": "\xD3",
    "&ocirc;": "\xF4",
    "&Ocirc;": "\xD4",
    "&otilde;": "\xF5",
    "&Otilde;": "\xD5",
    "&uacute;": "\xFA",
    "&Uacute;": "\xDA",
    "&uuml;": "\xFC",
    "&Uuml;": "\xDC",
    "&ccedil;": "\xE7",
    "&Ccedil;": "\xC7",
    "&ordm;": "\xBA",
    "&ordf;": "\xAA"
  };
  let out = text;
  for (const [ent, char] of Object.entries(entities)) {
    out = out.split(ent).join(char);
  }
  return out.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}
function htmlToReadableText(raw) {
  if (!raw) return "";
  let text = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/\splaceholder=["'][^"']*["']/gi, " ");
  text = text.replace(/<input[^>]*value=["']([^"']*)["'][^>]*>/gi, " $1 ");
  text = text.replace(/<(br|\/tr|\/div|\/p|\/li|\/h[1-6]|\/section)\b[^>]*>/gi, "\n").replace(/<(td|th)\b[^>]*>/gi, " ").replace(/<\/(td|th)>/gi, " | ").replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  return text.replace(/[ \t]+/g, " ").replace(/\r\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function hasPoDetailSignals(text) {
  const hasRemAndDest = /\bRemetente\b/i.test(text) && /\bDestinat[áa]rio\b/i.test(text);
  const hasDetailMetric = /\b(?:Peso|VD|Valor\s+Declarado|CEP)\b/i.test(text);
  return hasRemAndDest && hasDetailMetric;
}
function isolatePostagemSection(fullText) {
  const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
  const poStartRegex = /(?:\bpostagem\s*\(\s*PO\s*\)|evento\s*[:\-]?\s*PO\b|\bPO\s*[-–:]\s*(?:objeto\s+)?postad[oa]|\bobjeto\s+postad[oa]\b|\btipo\s*[:\-]?\s*PO\b|situa[çc][ãa]o\s*[:=|]\s*postad[oa]\b|detalhe(?:s)?\s+(?:do\s+)?evento\b.*\bpostad[oa]\b|^\s*postad[oa]\s*(?:\(\s*PO\s*\))?\s*$)/i;
  const explicitOtherEventRegex = /(?:^(?:BDE|BDI|BDR|BLQ|CAR|CD|CMT|CO|CUN|DO|EST|FC|IDC|LDI|OEC|PAR|PMT|RO|TR)\s*[-–:]|\b(?:Entregue|Saiu para entrega|Objeto encaminhado|Objeto recebido|Objeto em transfer[êe]ncia|Aguardando retirada|Objeto\/unitizador expedido|Objeto\/unitizador desembarcado|Objeto\/unitizador embarcado|Passagem interna|Etiqueta emitida|Aguardando postagem)\b)/i;
  const candidateIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (poStartRegex.test(line) && !/aguardando\s+postagem/i.test(line)) {
      candidateIndices.push(i);
    }
  }
  if (candidateIndices.length === 0) {
    if (hasPoDetailSignals(fullText) && /\b(?:Postado|Postagem|\bPO\b)\b/i.test(fullText)) {
      return lines.join("\n");
    }
    return null;
  }
  let bestBlock = "";
  for (const startIdx of candidateIndices) {
    const collected = [];
    let sawRemDest = false;
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      if (i > startIdx) {
        if (explicitOtherEventRegex.test(line) && !poStartRegex.test(line)) {
          break;
        }
        if (sawRemDest && /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(line)) {
          break;
        }
      }
      collected.push(line);
      const joinedNow = collected.join("\n");
      if (/\bRemetente\b/i.test(joinedNow) && /\bDestinat[áa]rio\b/i.test(joinedNow)) {
        sawRemDest = true;
      }
    }
    const candidateText = collected.join("\n");
    if (hasPoDetailSignals(candidateText)) {
      return candidateText;
    }
    if (!bestBlock && /\b(?:Peso|VD|Valor\s+Declarado|CEP|Remetente|Destinat[áa]rio)\b/i.test(candidateText)) {
      bestBlock = candidateText;
    }
  }
  return bestBlock || null;
}
function cleanFieldValue(val) {
  if (!val) return "";
  const cleaned = val.replace(/^[\s:|]+/, "").replace(/[\s|]+$/, "").replace(/\s+/g, " ").trim();
  if (!cleaned || /^[-–—]+$/.test(cleaned) || /^(?:n[ãa]o informado|n\/i|indispon[ií]vel)$/i.test(cleaned)) {
    return "";
  }
  return cleaned;
}
function extractFirstMatch(text, patterns) {
  for (const regex of patterns) {
    const m = text.match(regex);
    if (m && m[1]) {
      const val = cleanFieldValue(m[1]);
      if (val) return val;
    }
  }
  return "";
}
function parseSroContent(rawInput, expectedTrackingCode) {
  const expectedClean = expectedTrackingCode ? normalizeTrackingCode(expectedTrackingCode) : "";
  if (expectedClean && !isValidTrackingCode(expectedClean) && expectedClean.length < 9) {
    return {
      ok: false,
      errorCode: "INVALID_CODE",
      message: "C\xF3digo de rastreamento inv\xE1lido para consulta."
    };
  }
  if (typeof rawInput === "object" && rawInput !== null) {
    const code = normalizeTrackingCode(rawInput.codigoRastreamento || expectedClean);
    if (expectedClean && code && code !== expectedClean) {
      return {
        ok: false,
        errorCode: "OBJECT_NOT_FOUND",
        message: "Os dados retornados pertencem a outro c\xF3digo de rastreamento e foram descartados."
      };
    }
    if (!rawInput.eventoEncontrado) {
      return {
        ok: false,
        errorCode: "PO_EVENT_NOT_FOUND",
        message: "Evento Postagem (PO) n\xE3o localizado para este objeto no SRO."
      };
    }
    return {
      ok: true,
      data: {
        codigoRastreamento: code,
        eventoEncontrado: true,
        pesoGramas: parseWeightToGrams(rawInput.pesoGramas),
        valorDeclarado: parseValorDeclarado(rawInput.valorDeclarado),
        unidadePostagem: (rawInput.unidadePostagem || "").trim().toUpperCase(),
        remetenteNome: (rawInput.remetenteNome || "").trim().toUpperCase(),
        cepRemetente: normalizeCepDigits(rawInput.cepRemetente),
        numeroRemetente: cleanFieldValue(rawInput.numeroRemetente),
        destinatarioNome: (rawInput.destinatarioNome || "").trim().toUpperCase(),
        cepDestinatario: normalizeCepDigits(rawInput.cepDestinatario),
        numeroDestinatario: cleanFieldValue(rawInput.numeroDestinatario)
      }
    };
  }
  const rawText = typeof rawInput === "string" ? rawInput : "";
  if (!rawText.trim()) {
    return {
      ok: false,
      errorCode: "PARSE_ERROR",
      message: "Nenhum conte\xFAdo retornado pelo SRO para an\xE1lise."
    };
  }
  if (rawText.trim().startsWith("{")) {
    try {
      const parsedJson = JSON.parse(rawText);
      if (parsedJson && typeof parsedJson === "object") {
        if (parsedJson.errorCode) {
          return {
            ok: false,
            errorCode: parsedJson.errorCode,
            message: parsedJson.message || "Erro ao consultar o SRO."
          };
        }
        return parseSroContent(parsedJson, expectedTrackingCode);
      }
    } catch {
    }
  }
  const readable = /<[a-z][\s\S]*>/i.test(rawText) ? htmlToReadableText(rawText) : rawText;
  if (/(?:acesso\s+restrito|fa[çc]a\s+login|autentica[çc][ãa]o\s+corporativa|idcorreios|cas\s+login|usu[áa]rio\s+e\s+senha)/i.test(
    readable
  )) {
    return {
      ok: false,
      errorCode: "AUTH_REQUIRED",
      message: "O SRO Intranet exige sess\xE3o corporativa autenticada no navegador do usu\xE1rio."
    };
  }
  if (/(?:objeto\s+n[ãa]o\s+encontrado|nenhum\s+objeto\s+encontrado|dados\s+n[ãa]o\s+encontrados\s+para\s+o\s+objeto|c[óo]digo\s+n[ãa]o\s+encontrado)/i.test(
    readable
  )) {
    return {
      ok: false,
      errorCode: "OBJECT_NOT_FOUND",
      message: "Objeto n\xE3o encontrado no SRO dos Correios."
    };
  }
  if (expectedClean) {
    const IGNORED_PLACEHOLDER_CODES = /* @__PURE__ */ new Set([
      "SS123456789BR",
      "AA123456789BR",
      "BR123456789BR",
      "XX123456789BR"
    ]);
    const rawFoundCodes = readable.toUpperCase().match(/\b[A-Z]{2}\d{9}[A-Z]{2}\b/g) || [];
    const foundCodes = rawFoundCodes.filter((c) => !IGNORED_PLACEHOLDER_CODES.has(c));
    if (foundCodes.length > 0 && !foundCodes.includes(expectedClean)) {
      return {
        ok: false,
        errorCode: "OBJECT_NOT_FOUND",
        message: `O conte\xFAdo informado refere-se ao objeto ${foundCodes[0]}, diferente do c\xF3digo ${expectedClean}.`
      };
    }
  }
  const poSection = isolatePostagemSection(readable);
  if (!poSection) {
    return {
      ok: false,
      errorCode: "PO_EVENT_NOT_FOUND",
      message: "Evento Postagem (PO) n\xE3o localizado no hist\xF3rico retornado pelo SRO."
    };
  }
  const remIndex = poSection.search(/\bRemetente\b/i);
  const destIndex = poSection.search(/\bDestinat[áa]rio\b/i);
  let remBlock = poSection;
  let destBlock = poSection;
  if (remIndex >= 0 && destIndex >= 0) {
    if (remIndex < destIndex) {
      remBlock = poSection.slice(remIndex, destIndex);
      destBlock = poSection.slice(destIndex);
    } else {
      destBlock = poSection.slice(destIndex, remIndex);
      remBlock = poSection.slice(remIndex);
    }
  } else if (remIndex >= 0) {
    remBlock = poSection.slice(remIndex);
  } else if (destIndex >= 0) {
    destBlock = poSection.slice(destIndex);
  }
  const rawPeso = extractFirstMatch(poSection, [
    /Peso(?:\s+Informado|\s+Tarifado|\s*\(\s*kg\s*\)|\s*\(\s*g\s*\))?[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i,
    /\b(\d+[.,]\d{1,3}\s*kg)\b/i,
    /\b(\d+\s*(?:g|gs))\b/i
  ]);
  const pesoGramas = parseWeightToGrams(rawPeso);
  const rawVd = extractFirstMatch(poSection, [
    /(?:Indicador\s+)?VD[ \t]*(?:[:=|]+[ \t]*)+([A-Za-zÃã]+)\b/i,
    /Valor\s+Declarado(?:\s*\(\s*VD\s*\))?[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i
  ]);
  const valorDeclarado = parseValorDeclarado(rawVd);
  const unidadePostagem = extractFirstMatch(poSection, [
    /Unidade(?:\s+(?:de\s+Postagem|Origem))?[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i,
    /Local(?:\s+de\s+Postagem)?[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i
  ]).toUpperCase();
  const remetenteNome = (extractFirstMatch(poSection, [
    /(?:Nome\s+(?:do\s+)?)?Remetente[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i
  ]) || (remIndex >= 0 ? extractFirstMatch(remBlock, [
    /Nome(?:\s+Completo)?[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i
  ]) : "")).toUpperCase();
  const rawCepRem = extractFirstMatch(poSection, [
    /CEP\s+(?:do\s+)?Remetente[ \t]*(?:[:=|]+[ \t]*)+([0-9.\-]+)/i
  ]) || (remIndex >= 0 ? extractFirstMatch(remBlock, [/CEP[ \t]*(?:[:=|]+[ \t]*)+([0-9.\-]+)/i]) : "");
  const cepRemetente = normalizeCepDigits(rawCepRem);
  const numeroRemetente = extractFirstMatch(poSection, [
    /N[úu]mero\s+(?:Logradouro\s+)?(?:do\s+)?Remetente[ \t]*(?:[:=|]+[ \t]*)+([^\n,;|]+)/i
  ]) || (remIndex >= 0 ? extractFirstMatch(remBlock, [
    /N[úu]mero\s+Logradouro[ \t]*(?:[:=|]+[ \t]*)+([^\n,;|]+)/i,
    /N[úu]mero[ \t]*(?:[:=|]+[ \t]*)+([^\n,;|]+)/i,
    /(?:N[º°]|Nro|Nr\.?)[ \t]*(?:[:=|]+[ \t]*)*([^\n,;|]+)/i
  ]) : "");
  const destinatarioNome = (extractFirstMatch(poSection, [
    /(?:Nome\s+(?:do\s+)?)?Destinat[áa]rio[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i
  ]) || (destIndex >= 0 ? extractFirstMatch(destBlock, [
    /Nome(?:\s+Completo)?[ \t]*(?:[:=|]+[ \t]*)+([^\n|;]+)/i
  ]) : "")).toUpperCase();
  const rawCepDest = extractFirstMatch(poSection, [
    /CEP\s+(?:do\s+)?Destinat[áa]rio[ \t]*(?:[:=|]+[ \t]*)+([0-9.\-]+)/i
  ]) || (destIndex >= 0 ? extractFirstMatch(destBlock, [/CEP[ \t]*(?:[:=|]+[ \t]*)+([0-9.\-]+)/i]) : "");
  const cepDestinatario = normalizeCepDigits(rawCepDest);
  const numeroDestinatario = extractFirstMatch(poSection, [
    /N[úu]mero\s+(?:Logradouro\s+)?(?:do\s+)?Destinat[áa]rio[ \t]*(?:[:=|]+[ \t]*)+([^\n,;|]+)/i
  ]) || (destIndex >= 0 ? extractFirstMatch(destBlock, [
    /N[úu]mero\s+Logradouro[ \t]*(?:[:=|]+[ \t]*)+([^\n,;|]+)/i,
    /N[úu]mero[ \t]*(?:[:=|]+[ \t]*)+([^\n,;|]+)/i,
    /(?:N[º°]|Nro|Nr\.?)[ \t]*(?:[:=|]+[ \t]*)*([^\n,;|]+)/i
  ]) : "");
  const hasAnyPoData = pesoGramas !== null || Boolean(valorDeclarado) || Boolean(cepRemetente) || Boolean(cepDestinatario) || Boolean(remetenteNome) || Boolean(destinatarioNome);
  if (!hasAnyPoData) {
    return {
      ok: false,
      errorCode: "PO_EVENT_NOT_FOUND",
      message: 'A linha "Postado" foi localizada no SRO, mas os detalhes da Postagem (PO) (Peso, VD, Remetente/Destinat\xE1rio e CEPs) n\xE3o estavam abertos na tela.'
    };
  }
  return {
    ok: true,
    data: {
      codigoRastreamento: expectedClean,
      eventoEncontrado: true,
      pesoGramas,
      valorDeclarado,
      unidadePostagem,
      remetenteNome,
      cepRemetente,
      numeroRemetente,
      destinatarioNome,
      cepDestinatario,
      numeroDestinatario
    }
  };
}

// extension/src/config.ts
var OFFICIAL_APP_ORIGIN = "https://recondicionamentodeobjetos.vercel.app";
var OFFICIAL_APP_URL_PREFIX = `${OFFICIAL_APP_ORIGIN}/`;
var SRO_INTRANET_ORIGIN = "https://srointranet.correios.com.br";
var SRO_INTRANET_BASE_URL = `${SRO_INTRANET_ORIGIN}/rastreamento`;
var EXTENSION_VERSION = "1.0.0";
var EXTENSION_QUERY_TIMEOUT_MS = 2e4;
var EXTENSION_TAB_LOAD_TIMEOUT_MS = 12e3;

// extension/src/background.ts
var MANAGED_TAB_STORAGE_KEY = "sroManagedTabId";
var activeQuery = null;
var cachedManagedTabId = null;
function isTrustedAppSender(sender) {
  if (!sender) return false;
  if (sender.frameId !== void 0 && sender.frameId !== 0) return false;
  const senderOrigin = sender.origin || "";
  const tabUrl = sender.tab?.url || "";
  return senderOrigin === OFFICIAL_APP_ORIGIN && tabUrl.startsWith(OFFICIAL_APP_URL_PREFIX);
}
async function getSavedManagedTabId() {
  if (cachedManagedTabId !== null) return cachedManagedTabId;
  try {
    const area = chrome.storage.session || chrome.storage.local;
    const result = await area.get(MANAGED_TAB_STORAGE_KEY);
    const tabId = result?.[MANAGED_TAB_STORAGE_KEY];
    if (typeof tabId === "number") {
      cachedManagedTabId = tabId;
      return tabId;
    }
  } catch {
  }
  return null;
}
async function saveManagedTabId(tabId) {
  cachedManagedTabId = tabId;
  try {
    const area = chrome.storage.session || chrome.storage.local;
    await area.set({ [MANAGED_TAB_STORAGE_KEY]: tabId });
  } catch {
  }
}
chrome.tabs.onRemoved.addListener((closedTabId) => {
  if (cachedManagedTabId === closedTabId) {
    void saveManagedTabId(null);
  }
});
async function acquireSingleSroTab(targetUrl) {
  const savedTabId = await getSavedManagedTabId();
  if (savedTabId !== null) {
    try {
      const existing = await chrome.tabs.get(savedTabId);
      if (existing && existing.id !== void 0) {
        return await chrome.tabs.update(existing.id, { url: targetUrl, active: false });
      }
    } catch {
      await saveManagedTabId(null);
    }
  }
  const sroTabs = await chrome.tabs.query({ url: `${SRO_INTRANET_ORIGIN}/*` });
  if (sroTabs.length > 0 && sroTabs[0].id !== void 0) {
    const reused = sroTabs[0];
    await saveManagedTabId(reused.id);
    return await chrome.tabs.update(reused.id, { url: targetUrl, active: false });
  }
  const created = await chrome.tabs.create({ url: targetUrl, active: false });
  if (created.id !== void 0) {
    await saveManagedTabId(created.id);
  }
  return created;
}
function isLikelyExternalSsoRedirect(url) {
  if (!url) return false;
  if (url.startsWith(`${SRO_INTRANET_ORIGIN}/`)) {
    return /\/(?:login|sso|auth|cas|signin)/i.test(url);
  }
  return url.startsWith("https://") && /(?:idcorreios|cas|sso|login|auth|adfs|acesso\.correios)/i.test(url);
}
async function waitForTabReady(tabId, queryState, timeoutMs, waitForFreshComplete = false) {
  try {
    const currentTab = await chrome.tabs.get(tabId);
    if (isLikelyExternalSsoRedirect(currentTab.url)) {
      return { ready: false, redirectedToAuth: true, finalUrl: currentTab.url };
    }
    if (!waitForFreshComplete && currentTab.status === "complete" && currentTab.url?.startsWith(`${SRO_INTRANET_ORIGIN}/`)) {
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
    const finish = (res) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(res);
    };
    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId !== tabId) return;
      if (queryState.cancelled) {
        finish({ ready: false, redirectedToAuth: false });
        return;
      }
      if (changeInfo.status === "loading") {
        sawLoading = true;
      }
      const currentUrl = changeInfo.url || tab.url;
      if (isLikelyExternalSsoRedirect(currentUrl)) {
        finish({ ready: false, redirectedToAuth: true, finalUrl: currentUrl });
        return;
      }
      if (changeInfo.status === "complete" && currentUrl?.startsWith(`${SRO_INTRANET_ORIGIN}/`)) {
        finish({ ready: true, redirectedToAuth: false, finalUrl: currentUrl });
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    const quickFallback = setTimeout(async () => {
      if (settled || !waitForFreshComplete || sawLoading) return;
      try {
        const tabNow = await chrome.tabs.get(tabId);
        if (tabNow.status === "complete" && tabNow.url?.startsWith(`${SRO_INTRANET_ORIGIN}/`)) {
          finish({ ready: true, redirectedToAuth: false, finalUrl: tabNow.url });
        }
      } catch {
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
async function sendExtractDomWithRetry(tabId, cleanCode, requestId, queryState) {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (queryState.cancelled) return null;
    try {
      return await chrome.tabs.sendMessage(tabId, {
        type: "SRO_EXTRACT_DOM",
        trackingCode: cleanCode,
        requestId
      });
    } catch (err) {
      const msg = String(err?.message || "");
      if (/message channel closed|back\/forward cache/i.test(msg)) {
        const reloadState = await waitForTabReady(tabId, queryState, 8e3, true);
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
async function executeSroQueryInner(cleanCode, requestId, queryState) {
  try {
    const targetUrl = `${SRO_INTRANET_BASE_URL}?objeto=${encodeURIComponent(cleanCode)}`;
    const tab = await acquireSingleSroTab(targetUrl);
    if (queryState.cancelled) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "CANCELLED",
        message: "Consulta cancelada por nova solicita\xE7\xE3o ou tempo limite."
      };
    }
    if (tab.id === void 0) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "INTRANET_UNREACHABLE",
        message: "N\xE3o foi poss\xEDvel abrir ou reutilizar a aba do SRO Intranet."
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
        errorCode: "CANCELLED",
        message: "Consulta cancelada."
      };
    }
    if (loadState.redirectedToAuth) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "AUTH_REQUIRED",
        message: "Sess\xE3o do SRO Intranet expirada ou n\xE3o autenticada. Fa\xE7a login na aba do SRO e tente novamente."
      };
    }
    if (!loadState.ready) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "INTRANET_UNREACHABLE",
        message: "Tempo esgotado ao carregar o SRO Intranet. Verifique a conex\xE3o na rede corporativa."
      };
    }
    const existingSroTabsBefore = await chrome.tabs.query({ url: `${SRO_INTRANET_ORIGIN}/*` }).catch(() => []);
    const existingIdsBefore = new Set(
      existingSroTabsBefore.map((t) => t.id).filter((id) => typeof id === "number")
    );
    let openedPopupTabId = null;
    const onPopupCreated = (newTab) => {
      if (newTab && typeof newTab.id === "number" && newTab.id !== tab.id && (newTab.openerTabId === tab.id || !existingIdsBefore.has(newTab.id))) {
        openedPopupTabId = newTab.id;
      }
    };
    chrome.tabs.onCreated?.addListener(onPopupCreated);
    let domRes;
    let usedPopupTabId = null;
    try {
      domRes = await sendExtractDomWithRetry(tab.id, cleanCode, requestId, queryState);
      if (domRes && !domRes.authRequired && !domRes.notFound && !domRes.hasPoDetail) {
        if (openedPopupTabId === null) {
          await new Promise((r) => setTimeout(r, 250));
          const tabsAfter = await chrome.tabs.query({ url: `${SRO_INTRANET_ORIGIN}/*` }).catch(() => []);
          const extraTab = tabsAfter.find(
            (t) => typeof t.id === "number" && !existingIdsBefore.has(t.id)
          );
          if (extraTab && typeof extraTab.id === "number") {
            openedPopupTabId = extraTab.id;
          }
        }
        if (openedPopupTabId !== null && !queryState.cancelled) {
          usedPopupTabId = openedPopupTabId;
          const popupLoad = await waitForTabReady(openedPopupTabId, queryState, 8e3, false);
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
        }
      }
    }
    if (queryState.cancelled) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "CANCELLED",
        message: "Consulta cancelada."
      };
    }
    if (!domRes) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "INTRANET_UNREACHABLE",
        message: "Sem resposta do leitor da aba do SRO Intranet."
      };
    }
    if (domRes.authRequired) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "AUTH_REQUIRED",
        message: "Sess\xE3o do SRO Intranet expirada. Autentique-se na aba do SRO e consulte novamente."
      };
    }
    const allowPopupDetailWithoutCode = usedPopupTabId !== null && Boolean(domRes.hasPoDetail);
    if (!domRes.notFound && !domRes.hasTrackingMatch && !allowPopupDetailWithoutCode) {
      let diagnostic = "A aba do SRO Intranet abriu, mas o resultado do objeto n\xE3o carregou automaticamente na tela.";
      if (domRes.inputFound === false) {
        diagnostic = "A aba do SRO Intranet abriu, mas o campo de pesquisa n\xE3o foi localizado automaticamente na tela.";
      } else if (domRes.searchTriggered === false) {
        diagnostic = "A aba do SRO Intranet abriu, mas n\xE3o foi poss\xEDvel acionar o bot\xE3o de pesquisa automaticamente.";
      }
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "INTRANET_UNREACHABLE",
        message: `${diagnostic} Confira a aba do SRO ou cole os dados abaixo.`
      };
    }
    const rawContent = domRes.html || domRes.text || "";
    const parsed = parseSroContent(rawContent, cleanCode);
    if (!parsed.ok || !parsed.data) {
      const extraHint = domRes.postadoRowFound && !domRes.hasPoDetail ? ' A linha "Postado" apareceu na tabela, mas a guia/detalhe do evento n\xE3o abriu automaticamente.' : "";
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: parsed.errorCode || "PARSE_ERROR",
        message: (parsed.message || "N\xE3o foi poss\xEDvel localizar o evento Postagem (PO) para este objeto no SRO.") + extraHint
      };
    }
    if (normalizeTrackingCode(parsed.data.codigoRastreamento) !== cleanCode) {
      return {
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "OBJECT_NOT_FOUND",
        message: "Os dados extra\xEDdos da aba n\xE3o correspondem ao c\xF3digo pesquisado e foram descartados."
      };
    }
    return {
      ok: true,
      requestId,
      trackingCode: cleanCode,
      extensionVersion: EXTENSION_VERSION,
      data: parsed.data
    };
  } catch (err) {
    return {
      ok: false,
      requestId,
      trackingCode: cleanCode,
      extensionVersion: EXTENSION_VERSION,
      errorCode: "INTRANET_UNREACHABLE",
      message: err?.message || "N\xE3o foi poss\xEDvel comunicar com a aba do SRO Intranet nesta esta\xE7\xE3o."
    };
  }
}
async function executeSroQuery(rawCode, requestId) {
  const cleanCode = normalizeTrackingCode(rawCode);
  if (!isValidTrackingCode(cleanCode)) {
    return {
      ok: false,
      requestId,
      trackingCode: cleanCode,
      extensionVersion: EXTENSION_VERSION,
      errorCode: "INVALID_CODE",
      message: "C\xF3digo de rastreamento inv\xE1lido para consulta no SRO."
    };
  }
  if (activeQuery) {
    activeQuery.cancelled = true;
  }
  const queryState = {
    requestId,
    trackingCode: cleanCode,
    cancelled: false
  };
  activeQuery = queryState;
  let deadlineTimer = null;
  const deadlinePromise = new Promise((resolve) => {
    deadlineTimer = setTimeout(() => {
      queryState.cancelled = true;
      resolve({
        ok: false,
        requestId,
        trackingCode: cleanCode,
        extensionVersion: EXTENSION_VERSION,
        errorCode: "EXTENSION_TIMEOUT",
        message: "O SRO Intranet demorou para responder. Verifique se a sess\xE3o est\xE1 logada na aba do SRO ou cole os dados abaixo."
      });
    }, EXTENSION_QUERY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      executeSroQueryInner(cleanCode, requestId, queryState),
      deadlinePromise
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
      errorCode: "UNAUTHORIZED_ORIGIN",
      message: "Origem n\xE3o autorizada para acessar a extens\xE3o SRO.",
      extensionVersion: EXTENSION_VERSION
    });
    return false;
  }
  if (!message || typeof message !== "object") {
    return false;
  }
  if (message.type === "SRO_EXT_PING") {
    sendResponse({
      ok: true,
      extensionVersion: EXTENSION_VERSION,
      officialOrigin: OFFICIAL_APP_ORIGIN
    });
    return false;
  }
  if (message.type === "SRO_CANCEL_QUERY") {
    if (activeQuery && (!message.requestId || activeQuery.requestId === message.requestId)) {
      activeQuery.cancelled = true;
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "SRO_QUERY_REQUEST") {
    const requestId = typeof message.requestId === "string" ? message.requestId : "";
    const trackingCode = typeof message.trackingCode === "string" ? message.trackingCode : "";
    if (!requestId) {
      sendResponse({
        ok: false,
        errorCode: "PARSE_ERROR",
        message: "requestId ausente na solicita\xE7\xE3o.",
        extensionVersion: EXTENSION_VERSION
      });
      return false;
    }
    void executeSroQuery(trackingCode, requestId).then((res) => sendResponse(res));
    return true;
  }
  return false;
});
