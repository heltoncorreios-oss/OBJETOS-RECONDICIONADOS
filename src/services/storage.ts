import { ObjetoRecord, UnitSettings } from '../types';

const STORAGE_KEY_RECORDS = 'cdd_saomanuel_objetos_v3';
const STORAGE_KEY_SETTINGS = 'cdd_saomanuel_settings_v3';

// Armazenamento em memória seguro caso o navegador/iframe bloqueie o localStorage
const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        return window.localStorage.getItem(key);
      }
    } catch (_) {
      // Bloqueio de sandbox/iframe ou cookies desativados
    }
    return memoryStorage.get(key) || null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.setItem(key, value);
      }
    } catch (_) {
      // Bloqueio de sandbox/iframe ou cota cheia
    }
    memoryStorage.set(key, value);
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.removeItem(key);
      }
    } catch (_) {}
    memoryStorage.delete(key);
  }
};

export const DEFAULT_SETTINGS: UnitSettings = {
  nomeUnidade: 'CDD SÃO MANUEL',
  dr: 'SPI',
  codigoSto: '18650-972',
  cidade: 'São Manuel',
  uf: 'SP',
  chefeNome: 'HELTON JULIO SANTOS MANUEL',
  chefeMatricula: '8.114.904-2',
  operadorMatriculaPadrao: '81149042',
  operadorPadraoNome: 'Helton Correios',
  destinoPadrao: '18650065',
  reiniciarNumeracao: 'anual',
  formatoNumeroTermo: 'simples',
  numeroSequenciaInicial: 1,
  ultimoSequencialAno: { '2026': 99 },
  ultimoSequencialMes: { '2026-10': 99 },
  sequencialGeral: 99,
  corTextoDigitado: 'preto',
};

// Registros fiéis às imagens de referência enviadas pelo usuário
export const INITIAL_SAMPLE_RECORDS: ObjetoRecord[] = [
  {
    id: 'rec-001',
    dataConstatacao: '2026-10-14',
    diaDoMes: 14,
    mesReferencia: 10,
    anoReferencia: 2026,
    itemNumero: 1,
    termoNumero: '97',
    anoCorrente: 2026,
    codigoRastreamento: 'QN971743142BR',
    unidadeConstatacao: 'CDD SÃO MANUEL',
    dr: 'SPI',
    codigoSto: '18650-972',
    pesoPostalGramas: 14730,
    pesoRealGramas: 13260,
    valorDeclaradoTexto: 'NC',
    unidadePostagem: 'AGF ALONSO LOPEZ - CAJAMAR / SP',
    unidadeDestinoCodigo: '18654066',
    remetenteNome: 'ALONSO LOPEZ DISTRIBUIDORA E LOGÍSTICA',
    remetenteEndereco: 'AV. DAS NAÇÕES, 1500 - DISTRITO INDUSTRIAL, CAJAMAR/SP',
    destinatarioNome: 'COMERCIAL AGRICOLA SÃO MANUEL LTDA',
    destinatarioEndereco: 'RODOVIA MARECHAL RONDON KM 274, SÃO MANUEL/SP',
    anomalias: {
      embalagemMolhadaParcialmente: false,
      conteudoBalancando: true,
      conteudoExtravasandoLiquido: false,
      embalagemDilaceradaMostraConteudo: true,
      embalagemIntactaSemCondicoes: false,
      conteudoAvariado: false,
      embalagemDilaceradaTotalmenteAvariado: false,
      embalagemIntactaMolhadaSemCondicoes: false,
      outrasOcorrencias: false,
      outrasOcorrenciasTexto: '',
    },
    motivoResumo: 'EMBALAGEM ABERTA',
    aiTcCie: 'SEQUENCIA DO SISTEMA',
    providencias: {
      tipo: 'recondicionado_encaminhado',
      recondicionadoDescricao: 'Recondicionado com fita gomada ECT',
    },
    operadorMatricula: '81149042',
    operadorNome: 'Helton Correios',
    chefeNome: 'HELTON JULIO SANTOS MANUEL',
    chefeMatricula: '8.114.904-2',
    declaracao: {
      tipoCliente: 'destinatario',
      tipo: 'aceite_sem_contestacao',
      nomeCliente: 'COMERCIAL AGRICOLA SÃO MANUEL LTDA',
      dataDeclaracao: '2026-10-15',
    },
    status: 'termo_emitido',
    versaoDocumento: 1,
    criadoEm: '2026-10-14T08:00:00Z',
    atualizadoEm: '2026-10-14T08:00:00Z',
    historicoEmissoes: [
      {
        id: 'hist-001',
        tipoDocumento: 'termo_individual',
        dataEmissao: '2026-10-14T08:15:00Z',
        versao: 1,
        usuarioOperador: '81149042',
        nomeArquivoGerado: 'Termo_Constatacao_97_QN971743142BR.pdf',
      },
    ],
  },
  {
    id: 'rec-002',
    dataConstatacao: '2026-10-21',
    diaDoMes: 21,
    mesReferencia: 10,
    anoReferencia: 2026,
    itemNumero: 1,
    termoNumero: '98',
    anoCorrente: 2026,
    codigoRastreamento: 'AE047282865BR',
    unidadeConstatacao: 'CDD SÃO MANUEL',
    dr: 'SPI',
    codigoSto: '18650-972',
    pesoPostalGramas: 980,
    pesoRealGramas: 980,
    valorDeclaradoTexto: 'NC',
    unidadePostagem: 'AGF RIO BRANCO - BAURU / SP',
    unidadeDestinoCodigo: '18654570',
    remetenteNome: 'FARMÁCIA CENTRAL DE MANIPULAÇÃO BAURU',
    remetenteEndereco: 'RUA RIO BRANCO, 450 - CENTRO, BAURU/SP',
    destinatarioNome: 'CARLOS EDUARDO DE SOUZA',
    destinatarioEndereco: 'RUA SETE DE SETEMBRO, 112 - VILA KENNEDY, SÃO MANUEL/SP',
    anomalias: {
      embalagemMolhadaParcialmente: true,
      conteudoBalancando: false,
      conteudoExtravasandoLiquido: false,
      embalagemDilaceradaMostraConteudo: false,
      embalagemIntactaSemCondicoes: false,
      conteudoAvariado: false,
      embalagemDilaceradaTotalmenteAvariado: false,
      embalagemIntactaMolhadaSemCondicoes: true,
      outrasOcorrencias: false,
      outrasOcorrenciasTexto: '',
    },
    motivoResumo: 'MOLHADA',
    aiTcCie: 'SEQUENCIA DO SISTEMA',
    providencias: {
      tipo: 'recondicionado_encaminhado',
      recondicionadoDescricao: 'Secagem externa e fita adesiva ECT',
    },
    operadorMatricula: '81149042',
    operadorNome: 'Helton Correios',
    chefeNome: 'HELTON JULIO SANTOS MANUEL',
    chefeMatricula: '8.114.904-2',
    declaracao: {
      tipoCliente: 'destinatario',
      tipo: 'aceite_sem_contestacao',
      nomeCliente: 'CARLOS EDUARDO DE SOUZA',
      dataDeclaracao: '2026-10-21',
    },
    status: 'termo_emitido',
    versaoDocumento: 1,
    criadoEm: '2026-10-21T07:30:00Z',
    atualizadoEm: '2026-10-21T07:30:00Z',
    historicoEmissoes: [
      {
        id: 'hist-002',
        tipoDocumento: 'termo_individual',
        dataEmissao: '2026-10-21T07:45:00Z',
        versao: 1,
        usuarioOperador: '81149042',
        nomeArquivoGerado: 'Termo_Constatacao_98_AE047282865BR.pdf',
      },
    ],
  },
  {
    // O Exato registro da foto 1 do Termo de Constatação:
    id: 'rec-003',
    dataConstatacao: '2026-10-21',
    diaDoMes: 21,
    mesReferencia: 10,
    anoReferencia: 2026,
    itemNumero: 2,
    termoNumero: '99',
    anoCorrente: 2026,
    codigoRastreamento: 'Ae047884658br',
    unidadeConstatacao: 'CDD SÃO MANUEL',
    dr: 'SPI',
    codigoSto: '18650-972',
    pesoPostalGramas: 760,
    pesoRealGramas: 760,
    valorDeclaradoTexto: 'NC',
    unidadePostagem: 'AC PIRAPOZINHO - PIRAPOZINHO / SP',
    unidadeDestinoCodigo: '18650065',
    remetenteNome: 'SUMETAL IND E COM DE BOT E FIVELAS DE METAL LTDA',
    remetenteEndereco: 'RUA GOTARDO PELIN, 206',
    destinatarioNome: 'BOA NOVA COMERCIAL AGROPECUÁRIA E PARTICIPAÇÕES',
    destinatarioEndereco: 'RUA XV DE NOVEMBRO 792',
    anomalias: {
      embalagemMolhadaParcialmente: true,
      conteudoBalancando: false,
      conteudoExtravasandoLiquido: false,
      embalagemDilaceradaMostraConteudo: false,
      embalagemIntactaSemCondicoes: false,
      conteudoAvariado: false,
      embalagemDilaceradaTotalmenteAvariado: false,
      embalagemIntactaMolhadaSemCondicoes: false,
      outrasOcorrencias: true,
      outrasOcorrenciasTexto: 'ENCAMINHADA PARA AC SÃO MANUEL',
    },
    motivoResumo: 'MOLHADA',
    aiTcCie: 'SEQUENCIA DO SISTEMA',
    providencias: {
      tipo: 'outras',
      outrasDescricao: 'ENCAMINHADA PARA AC SÃO MANUEL',
    },
    operadorMatricula: '81149042',
    operadorNome: 'Helton Correios',
    chefeNome: 'HELTON JULIO SANTOS MANUEL',
    chefeMatricula: '8.114.904-2',
    declaracao: {
      tipoCliente: 'destinatario',
      tipo: 'aceite_sem_contestacao',
      nomeCliente: 'BOA NOVA COMERCIAL AGROPECUÁRIA E PARTICIPAÇÕES',
      dataDeclaracao: '2026-10-21',
    },
    status: 'termo_emitido',
    versaoDocumento: 1,
    criadoEm: '2026-10-21T07:50:00Z',
    atualizadoEm: '2026-10-21T07:50:00Z',
    historicoEmissoes: [
      {
        id: 'hist-003',
        tipoDocumento: 'termo_individual',
        dataEmissao: '2026-10-21T08:00:00Z',
        versao: 1,
        usuarioOperador: '81149042',
        nomeArquivoGerado: 'Termo_Constatacao_99_Ae047884658br.pdf',
      },
    ],
  },
];

export function getSettings(): UnitSettings {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Padrão solicitado pelo usuário: fontes pretas
      const merged: UnitSettings = { 
        ...DEFAULT_SETTINGS, 
        ...parsed, 
        corTextoDigitado: parsed.corTextoDigitado === 'vermelho' ? 'preto' : (parsed.corTextoDigitado || 'preto') 
      };
      merged.numeroSequenciaInicial = Math.max(1, Number(merged.numeroSequenciaInicial) || 1);
      return merged;
    }
  } catch (err) {
    // Fallback silencioso para DEFAULT_SETTINGS
  }
  return DEFAULT_SETTINGS;
}

// Helpers de sincronização em segundo plano com o Servidor Local
function syncRecordToServer(record: ObjetoRecord) {
  try {
    fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch(() => {});
  } catch (e) {}
}

function deleteRecordOnServer(id: string) {
  try {
    fetch(`/api/records/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch (e) {}
}

function syncSettingsToServer(settings: UnitSettings) {
  try {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch(() => {});
  } catch (e) {}
}

export function saveSettings(settings: UnitSettings): void {
  try {
    safeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    // Ignora erro de cota ou bloqueio de storage
  }
  syncSettingsToServer(settings);
}

export function getAllRecords(): ObjetoRecord[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_RECORDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    // Fallback silencioso
  }
  saveAllRecords(INITIAL_SAMPLE_RECORDS);
  return INITIAL_SAMPLE_RECORDS;
}

export function saveAllRecords(records: ObjetoRecord[]): void {
  try {
    safeStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  } catch (err) {
    // Armazenamento em memória seguro ativo
  }
}

export function getRecordById(id: string): ObjetoRecord | undefined {
  const records = getAllRecords();
  return records.find(r => r.id === id);
}

export function getRecordsByMonth(ano: number, mes: number): ObjetoRecord[] {
  const records = getAllRecords();
  return records
    .filter(r => r.anoReferencia === ano && r.mesReferencia === mes && r.status !== 'cancelado')
    .sort((a, b) => {
      if (a.dataConstatacao !== b.dataConstatacao) {
        return a.dataConstatacao.localeCompare(b.dataConstatacao);
      }
      return a.itemNumero - b.itemNumero;
    });
}

export function getNextItemNumber(dataConstatacao: string, excludeId?: string): number {
  const records = getAllRecords().filter(r => r.dataConstatacao === dataConstatacao && r.id !== excludeId && r.status !== 'cancelado');
  if (records.length === 0) return 1;
  const maxItem = Math.max(...records.map(r => r.itemNumero || 0));
  return maxItem + 1;
}

export function checkDuplicateTracking(codigo: string, excludeId?: string): ObjetoRecord | null {
  const cleanCode = codigo.trim().toUpperCase();
  if (!cleanCode) return null;
  const records = getAllRecords();
  const found = records.find(r => r.codigoRastreamento.trim().toUpperCase() === cleanCode && r.id !== excludeId && r.status !== 'cancelado');
  return found || null;
}

export function calculateNextTermoNumber(
  _dataConstatacao?: string,
  customSettings?: UnitSettings
): { numeroFormatado: string; sequencial: number } {
  const settings = customSettings || getSettings();
  
  // Fonte da verdade: a sequência configurada pelo usuário nas Configurações
  const nextSeq = Math.max(1, Number(settings.numeroSequenciaInicial) || 1);

  const numeroFormatado = settings.formatoNumeroTermo === 'com_zeros' 
    ? String(nextSeq).padStart(5, '0') 
    : String(nextSeq);

  return { numeroFormatado, sequencial: nextSeq };
}

export function allocateNextTermoNumber(dataConstatacao: string): { numeroFormatado: string; sequencial: number } {
  const settings = getSettings();
  const { numeroFormatado, sequencial } = calculateNextTermoNumber(dataConstatacao, settings);
  
  const dateObj = new Date(dataConstatacao + 'T12:00:00Z');
  const ano = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
  const mes = (isNaN(dateObj.getMonth()) ? new Date().getMonth() : dateObj.getMonth()) + 1;
  const mesKey = `${ano}-${String(mes).padStart(2, '0')}`;
  const anoKey = String(ano);

  settings.ultimoSequencialAno = { ...(settings.ultimoSequencialAno || {}), [anoKey]: sequencial };
  settings.ultimoSequencialMes = { ...(settings.ultimoSequencialMes || {}), [mesKey]: sequencial };
  settings.sequencialGeral = sequencial;
  settings.numeroSequenciaInicial = sequencial + 1;

  saveSettings(settings);
  return { numeroFormatado, sequencial };
}

export function saveRecord(record: ObjetoRecord, markAsEmitted = false, fileName?: string): ObjetoRecord {
  const records = getAllRecords();
  const existingIdx = records.findIndex(r => r.id === record.id);
  const now = new Date().toISOString();

  let updatedRecord: ObjetoRecord = {
    ...record,
    atualizadoEm: now,
  };

  if (markAsEmitted) {
    const newVersion = (updatedRecord.versaoDocumento || 1) + (existingIdx >= 0 ? 1 : 0);
    updatedRecord.status = existingIdx >= 0 && record.status === 'termo_emitido' ? 'reemitido' : 'termo_emitido';
    updatedRecord.versaoDocumento = newVersion;
    
    const safeTermo = record.termoNumero.replace(/[^a-zA-Z0-9]/g, '_');
    const emissionEntry = {
      id: 'emit-' + Date.now(),
      tipoDocumento: 'termo_individual' as const,
      dataEmissao: now,
      versao: newVersion,
      usuarioOperador: record.operadorMatricula || '81149042',
      nomeArquivoGerado: fileName || `Termo_Constatacao_${safeTermo}_${record.codigoRastreamento}.pdf`,
    };

    updatedRecord.historicoEmissoes = [
      ...(updatedRecord.historicoEmissoes || []),
      emissionEntry,
    ];
  }

  if (existingIdx >= 0) {
    records[existingIdx] = updatedRecord;
  } else {
    updatedRecord.criadoEm = now;
    records.push(updatedRecord);

    // Quando um novo registro é salvo, avançamos a sequência automaticamente (+1) a partir do termo salvo
    const settings = getSettings();
    const parsedTermo = parseInt(record.termoNumero, 10);
    const baseSeq = !isNaN(parsedTermo) && parsedTermo > 0 ? parsedTermo : (settings.numeroSequenciaInicial || 1);
    const nextSeq = baseSeq + 1;

    const dateObj = new Date((record.dataConstatacao || '') + 'T12:00:00Z');
    const ano = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
    const mes = (isNaN(dateObj.getMonth()) ? new Date().getMonth() : dateObj.getMonth()) + 1;
    const mesKey = `${ano}-${String(mes).padStart(2, '0')}`;
    const anoKey = String(ano);

    settings.numeroSequenciaInicial = nextSeq;
    settings.ultimoSequencialAno = { ...(settings.ultimoSequencialAno || {}), [anoKey]: baseSeq };
    settings.ultimoSequencialMes = { ...(settings.ultimoSequencialMes || {}), [mesKey]: baseSeq };
    settings.sequencialGeral = baseSeq;

    saveSettings(settings);
  }

  saveAllRecords(records);
  syncRecordToServer(updatedRecord);
  return updatedRecord;
}

export function logControleMensalEmissao(ano: number, mes: number, operador: string, fileName: string): void {
  const records = getAllRecords();
  const now = new Date().toISOString();
  let changed = false;

  records.forEach(r => {
    if (r.anoReferencia === ano && r.mesReferencia === mes && r.status !== 'cancelado') {
      r.historicoEmissoes = r.historicoEmissoes || [];
      r.historicoEmissoes.push({
        id: 'hist-cm-' + Date.now() + '-' + r.id,
        tipoDocumento: 'controle_mensal',
        dataEmissao: now,
        versao: (r.versaoDocumento || 1),
        usuarioOperador: operador,
        nomeArquivoGerado: fileName,
      });
      changed = true;
    }
  });

  if (changed) {
    saveAllRecords(records);
    // Sincronizar em lote para persistir os históricos de emissão
    fetch('/api/records/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    }).catch(() => {});
  }
}

export function cancelRecord(id: string): boolean {
  const records = getAllRecords();
  const item = records.find(r => r.id === id);
  if (!item) return false;

  item.status = 'cancelado';
  item.atualizadoEm = new Date().toISOString();
  saveAllRecords(records);
  syncRecordToServer(item);
  return true;
}

export function deleteRecord(id: string): boolean {
  const records = getAllRecords();
  const nextRecords = records.filter(r => r.id !== id);
  if (nextRecords.length === records.length) return false;
  saveAllRecords(nextRecords);
  deleteRecordOnServer(id);
  return true;
}

export function exportDataToJson(): string {
  const data = {
    versaoExport: '3.0',
    dataExportacao: new Date().toISOString(),
    settings: getSettings(),
    records: getAllRecords(),
  };
  return JSON.stringify(data, null, 2);
}

export function importDataFromJson(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.records || !Array.isArray(data.records)) {
      return { success: false, count: 0, error: 'Formato de arquivo inválido: ausência de registros.' };
    }
    if (data.settings) {
      saveSettings(data.settings);
    }
    saveAllRecords(data.records);
    return { success: true, count: data.records.length };
  } catch (err: unknown) {
    return { success: false, count: 0, error: err instanceof Error ? err.message : 'Erro ao analisar arquivo JSON.' };
  }
}

export function setSequencialManual(novoSequencial: number): UnitSettings {
  const settings = getSettings();
  const dateObj = new Date();
  const ano = dateObj.getFullYear();
  const mes = dateObj.getMonth() + 1;
  const mesKey = `${ano}-${String(mes).padStart(2, '0')}`;
  const anoKey = String(ano);

  const cleanSeq = Math.max(1, Number(novoSequencial) || 1);
  const valorDefinido = cleanSeq - 1;

  settings.numeroSequenciaInicial = cleanSeq;
  settings.ultimoSequencialAno = { [anoKey]: valorDefinido };
  settings.ultimoSequencialMes = { [mesKey]: valorDefinido };
  settings.sequencialGeral = valorDefinido;

  saveSettings(settings);
  return settings;
}

export function resetToSampleData(): void {
  saveSettings(DEFAULT_SETTINGS);
  saveAllRecords(INITIAL_SAMPLE_RECORDS);
}

export interface ServerStatusInfo {
  status: string;
  versao: string;
  unidade: string;
  servidorLocalIps: string[];
  port: number;
  urlsAcesso: string[];
  armazenamento: string;
  horarioServidor: string;
}

export async function getServerStatus(): Promise<ServerStatusInfo | null> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function syncWithServer(): Promise<{ records: ObjetoRecord[]; settings: UnitSettings | null } | null> {
  try {
    const res = await fetch('/api/records');
    if (!res.ok) return null;
    const serverRecords: ObjetoRecord[] = await res.json();

    let serverSettings: UnitSettings | null = null;
    try {
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        if (s && s.nomeUnidade) serverSettings = s;
      }
    } catch (e) {}

    // Se o servidor tiver registros, atualiza localmente
    if (Array.isArray(serverRecords) && serverRecords.length > 0) {
      safeStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(serverRecords));
    } else {
      // Se o servidor estiver vazio, sincroniza os registros locais para o servidor central
      const localRecords = getAllRecords();
      if (localRecords.length > 0) {
        await fetch('/api/records/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: localRecords }),
        }).catch(() => {});
      }
    }

    if (serverSettings && serverSettings.nomeUnidade) {
      safeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(serverSettings));
    } else {
      const localSettings = getSettings();
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSettings),
      }).catch(() => {});
    }

    return {
      records: serverRecords.length > 0 ? serverRecords : getAllRecords(),
      settings: serverSettings || getSettings(),
    };
  } catch (err) {
    return null;
  }
}

