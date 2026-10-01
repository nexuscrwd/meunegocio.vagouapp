import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { hapticLight } from '../utils/haptics';

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
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VAGOU_REGISTRATION_SUCCESS') {
        const { accountType, email, name, user } = event.data;

        const proName = name || user?.name || user?.user_metadata?.full_name || 'Profissional';
        const userEmail = email || user?.email || '';
        const userPhone = user?.phone || user?.user_metadata?.phone || '';

        try {
          if (proName) localStorage.setItem('vagou_user_name', proName);
          if (userEmail) {
            localStorage.setItem('vagou_user_email', userEmail);
            localStorage.setItem('vagou_active_partner', userEmail);
          }
          if (userPhone) localStorage.setItem('vagou_user_phone', userPhone);
        } catch {}

        const role: 'pro' | 'cliente' =
          accountType === 'professional' || accountType === 'pro' || accountType === 'owner' ? 'pro' : 'cliente';

        onSuccess(undefined, role);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess]);

  const currentSlug = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '';
  const currentUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
  const iframeSrc = `https://admin.vagouapp.com/cadastro?embed=true&type=professional&slug=${encodeURIComponent(currentSlug)}&redirect=${currentUrl}`;

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
