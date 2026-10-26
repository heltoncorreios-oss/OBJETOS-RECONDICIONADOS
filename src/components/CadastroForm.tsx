import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Save, 
  FileCheck2, 
  AlertCircle, 
  User, 
  ClipboardList, 
  ShieldCheck, 
  Building2,
  Trash2
} from 'lucide-react';
import { ObjetoRecord, UnitSettings, ProvidenciaTipo } from '../types';
import { 
  calculateNextTermoNumber,
  checkDuplicateTracking, 
  getNextItemNumber, 
  saveRecord 
} from '../services/storage';
import { CORREIOS_LOGO_SRC } from '../assets/correiosLogo';

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

  // Inicialização e sincronização com configurações
  useEffect(() => {
    if (editingRecord) {
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
      // Para novo cadastro, puxa diretamente a sequência configurada nas configurações
      const nextTermo = calculateNextTermoNumber(dataConstatacao, settings);
      setTermoNumero(nextTermo.numeroFormatado);
      const nextItem = getNextItemNumber(dataConstatacao);
      setItemNumero(nextItem);
    }
  }, [editingRecord?.id]);

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
            <input
              type="text"
              placeholder="Ex: Ae047884658br"
              value={codigoRastreamento}
              onChange={(e) => setCodigoRastreamento(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded-lg tracking-wider"
            />
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
              onChange={(e) => setPesoPostalGramas(e.target.value === '' ? '' : Number(e.target.value))}
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
              onChange={(e) => setValorDeclaradoTexto(e.target.value.toUpperCase())}
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
              onChange={(e) => setUnidadeDestinoCodigo(e.target.value)}
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
            onChange={(e) => setUnidadePostagem(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 text-sm font-bold text-slate-800 border border-slate-300 rounded-lg"
          />
          <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-slate-500">
            <span>Sugestões:</span>
            <button 
              type="button" 
              onClick={() => setUnidadePostagem('AC PIRAPOZINHO - PIRAPOZINHO / SP')}
              className="text-[#00416B] underline font-medium cursor-pointer"
            >
              AC Pirapozinho
            </button>
            <span>·</span>
            <button 
              type="button" 
              onClick={() => setUnidadePostagem('AGF ALONSO LOPEZ - CAJAMAR / SP')}
              className="text-[#00416B] underline font-medium cursor-pointer"
            >
              AGF Alonso Lopez (Cajamar)
            </button>
            <span>·</span>
            <button 
              type="button" 
              onClick={() => setUnidadePostagem('AGF RIO BRANCO - BAURU / SP')}
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
                onChange={(e) => setRemetenteNome(e.target.value.toUpperCase())}
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
                onChange={(e) => setRemetenteEndereco(e.target.value.toUpperCase())}
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
                onChange={(e) => setDestinatarioNome(e.target.value.toUpperCase())}
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
                onChange={(e) => setDestinatarioEndereco(e.target.value.toUpperCase())}
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
