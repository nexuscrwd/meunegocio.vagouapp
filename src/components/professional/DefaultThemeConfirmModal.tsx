import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, Check, X } from 'lucide-react';
import { hapticLight, hapticMedium } from '../../utils/haptics';

interface DefaultThemeConfirmModalProps {
  isOpen: boolean;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (keepLogos: boolean) => Promise<void> | void;
}

export const DefaultThemeConfirmModal: React.FC<DefaultThemeConfirmModalProps> = ({
  isOpen,
  isDark,
  onClose,
  onConfirm,
}) => {
  const [keepLogos, setKeepLogos] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeepLogos(true);
      setIsApplying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    hapticMedium();
    setIsApplying(true);
    try {
      await onConfirm(keepLogos);
    } finally {
      setIsApplying(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="default-reset-title"
        className={`w-full max-w-sm rounded-[4px] border shadow-2xl overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 id="default-reset-title" className="text-xs sm:text-sm font-extrabold font-display truncate">
              Restaurar estilo Default?
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className={`p-1 rounded-[4px] transition cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            O visual do aplicativo inteiro (cores, cabeçalho, barras e botões) será alterado para o padrão neutro claro (cinza, branco e escuro suave).
          </p>

          <label
            onClick={() => hapticLight()}
            className={`flex items-start gap-2.5 p-3 rounded-[4px] border cursor-pointer transition select-none ${
              isDark
                ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={keepLogos}
              onChange={(e) => setKeepLogos(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition ${
                keepLogos
                  ? 'bg-[#334155] border-[#334155] text-white'
                  : isDark
                    ? 'bg-slate-900 border-slate-600'
                    : 'bg-white border-slate-400'
              }`}
            >
              {keepLogos && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </span>
            <span className="min-w-0">
              <span className="text-xs font-bold block">
                Manter apenas o logotipo atual
              </span>
              <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Desmarque para limpar também logotipos e ícone salvos.
              </span>
            </span>
          </label>
        </div>

        <div className={`px-4 py-3 border-t flex items-center justify-end gap-2 ${
          isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            disabled={isApplying}
            className={`px-3.5 py-2 rounded-[4px] border text-xs font-bold transition cursor-pointer ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isApplying}
            className="px-4 py-2 rounded-[4px] bg-[#334155] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-white ${isApplying ? 'animate-spin' : ''}`} />
            <span className="text-white">{isApplying ? 'Restaurando...' : 'Restaurar Default'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
