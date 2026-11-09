import React, { useState } from 'react';
import {
  LogOut,
  User,
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
  isDependent?: boolean;
}

interface MobileHeaderProps {
  currentUser: HeaderUser;
  userRole: UserRole;
  logoUrl?: string;
  isGerMode?: boolean;
  isSalonLoggedIn?: boolean;
  isProAdmin?: boolean;
  onChangeRole: (role: UserRole) => void;
  onLogout: () => void;
  onOpenUserSection?: (section: UserMenuSection) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentUser,
  logoUrl,
  isGerMode = false,
  isSalonLoggedIn = false,
  isProAdmin = true,
  onLogout,
  onOpenUserSection,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const firstName = (currentUser.name || 'Usuário').trim().split(' ')[0].toUpperCase();
  const initials = (currentUser.name || 'Usuário')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Descrição do perfil: "Usuário", "Dependente" ou o cargo se for do estabelecimento
  const userSubtitle = (() => {
    if (currentUser.isDependent || currentUser.jobTitle?.toLowerCase() === 'dependente') {
      return 'Dependente';
    }
    if (isGerMode || isSalonLoggedIn) {
      return currentUser.jobTitle || (isProAdmin ? 'Proprietário' : 'Profissional');
    }
    if (currentUser.jobTitle && currentUser.jobTitle.toLowerCase() !== 'cliente') {
      return currentUser.jobTitle;
    }
    return 'Usuário';
  })();

  // Resolução do Logo oficial ou Fallback "Logo"
  const resolvedLogo =
    logoUrl ||
    localStorage.getItem('vagou_salon_logo') ||
    localStorage.getItem('vagou_salon_logo_dark') ||
    localStorage.getItem('vagou_salon_logo_light') ||
    '';

  const hasValidLogo =
    Boolean(resolvedLogo) &&
    typeof resolvedLogo === 'string' &&
    resolvedLogo.trim().length > 0 &&
    !resolvedLogo.includes('placeholder') &&
    !resolvedLogo.startsWith('data:image/svg+xml');

  return (
    <header className="w-full shrink-0 sticky top-0 z-50">
      {/* Faixa Superior com Degradê Verde Pastel Suave (Default) */}
      <div className="caixa-header-gradient px-4 pt-4 pb-5 text-[#065F46] relative">
        <div className="flex items-center justify-between gap-2">
          
          {/* Bloco Esquerdo: Logo do Estabelecimento ou Fallback "Logo" */}
          <div className="h-10 min-w-[70px] px-3 rounded-[4px] bg-white/80 backdrop-blur-xs border border-[#A7F3D0] flex items-center justify-center shadow-2xs overflow-hidden shrink-0">
            {hasValidLogo ? (
              <img
                src={resolvedLogo}
                alt="Logo"
                className="max-h-7 max-w-[85px] object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="font-display font-extrabold text-xs tracking-wider text-[#065F46] uppercase select-none">
                Logo
              </span>
            )}
          </div>

          {/* Bloco Direito: Avatar + Saudação + Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 text-right group focus:outline-none cursor-pointer"
              title="Abrir menu de opções"
            >
              <div className="text-right flex flex-col items-end justify-center min-w-0">
                <h1 className="font-display font-extrabold text-sm tracking-wide text-[#065F46] leading-tight truncate max-w-[150px]">
                  {firstName}
                </h1>
                <p className="text-[10px] font-semibold text-[#047857] leading-tight tracking-wide mt-0.5 capitalize truncate max-w-[150px]">
                  {userSubtitle}
                </p>
              </div>
              <div className="w-10 h-10 rounded-[4px] bg-white/85 backdrop-blur-xs border border-[#A7F3D0] flex items-center justify-center font-display font-extrabold text-sm tracking-tight text-[#065F46] shadow-xs group-hover:bg-white transition-colors overflow-hidden shrink-0">
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
                  <span className="text-[#065F46]">{initials}</span>
                )}
              </div>
            </button>

            {/* Menu Dropdown Flutuante do Usuário com os Itens Originais do App */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 max-h-[80vh] overflow-y-auto no-scrollbar bg-white rounded-[4px] shadow-xl border border-[#A7F3D0] z-50 text-[#1E293B]">
                  {/* Topo do Dropdown: Identificação do Usuário + Botão Claro/Escuro */}
                  <div className="px-3.5 py-3 bg-[#ECFDF5] border-b border-[#A7F3D0] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold font-display text-[#065F46] truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[10px] text-[#047857] font-medium truncate">
                        {currentUser.jobTitle || 'Cliente'} •{' '}
                        {currentUser.companyName || 'Estabelecimento'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTheme()}
                      className="px-2 py-1 rounded-[4px] bg-white border border-[#A7F3D0] hover:bg-[#F0FDF4] flex flex-col items-center justify-center gap-0.5 text-amber-600 cursor-pointer shrink-0"
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
                    <div className="p-2 bg-[#F0FDF4] border-b border-[#D1FAE5]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('ALTERNAR_MODO');
                        }}
                        className="w-full px-3 py-2 rounded-[4px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
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
                    <div className="py-1 divide-y divide-[#ECFDF5]">
                      <div className="px-3.5 py-1.5 bg-[#F0FDF4]">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#047857]">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                          className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                    <div className="py-1 divide-y divide-[#ECFDF5]">
                      <div className="px-3.5 py-1.5 bg-[#F0FDF4]">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#047857]">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
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
                  <div className="p-2 bg-[#F0FDF4] border-t border-[#A7F3D0] space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenUserSection?.('MENU_COMPLETO');
                      }}
                      className="w-full py-1.5 rounded-[4px] bg-white hover:bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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

        </div>
      </div>
    </header>
  );
};
