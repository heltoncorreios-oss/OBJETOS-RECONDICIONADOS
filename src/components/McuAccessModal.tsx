import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  PlusCircle, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  MapPin, 
  AlertCircle,
  Hash,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { UnitSettings } from '../types';
import { 
  findUnitByMcu, 
  getAllRegisteredUnitsList, 
  saveSettings, 
  setActiveUnitName, 
  setActiveMcu,
  DEFAULT_SETTINGS 
} from '../services/storage';
import { CORREIOS_LOGO_SRC } from '../assets/correiosLogo';

interface McuAccessModalProps {
  isOpen: boolean;
  currentSettings: UnitSettings;
  onUnitSelected: (settings: UnitSettings) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const McuAccessModal: React.FC<McuAccessModalProps> = ({
  isOpen,
  currentSettings,
  onUnitSelected,
  onClose,
  canClose = false,
}) => {
  const [step, setStep] = useState<'identify' | 'register'>('identify');
  const [mcuInput, setMcuInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [registeredUnits, setRegisteredUnits] = useState<UnitSettings[]>([]);

  // Campos do formulário de novo cadastro
  const [newUnitForm, setNewUnitForm] = useState<UnitSettings>({
    nomeUnidade: '',
    mcu: '',
    dr: 'SPI',
    codigoSto: '',
    cidade: '',
    uf: 'SP',
    chefeNome: '',
    chefeMatricula: '',
    operadorMatriculaPadrao: '',
    operadorPadraoNome: '',
    destinoPadrao: '',
    reiniciarNumeracao: 'anual',
    formatoNumeroTermo: 'simples',
    numeroSequenciaInicial: 1,
    ultimoSequencialAno: {},
    ultimoSequencialMes: {},
    sequencialGeral: 0,
    corTextoDigitado: 'preto',
  });

  useEffect(() => {
    if (isOpen) {
      setStep('identify');
      setMcuInput('');
      setErrorMsg(null);
      loadUnits();
    }
  }, [isOpen]);

  const loadUnits = async () => {
    try {
      const list = await getAllRegisteredUnitsList();
      setRegisteredUnits(list);
    } catch (e) {
      setRegisteredUnits([DEFAULT_SETTINGS]);
    }
  };

  if (!isOpen) return null;

  const handleSearchMcu = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = mcuInput.trim();
    if (!clean) {
      setErrorMsg('Informe o MCU ou Código da Unidade.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const found = await findUnitByMcu(clean);
      if (found) {
        setActiveUnitName(found.nomeUnidade, true, found.mcu);
        onUnitSelected(found);
      } else {
        // MCU não encontrado -> Redirecionar para tela de primeiro cadastro
        setNewUnitForm(prev => ({
          ...prev,
          mcu: clean,
          codigoSto: clean.length === 8 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean,
        }));
        setStep('register');
      }
    } catch (err) {
      setErrorMsg('Erro ao consultar banco de dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuickUnit = (unit: UnitSettings) => {
    setActiveUnitName(unit.nomeUnidade, true, unit.mcu);
    onUnitSelected(unit);
  };

  const handleSaveNewUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitForm.nomeUnidade.trim()) {
      setErrorMsg('Informe o Nome da Unidade.');
      return;
    }
    if (!newUnitForm.mcu?.trim()) {
      setErrorMsg('Informe o MCU da Unidade.');
      return;
    }

    const cleanSeq = Math.max(1, Number(newUnitForm.numeroSequenciaInicial) || 1);
    const dateObj = new Date();
    const anoKey = String(dateObj.getFullYear());
    const mesKey = `${anoKey}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

    const toSave: UnitSettings = {
      ...newUnitForm,
      nomeUnidade: newUnitForm.nomeUnidade.trim().toUpperCase(),
      mcu: (newUnitForm.mcu || '').trim(),
      dr: (newUnitForm.dr || 'SPI').trim().toUpperCase(),
      codigoSto: (newUnitForm.codigoSto || '').trim(),
      cidade: (newUnitForm.cidade || '').trim(),
      uf: (newUnitForm.uf || 'SP').trim().toUpperCase(),
      chefeNome: (newUnitForm.chefeNome || '').trim().toUpperCase(),
      chefeMatricula: (newUnitForm.chefeMatricula || '').trim(),
      numeroSequenciaInicial: cleanSeq,
      ultimoSequencialAno: { [anoKey]: cleanSeq - 1 },
      ultimoSequencialMes: { [mesKey]: cleanSeq - 1 },
      sequencialGeral: cleanSeq - 1,
    };

    saveSettings(toSave);
    setActiveUnitName(toSave.nomeUnidade, true, toSave.mcu);
    onUnitSelected(toSave);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden my-8">
        
        {/* Top Header com Identidade dos Correios */}
        <div className="bg-[#00416B] text-white p-6 border-b-4 border-[#FFCC00]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white p-1.5 shadow-md border border-amber-300 flex items-center justify-center shrink-0">
                <img src={CORREIOS_LOGO_SRC} alt="Correios" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="text-xs font-bold text-yellow-300 uppercase tracking-widest block">
                  Correios · Gestão Postal
                </span>
                <h1 className="text-lg font-black text-white tracking-tight leading-snug">
                  {step === 'identify' ? 'Acesso à Unidade Postal por MCU' : 'Cadastrar Nova Unidade no Sistema'}
                </h1>
              </div>
            </div>

            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-sky-200 hover:text-white p-1.5 rounded-lg hover:bg-sky-800/60 transition-colors cursor-pointer text-xs font-bold"
              >
                ✕ Fechar
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6 space-y-6">

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* PASSO 1: IDENTIFICAÇÃO POR MCU */}
          {step === 'identify' && (
            <div className="space-y-6">
              
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 leading-relaxed">
                <strong>Controle Unificado por MCU:</strong> Cada unidade postal (CDD, AC, CEE) possui seu código MCU exclusivo. Ao informar o MCU, o sistema carrega os termos e sequencial daquela unidade. Se ainda não houver cadastro, você poderá criá-lo em segundos!
              </div>

              <form onSubmit={handleSearchMcu} className="space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Informe o MCU ou Código STO da sua Unidade:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ex: 18650972 ou 08114904"
                      value={mcuInput}
                      onChange={(e) => setMcuInput(e.target.value)}
                      autoFocus
                      className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-300 focus:border-[#00416B] focus:ring-2 focus:ring-sky-100 text-sm font-bold text-slate-900 uppercase"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !mcuInput.trim()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFCC00] hover:bg-yellow-300 disabled:opacity-50 text-[#002D56] font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    {loading ? (
                      <span>Consultando...</span>
                    ) : (
                      <>
                        <span>Acessar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Dica: Para o CDD São Manuel, o MCU padrão cadastrado é <strong>18650972</strong>.
                </span>
              </form>

              {/* Lista de Unidades Já Cadastradas */}
              {registeredUnits.length > 0 && (
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Ou selecione uma unidade já cadastrada:
                  </span>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {registeredUnits.map((u, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectQuickUnit(u)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          currentSettings.nomeUnidade === u.nomeUnidade
                            ? 'bg-sky-50 border-[#00416B] ring-1 ring-[#00416B]'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className={`w-5 h-5 ${currentSettings.nomeUnidade === u.nomeUnidade ? 'text-[#00416B]' : 'text-slate-500'}`} />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{u.nomeUnidade}</span>
                            <span className="text-[11px] text-slate-500">
                              MCU: <strong>{u.mcu || u.codigoSto}</strong> · STO: {u.codigoSto} ({u.dr || 'SPI'})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00416B]">
                          <span>Entrar</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* PASSO 2: FORMULÁRIO DE PRIMEIRO CADASTRO DE UNIDADE */}
          {step === 'register' && (
            <form onSubmit={handleSaveNewUnit} className="space-y-4 animate-in fade-in">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
                O MCU <strong>{newUnitForm.mcu}</strong> ainda não está cadastrado. Preencha os dados abaixo para criar o ambiente próprio desta unidade postal:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome da Unidade Postal (CDD / AC / CEE) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CDD BOTUCATU ou AC BARRA BONITA"
                    value={newUnitForm.nomeUnidade}
                    onChange={(e) => setNewUnitForm(prev => ({ ...prev, nomeUnidade: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    MCU da Unidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnitForm.mcu}
                    onChange={(e) => setNewUnitForm(prev => ({ ...prev, mcu: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Diretoria Regional (DR) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SPI, SPM, etc."
                    value={newUnitForm.dr}
                    onChange={(e) => setNewUnitForm(prev => ({ ...prev, dr: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código STO / CEP da Unidade *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 18600-000"
                    value={newUnitForm.codigoSto}
                    onChange={(e) => setNewUnitForm(prev => ({ ...prev, codigoSto: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cidade / UF *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Cidade"
                      value={newUnitForm.cidade}
                      onChange={(e) => setNewUnitForm(prev => ({ ...prev, cidade: e.target.value }))}
                      className="w-2/3 px-3 py-2 text-xs font-semibold text-slate-900 border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      placeholder="UF"
                      maxLength={2}
                      value={newUnitForm.uf}
                      onChange={(e) => setNewUnitForm(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))}
                      className="w-1/3 px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg uppercase text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Gerente / Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: MARCOS VINICIUS PEREIRA"
                    value={newUnitForm.chefeNome}
                    onChange={(e) => setNewUnitForm(prev => ({ ...prev, chefeNome: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Matrícula do Gerente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 8.123.456-7"
                    value={newUnitForm.chefeMatricula}
                    onChange={(e) => setNewUnitForm(prev => ({ ...prev, chefeMatricula: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Sequencial Inicial dos Termos desta Unidade:
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={newUnitForm.numeroSequenciaInicial}
                      onChange={(e) => setNewUnitForm(prev => ({ ...prev, numeroSequenciaInicial: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="w-32 px-3 py-1.5 text-sm font-bold text-[#00416B] border border-slate-300 rounded-lg bg-white"
                    />
                    <span className="text-[11px] text-slate-500">
                      (Padrão: 1. O próximo termo cadastrado por esta unidade receberá este número).
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep('identify')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"
                >
                  Voltar
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFCC00] hover:bg-yellow-300 text-[#002D56] font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Concluir Cadastro e Abrir Sistema</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer do Modal */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center text-[11px] text-slate-500">
          ECT · Empresa Brasileira de Correios e Telégrafos · Sistema Operacional em Nuvem
        </div>

      </div>
    </div>
  );
};
