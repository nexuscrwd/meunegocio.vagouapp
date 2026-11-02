import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface SalonAuthHeaderProps {
  salonName?: string;
  salonLogoUrl?: string;
  subtitle: string;
  onClose?: () => void;
}

/**
 * 🏛️ Cabeçalho Obrigatório com Logotipo/Logomarca do Salão para todos os Modais de Autenticação
 * - Altura dobrada (min-h-[116px])
 * - Logotipo centralizado no topo e nome do estabelecimento logo abaixo
 * - Se não houver logotipo, exibe apenas o nome do estabelecimento centralizado (sem ícone genérico)
 */
export const SalonAuthHeader: React.FC<SalonAuthHeaderProps> = ({
  salonName,
  salonLogoUrl,
  subtitle,
  onClose,
}) => {
  const { isDark } = useTheme();
  const [logoError, setLogoError] = useState(false);

  const resolvedLogo =
    salonLogoUrl ||
    (typeof window !== 'undefined'
      ? (isDark
          ? localStorage.getItem('vagou_salon_logo_dark') ||
            localStorage.getItem('vagou_salon_logo_light')
          : localStorage.getItem('vagou_salon_logo_light') ||
            localStorage.getItem('vagou_salon_logo_dark')) ||
        localStorage.getItem('vagou_salon_icon') ||
        ''
      : '');

  const resolvedSalonName =
    salonName ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_name') || '' : '') ||
    'Meu Estabelecimento';

  const hasValidLogo = Boolean(resolvedLogo && !logoError);

  return (
    <div
      className={`relative min-h-[116px] px-8 py-5 border-b flex flex-col items-center justify-center text-center gap-2 ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-3 right-3 p-1.5 rounded-[4px] transition cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
          }`}
          title="Fechar modal"
          aria-label="Fechar modal"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {hasValidLogo && (
        <img
          src={resolvedLogo}
          alt={resolvedSalonName}
          onError={() => setLogoError(true)}
          className="h-12 max-w-[180px] w-auto object-contain rounded-[4px] mx-auto"
        />
      )}

      <div className="flex flex-col items-center justify-center max-w-full">
        <h2
          className={`text-sm sm:text-base font-extrabold tracking-tight text-center break-words ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {resolvedSalonName}
        </h2>
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent text-center mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );
};

