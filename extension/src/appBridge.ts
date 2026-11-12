/**
 * Ponte isolada (Content Script) executada exclusivamente no domínio oficial:
 * https://recondicionamentodeobjetos.vercel.app
 *
 * No piloto, substitui a dependência de ID fixo de loja para externally_connectable,
 * garantindo validação estrita de origem, frame top-level, estrutura da mensagem
 * e isolamento contra outros sites ou iframes.
 */

import {
  APP_CHANNEL_SOURCE,
  EXT_CHANNEL_SOURCE,
  EXTENSION_VERSION,
  OFFICIAL_APP_ORIGIN,
} from './config';

const TRACKING_CODE_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,80}$/;

function isTrustedPageContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.origin === OFFICIAL_APP_ORIGIN &&
    window.top === window.self
  );
}

function postBackToApp(payload: Record<string, any>): void {
  if (!isTrustedPageContext()) return;
  window.postMessage(
    {
      source: EXT_CHANNEL_SOURCE,
      ...payload,
    },
    OFFICIAL_APP_ORIGIN
  );
}

function sanitizeTrackingCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

if (isTrustedPageContext()) {
  // Anunciar disponibilidade da extensão apenas para a origem oficial
  postBackToApp({
    type: 'SRO_EXT_READY',
    extensionVersion: EXTENSION_VERSION,
  });

  window.addEventListener('message', (event: MessageEvent) => {
    if (!isTrustedPageContext()) return;
    if (event.source !== window) return;
    if (event.origin !== OFFICIAL_APP_ORIGIN) return;

    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.source !== APP_CHANNEL_SOURCE) return;

    if (msg.type === 'SRO_EXT_PING') {
      const requestId =
        typeof msg.requestId === 'string' && REQUEST_ID_REGEX.test(msg.requestId)
          ? msg.requestId
          : '';
      chrome.runtime.sendMessage({ type: 'SRO_EXT_PING' }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) return;
        postBackToApp({
          type: 'SRO_EXT_PONG',
          requestId,
          extensionVersion: res.extensionVersion || EXTENSION_VERSION,
        });
      });
      return;
    }

    if (msg.type === 'SRO_CANCEL_QUERY') {
      const requestId =
        typeof msg.requestId === 'string' && REQUEST_ID_REGEX.test(msg.requestId)
          ? msg.requestId
          : '';
      chrome.runtime.sendMessage({
        type: 'SRO_CANCEL_QUERY',
        requestId,
      });
      return;
    }

    if (msg.type === 'SRO_QUERY_REQUEST') {
      const requestId = typeof msg.requestId === 'string' ? msg.requestId : '';
      const trackingCode = sanitizeTrackingCode(msg.trackingCode);

      if (!REQUEST_ID_REGEX.test(requestId) || !TRACKING_CODE_REGEX.test(trackingCode)) {
        postBackToApp({
          type: 'SRO_QUERY_RESPONSE',
          ok: false,
          requestId,
          trackingCode,
          extensionVersion: EXTENSION_VERSION,
          errorCode: 'INVALID_CODE',
          message: 'Solicitação inválida enviada à extensão SRO.',
        });
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: 'SRO_QUERY_REQUEST',
          requestId,
          trackingCode,
        },
        (res) => {
          if (chrome.runtime.lastError) {
            postBackToApp({
              type: 'SRO_QUERY_RESPONSE',
              ok: false,
              requestId,
              trackingCode,
              extensionVersion: EXTENSION_VERSION,
              errorCode: 'INTRANET_UNREACHABLE',
              message:
                chrome.runtime.lastError.message ||
                'Falha de comunicação interna com o Service Worker da extensão.',
            });
            return;
          }

          postBackToApp({
            type: 'SRO_QUERY_RESPONSE',
            ...(res || {
              ok: false,
              requestId,
              trackingCode,
              extensionVersion: EXTENSION_VERSION,
              errorCode: 'INTRANET_UNREACHABLE',
              message: 'Resposta vazia recebida da extensão SRO.',
            }),
          });
        }
      );
    }
  });
}
