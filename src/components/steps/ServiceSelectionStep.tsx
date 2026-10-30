/**
 * Etapa 1: Seleção de Serviços
 * VagouApp Meu Negócio
 */

import React from 'react';
import { Scissors, Check, Video, Images, Plus, Clock } from 'lucide-react';
import type { CatalogServiceItem } from '../../types/booking';
import { hapticLight, hapticMedium } from '../../utils/haptics';

interface ServiceSelectionStepProps {
  services: CatalogServiceItem[];
  selectedServices: CatalogServiceItem[];
  isAddingExtraServices: boolean;
  groupedServices: Record<string, CatalogServiceItem[]>;
  onToggleService: (srv: CatalogServiceItem) => void;
  onAddExtraServices: () => void;
  onPromptSchedule: (srv: CatalogServiceItem) => void;
}

export const ServiceSelectionStep: React.FC<ServiceSelectionStepProps> = ({
  services,
  selectedServices,
  isAddingExtraServices,
  groupedServices,
  onToggleService,
  onAddExtraServices,
  onPromptSchedule,
}) => {
  if (services.length === 0) {
    return (
      <div className="p-8 rounded-[4px] border text-center my-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
        <Scissors className="w-8 h-8 mx-auto mb-2 text-amber-400" />
        <p className="text-xs font-bold text-slate-900 dark:text-white">
          Não há serviço cadastrado neste estabelecimento
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {isAddingExtraServices && (
        <button
          type="button"
          onClick={onAddExtraServices}
          className="w-full py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white shrink-0" />
          <span className="text-white">Concluir Seleção ({selectedServices.length} itens)</span>
        </button>
      )}

      <div className="space-y-4">
        {(Object.entries(groupedServices) as [string, CatalogServiceItem[]][]).map(([categoryName, catServices]) => (
          <div key={categoryName} className="space-y-1.5">
            <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <h3 className="text-[11px] font-black uppercase tracking-wider font-['Poppins'] text-slate-700 dark:text-slate-300">
                {categoryName}
              </h3>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                ({catServices.length})
              </span>
            </div>

            <div className="space-y-2">
              {catServices.map((srv) => {
                const isSelected = selectedServices.some((s) => s.id === srv.id);
                const isVideoMode = (srv.displayMode === 'video' || srv.mediaType === 'video') && !!srv.videoUrl;
                const isSlideshowMode = srv.displayMode === 'slideshow' && !!(srv.photos && srv.photos.length > 1);
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      if (isAddingExtraServices) {
                        onToggleService(srv);
                      } else {
                        hapticMedium();
                        onPromptSchedule(srv);
                      }
                    }}
                    className={`w-full p-2.5 rounded-[4px] transition-all flex items-center justify-between gap-3 text-left cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500/50 text-slate-900 dark:text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center shrink-0 transition-all border ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-xs font-bold leading-snug truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                            {srv.title}
                          </h4>
                          {isVideoMode && (
                            <span className="shrink-0 px-1 py-0.2 rounded-[4px] bg-emerald-500 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                              <Video className="w-2.5 h-2.5 text-white" />
                              <span className="text-white">5s</span>
                            </span>
                          )}
                          {isSlideshowMode && (
                            <span className="shrink-0 px-1 py-0.2 rounded-[4px] bg-emerald-500 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                              <Images className="w-2.5 h-2.5 text-white" />
                              <span className="text-white">Slide</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className={`inline-flex items-center gap-1 font-medium ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            <Clock className="w-3 h-3 text-emerald-500" />
                            <span>{srv.duration}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className={`text-sm font-extrabold ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                        R$ {srv.price.toFixed(0)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};