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
  LayoutGrid,
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
  const { isDark, toggleTheme, resolvedPalette } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGerenciarExpanded, setIsGerenciarExpanded] = useState(false);

  const firstName = (currentUser.name || 'Usuário').trim().split(' ')[0].toUpperCase();
  const initials = (currentUser.name || 'Usuário')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

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

  const headerBg = resolvedPalette.headerBg;
  const headerBorder = resolvedPalette.headerBorder;
  const headerText = resolvedPalette.headerText;
  const headerSubtext = resolvedPalette.headerSubtext;
  const boxBg = resolvedPalette.headerBoxBg;
  const boxBorder = resolvedPalette.headerBoxBorder;

  return (
    <header className="w-full shrink-0 sticky top-0 z-50">
      <div
        className={`px-4 py-3.5 relative transition-colors ${
          resolvedPalette.isCustomized ? 'border-b-2' : 'border-b'
        }`}
        style={{
          backgroundColor: headerBg,
          borderColor: headerBorder,
          color: headerText,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Bloco Esquerdo: Logo do Estabelecimento ou Fallback "Logo" */}
          <div
            className="h-10 min-w-[70px] px-3 rounded-[4px] border flex items-center justify-center overflow-hidden shrink-0 transition-colors"
            style={{
              backgroundColor: boxBg,
              borderColor: boxBorder,
            }}
          >
            {hasValidLogo ? (
              <img
                src={resolvedLogo}
                alt="Logo"
                className="max-h-7 max-w-[85px] object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                className="font-display font-extrabold text-xs tracking-wider uppercase select-none"
                style={{ color: resolvedPalette.isCustomized && !isDark ? headerText : headerText }}
              >
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
                <h1
                  className="font-display font-extrabold text-sm tracking-wide leading-tight truncate max-w-[150px]"
                  style={{ color: headerText }}
                >
                  {firstName}
                </h1>
                <p
                  className="text-[10px] font-semibold leading-tight tracking-wide mt-0.5 capitalize truncate max-w-[150px]"
                  style={{ color: headerSubtext }}
                >
                  {userSubtitle}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-[4px] border flex items-center justify-center font-display font-extrabold text-sm tracking-tight transition-colors overflow-hidden shrink-0"
                style={{
                  backgroundColor: boxBg,
                  borderColor: boxBorder,
                  color: headerText,
                }}
              >
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
                  <span style={{ color: headerText }}>{initials}</span>
                )}
              </div>
            </button>

            {/* Menu Dropdown Flutuante do Usuário */}
            {isUserMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 max-h-[80vh] overflow-y-auto no-scrollbar bg-white rounded-[4px] shadow-xl border border-slate-200 z-50 text-slate-900">
                  {/* Topo do Dropdown: Identificação do Usuário + Botão Claro/Escuro */}
                  <div className="px-3.5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold font-display text-slate-900 truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        {currentUser.jobTitle || 'Cliente'} •{' '}
                        {currentUser.companyName || 'Estabelecimento'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTheme()}
                      className="px-2 py-1 rounded-[4px] bg-white border border-slate-200 hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 text-slate-700 cursor-pointer shrink-0"
                      title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
                    >
                      {isDark ? (
                        <Moon className="w-3.5 h-3.5 text-slate-700" />
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
                    <div className="p-2 bg-slate-50 border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('ALTERNAR_MODO');
                        }}
                        className="w-full px-3 py-2 rounded-[4px] brand-btn font-bold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {isGerMode ? (
                            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Store className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>
                            {isGerMode ? 'MODO SALÃO (Ir p/ Cliente)' : 'MODO CLIENTE (Ir p/ Salão)'}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  )}

                  {isGerMode ? (
                    <div className="py-1 divide-y divide-slate-100">
                      <div className="px-3.5 py-1.5 bg-slate-50">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          Gestão do Estabelecimento
                        </span>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setIsGerenciarExpanded((prev) => !prev)}
                          className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                              <LayoutGrid className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 leading-tight">
                                Gerenciar
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                Serviços, equipe e espaço
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                              isGerenciarExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </button>

                        {isGerenciarExpanded && (
                          <div className="bg-slate-50/70 divide-y divide-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onOpenUserSection?.('PRO_SERVICOS');
                              }}
                              className="w-full pl-7 pr-3.5 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-6 h-6 rounded-[4px] bg-white text-slate-700 flex items-center justify-center shrink-0">
                                  <Scissors className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 leading-tight">
                                    Serviços
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    Valores, durações e procedimentos
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onOpenUserSection?.('PRO_EQUIPE');
                              }}
                              className="w-full pl-7 pr-3.5 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-6 h-6 rounded-[4px] bg-white text-slate-700 flex items-center justify-center shrink-0">
                                  <Users className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 leading-tight">
                                    Equipe
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    Colaboradores, permissões e comissões
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsUserMenuOpen(false);
                                onOpenUserSection?.('PRO_ESPACO');
                              }}
                              className="w-full pl-7 pr-3.5 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-100/80 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-6 h-6 rounded-[4px] bg-white text-slate-700 flex items-center justify-center shrink-0">
                                  <Store className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 leading-tight">
                                    Espaço
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    Estrutura, localização e contatos
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isProAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenUserSection?.('PRO_PREFERENCIAS');
                          }}
                          className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                              <Sliders className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 leading-tight">
                                Preferências
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                Dados do negócio, ident. visual e layout
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('PRO_UTILIDADES');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              Utilidades
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Financeiro, consumo, insumos e estoque
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-1 divide-y divide-slate-100">
                      <div className="px-3.5 py-1.5 bg-slate-50">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          Minha Conta
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('DADOS_PESSOAIS');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              Meus Dados Pessoais
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Nome, e-mail, telefone e endereço
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('MINHA_AGENDA');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              Minha Agenda
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Ver agendamentos e propostas de permuta
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('DEPENDENTES');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              Conta Família • Dependentes
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Cadastrar filhos, cônjuge ou familiares
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('CHAT_VAGOU');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              Chat no App Vagou
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              Mensagens diretas com a equipe
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenUserSection?.('TRAJETO_GPS');
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-[4px] bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-900 leading-tight">
                                Trajeto
                              </p>
                              <span className="px-1.5 py-0.2 rounded-[3px] text-[8px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                Teste
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">
                              Inserir partida e destino para testar GPS
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    </div>
                  )}

                  <div className="p-2 bg-slate-50 border-t border-slate-200 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenUserSection?.('MENU_COMPLETO');
                      }}
                      className="w-full py-1.5 rounded-[4px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                      className="w-full py-1.5 rounded-[4px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
