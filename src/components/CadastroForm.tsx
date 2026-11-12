import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Package, 
  Save, 
  FileCheck2, 
  AlertCircle, 
  User, 
  ClipboardList, 
  ShieldCheck, 
  Building2,
  Trash2,
  Loader2,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ClipboardPaste,
  Settings2,
  Download
} from 'lucide-react';
import { ObjetoRecord, UnitSettings, ProvidenciaTipo } from '../types';
import { 
  calculateNextTermoNumber,
  checkDuplicateTracking, 
  getNextItemNumber, 
  saveRecord 
} from '../services/storage';
import { CORREIOS_LOGO_SRC } from '../assets/correiosLogo';
import {
  isValidTrackingCode,
  normalizeTrackingCode,
} from '../services/sroParser';
import {
  consultarObjetoSroEContatos,
  getConfiguredSroAgentUrl,
  getDetectedExtensionInfo,
  processarConteudoSroReal,
  setConfiguredSroAgentUrl,
  SRO_INTRANET_URL,
  SroAutoFillData,
  SroConsultationResult,
} from '../services/sroService';

type MappedAutoField =
  | 'pesoPostalGramas'
  | 'valorDeclaradoTexto'
  | 'unidadeDestinoCodigo'
  | 'unidadePostagem'
  | 'remetenteNome'
  | 'remetenteEndereco'
  | 'destinatarioNome'
  | 'destinatarioEndereco';

interface SroUiStatus {
  phase: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  message: string;
  technicalDetail?: string;
  errorCode?: SroConsultationResult['errorCode'];
  avisos?: string[];
}

interface CadastroFormProps {
  settings: UnitSettings;
  editingRecord?: ObjetoRecord | null;
  onSaveSuccess: (savedRecord: ObjetoRecord, shouldOpenPdf: boolean) => void;
  onCancel: () => void;
  onDelete?: (record: ObjetoRecord) => void;
}

export const CadastroForm: React.FC<CadastroFormProps> = ({
  settings,
  editingRecord,
  onSaveSuccess,
  onCancel,
  onDelete,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  // CAMPOS DIGITADOS
  const [dataConstatacao, setDataConstatacao] = useState<string>(
    editingRecord ? editingRecord.dataConstatacao : todayStr
  );
  const [diaDoMes, setDiaDoMes] = useState<number>(
    editingRecord ? editingRecord.diaDoMes : new Date().getDate()
  );
  const [itemNumero, setItemNumero] = useState<number>(() => {
    if (editingRecord) return editingRecord.itemNumero;
    return getNextItemNumber(todayStr);
  });
  const [termoNumero, setTermoNumero] = useState<string>(() => {
    if (editingRecord) return editingRecord.termoNumero;
    return calculateNextTermoNumber(todayStr, settings).numeroFormatado;
  });
  const [anoCorrente, setAnoCorrente] = useState<number>(currentYear);
  const [codigoRastreamento, setCodigoRastreamento] = useState<string>('');
  
  // Pesos e Valor Declarado
  const [pesoPostalGramas, setPesoPostalGramas] = useState<number | ''>('');
  const [pesoRealGramas, setPesoRealGramas] = useState<number | ''>('');
  const [valorDeclaradoTexto, setValorDeclaradoTexto] = useState<string>('NC');

  // Unidade de Postagem & Destino
  const [unidadePostagem, setUnidadePostagem] = useState<string>('');
  const [unidadeDestinoCodigo, setUnidadeDestinoCodigo] = useState<string>(settings.destinoPadrao || '18650065');

  // Remetente & Destinatário
  const [remetenteNome, setRemetenteNome] = useState<string>('');
  const [remetenteEndereco, setRemetenteEndereco] = useState<string>('');
  const [destinatarioNome, setDestinatarioNome] = useState<string>('');
  const [destinatarioEndereco, setDestinatarioEndereco] = useState<string>('');

  // Anomalias Constatadas
  const [anomalias, setAnomalias] = useState({
    embalagemMolhadaParcialmente: false,
    conteudoBalancando: false,
    conteudoExtravasandoLiquido: false,
    embalagemDilaceradaMostraConteudo: false,
    embalagemIntactaSemCondicoes: false,
    conteudoAvariado: false,
    embalagemDilaceradaTotalmenteAvariado: false,
    embalagemIntactaMolhadaSemCondicoes: false,
    outrasOcorrencias: false,
    outrasOcorrenciasTexto: '',
  });

  // Motivo para a tabela do Controle Mensal
  const [motivoResumo, setMotivoResumo] = useState<string>('MOLHADA');
  const [aiTcCie, setAiTcCie] = useState<string>('SEQUENCIA DO SISTEMA');

  // Providências
  const [providenciaTipo, setProvidenciaTipo] = useState<ProvidenciaTipo>('outras');
  const [outrasProvidenciasDescricao, setOutrasProvidenciasDescricao] = useState<string>('ENCAMINHADA PARA AC SÃO MANUEL');

  // Validação
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Automação SRO + Busca CEP
  const [sroStatus, setSroStatus] = useState<SroUiStatus>({ phase: 'idle', message: '' });
  const [sroPasteContent, setSroPasteContent] = useState<string>('');
  const [showAgentConfig, setShowAgentConfig] = useState<boolean>(false);
  const [sroAgentUrlInput, setSroAgentUrlInput] = useState<string>(() => getConfiguredSroAgentUrl());

  const manualFieldsRef = useRef<Set<MappedAutoField>>(new Set());
  const autoFilledFieldsRef = useRef<Set<MappedAutoField>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const querySeqRef = useRef<number>(0);
  const inFlightCodeRef = useRef<string>('');
  const lastCompletedCodeRef = useRef<string>('');
  const loadedEditingCodeRef = useRef<string>(
    editingRecord ? normalizeTrackingCode(editingRecord.codigoRastreamento) : ''
  );

  const markManualField = (field: MappedAutoField) => {
    manualFieldsRef.current.add(field);
    autoFilledFieldsRef.current.delete(field);
  };

  // Limpa apenas campos preenchidos automaticamente por consulta anterior, preservando edições manuais
  const resetAutoFilledFields = useCallback(() => {
    const autoSet = autoFilledFieldsRef.current;
    if (autoSet.size === 0) return;

    if (autoSet.has('pesoPostalGramas') && !manualFieldsRef.current.has('pesoPostalGramas')) {
      setPesoPostalGramas('');
    }
    if (autoSet.has('valorDeclaradoTexto') && !manualFieldsRef.current.has('valorDeclaradoTexto')) {
      setValorDeclaradoTexto('NC');
    }
    if (autoSet.has('unidadeDestinoCodigo') && !manualFieldsRef.current.has('unidadeDestinoCodigo')) {
      setUnidadeDestinoCodigo(settings.destinoPadrao || '18650065');
    }
    if (autoSet.has('unidadePostagem') && !manualFieldsRef.current.has('unidadePostagem')) {
      setUnidadePostagem('');
    }
    if (autoSet.has('remetenteNome') && !manualFieldsRef.current.has('remetenteNome')) {
      setRemetenteNome('');
    }
    if (autoSet.has('remetenteEndereco') && !manualFieldsRef.current.has('remetenteEndereco')) {
      setRemetenteEndereco('');
    }
    if (autoSet.has('destinatarioNome') && !manualFieldsRef.current.has('destinatarioNome')) {
      setDestinatarioNome('');
    }
    if (autoSet.has('destinatarioEndereco') && !manualFieldsRef.current.has('destinatarioEndereco')) {
      setDestinatarioEndereco('');
    }

    autoFilledFieldsRef.current.clear();
  }, [settings.destinoPadrao]);

  const applySroAutoFill = useCallback((data: SroAutoFillData) => {
    const applied = new Set<MappedAutoField>();

    if (!manualFieldsRef.current.has('pesoPostalGramas')) {
      setPesoPostalGramas(data.pesoPostalGramas !== null ? data.pesoPostalGramas : '');
      applied.add('pesoPostalGramas');
    }

    if (!manualFieldsRef.current.has('valorDeclaradoTexto') && data.valorDeclarado) {
      setValorDeclaradoTexto(data.valorDeclarado);
      applied.add('valorDeclaradoTexto');
    }

    if (!manualFieldsRef.current.has('unidadeDestinoCodigo') && data.destinoCep) {
      setUnidadeDestinoCodigo(data.destinoCep);
      applied.add('unidadeDestinoCodigo');
    }

    if (!manualFieldsRef.current.has('unidadePostagem')) {
      setUnidadePostagem(data.unidadePostagem || '');
      applied.add('unidadePostagem');
    }

    if (!manualFieldsRef.current.has('remetenteNome')) {
      setRemetenteNome(data.remetenteNome || '');
      applied.add('remetenteNome');
    }

    if (!manualFieldsRef.current.has('remetenteEndereco')) {
      setRemetenteEndereco(data.remetenteEndereco || '');
      applied.add('remetenteEndereco');
    }

    if (!manualFieldsRef.current.has('destinatarioNome')) {
      setDestinatarioNome(data.destinatarioNome || '');
      applied.add('destinatarioNome');
    }

    if (!manualFieldsRef.current.has('destinatarioEndereco')) {
      setDestinatarioEndereco(data.destinatarioEndereco || '');
      applied.add('destinatarioEndereco');
    }

    // ATENÇÃO: pesoRealGramas nunca é preenchido automaticamente
    autoFilledFieldsRef.current = applied;
  }, []);

  const handleConsultationOutcome = useCallback(
    (code: string, result: SroConsultationResult, seq: number) => {
      if (seq !== querySeqRef.current) return;
      inFlightCodeRef.current = '';

      if (!result.ok || !result.data) {
        resetAutoFilledFields();
        setSroStatus({
          phase: 'error',
          message: result.stageMessage,
          technicalDetail: result.technicalDetail,
          errorCode: result.errorCode,
        });
        return;
      }

      if (normalizeTrackingCode(result.data.codigoRastreamento) !== code) {
        resetAutoFilledFields();
        setSroStatus({
          phase: 'error',
          message: 'Os dados obtidos não pertencem ao código informado e foram descartados.',
          errorCode: 'OBJECT_NOT_FOUND',
        });
        return;
      }

      applySroAutoFill(result.data);
      lastCompletedCodeRef.current = code;

      setSroStatus({
        phase: result.data.avisos.length > 0 ? 'warning' : 'success',
        message: result.stageMessage,
        avisos: result.data.avisos,
      });
    },
    [applySroAutoFill, resetAutoFilledFields]
  );

  const startSroLookup = useCallback(
    async (rawCode: string, force = false) => {
      const cleanCode = normalizeTrackingCode(rawCode);
      if (!isValidTrackingCode(cleanCode)) return;

      if (!force && inFlightCodeRef.current === cleanCode) return;
      if (!force && lastCompletedCodeRef.current === cleanCode) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const seq = ++querySeqRef.current;
      inFlightCodeRef.current = cleanCode;
      resetAutoFilledFields();
      setSroPasteContent('');

      setSroStatus({
        phase: 'loading',
        message: 'Consultando objeto no SRO dos Correios...',
      });

      try {
        const result = await consultarObjetoSroEContatos(
          cleanCode,
          {
            onStatusChange: (msg) => {
              if (seq === querySeqRef.current) {
                setSroStatus({ phase: 'loading', message: msg });
              }
            },
          },
          controller.signal
        );
        handleConsultationOutcome(cleanCode, result, seq);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (seq === querySeqRef.current) {
          inFlightCodeRef.current = '';
          resetAutoFilledFields();
          setSroStatus({
            phase: 'error',
            message: 'Falha inesperada ao consultar o SRO dos Correios.',
            errorCode: 'INTRANET_UNREACHABLE',
          });
        }
      }
    },
    [handleConsultationOutcome, resetAutoFilledFields]
  );

  const processPastedOrRelayedSro = useCallback(
    async (rawContent: string | Record<string, any>) => {
      const cleanCode = normalizeTrackingCode(codigoRastreamento);
      if (!isValidTrackingCode(cleanCode) || !rawContent) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const seq = ++querySeqRef.current;
      inFlightCodeRef.current = cleanCode;

      setSroStatus({
        phase: 'loading',
        message: 'Consultando objeto no SRO dos Correios...',
      });

      try {
        const result = await processarConteudoSroReal(
          rawContent as any,
          cleanCode,
          {
            onStatusChange: (msg) => {
              if (seq === querySeqRef.current) {
                setSroStatus({ phase: 'loading', message: msg });
              }
            },
          },
          controller.signal
        );
        handleConsultationOutcome(cleanCode, result, seq);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (seq === querySeqRef.current) {
          inFlightCodeRef.current = '';
          resetAutoFilledFields();
          setSroStatus({
            phase: 'error',
            message: 'Falha ao processar os dados recebidos do SRO.',
            errorCode: 'PARSE_ERROR',
          });
        }
      }
    },
    [codigoRastreamento, handleConsultationOutcome, resetAutoFilledFields]
  );

  // Inicialização e sincronização com configurações
  useEffect(() => {
    abortControllerRef.current?.abort();
    inFlightCodeRef.current = '';
    lastCompletedCodeRef.current = '';
    autoFilledFieldsRef.current.clear();
    manualFieldsRef.current.clear();
    setSroStatus({ phase: 'idle', message: '' });
    setSroPasteContent('');

    if (editingRecord) {
      loadedEditingCodeRef.current = normalizeTrackingCode(editingRecord.codigoRastreamento);
      setDataConstatacao(editingRecord.dataConstatacao);
      setDiaDoMes(editingRecord.diaDoMes || parseInt(editingRecord.dataConstatacao.split('-')[2], 10));
      setItemNumero(editingRecord.itemNumero);
      setTermoNumero(editingRecord.termoNumero);
      setAnoCorrente(editingRecord.anoCorrente || currentYear);
      setCodigoRastreamento(editingRecord.codigoRastreamento);
      setPesoPostalGramas(editingRecord.pesoPostalGramas);
      setPesoRealGramas(editingRecord.pesoRealGramas);
      setValorDeclaradoTexto(editingRecord.valorDeclaradoTexto || 'NC');
      setUnidadePostagem(editingRecord.unidadePostagem);
      setUnidadeDestinoCodigo(editingRecord.unidadeDestinoCodigo || settings.destinoPadrao || '18650065');

      setRemetenteNome(editingRecord.remetenteNome);
      setRemetenteEndereco(editingRecord.remetenteEndereco);
      setDestinatarioNome(editingRecord.destinatarioNome);
      setDestinatarioEndereco(editingRecord.destinatarioEndereco);

      setAnomalias(editingRecord.anomalias);
      setMotivoResumo(editingRecord.motivoResumo);
      setAiTcCie(editingRecord.aiTcCie || 'SEQUENCIA DO SISTEMA');

      setProvidenciaTipo(editingRecord.providencias.tipo);
      setOutrasProvidenciasDescricao(editingRecord.providencias.outrasDescricao || '');
    } else {
      loadedEditingCodeRef.current = '';
      // Para novo cadastro, puxa diretamente a sequência configurada nas configurações
      const nextTermo = calculateNextTermoNumber(dataConstatacao, settings);
      setTermoNumero(nextTermo.numeroFormatado);
      const nextItem = getNextItemNumber(dataConstatacao);
      setItemNumero(nextItem);
    }
  }, [editingRecord?.id]);

  // Cancelar requisição pendente ao desmontar
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Ouvir ponte em tempo real (postMessage / BroadcastChannel) caso uma aba/extensão autenticada envie dados do SRO
  useEffect(() => {
    const handleBridgePayload = (payload: any) => {
      if (!payload || payload.type !== 'CORREIOS_SRO_DATA') return;
      const content = payload.payload ?? payload.content ?? payload.html ?? payload.text;
      if (content) {
        void processPastedOrRelayedSro(content);
      }
    };

    const onWindowMessage = (event: MessageEvent) => {
      handleBridgePayload(event.data);
    };
    window.addEventListener('message', onWindowMessage);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('correios_sro_bridge');
      channel.onmessage = (ev) => handleBridgePayload(ev.data);
    }

    return () => {
      window.removeEventListener('message', onWindowMessage);
      channel?.close();
    };
  }, [processPastedOrRelayedSro]);

  // Gatilho automático ao digitar ou bipar código de rastreamento válido
  useEffect(() => {
    const cleanCode = normalizeTrackingCode(codigoRastreamento);

    if (!cleanCode) {
      abortControllerRef.current?.abort();
      inFlightCodeRef.current = '';
      lastCompletedCodeRef.current = '';
      resetAutoFilledFields();
      setSroStatus({ phase: 'idle', message: '' });
      return;
    }

    // Ao editar registro existente, não reconsulta automaticamente o código original salvo
    if (editingRecord && cleanCode === loadedEditingCodeRef.current) {
      return;
    }

    if (lastCompletedCodeRef.current && lastCompletedCodeRef.current !== cleanCode) {
      lastCompletedCodeRef.current = '';
      resetAutoFilledFields();
      setSroStatus({ phase: 'idle', message: '' });
    }

    if (inFlightCodeRef.current && inFlightCodeRef.current !== cleanCode) {
      abortControllerRef.current?.abort();
      inFlightCodeRef.current = '';
    }

    if (!isValidTrackingCode(cleanCode)) {
      return;
    }

    const timer = setTimeout(() => {
      void startSroLookup(cleanCode);
    }, 450);

    return () => clearTimeout(timer);
  }, [codigoRastreamento, editingRecord, resetAutoFilledFields, startSroLookup]);

  useEffect(() => {
    if (dataConstatacao) {
      const parts = dataConstatacao.split('-');
      if (parts.length === 3) {
        setDiaDoMes(parseInt(parts[2], 10));
        setAnoCorrente(parseInt(parts[0], 10));
      }
      if (!editingRecord) {
        setItemNumero(getNextItemNumber(dataConstatacao));
      }
    }
  }, [dataConstatacao, editingRecord]);

  useEffect(() => {
    if (codigoRastreamento.trim().length >= 9) {
      const dup = checkDuplicateTracking(codigoRastreamento, editingRecord?.id);
      if (dup) {
        setDuplicateWarning(`O rastreamento ${codigoRastreamento.toUpperCase()} já consta no Termo ${dup.termoNumero} (Dia ${dup.diaDoMes}).`);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [codigoRastreamento, editingRecord]);

  const handleAnomaliaToggle = (field: keyof typeof anomalias) => {
    const updated = { ...anomalias, [field]: !anomalias[field] };
    setAnomalias(updated);

    if (updated.embalagemMolhadaParcialmente || updated.embalagemIntactaMolhadaSemCondicoes) {
      setMotivoResumo('MOLHADA');
    } else if (updated.embalagemDilaceradaMostraConteudo || updated.embalagemDilaceradaTotalmenteAvariado) {
      setMotivoResumo('EMBALAGEM ABERTA');
    } else if (updated.conteudoBalancando || updated.conteudoAvariado) {
      setMotivoResumo('AVARIADO / QUEBRA');
    } else if (updated.conteudoExtravasandoLiquido) {
      setMotivoResumo('EXTRAVASANDO LÍQUIDO');
    }
  };

  const handleSubmit = (generatePdfImmediately: boolean) => {
    setValidationError(null);

    if (!codigoRastreamento.trim()) {
      setValidationError('Informe o Código de Rastreamento postal.');
      return;
    }

    if (pesoPostalGramas === '' || pesoRealGramas === '') {
      setValidationError('Informe o Peso Postal e o Peso Real em gramas.');
      return;
    }

    if (!unidadePostagem.trim()) {
      setValidationError('Informe a Unidade de Postagem.');
      return;
    }

    if (!remetenteNome.trim() || !destinatarioNome.trim()) {
      setValidationError('Informe o Remetente e o Destinatário.');
      return;
    }

    const dateParts = dataConstatacao.split('-');
    const anoRef = parseInt(dateParts[0], 10);
    const mesRef = parseInt(dateParts[1], 10);
    const diaNum = parseInt(dateParts[2], 10);

    const recordToSave: ObjetoRecord = {
      id: editingRecord ? editingRecord.id : 'rec-' + Date.now(),
      dataConstatacao,
      diaDoMes: diaNum,
      mesReferencia: mesRef,
      anoReferencia: anoRef,
      itemNumero: Number(itemNumero) || 1,
      termoNumero: termoNumero || '99',
      anoCorrente: anoCorrente || anoRef,
      codigoRastreamento: codigoRastreamento.trim().toUpperCase(),
      unidadeConstatacao: settings.nomeUnidade,
      dr: settings.dr || 'SPI',
      codigoSto: settings.codigoSto || '18650-972',
      pesoPostalGramas: Number(pesoPostalGramas),
      pesoRealGramas: Number(pesoRealGramas),
      valorDeclaradoTexto: valorDeclaradoTexto.trim() || 'NC',
      unidadePostagem: unidadePostagem.trim().toUpperCase(),
      unidadeDestinoCodigo: unidadeDestinoCodigo.trim() || settings.destinoPadrao || '18650065',
      remetenteNome: remetenteNome.trim().toUpperCase(),
      remetenteEndereco: remetenteEndereco.trim().toUpperCase(),
      destinatarioNome: destinatarioNome.trim().toUpperCase(),
      destinatarioEndereco: destinatarioEndereco.trim().toUpperCase(),
      anomalias: { ...anomalias },
      motivoResumo: motivoResumo.trim().toUpperCase() || 'MOLHADA',
      aiTcCie: aiTcCie.trim().toUpperCase() || 'SEQUENCIA DO SISTEMA',
      providencias: {
        tipo: providenciaTipo,
        outrasDescricao: outrasProvidenciasDescricao.trim().toUpperCase(),
      },
      operadorMatricula: settings.operadorMatriculaPadrao || '81149042',
      operadorNome: settings.operadorPadraoNome,
      chefeNome: settings.chefeNome || 'HELTON JULIO SANTOS MANUEL',
      chefeMatricula: settings.chefeMatricula || '8.114.904-2',
      // Declaração deixada em branco / não aplicada no cadastro para o cliente preencher à mão no momento da entrega
      declaracao: {
        tipoCliente: 'destinatario',
        tipo: 'nao_se_aplica',
        recusaFace: '',
        especificacaoOutra: '',
        nomeCliente: destinatarioNome.trim().toUpperCase(),
        documentoIdentificacao: '',
        dataDeclaracao: dataConstatacao,
      },
      status: generatePdfImmediately ? 'termo_emitido' : (editingRecord?.status || 'cadastrado'),
      versaoDocumento: editingRecord ? (editingRecord.versaoDocumento + 1) : 1,
      criadoEm: editingRecord ? editingRecord.criadoEm : new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      historicoEmissoes: editingRecord?.historicoEmissoes || [],
    };

    const saved = saveRecord(recordToSave, generatePdfImmediately);
    onSaveSuccess(saved, generatePdfImmediately);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-lg bg-white p-1 border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center">
            <img src={CORREIOS_LOGO_SRC} alt="Correios" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white">
                Fontes em Preto Oficial ECT
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-[#00416B] border border-sky-200">
                {settings.nomeUnidade}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {editingRecord ? `Editar Termo Nº ${editingRecord.termoNumero}` : 'Novo Cadastro de Objeto Recondicionado'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#00416B] hover:bg-[#002D56] rounded-lg shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4 inline mr-1.5" />
            {editingRecord ? 'Salvar Alterações' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-[#002D56] bg-[#FFCC00] hover:bg-yellow-300 rounded-lg shadow-sm cursor-pointer"
          >
            <FileCheck2 className="w-4 h-4 inline mr-1.5" />
            {editingRecord ? 'Salvar Alterações e Reemitir PDF' : 'Salvar e Gerar Termo (PDF)'}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>{validationError}</div>
        </div>
      )}

      {duplicateWarning && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>{duplicateWarning}</div>
        </div>
      )}

      {/* BLOCO FIXO: DADOS INSTITUCIONAIS */}
      <section className="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#00416B]" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Dados Fixos da Unidade (Configurações do CDD São Manuel)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Puxados automaticamente</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold">UNIDADE</span>
            <span className="font-bold text-slate-900">{settings.nomeUnidade}</span>
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold">DR / STO</span>
            <span className="font-bold text-slate-900">{settings.dr} / {settings.codigoSto}</span>
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold">CHEFE DA UNIDADE</span>
            <span className="font-bold text-slate-900">{settings.chefeNome}</span>
          </div>
          <div className="bg-white p-2.5 rounded border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold">OPERADOR MATRÍCULA</span>
            <span className="font-mono font-bold text-slate-900">{settings.operadorMatriculaPadrao}</span>
          </div>
        </div>
      </section>

      {/* SEÇÃO 1: CAMPOS DO OBJETO */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b-2 border-[#00416B]">
          <Package className="w-5 h-5 text-[#00416B]" />
          <h2 className="text-sm font-bold text-[#00416B] uppercase tracking-tight">
            1. Identificação do Objeto & Numeração
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Data da Constatação *
            </label>
            <input
              type="date"
              value={dataConstatacao}
              onChange={(e) => setDataConstatacao(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <span className="text-[11px] text-slate-500">Dia: <strong>Dia {diaDoMes}</strong> | Item: <strong>{itemNumero}</strong></span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-800">
                Número do Termo *
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                (Configurado: {settings.numeroSequenciaInicial})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={termoNumero}
                onChange={(e) => setTermoNumero(e.target.value)}
                placeholder={String(settings.numeroSequenciaInicial || 1)}
                className="w-28 px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded-lg text-center"
              />
              <span className="text-slate-400 font-bold">/</span>
              <input
                type="number"
                value={anoCorrente}
                onChange={(e) => setAnoCorrente(Number(e.target.value))}
                className="w-24 px-2 py-2 text-sm font-mono border border-slate-300 rounded-lg text-center"
              />
            </div>
            <span className="text-[11px] text-slate-500">Ex: {termoNumero || settings.numeroSequenciaInicial} / {anoCorrente}</span>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Código de Rastreamento (Número Objeto) *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ex: Ae047884658br"
                value={codigoRastreamento}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setCodigoRastreamento(val);
                  if (editingRecord && normalizeTrackingCode(val) !== loadedEditingCodeRef.current) {
                    loadedEditingCodeRef.current = '';
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const clean = normalizeTrackingCode(codigoRastreamento);
                    if (isValidTrackingCode(clean)) {
                      void startSroLookup(clean, true);
                    }
                  }
                }}
                className="flex-1 px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded-lg tracking-wider"
              />
              {isValidTrackingCode(codigoRastreamento) && (
                <button
                  type="button"
                  onClick={() => void startSroLookup(codigoRastreamento, true)}
                  disabled={sroStatus.phase === 'loading'}
                  title="Consultar objeto novamente no SRO"
                  className="px-3 py-2 text-xs font-bold text-[#00416B] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {sroStatus.phase === 'loading' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Consultar SRO</span>
                </button>
              )}
            </div>

            {sroStatus.phase !== 'idle' && (
              <div
                className={`mt-2 p-2.5 rounded-lg border text-xs space-y-2 ${
                  sroStatus.phase === 'loading'
                    ? 'bg-sky-50 border-sky-200 text-sky-900'
                    : sroStatus.phase === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : sroStatus.phase === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {sroStatus.phase === 'loading' && (
                    <Loader2 className="w-4 h-4 text-[#00416B] animate-spin shrink-0 mt-0.5" />
                  )}
                  {sroStatus.phase === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {(sroStatus.phase === 'warning' || sroStatus.phase === 'error') && (
                    <AlertCircle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        sroStatus.phase === 'warning' ? 'text-amber-600' : 'text-red-600'
                      }`}
                    />
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">{sroStatus.message}</p>
                    {sroStatus.technicalDetail && (
                      <p className="text-[11px] opacity-90">{sroStatus.technicalDetail}</p>
                    )}
                    {sroStatus.avisos && sroStatus.avisos.length > 0 && (
                      <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                        {sroStatus.avisos.map((aviso, idx) => (
                          <li key={idx}>{aviso}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {(sroStatus.errorCode === 'CORS_BLOCKED' ||
                  sroStatus.errorCode === 'INTRANET_UNREACHABLE' ||
                  sroStatus.errorCode === 'AUTH_REQUIRED' ||
                  sroPasteContent.length > 0) && (
                  <div className="pt-2 border-t border-red-200/80 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`${SRO_INTRANET_URL}?objeto=${encodeURIComponent(
                            normalizeTrackingCode(codigoRastreamento)
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-red-300 text-[11px] font-bold text-[#00416B] hover:bg-sky-50"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir SRO Intranet na aba autenticada
                        </a>
                        {!getDetectedExtensionInfo().detected && (
                          <a
                            href="/extensao-sro-piloto.zip"
                            download="extensao-sro-piloto.zip"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00416B] text-white text-[11px] font-bold hover:bg-[#002D56]"
                          >
                            <Download className="w-3 h-3 text-yellow-300" />
                            Baixar Extensão SRO (.zip)
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAgentConfig((prev) => !prev)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer"
                      >
                        <Settings2 className="w-3 h-3" />
                        Agente local
                      </button>
                    </div>
                    {!getDetectedExtensionInfo().detected && (
                      <p className="text-[11px] text-slate-700">
                        Para consulta automática nesta estação: baixe o <strong>.zip</strong> acima, extraia a pasta e carregue em <code>edge://extensions</code> ou <code>chrome://extensions</code> (Modo do desenvolvedor → Carregar sem compactação).
                      </p>
                    )}

                    {showAgentConfig && (
                      <div className="p-2 rounded bg-white border border-slate-200 space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          URL do Serviço Auxiliar Local (na rede Correios):
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="http://localhost:3000"
                            value={sroAgentUrlInput}
                            onChange={(e) => setSroAgentUrlInput(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs font-mono border border-slate-300 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setConfiguredSroAgentUrl(sroAgentUrlInput);
                              void startSroLookup(codigoRastreamento, true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-[#00416B] text-white rounded cursor-pointer"
                          >
                            Aplicar e Consultar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-800">
                        <ClipboardPaste className="w-3 h-3 text-[#00416B]" />
                        Ou cole aqui o conteúdo copiado da tela do SRO (Ctrl+A → Ctrl+C → Ctrl+V) para preencher automaticamente e consultar os CEPs:
                      </label>
                      <textarea
                        rows={2}
                        value={sroPasteContent}
                        onChange={(e) => {
                          const text = e.target.value;
                          setSroPasteContent(text);
                          if (text.trim().length > 20) {
                            void processPastedOrRelayedSro(text);
                          }
                        }}
                        placeholder="Cole aqui o texto/HTML do evento Postagem (PO) do SRO Intranet..."
                        className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-white border border-slate-300 rounded text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Pesos e Postagem */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Peso Postal (Gs) *
            </label>
            <input
              type="number"
              placeholder="Ex: 760 ou 14730"
              value={pesoPostalGramas}
              onChange={(e) => {
                markManualField('pesoPostalGramas');
                setPesoPostalGramas(e.target.value === '' ? '' : Number(e.target.value));
              }}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Peso Real (Gs) *
            </label>
            <input
              type="number"
              placeholder="Ex: 760 ou 13260"
              value={pesoRealGramas}
              onChange={(e) => setPesoRealGramas(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Valor Declarado
            </label>
            <input
              type="text"
              value={valorDeclaradoTexto}
              onChange={(e) => {
                markManualField('valorDeclaradoTexto');
                setValorDeclaradoTexto(e.target.value.toUpperCase());
              }}
              placeholder="NC ou valor"
              className="w-full px-3 py-2 text-sm font-bold text-slate-800 border border-slate-300 rounded-lg"
            />
            <span className="text-[11px] text-slate-500">Padrão: <strong>NC</strong></span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Destino (CEP/Código) *
            </label>
            <input
              type="text"
              value={unidadeDestinoCodigo}
              onChange={(e) => {
                markManualField('unidadeDestinoCodigo');
                setUnidadeDestinoCodigo(e.target.value);
              }}
              placeholder="Ex: 18650065"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
            <span className="text-[11px] text-slate-500">Coluna DESTINO</span>
          </div>

        </div>

        {/* Unidade de Postagem */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Unidade de Postagem *
          </label>
          <input
            type="text"
            placeholder="Ex: AC PIRAPOZINHO - PIRAPOZINHO / SP"
            value={unidadePostagem}
            onChange={(e) => {
              markManualField('unidadePostagem');
              setUnidadePostagem(e.target.value.toUpperCase());
            }}
            className="w-full px-3 py-2 text-sm font-bold text-slate-800 border border-slate-300 rounded-lg"
          />
          <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-slate-500">
            <span>Sugestões:</span>
            <button 
              type="button" 
              onClick={() => {
                markManualField('unidadePostagem');
                setUnidadePostagem('AC PIRAPOZINHO - PIRAPOZINHO / SP');
              }}
              className="text-[#00416B] underline font-medium cursor-pointer"
            >
              AC Pirapozinho
            </button>
            <span>·</span>
            <button 
              type="button" 
              onClick={() => {
                markManualField('unidadePostagem');
                setUnidadePostagem('AGF ALONSO LOPEZ - CAJAMAR / SP');
              }}
              className="text-[#00416B] underline font-medium cursor-pointer"
            >
              AGF Alonso Lopez (Cajamar)
            </button>
            <span>·</span>
            <button 
              type="button" 
              onClick={() => {
                markManualField('unidadePostagem');
                setUnidadePostagem('AGF RIO BRANCO - BAURU / SP');
              }}
              className="text-[#00416B] underline font-medium cursor-pointer"
            >
              AGF Rio Branco (Bauru)
            </button>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2: REMETENTE E DESTINATÁRIO */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 pb-2 border-b-2 border-[#00416B]">
          <User className="w-5 h-5 text-[#00416B]" />
          <h2 className="text-sm font-bold text-[#00416B] uppercase tracking-tight">
            2. Remetente e Destinatário
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase">Dados do Remetente</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Remetente *
              </label>
              <input
                type="text"
                placeholder="Ex: SUMETAL IND E COM"
                value={remetenteNome}
                onChange={(e) => {
                  markManualField('remetenteNome');
                  setRemetenteNome(e.target.value.toUpperCase());
                }}
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Endereço do Remetente *
              </label>
              <input
                type="text"
                placeholder="Ex: RUA GOTARDO PELIN, 206"
                value={remetenteEndereco}
                onChange={(e) => {
                  markManualField('remetenteEndereco');
                  setRemetenteEndereco(e.target.value.toUpperCase());
                }}
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase">Dados do Destinatário</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Destinatário *
              </label>
              <input
                type="text"
                placeholder="Ex: BOA NOVA COMERCIAL"
                value={destinatarioNome}
                onChange={(e) => {
                  markManualField('destinatarioNome');
                  setDestinatarioNome(e.target.value.toUpperCase());
                }}
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Endereço do Destinatário *
              </label>
              <input
                type="text"
                placeholder="Ex: RUA XV DE NOVEMBRO 792"
                value={destinatarioEndereco}
                onChange={(e) => {
                  markManualField('destinatarioEndereco');
                  setDestinatarioEndereco(e.target.value.toUpperCase());
                }}
                className="w-full px-3 py-2 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO 3: ANORMALIDADES CONSTATADAS */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-800">
          <ClipboardList className="w-5 h-5 text-slate-800" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            3. Anormalidades Constatadas
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          
          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.embalagemMolhadaParcialmente}
              onChange={() => handleAnomaliaToggle('embalagemMolhadaParcialmente')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Embalagem molhada parcialmente;</span>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.conteudoBalancando}
              onChange={() => handleAnomaliaToggle('conteudoBalancando')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Conteúdo balançando, com suspeita de quebra;</span>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.conteudoExtravasandoLiquido}
              onChange={() => handleAnomaliaToggle('conteudoExtravasandoLiquido')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Conteúdo extravasando líquido;</span>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.embalagemDilaceradaMostraConteudo}
              onChange={() => handleAnomaliaToggle('embalagemDilaceradaMostraConteudo')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Embalagem dilacerada e com mostra do conteúdo;</span>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.embalagemIntactaSemCondicoes}
              onChange={() => handleAnomaliaToggle('embalagemIntactaSemCondicoes')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Embalagem intacta, porém sem condições de reintegrar ao tráfego postal;</span>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.conteudoAvariado}
              onChange={() => handleAnomaliaToggle('conteudoAvariado')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Conteúdo avariado;</span>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.embalagemDilaceradaTotalmenteAvariado}
              onChange={() => handleAnomaliaToggle('embalagemDilaceradaTotalmenteAvariado')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Embalagem dilacerada e com mostra do conteúdo totalmente avariado;</span>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.embalagemIntactaMolhadaSemCondicoes}
              onChange={() => handleAnomaliaToggle('embalagemIntactaMolhadaSemCondicoes')}
              className="mt-0.5 w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs text-slate-800">Embalagem intacta, porém molhada e sem condições de reintegração ao tráfego postal;</span>
          </label>

        </div>

        {/* Outras (especificar) */}
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={anomalias.outrasOcorrencias}
              onChange={() => handleAnomaliaToggle('outrasOcorrencias')}
              className="w-4 h-4 text-[#00416B] rounded border-slate-300"
            />
            <span className="text-xs font-bold text-slate-800">
              Outras (especificar):
            </span>
          </label>

          {anomalias.outrasOcorrencias && (
            <input
              type="text"
              placeholder="Ex: ENCAMINHADA PARA AC SÃO MANUEL"
              value={anomalias.outrasOcorrenciasTexto}
              onChange={(e) => setAnomalias(prev => ({ ...prev, outrasOcorrenciasTexto: e.target.value.toUpperCase() }))}
              className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg"
            />
          )}
        </div>
      </section>

      {/* SEÇÃO 4: PROVIDÊNCIAS */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-800">
          <ShieldCheck className="w-5 h-5 text-slate-800" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            4. Providências
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
            providenciaTipo === 'encaminhado_destino' ? 'border-[#00416B] bg-sky-50' : 'border-slate-200'
          }`}>
            <input
              type="radio"
              name="providenciaTipo"
              checked={providenciaTipo === 'encaminhado_destino'}
              onChange={() => setProvidenciaTipo('encaminhado_destino')}
              className="mt-0.5 text-[#00416B]"
            />
            <span className="text-xs font-semibold text-slate-800">Encaminhado ao destino;</span>
          </label>

          <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
            providenciaTipo === 'recondicionado_encaminhado' ? 'border-[#00416B] bg-sky-50' : 'border-slate-200'
          }`}>
            <input
              type="radio"
              name="providenciaTipo"
              checked={providenciaTipo === 'recondicionado_encaminhado'}
              onChange={() => setProvidenciaTipo('recondicionado_encaminhado')}
              className="mt-0.5 text-[#00416B]"
            />
            <span className="text-xs font-semibold text-slate-800">Recondicionado e encaminhado ao destino;</span>
          </label>

          <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
            providenciaTipo === 'devolvido_postagem' ? 'border-[#00416B] bg-sky-50' : 'border-slate-200'
          }`}>
            <input
              type="radio"
              name="providenciaTipo"
              checked={providenciaTipo === 'devolvido_postagem'}
              onChange={() => setProvidenciaTipo('devolvido_postagem')}
              className="mt-0.5 text-[#00416B]"
            />
            <span className="text-xs font-semibold text-slate-800">Devolvido a unidade de postagem;</span>
          </label>

          <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
            providenciaTipo === 'auto_irregularidade' ? 'border-[#00416B] bg-sky-50' : 'border-slate-200'
          }`}>
            <input
              type="radio"
              name="providenciaTipo"
              checked={providenciaTipo === 'auto_irregularidade'}
              onChange={() => setProvidenciaTipo('auto_irregularidade')}
              className="mt-0.5 text-[#00416B]"
            />
            <span className="text-xs font-semibold text-slate-800">Auto de Irregularidade lavrado;</span>
          </label>

          <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
            providenciaTipo === 'destruicao' ? 'border-[#00416B] bg-sky-50' : 'border-slate-200'
          }`}>
            <input
              type="radio"
              name="providenciaTipo"
              checked={providenciaTipo === 'destruicao'}
              onChange={() => setProvidenciaTipo('destruicao')}
              className="mt-0.5 text-[#00416B]"
            />
            <span className="text-xs font-semibold text-slate-800">Destruído. Emitido Termo de Destruição;</span>
          </label>

          <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${
            providenciaTipo === 'outras' ? 'border-[#00416B] bg-sky-50' : 'border-slate-200'
          }`}>
            <input
              type="radio"
              name="providenciaTipo"
              checked={providenciaTipo === 'outras'}
              onChange={() => setProvidenciaTipo('outras')}
              className="mt-0.5 text-[#00416B]"
            />
            <div className="flex-1">
              <span className="text-xs font-bold text-slate-800 block">Outras (especificar):</span>
              {providenciaTipo === 'outras' && (
                <input
                  type="text"
                  placeholder="ENCAMINHADA PARA AC SÃO MANUEL"
                  value={outrasProvidenciasDescricao}
                  onChange={(e) => setOutrasProvidenciasDescricao(e.target.value.toUpperCase())}
                  className="w-full mt-1.5 px-2.5 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded"
                />
              )}
            </div>
          </label>

        </div>
      </section>

      {/* Nota informativa sobre a Declaração do Cliente */}
      <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center gap-3">
        <Building2 className="w-5 h-5 text-[#00416B] shrink-0" />
        <div>
          <strong>Nota Operacional:</strong> A Seção de Declaração do Destinatário / Remetente (aceite ou recusa) foi retirada do cadastro digital e será preenchida e assinada à mão pelo cliente no momento da entrega do objeto, conforme orientado.
        </div>
      </div>

      {/* Botões Finais de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-6 border-t border-slate-200 gap-3">
        <span className="text-xs text-slate-500">
          Os dados digitados serão gravados e integrados automaticamente tanto na folha de <strong>Controle Mensal</strong> quanto no <strong>Termo de Constatação</strong>.
        </span>

        <div className="flex flex-wrap items-center gap-3">
          {editingRecord && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingRecord)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg cursor-pointer transition-colors"
              title="Excluir este objeto lançado"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Excluir Registro</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-[#00416B] hover:bg-[#002D56] rounded-lg shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4 inline mr-1.5" />
            {editingRecord ? 'Salvar Alterações' : 'Salvar Objeto'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            className="px-6 py-2.5 text-xs sm:text-sm font-bold text-[#002D56] bg-[#FFCC00] hover:bg-yellow-300 rounded-lg shadow-md cursor-pointer"
          >
            <FileCheck2 className="w-4 h-4 inline mr-1.5" />
            {editingRecord ? 'Salvar Alterações e Reemitir PDF' : 'Salvar e Emitir Termo (PDF)'}
          </button>
        </div>
      </div>

    </div>
  );
};
