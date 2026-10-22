import React, { useEffect, useState } from 'react';
import { Package, ShieldCheck, Clock, MapPin, PlusCircle, Network } from 'lucide-react';
import { UnitSettings } from '../types';
import { ServerStatusInfo } from '../services/storage';
import { CORREIOS_LOGO_SRC } from '../assets/correiosLogo';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  settings: UnitSettings;
  monthlyCount: number;
  serverInfo?: ServerStatusInfo | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  settings,
  monthlyCount,
  serverInfo,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'cadastro', label: 'Novo Cadastro' },
    { id: 'controle_mensal', label: 'Controle Mensal' },
    { id: 'termos', label: 'Termos de Constatação' },
    { id: 'configuracoes', label: 'Configurações' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#00416B] text-white shadow-md border-b-4 border-[#FFCC00]">
      {/* Top institution bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('controle_mensal')}>
            <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-white p-1 shadow-md border border-amber-300/80 shrink-0">
              <img src={CORREIOS_LOGO_SRC} alt="Correios" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white uppercase">CORREIOS</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-sky-100">
                <span className="font-semibold text-yellow-300">{settings.nomeUnidade}</span>
                <span>·</span>
                <span className="flex items-center gap-1 text-sky-200">
                  <MapPin className="w-3 h-3 text-yellow-300" />
                  STO: {settings.codigoSto} ({settings.dr || settings.uf})
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Status & Quick Clock */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-900/60 border border-sky-700/50 text-sky-100">
              <Clock className="w-3.5 h-3.5 text-yellow-300" />
              <span className="font-mono">{currentTime || 'Carregando...'}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-900/60 border border-sky-700/50">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Gerente: <strong className="text-white font-medium">{settings.chefeNome}</strong></span>
            </div>

            {serverInfo && (
              <button
                onClick={() => onTabChange('configuracoes')}
                title="Servidor local ativo para múltiplos computadores. Clique para ver IPs de acesso."
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 text-xs hover:bg-emerald-900/80 transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <Network className="w-3.5 h-3.5 text-emerald-300" />
                <span className="font-semibold">Banco Local Conectado</span>
              </button>
            )}

            {/* Quick Action button */}
            <button
              onClick={() => onTabChange('cadastro')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FFCC00] text-[#003152] hover:bg-yellow-300 font-bold shadow-sm transition-transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Cadastrar Objeto</span>
            </button>
          </div>

        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-[#003357] border-t border-sky-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`relative px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#00416B] shadow-sm'
                      : 'text-sky-100 hover:text-white hover:bg-sky-900/60'
                  }`}
                >
                  {item.label}
                  {item.id === 'termos' && monthlyCount > 0 && (
                    <span className={`ml-2 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-[#00416B] text-white' : 'bg-[#FFCC00] text-[#003152]'
                    }`}>
                      {monthlyCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
