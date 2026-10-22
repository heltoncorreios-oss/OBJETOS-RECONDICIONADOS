import React from 'react';
import { AlertTriangle, Trash2, X, Package } from 'lucide-react';
import { ObjetoRecord } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  record: ObjetoRecord | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  record,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !record) return null;

  const dataFormatada = record.dataConstatacao
    ? record.dataConstatacao.split('-').reverse().join('/')
    : '--';

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-rose-950">Excluir Objeto Lançado</h3>
              <p className="text-xs text-rose-700">Confirmação de exclusão do registro</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-rose-500 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 font-medium">
            Tem certeza de que deseja excluir este objeto do sistema?
          </p>

          {/* Record Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-black text-[#00416B] bg-sky-50 px-2.5 py-1 rounded border border-sky-200">
                Termo Nº {record.termoNumero}
              </span>
              <span className="font-mono text-sm font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-300">
                {record.codigoRastreamento}
              </span>
              <span className="text-xs font-semibold text-slate-600 ml-auto">
                {dataFormatada}
              </span>
            </div>

            <div className="text-xs text-slate-700 pt-1 space-y-1">
              <div>
                <span className="font-bold text-slate-900">Destinatário:</span> {record.destinatarioNome || '--'}
              </div>
              <div>
                <span className="font-bold text-slate-900">Remetente:</span> {record.remetenteNome || '--'}
              </div>
              <div>
                <span className="font-bold text-slate-900">Anomalia:</span> {record.motivoResumo || '--'}
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Atenção:</strong> Ao confirmar, o objeto será removido permanentemente da <strong>Folha de Controle Mensal</strong> e da lista de <strong>Termos de Constatação</strong>. Esta operação não poderá ser desfeita.
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Sim, Excluir Objeto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
