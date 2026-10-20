import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { hapticLight } from '../utils/haptics';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export interface PartnerAuthSuccessData {
  salonName: string;
  slug: string;
  phoneWhatsapp?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  category?: string;
  customCategory?: string;
  primaryColor?: string;
  legalManagerName?: string;
  legalManagerCpf?: string;
  legalManagerEmail?: string;
  legalManagerPhone?: string;
}

interface PartnerAuthViewProps {
  onSuccess: (data?: PartnerAuthSuccessData, userRole?: 'pro' | 'cliente') => void;
  onBack?: () => void;
  salonName?: string;
  salonSlug?: string;
  salonLogo?: string;
  primaryColor?: string;
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  onSuccess,
  onBack,
  salonName,
  salonSlug,
  salonLogo,
  primaryColor,
}) => {
  const { theme, isDark } = useTheme();
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const resolvedTheme: 'light' | 'dark' = theme || 'dark';
  const resolvedPrimaryColor =
    primaryColor ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_accent_color') : null) ||
    '#20C933';

  const resolvedLogo = (
    salonLogo ||
    (isDark
      ? (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_logo_dark') : '')
      : (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_logo_light') : '')) ||
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
            salonName: salonName || '',
            slug: currentSlug,
            theme: resolvedTheme,
            isDark,
            primaryColor: resolvedPrimaryColor,
            logoUrl: hasSalonLogo ? resolvedLogo : '',
            hideLogo: !hasSalonLogo,
            hideHeader: !hasSalonLogo,
          },
        },
        '*'
      );
    } catch {}
  }, [salonName, currentSlug, resolvedTheme, isDark, resolvedPrimaryColor, hasSalonLogo, resolvedLogo]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (
        data.type === 'VAGOU_EMBED_READY' ||
        data.event === 'VAGOU_EMBED_READY' ||
        data.action === 'VAGOU_EMBED_READY'
      ) {
        sendWhiteLabelConfig();
        return;
      }

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
        const userEmail = (data.email || userObj.email || payload.email || '').trim().toLowerCase();
        const proName =
          data.name ||
          userObj.name ||
          userObj.user_metadata?.full_name ||
          payload.name ||
          payload.fullName ||
          'Profissional';
        const userPhone = data.phone || userObj.phone || userObj.user_metadata?.phone || payload.phone || '';
        const userCpf = (
          data.cpf ||
          data.ownerCpf ||
          userObj.cpf ||
          userObj.user_metadata?.cpf ||
          payload.cpf ||
          payload.ownerCpf ||
          ''
        ).replace(/\D/g, '');
        const accountType = data.accountType || data.role || payload.accountType || payload.role || '';

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
          } catch {}
        }

        try {
          if (resolvedId) localStorage.setItem('vagou_auth_user_id', resolvedId);
          if (proName) localStorage.setItem('vagou_user_name', proName);
          if (userEmail) {
            localStorage.setItem('vagou_user_email', userEmail);
            localStorage.setItem('vagou_active_partner', userEmail);
          }
          if (userCpf) localStorage.setItem('vagou_user_cpf', userCpf);
          if (userPhone) localStorage.setItem('vagou_user_phone', userPhone);
        } catch {}

        window.dispatchEvent(
          new CustomEvent('vagou:auth-updated', {
            detail: { userId: resolvedId, email: userEmail, cpf: userCpf, name: proName, accountType },
          })
        );

        const role: 'pro' | 'cliente' =
          accountType === 'professional' || accountType === 'pro' || accountType === 'owner' || accountType === 'admin'
            ? 'pro'
            : 'cliente';

        onSuccess(undefined, role);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess, sendWhiteLabelConfig]);

  const currentUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  const isHttpLogo = hasSalonLogo && !resolvedLogo.startsWith('data:') && resolvedLogo.length < 1800;

  const queryParams = new URLSearchParams({
    embed: 'true',
    whiteLabel: 'true',
    type: 'professional',
    slug: currentSlug,
    salonName: salonName || '',
    theme: resolvedTheme,
    primaryColor: resolvedPrimaryColor,
    hideLogo: String(!hasSalonLogo),
    hideHeader: String(!hasSalonLogo),
  });

  if (isHttpLogo) {
    queryParams.set('logoUrl', resolvedLogo);
  } else if (hasSalonLogo) {
    queryParams.set('hasPostMessageLogo', 'true');
  }

  const iframeSrc = `https://adm.vagouapp.com/cadastro?${queryParams.toString()}&redirect=${currentUrl}`;

  return (
    <div className={`w-full h-full flex flex-col font-['Poppins'] ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Topo com botão voltar */}
      {onBack && (
        <header
          className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className={`p-1.5 rounded-[4px] transition cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {salonName && (
              <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {salonName}
              </span>
            )}
          </div>
        </header>
      )}

      {/* Frame Soberano do ADMVAPP em Modo White-Label */}
      <main className={`relative flex-1 w-full overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {isLoadingIframe && (
          <div
            className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 ${
              isDark ? 'bg-slate-950 text-slate-400' : 'bg-white text-slate-600'
            }`}
          >
            <Loader2
              className="w-6 h-6 animate-spin"
              style={{ color: resolvedPrimaryColor }}
            />
            <span className="text-xs font-medium">Carregando acesso...</span>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={iframeSrc}
          onLoad={() => {
            setIsLoadingIframe(false);
            sendWhiteLabelConfig();
          }}
          className={`w-full h-full border-0 ${isDark ? 'bg-slate-950' : 'bg-white'}`}
          title={salonName ? `Acesso - ${salonName}` : 'Acesso'}
          allow="clipboard-write"
        />
      </main>
    </div>
  );
};

export default PartnerAuthView;
