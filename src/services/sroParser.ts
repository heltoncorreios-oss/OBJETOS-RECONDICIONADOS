/**
 * Parser e validador para respostas reais do SRO Intranet dos Correios
 * Foca exclusivamente no evento Postagem (PO), evitando misturar dados de outros eventos.
 */

export type SroErrorCode =
  | 'OBJECT_NOT_FOUND'
  | 'PO_EVENT_NOT_FOUND'
  | 'INTRANET_UNREACHABLE'
  | 'AUTH_REQUIRED'
  | 'CORS_BLOCKED'
  | 'INVALID_CODE'
  | 'PARSE_ERROR';

export interface SroPostagemData {
  codigoRastreamento: string;
  eventoEncontrado: boolean;
  pesoGramas: number | null;
  valorDeclarado: 'SIM' | 'NÃO' | '';
  unidadePostagem: string;
  remetenteNome: string;
  cepRemetente: string;
  numeroRemetente: string;
  destinatarioNome: string;
  cepDestinatario: string;
  numeroDestinatario: string;
}

export interface SroParseResult {
  ok: boolean;
  data?: SroPostagemData;
  errorCode?: SroErrorCode;
  message?: string;
}

const TRACKING_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export function normalizeTrackingCode(code: string): string {
  return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidTrackingCode(code: string): boolean {
  const clean = normalizeTrackingCode(code);
  return TRACKING_REGEX.test(clean);
}

export function normalizeCepDigits(cep: string | undefined | null): string {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  return digits.length === 8 ? digits : '';
}

export function formatCepDisplay(cep: string | undefined | null): string {
  const digits = normalizeCepDigits(cep);
  if (!digits) return '';
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Converte string de peso (ex: "2,580 kg", "0,760", "760 g") para gramas inteiras.
 */
export function parseWeightToGrams(rawWeight: string | number | null | undefined): number | null {
  if (rawWeight === null || rawWeight === undefined) return null;
  if (typeof rawWeight === 'number') {
    if (!Number.isFinite(rawWeight) || rawWeight <= 0) return null;
    // Se vier número decimal menor que 100 (provável kg), ou string já tratada
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
    const cleanNum = parseFloat(numStr.replace(',', '.'));
    return Number.isFinite(cleanNum) && cleanNum > 0 ? Math.round(cleanNum) : null;
  }

  if (hasKgUnit) {
    const cleanNum = parseFloat(numStr.replace(',', '.'));
    return Number.isFinite(cleanNum) && cleanNum > 0 ? Math.round(cleanNum * 1000) : null;
  }

  // Sem unidade explícita: no SRO, pesos vêm em kg com vírgula ou 3 casas decimais (ex: "2,580" ou "2.580")
  if (/[.,]\d{1,3}$/.test(numStr)) {
    const cleanNum = parseFloat(numStr.replace(',', '.'));
    return Number.isFinite(cleanNum) && cleanNum > 0 ? Math.round(cleanNum * 1000) : null;
  }

  // Inteiro sem unidade (ex: "2580")
  const intVal = parseInt(numStr, 10);
  return Number.isFinite(intVal) && intVal > 0 ? intVal : null;
}

/**
 * Converte indicador VD ("S" / "N" / "SIM" / "NÃO") para o padrão do cadastro.
 */
export function parseValorDeclarado(rawVd: string | null | undefined): 'SIM' | 'NÃO' | '' {
  if (!rawVd) return '';
  const cleaned = rawVd.trim().toUpperCase();
  if (!cleaned || /^[-–—]+$/.test(cleaned)) return '';

  if (cleaned === 'S' || cleaned === 'SIM' || /\bVD\s*[:=]?\s*S\b/i.test(cleaned)) {
    return 'SIM';
  }
  if (
    cleaned === 'N' ||
    cleaned === 'NAO' ||
    cleaned === 'NÃO' ||
    /\bVD\s*[:=]?\s*N\b/i.test(cleaned)
  ) {
    return 'NÃO';
  }
  return '';
}

function decodeHtmlEntities(text: string): string {
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
  for (const [ent, char] of Object.entries(entities)) {
    out = out.split(ent).join(char);
  }
  return out.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

export function htmlToReadableText(raw: string): string {
  if (!raw) return '';
  // Remover scripts e styles antes de converter
  let text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  // Remover atributos placeholder para que exemplos de tela (ex: SS123456789BR) não sejam confundidos com códigos reais
  text = text.replace(/\splaceholder=["'][^"']*["']/gi, ' ');

  // Preservar valores de inputs caso a tela tenha campos read-only
  text = text.replace(/<input[^>]*value=["']([^"']*)["'][^>]*>/gi, ' $1 ');

  text = text
    .replace(/<(br|\/tr|\/div|\/p|\/li|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(td|th)\b[^>]*>/gi, ' ')
    .replace(/<\/th>/gi, ': ')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);

  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Isola especificamente o bloco do evento Postagem (PO) no texto extraído do SRO.
 */
function isolatePostagemSection(fullText: string): string | null {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  // Padrões que identificam especificamente o evento Postagem (PO)
  const poStartRegex =
    /(?:\bpostagem\s*\(\s*PO\s*\)|evento\s*[:\-]?\s*PO\b|\bPO\s*[-–:]\s*(?:objeto\s+)?postad[oa]|\bobjeto\s+postad[oa]\b|\btipo\s*[:\-]?\s*PO\b)/i;

  // Padrões que indicam o início de OUTRO evento posterior/anterior no histórico do SRO
  const otherEventHeaderRegex =
    /^(?:\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}|(?:BDE|BDI|BDR|BLQ|CAR|CD|CMT|CO|CUN|DO|EST|FC|IDC|LDI|OEC|PAR|PMT|RO|TR)\s*[-–:]|\b(?:Entregue|Saiu para entrega|Objeto encaminhado|Objeto recebido|Objeto em transfer[êe]ncia)\b)/i;

  const startIdx = lines.findIndex(line => poStartRegex.test(line));
  if (startIdx === -1) {
    return null;
  }

  // Coletar a partir do evento PO até encontrar claramente outro evento distinto (se houver tabela de histórico misturada)
  const collected: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (i > startIdx && otherEventHeaderRegex.test(line) && !poStartRegex.test(line)) {
      break;
    }
    collected.push(line);
  }

  return collected.join('\n');
}

function cleanFieldValue(val: string | undefined | null): string {
  if (!val) return '';
  const cleaned = val
    .replace(/^[\s:|]+/, '')
    .replace(/[\s|]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    !cleaned ||
    /^[-–—]+$/.test(cleaned) ||
    /^(?:n[ãa]o informado|n\/i|indispon[ií]vel)$/i.test(cleaned)
  ) {
    return '';
  }
  return cleaned;
}

function extractFirstMatch(text: string, patterns: RegExp[]): string {
  for (const regex of patterns) {
    const m = text.match(regex);
    if (m && m[1]) {
      const val = cleanFieldValue(m[1]);
      if (val) return val;
    }
  }
  return '';
}

/**
 * Faz o parse de conteúdo HTML, texto copiado do SRO Intranet ou JSON estruturado.
 * Garante isolamento exclusivo no evento Postagem (PO).
 */
export function parseSroContent(
  rawInput: string | Partial<SroPostagemData>,
  expectedTrackingCode?: string
): SroParseResult {
  const expectedClean = expectedTrackingCode ? normalizeTrackingCode(expectedTrackingCode) : '';

  if (expectedClean && !isValidTrackingCode(expectedClean) && expectedClean.length < 9) {
    return {
      ok: false,
      errorCode: 'INVALID_CODE',
      message: 'Código de rastreamento inválido para consulta.',
    };
  }

  // Caso já seja JSON estruturado (ex: retorno de API interna ou extensão/agente local)
  if (typeof rawInput === 'object' && rawInput !== null) {
    const code = normalizeTrackingCode(rawInput.codigoRastreamento || expectedClean);
    if (expectedClean && code && code !== expectedClean) {
      return {
        ok: false,
        errorCode: 'OBJECT_NOT_FOUND',
        message: 'Os dados retornados pertencem a outro código de rastreamento e foram descartados.',
      };
    }
    if (!rawInput.eventoEncontrado) {
      return {
        ok: false,
        errorCode: 'PO_EVENT_NOT_FOUND',
        message: 'Evento Postagem (PO) não localizado para este objeto no SRO.',
      };
    }
    return {
      ok: true,
      data: {
        codigoRastreamento: code,
        eventoEncontrado: true,
        pesoGramas: parseWeightToGrams(rawInput.pesoGramas),
        valorDeclarado: parseValorDeclarado(rawInput.valorDeclarado),
        unidadePostagem: (rawInput.unidadePostagem || '').trim().toUpperCase(),
        remetenteNome: (rawInput.remetenteNome || '').trim().toUpperCase(),
        cepRemetente: normalizeCepDigits(rawInput.cepRemetente),
        numeroRemetente: cleanFieldValue(rawInput.numeroRemetente),
        destinatarioNome: (rawInput.destinatarioNome || '').trim().toUpperCase(),
        cepDestinatario: normalizeCepDigits(rawInput.cepDestinatario),
        numeroDestinatario: cleanFieldValue(rawInput.numeroDestinatario),
      },
    };
  }

  const rawText = typeof rawInput === 'string' ? rawInput : '';
  if (!rawText.trim()) {
    return {
      ok: false,
      errorCode: 'PARSE_ERROR',
      message: 'Nenhum conteúdo retornado pelo SRO para análise.',
    };
  }

  // Tentar parse direto se a string for JSON
  if (rawText.trim().startsWith('{')) {
    try {
      const parsedJson = JSON.parse(rawText);
      if (parsedJson && typeof parsedJson === 'object') {
        if (parsedJson.errorCode) {
          return {
            ok: false,
            errorCode: parsedJson.errorCode,
            message: parsedJson.message || 'Erro ao consultar o SRO.',
          };
        }
        return parseSroContent(parsedJson, expectedTrackingCode);
      }
    } catch {
      // Segue como HTML/texto
    }
  }

  const readable = /<[a-z][\s\S]*>/i.test(rawText) ? htmlToReadableText(rawText) : rawText;

  // Verificar página de login / autenticação corporativa
  if (
    /(?:acesso\s+restrito|fa[çc]a\s+login|autentica[çc][ãa]o\s+corporativa|idcorreios|cas\s+login|usu[áa]rio\s+e\s+senha)/i.test(
      readable
    )
  ) {
    return {
      ok: false,
      errorCode: 'AUTH_REQUIRED',
      message:
        'O SRO Intranet exige sessão corporativa autenticada no navegador do usuário.',
    };
  }

  // Verificar objeto não encontrado
  if (
    /(?:objeto\s+n[ãa]o\s+encontrado|nenhum\s+objeto\s+encontrado|dados\s+n[ãa]o\s+encontrados\s+para\s+o\s+objeto|c[óo]digo\s+n[ãa]o\s+encontrado)/i.test(
      readable
    )
  ) {
    return {
      ok: false,
      errorCode: 'OBJECT_NOT_FOUND',
      message: 'Objeto não encontrado no SRO dos Correios.',
    };
  }

  // Verificar se há outro código explícito na resposta diferente do esperado
  // Ignorar códigos fictícios usados pelos Correios como exemplo/placeholder nas telas do SRO
  if (expectedClean) {
    const IGNORED_PLACEHOLDER_CODES = new Set([
      'SS123456789BR',
      'AA123456789BR',
      'BR123456789BR',
      'XX123456789BR',
    ]);
    const rawFoundCodes = readable.toUpperCase().match(/\b[A-Z]{2}\d{9}[A-Z]{2}\b/g) || [];
    const foundCodes = rawFoundCodes.filter((c) => !IGNORED_PLACEHOLDER_CODES.has(c));
    if (foundCodes.length > 0 && !foundCodes.includes(expectedClean)) {
      return {
        ok: false,
        errorCode: 'OBJECT_NOT_FOUND',
        message: `O conteúdo informado refere-se ao objeto ${foundCodes[0]}, diferente do código ${expectedClean}.`,
      };
    }
  }

  // Isolar exclusivamente o evento Postagem (PO)
  const poSection = isolatePostagemSection(readable);
  if (!poSection) {
    return {
      ok: false,
      errorCode: 'PO_EVENT_NOT_FOUND',
      message: 'Evento Postagem (PO) não localizado no histórico retornado pelo SRO.',
    };
  }

  // Separar contextos de Remetente e Destinatário dentro do bloco PO para evitar mistura de "Número Logradouro"
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

  // 1. Peso
  const rawPeso = extractFirstMatch(poSection, [
    /Peso(?:\s*\(\s*kg\s*\)|\s*\(\s*g\s*\))?\s*[:=|]\s*([^\n|;]+)/i,
    /\b(\d+[.,]\d{1,3}\s*kg)\b/i,
    /\b(\d+\s*(?:g|gs))\b/i,
  ]);
  const pesoGramas = parseWeightToGrams(rawPeso);

  // 2. Indicador VD
  const rawVd = extractFirstMatch(poSection, [
    /(?:Indicador\s+)?VD\s*[:=|]\s*([A-Za-zÃã]+)\b/i,
    /Valor\s+Declarado(?:\s*\(\s*VD\s*\))?\s*[:=|]\s*([A-Za-zÃã]+)\b/i,
  ]);
  const valorDeclarado = parseValorDeclarado(rawVd);

  // 3. Unidade de postagem
  const unidadePostagem = extractFirstMatch(poSection, [
    /Unidade(?:\s+de\s+Postagem)?\s*[:=|]\s*([^\n|;]+)/i,
  ]).toUpperCase();

  // 4. Remetente
  const remetenteNome = extractFirstMatch(poSection, [
    /(?:Nome\s+do\s+)?Remetente\s*[:=|]\s*([^\n|;]+)/i,
  ]).toUpperCase();

  const rawCepRem =
    extractFirstMatch(poSection, [
      /CEP\s+(?:do\s+)?Remetente\s*[:=|]\s*([0-9.\-]+)/i,
    ]) ||
    (remIndex >= 0
      ? extractFirstMatch(remBlock, [/CEP\s*[:=|]\s*([0-9.\-]+)/i])
      : '');
  const cepRemetente = normalizeCepDigits(rawCepRem);

  const numeroRemetente =
    extractFirstMatch(poSection, [
      /N[úu]mero\s+(?:Logradouro\s+)?(?:do\s+)?Remetente\s*[:=|]\s*([^\n,;|]+)/i,
    ]) ||
    (remIndex >= 0
      ? extractFirstMatch(remBlock, [
          /N[úu]mero\s+Logradouro\s*[:=|]\s*([^\n,;|]+)/i,
          /N[úu]mero\s*[:=|]\s*([^\n,;|]+)/i,
          /N[º°]\s*[:=|]?\s*([^\n,;|]+)/i,
        ])
      : '');

  // 5. Destinatário
  const destinatarioNome = extractFirstMatch(poSection, [
    /(?:Nome\s+do\s+)?Destinat[áa]rio\s*[:=|]\s*([^\n|;]+)/i,
  ]).toUpperCase();

  const rawCepDest =
    extractFirstMatch(poSection, [
      /CEP\s+(?:do\s+)?Destinat[áa]rio\s*[:=|]\s*([0-9.\-]+)/i,
    ]) ||
    (destIndex >= 0
      ? extractFirstMatch(destBlock, [/CEP\s*[:=|]\s*([0-9.\-]+)/i])
      : '');
  const cepDestinatario = normalizeCepDigits(rawCepDest);

  const numeroDestinatario =
    extractFirstMatch(poSection, [
      /N[úu]mero\s+(?:Logradouro\s+)?(?:do\s+)?Destinat[áa]rio\s*[:=|]\s*([^\n,;|]+)/i,
    ]) ||
    (destIndex >= 0
      ? extractFirstMatch(destBlock, [
          /N[úu]mero\s+Logradouro\s*[:=|]\s*([^\n,;|]+)/i,
          /N[úu]mero\s*[:=|]\s*([^\n,;|]+)/i,
          /N[º°]\s*[:=|]?\s*([^\n,;|]+)/i,
        ])
      : '');

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
      numeroDestinatario,
    },
  };
}
