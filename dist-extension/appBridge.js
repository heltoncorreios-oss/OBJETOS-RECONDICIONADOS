(() => {
  // extension/src/config.ts
  var OFFICIAL_APP_ORIGIN = "https://recondicionamentodeobjetos.vercel.app";
  var OFFICIAL_APP_URL_PREFIX = `${OFFICIAL_APP_ORIGIN}/`;
  var SRO_INTRANET_ORIGIN = "https://srointranet.correios.com.br";
  var SRO_INTRANET_BASE_URL = `${SRO_INTRANET_ORIGIN}/rastreamento`;
  var BUSCA_CEP_ORIGIN = "https://buscacepintra.correios.com.br";
  var BUSCA_CEP_URL = `${BUSCA_CEP_ORIGIN}/app/endereco/index.php`;
  var EXTENSION_VERSION = "1.0.0";
  var APP_CHANNEL_SOURCE = "CORREIOS_RECONDICIONADOS_APP";
  var EXT_CHANNEL_SOURCE = "CORREIOS_SRO_EXTENSION_V1";

  // extension/src/appBridge.ts
  var TRACKING_CODE_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
  var REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,80}$/;
  function isTrustedPageContext() {
    return typeof window !== "undefined" && window.location.origin === OFFICIAL_APP_ORIGIN && window.top === window.self;
  }
  function postBackToApp(payload) {
    if (!isTrustedPageContext()) return;
    window.postMessage(
      {
        source: EXT_CHANNEL_SOURCE,
        ...payload
      },
      OFFICIAL_APP_ORIGIN
    );
  }
  function sanitizeTrackingCode(raw) {
    if (typeof raw !== "string") return "";
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  if (isTrustedPageContext()) {
    postBackToApp({
      type: "SRO_EXT_READY",
      extensionVersion: EXTENSION_VERSION
    });
    window.addEventListener("message", (event) => {
      if (!isTrustedPageContext()) return;
      if (event.source !== window) return;
      if (event.origin !== OFFICIAL_APP_ORIGIN) return;
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.source !== APP_CHANNEL_SOURCE) return;
      if (msg.type === "SRO_EXT_PING") {
        const requestId = typeof msg.requestId === "string" && REQUEST_ID_REGEX.test(msg.requestId) ? msg.requestId : "";
        try {
          chrome.runtime.sendMessage({ type: "SRO_EXT_PING" }, (res) => {
            if (chrome.runtime.lastError || !res?.ok) return;
            postBackToApp({
              type: "SRO_EXT_PONG",
              requestId,
              extensionVersion: res.extensionVersion || EXTENSION_VERSION
            });
          });
        } catch {
        }
        return;
      }
      if (msg.type === "SRO_CANCEL_QUERY") {
        const requestId = typeof msg.requestId === "string" && REQUEST_ID_REGEX.test(msg.requestId) ? msg.requestId : "";
        try {
          chrome.runtime.sendMessage({
            type: "SRO_CANCEL_QUERY",
            requestId
          });
        } catch {
        }
        return;
      }
      if (msg.type === "BUSCA_CEP_CANCEL") {
        const requestId = typeof msg.requestId === "string" && REQUEST_ID_REGEX.test(msg.requestId) ? msg.requestId : "";
        try {
          chrome.runtime.sendMessage({
            type: "BUSCA_CEP_CANCEL",
            requestId
          });
        } catch {
        }
        return;
      }
      if (msg.type === "BUSCA_CEP_REQUEST") {
        const requestId = typeof msg.requestId === "string" ? msg.requestId : "";
        const rawCep = typeof msg.cep === "string" ? msg.cep.replace(/\D/g, "") : "";
        if (!REQUEST_ID_REGEX.test(requestId) || !/^\d{8}$/.test(rawCep)) {
          postBackToApp({
            type: "BUSCA_CEP_RESPONSE",
            ok: false,
            requestId,
            cep: rawCep,
            error: "Solicita\xE7\xE3o de CEP inv\xE1lida enviada \xE0 extens\xE3o."
          });
          return;
        }
        try {
          chrome.runtime.sendMessage(
            {
              type: "BUSCA_CEP_REQUEST",
              requestId,
              cep: rawCep
            },
            (res) => {
              if (chrome.runtime.lastError) {
                postBackToApp({
                  type: "BUSCA_CEP_RESPONSE",
                  ok: false,
                  requestId,
                  cep: rawCep,
                  error: chrome.runtime.lastError.message || "Falha de comunica\xE7\xE3o interna com o Busca CEP Intranet."
                });
                return;
              }
              postBackToApp({
                type: "BUSCA_CEP_RESPONSE",
                ...res || {
                  ok: false,
                  requestId,
                  cep: rawCep,
                  error: "Resposta vazia do Busca CEP Intranet."
                }
              });
            }
          );
        } catch (err) {
          postBackToApp({
            type: "BUSCA_CEP_RESPONSE",
            ok: false,
            requestId,
            cep: rawCep,
            error: String(err?.message || "Erro ao acionar o Busca CEP Intranet.")
          });
        }
        return;
      }
      if (msg.type === "SRO_QUERY_REQUEST") {
        const requestId = typeof msg.requestId === "string" ? msg.requestId : "";
        const trackingCode = sanitizeTrackingCode(msg.trackingCode);
        if (!REQUEST_ID_REGEX.test(requestId) || !TRACKING_CODE_REGEX.test(trackingCode)) {
          postBackToApp({
            type: "SRO_QUERY_RESPONSE",
            ok: false,
            requestId,
            trackingCode,
            extensionVersion: EXTENSION_VERSION,
            errorCode: "INVALID_CODE",
            message: "Solicita\xE7\xE3o inv\xE1lida enviada \xE0 extens\xE3o SRO."
          });
          return;
        }
        try {
          chrome.runtime.sendMessage(
            {
              type: "SRO_QUERY_REQUEST",
              requestId,
              trackingCode
            },
            (res) => {
              if (chrome.runtime.lastError) {
                postBackToApp({
                  type: "SRO_QUERY_RESPONSE",
                  ok: false,
                  requestId,
                  trackingCode,
                  extensionVersion: EXTENSION_VERSION,
                  errorCode: "INTRANET_UNREACHABLE",
                  message: chrome.runtime.lastError.message || "Falha de comunica\xE7\xE3o interna com o Service Worker da extens\xE3o."
                });
                return;
              }
              postBackToApp({
                type: "SRO_QUERY_RESPONSE",
                ...res || {
                  ok: false,
                  requestId,
                  trackingCode,
                  extensionVersion: EXTENSION_VERSION,
                  errorCode: "INTRANET_UNREACHABLE",
                  message: "Resposta vazia recebida da extens\xE3o SRO."
                }
              });
            }
          );
        } catch (err) {
          const msgErr = String(err?.message || "");
          const contextInvalidated = /Extension context invalidated/i.test(msgErr);
          postBackToApp({
            type: "SRO_QUERY_RESPONSE",
            ok: false,
            requestId,
            trackingCode,
            extensionVersion: EXTENSION_VERSION,
            errorCode: "INTRANET_UNREACHABLE",
            message: contextInvalidated ? "A extens\xE3o SRO foi atualizada no navegador. Atualize (F5) esta p\xE1gina do sistema e tente novamente." : msgErr || "N\xE3o foi poss\xEDvel acionar o servi\xE7o da extens\xE3o SRO."
          });
        }
      }
    });
  }
})();
