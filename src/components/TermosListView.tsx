import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Eye, 
  Edit3, 
  Search, 
  Layers, 
  CheckSquare, 
  Square, 
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpDown,
  Trash2
} from 'lucide-react';
import { ObjetoRecord, UnitSettings } from '../types';
import { gerarTermoConstatacaoPDF, gerarLoteTermosPDF, downloadPDF } from '../services/pdfGenerator';

interface TermosListViewProps {
  records: ObjetoRecord[];
  settings: UnitSettings;
  currentYear: number;
  currentMonth: number;
  onOpenPdfTermo: (record: ObjetoRecord) => void;
  onOpenPdfModal: (doc: any, filename: string, title: string, subtitle?: string) => void;
  onSelectRecordForEdit: (record: ObjetoRecord) => void;
  onDeleteRecord: (record: ObjetoRecord) => void;
}

export const TermosListView: React.FC<TermosListViewProps> = ({
  records,
  settings,
  currentYear,
  currentMonth,
  onOpenPdfTermo,
  onOpenPdfModal,
  onSelectRecordForEdit,
  onDeleteRecord,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'emitidos' | 'cadastrados'>('todos');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Registros válidos (não cancelados)
  const validRecords = records.filter(r => r.status !== 'cancelado');

  // Filtragem
  const filtered = validRecords.filter(rec => {
    // Status
    if (statusFilter === 'emitidos' && rec.status !== 'termo_emitido' && rec.status !== 'reemitido') return false;
    if (statusFilter === 'cadastrados' && (rec.status === 'termo_emitido' || rec.status === 'reemitido')) return false;

    // Busca textual
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      rec.termoNumero.toLowerCase().includes(q) ||
      rec.codigoRastreamento.toLowerCase().includes(q) ||
      rec.destinatarioNome.toLowerCase().includes(q) ||
      rec.remetenteNome.toLowerCase().includes(q) ||
      rec.motivoResumo.toLowerCase().includes(q)
    );
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(r => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGerarSelecionados = () => {
    const selectedRecords = filtered.filter(r => selectedIds.includes(r.id));
    if (selectedRecords.length === 0) return;

    const doc = gerarLoteTermosPDF(selectedRecords, settings);
    const filename = `Termos_Constatacao_Selecionados_${selectedRecords.length}_docs.pdf`;
    onOpenPdfModal(
      doc,
      filename,
      `Lote Personalizado (${selectedRecords.length} Termos)`,
      `Gerado a partir da seleção do usuário`
    );
  };

  const handleDirectDownload = (rec: ObjetoRecord) => {
    const doc = gerarTermoConstatacaoPDF(rec, settings);
    const safeTermo = rec.termoNumero.replace(/[^a-zA-Z0-9]/g, '_');
    downloadPDF(doc, `Termo_Constatacao_${safeTermo}_${rec.codigoRastreamento}.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por Nº do termo, rastreamento ou destinatário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00416B]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({validRecords.length})
            </button>
            <button
              onClick={() => setStatusFilter('emitidos')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'emitidos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Emitidos
            </button>
            <button
              onClick={() => setStatusFilter('cadastrados')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'cadastrados' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendentes de Emissão
            </button>
          </div>
        </div>

        {/* Action Button for Selected */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleGerarSelecionados}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCC00] hover:bg-yellow-300 text-[#002D56] text-xs font-bold rounded-lg shadow-xs transition-transform active:scale-95"
            >
              <Layers className="w-4 h-4" />
              <span>Gerar PDF Selecionados ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              const doc = gerarLoteTermosPDF(validRecords, settings);
              onOpenPdfModal(
                doc,
                `Todos_Termos_Constatacao_CDD_Sao_Manuel.pdf`,
                `Todos os Termos Cadastrados`,
                `${validRecords.length} termos no arquivo`
              );
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Todos ({validRecords.length})</span>
          </button>
        </div>

      </div>

      {/* Grid of Termos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Header with Select All */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900"
            >
              {selectedIds.length === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-[#00416B]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Selecionar Todos ({filtered.length})</span>
            </button>
          </div>

          <div>
            <span>Listagem Oficial de Termos de Constatação</span>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">Nenhum Termo de Constatação encontrado.</p>
              <p className="text-xs text-slate-400 mt-1">Cadastre novos objetos para emitir os respectivos termos.</p>
            </div>
          ) : (
            filtered.map((rec) => {
              const isSelected = selectedIds.includes(rec.id);
              const dataBR = rec.dataConstatacao
                ? rec.dataConstatacao.split('-').reverse().join('/')
                : '--';

              return (
                <div 
                  key={rec.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isSelected ? 'bg-sky-50/50' : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Left Side: Checkbox, Term Number, Tracking, Dates */}
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleSelectOne(rec.id)}
                      className="mt-1 text-slate-400 hover:text-[#00416B]"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-[#00416B]" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-[#00416B] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          Termo Nº {rec.termoNumero}
                        </span>
                        
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {rec.codigoRastreamento}
                        </span>

                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          rec.status === 'termo_emitido'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : rec.status === 'reemitido'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {rec.status === 'termo_emitido' ? 'Termo Emitido (v' + (rec.versaoDocumento || 1) + ')' : 
                           rec.status === 'reemitido' ? 'Reemitido (v' + (rec.versaoDocumento || 1) + ')' : 'Pendente Emissão'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                        <span>Data: <strong>{dataBR}</strong></span>
                        <span>·</span>
                        <span>Pesos: {rec.pesoPostalGramas}g (post) / <strong>{rec.pesoRealGramas}g (real)</strong></span>
                        <span>·</span>
                        <span className="text-slate-500">Origem: {rec.unidadePostagem}</span>
                      </div>

                      {/* Partes */}
                      <div className="text-xs text-slate-700 pt-1">
                        <span className="font-semibold text-slate-800">Destinatário:</span> {rec.destinatarioNome} 
                        <span className="text-slate-400 mx-1.5">|</span>
                        <span className="font-semibold text-slate-800">Remetente:</span> {rec.remetenteNome}
                      </div>

                      {/* Motivo resumido */}
                      <div className="text-xs text-slate-600 pt-0.5">
                        <span className="font-medium text-slate-500">Anomalia constatada:</span> {rec.motivoResumo}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Action Buttons */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => onSelectRecordForEdit(rec)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg border border-slate-300 transition-colors"
                      title="Editar dados cadastrais"
                    >
                      <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                      Editar
                    </button>

                    <button
                      onClick={() => handleDirectDownload(rec)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      title="Baixar PDF diretamente"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onOpenPdfTermo(rec)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00416B] hover:bg-[#003152] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="Visualizar e imprimir Termo Oficial em PDF"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar Termo</span>
                    </button>

                    <button
                      onClick={() => onDeleteRecord(rec)}
                      className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      title="Excluir Objeto Lançado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
};
