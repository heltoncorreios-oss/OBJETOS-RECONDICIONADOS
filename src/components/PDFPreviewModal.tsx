import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { X, Download, Printer, FileText, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { downloadPDF } from '../services/pdfGenerator';
import { generatePrintHtml } from '../services/printGenerator';
import { ObjetoRecord, UnitSettings } from '../types';
import { MESES_POR_EXTENSO } from '../services/pdfGenerator';
import { CORREIOS_LOGO_SRC } from '../assets/correiosLogo';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDoc: jsPDF | null;
  filename: string;
  title: string;
  subtitle?: string;
  record?: ObjetoRecord | null;
  isControleMensal?: boolean;
  controleRecords?: ObjetoRecord[];
  controleMonth?: number;
  controleYear?: number;
  settings: UnitSettings;
}

const EMPTY_RECORDS: ObjetoRecord[] = [];

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfDoc,
  filename,
  title,
  subtitle,
  record,
  isControleMensal,
  controleRecords = EMPTY_RECORDS,
  controleMonth = 10,
  controleYear = 2026,
  settings,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [printBlobUrl, setPrintBlobUrl] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'pdf'>('visual');
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'info' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !pdfDoc) {
      setBlobUrl(null);
      setPrintBlobUrl(null);
      return;
    }

    let bUrl: string | null = null;
    let pUrl: string | null = null;

    try {
      const blob = pdfDoc.output('blob');
      bUrl = URL.createObjectURL(blob);
      setBlobUrl(bUrl);
    } catch (e) {
      console.error('Erro ao gerar blob url do PDF:', e);
    }

    try {
      const htmlDoc = generatePrintHtml({
        title,
        filename,
        isControleMensal,
        record,
        controleRecords: controleRecords || EMPTY_RECORDS,
        controleMonth,
        controleYear,
        settings,
        pdfBlobUrl: bUrl,
      });
      const htmlBlob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      pUrl = URL.createObjectURL(htmlBlob);
      setPrintBlobUrl(pUrl);
    } catch (e) {
      console.error('Erro ao gerar HTML de impressão:', e);
    }

    return () => {
      if (bUrl) URL.revokeObjectURL(bUrl);
      if (pUrl) URL.revokeObjectURL(pUrl);
    };
  }, [isOpen, pdfDoc]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (pdfDoc) {
      downloadPDF(pdfDoc, filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    }
  };

  const handlePrintClick = () => {
    setFeedbackNotice({
      type: 'success',
      text: 'Página de impressão aberta em nova aba. O diálogo de impressão abrirá automaticamente!',
    });
    setTimeout(() => setFeedbackNotice(null), 6000);
  };

  const handleOpenPdfClick = () => {
    setFeedbackNotice({
      type: 'info',
      text: 'PDF aberto em nova aba do navegador para visualização.',
    });
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  const mesExtenso = MESES_POR_EXTENSO[(controleMonth || 10) - 1] || 'OUTUBRO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-5xl h-[94vh] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-300">
        
        {/* Barra Superior do Modal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 bg-[#00416B] text-white border-b-2 border-[#FFCC00] gap-3 no-print">
          
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#FFCC00] text-[#003152] font-black shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-xs text-sky-200 font-mono">{filename}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            
            {/* Alternador de Visualização */}
            <div className="flex items-center bg-sky-900/80 p-0.5 rounded-lg border border-sky-700 text-xs">
              <button
                onClick={() => setViewMode('visual')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  viewMode === 'visual' ? 'bg-white text-[#00416B]' : 'text-sky-200 hover:text-white'
                }`}
              >
                Visualização Fiel
              </button>
              <button
                onClick={() => setViewMode('pdf')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  viewMode === 'pdf' ? 'bg-white text-[#00416B]' : 'text-sky-200 hover:text-white'
                }`}
              >
                PDF Embutido
              </button>
            </div>

            {/* Botão de Impressão Direta (Abre diálogo nativo de impressão em nova aba) */}
            <a
              href={printBlobUrl || blobUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handlePrintClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#002D56] bg-[#FFCC00] hover:bg-yellow-300 rounded-lg shadow-sm transition-transform active:scale-95 cursor-pointer"
              title="Abrir página e diálogo de impressão em nova aba"
            >
              <Printer className="w-4 h-4 text-[#002D56]" />
              <span>Imprimir</span>
            </a>

            {/* Botão de Abrir PDF em Nova Aba */}
            <a
              href={blobUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenPdfClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-100 bg-sky-900 hover:bg-sky-800 rounded-lg border border-sky-700 transition-colors cursor-pointer shadow-sm"
              title="Abrir PDF original em nova aba"
            >
              <ExternalLink className="w-4 h-4 text-sky-300" />
              <span className="hidden sm:inline">Abrir PDF</span>
            </a>

            {/* Botão Principal de Download do Arquivo PDF */}
            <button
              onClick={handleDownload}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-black rounded-lg transition-transform active:scale-95 cursor-pointer ${
                downloadSuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#FFCC00] text-[#002D56] hover:bg-yellow-300 shadow-sm'
              }`}
              title="Baixar arquivo PDF no seu computador"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Baixado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar PDF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-sky-200 hover:text-white hover:bg-sky-900 rounded-lg transition-colors ml-1 cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* Feedback Banner para Informação ao Usuário */}
        {feedbackNotice && (
          <div className="mx-4 mt-3 p-3 bg-sky-50 border border-sky-200 text-sky-950 rounded-lg text-xs flex items-center justify-between gap-3 animate-in fade-in no-print">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackNotice.text}</span>
            </div>
            <button
              onClick={() => setFeedbackNotice(null)}
              className="text-sky-600 hover:text-sky-900 font-bold px-2 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Corpo do Modal */}
        <div className="flex-1 bg-slate-100 p-3 sm:p-5 overflow-y-auto">
          
          {viewMode === 'visual' ? (
            /* Visualização Fiel em HTML com classe print-container */
            <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 shadow-md border border-slate-300 rounded-sm print-container">
              
              {isControleMensal ? (
                /* CONTROLE DE OBJETOS RECONDICIONADOS */
                <div className="space-y-4 font-sans text-xs">
                  <div className="flex items-center gap-3.5 pb-2 border-b border-slate-300">
                    <div className="h-12 w-12 rounded-lg bg-white p-1 border border-slate-200 shrink-0 flex items-center justify-center">
                      <img src={CORREIOS_LOGO_SRC} alt="Correios" className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <h1 className="text-base sm:text-lg font-black uppercase tracking-tight">
                        <span className="text-slate-900">CONTROLE DE OBJETOS RECONDICIONADOS {settings.nomeUnidade} </span>
                        <span className="text-slate-950 font-bold">{mesExtenso} {controleYear}</span>
                      </h1>
                      <div className="text-[11px] text-slate-600 font-mono">
                        EMPRESA BRASILEIRA DE CORREIOS E TELÉGRAFOS · DR: {settings.dr} · STO: {settings.codigoSto}
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-black overflow-x-auto">
                    <table className="w-full text-center border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 font-bold border-b border-black divide-x divide-black text-slate-900">
                          <th rowSpan={2} className="px-1.5 py-1.5 w-10 text-center">DIA</th>
                          <th rowSpan={2} className="px-1.5 py-1.5 w-10 text-center">ITEM</th>
                          <th rowSpan={2} className="px-2 py-1.5 min-w-[130px] text-center">RASTREAMENTO</th>
                          <th colSpan={2} className="px-2 py-1 text-center border-b border-black">PESO</th>
                          <th rowSpan={2} className="px-2 py-1.5 min-w-[160px] text-center">POSTAGEM</th>
                          <th rowSpan={2} className="px-2 py-1.5 min-w-[90px] text-center">DESTINO</th>
                          <th rowSpan={2} className="px-2 py-1.5 min-w-[90px] text-center leading-tight">AI/TC/<br />CIE</th>
                          <th rowSpan={2} className="px-2 py-1.5 min-w-[150px] text-center">MOTIVO</th>
                          <th rowSpan={2} className="px-2 py-1.5 min-w-[95px] text-center">OPERADOR</th>
                        </tr>
                        <tr className="bg-slate-50 font-bold border-b border-black divide-x divide-black text-slate-900">
                          <th className="px-1 py-1 w-14 text-center">POST</th>
                          <th className="px-1 py-1 w-14 text-center">REAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black font-bold text-slate-950">
                        {controleRecords.map((r) => (
                          <tr key={r.id} className="divide-x divide-black h-7">
                            <td className="px-1 py-1 text-center">{r.diaDoMes || (r.dataConstatacao ? r.dataConstatacao.split('-')[2] : '')}</td>
                            <td className="px-1 py-1 text-center">{r.itemNumero}</td>
                            <td className="px-2 py-1 text-center font-mono">{r.codigoRastreamento}</td>
                            <td className="px-1 py-1 text-center font-mono">{r.pesoPostalGramas}</td>
                            <td className="px-1 py-1 text-center font-mono">{r.pesoRealGramas}</td>
                            <td className="px-2 py-1 text-center text-[10px] uppercase">{r.unidadePostagem}</td>
                            <td className="px-2 py-1 text-center font-mono">{r.unidadeDestinoCodigo}</td>
                            <td className="px-2 py-1 text-center font-mono text-[9px] leading-tight uppercase">{r.termoNumero || r.aiTcCie}</td>
                            <td className="px-2 py-1 text-center uppercase">{r.motivoResumo}</td>
                            <td className="px-2 py-1 text-center font-mono">{r.operadorMatricula}</td>
                          </tr>
                        ))}

                        {Array.from({ length: Math.max(6, 12 - controleRecords.length) }).map((_, i) => (
                          <tr key={'empty-' + i} className="divide-x divide-black h-6">
                            <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                          </tr>
                        ))}

                        <tr className="border-t-2 border-black font-bold divide-x divide-black bg-slate-50">
                          <td colSpan={9} className="px-3 py-2 text-center text-xs font-black text-slate-900 uppercase">
                            TOTAL DE TERMOS DO PERÍODO
                          </td>
                          <td className="px-2 py-2 text-center text-slate-950 font-mono text-xs font-bold">
                            {controleRecords.length > 0 ? controleRecords.length : ''}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900 uppercase whitespace-nowrap">
                        GERENTE {settings.nomeUnidade.toUpperCase()}
                      </span>
                      <div className="w-72 border-b-2 border-black"></div>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {settings.chefeNome} · Matrícula: {settings.chefeMatricula}
                    </p>
                  </div>
                </div>
              ) : record ? (
                /* TERMO DE CONSTATAÇÃO - FORMATO RETRATO */
                <div className="border-2 border-black font-sans text-xs divide-y-2 divide-black text-slate-950 bg-white">
                  
                  {/* Linha 1 */}
                  <div className="grid grid-cols-12 divide-x-2 divide-black h-16">
                    <div className="col-span-3 flex items-center justify-center p-1.5 bg-white">
                      <img src={CORREIOS_LOGO_SRC} alt="Correios" className="max-h-12 max-w-full object-contain" />
                    </div>
                    <div className="col-span-6 flex items-center justify-center font-black text-base text-slate-900 text-center">
                      TERMO DE CONSTATAÇÃO
                    </div>
                    <div className="col-span-3 p-1 flex flex-col justify-between">
                      <span className="text-[10px] text-slate-700 font-bold block">NUMERO</span>
                      <div className="flex items-center justify-center gap-1">
                        <div className="border border-black px-2 py-0.5 font-bold font-mono text-slate-950 text-sm">
                          {record.termoNumero}
                        </div>
                        <span className="font-bold">/</span>
                        <div className="border border-black px-1.5 py-0.5 font-bold text-[10px] text-slate-950">
                          {record.anoCorrente || 2026}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Linha 2 */}
                  <div className="grid grid-cols-12 divide-x-2 divide-black p-1.5 text-[11px]">
                    <div className="col-span-7 px-1">
                      <span className="text-[9px] text-slate-700 font-bold block">UNIDADE (ONDE FOI CONSTATADA A IRREGULARIDADE)</span>
                      <strong className="text-slate-950 uppercase font-black">{settings.nomeUnidade}</strong>
                    </div>
                    <div className="col-span-2 px-1 text-center">
                      <span className="text-[9px] text-slate-700 font-bold block">DR</span>
                      <strong className="text-slate-950 font-black">{settings.dr}</strong>
                    </div>
                    <div className="col-span-3 px-1 text-center">
                      <span className="text-[9px] text-slate-700 font-bold block">CODIGO STO</span>
                      <strong className="text-slate-950 font-black">{settings.codigoSto}</strong>
                    </div>
                  </div>

                  {/* Linha 3 */}
                  <div className="grid grid-cols-12 divide-x-2 divide-black p-1.5 text-[11px]">
                    <div className="col-span-5 px-1">
                      <span className="text-[9px] text-slate-700 font-bold block">UNIDADE DE POSTAGEM</span>
                      <strong className="text-slate-950 font-bold uppercase">{record.unidadePostagem}</strong>
                    </div>
                    <div className="col-span-3 px-1">
                      <span className="text-[9px] text-slate-700 font-bold block">NÚMERO OBJETO</span>
                      <strong className="text-slate-950 font-mono font-bold">{record.codigoRastreamento}</strong>
                    </div>
                    <div className="col-span-2 px-1 text-center">
                      <span className="text-[9px] text-slate-700 font-bold block">PESO (Gs)</span>
                      <strong className="text-slate-950 font-mono font-bold">{record.pesoPostalGramas}</strong>
                    </div>
                    <div className="col-span-2 px-1 text-center">
                      <span className="text-[9px] text-slate-700 font-bold block">VALOR DECL.</span>
                      <strong className="text-slate-950 font-bold">{record.valorDeclaradoTexto || 'NC'}</strong>
                    </div>
                  </div>

                  {/* Linha 4 */}
                  <div className="p-1.5 px-2 text-[11px]">
                    <span className="text-[9px] text-slate-700 font-bold block">NOME DO REMETENTE</span>
                    <strong className="text-slate-950 font-bold uppercase">{record.remetenteNome}</strong>
                  </div>

                  {/* Linha 5 */}
                  <div className="p-1.5 px-2 text-[11px]">
                    <span className="text-[9px] text-slate-700 font-bold block">ENDEREÇO DO REMETENTE</span>
                    <strong className="text-slate-950 font-bold uppercase">{record.remetenteEndereco}</strong>
                  </div>

                  {/* Linha 6 */}
                  <div className="p-1.5 px-2 text-[11px]">
                    <span className="text-[9px] text-slate-700 font-bold block">DESTINATÁRIO</span>
                    <strong className="text-slate-950 font-bold uppercase">{record.destinatarioNome}</strong>
                  </div>

                  {/* Linha 7 */}
                  <div className="p-1.5 px-2 text-[11px]">
                    <span className="text-[9px] text-slate-700 font-bold block">ENDEREÇO DO DESTINATÁRIO</span>
                    <strong className="text-slate-950 font-bold uppercase">{record.destinatarioEndereco}</strong>
                  </div>

                  {/* Linha 8 */}
                  <div className="grid grid-cols-12 divide-x-2 divide-black">
                    <div className="col-span-9 p-2.5 space-y-2 text-[11px]">
                      <strong className="block text-xs uppercase mb-1 font-black">ANORMALIDADES CONSTATADAS</strong>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.embalagemMolhadaParcialmente ? 'X' : ''}
                          </span>
                          <span>Embalagem molhada parcialmente;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.conteudoBalancando ? 'X' : ''}
                          </span>
                          <span>Conteúdo balançando, com suspeita de quebra;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.conteudoExtravasandoLiquido ? 'X' : ''}
                          </span>
                          <span>Conteúdo extravasando líquido;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.embalagemDilaceradaMostraConteudo ? 'X' : ''}
                          </span>
                          <span>Embalagem dilacerada e com mostra do conteúdo;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.embalagemIntactaSemCondicoes ? 'X' : ''}
                          </span>
                          <span>Embalagem intacta, porém sem condições de reintegrar ao tráfego postal;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.conteudoAvariado ? 'X' : ''}
                          </span>
                          <span>Conteúdo avariado;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.embalagemDilaceradaTotalmenteAvariado ? 'X' : ''}
                          </span>
                          <span>Embalagem dilacerada e com mostra do conteúdo totalmente avariado;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.embalagemIntactaMolhadaSemCondicoes ? 'X' : ''}
                          </span>
                          <span>Embalagem intacta, porém molhada e sem condições de reintegração ao tráfego postal;</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                            {record.anomalias?.outrasOcorrencias ? 'X' : ''}
                          </span>
                          <span>Outras (especificar):</span>
                          {record.anomalias?.outrasOcorrencias && (
                            <span className="border border-black px-2 py-0.5 font-bold text-slate-950 text-[11px]">
                              {record.anomalias.outrasOcorrenciasTexto || 'ENCAMINHADA PARA AC SÃO MANUEL'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3 p-2 text-center flex flex-col justify-start">
                      <span className="text-[10px] font-bold text-slate-800 block">CARIMBO DATADOR</span>
                      <div className="flex-1 mt-2 border border-dashed border-slate-400 min-h-[110px]"></div>
                    </div>
                  </div>

                  {/* Linha 9: PROVIDÊNCIAS COMPLETA (TODAS AS OPÇÕES EXATAS DO MODELO) */}
                  <div className="p-2.5 space-y-1.5 text-[11px]">
                    <strong className="block text-xs uppercase mb-1 font-black">PROVIDÊNCIAS</strong>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.providencias?.tipo === 'encaminhado_destino' ? 'X' : ''}
                        </span>
                        <span>Encaminhado ao destino;</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.providencias?.tipo === 'recondicionado_encaminhado' ? 'X' : ''}
                        </span>
                        <span>Recondicionado e encaminhado ao destino;</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.providencias?.tipo === 'devolvido_postagem' ? 'X' : ''}
                        </span>
                        <span>Devolvido a unidade de postagem [ &nbsp; ] em [ &nbsp; ]/[ &nbsp; ]/[ &nbsp; ];</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.providencias?.tipo === 'auto_irregularidade' ? 'X' : ''}
                        </span>
                        <span>Auto de Irregularidade de nº [ &nbsp; ]/[ &nbsp; ], lavrado em [ &nbsp; ]/[ &nbsp; ]/[ &nbsp; ];</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.providencias?.tipo === 'destruicao' ? 'X' : ''}
                        </span>
                        <span>Destruído. Emitido o Termo de Destruição nº [ &nbsp; ]/[ &nbsp; ] em [ &nbsp; ]/[ &nbsp; ]/[ &nbsp; ], conforme anexo, dado a inviabilidade de reintegrar ao tráfego postal;</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.providencias?.tipo === 'orgao_seg_operacional' ? 'X' : ''}
                        </span>
                        <span>Encaminhado ao Órgão de Seg. Operacional/DR/ [ &nbsp; ], face [ &nbsp; ];</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.providencias?.tipo === 'outras' ? 'X' : ''}
                        </span>
                        <span>Outras (especificar):</span>
                        {record.providencias?.tipo === 'outras' && (
                          <span className="border border-black px-2 py-0.5 font-bold text-slate-950 text-[11px]">
                            {record.providencias.outrasDescricao || 'ENCAMINHADA PARA AC SÃO MANUEL'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Linha 10 */}
                  <div className="divide-y border-t border-black text-[11px]">
                    <div className="grid grid-cols-12 divide-x-2 divide-black p-1 text-center font-bold text-[10px]">
                      <div className="col-span-6">CONFERENTES / TESTEMUNHAS</div>
                      <div className="col-span-3">MATRÍCULAS</div>
                      <div className="col-span-3">ASSINATURAS</div>
                    </div>
                    <div className="grid grid-cols-12 divide-x-2 divide-black p-1 text-center font-bold text-[10px]">
                      <div className="col-span-6">CHEFE DA UNIDADE</div>
                      <div className="col-span-3">MATRÍCULA</div>
                      <div className="col-span-3">ASSINATURA</div>
                    </div>
                    <div className="grid grid-cols-12 divide-x-2 divide-black p-2 text-center text-[11px]">
                      <div className="col-span-6 font-bold text-slate-950">{settings.chefeNome}</div>
                      <div className="col-span-3 font-mono font-bold text-slate-950">{settings.chefeMatricula}</div>
                      <div className="col-span-3"></div>
                    </div>
                  </div>

                  {/* Linha 11 */}
                  <div className="p-2.5 space-y-2 text-[11px]">
                    <div className="font-bold flex items-center gap-2 text-slate-950">
                      <span>DECLARAÇÃO DO DESTINATÁRIO [ ] OU REMETENTE [ ] :</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.declaracao?.tipo === 'aceite_sem_contestacao' ? 'X' : ''}
                        </span>
                        <span>Aceito o objeto sem contestação;</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.declaracao?.tipo === 'aceite_com_contestacao' ? 'X' : ''}
                        </span>
                        <span>Aceito o objeto com contestação, conforme ressalva à parte;</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="border border-black w-4 h-4 inline-flex items-center justify-center font-bold text-xs leading-none">
                          {record.declaracao?.tipo === 'recusa' ? 'X' : ''}
                        </span>
                        <span>Recuso o objeto, face [ &nbsp; ];</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 pt-6 text-center text-[10px]">
                      <div>
                        <div className="border-b border-black mb-1"></div>
                        <span>ASSINATURA</span>
                      </div>
                      <div>
                        <div className="border-b border-black mb-1"></div>
                        <span>DOC. DE IDENTIFICAÇÃO</span>
                      </div>
                      <div>
                        <div className="border-b border-black mb-1"></div>
                        <span>DATA</span>
                      </div>
                    </div>
                  </div>

                </div>
              ) : null}

            </div>
          ) : (
            /* Visualizador PDF Nativo do Navegador com iframe e fallback */
            <div className="w-full h-full flex flex-col items-center justify-center p-2">
              {blobUrl ? (
                <div className="w-full h-full flex flex-col min-h-[580px] bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
                  <iframe
                    src={blobUrl}
                    title="Visualizador do PDF"
                    className="w-full h-full min-h-[580px] border-0"
                  />
                </div>
              ) : (
                <div className="text-center text-slate-500 text-xs">
                  Carregando PDF...
                </div>
              )}
            </div>
          )}

        </div>

        {/* Rodapé do Modal */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 no-print">
          <div className="flex items-center gap-2">
            <span>Dica: Use <strong>"Imprimir"</strong> para diálogo direto, <strong>"Abrir PDF"</strong> para nova janela ou <strong>"Baixar PDF"</strong> para arquivar.</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={printBlobUrl || blobUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handlePrintClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold bg-[#FFCC00] hover:bg-yellow-300 text-[#002D56] rounded-lg shadow-xs transition-colors cursor-pointer text-xs"
              title="Abrir diálogo de impressão em nova aba"
            >
              <Printer className="w-3.5 h-3.5 text-[#002D56]" />
              <span>Imprimir</span>
            </a>
            <a
              href={blobUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenPdfClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold bg-sky-100 hover:bg-sky-200 text-sky-900 rounded-lg border border-sky-300 transition-colors cursor-pointer text-xs"
              title="Abrir PDF original em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#00416B]" />
              <span>Abrir PDF</span>
            </a>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-black bg-[#FFCC00] hover:bg-yellow-300 text-[#002D56] rounded-lg border border-yellow-400 transition-colors cursor-pointer text-xs shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Arquivo PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer text-xs"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
