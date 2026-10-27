import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Layers, 
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Trash2
} from 'lucide-react';
import { ObjetoRecord, UnitSettings } from '../types';
import { MESES_POR_EXTENSO, gerarControleMensalPDF, gerarLoteTermosPDF, downloadPDF } from '../services/pdfGenerator';
import { logControleMensalEmissao, deleteRecordsByMonth } from '../services/storage';
import { CORREIOS_LOGO_SRC } from '../assets/correiosLogo';

interface ControleMensalViewProps {
  records: ObjetoRecord[];
  settings: UnitSettings;
  currentYear: number;
  currentMonth: number;
  onOpenPdfModal: (doc: any, filename: string, title: string, subtitle?: string, extra?: any) => void;
  onOpenPdfTermo: (record: ObjetoRecord) => void;
  onSelectRecordForEdit: (record: ObjetoRecord) => void;
  onDeleteRecord: (record: ObjetoRecord) => void;
}

export const ControleMensalView: React.FC<ControleMensalViewProps> = ({
  records,
  settings,
  currentYear,
  currentMonth,
  onOpenPdfModal,
  onOpenPdfTermo,
  onSelectRecordForEdit,
  onDeleteRecord,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Registros do período selecionado
  const monthRecords = records.filter(
    (r) => r.anoReferencia === selectedYear && r.mesReferencia === selectedMonth && r.status !== 'cancelado'
  );

  // Ordenados por data e item
  const sortedRecords = [...monthRecords].sort((a, b) => {
    if (a.dataConstatacao !== b.dataConstatacao) {
      return a.dataConstatacao.localeCompare(b.dataConstatacao);
    }
    return a.itemNumero - b.itemNumero;
  });

  const filteredRecords = sortedRecords.filter((rec) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      rec.codigoRastreamento.toLowerCase().includes(term) ||
      rec.termoNumero.toLowerCase().includes(term) ||
      rec.remetenteNome.toLowerCase().includes(term) ||
      rec.destinatarioNome.toLowerCase().includes(term) ||
      rec.unidadePostagem.toLowerCase().includes(term) ||
      rec.motivoResumo.toLowerCase().includes(term)
    );
  });

  const mesExtenso = MESES_POR_EXTENSO[selectedMonth - 1] || 'OUTUBRO';
  const totalTermosNoPeriodo = sortedRecords.length;
  const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const handleGerarPdfControle = (directDownload = false) => {
    const doc = gerarControleMensalPDF(selectedMonth, selectedYear, sortedRecords, settings);
    const filename = `Controle_Objetos_Recondicionados_CDD_Sao_Manuel_${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`;
    
    logControleMensalEmissao(selectedYear, selectedMonth, settings.operadorMatriculaPadrao, filename);

    if (directDownload) {
      downloadPDF(doc, filename);
    }

    onOpenPdfModal(
      doc,
      filename,
      `Controle de Objetos Recondicionados · ${mesExtenso} ${selectedYear}`,
      `${totalTermosNoPeriodo} termos registrados`,
      {
        isControleMensal: true,
        controleRecords: sortedRecords,
        controleMonth: selectedMonth,
        controleYear: selectedYear,
      } as any
    );
  };

  const handleGerarLoteTermos = (directDownload = false) => {
    const doc = gerarLoteTermosPDF(sortedRecords, settings);
    const filename = `Termos_Constatacao_Lote_${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`;

    if (directDownload) {
      downloadPDF(doc, filename);
    }

    onOpenPdfModal(
      doc,
      filename,
      `Lote de Termos de Constatação · ${mesExtenso} ${selectedYear}`,
      `${sortedRecords.length} termos de constatação gerados`,
      {
        isControleMensal: false,
        record: sortedRecords[0] || null,
      } as any
    );
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Otimização do Cabeçalho e Controles */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-[#00416B] rounded-xl border border-sky-200">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Controle Mensal de Objetos</h2>
              <p className="text-xs text-slate-500">Folha oficial consolidada do CDD São Manuel para {mesExtenso} de {selectedYear}</p>
            </div>
          </div>

          {/* Quick Period Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shadow-xs">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-xs font-black text-slate-900 min-w-[120px] text-center">
                {mesExtenso} {selectedYear}
              </div>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-700 hover:text-slate-900 hover:bg-white rounded-md transition-colors cursor-pointer"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg shadow-xs cursor-pointer"
            >
              {MESES_POR_EXTENSO.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg shadow-xs cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {(selectedYear !== currentYear || selectedMonth !== currentMonth) && (
              <button
                onClick={() => {
                  setSelectedYear(currentYear);
                  setSelectedMonth(currentMonth);
                }}
                className="text-xs text-[#00416B] font-bold hover:underline ml-1 cursor-pointer"
              >
                Mês Atual
              </button>
            )}
          </div>

        </div>

        {/* Action Buttons & Search Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por rastreamento, termo, destinatário ou motivo..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00416B]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleGerarPdfControle(false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#00416B] hover:bg-[#003152] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-transform active:scale-95"
              title="Visualizar e Imprimir a Folha de Controle Mensal"
            >
              <FileSpreadsheet className="w-4 h-4 text-yellow-300" />
              <span>Visualizar Controle</span>
            </button>

            <button
              onClick={() => handleGerarPdfControle(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-yellow-300 text-[#002D56] text-xs font-black rounded-lg shadow-xs cursor-pointer transition-transform active:scale-95"
              title="Baixar PDF do Controle Mensal no computador"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF Controle</span>
            </button>

            <button
              onClick={() => handleGerarLoteTermos(true)}
              disabled={sortedRecords.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-transform active:scale-95"
              title="Baixar todos os Termos de Constatação do mês em PDF único"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Baixar Lote Termos ({sortedRecords.length})</span>
            </button>
            
            <button
              onClick={() => {
                if (window.confirm(`Deseja FINALIZAR o mês de ${MESES_POR_EXTENSO[selectedMonth - 1]} / ${selectedYear}? Isso imprimirá o controle, salvará os PDFs e APAGARÁ os registros deste mês do banco.`)) {
                  handleGerarPdfControle(true); // Imprime controle
                  deleteRecordsByMonth(selectedYear, selectedMonth, settings.nomeUnidade);
                  window.location.reload(); // Recarrega para limpar o estado
                }
              }}
              disabled={sortedRecords.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-transform active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Finalizar Mês</span>
            </button>
          </div>

        </div>

      </div>

      {/* Visualização da Folha Oficial (Fontes em Preto) */}
      <div className="bg-white rounded-xl border-2 border-slate-300 shadow-md p-6 space-y-4">
        
        {/* Título da Folha com Logo Oficial dos Correios */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b-2 border-slate-300 gap-3">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-lg bg-white p-1 border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center">
              <img src={CORREIOS_LOGO_SRC} alt="Correios" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base lg:text-lg font-black tracking-tight uppercase whitespace-nowrap overflow-x-auto pb-0.5">
                <span className="text-slate-900">CONTROLE DE OBJETOS RECONDICIONADOS {settings.nomeUnidade} </span>
                <span className="text-slate-950 font-black">{mesExtenso} {selectedYear}</span>
              </h1>
              <div className="text-xs text-slate-600 font-mono">
                EMPRESA BRASILEIRA DE CORREIOS E TELÉGRAFOS · Unidade: <strong>{settings.nomeUnidade}</strong> · DR: <strong>{settings.dr}</strong> · STO: <strong>{settings.codigoSto}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de 10 Colunas Oficial (Fontes 100% Pretas) */}
        <div className="overflow-x-auto border-2 border-slate-900 rounded-sm">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-950 font-bold border-b border-slate-900 divide-x divide-slate-900">
                <th rowSpan={2} className="px-2 py-2 w-12 text-center">DIA</th>
                <th rowSpan={2} className="px-2 py-2 w-12 text-center">ITEM</th>
                <th rowSpan={2} className="px-3 py-2 min-w-[140px] text-center">RASTREAMENTO</th>
                <th colSpan={2} className="px-3 py-1 text-center border-b border-slate-900">PESO</th>
                <th rowSpan={2} className="px-3 py-2 min-w-[180px] text-center">POSTAGEM</th>
                <th rowSpan={2} className="px-3 py-2 min-w-[100px] text-center">DESTINO</th>
                <th rowSpan={2} className="px-3 py-2 min-w-[100px] text-center leading-tight">AI/TC/<br />CIE</th>
                <th rowSpan={2} className="px-3 py-2 min-w-[180px] text-center">MOTIVO</th>
                <th rowSpan={2} className="px-3 py-2 min-w-[110px] text-center">OPERADOR</th>
                <th rowSpan={2} className="px-2 py-2 w-14 text-center bg-slate-100">AÇÃO</th>
              </tr>
              <tr className="bg-slate-50 text-slate-950 font-bold border-b border-slate-900 divide-x divide-slate-900">
                <th className="px-2 py-1 w-16 text-center">POST</th>
                <th className="px-2 py-1 w-16 text-center">REAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredRecords.map((rec) => {
                const dia = rec.diaDoMes || (rec.dataConstatacao ? rec.dataConstatacao.split('-')[2] : '--');

                return (
                  <tr 
                    key={rec.id} 
                    className="divide-x divide-slate-900 font-bold text-slate-950 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-2 py-2.5 text-center font-mono">{dia}</td>
                    <td className="px-2 py-2.5 text-center font-mono">{rec.itemNumero}</td>
                    <td className="px-3 py-2.5 text-center font-mono tracking-wider">{rec.codigoRastreamento}</td>
                    <td className="px-2 py-2.5 text-center font-mono">{rec.pesoPostalGramas}</td>
                    <td className="px-2 py-2.5 text-center font-mono">{rec.pesoRealGramas}</td>
                    <td className="px-3 py-2.5 text-center text-[11px] uppercase">{rec.unidadePostagem}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{rec.unidadeDestinoCodigo}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-[10px] leading-tight uppercase">{rec.termoNumero || rec.aiTcCie}</td>
                    <td className="px-3 py-2.5 text-center uppercase tracking-wide">{rec.motivoResumo}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{rec.operadorMatricula}</td>
                    <td className="px-2 py-2 text-center bg-slate-50">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpenPdfTermo(rec)}
                          className="p-1 text-[#00416B] hover:bg-sky-100 rounded cursor-pointer transition-colors"
                          title="Gerar Termo Individual"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectRecordForEdit(rec)}
                          className="p-1 text-slate-700 hover:bg-slate-200 rounded cursor-pointer transition-colors"
                          title="Editar Registro"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRecord(rec)}
                          className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-100 rounded cursor-pointer transition-colors"
                          title="Excluir Objeto Lançado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Linhas Vazias de Preenchimento */}
              {Array.from({ length: Math.max(8, 14 - filteredRecords.length) }).map((_, i) => (
                <tr key={'empty-' + i} className="divide-x divide-slate-900 h-8">
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-2 py-2 bg-slate-50/50"></td>
                </tr>
              ))}

              {/* Linha de Totalização */}
              <tr className="border-t-2 border-slate-900 font-bold divide-x divide-slate-900 bg-slate-50">
                <td colSpan={9} className="px-4 py-3 text-center text-sm font-black text-slate-950 uppercase tracking-wider">
                  TOTAL DE TERMOS DO PERÍODO
                </td>
                <td className="px-3 py-3 text-center font-black text-slate-950 text-sm font-mono">
                  {totalTermosNoPeriodo > 0 ? totalTermosNoPeriodo : ''}
                </td>
                <td className="bg-slate-50"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rodapé: Assinatura do Gerente */}
        <div className="pt-6 pb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-slate-950 uppercase tracking-tight whitespace-nowrap">
              GERENTE {settings.nomeUnidade.toUpperCase()}
            </span>
            <div className="w-80 border-b-2 border-slate-950"></div>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            {settings.chefeNome} · Matrícula: {settings.chefeMatricula}
          </p>
        </div>

      </div>

    </div>
  );
};
