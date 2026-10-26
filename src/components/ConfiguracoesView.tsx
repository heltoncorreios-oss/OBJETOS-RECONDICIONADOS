import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  Palette, 
  Database,
  Network,
  Copy,
  Check,
  Server,
  Link2,
  Share2
} from 'lucide-react';
import { UnitSettings } from '../types';
import { 
  saveSettings, 
  exportDataToJson, 
  importDataFromJson, 
  resetToSampleData,
  setSequencialManual,
  DEFAULT_SETTINGS,
  ServerStatusInfo,
  getUnitShareUrl
} from '../services/storage';

interface ConfiguracoesViewProps {
  settings: UnitSettings;
  onSettingsUpdated: (newSettings: UnitSettings) => void;
  onDataReset: () => void;
  serverInfo?: ServerStatusInfo | null;
  onSwitchUnit?: (unitName: string) => void;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  settings,
  onSettingsUpdated,
  onDataReset,
  serverInfo,
  onSwitchUnit,
}) => {
  const [formData, setFormData] = useState<UnitSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [targetNewUnit, setTargetNewUnit] = useState('');

  // Atualizar formulário quando a unidade mudar
  React.useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSeq = Math.max(1, parseInt(String(formData.numeroSequenciaInicial), 10) || 1);
    const dateObj = new Date();
    const anoKey = String(dateObj.getFullYear());
    const mesKey = `${anoKey}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

    const updated: UnitSettings = {
      ...formData,
      numeroSequenciaInicial: cleanSeq,
      ultimoSequencialAno: { [anoKey]: cleanSeq - 1 },
      ultimoSequencialMes: { [mesKey]: cleanSeq - 1 },
      sequencialGeral: cleanSeq - 1,
    };

    saveSettings(updated);
    setFormData(updated);
    onSettingsUpdated(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const jsonStr = exportDataToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_CDD_Sao_Manuel_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDataFromJson(content);
      if (res.success) {
        setImportMessage({ type: 'success', text: `Backup restaurado com sucesso! ${res.count} registros carregados.` });
        onDataReset();
      } else {
        setImportMessage({ type: 'error', text: `Falha ao importar: ${res.error}` });
      }
    };
    reader.readAsText(file);
  };

  const handleResetSampleData = () => {
    if (window.confirm('Deseja restaurar os registros originais das imagens enviadas (Termo Nº 99, 98 e 97 do CDD São Manuel)?')) {
      resetToSampleData();
      setFormData(DEFAULT_SETTINGS);
      onSettingsUpdated(DEFAULT_SETTINGS);
      onDataReset();
      setImportMessage({ type: 'success', text: 'Dados restaurados com base nos relatórios originais!' });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#00416B] uppercase tracking-wider">Configurações Gerais</span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dados Fixos da Unidade & Numeração</h1>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre os dados institucionais que são puxados automaticamente para os dois relatórios (Termo de Constatação e Controle Mensal).
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Configurações salvas com sucesso!
          </div>
        )}
      </div>

      {/* Card de Link Exclusivo da Unidade para Acesso Direto */}
      <div className="bg-gradient-to-r from-sky-900 to-[#00416B] text-white rounded-xl shadow-md p-6 space-y-4 border border-sky-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center shrink-0">
              <Link2 className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Acesso Direto Sem Reconfigurar</span>
              </div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Link Exclusivo de {settings.nomeUnidade}
              </h2>
              <span className="text-xs text-sky-200">
                Ao abrir por este link, o sistema já entra automaticamente com o nome, STO e sequencial desta unidade.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(getUnitShareUrl(settings.nomeUnidade))}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FFCC00] hover:bg-yellow-300 text-[#002D56] font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0 active:scale-95"
          >
            {copiedUrl === getUnitShareUrl(settings.nomeUnidade) ? (
              <>
                <Check className="w-4 h-4 text-emerald-800" />
                <span>Link Copiado com Sucesso!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Link Desta Unidade</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-black/25 rounded-lg p-3 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <span className="text-yellow-200 truncate">{getUnitShareUrl(settings.nomeUnidade)}</span>
          <span className="text-[11px] text-sky-200 shrink-0 font-sans font-medium">Salve nos Favoritos do Chrome ou Edge</span>
        </div>

        {/* Alternar ou Criar Ambiente para Outra Unidade */}
        <div className="pt-3 border-t border-sky-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-sky-100">
            <strong>Deseja gerar link ou acessar outra unidade?</strong>
            <p className="text-[11px] text-sky-200">Digite o nome da outra unidade (ex: CDD BOTUCATU, AC LENÇÓIS PAULISTA):</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ex: CDD BOTUCATU"
              value={targetNewUnit}
              onChange={(e) => setTargetNewUnit(e.target.value.toUpperCase())}
              className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold border border-slate-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 uppercase"
            />
            <button
              type="button"
              disabled={!targetNewUnit.trim()}
              onClick={() => {
                if (targetNewUnit.trim() && onSwitchUnit) {
                  onSwitchUnit(targetNewUnit.trim());
                  setTargetNewUnit('');
                }
              }}
              className="px-3 py-1.5 bg-sky-800 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg border border-sky-600 transition-colors cursor-pointer"
            >
              Acessar Unidade
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Bloco 1: Dados Fixos da Unidade */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Building2 className="w-5 h-5 text-[#00416B]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              1. Dados Fixos da Unidade (Campos em Preto nos Relatórios)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Unidade (Cabeçalho) *
              </label>
              <input
                type="text"
                value={formData.nomeUnidade}
                onChange={(e) => setFormData({ ...formData, nomeUnidade: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-bold text-[#00416B]"
              />
              <span className="text-[11px] text-slate-500">Ex: CDD SÃO MANUEL</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                DR (Diretoria Regional) *
              </label>
              <input
                type="text"
                value={formData.dr}
                onChange={(e) => setFormData({ ...formData, dr: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg uppercase font-bold"
              />
              <span className="text-[11px] text-slate-500">Ex: SPI</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código STO / MCU *
              </label>
              <input
                type="text"
                value={formData.codigoSto}
                onChange={(e) => setFormData({ ...formData, codigoSto: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg font-bold"
              />
              <span className="text-[11px] text-slate-500">Ex: 18650-972</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destino Padrão (Código / CEP)
              </label>
              <input
                type="text"
                value={formData.destinoPadrao}
                onChange={(e) => setFormData({ ...formData, destinoPadrao: e.target.value })}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg font-bold"
              />
              <span className="text-[11px] text-slate-500">Ex: 18650065</span>
            </div>

          </div>
        </div>

        {/* Bloco 2: Chefia e Operador Recorrentes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <ShieldCheck className="w-5 h-5 text-[#00416B]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              2. Chefia da Unidade e Operador (Padrão)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-[#00416B] block">Chefe da Unidade (Nome)</span>
              <input
                type="text"
                value={formData.chefeNome}
                onChange={(e) => setFormData({ ...formData, chefeNome: e.target.value.toUpperCase() })}
                placeholder="HELTON JULIO SANTOS MANUEL"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-bold"
              />
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-[#00416B] block">Matrícula do Chefe da Unidade</span>
              <input
                type="text"
                value={formData.chefeMatricula}
                onChange={(e) => setFormData({ ...formData, chefeMatricula: e.target.value })}
                placeholder="8.114.904-2"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded font-bold"
              />
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-[#00416B] block">Matrícula Operador Padrão</span>
              <input
                type="text"
                value={formData.operadorMatriculaPadrao}
                onChange={(e) => setFormData({ ...formData, operadorMatriculaPadrao: e.target.value })}
                placeholder="81149042"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded font-bold"
              />
              <span className="text-[10px] text-slate-500 block">Exibido na coluna OPERADOR da folha mensal</span>
            </div>

          </div>
        </div>

        {/* Bloco 2.5: Regras de Numeração */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <RotateCcw className="w-5 h-5 text-[#00416B]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              3. Regras de Numeração dos Termos de Constatação
            </h2>
          </div>

          <div className="max-w-xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Número de Sequência Inicial (Próximo Termo a ser Gerado) *
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={formData.numeroSequenciaInicial}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setFormData({ ...formData, numeroSequenciaInicial: isNaN(val) ? 1 : Math.max(1, val) });
                  }}
                  className="w-36 px-3 py-2 text-base font-mono border-2 border-[#00416B] rounded-lg font-black text-[#00416B] bg-sky-50/50 text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleanVal = Math.max(1, Number(formData.numeroSequenciaInicial) || 1);
                    const updated = setSequencialManual(cleanVal);
                    setFormData(updated);
                    onSettingsUpdated(updated);
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 3000);
                  }}
                  className="px-4 py-2 bg-[#00416B] hover:bg-[#003152] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Definir {formData.numeroSequenciaInicial} como Próximo Termo
                </button>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-[#00416B]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                Como funciona a sequência no sistema:
              </span>
              <p className="text-slate-700">
                O valor definido acima será o <strong>Número do Termo</strong> do próximo cadastro ({formData.numeroSequenciaInicial}).
                Ao salvar cada novo cadastro, o sistema avança automaticamente para o próximo ({formData.numeroSequenciaInicial + 1}, {formData.numeroSequenciaInicial + 2}...).
              </p>
            </div>
          </div>
        </div>

        {/* Bloco 3: Opções Visuais dos Relatórios */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Palette className="w-5 h-5 text-[#00416B]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              4. Estilo Visual dos Documentos PDF
            </h2>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cor do Texto Digitado nos PDFs
            </label>
            <select
              value={formData.corTextoDigitado}
              onChange={(e) => setFormData({ ...formData, corTextoDigitado: e.target.value as any })}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold"
            >
              <option value="preto">Preto padrão (Documento oficial dos Correios - Recomendado)</option>
              <option value="vermelho">Vermelho (Apenas para destaque visual de campos variáveis)</option>
            </select>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Define a cor de impressão dos dados preenchidos nos documentos gerados.
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00416B] hover:bg-[#003152] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm"
          >
            <Save className="w-4 h-4 text-yellow-300" />
            <span>Salvar Configurações</span>
          </button>
        </div>

      </form>

      {/* Backup e Restauração */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
          <Database className="w-5 h-5 text-[#00416B]" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            4. Backup & Dados Originais dos Relatórios
          </h2>
        </div>

        {importMessage && (
          <div className={`p-3 rounded-lg text-xs font-medium ${
            importMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {importMessage.text}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
          >
            <Download className="w-4 h-4 text-yellow-300" />
            <span>Exportar Backup (JSON)</span>
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer">
            <Upload className="w-4 h-4 text-[#00416B]" />
            <span>Importar Backup (JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleResetSampleData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-900 text-xs font-bold rounded-lg border border-red-300 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-red-700" />
            <span>Restaurar Relatórios Originais do Modelo</span>
          </button>
        </div>
      </div>

      {/* 5. Rede Local e Uso Multi-Computador */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-[#00416B]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              5. Rede Local & Acesso Multi-Computador (Servidor Central)
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            Banco Local Ativo
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Este sistema opera com <strong>Node.js portátil e banco de dados local centralizado</strong>. Todos os computadores da sua unidade podem salvar, consultar e emitir termos simultaneamente na mesma base de dados.
        </p>

        {serverInfo && serverInfo.urlsAcesso && serverInfo.urlsAcesso.length > 0 ? (
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-2">
            <span className="text-xs font-bold text-sky-900 block">
              Endereços para os colegas acessarem de outros computadores da unidade:
            </span>
            <div className="space-y-1.5">
              {serverInfo.urlsAcesso.map((url, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded border border-sky-200 text-xs font-mono">
                  <span className="font-bold text-sky-800">{url}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded text-[11px] font-sans font-semibold cursor-pointer"
                  >
                    {copiedUrl === url ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
            <span className="text-[11px] text-sky-700 block">
              Basta abrir o Chrome ou Edge em qualquer outro PC da mesma rede e colar o endereço acima.
            </span>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            Ao iniciar pelo arquivo <code className="font-bold text-[#00416B]">INICIAR_SISTEMA.bat</code> na máquina da unidade, os endereços IP da rede local aparecerão aqui automaticamente.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-bold text-slate-800 block mb-1">INICIAR_SISTEMA.bat</span>
            <p className="text-slate-600 text-[11px]">
              Dá partida no servidor local, identifica o Node.js embutido e abre o navegador automaticamente.
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-bold text-slate-800 block mb-1">BAIXAR_NODE_PORTATIL.bat</span>
            <p className="text-slate-600 text-[11px]">
              Baixa e descompacta o Node.js oficial na pasta local sem precisar de senha de administrador no Windows.
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-bold text-slate-800 block mb-1">BACKUP_BANCO_DADOS.bat</span>
            <p className="text-slate-600 text-[11px]">
              Copia o arquivo <code className="font-semibold">data/banco_dados.json</code> com data e hora para a pasta de backups em 1 clique.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
