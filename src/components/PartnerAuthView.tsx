import React, { useEffect } from 'react';
import { SalonClientAuthModal } from './SalonClientAuthModal';

export interface PartnerAuthSuccessData {
  salonName: string;
  slug: string;
  redirectUrl?: string;
  salonUrl?: string;
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
  logoTextFallback?: string;
  primaryColor?: string;
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  onSuccess,
  onBack,
  salonName = '',
  salonSlug = '',
  salonLogo = '',
  logoTextFallback = '',
  primaryColor,
}) => {

  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const isRedirectEvent =
        data.type === 'VAGOU_REDIRECT' ||
        data.action === 'SALON_MASTER_SUCCESS' ||
        (data.type === 'VAGOU_REGISTRATION_SUCCESS' &&
          (data.slug || data.redirectUrl || data.salonUrl || data.accountType === 'owner'));

      if (!isRedirectEvent) return;

      const rawSlug = String(data.slug || data.salon?.slug || data.payload?.slug || '').trim();
      const rawName = String(
        data.salon?.trade_name || data.salon?.name || data.payload?.tradeName || data.payload?.salonName || ''
      ).trim();
      const rawSalonId = String(data.salon?.id || data.payload?.id || '').trim();

      try {
        if (rawSlug) localStorage.setItem('vagou_salon_slug', rawSlug);
        if (rawName) localStorage.setItem('vagou_salon_name', rawName);
        if (rawSalonId) localStorage.setItem('vagou_salon_db_id', rawSalonId);
      } catch {}

      const targetUrl =
        data.redirectUrl ||
        data.salonUrl ||
        data.url ||
        (rawSlug ? `https://${rawSlug}.vagouapp.com` : '');

      if (targetUrl) {
        window.location.assign(targetUrl);
        return;
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center font-['Poppins'] bg-slate-950">
      <SalonClientAuthModal
        isOpen={true}
        requireAuth={!onBack}
        onClose={() => {
          if (onBack) onBack();
        }}
        salonName={salonName}
        salonSlug={salonSlug}
        salonLogo={salonLogo}
        logoTextFallback={logoTextFallback}
        primaryColor={primaryColor}
        themeMode="dark"
        onAuthenticated={(_user, role) => {
          onSuccess(undefined, role);
        }}
      />
    </div>
  );
};

export default PartnerAuthView;
