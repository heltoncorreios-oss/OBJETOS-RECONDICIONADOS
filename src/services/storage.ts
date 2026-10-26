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
  mcu: '18650972',
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

// ==========================================
// IDENTIFICAÇÃO E LINKS EXCLUSIVOS POR UNIDADE
// ==========================================

export function getActiveUnitName(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const unitFromParam = params.get('unidade') || params.get('u');
    if (unitFromParam && unitFromParam.trim()) {
      return unitFromParam.trim().toUpperCase();
    }
  }
  try {
    const lastActive = safeStorage.getItem('cdd_active_unit');
    if (lastActive && lastActive.trim()) {
      return lastActive.trim().toUpperCase();
    }
    const raw = safeStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.nomeUnidade) {
        return parsed.nomeUnidade.trim().toUpperCase();
      }
    }
  } catch (e) {}
  return DEFAULT_SETTINGS.nomeUnidade;
}

export function getActiveMcu(): string | null {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const mcuParam = params.get('mcu') || params.get('codigo');
    if (mcuParam && mcuParam.trim()) {
      return mcuParam.trim().replace(/[^0-9A-Za-z]/g, '');
    }
  }
  return safeStorage.getItem('cdd_active_mcu');
}

export function setActiveMcu(mcu: string): void {
  const clean = mcu.trim().replace(/[^0-9A-Za-z]/g, '');
  safeStorage.setItem('cdd_active_mcu', clean);
}

export function hasActiveSession(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mcu') || params.get('unidade') || params.get('u')) {
      return true;
    }
  }
  const activeUnit = safeStorage.getItem('cdd_active_unit');
  const activeMcu = safeStorage.getItem('cdd_active_mcu');
  return !!(activeUnit || activeMcu);
}

export function clearActiveSession(): void {
  safeStorage.removeItem('cdd_active_unit');
  safeStorage.removeItem('cdd_active_mcu');
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.delete('unidade');
    url.searchParams.delete('u');
    url.searchParams.delete('mcu');
    url.searchParams.delete('codigo');
    window.history.replaceState({}, '', url.toString());
  }
}

export function setActiveUnitName(unitName: string, updateUrl = true, mcu?: string): void {
  const clean = unitName.trim().toUpperCase();
  safeStorage.setItem('cdd_active_unit', clean);
  if (mcu) {
    setActiveMcu(mcu);
  }
  if (updateUrl && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('unidade', clean);
    if (mcu) {
      url.searchParams.set('mcu', mcu.trim());
    }
    window.history.replaceState({}, '', url.toString());
  }
}

export function getUnitShareUrl(unitName?: string, mcu?: string): string {
  const unit = (unitName || getActiveUnitName()).trim().toUpperCase();
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('unidade', unit);
    if (mcu) {
      url.searchParams.set('mcu', mcu);
    }
    return url.toString();
  }
  return `?unidade=${encodeURIComponent(unit)}`;
}

export function getUnitSettingsKey(unitName: string): string {
  return `cdd_settings_${unitName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

export async function findUnitByMcu(mcuInput: string): Promise<UnitSettings | null> {
  const clean = mcuInput.trim().replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (!clean) return null;

  // 1. Verificar se coincide com CDD São Manuel
  const defaultMcuClean = (DEFAULT_SETTINGS.mcu || '18650972').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const defaultStoClean = DEFAULT_SETTINGS.codigoSto.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (clean === defaultMcuClean || clean === defaultStoClean || clean === DEFAULT_SETTINGS.nomeUnidade.toUpperCase()) {
    return getSettings(DEFAULT_SETTINGS.nomeUnidade);
  }

  // 2. Buscar no Firestore
  try {
    const querySnapshot = await getDocs(collection(db, 'configuracoes'));
    let foundFirestore: UnitSettings | null = null;

    querySnapshot.forEach(d => {
      if (foundFirestore) return;
      const data = d.data() as UnitSettings;
      const dMcu = (data.mcu || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
      const dSto = (data.codigoSto || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
      const dName = (data.nomeUnidade || '').trim().toUpperCase();
      if (dMcu === clean || dSto === clean || dName === clean || d.id.toUpperCase() === clean) {
        foundFirestore = data;
      }
    });

    if (foundFirestore) {
      return foundFirestore;
    }
  } catch (err) {}

  return null;
}

export async function getAllRegisteredUnitsList(): Promise<UnitSettings[]> {
  const unitsMap = new Map<string, UnitSettings>();

  // Unidade CDD São Manuel sempre disponível
  unitsMap.set(DEFAULT_SETTINGS.nomeUnidade, DEFAULT_SETTINGS);

  try {
    const querySnapshot = await getDocs(collection(db, 'configuracoes'));
    querySnapshot.forEach(d => {
      const data = d.data() as UnitSettings;
      if (data && data.nomeUnidade && d.id !== 'unidade' && d.id !== 'padrao') {
        unitsMap.set(data.nomeUnidade.trim().toUpperCase(), data);
      }
    });
  } catch (err) {}

  return Array.from(unitsMap.values());
}

// ==========================================
// FUNÇÕES DE PERSISTÊNCIA COM FIREBASE FIRESTORE
// ==========================================

export function getSettings(targetUnit?: string): UnitSettings {
  const unit = (targetUnit || getActiveUnitName()).trim().toUpperCase();
  const key = getUnitSettingsKey(unit);
  try {
    const raw = safeStorage.getItem(key) || (unit === DEFAULT_SETTINGS.nomeUnidade ? safeStorage.getItem(STORAGE_KEY_SETTINGS) : null);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: UnitSettings = { 
        ...DEFAULT_SETTINGS, 
        ...parsed, 
        nomeUnidade: unit,
        corTextoDigitado: parsed.corTextoDigitado === 'vermelho' ? 'preto' : (parsed.corTextoDigitado || 'preto') 
      };
      merged.numeroSequenciaInicial = Math.max(1, Number(merged.numeroSequenciaInicial) || 1);
      return merged;
    }
  } catch (err) {}

  if (unit === DEFAULT_SETTINGS.nomeUnidade) {
    return DEFAULT_SETTINGS;
  }

  // Configurações padrão limpas para uma nova unidade com sequencial iniciando em 1
  return {
    ...DEFAULT_SETTINGS,
    nomeUnidade: unit,
    codigoSto: '00000-000',
    chefeNome: '',
    chefeMatricula: '',
    operadorMatriculaPadrao: '',
    operadorPadraoNome: '',
    numeroSequenciaInicial: 1,
    sequencialGeral: 0,
    ultimoSequencialAno: {},
    ultimoSequencialMes: {},
  };
}

export function saveSettings(settings: UnitSettings): void {
  const unit = (settings.nomeUnidade || 'PADRAO').trim().toUpperCase();
  const key = getUnitSettingsKey(unit);

  try {
    safeStorage.setItem(key, JSON.stringify(settings));
    safeStorage.setItem('cdd_active_unit', unit);
    if (settings.mcu) {
      setActiveMcu(settings.mcu);
    }
    safeStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {}

  // Sincronizar com Firebase Firestore usando o nome da unidade como ID do documento
  try {
    setDoc(doc(db, 'configuracoes', unit), settings).catch(() => {});
  } catch (e) {}
}

export function getRawAllRecords(): ObjetoRecord[] {
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

  return allRecords;
}

export function getAllRecords(targetUnit?: string): ObjetoRecord[] {
  const allRecords = getRawAllRecords();
  const unitName = (targetUnit || getActiveUnitName()).trim().toUpperCase();
  
  if (!unitName) return allRecords;

  return allRecords.filter(r => {
    const recUnit = (r.unidadeConstatacao || '').trim().toUpperCase();
    return recUnit === unitName;
  });
}

export function saveAllRecords(records: ObjetoRecord[]): void {
  try {
    safeStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  } catch (err) {}
}

export function getRecordById(id: string): ObjetoRecord | undefined {
  const all = getRawAllRecords();
  return all.find(r => r.id === id);
}

export function getRecordsByMonth(ano: number, mes: number, targetUnit?: string): ObjetoRecord[] {
  const records = getAllRecords(targetUnit);
  return records
    .filter(r => r.anoReferencia === ano && r.mesReferencia === mes && r.status !== 'cancelado')
    .sort((a, b) => {
      if (a.dataConstatacao !== b.dataConstatacao) {
        return a.dataConstatacao.localeCompare(b.dataConstatacao);
      }
      return a.itemNumero - b.itemNumero;
    });
}

export function getNextItemNumber(dataConstatacao: string, excludeId?: string, targetUnit?: string): number {
  const records = getAllRecords(targetUnit).filter(r => r.dataConstatacao === dataConstatacao && r.id !== excludeId && r.status !== 'cancelado');
  if (records.length === 0) return 1;
  const maxItem = Math.max(...records.map(r => r.itemNumero || 0));
  return maxItem + 1;
}

export function checkDuplicateTracking(codigo: string, excludeId?: string, targetUnit?: string): ObjetoRecord | null {
  const cleanCode = codigo.trim().toUpperCase();
  if (!cleanCode) return null;
  const records = getAllRecords(targetUnit);
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

export function allocateNextTermoNumber(dataConstatacao: string, targetUnit?: string): { numeroFormatado: string; sequencial: number } {
  const activeUnit = targetUnit || getActiveUnitName();
  const settings = getSettings(activeUnit);
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
  const activeUnit = (record.unidadeConstatacao || getActiveUnitName()).trim().toUpperCase();
  const allRecords = getRawAllRecords();
  const existingIdx = allRecords.findIndex(r => r.id === record.id);
  const now = new Date().toISOString();

  let updatedRecord: ObjetoRecord = {
    ...record,
    unidadeConstatacao: activeUnit,
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
    allRecords[existingIdx] = updatedRecord;
  } else {
    updatedRecord.criadoEm = now;
    allRecords.push(updatedRecord);

    const settings = getSettings(activeUnit);
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

  saveAllRecords(allRecords);

  // Salvar no Firebase Firestore em nuvem
  try {
    setDoc(doc(db, 'objetos_recondicionados', updatedRecord.id), updatedRecord).catch(() => {});
  } catch (e) {}

  return updatedRecord;
}

export function logControleMensalEmissao(ano: number, mes: number, operador: string, fileName: string): void {
  const allRecords = getRawAllRecords();
  const currentUnit = getActiveUnitName();
  const now = new Date().toISOString();
  let changed = false;

  allRecords.forEach(r => {
    const rUnit = (r.unidadeConstatacao || '').trim().toUpperCase();
    if (rUnit === currentUnit && r.anoReferencia === ano && r.mesReferencia === mes && r.status !== 'cancelado') {
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
    saveAllRecords(allRecords);
    allRecords.forEach(r => {
      const rUnit = (r.unidadeConstatacao || '').trim().toUpperCase();
      if (rUnit === currentUnit) {
        try {
          setDoc(doc(db, 'objetos_recondicionados', r.id), r).catch(() => {});
        } catch (e) {}
      }
    });
  }
}

export function cancelRecord(id: string): boolean {
  const allRecords = getRawAllRecords();
  const item = allRecords.find(r => r.id === id);
  if (!item) return false;

  item.status = 'cancelado';
  item.atualizadoEm = new Date().toISOString();
  saveAllRecords(allRecords);

  try {
    setDoc(doc(db, 'objetos_recondicionados', item.id), item).catch(() => {});
  } catch (e) {}

  return true;
}

export function deleteRecord(id: string): boolean {
  const allRecords = getRawAllRecords();
  const nextRecords = allRecords.filter(r => r.id !== id);
  if (nextRecords.length === allRecords.length) return false;
  saveAllRecords(nextRecords);

  try {
    deleteDoc(doc(db, 'objetos_recondicionados', id)).catch(() => {});
  } catch (e) {}

  return true;
}

export function exportDataToJson(targetUnit?: string): string {
  const unit = targetUnit || getActiveUnitName();
  const data = {
    versaoExport: '3.0',
    dataExportacao: new Date().toISOString(),
    settings: getSettings(unit),
    records: getAllRecords(unit),
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
    
    // Mesclar com registros existentes para não apagar outras unidades
    const all = getRawAllRecords();
    const map = new Map<string, ObjetoRecord>();
    all.forEach(r => map.set(r.id, r));
    data.records.forEach((r: ObjetoRecord) => map.set(r.id, r));
    const merged = Array.from(map.values());
    saveAllRecords(merged);

    // Salvar no Firestore
    for (const r of data.records) {
      try {
        setDoc(doc(db, 'objetos_recondicionados', r.id), r).catch(() => {});
      } catch (e) {}
    }

    return { success: true, count: data.records.length };
  } catch (err: unknown) {
    return { success: false, count: 0, error: err instanceof Error ? err.message : 'Erro ao analisar arquivo JSON.' };
  }
}

export function setSequencialManual(novoSequencial: number, targetUnit?: string): UnitSettings {
  const activeUnit = targetUnit || getActiveUnitName();
  const settings = getSettings(activeUnit);
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
  const all = getRawAllRecords().filter(r => (r.unidadeConstatacao || '').toUpperCase() !== DEFAULT_SETTINGS.nomeUnidade);
  saveAllRecords([...all, ...INITIAL_SAMPLE_RECORDS]);
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
  const unit = getActiveUnitName();
  return {
    status: 'online',
    versao: '3.0-firebase-multi-unidade',
    unidade: unit,
    servidorLocalIps: ['Firebase Firestore Cloud'],
    port: 443,
    urlsAcesso: [getUnitShareUrl(unit)],
    armazenamento: 'Google Firebase Firestore (Nuvem Compartilhada)',
    horarioServidor: new Date().toISOString(),
  };
}

// Sincronização em tempo real com Firebase Firestore
export async function syncWithServer(customUnit?: string): Promise<{ records: ObjetoRecord[]; settings: UnitSettings | null } | null> {
  try {
    const activeUnit = (customUnit || getActiveUnitName()).trim().toUpperCase();

    // 1. Buscar registros do Firestore
    const querySnapshot = await getDocs(collection(db, 'objetos_recondicionados'));
    const cloudRecords: ObjetoRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      cloudRecords.push(docSnap.data() as ObjetoRecord);
    });

    if (cloudRecords.length > 0) {
      saveAllRecords(cloudRecords);
    } else {
      // Se a nuvem estiver vazia, sobe os dados locais de exemplo para São Manuel
      if (activeUnit === DEFAULT_SETTINGS.nomeUnidade) {
        saveAllRecords(INITIAL_SAMPLE_RECORDS);
        for (const r of INITIAL_SAMPLE_RECORDS) {
          await setDoc(doc(db, 'objetos_recondicionados', r.id), r).catch(() => {});
        }
      }
    }

    // 2. Buscar configurações da unidade ativa no Firestore
    let cloudSettings: UnitSettings | null = null;
    const settingsSnap = await getDoc(doc(db, 'configuracoes', activeUnit));
    if (settingsSnap.exists()) {
      cloudSettings = settingsSnap.data() as UnitSettings;
      saveSettings(cloudSettings);
    } else {
      const localSettings = getSettings(activeUnit);
      await setDoc(doc(db, 'configuracoes', activeUnit), localSettings).catch(() => {});
    }

    return {
      records: getAllRecords(activeUnit),
      settings: cloudSettings || getSettings(activeUnit),
    };
  } catch (err) {
    return null;
  }
}

export async function getRegisteredUnits(): Promise<string[]> {
  const unitsSet = new Set<string>();
  unitsSet.add('CDD SÃO MANUEL');
  
  const allLocal = getRawAllRecords();
  allLocal.forEach(r => {
    if (r.unidadeConstatacao && r.unidadeConstatacao.trim()) {
      unitsSet.add(r.unidadeConstatacao.trim().toUpperCase());
    }
  });

  try {
    const snap = await getDocs(collection(db, 'configuracoes'));
    snap.forEach(d => {
      if (d.id && d.id !== 'unidade' && d.id !== 'padrao') {
        unitsSet.add(d.id.trim().toUpperCase());
      }
    });
  } catch (e) {}

  return Array.from(unitsSet).sort();
}
