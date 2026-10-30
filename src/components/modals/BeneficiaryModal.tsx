/**
 * Modal de Beneficiário (Para Você vs Dependente)
 * VagouApp Meu Negócio
 */

import React, { useState } from 'react';
import { User, Users, Plus, Check, X, ChevronLeft } from 'lucide-react';
import type { UserFamilyDependent, CatalogServiceItem } from '../../types/booking';
import { hapticLight, hapticMedium, hapticSuccess } from '../../utils/haptics';

interface BeneficiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedService: CatalogServiceItem | null;
  isDependentBooking: boolean;
  dependentId: string;
  dependentName: string;
  hasChosenBeneficiary: boolean;
  registeredDependents: UserFamilyDependent[];
  skipDateStep: boolean;
  onSetDependentBooking: (isDependent: boolean) => void;
  onSelectDependent: (dep: UserFamilyDependent) => void;
  onStartCreateDependent: () => void;
  onCancelCreateDependent: () => void;
  onSaveInlineDependent: (e: React.FormEvent) => Promise<void>;
  isSavingInlineDependent: boolean;
  newDepFullName: string;
  setNewDepFullName: (v: string) => void;
  newDepRelationship: 'son' | 'daughter' | 'spouse' | 'parent' | 'other';
  setNewDepRelationship: (v: 'son' | 'daughter' | 'spouse' | 'parent' | 'other') => void;
  newDepBirthDate: string;
  setNewDepBirthDate: (v: string) => void;
  newDepNotes: string;
  setNewDepNotes: (v: string) => void;
  isCreatingDependentInline: boolean;
  onSetIsCreatingDependentInline: (v: boolean) => void;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  son: 'Filho(a)',
  daughter: 'Filha',
  spouse: 'Cônjuge',
  parent: 'Pai / Mãe',
  other: 'Familiar',
};

export const BeneficiaryModal: React.FC<BeneficiaryModalProps> = ({
  isOpen,
  onClose,
  selectedService,
  isDependentBooking,
  dependentId,
  dependentName,
  hasChosenBeneficiary,
  registeredDependents,
  skipDateStep,
  onSetDependentBooking,
  onSelectDependent,
  onStartCreateDependent,
  onCancelCreateDependent,
  onSaveInlineDependent,
  isSavingInlineDependent,
  newDepFullName,
  setNewDepFullName,
  newDepRelationship,
  setNewDepRelationship,
  newDepBirthDate,
  setNewDepBirthDate,
  newDepNotes,
  setNewDepNotes,
  isCreatingDependentInline,
  onSetIsCreatingDependentInline,
}) => {
  if (!isOpen || !selectedService) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md my-auto border rounded-[4px] p-4 sm:p-5 shadow-2xl space-y-4 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
        <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold font-['Poppins'] leading-snug">
              Para quem é o agendamento?
            </h3>
            <p className="text-[11px] text-emerald-500 font-semibold flex items-start gap-1.5 mt-1 leading-snug">
              <span className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5 rounded-[2px] bg-emerald-500/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 3h18v18H3z" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </span>
              <span className="break-words">{selectedService.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setHasChosenBeneficiary(true); onClose(); }}
            className="w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onSetDependentBooking(false);
              setHasChosenBeneficiary(true);
              onClose();
            }}
            className={`p-3.5 rounded-[4px] border font-bold text-xs flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
              !isDependentBooking
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50'
            }`}
          >
            <User className={`w-5 h-5 shrink-0 ${!isDependentBooking ? 'text-white' : 'text-emerald-500'}`} />
            <span className={`leading-tight ${!isDependentBooking ? 'text-white' : ''}`}>Para Você</span>
          </button>

          <button
            type="button"
            onClick={() => { hapticLight(); onSetDependentBooking(true); }}
            className={`p-3.5 rounded-[4px] border font-bold text-xs flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
              isDependentBooking
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50'
            }`}
          >
            <Users className={`w-5 h-5 shrink-0 ${isDependentBooking ? 'text-white' : 'text-emerald-500'}`} />
            <span className={`leading-tight ${isDependentBooking ? 'text-white' : ''}`}>Para Dependente</span>
          </button>
        </div>

        {isDependentBooking && (
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
            {registeredDependents.length > 0 && !isCreatingDependentInline && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Selecione o Dependente:
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                  {registeredDependents.map((dep) => {
                    const isSelected = dependentName === dep.full_name;
                    return (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => onSelectDependent(dep)}
                        className={`w-full p-2.5 rounded-[4px] border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-white font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-emerald-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <User className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                          <span className={`text-xs font-bold break-words ${isSelected ? 'text-white' : ''}`}>
                            {dep.full_name}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {RELATIONSHIP_LABELS[dep.relationship] || 'Familiar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!isCreatingDependentInline ? (
              <button
                type="button"
                onClick={onStartCreateDependent}
                className="w-full py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white shrink-0" />
                <span className="text-white">Cadastrar Dependente</span>
              </button>
            ) : (
              <form onSubmit={onSaveInlineDependent} className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-500">Novo Dependente (Conta Família)</span>
                  <button
                    type="button"
                    onClick={onCancelCreateDependent}
                    className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={newDepFullName}
                  onChange={(e) => setNewDepFullName(e.target.value)}
                  placeholder="Nome completo do dependente"
                  className="w-full px-3 py-2 text-xs rounded-[4px] border outline-hidden bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-emerald-500"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newDepRelationship}
                    onChange={(e) => setNewDepRelationship(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs rounded-[4px] border outline-hidden bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-emerald-500"
                  >
                    <option value="son">Filho(a)</option>
                    <option value="spouse">Cônjuge</option>
                    <option value="parent">Pai / Mãe</option>
                    <option value="other">Familiar</option>
                  </select>

                  <input
                    type="date"
                    value={newDepBirthDate}
                    onChange={(e) => setNewDepBirthDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-[4px] border outline-hidden bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-emerald-500"
                  />
                </div>

                <input
                  type="text"
                  value={newDepNotes}
                  onChange={(e) => setNewDepNotes(e.target.value)}
                  placeholder="Observações (opcional)"
                  className="w-full px-3 py-2 text-xs rounded-[4px] border outline-hidden bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={isSavingInlineDependent || !newDepFullName.trim()}
                  className="w-full py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Check className="w-4 h-4 text-white shrink-0" />
                  <span className="text-white">
                    {isSavingInlineDependent ? 'Salvando...' : 'Salvar e Avançar'}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};