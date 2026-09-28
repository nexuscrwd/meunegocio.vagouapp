import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface UnifiedRegisterEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'client' | 'professional';
  slug?: string;
  onSuccess?: (userData: any) => void;
}

export const UnifiedRegisterEmbedModal: React.FC<UnifiedRegisterEmbedModalProps> = ({
  isOpen,
  onClose,
  type = 'client',
  slug = '',
  onSuccess,
}) => {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VAGOU_REGISTRATION_SUCCESS') {
        // Notifica callback local se existir
        if (onSuccess) {
          onSuccess(event.data);
        }

        // Fecha o modal
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose, onSuccess]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  const iframeSrc = `https://admin.vagouapp.com/cadastro?embed=true&type=${type}&slug=${encodeURIComponent(slug)}&redirect=${currentUrl}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[90vh] max-h-[720px] animate-in fade-in zoom-in-95 duration-200">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <span className="text-xs font-semibold text-slate-300">Cadastro Unificado Vagou</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Frame Soberano do ADMVAPP */}
        <iframe
          src={iframeSrc}
          className="w-full flex-1 border-0 bg-slate-950"
          title="Cadastro Vagou"
        />
      </div>
    </div>
  );
};
