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
 * Consulta um CEP real utilizando ViaCEP (base DNE dos Correios) com fallback para BrasilAPI.
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

  // 1. Primário: ViaCEP (base oficial DNE / Correios, CORS liberado)
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
    // Segue para fallback real
  }

  // 2. Fallback: BrasilAPI v2 (DNE / Correios, CORS liberado)
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
