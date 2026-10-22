import { ObjetoRecord, UnitSettings } from '../types';
import { db } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

const STORAGE_KEY_RECORDS = 'cdd_saomanuel_objetos_v3';
const STORAGE_KEY_SETTINGS = 'cdd_saomanuel_settings_v3';

const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        return window.localStorage.getItem(key);
      }
    } catch (_) {}
    return memoryStorage.get(key) || null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        window.localStorage.setItem(key, value);
      }
    } catch (_) {}
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
    criadoEm: '2026-10-21T07:50:00Z',
    atualizadoEm: '2026-10-21T07:50:00Z',
    historicoEmissoes: [
      {
        id: 'hist-002',
        tipoDocumento: 'termo_individual',
        dataEmissao: '2026-10-21T08:00:00Z',
        versao: 1,
        usuarioOperador: '81149042',
        nomeArquivoGerado: 'Termo_Constatacao_98_AE047282865BR.pdf',
      },
    ],
  },
];

// ==========================================
// FUNÇÕES DE PERSISTÊNCIA COM FIREBASE FIRESTORE
// ==========================================

export function getSettings(): UnitSettings {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: UnitSettings = { 
        ...DEFAULT_SETTINGS, 
        ...parsed, 
        corTextoDigitado: parsed.corTextoDigitado === 'vermelho' ? 'preto' : (parsed.corTextoDigitado || 'preto') 
      };
      merged.numeroSequenciaInicial = Math.max(1, Number(merged.numeroSequenciaInicial) || 1);
      return merged;
    }
  } catch (err) {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UnitSettings): void {
  try {
    safeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {}

  // Sincronizar com Firebase Firestore em segundo plano, usando nome da unidade como ID
  try {
    const unitId = (settings.nomeUnidade || 'padrao').trim().toUpperCase();
    setDoc(doc(db, 'configuracoes', unitId), settings).catch(() => {});
  } catch (e) {}
}

export function getAllRecords(): ObjetoRecord[] {
  let allRecords: ObjetoRecord[] = [];
  try {
    const raw = safeStorage.getItem(STORAGE_KEY_RECORDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        allRecords = parsed;
      }
    }
  } catch (err) {}

  if (allRecords.length === 0) {
    allRecords = INITIAL_SAMPLE_RECORDS;
    saveAllRecords(allRecords);
  }

  // Filtrar estritamente pelos registros da unidade atual (configurada nas Configurações)
  const currentSettings = getSettings();
  const unitName = (currentSettings.nomeUnidade || '').trim().toUpperCase();
  
  if (!unitName) return allRecords;

  const filtered = allRecords.filter(r => {
    const recUnit = (r.unidadeConstatacao || '').trim().toUpperCase();
    // Se o registro não tiver unidade definida ou pertencer à unidade atual, exibe
    return !recUnit || recUnit === unitName;
  });

  return filtered.length > 0 ? filtered : allRecords;
}

export function saveAllRecords(records: ObjetoRecord[]): void {
  try {
    safeStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  } catch (err) {}
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

  // Salvar no Firebase Firestore em nuvem
  try {
    setDoc(doc(db, 'objetos_recondicionados', updatedRecord.id), updatedRecord).catch(() => {});
  } catch (e) {}

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
    records.forEach(r => {
      try {
        setDoc(doc(db, 'objetos_recondicionados', r.id), r).catch(() => {});
      } catch (e) {}
    });
  }
}

export function cancelRecord(id: string): boolean {
  const records = getAllRecords();
  const item = records.find(r => r.id === id);
  if (!item) return false;

  item.status = 'cancelado';
  item.atualizadoEm = new Date().toISOString();
  saveAllRecords(records);

  try {
    setDoc(doc(db, 'objetos_recondicionados', item.id), item).catch(() => {});
  } catch (e) {}

  return true;
}

export function deleteRecord(id: string): boolean {
  const records = getAllRecords();
  const nextRecords = records.filter(r => r.id !== id);
  if (nextRecords.length === records.length) return false;
  saveAllRecords(nextRecords);

  try {
    deleteDoc(doc(db, 'objetos_recondicionados', id)).catch(() => {});
  } catch (e) {}

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
  return {
    status: 'online',
    versao: '3.0-firebase',
    unidade: getSettings().nomeUnidade,
    servidorLocalIps: ['Firebase Firestore Cloud'],
    port: 443,
    urlsAcesso: ['https://' + window.location.host],
    armazenamento: 'Google Firebase Firestore (Nuvem)',
    horarioServidor: new Date().toISOString(),
  };
}

// Sincronização em tempo real com Firebase Firestore
export async function syncWithServer(): Promise<{ records: ObjetoRecord[]; settings: UnitSettings | null } | null> {
  try {
    // Buscar registros do Firestore
    const querySnapshot = await getDocs(collection(db, 'objetos_recondicionados'));
    const cloudRecords: ObjetoRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      cloudRecords.push(docSnap.data() as ObjetoRecord);
    });

    // Buscar configurações do Firestore para a unidade atual
    let cloudSettings: UnitSettings | null = null;
    const currentSettings = getSettings();
    const unitId = (currentSettings.nomeUnidade || 'padrao').trim().toUpperCase();
    const settingsSnap = await getDoc(doc(db, 'configuracoes', unitId));
    if (settingsSnap.exists()) {
      cloudSettings = settingsSnap.data() as UnitSettings;
    }

    if (cloudRecords.length > 0) {
      saveAllRecords(cloudRecords);
    } else {
      // Se a nuvem estiver vazia, sobe os dados locais
      const localRecords = getAllRecords();
      for (const r of localRecords) {
        await setDoc(doc(db, 'objetos_recondicionados', r.id), r).catch(() => {});
      }
    }

    if (cloudSettings && cloudSettings.nomeUnidade) {
      saveSettings(cloudSettings);
    } else {
      const localSettings = getSettings();
      await setDoc(doc(db, 'configuracoes', unitId), localSettings).catch(() => {});
    }

    return {
      records: cloudRecords.length > 0 ? cloudRecords : getAllRecords(),
      settings: cloudSettings || getSettings(),
    };
  } catch (err) {
    return null;
  }
}
