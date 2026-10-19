import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Suporte universal a todos os formatos de evento de Login/Cadastro emitidos pelo admvapp
      const isAuthSuccess =
        data.type === 'VAGOU_REGISTRATION_SUCCESS' ||
        data.type === 'VAGOU_LOGIN_SUCCESS' ||
        data.type === 'VAGOU_AUTH_SUCCESS' ||
        ((data.source === 'VAGOUAPP_EMBED' || data.source === 'VAGOUAPP_FORM') &&
          (data.event === 'USER_LOGIN_SUCCESS' ||
            data.event === 'USER_REGISTER_SUCCESS' ||
            data.event === 'SALON_MASTER_SUCCESS' ||
            data.action === 'USER_LOGIN_SUCCESS' ||
            data.action === 'USER_REGISTER_SUCCESS' ||
            data.action === 'SALON_MASTER_SUCCESS'));

      if (isAuthSuccess) {
        const payload = data.payload || {};
        const userObj = data.user || payload.user || {};

        const resolvedId = userObj.id || data.userId || payload.userId || '';
        const resolvedEmail = (
          data.email ||
          userObj.email ||
          payload.email ||
          ''
        ).trim().toLowerCase();
        const resolvedName =
          data.name ||
          userObj.name ||
          userObj.user_metadata?.full_name ||
          payload.name ||
          payload.fullName ||
          (resolvedEmail ? resolvedEmail.split('@')[0] : 'Usuário');
        const resolvedPhone =
          data.phone ||
          userObj.phone ||
          userObj.user_metadata?.phone ||
          payload.phone ||
          '';
        const accountType =
          data.accountType ||
          data.role ||
          payload.accountType ||
          payload.role ||
          userObj.user_metadata?.role ||
          '';

        // Hidratação de sessão JWT cross-subdomain se o admvapp enviar access_token e refresh_token
        const sessionObj = data.session || payload.session || (data.access_token ? {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        } : null);

        if (isSupabaseConfigured && supabase && sessionObj?.access_token && sessionObj?.refresh_token) {
          try {
            await supabase.auth.setSession({
              access_token: sessionObj.access_token,
              refresh_token: sessionObj.refresh_token,
            });
          } catch (err) {
            console.warn('Aviso ao hidratar sessão Supabase do iframe:', err);
          }
        }

        const authenticatedUser: SalonClientAuthUser = {
          id: resolvedId || undefined,
          name: resolvedName,
          phone: resolvedPhone,
          email: resolvedEmail,
        };

        try {
          if (resolvedId) localStorage.setItem('vagou_auth_user_id', resolvedId);
          if (authenticatedUser.name) localStorage.setItem('vagou_user_name', authenticatedUser.name);
          if (authenticatedUser.email) {
            localStorage.setItem('vagou_user_email', authenticatedUser.email);
            localStorage.setItem('vagou_active_partner', authenticatedUser.email);
          }
          if (authenticatedUser.phone) localStorage.setItem('vagou_user_phone', authenticatedUser.phone);
        } catch {}

        // Notificar useSalonRole e App imediatamente para reavaliar vínculo de Dono/Membro do salão
        window.dispatchEvent(
          new CustomEvent('vagou:auth-updated', {
            detail: {
              userId: resolvedId,
              email: resolvedEmail,
              name: resolvedName,
              accountType,
            },
          })
        );

        const mappedRole: 'pro' | 'cliente' =
          accountType === 'professional' || accountType === 'pro' || accountType === 'owner' || accountType === 'admin'
            ? 'pro'
            : 'cliente';

        onAuthenticated(authenticatedUser, mappedRole);
        onClose();
        return;
      }

      // Evento de Fechamento disparado pelo "X" interno do Admin Master
      if (
        data.type === 'VAGOU_MODAL_CLOSE' ||
        data.type === 'VAGOU_CLOSE_MODAL' ||
        data.type === 'CLOSE_MODAL' ||
        data.event === 'CLOSE_MODAL' ||
        data.action === 'CLOSE_MODAL'
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
  const iframeSrc = `https://adm.vagouapp.com/cadastro?embed=true&mode=login&type=client&slug=${encodeURIComponent(currentSlug)}&redirect=${currentUrl}`;

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
