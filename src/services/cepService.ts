/**
 * Serviço de consulta ao Busca CEP (Diretório Nacional de Endereços - DNE / Correios)
 * Realiza consultas independentes e reais via APIs públicas compatíveis com CORS
 * (ViaCEP / BrasilAPI) ou proxy local quando disponível, sem dados simulados.
 */

import { formatCepDisplay, normalizeCepDigits } from './sroParser';

export interface CepAddressData {
  cep: string;
  cepFormatado: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  complemento?: string;
}

export interface CepLookupResult {
  ok: boolean;
  cep: string;
  data?: CepAddressData;
  error?: string;
}

export const BUSCA_CEP_INTRANET_URL =
  'https://buscacepintra.correios.com.br/app/endereco/index.php';
const OFFICIAL_APP_ORIGIN = 'https://recondicionamentodeobjetos.vercel.app';
const APP_CHANNEL_SOURCE = 'CORREIOS_RECONDICIONADOS_APP';
const EXT_CHANNEL_SOURCE = 'CORREIOS_SRO_EXTENSION_V1';

export interface BuscaCepParseResult extends CepLookupResult {
  authRequired?: boolean;
  captchaRequired?: boolean;
  notFound?: boolean;
}

function decodeBasicEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&aacute;': 'á', '&Aacute;': 'Á',
    '&agrave;': 'à', '&Agrave;': 'À',
    '&acirc;': 'â', '&Acirc;': 'Â',
    '&atilde;': 'ã', '&Atilde;': 'Ã',
    '&eacute;': 'é', '&Eacute;': 'É',
    '&ecirc;': 'ê', '&Ecirc;': 'Ê',
    '&iacute;': 'í', '&Iacute;': 'Í',
    '&oacute;': 'ó', '&Oacute;': 'Ó',
    '&ocirc;': 'ô', '&Ocirc;': 'Ô',
    '&otilde;': 'õ', '&Otilde;': 'Õ',
    '&uacute;': 'ú', '&Uacute;': 'Ú',
    '&uuml;': 'ü', '&Uuml;': 'Ü',
    '&ccedil;': 'ç', '&Ccedil;': 'Ç',
    '&ordm;': 'º', '&ordf;': 'ª',
  };
  let out = text;
  for (const [k, v] of Object.entries(entities)) {
    out = out.split(k).join(v);
  }
  return out.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function cleanCellText(rawHtml: string): string {
  return decodeBasicEntities(
    rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCorreiosStreetSuffix(street: string): string {
  return street
    .replace(
      /\s*-\s*(?:at[ée]\s+\d+|de\s+\d+(?:\/\d+)?\s+(?:a|ao)\s+|lado\s+(?:par|[íi]mpar)|exceto\b).*$/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function splitLocalidadeUf(raw: string): { localidade: string; uf: string } {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const slashMatch = cleaned.match(/^(.*?)\s*\/\s*([A-Za-z]{2})$/);
  if (slashMatch) {
    return {
      localidade: slashMatch[1].trim().toUpperCase(),
      uf: slashMatch[2].trim().toUpperCase(),
    };
  }
  const dashMatch = cleaned.match(/^(.*?)\s*-\s*([A-Za-z]{2})$/);
  if (dashMatch) {
    return {
      localidade: dashMatch[1].trim().toUpperCase(),
      uf: dashMatch[2].trim().toUpperCase(),
    };
  }
  return { localidade: cleaned.toUpperCase(), uf: '' };
}

/**
 * Faz o parse de HTML ou texto retornado pela tela oficial do Busca CEP Intranet
 * (https://buscacepintra.correios.com.br/app/endereco/index.php).
 */
export function parseBuscaCepResult(
  rawInput: string,
  expectedCep: string
): BuscaCepParseResult {
  const cep = normalizeCepDigits(expectedCep);
  if (!cep) {
    return { ok: false, cep: '', error: 'CEP inválido ou ausente.' };
  }

  const raw = typeof rawInput === 'string' ? rawInput : '';
  if (!raw.trim()) {
    return { ok: false, cep, error: 'Nenhum conteúdo retornado pelo Busca CEP Intranet.' };
  }

  const plainCheck = cleanCellText(raw);

  if (
    /type=["']password["']/i.test(raw) ||
    /(?:idcorreios|autentica[çc][ãa]o\s+corporativa|fa[çc]a\s+login|usu[áa]rio\s+e\s+senha)/i.test(
      plainCheck
    )
  ) {
    return {
      ok: false,
      cep,
      authRequired: true,
      error: 'O Busca CEP Intranet exige sessão autenticada.',
    };
  }

  if (
    /(?:captcha\s+inv[áa]lido|digite\s+o\s+texto\s+(?:da|contido\s+na)\s+imagem|caracteres\s+da\s+imagem)/i.test(
      plainCheck
    )
  ) {
    return {
      ok: false,
      cep,
      captchaRequired: true,
      error: 'O Busca CEP Intranet solicitou validação de captcha.',
    };
  }

  if (
    /(?:dados\s+n[ãa]o\s+encontrados|n[ãa]o\s+h[áa]\s+dados\s+a\s+serem\s+exibidos|cep\s+n[ãa]o\s+encontrado)/i.test(
      plainCheck
    )
  ) {
    return {
      ok: false,
      cep,
      notFound: true,
      error: `CEP ${formatCepDisplay(cep)} não encontrado no Busca CEP Intranet.`,
    };
  }

  // Extrair linhas de tabelas HTML
  const rows: string[][] = [];
  const trMatches = raw.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cellMatches = tr.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cellMatches.length >= 2) {
      rows.push(cellMatches.map((c) => cleanCellText(c)));
    }
  }

  // Caso não venha HTML de tabela, tentar linhas separadas por | ou tab
  if (rows.length === 0) {
    for (const line of raw.split(/\r?\n/)) {
      const cols = line
        .split(/\s*\|\s*|\t+/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cols.length >= 3) {
        rows.push(cols);
      }
    }
  }

  let logIdx = 0;
  let bairroIdx = 1;
  let locIdx = 2;
  let cepIdx = 3;
  let matchedRow: string[] | null = null;

  for (const cells of rows) {
    const lowerCells = cells.map((c) => c.toLowerCase());
    const looksLikeHeader =
      lowerCells.some((c) => /logradouro/.test(c)) &&
      lowerCells.some((c) => /localidade|cidade|cep/.test(c));

    if (looksLikeHeader) {
      const foundLog = lowerCells.findIndex((c) => /logradouro/.test(c));
      const foundBairro = lowerCells.findIndex((c) => /bairro/.test(c));
      const foundLoc = lowerCells.findIndex((c) => /localidade|cidade/.test(c));
      const foundCep = lowerCells.findIndex((c) => /\bcep\b/.test(c));
      if (foundLog >= 0) logIdx = foundLog;
      if (foundBairro >= 0) bairroIdx = foundBairro;
      if (foundLoc >= 0) locIdx = foundLoc;
      if (foundCep >= 0) cepIdx = foundCep;
      continue;
    }

    const candidateCepRaw = cells[cepIdx] || cells[cells.length - 1] || '';
    const rowCepDigits = normalizeCepDigits(candidateCepRaw);
    const hasLocality = Boolean((cells[locIdx] || '').trim());

    if (rowCepDigits === cep && hasLocality) {
      matchedRow = cells;
      break;
    }

    if (!rowCepDigits && hasLocality && cells.length >= 3 && !matchedRow) {
      matchedRow = cells;
    }
  }

  if (!matchedRow) {
    return {
      ok: false,
      cep,
      error: `Resultado estruturado do CEP ${formatCepDisplay(cep)} não localizado no Busca CEP Intranet.`,
    };
  }

  const logradouro = cleanCorreiosStreetSuffix(matchedRow[logIdx] || '');
  const bairro = (matchedRow[bairroIdx] || '').trim().toUpperCase();
  const { localidade, uf } = splitLocalidadeUf(matchedRow[locIdx] || '');

  if (!localidade && !logradouro && !uf) {
    return {
      ok: false,
      cep,
      error: `Dados insuficientes para o CEP ${formatCepDisplay(cep)} no Busca CEP Intranet.`,
    };
  }

  return {
    ok: true,
    cep,
    data: {
      cep,
      cepFormatado: formatCepDisplay(cep),
      logradouro,
      bairro,
      localidade,
      uf,
    },
  };
}

function createCepRequestNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `cep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function isExtensionAvailableFast(timeoutMs = 250): Promise<boolean> {
  if (typeof window === 'undefined' || window.location.origin !== OFFICIAL_APP_ORIGIN) {
    return false;
  }

  const requestId = createCepRequestNonce();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
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

async function lookupCepViaExtension(
  cep: string,
  externalSignal?: AbortSignal
): Promise<BuscaCepParseResult | null> {
  if (typeof window === 'undefined' || window.location.origin !== OFFICIAL_APP_ORIGIN) {
    return null;
  }

  const extReady = await isExtensionAvailableFast(250);
  if (!extReady) return null;

  const requestId = createCepRequestNonce();

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      window.postMessage(
        {
          source: APP_CHANNEL_SOURCE,
          type: 'BUSCA_CEP_CANCEL',
          requestId,
        },
        OFFICIAL_APP_ORIGIN
      );
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        onAbort();
        return;
      }
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    const onMsg = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== OFFICIAL_APP_ORIGIN) return;
      const msg = event.data;
      if (
        !msg ||
        typeof msg !== 'object' ||
        msg.source !== EXT_CHANNEL_SOURCE ||
        msg.type !== 'BUSCA_CEP_RESPONSE' ||
        msg.requestId !== requestId
      ) {
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        ok: Boolean(msg.ok && msg.data),
        cep,
        data: msg.data,
        notFound: Boolean(msg.notFound),
        authRequired: Boolean(msg.authRequired),
        captchaRequired: Boolean(msg.captchaRequired),
        error: msg.error,
      });
    };

    window.addEventListener('message', onMsg);

    // Suporta fila sequencial de 2 CEPs (Remetente + Destinatário) na aba única do Busca CEP Intranet
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      window.postMessage(
        {
          source: APP_CHANNEL_SOURCE,
          type: 'BUSCA_CEP_CANCEL',
          requestId,
        },
        OFFICIAL_APP_ORIGIN
      );
      resolve({
        ok: false,
        cep,
        error: 'Tempo esgotado no Busca CEP Intranet.',
      });
    }, 24000);

    window.postMessage(
      {
        source: APP_CHANNEL_SOURCE,
        type: 'BUSCA_CEP_REQUEST',
        requestId,
        cep,
      },
      OFFICIAL_APP_ORIGIN
    );
  });
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Resposta não JSON recebida do serviço de CEP');
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Consulta um CEP real priorizando o Busca CEP Intranet dos Correios via extensão
 * (quando disponível na origem oficial), com fallback automático para ViaCEP e BrasilAPI.
 */
export async function lookupCep(
  rawCep: string,
  externalSignal?: AbortSignal
): Promise<CepLookupResult> {
  const cep = normalizeCepDigits(rawCep);
  if (!cep) {
    return {
      ok: false,
      cep: '',
      error: 'CEP inválido ou ausente.',
    };
  }

  // 1. Primário na origem oficial com extensão ativa: Busca CEP Intranet dos Correios
  try {
    const intranetResult = await lookupCepViaExtension(cep, externalSignal);
    if (intranetResult?.ok && intranetResult.data) {
      return {
        ok: true,
        cep,
        data: intranetResult.data,
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
    // Segue para fallback público
  }

  // 2. Fallback: ViaCEP (base oficial DNE / Correios, CORS liberado)
  try {
    const viaCep = await fetchJsonWithTimeout(
      `https://viacep.com.br/ws/${cep}/json/`,
      5000,
      externalSignal
    );

    if (viaCep && viaCep.erro === true) {
      return {
        ok: false,
        cep,
        error: `CEP ${formatCepDisplay(cep)} não encontrado no Busca CEP.`,
      };
    }

    if (viaCep && (viaCep.localidade || viaCep.logradouro || viaCep.uf)) {
      return {
        ok: true,
        cep,
        data: {
          cep,
          cepFormatado: formatCepDisplay(cep),
          logradouro: (viaCep.logradouro || '').trim().toUpperCase(),
          bairro: (viaCep.bairro || '').trim().toUpperCase(),
          localidade: (viaCep.localidade || '').trim().toUpperCase(),
          uf: (viaCep.uf || '').trim().toUpperCase(),
          complemento: (viaCep.complemento || '').trim().toUpperCase(),
        },
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
    // Segue para fallback BrasilAPI
  }

  // 3. Fallback: BrasilAPI v2 (DNE / Correios, CORS liberado)
  try {
    const brasilApi = await fetchJsonWithTimeout(
      `https://brasilapi.com.br/api/cep/v2/${cep}`,
      5000,
      externalSignal
    );

    if (brasilApi && (brasilApi.city || brasilApi.street || brasilApi.state)) {
      return {
        ok: true,
        cep,
        data: {
          cep,
          cepFormatado: formatCepDisplay(cep),
          logradouro: (brasilApi.street || '').trim().toUpperCase(),
          bairro: (brasilApi.neighborhood || '').trim().toUpperCase(),
          localidade: (brasilApi.city || '').trim().toUpperCase(),
          uf: (brasilApi.state || '').trim().toUpperCase(),
        },
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
    if (String(err?.message || '').includes('HTTP 404')) {
      return {
        ok: false,
        cep,
        error: `CEP ${formatCepDisplay(cep)} não encontrado no Busca CEP.`,
      };
    }
  }

  return {
    ok: false,
    cep,
    error: `Falha ao consultar o serviço Busca CEP para o CEP ${formatCepDisplay(cep)}.`,
  };
}

/**
 * Compõe o endereço exclusivamente com dados reais retornados pelo Busca CEP
 * + Número do Logradouro extraído do SRO, sem inventar complementos ou dados ausentes.
 */
export function formatAddressFromCep(
  cepData: CepAddressData | undefined | null,
  numeroLogradouro?: string | null
): string {
  if (!cepData) return '';

  const logradouro = (cepData.logradouro || '').trim().toUpperCase();
  const numero = (numeroLogradouro || '').trim().toUpperCase();
  const bairro = (cepData.bairro || '').trim().toUpperCase();
  const localidade = (cepData.localidade || '').trim().toUpperCase();
  const uf = (cepData.uf || '').trim().toUpperCase();

  let streetPart = '';
  if (logradouro && numero) {
    streetPart = `${logradouro}, ${numero}`;
  } else if (logradouro) {
    streetPart = logradouro;
  } else if (numero) {
    streetPart = `Nº ${numero}`;
  }

  const cityStatePart = localidade && uf ? `${localidade}/${uf}` : localidade || uf;

  const localityPieces: string[] = [];
  if (bairro) localityPieces.push(bairro);
  if (cityStatePart) localityPieces.push(cityStatePart);
  const localityPart = localityPieces.join(', ');

  if (streetPart && localityPart) {
    return `${streetPart} - ${localityPart}`;
  }
  if (streetPart) {
    return streetPart;
  }
  return localityPart;
}
