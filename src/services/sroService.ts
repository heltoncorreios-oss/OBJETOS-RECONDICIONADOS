/**
 * Serviço de consulta ao SRO Intranet dos Correios e orquestração com Busca CEP.
 *
 * Restrições técnicas reais respeitadas:
 * - O endereço https://srointranet.correios.com.br/rastreamento pertence à intranet corporativa
 *   dos Correios, exige sessão autenticada na rede interna e possui restrição de CORS no navegador.
 * - Nenhuma credencial, cookie ou token é armazenado no código-fonte.
 * - Não há dados simulados/fictícios: todas as informações vêm do retorno real do agente local
 *   (quando executado na rede dos Correios) ou da sessão autenticada do usuário no navegador.
 */

import { CepLookupResult, formatAddressFromCep, lookupCep } from './cepService';
import {
  isValidTrackingCode,
  normalizeTrackingCode,
  parseSroContent,
  SroErrorCode,
  SroPostagemData,
} from './sroParser';

export const SRO_INTRANET_URL = 'https://srointranet.correios.com.br/rastreamento';
export const OFFICIAL_APP_ORIGIN = 'https://recondicionamentodeobjetos.vercel.app';
const APP_CHANNEL_SOURCE = 'CORREIOS_RECONDICIONADOS_APP';
const EXT_CHANNEL_SOURCE = 'CORREIOS_SRO_EXTENSION_V1';
const SRO_AGENT_URL_STORAGE_KEY = 'cdd_sro_agent_url';

let extensionReadyHint = false;
let extensionVersionHint = '';

if (typeof window !== 'undefined' && window.location.origin === OFFICIAL_APP_ORIGIN) {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || event.origin !== OFFICIAL_APP_ORIGIN) return;
    const msg = event.data;
    if (
      msg &&
      typeof msg === 'object' &&
      msg.source === EXT_CHANNEL_SOURCE &&
      (msg.type === 'SRO_EXT_READY' || msg.type === 'SRO_EXT_PONG')
    ) {
      extensionReadyHint = true;
      if (typeof msg.extensionVersion === 'string') {
        extensionVersionHint = msg.extensionVersion;
      }
    }
  });
}

export function getDetectedExtensionInfo(): { detected: boolean; version: string } {
  return { detected: extensionReadyHint, version: extensionVersionHint };
}

export interface SroAutoFillData {
  codigoRastreamento: string;
  pesoPostalGramas: number | null;
  valorDeclarado: 'SIM' | 'NÃO' | '';
  destinoCep: string;
  unidadePostagem: string;
  remetenteNome: string;
  remetenteEndereco: string;
  destinatarioNome: string;
  destinatarioEndereco: string;
  sroRaw: SroPostagemData;
  cepRemetenteStatus: 'ok' | 'ausente' | 'erro';
  cepDestinatarioStatus: 'ok' | 'ausente' | 'erro';
  avisos: string[];
}

export interface SroConsultationResult {
  ok: boolean;
  data?: SroAutoFillData;
  errorCode?: SroErrorCode | 'CEP_ERROR';
  stageMessage: string;
  technicalDetail?: string;
}

export interface SroConsultationCallbacks {
  onStatusChange?: (message: string) => void;
}

export function getConfiguredSroAgentUrl(): string {
  try {
    const saved = localStorage.getItem(SRO_AGENT_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignorar erro de acesso ao localStorage
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || /^10\.|^192\.168\.|^172\./.test(host)) {
      return window.location.origin;
    }
  }

  return '';
}

export function setConfiguredSroAgentUrl(url: string): void {
  try {
    const cleaned = (url || '').trim().replace(/\/+$/, '');
    if (!cleaned) {
      localStorage.removeItem(SRO_AGENT_URL_STORAGE_KEY);
    } else {
      localStorage.setItem(SRO_AGENT_URL_STORAGE_KEY, cleaned);
    }
  } catch {
    // Ignorar erro de localStorage
  }
}

/**
 * Executa as duas consultas independentes ao Busca CEP após o evento Postagem (PO)
 * ser localizado no SRO e monta o payload final de preenchimento.
 */
async function completeWithBuscaCep(
  sroData: SroPostagemData,
  callbacks: SroConsultationCallbacks,
  signal?: AbortSignal
): Promise<SroConsultationResult> {
  callbacks.onStatusChange?.('Objeto localizado. Consultando endereços...');

  const avisos: string[] = [];

  const remPromise: Promise<CepLookupResult | null> = sroData.cepRemetente
    ? lookupCep(sroData.cepRemetente, signal).catch((err: any) => {
        if (err?.name === 'AbortError' && signal?.aborted) throw err;
        return {
          ok: false,
          cep: sroData.cepRemetente,
          error: 'Falha ao consultar o Busca CEP do remetente.',
        };
      })
    : Promise.resolve(null);

  const destPromise: Promise<CepLookupResult | null> = sroData.cepDestinatario
    ? lookupCep(sroData.cepDestinatario, signal).catch((err: any) => {
        if (err?.name === 'AbortError' && signal?.aborted) throw err;
        return {
          ok: false,
          cep: sroData.cepDestinatario,
          error: 'Falha ao consultar o Busca CEP do destinatário.',
        };
      })
    : Promise.resolve(null);

  const [remResult, destResult] = await Promise.all([remPromise, destPromise]);

  let cepRemetenteStatus: 'ok' | 'ausente' | 'erro' = 'ausente';
  let remetenteEndereco = '';
  if (sroData.cepRemetente) {
    if (remResult?.ok && remResult.data) {
      cepRemetenteStatus = 'ok';
      remetenteEndereco = formatAddressFromCep(remResult.data, sroData.numeroRemetente);
    } else {
      cepRemetenteStatus = 'erro';
      avisos.push(
        remResult?.error ||
          'Falha no Busca CEP do remetente; campo Endereço do Remetente mantido em branco.'
      );
    }
  }

  let cepDestinatarioStatus: 'ok' | 'ausente' | 'erro' = 'ausente';
  let destinatarioEndereco = '';
  if (sroData.cepDestinatario) {
    if (destResult?.ok && destResult.data) {
      cepDestinatarioStatus = 'ok';
      destinatarioEndereco = formatAddressFromCep(destResult.data, sroData.numeroDestinatario);
    } else {
      cepDestinatarioStatus = 'erro';
      avisos.push(
        destResult?.error ||
          'Falha no Busca CEP do destinatário; campo Endereço do Destinatário mantido em branco.'
      );
    }
  }

  return {
    ok: true,
    stageMessage: 'Consulta concluída. Confira os dados antes de salvar.',
    data: {
      codigoRastreamento: sroData.codigoRastreamento,
      pesoPostalGramas: sroData.pesoGramas,
      valorDeclarado: sroData.valorDeclarado,
      destinoCep: sroData.cepDestinatario,
      unidadePostagem: sroData.unidadePostagem,
      remetenteNome: sroData.remetenteNome,
      remetenteEndereco,
      destinatarioNome: sroData.destinatarioNome,
      destinatarioEndereco,
      sroRaw: sroData,
      cepRemetenteStatus,
      cepDestinatarioStatus,
      avisos,
    },
  };
}

/**
 * Processa conteúdo real obtido diretamente da aba autenticada do SRO Intranet
 * (via colagem do operador ou ponte autorizada) e executa as duas consultas ao Busca CEP.
 */
export async function processarConteudoSroReal(
  rawContent: string | Partial<SroPostagemData>,
  expectedCode: string,
  callbacks: SroConsultationCallbacks = {},
  signal?: AbortSignal
): Promise<SroConsultationResult> {
  const cleanCode = normalizeTrackingCode(expectedCode);
  if (!isValidTrackingCode(cleanCode)) {
    return {
      ok: false,
      errorCode: 'INVALID_CODE',
      stageMessage: 'Código de rastreamento inválido. Use o padrão postal (ex: AA123456789BR).',
    };
  }

  const parsed = parseSroContent(rawContent, cleanCode);
  if (!parsed.ok || !parsed.data) {
    return {
      ok: false,
      errorCode: parsed.errorCode || 'PARSE_ERROR',
      stageMessage:
        parsed.message || 'Não foi possível localizar os dados da Postagem (PO) no conteúdo informado.',
    };
  }

  return completeWithBuscaCep(parsed.data, callbacks, signal);
}

function createRequestNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Valida a integridade, correlação e estrutura dos dados devolvidos pela extensão piloto.
 */
export function validateExtensionSroResponse(
  payload: any,
  expectedRequestId: string,
  expectedCode: string
):
  | { valid: true; data: SroPostagemData; extensionVersion: string }
  | { valid: false; errorCode: SroErrorCode | 'INTRANET_UNREACHABLE'; message: string } {
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      errorCode: 'PARSE_ERROR',
      message: 'Resposta inválida recebida da extensão SRO.',
    };
  }

  if (payload.requestId !== expectedRequestId) {
    return {
      valid: false,
      errorCode: 'OBJECT_NOT_FOUND',
      message: 'Resposta da extensão descartada por divergência de identificador de consulta.',
    };
  }

  const extVersion = typeof payload.extensionVersion === 'string' ? payload.extensionVersion : '';

  if (!payload.ok) {
    return {
      valid: false,
      errorCode: payload.errorCode || 'INTRANET_UNREACHABLE',
      message: payload.message || 'Falha na consulta ao SRO pela extensão.',
    };
  }

  if (!payload.data || typeof payload.data !== 'object') {
    return {
      valid: false,
      errorCode: 'PARSE_ERROR',
      message: 'A extensão não retornou dados estruturados do evento Postagem (PO).',
    };
  }

  const cleanExpected = normalizeTrackingCode(expectedCode);
  const parsed = parseSroContent(payload.data, cleanExpected);
  if (!parsed.ok || !parsed.data) {
    return {
      valid: false,
      errorCode: parsed.errorCode || 'PARSE_ERROR',
      message: parsed.message || 'Os dados retornados pela extensão não passaram na validação.',
    };
  }

  if (normalizeTrackingCode(parsed.data.codigoRastreamento) !== cleanExpected) {
    return {
      valid: false,
      errorCode: 'OBJECT_NOT_FOUND',
      message: 'Os dados retornados pela extensão pertencem a outro código e foram descartados.',
    };
  }

  return {
    valid: true,
    data: parsed.data,
    extensionVersion: extVersion,
  };
}

export async function pingSroExtension(timeoutMs = 350): Promise<boolean> {
  if (typeof window === 'undefined' || window.location.origin !== OFFICIAL_APP_ORIGIN) {
    return false;
  }
  if (extensionReadyHint) return true;

  const requestId = createRequestNonce();

  return new Promise((resolve) => {
    let done = false;

    const cleanup = () => {
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
    };

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(ok);
    };

    const onMsg = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== OFFICIAL_APP_ORIGIN) return;
      const msg = event.data;
      if (
        msg &&
        typeof msg === 'object' &&
        msg.source === EXT_CHANNEL_SOURCE &&
        (msg.type === 'SRO_EXT_PONG' || msg.type === 'SRO_EXT_READY') &&
        (!msg.requestId || msg.requestId === requestId)
      ) {
        extensionReadyHint = true;
        if (typeof msg.extensionVersion === 'string') {
          extensionVersionHint = msg.extensionVersion;
        }
        finish(true);
      }
    };

    window.addEventListener('message', onMsg);
    const timer = setTimeout(() => finish(false), timeoutMs);

    window.postMessage(
      {
        source: APP_CHANNEL_SOURCE,
        type: 'SRO_EXT_PING',
        requestId,
      },
      OFFICIAL_APP_ORIGIN
    );
  });
}

async function querySroViaExtension(
  cleanCode: string,
  callbacks: SroConsultationCallbacks,
  signal?: AbortSignal
): Promise<SroConsultationResult> {
  if (typeof window === 'undefined' || window.location.origin !== OFFICIAL_APP_ORIGIN) {
    return {
      ok: false,
      errorCode: 'CORS_BLOCKED',
      stageMessage: 'Extensão SRO ativa apenas no domínio oficial de produção.',
    };
  }

  const requestId = createRequestNonce();

  const rawExtResponse: any = await new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      window.postMessage(
        {
          source: APP_CHANNEL_SOURCE,
          type: 'SRO_CANCEL_QUERY',
          requestId,
        },
        OFFICIAL_APP_ORIGIN
      );
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== OFFICIAL_APP_ORIGIN) return;
      const msg = event.data;
      if (
        !msg ||
        typeof msg !== 'object' ||
        msg.source !== EXT_CHANNEL_SOURCE ||
        msg.type !== 'SRO_QUERY_RESPONSE' ||
        msg.requestId !== requestId
      ) {
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve(msg);
    };

    window.addEventListener('message', onMessage);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      window.postMessage(
        {
          source: APP_CHANNEL_SOURCE,
          type: 'SRO_CANCEL_QUERY',
          requestId,
        },
        OFFICIAL_APP_ORIGIN
      );
      resolve({
        ok: false,
        requestId,
        trackingCode: cleanCode,
        errorCode: 'INTRANET_UNREACHABLE',
        message: 'Tempo esgotado aguardando retorno da extensão SRO.',
      });
    }, 15000);

    window.postMessage(
      {
        source: APP_CHANNEL_SOURCE,
        type: 'SRO_QUERY_REQUEST',
        requestId,
        trackingCode: cleanCode,
      },
      OFFICIAL_APP_ORIGIN
    );
  });

  const validated = validateExtensionSroResponse(rawExtResponse, requestId, cleanCode);
  if (validated.valid === false) {
    return {
      ok: false,
      errorCode: validated.errorCode,
      stageMessage: validated.message,
    };
  }

  return completeWithBuscaCep(validated.data, callbacks, signal);
}

/**
 * Inicia a consulta automática ao SRO Intranet:
 * 1) Na origem oficial, prioriza a extensão Chrome/Edge MV3 piloto (se instalada).
 * 2) Mantém integralmente o agente auxiliar local e a contingência por colagem manual.
 */
export async function consultarObjetoSroEContatos(
  rawTrackingCode: string,
  callbacks: SroConsultationCallbacks = {},
  signal?: AbortSignal
): Promise<SroConsultationResult> {
  const cleanCode = normalizeTrackingCode(rawTrackingCode);
  if (!isValidTrackingCode(cleanCode)) {
    return {
      ok: false,
      errorCode: 'INVALID_CODE',
      stageMessage: 'Código de rastreamento incompleto ou fora do padrão postal.',
    };
  }

  callbacks.onStatusChange?.('Consultando objeto no SRO dos Correios...');

  // 1. Extensão Chrome/Edge MV3 piloto (somente na origem oficial https://recondicionamentodeobjetos.vercel.app)
  const hasExtension = await pingSroExtension();
  if (hasExtension) {
    return querySroViaExtension(cleanCode, callbacks, signal);
  }

  // 2. Agente auxiliar local / fallback existente preservado
  const agentBase = getConfiguredSroAgentUrl();
  if (!agentBase) {
    return {
      ok: false,
      errorCode: 'CORS_BLOCKED',
      stageMessage:
        'Acesso direto ao SRO Intranet bloqueado pela rede/CORS na hospedagem web.',
      technicalDetail:
        'O SRO Intranet (srointranet.correios.com.br) opera apenas na rede interna com sessão autenticada. Utilize a extensão SRO piloto no navegador, o leitor da aba SRO abaixo ou um serviço auxiliar local configurado.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new DOMException('Aborted', 'AbortError');
      }
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    let response: Response;
    try {
      response = await fetch(`${agentBase}/api/sro/consulta/${encodeURIComponent(cleanCode)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener('abort', onExternalAbort);
      }
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        errorCode: 'INTRANET_UNREACHABLE',
        stageMessage:
          'Serviço auxiliar de consulta SRO não disponível neste endereço.',
        technicalDetail:
          'O servidor não retornou JSON válido para a consulta ao SRO. Use o leitor da aba SRO autenticada ou execute o servidor local na estação da unidade.',
      };
    }

    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.data) {
      return {
        ok: false,
        errorCode: payload.errorCode || 'INTRANET_UNREACHABLE',
        stageMessage:
          payload.message || 'Não foi possível consultar o objeto no SRO Intranet.',
        technicalDetail: payload.technicalDetail,
      };
    }

    const sroData = payload.data as SroPostagemData;
    if (
      sroData.codigoRastreamento &&
      normalizeTrackingCode(sroData.codigoRastreamento) !== cleanCode
    ) {
      return {
        ok: false,
        errorCode: 'OBJECT_NOT_FOUND',
        stageMessage: 'Os dados retornados não correspondem ao código pesquisado e foram descartados.',
      };
    }

    return completeWithBuscaCep(sroData, callbacks, signal);
  } catch (err: any) {
    if (err?.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
    return {
      ok: false,
      errorCode: 'INTRANET_UNREACHABLE',
      stageMessage:
        'Não foi possível conectar ao SRO Intranet pelo serviço auxiliar local.',
      technicalDetail:
        'Verifique se o servidor local (INICIAR_SISTEMA.bat / http://localhost:3000) está em execução na rede dos Correios ou cole os dados da aba autenticada do SRO.',
    };
  }
}
