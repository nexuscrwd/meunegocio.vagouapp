import React, { useState, useEffect } from 'react';
import {
  LogOut,
  User,
  Clock,
  ChevronDown,
  Calendar,
  Navigation,
  Users,
  MessageSquare,
  Scissors,
  Store,
  Sliders,
  Mail,
  Sun,
  Moon,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type UserRole = 'COLLABORATOR' | 'MANAGER' | 'SUPER_ADMIN';

export type UserMenuSection =
  | 'MENU_COMPLETO'
  | 'MINHA_AGENDA'
  | 'TRAJETO_GPS'
  | 'DEPENDENTES'
  | 'DADOS_PESSOAIS'
  | 'CHAT_VAGOU'
  | 'PRO_SERVICOS'
  | 'PRO_ESPACO'
  | 'PRO_EQUIPE'
  | 'PRO_PREFERENCIAS'
  | 'PRO_UTILIDADES'
  | 'ALTERNAR_MODO';

export interface HeaderUser {
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  jobTitle?: string;
  companyName?: string;
}

interface MobileHeaderProps {
  currentUser: HeaderUser;
  userRole: UserRole;
  isGerMode?: boolean;
  isSalonLoggedIn?: boolean;
  isProAdmin?: boolean;
  onChangeRole: (role: UserRole) => void;
  onLogout: () => void;
  onOpenUserSection?: (section: UserMenuSection) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentUser,
  isGerMode = false,
  isSalonLoggedIn = false,
  isProAdmin = true,
  onLogout,
  onOpenUserSection,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [now, setNow] = useState(new Date());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Relógio em tempo real (atualiza a cada 1 segundo)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const firstName = (currentUser.name || 'Usuário').trim().split(' ')[0].toUpperCase();
  const initials = (currentUser.name || 'Usuário')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const formattedDate = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedTime = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="w-full shrink-0 sticky top-0 z-30">
      {/* Faixa Superior com Degradê Institucional */}
      <div className="caixa-header-gradient px-4 pt-4 pb-5 text-white relative">
        <div className="flex items-center justify-between gap-2">
          
          {/* Bloco Esquerdo: Avatar + Saudação + Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
              title="Abrir menu de opções"
            >
              <div className="w-10 h-10 rounded-[4px] bg-white/20 backdrop-blur-xs border border-white/40 flex items-center justify-center font-display font-extrabold text-sm tracking-tight text-white shadow-xs group-hover:bg-white/30 transition-colors overflow-hidden shrink-0">
                {currentUser.avatarUrl &&
                !currentUser.avatarUrl.startsWith('data:image/svg+xml') &&
                !currentUser.avatarUrl.includes('unsplash.com') ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-white">{initials}</span>
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium text-white/90 leading-none mb-1 flex items-center gap-1">
                  Olá,
                </p>
                <div className="flex items-center gap-1">
                  <h1 className="font-display font-extrabold text-base tracking-wide text-white leading-none">
                    {firstName}
                  </h1>
                  <ChevronDown
                    className={`w-4 h-4 text-white/90 transition-transform duration-200 ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>
            </button>

            {/* Menu Dropdown Flutuante do Usuário com os Itens Originais do App */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 max-h-[80vh] overflow-y-auto no-scrollbar bg-white rounded-[4px] shadow-xl border border-[#D5E0EC] z-50 text-[#1E293B]">
                  {/* Topo do Dropdown: Identificação do Usuário + Botão Claro/Escuro */}
                  <div className="px-3.5 py-3 bg-[#F0F6FC] border-b border-[#D5E0EC] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold font-display text-[#005CA9] truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[10px] text-[#5F6C7B] font-medium truncate">
                        {currentUser.jobTitle || 'Cliente'} •{' '}
                        {currentUser.companyName || 'Estabelecimento'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTheme()}
                      className="px-2 py-1 rounded-[4px] bg-white border border-[#D5E0EC] hover:bg-[#F7F9FC] flex flex-col items-center justify-center gap-0.5 text-amber-600 cursor-pointer shrink-0"
                      title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
                    >
                      {isDark ? (
                        <Moon className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span className="text-[8px] font-bold uppercase tracking-tight">
                        {isDark ? 'Escuro' : 'Claro'}
                      </span>
                    </button>
                  </div>

                  {/* Alternador Rápido de Modo (se logado no salão) */}
                  {isSalonLoggedIn && (
                    <div className="p-2 bg-[#F7F9FC] border-b border-[#EDF2F7]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('ALTERNAR_MODO');
                        }}
                        className="w-full px-3 py-2 rounded-[4px] bg-[#005CA9] hover:bg-[#0D79B4] text-white font-bold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {isGerMode ? (
                            <LayoutDashboard className="w-3.5 h-3.5 text-white shrink-0" />
                          ) : (
                            <Store className="w-3.5 h-3.5 text-white shrink-0" />
                          )}
                          <span className="text-white">
                            {isGerMode ? 'MODO SALÃO (Ir p/ Cliente)' : 'MODO CLIENTE (Ir p/ Salão)'}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-white shrink-0" />
                      </button>
                    </div>
                  )}

                  {/* ============================================================ */}
                  {/* ITENS ORIGINAIS DO MODO GESTÃO DO ESTABELECIMENTO (isGerMode) */}
                  {/* ============================================================ */}
                  {isGerMode ? (
                    <div className="py-1 divide-y divide-[#EDF2F7]">
                      <div className="px-3.5 py-1.5 bg-[#F7F9FC]">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#5F6C7B]">
                          Gestão do Estabelecimento
                        </span>
                      </div>

                      {/* 1. Serviços */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('PRO_SERVICOS');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <Scissors className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Serviços
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Valores, durações e procedimentos
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 2. Espaço */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('PRO_ESPACO');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <Store className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Espaço
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Estrutura, localização e contatos
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 3. Equipe */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('PRO_EQUIPE');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Equipe
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Colaboradores, permissões e comissões
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 4. Preferências */}
                      {isProAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenUserSection?.('PRO_PREFERENCIAS');
                          }}
                          className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                              <Sliders className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#1E293B] leading-tight">
                                Preferências
                              </p>
                              <p className="text-[10px] text-[#5F6C7B] truncate">
                                Dados do negócio, ident. visual e layout
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                        </button>
                      )}

                      {/* 5. Utilidades */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('PRO_UTILIDADES');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Utilidades
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Financeiro, consumo, insumos e estoque
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 6. Meus Dados Pessoais */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('DADOS_PESSOAIS');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Meus Dados Pessoais
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Nome, e-mail, telefone e foto
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>
                    </div>
                  ) : (
                    /* ============================================================ */
                    /* ITENS ORIGINAIS DO MODO CLIENTE (!isGerMode) — MINHA CONTA   */
                    /* ============================================================ */
                    <div className="py-1 divide-y divide-[#EDF2F7]">
                      <div className="px-3.5 py-1.5 bg-[#F7F9FC]">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#5F6C7B]">
                          Minha Conta
                        </span>
                      </div>

                      {/* 1. Minha Agenda */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('MINHA_AGENDA');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Minha Agenda
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Ver agendamentos e propostas de permuta
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 2. Trajeto (Teste GPS) */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('TRAJETO_GPS');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-[#1E293B] leading-tight">
                                Trajeto
                              </p>
                              <span className="px-1.5 py-0.2 rounded-[3px] text-[8px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                Teste
                              </span>
                            </div>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Inserir partida e destino para testar GPS
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 3. Conta Família • Dependentes */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('DEPENDENTES');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Conta Família • Dependentes
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Cadastrar filhos, cônjuge ou familiares
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 4. Meus Dados Pessoais */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('DADOS_PESSOAIS');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#EBF5FF] text-[#005CA9] flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Meus Dados Pessoais
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Nome, e-mail, telefone e endereço
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>

                      {/* 5. Chat no App Vagou */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('CHAT_VAGOU');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F7F9FC] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#008B47] flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1E293B] leading-tight">
                              Chat no App Vagou
                            </p>
                            <p className="text-[10px] text-[#5F6C7B] truncate">
                              Mensagens diretas com a equipe
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      </button>
                    </div>
                  )}

                  {/* Rodapé do Dropdown: Abrir Menu em Tela Cheia + Encerrar Sessão */}
                  <div className="p-2 bg-[#F7F9FC] border-t border-[#D5E0EC] space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenUserSection?.('MENU_COMPLETO');
                      }}
                      className="w-full py-1.5 rounded-[4px] bg-white hover:bg-[#EBF5FF] border border-[#D5E0EC] text-[#005CA9] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      Abrir Painel Completo / Alterar Foto
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full py-1.5 rounded-[4px] bg-[#FEE2E2] hover:bg-[#FECACA] text-[#DC2626] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {isSalonLoggedIn ? 'Sair da Conta Pro' : 'Sair da Conta'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bloco Direito: Relógio Digital em Tempo Real + Botão Sair */}
          <div className="flex items-center gap-2">
            <div className="bg-white/15 backdrop-blur-xs border border-white/25 px-2.5 py-1 rounded-[4px] text-right shadow-2xs">
              <div className="flex items-center justify-end gap-1 text-[10px] font-semibold text-white/95 leading-tight">
                <Clock className="w-2.5 h-2.5 text-white/80 shrink-0" />
                <span>{formattedDate}</span>
              </div>
              <div className="font-mono-tabular font-bold text-xs text-white tracking-wider leading-tight mt-0.5">
                {formattedTime}
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sair da conta"
              className="h-10 px-2.5 rounded-[4px] bg-white/15 hover:bg-white/25 border border-white/30 flex flex-col items-center justify-center text-white transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-white" />
              <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5 leading-none text-white">
                Sair
              </span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
