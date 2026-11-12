/**
 * Helper executado no mundo MAIN de https://srointranet.correios.com.br/*
 * exclusivamente para acionar cliques em elementos com href="javascript:..."
 * (como o ícone Det da linha Postado) sem violar a CSP da extensão MV3.
 */

const TRIGGER_EVENT_NAME = '__SRO_EXT_TRIGGER_CLICK__';
const TARGET_ATTR = 'data-sro-ext-click-target';

function findMarkedElement(doc: Document): HTMLElement | null {
  const direct = doc.querySelector(`[${TARGET_ATTR}="1"]`);
  if (direct instanceof HTMLElement) {
    return direct;
  }

  const frames = Array.from(doc.querySelectorAll('iframe, frame'));
  for (const frame of frames) {
    try {
      const fDoc = (frame as HTMLIFrameElement).contentDocument;
      if (fDoc) {
        const found = findMarkedElement(fDoc);
        if (found) return found;
      }
    } catch {
      // Ignorar frames cross-origin
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
