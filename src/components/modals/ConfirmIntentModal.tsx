/**
 * Modal de Confirmação Inicial ("Deseja realizar o agendamento?")
 * VagouApp Meu Negócio
 */

import React from 'react';
import { X, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import type { CatalogServiceItem } from '../../types/booking';
import { hapticLight, hapticMedium } from '../../utils/haptics';

interface ConfirmIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingService: CatalogServiceItem | null;
  salonName: string;
  salonLogo?: string;
  salonLogoLight?: string;
  salonLogoDark?: string;
  primaryColor?: string;
  onConfirm: () => void;
}

export const ConfirmIntentModal: React.FC<ConfirmIntentModalProps> = ({
  isOpen,
  onClose,
  pendingService,
  salonName,
  salonLogo,
  salonLogoLight,
  salonLogoDark,
  primaryColor = '#20C933',
  onConfirm,
}) => {
  if (!isOpen || !pendingService) return null;

  const resolvedBrandLogo = (
    salonLogo ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? salonLogoDark : salonLogoLight) ||
    salonLogoDark ||
    salonLogoLight ||
    ''
  ).trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={() => onClose()}
    >
      <div
        className={`w-full max-w-md my-auto rounded-[4px] border p-5 shadow-2xl space-y-4 font-['Poppins'] ${
          typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'bg-[#090D16] border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {resolvedBrandLogo ? (
              <img
                src={resolvedBrandLogo}
                alt={salonName}
                className="h-8 w-auto max-w-[96px] object-contain shrink-0 mt-0.5"
              />
            ) : (
              <div
                style={{ backgroundColor: primaryColor }}
                className="w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0 text-white mt-0.5"
              >
                <Calendar className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold leading-snug">
                Deseja realizar o agendamento?
              </h3>
              <p className="text-[11px] leading-snug mt-0.5 break-words text-slate-500 dark:text-slate-400">
                {salonName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`p-3 rounded-[4px] flex items-center justify-between gap-3 ${
            typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'bg-slate-900 text-slate-100'
              : 'bg-slate-100 text-slate-900'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-snug break-words">{pendingService.title}</p>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-1">
              <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>{pendingService.duration}</span>
            </span>
          </div>
          <span className="text-sm font-black text-emerald-500 shrink-0">
            R$ {pendingService.price.toFixed(0)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => { hapticLight(); onClose(); }}
            className={`py-3 px-3 rounded-[4px] font-bold text-xs transition cursor-pointer text-center ${
              typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            Agora não
          </button>

          <button
            type="button"
            onClick={() => { hapticMedium(); onConfirm(); }}
            style={{ backgroundColor: primaryColor }}
            className="py-3 px-3 rounded-[4px] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition hover:brightness-110 cursor-pointer text-center"
          >
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span className="text-white">Sim, agendar</span>
          </button>
        </div>
      </div>
    </div>
  );
};