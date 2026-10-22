/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CadastroForm } from './components/CadastroForm';
import { ControleMensalView } from './components/ControleMensalView';
import { TermosListView } from './components/TermosListView';
import { ConfiguracoesView } from './components/ConfiguracoesView';
import { PDFPreviewModal } from './components/PDFPreviewModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ObjetoRecord, UnitSettings } from './types';
import { 
  getAllRecords, 
  getSettings, 
  logControleMensalEmissao,
  deleteRecord,
  syncWithServer,
  getServerStatus,
  ServerStatusInfo,
  exportDataToJson 
} from './services/storage';
import { 
  gerarTermoConstatacaoPDF, 
  gerarControleMensalPDF, 
  gerarLoteTermosPDF, 
  downloadPDF,
  MESES_POR_EXTENSO 
} from './services/pdfGenerator';
import { CheckCircle2, CloudUpload, Download } from 'lucide-react';

export default function App() {
  const [records, setRecords] = useState<ObjetoRecord[]>([]);
  const [settings, setSettings] = useState<UnitSettings>(getSettings());
  const [currentTab, setCurrentTab] = useState<string>('controle_mensal');
  const [editingRecord, setEditingRecord] = useState<ObjetoRecord | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerStatusInfo | null>(null);

  // Mês e Ano correntes identificados dinamicamente na abertura do sistema
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12

  // Modal de Pré-visualização de PDF
  const [pdfModalState, setPdfModalState] = useState<{
    isOpen: boolean;
    pdfDoc: any | null;
    filename: string;
    title: string;
    subtitle?: string;
    record?: ObjetoRecord | null;
    isControleMensal?: boolean;
    controleRecords?: ObjetoRecord[];
    controleMonth?: number;
    controleYear?: number;
  }>({
    isOpen: false,
    pdfDoc: null,
    filename: '',
    title: '',
  });

  // Notificação toast temporária
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carregar dados e sincronizar com o Servidor Local Central
  useEffect(() => {
    refreshData();

    const doSync = () => {
      syncWithServer().then(res => {
        if (res) {
          setRecords(res.records);
          if (res.settings) setSettings(res.settings);
        }
      });
      getServerStatus().then(info => {
        if (info) setServerInfo(info);
      });
    };

    doSync();

    // Polling a cada 5 segundos para refletir cadastros de outros computadores da rede
    const interval = setInterval(doSync, 5000);
    window.addEventListener('focus', doSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', doSync);
    };
  }, []);

  const refreshData = () => {
    const loadedRecords = getAllRecords();
    const loadedSettings = getSettings();
    setRecords(loadedRecords);
    setSettings(loadedSettings);
  };

  // Handlers para Ações de PDF
  const handleOpenPdfTermo = (record: ObjetoRecord, autoDownload = false) => {
    const doc = gerarTermoConstatacaoPDF(record, settings);
    const safeTermo = record.termoNumero.replace(/[^a-zA-Z0-9]/g, '_');
    const safeRastreio = record.codigoRastreamento || 'OBJ';
    const filename = `Termo_Constatacao_${safeTermo}_${safeRastreio}.pdf`;

    if (autoDownload) {
      downloadPDF(doc, filename);
    }

    setPdfModalState({
      isOpen: true,
      pdfDoc: doc,
      filename,
      title: `Termo de Constatação Nº ${record.termoNumero}`,
      subtitle: `${record.codigoRastreamento} · ${record.destinatarioNome}`,
      record,
      isControleMensal: false,
    });
  };

  const handleGenerateControleMensal = (mes = currentMonth, ano = currentYear) => {
    const monthRecords = records.filter(
      r => r.anoReferencia === ano && r.mesReferencia === mes && r.status !== 'cancelado'
    );
    const doc = gerarControleMensalPDF(mes, ano, monthRecords, settings);
    const mesNome = MESES_POR_EXTENSO[mes - 1];
    const filename = `Controle_Objetos_Recondicionados_CDD_Sao_Manuel_${ano}-${String(mes).padStart(2, '0')}.pdf`;

    logControleMensalEmissao(ano, mes, settings.operadorMatriculaPadrao, filename);
    refreshData();

    setPdfModalState({
      isOpen: true,
      pdfDoc: doc,
      filename,
      title: `Controle de Objetos Recondicionados · ${mesNome} ${ano}`,
      subtitle: `${monthRecords.length} termos consolidados no período`,
      isControleMensal: true,
      controleRecords: monthRecords,
      controleMonth: mes,
      controleYear: ano,
      record: null,
    });
  };

  const handleGenerateBatchTermos = (mes = currentMonth, ano = currentYear) => {
    const monthRecords = records.filter(
      r => r.anoReferencia === ano && r.mesReferencia === mes && r.status !== 'cancelado'
    );
    const doc = gerarLoteTermosPDF(monthRecords, settings);
    const mesNome = MESES_POR_EXTENSO[mes - 1];
    const filename = `Lote_Termos_Constatacao_${ano}-${String(mes).padStart(2, '0')}.pdf`;

    setPdfModalState({
      isOpen: true,
      pdfDoc: doc,
      filename,
      title: `Todos os Termos de Constatação · ${mesNome} ${ano}`,
      subtitle: `${monthRecords.length} termos de constatação compilados`,
      isControleMensal: false,
      record: null,
    });
  };

  const handleOpenCustomPdfModal = (
    doc: any,
    filename: string,
    title: string,
    subtitle?: string,
    extra?: {
      record?: ObjetoRecord;
      isControleMensal?: boolean;
      controleRecords?: ObjetoRecord[];
      controleMonth?: number;
      controleYear?: number;
    }
  ) => {
    setPdfModalState({
      isOpen: true,
      pdfDoc: doc,
      filename,
      title,
      subtitle,
      record: extra?.record,
      isControleMensal: extra?.isControleMensal,
      controleRecords: extra?.controleRecords,
      controleMonth: extra?.controleMonth,
      controleYear: extra?.controleYear,
    });
  };

  const handleSaveSuccess = (savedRecord: ObjetoRecord, shouldOpenPdf: boolean) => {
    refreshData();
    setEditingRecord(null);
    showToast(`Objeto ${savedRecord.codigoRastreamento} salvo com sucesso!`);

    if (shouldOpenPdf) {
      handleOpenPdfTermo(savedRecord, true);
      setCurrentTab('termos');
    } else {
      setCurrentTab('controle_mensal');
    }

    // Perguntar se deseja gerar backup imediatamente para salvar no OneDrive / Nuvem
    setShowBackupPrompt(true);
  };

  const [showBackupPrompt, setShowBackupPrompt] = useState(false);

  const handleDownloadBackupNow = () => {
    try {
      const jsonStr = exportDataToJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dataIso = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Backup_CDD_Sao_Manuel_${dataIso}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup gerado com sucesso! Salve-o na pasta do OneDrive dos Correios.');
    } catch (e) {
      showToast('Erro ao gerar arquivo de backup.');
    }
    setShowBackupPrompt(false);
  };

  const handleSelectRecordForEdit = (record: ObjetoRecord) => {
    setEditingRecord(record);
    setCurrentTab('cadastro');
  };

  // Exclusão de Objeto Lançado
  const [recordToDelete, setRecordToDelete] = useState<ObjetoRecord | null>(null);

  const handleRequestDelete = (record: ObjetoRecord) => {
    setRecordToDelete(record);
  };

  const handleConfirmDelete = () => {
    if (!recordToDelete) return;
    const tracking = recordToDelete.codigoRastreamento;
    const termoNum = recordToDelete.termoNumero;
    deleteRecord(recordToDelete.id);
    refreshData();
    if (editingRecord?.id === recordToDelete.id) {
      setEditingRecord(null);
      setCurrentTab('controle_mensal');
    }
    setRecordToDelete(null);
    showToast(`Objeto ${tracking} (Termo Nº ${termoNum}) excluído com sucesso!`);
  };

  const currentMonthRecords = records.filter(
    r => r.anoReferencia === currentYear && r.mesReferencia === currentMonth && r.status !== 'cancelado'
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-[#FFCC00] selection:text-[#002D56]">
      
      {/* Top Notification Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg border border-emerald-500 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab !== 'cadastro') {
            setEditingRecord(null);
          }
          setCurrentTab(tab);
        }}
        settings={settings}
        monthlyCount={currentMonthRecords.length}
        serverInfo={serverInfo}
      />

      {/* Sub-header Context Banner */}
      <div className="bg-white border-b border-slate-200 py-2.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Módulo Ativo:</span>
            <span className="capitalize font-medium text-[#00416B]">
              {currentTab === 'cadastro' && (editingRecord ? 'Edição de Objeto' : 'Novo Cadastro de Objeto')}
              {currentTab === 'controle_mensal' && 'Folha de Controle Mensal'}
              {currentTab === 'termos' && 'Emissão de Termos de Constatação'}
              {currentTab === 'configuracoes' && 'Configurações Institucionais'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>Período Vigente: <strong className="text-slate-800">{MESES_POR_EXTENSO[currentMonth - 1]} / {currentYear}</strong></span>
            <span>·</span>
            <span>Ambiente: <strong className="text-slate-800">CDD São Manuel (ECT)</strong></span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === 'cadastro' && (
          <CadastroForm
            settings={settings}
            editingRecord={editingRecord}
            onSaveSuccess={handleSaveSuccess}
            onCancel={() => {
              setEditingRecord(null);
              setCurrentTab('controle_mensal');
            }}
            onDelete={handleRequestDelete}
          />
        )}

        {currentTab === 'controle_mensal' && (
          <ControleMensalView
            records={records}
            settings={settings}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onOpenPdfModal={handleOpenCustomPdfModal}
            onOpenPdfTermo={handleOpenPdfTermo}
            onSelectRecordForEdit={handleSelectRecordForEdit}
            onDeleteRecord={handleRequestDelete}
          />
        )}

        {currentTab === 'termos' && (
          <TermosListView
            records={records}
            settings={settings}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onOpenPdfTermo={handleOpenPdfTermo}
            onOpenPdfModal={handleOpenCustomPdfModal}
            onSelectRecordForEdit={handleSelectRecordForEdit}
            onDeleteRecord={handleRequestDelete}
          />
        )}

        {currentTab === 'configuracoes' && (
          <ConfiguracoesView
            settings={settings}
            serverInfo={serverInfo}
            onSettingsUpdated={(newSettings) => {
              setSettings(newSettings);
              showToast('Configurações atualizadas com sucesso!');
            }}
            onDataReset={() => {
              refreshData();
              showToast('Dados recarregados com sucesso!');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wide">CORREIOS</span>
            <span>·</span>
            <span>CDD São Manuel / SP</span>
            <span>·</span>
            <span>Controle de Objetos Recondicionados e Termos de Constatação</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Sistema Operacional em Conformidade Normativa
          </div>
        </div>
      </footer>

      {/* In-App PDF Preview & Print Modal */}
      <PDFPreviewModal
        isOpen={pdfModalState.isOpen}
        onClose={() => setPdfModalState(prev => ({ ...prev, isOpen: false, pdfDoc: null }))}
        pdfDoc={pdfModalState.pdfDoc}
        filename={pdfModalState.filename}
        title={pdfModalState.title}
        subtitle={pdfModalState.subtitle}
        record={pdfModalState.record}
        isControleMensal={pdfModalState.isControleMensal}
        controleRecords={pdfModalState.controleRecords}
        controleMonth={pdfModalState.controleMonth}
        controleYear={pdfModalState.controleYear}
        settings={settings}
      />

      {/* Confirmation Modal for Deleting Registered Objects */}
      <DeleteConfirmModal
        isOpen={!!recordToDelete}
        record={recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Backup Prompt Modal for OneDrive / Cloud Sync */}
      {showBackupPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-300">
                <CloudUpload className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Salvar na Nuvem / OneDrive dos Correios?
                </h3>
                <span className="text-xs text-slate-500 block">
                  Objeto salvo com sucesso! Deseja gerar o backup atualizado para salvar na pasta do OneDrive da unidade?
                </span>
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-xs text-sky-900 leading-relaxed">
              <strong>Dica de Sincronização:</strong> Ao salvar o arquivo de backup na pasta compartilhada do OneDrive, os demais operadores da agência poderão importá-lo instantaneamente para ver este lançamento.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBackupPrompt(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
              >
                Agora Não
              </button>
              <button
                type="button"
                onClick={handleDownloadBackupNow}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-[#002D56] bg-[#FFCC00] hover:bg-yellow-300 rounded-lg shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Sim, Gerar Backup Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
