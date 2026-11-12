(() => {
  // extension/src/config.ts
  var OFFICIAL_APP_ORIGIN = "https://recondicionamentodeobjetos.vercel.app";
  var OFFICIAL_APP_URL_PREFIX = `${OFFICIAL_APP_ORIGIN}/`;
  var SRO_INTRANET_ORIGIN = "https://srointranet.correios.com.br";
  var SRO_INTRANET_BASE_URL = `${SRO_INTRANET_ORIGIN}/rastreamento`;
  var EXTENSION_VERSION = "1.0.0";

  // extension/src/popup.ts
  async function initPopup() {
    const versionEl = document.getElementById("ext-version");
    const originEl = document.getElementById("official-origin");
    const sroStatusEl = document.getElementById("sro-tab-status");
    const openSroBtn = document.getElementById("open-sro-btn");
    const openAppBtn = document.getElementById("open-app-btn");
    if (versionEl) versionEl.textContent = `v${EXTENSION_VERSION}`;
    if (originEl) originEl.textContent = OFFICIAL_APP_ORIGIN;
    try {
      const sroTabs = await chrome.tabs.query({ url: `${SRO_INTRANET_ORIGIN}/*` });
      if (sroStatusEl) {
        sroStatusEl.textContent = sroTabs.length > 0 ? `Aba detectada (${sroTabs.length})` : "Nenhuma aba aberta (ser\xE1 aberta ao consultar)";
      }
    } catch {
      if (sroStatusEl) sroStatusEl.textContent = "Dispon\xEDvel";
    }
    openSroBtn?.addEventListener("click", async () => {
      const existing = await chrome.tabs.query({ url: `${SRO_INTRANET_ORIGIN}/*` });
      if (existing.length > 0 && existing[0].id !== void 0) {
        await chrome.tabs.update(existing[0].id, { active: true });
      } else {
        await chrome.tabs.create({ url: SRO_INTRANET_BASE_URL, active: true });
      }
    });
    openAppBtn?.addEventListener("click", async () => {
      const existing = await chrome.tabs.query({ url: `${OFFICIAL_APP_ORIGIN}/*` });
      if (existing.length > 0 && existing[0].id !== void 0) {
        await chrome.tabs.update(existing[0].id, { active: true });
      } else {
        await chrome.tabs.create({ url: OFFICIAL_APP_ORIGIN, active: true });
      }
    });
  }
  void initPopup();
})();
