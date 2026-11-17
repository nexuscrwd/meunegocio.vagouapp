import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { hapticLight, hapticSuccess } from '../utils/haptics';

interface PWAInstallButtonProps {
  appName?: string;
  isDark?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  appName,
  isDark = false,
}) => {
  const { isInstalled, isInstallable, isIOS, triggerInstall } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const resolvedTitle = (appName || '').trim() || 'Vagou';

  const handleClick = async () => {
    hapticLight();
    if (isInstallable) {
      const outcome = await triggerInstall();
      if (outcome === 'accepted') {
        hapticSuccess();
      }
      return;
    }
    if (isIOS) {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full min-h-[44px] py-2.5 px-3.5 rounded-[4px] brand-btn font-bold text-xs flex items-center justify-between gap-2 transition active:scale-[0.99] cursor-pointer shadow-xs mt-2"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Download className="w-4 h-4 text-white shrink-0" />
          <span className="text-white truncate">Instalar App {resolvedTitle}</span>
        </div>
        <Smartphone className="w-4 h-4 text-white/90 shrink-0" />
      </button>

      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className={`w-full max-w-sm rounded-[4px] border p-4 space-y-4 shadow-2xl ${
              isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/30">
              <div className="flex items-center gap-2 min-w-0">
                <Smartphone className="w-4 h-4 brand-icon shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider truncate">
                  Instalar {resolvedTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <Share className="w-4 h-4 brand-icon shrink-0" />
                <p>
                  Toque em <strong>Compartilhar</strong> na barra do Safari.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <PlusSquare className="w-4 h-4 brand-icon shrink-0" />
                <p>
                  Selecione <strong>Adicionar à Tela de Início</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-[4px] brand-btn text-white font-bold text-xs cursor-pointer"
            >
              <span className="text-white">Entendi</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
