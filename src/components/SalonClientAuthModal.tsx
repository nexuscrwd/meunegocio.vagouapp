import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

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
  salonSlug?: string;
  salonLogo?: string;
  salonLogoLight?: string;
  salonLogoDark?: string;
  primaryColor?: string;
  secondaryColor?: string;
  themeMode?: 'light' | 'dark';
  onAuthenticated: (user: SalonClientAuthUser, role?: 'pro' | 'cliente') => void;
}

export const SalonClientAuthModal: React.FC<SalonClientAuthModalProps> = ({
  isOpen,
  onClose,
  salonName,
  salonSlug,
  salonLogo,
  salonLogoLight,
  salonLogoDark,
  primaryColor,
  secondaryColor,
  themeMode,
  onAuthenticated,
}) => {
  const { theme } = useTheme();
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const resolvedTheme: 'light' | 'dark' = themeMode || theme || 'dark';
  const isDark = resolvedTheme === 'dark';

  const resolvedPrimaryColor =
    primaryColor ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_accent_color') : null) ||
    '#20C933';

  const resolvedSecondaryColor = secondaryColor || '';

  const resolvedLogo = (
    salonLogo ||
    (isDark
      ? salonLogoDark || (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_logo_dark') : '')
      : salonLogoLight || (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_logo_light') : '')) ||
    ''
  ).trim();

  const hasSalonLogo = Boolean(resolvedLogo.length > 0);

  const currentSlug =
    salonSlug ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '');

  const sendWhiteLabelConfig = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'VAGOU_WHITE_LABEL_THEME',
          source: 'MNVAPP_HOST',
          payload: {
            whiteLabel: true,
            salonName,
            slug: currentSlug,
            theme: resolvedTheme,
            isDark,
            primaryColor: resolvedPrimaryColor,
            secondaryColor: resolvedSecondaryColor,
            logoUrl: hasSalonLogo ? resolvedLogo : '',
            logoLightUrl: salonLogoLight || '',
            logoDarkUrl: salonLogoDark || '',
            hideLogo: !hasSalonLogo,
            hideHeader: !hasSalonLogo,
          },
        },
        '*'
      );
    } catch {}
  }, [
    salonName,
    currentSlug,
    resolvedTheme,
    isDark,
    resolvedPrimaryColor,
    resolvedSecondaryColor,
    hasSalonLogo,
    resolvedLogo,
    salonLogoLight,
    salonLogoDark,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    sendWhiteLabelConfig();
  }, [isOpen, sendWhiteLabelConfig]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      // Handshake quando o iframe do admvapp solicita ou confirma prontidão para receber tema/logo Base64
      if (
        data.type === 'VAGOU_EMBED_READY' ||
        data.event === 'VAGOU_EMBED_READY' ||
        data.action === 'VAGOU_EMBED_READY'
      ) {
        sendWhiteLabelConfig();
        return;
      }

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
        const resolvedCpf = (
          data.cpf ||
          data.ownerCpf ||
          userObj.cpf ||
          userObj.user_metadata?.cpf ||
          payload.cpf ||
          payload.ownerCpf ||
          ''
        ).replace(/\D/g, '');
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
          if (resolvedCpf) localStorage.setItem('vagou_user_cpf', resolvedCpf);
          if (authenticatedUser.phone) localStorage.setItem('vagou_user_phone', authenticatedUser.phone);
        } catch {}

        // Notificar useSalonRole, useOwnerAccess e App imediatamente para reavaliar vínculo de Dono/Membro do salão
        window.dispatchEvent(
          new CustomEvent('vagou:auth-updated', {
            detail: {
              userId: resolvedId,
              email: resolvedEmail,
              cpf: resolvedCpf,
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
  }, [isOpen, onAuthenticated, onClose, sendWhiteLabelConfig]);

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

  const currentUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  const isHttpLogo = hasSalonLogo && !resolvedLogo.startsWith('data:') && resolvedLogo.length < 1800;

  const queryParams = new URLSearchParams({
    embed: 'true',
    whiteLabel: 'true',
    mode: 'login',
    type: 'client',
    slug: currentSlug,
    salonName: salonName || '',
    theme: resolvedTheme,
    primaryColor: resolvedPrimaryColor,
    hideLogo: String(!hasSalonLogo),
    hideHeader: String(!hasSalonLogo),
  });

  if (resolvedSecondaryColor) {
    queryParams.set('secondaryColor', resolvedSecondaryColor);
  }

  if (isHttpLogo) {
    queryParams.set('logoUrl', resolvedLogo);
  } else if (hasSalonLogo) {
    queryParams.set('hasPostMessageLogo', 'true');
  }

  const iframeSrc = `https://adm.vagouapp.com/cadastro?${queryParams.toString()}&redirect=${currentUrl}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Moldura Plana Sem Caixa Dupla (Zero Box-in-Box) */}
      <div 
        className="relative w-full max-w-[440px] h-[92dvh] max-h-[580px] bg-transparent rounded-[4px] overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading de Conexão com Identidade Visual e Tema do Salão */}
        {isLoadingIframe && (
          <div
            className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 rounded-[4px] ${
              isDark ? 'bg-[#151A1E]/95 text-slate-400' : 'bg-white/95 text-slate-600'
            }`}
          >
            {hasSalonLogo && (
              <img
                src={resolvedLogo}
                alt={salonName}
                className="max-h-10 w-auto object-contain mb-1 opacity-90"
              />
            )}
            <Loader2
              className="w-6 h-6 animate-spin"
              style={{ color: resolvedPrimaryColor }}
            />
            <span className="text-xs font-medium">Carregando acesso...</span>
          </div>
        )}

        {/* Frame Oficial Soberano do Admin Master em Modo White-Label */}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          onLoad={() => {
            setIsLoadingIframe(false);
            sendWhiteLabelConfig();
          }}
          className="w-full h-full border-0 bg-transparent"
          title={`Acesso - ${salonName}`}
          allow="clipboard-write"
        />
      </div>
    </div>
  );
};
