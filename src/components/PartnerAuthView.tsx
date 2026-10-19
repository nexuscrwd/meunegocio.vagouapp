import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { hapticLight } from '../utils/haptics';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  onSuccess,
  onBack,
}) => {
  const [isLoadingIframe, setIsLoadingIframe] = useState(true);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

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
          if (userPhone) localStorage.setItem('vagou_user_phone', userPhone);
        } catch {}

        window.dispatchEvent(
          new CustomEvent('vagou:auth-updated', {
            detail: { userId: resolvedId, email: userEmail, name: proName, accountType },
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
  }, [onSuccess]);

  const currentSlug = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '';
  const currentUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  const iframeSrc = `https://adm.vagouapp.com/cadastro?embed=true&type=professional&slug=${encodeURIComponent(currentSlug)}&redirect=${currentUrl}`;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 font-['Poppins']">
      {/* Topo com botão voltar e selo soberano */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs font-bold text-white">Acesso do Parceiro Vagou</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Admin Master Central</span>
        </div>
      </header>

      {/* Frame Soberano do ADMVAPP */}
      <main className="relative flex-1 w-full bg-slate-950 overflow-hidden">
        {isLoadingIframe && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs font-medium">Conectando ao Painel Central...</span>
          </div>
        )}

        <iframe
          src={iframeSrc}
          onLoad={() => setIsLoadingIframe(false)}
          className="w-full h-full border-0 bg-slate-950"
          title="Acesso Parceiro Vagou"
          allow="clipboard-write"
        />
      </main>
    </div>
  );
};

export default PartnerAuthView;
