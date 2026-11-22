import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  resolveEstablishmentBrandDisplay,
  TEMPLATE_APP_HOST,
  TEMPLATE_APP_NAME,
} from '../../utils/templateBranding';

export interface SalonAuthHeaderProps {
  salonName?: string;
  salonSlug?: string;
  salonSlogan?: string;
  salonLogoUrl?: string;
  logoTextFallback?: string;
  subtitle?: string;
  brandMode?: 'establishment' | 'vagou';
  onClose?: () => void;
}

const VAGOU_REGISTER_LOGO_URL = '/assets/aistudio/VagouApp-Preto_cd3c144c.png';

export const SalonAuthHeader: React.FC<SalonAuthHeaderProps> = ({
  salonName,
  salonSlug,
  salonSlogan,
  salonLogoUrl,
  logoTextFallback,
  subtitle,
  brandMode = 'establishment',
  onClose,
}) => {
  const [logoError, setLogoError] = useState(false);

  if (brandMode === 'vagou') {
    return (
      <div className="relative px-6 pt-6 pb-4 flex flex-col items-center justify-center text-center gap-2.5">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <img
          src={VAGOU_REGISTER_LOGO_URL}
          alt="VagouApp"
          className="h-12 sm:h-14 w-auto max-w-[210px] object-contain mx-auto select-none mix-blend-lighten rounded-lg"
        />

        {subtitle && subtitle !== 'ACESSAR' && subtitle !== 'ENTRAR' && (
          <p className="text-[10px] font-bold uppercase tracking-wider brand-text text-center pt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    );
  }

  const resolvedSlug = (
    salonSlug ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '')
  ).trim();

  const resolvedLogo = logoError
    ? ''
    : (
        salonLogoUrl ||
        (typeof window !== 'undefined' && resolvedSlug
          ? localStorage.getItem('vagou_salon_logo_dark') ||
            localStorage.getItem('vagou_salon_logo_light') ||
            localStorage.getItem('vagou_salon_icon') ||
            ''
          : '')
      ).trim();

  const rawSalonName = (
    salonName ||
    (typeof window !== 'undefined' && resolvedSlug
      ? localStorage.getItem('vagou_salon_name') || ''
      : '')
  ).trim();

  const brandDisplay = resolveEstablishmentBrandDisplay({
    logoUrl: resolvedLogo,
    logoTextFallback,
    salonName: rawSalonName,
    isDark: true,
  });

  const resolvedSalonTitle =
    brandDisplay.kind === 'name'
      ? brandDisplay.displayName
      : rawSalonName || TEMPLATE_APP_NAME;

  const resolvedSlogan = (
    salonSlogan ||
    (resolvedSlug ? `${resolvedSlug}.vagouapp.com` : TEMPLATE_APP_HOST)
  ).trim();

  return (
    <div className="relative px-6 pt-6 pb-4 flex flex-col items-center justify-center text-center gap-2.5">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          title="Fechar"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {brandDisplay.kind === 'logo' && (
        <img
          src={brandDisplay.logoUrl}
          alt={resolvedSalonTitle}
          referrerPolicy="no-referrer"
          onError={() => setLogoError(true)}
          className="h-12 sm:h-14 w-auto max-w-[200px] object-contain mx-auto select-none"
        />
      )}

      {brandDisplay.kind === 'template_logo' && (
        <img
          src={brandDisplay.logoUrl}
          alt="LOGOTIPO"
          className="h-10 sm:h-11 w-auto max-w-[210px] object-contain mx-auto select-none"
        />
      )}

      <div className="flex flex-col items-center justify-center max-w-full space-y-0.5">
        <h2
          className={`text-white font-bold tracking-tight text-center break-words leading-snug ${
            brandDisplay.kind === 'name' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
          }`}
        >
          {resolvedSalonTitle}
        </h2>
        <p className="text-xs text-slate-400 font-medium text-center">
          {resolvedSlogan}
        </p>
        {subtitle && subtitle !== 'ACESSAR' && subtitle !== 'ENTRAR' && (
          <p className="text-[10px] font-bold uppercase tracking-wider brand-text text-center pt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
