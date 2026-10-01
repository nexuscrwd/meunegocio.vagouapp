import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface SalonClientAuthUser {
  id?: string;
  name: string;
  phone: string;
  email: string;
}

interface SalonClientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName: string;
  salonLogo?: string;
  primaryColor?: string;
  onAuthenticated: (user: SalonClientAuthUser, role?: 'pro' | 'cliente') => void;
}

export const SalonClientAuthModal: React.FC<SalonClientAuthModalProps> = ({
  isOpen,
  onClose,
  salonName,
  onAuthenticated,
}) => {
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      // Evento de Sucesso no Login / Cadastro
      if (event.data?.type === 'VAGOU_REGISTRATION_SUCCESS') {
        const { accountType, email, name, user } = event.data;

        const authenticatedUser: SalonClientAuthUser = {
          id: user?.id,
          name: name || user?.name || user?.user_metadata?.full_name || 'Usuário',
          phone: user?.phone || user?.user_metadata?.phone || '',
          email: email || user?.email || '',
        };

        try {
          if (authenticatedUser.name) localStorage.setItem('vagou_user_name', authenticatedUser.name);
          if (authenticatedUser.email) {
            localStorage.setItem('vagou_user_email', authenticatedUser.email);
            localStorage.setItem('vagou_active_partner', authenticatedUser.email);
          }
          if (authenticatedUser.phone) localStorage.setItem('vagou_user_phone', authenticatedUser.phone);
        } catch {}

        const mappedRole: 'pro' | 'cliente' =
          accountType === 'professional' || accountType === 'pro' || accountType === 'owner' ? 'pro' : 'cliente';

        onAuthenticated(authenticatedUser, mappedRole);
        onClose();
        return;
      }

      // Evento de Fechamento disparado pelo "X" interno do Admin Master
      if (
        event.data?.type === 'VAGOU_MODAL_CLOSE' || 
        event.data?.type === 'VAGOU_CLOSE_MODAL' ||
        event.data?.type === 'CLOSE_MODAL'
      ) {
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, onAuthenticated, onClose]);

  // Tecla ESC para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSlug = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '';
  const currentUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  const iframeSrc = `https://admin.vagouapp.com/cadastro?embed=true&type=client&slug=${encodeURIComponent(currentSlug)}&redirect=${currentUrl}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Moldura Plana Sem Caixa Dupla (Zero Box-in-Box) */}
      <div 
        className="relative w-full max-w-[440px] h-[92dvh] max-h-[580px] bg-transparent rounded-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading de Conexão */}
        {isLoadingIframe && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/90 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs font-medium">Carregando acesso seguro...</span>
          </div>
        )}

        {/* Frame Oficial Soberano do Admin Master */}
        <iframe
          src={iframeSrc}
          onLoad={() => setIsLoadingIframe(false)}
          className="w-full h-full border-0 bg-transparent"
          title={`Acesso Vagou - ${salonName}`}
          allow="clipboard-write"
        />
      </div>
    </div>
  );
};
