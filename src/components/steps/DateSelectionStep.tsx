/**
 * Etapa 2: Calendário Mensal de Datas
 * VagouApp Meu Negócio
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { hapticMedium } from '../../utils/haptics';

interface DateSelectionStepProps {
  selectedService: { title: string } | null;
  selectedDateIso: string;
  currentViewMonth: Date;
  monthData: {
    monthLabel: string;
    daysGrid: Array<{
      dayNumber: number | null;
      isoString: string | null;
      isToday: boolean;
      isDisabled: boolean;
      isClosed: boolean;
    }>;
    year: number;
    month: number;
  };
  todayIso: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (iso: string) => void;
  skipDateStep: boolean;
  onOpenOriginModal: () => void;
}

export const DateSelectionStep: React.FC<DateSelectionStepProps> = ({
  selectedService,
  selectedDateIso,
  currentViewMonth,
  monthData,
  todayIso,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  skipDateStep,
  onOpenOriginModal,
}) => {
  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      <div className={`space-y-3 transition-all ${!selectedService ? 'pointer-events-none opacity-40 select-none' : ''}`}>
        <div className="flex items-center justify-between px-1 py-1">
          <button
            type="button"
            disabled={!selectedService}
            onClick={onPrevMonth}
            className={`p-2 rounded-[4px] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <h3 className="text-sm font-black uppercase tracking-wider font-['Poppins'] text-slate-900 dark:text-white">
              {monthData.monthLabel}
            </h3>
          </div>

          <button
            type="button"
            disabled={!selectedService}
            onClick={onNextMonth}
            className={`p-2 rounded-[4px] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div key={day} className="text-[10px] font-bold py-1 uppercase text-slate-500 dark:text-slate-400">
              {day}
            </div>
          ))}

          {monthData.daysGrid.map((item, index) => {
            if (item.dayNumber === null) {
              return <div key={`empty-${index}`} className="h-10" />;
            }

            const isSelected = selectedService && selectedDateIso === item.isoString;
            const isDayDisabled = !selectedService || item.isDisabled;

            return (
              <button
                key={item.isoString || index}
                type="button"
                disabled={isDayDisabled}
                onClick={() => {
                  if (item.isoString && selectedService) {
                    hapticMedium();
                    onSelectDate(item.isoString);
                    // O parent abrirá o modal de origem
                  }
                }}
                className={`h-11 rounded-[4px] font-bold text-xs transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-white font-black shadow-md z-10'
                    : isDayDisabled
                    ? 'bg-slate-100/50 dark:bg-slate-900/40 text-slate-300 dark:text-slate-700 cursor-not-allowed border border-slate-200 dark:border-slate-800/50 opacity-40'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20'
                }`}
              >
                <span className={isSelected ? 'text-white' : ''}>{item.dayNumber}</span>
                {item.isToday && !isSelected && (
                  <span className="text-[8px] font-black uppercase text-emerald-500">Hoje</span>
                )}
                {item.isClosed && (
                  <span className="text-[8px] text-rose-500 font-bold">Fechado</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};