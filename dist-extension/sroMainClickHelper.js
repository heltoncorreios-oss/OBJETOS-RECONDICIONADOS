(() => {
  // extension/src/sroMainClickHelper.ts
  var TRIGGER_EVENT_NAME = "__SRO_EXT_TRIGGER_CLICK__";
  var TARGET_ATTR = "data-sro-ext-click-target";
  function findMarkedElement(doc) {
    const direct = doc.querySelector(`[${TARGET_ATTR}="1"]`);
    if (direct instanceof HTMLElement) {
      return direct;
    }
    const frames = Array.from(doc.querySelectorAll("iframe, frame"));
    for (const frame of frames) {
      try {
        const fDoc = frame.contentDocument;
        if (fDoc) {
          const found = findMarkedElement(fDoc);
          if (found) return found;
        }
      } catch {
      }
    }
    return null;
  }
  window.addEventListener(TRIGGER_EVENT_NAME, () => {
    const target = findMarkedElement(document);
    if (!target) return;
    target.removeAttribute(TARGET_ATTR);
    target.click();
  });
})();
