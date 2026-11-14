import React from 'react';
import {
  Store,
  Eye,
  Calendar,
  Scissors,
  Sliders,
  Check,
  X,
  UserCheck,
  LayoutDashboard,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

export type TargetEnvironmentMode = 'client_mode' | 'salon_mode';

interface ProfileModeSwitchModalProps {
  isOpen: boolean;
  targetMode: TargetEnvironmentMode | null;
  salonName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ProfileModeSwitchModal: React.FC<ProfileModeSwitchModalProps> = ({
  isOpen,
  targetMode,
  salonName = 'seu estabelecimento',
  onConfirm,
  onCancel,
}) => {
  const { isDark } = useTheme();

  if (!isOpen || !targetMode) return null;

  const isEnteringClientMode = targetMode === 'client_mode';

  const items = isEnteringClientMode
    ? [
        {
          icon: Eye,
          title: 'Ver sua vitrine como o cliente vê',
          desc: `Confira ao vivo como cores, fotos, preços, serviços e equipe de ${salonName} aparecem para o público.`,
        },
        {
          icon: Calendar,
          title: 'Testar agendamentos e trajeto GPS',
          desc: 'Simule a escolha de datas, horários vagos, permutas e navegação no mapa exatamente como seu cliente faz.',
        },
        {
          icon: UserCheck,
          title: 'Usar sua conta pessoal',
          desc: 'Acesse seus próprios dados pessoais, sua agenda de cliente, dependentes (Conta Família) e chat.',
        },
      ]
    : [
        {
          icon: LayoutDashboard,
          title: 'Painel operacional e fila do dia',
          desc: 'Acompanhe clientes em deslocamento (GPS), fila de espera, agenda de atendimentos e pausa rápida de horários.',
        },
        {
          icon: Scissors,
          title: 'Gerenciar Serviços, Equipe e Espaço',
          desc: 'Cadastre preços, durações, colaboradores, comissões, estrutura física, endereço e canais de contato.',
        },
        {
          icon: Sliders,
          title: 'Preferências, Visual e Utilidades',
          desc: 'Personalize o tema e layout da vitrine e controle o Caixa, PIX, financeiro, metas, consumo e estoque.',
        },
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-[390px] rounded-[4px] border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isDark
            ? 'bg-slate-950 border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div
          className={`px-4 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-[4px] flex items-center justify-center shrink-0 text-white ${
                isEnteringClientMode ? 'bg-emerald-500' : 'bg-[#2B82C9]'
              }`}
            >
              {isEnteringClientMode ? (
                <Eye className="w-4 h-4 text-white" />
              ) : (
                <Store className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                  isEnteringClientMode
                    ? 'text-emerald-500'
                    : isDark
                    ? 'text-sky-400'
                    : 'text-[#2B82C9]'
                }`}
              >
                {isEnteringClientMode ? 'Mudando para Visão Pública' : 'Mudando para Gestão Interna'}
              </span>
              <h3 className="text-sm font-extrabold font-['Poppins'] truncate leading-tight">
                {isEnteringClientMode ? 'Ambiente Modo Cliente' : 'Ambiente Modo Salão'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onCancel();
            }}
            className={`w-8 h-8 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo Explicativo Plano (Zero Box dentro de Box) */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
          <p
            className={`text-xs leading-relaxed font-medium ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {isEnteringClientMode
              ? 'Você está entrando no Ambiente Modo Cliente. Aqui você sai do painel administrativo e visualiza o aplicativo exatamente como seus clientes.'
              : 'Você está entrando no Ambiente Modo Salão. Este é o painel exclusivo do profissional e gestor para operar e configurar o estabelecimento.'}
          </p>

          <div
            className={`divide-y ${
              isDark ? 'divide-slate-800/80 border-t border-slate-800/80' : 'divide-slate-100 border-t border-slate-100'
            }`}
          >
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="py-3 flex items-start gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isEnteringClientMode ? 'text-emerald-500' : 'text-[#2B82C9]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug">{item.title}</p>
                    <p
                      className={`text-[11px] mt-0.5 leading-relaxed ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé Fixo de Ação */}
        <div
          className={`px-4 py-3 border-t sticky bottom-0 z-20 flex items-center gap-2 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onCancel();
            }}
            className={`px-3.5 py-2.5 rounded-[4px] font-bold text-xs transition cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'bg-slate-200/80 hover:bg-slate-300/80 text-slate-700'
            }`}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => {
              hapticSuccess();
              onConfirm();
            }}
            className={`flex-1 py-2.5 px-4 rounded-[4px] font-bold text-xs text-white flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98 whitespace-nowrap ${
              isEnteringClientMode
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-[#2B82C9] hover:bg-[#1F6FB0] text-white'
            }`}
          >
            <Check className="w-4 h-4 text-white shrink-0" />
            <span className="text-white">
              {isEnteringClientMode ? 'Entrar no Modo Cliente' : 'Entrar no Modo Salão'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
