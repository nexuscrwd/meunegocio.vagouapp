import React, { useState, useEffect } from 'react';
import { 
  X, User, Mail, Phone, MapPin, Calendar, Clock, 
  Check, Moon, Sun, Bell, MessageCircle, ShieldCheck, 
  ChevronRight, ArrowRight, Sparkles, CheckCircle2, 
  Scissors, AlertCircle, LayoutDashboard, Store, KeyRound, LogOut
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../utils/haptics';
import { BookingAppointment, UserProfile } from '../types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userAvatarUrl?: string;
  onUpdateUserName?: (name: string) => void;
  onNavigateToSchedule?: () => void;
  salonName?: string;
  salonPhone?: string;
  isSalonLoggedIn?: boolean;
  onOpenAdminPanel?: () => void;
  onLoginSalon?: (pin: string) => boolean;
  onLogoutSalon?: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'Lucas Silva',
  email: 'lucas.silva@email.com',
  phone: '(11) 98765-4321',
  address: 'Rua das Flores, 120 - São Paulo, SP',
};

const DEFAULT_APPOINTMENTS: BookingAppointment[] = [
  {
    protocolCode: 'VGA-84920',
    service: 'Corte Degradê & Barboterapia',
    professional: 'Carlos Silva',
    salonName: 'Barbearia Rota 99',
    dateTime: 'Hoje às 16:30',
    dayGroup: 'Hoje',
    time: '16:30',
    totalPrice: 45.0,
    status: 'CONFIRMADO',
    address: 'Av. Paulista, 1000 - Bela Vista',
  },
  {
    protocolCode: 'VGA-61042',
    service: 'Barboterapia & Toalha Quente',
    professional: 'Carlos Silva',
    salonName: 'Barbearia Rota 99',
    dateTime: '10/09 às 14:00',
    dayGroup: '10/09',
    time: '14:00',
    totalPrice: 35.0,
    status: 'CONCLUÍDO',
    address: 'Av. Paulista, 1000 - Bela Vista',
  }
];

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  userName = 'Lucas Silva',
  userAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  onUpdateUserName,
  onNavigateToSchedule,
  salonName = 'Barbearia Rota 99',
  salonPhone = '5511987654321',
  isSalonLoggedIn = false,
  onOpenAdminPanel,
  onLoginSalon,
  onLogoutSalon,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState<'menu' | 'agenda' | 'dados' | 'config'>('menu');

  // Estado do Login do Salão
  const [isSalonLoginModalOpen, setIsSalonLoginModalOpen] = useState(false);
  const [salonPinInput, setSalonPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const handleSalonLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onLoginSalon) {
      const success = onLoginSalon(salonPinInput);
      if (success) {
        hapticSuccess();
        setIsSalonLoginModalOpen(false);
        setSalonPinInput('');
        setLoginError(false);
        if (onOpenAdminPanel) {
          onClose();
          onOpenAdminPanel();
        }
      } else {
        hapticMedium();
        setLoginError(true);
      }
    }
  };

  // Estado dos Dados Pessoais do Usuário
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('vagou_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_PROFILE, ...parsed, name: userName || parsed.name };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_PROFILE, name: userName };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccessToast, setSavedSuccessToast] = useState(false);

  // Estado dos Agendamentos
  const [appointments, setAppointments] = useState<BookingAppointment[]>(() => {
    try {
      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_APPOINTMENTS;
  });

  // Preferências
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('vagou_notifications_pref') !== 'disabled';
  });

  const [hapticsEnabled, setHapticsEnabled] = useState(() => {
    return localStorage.getItem('vagou_haptics_pref') !== 'disabled';
  });

  // Salvar preferências
  const handleToggleNotifications = () => {
    hapticLight();
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem('vagou_notifications_pref', next ? 'enabled' : 'disabled');
  };

  const handleToggleHaptics = () => {
    hapticLight();
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    localStorage.setItem('vagou_haptics_pref', next ? 'enabled' : 'disabled');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    hapticSuccess();
    try {
      localStorage.setItem('vagou_user_profile', JSON.stringify(profile));
    } catch {
      // ignore
    }
    if (onUpdateUserName && profile.name.trim()) {
      onUpdateUserName(profile.name.trim());
    }
    setIsEditing(false);
    setSavedSuccessToast(true);
    setTimeout(() => {
      setSavedSuccessToast(false);
    }, 2500);
  };

  // Fechar ao pressionar a tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Container do Drawer com limite de largura mobile */}
      <div 
        className={`w-full max-w-md h-full flex flex-col shadow-2xl transition-transform animate-in slide-in-from-right duration-250 cursor-default ${
          isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. CABEÇALHO DO MENU DO USUÁRIO */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            {activeSubTab !== 'menu' ? (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveSubTab('menu');
                  setIsEditing(false);
                }}
                className={`p-1.5 rounded transition active:scale-95 cursor-pointer ${
                  isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                }`}
                title="Voltar ao Menu"
                aria-label="Voltar ao Menu"
              >
                <ChevronRight className="w-5 h-5 rotate-180 text-emerald-500" />
              </button>
            ) : null}

            <div>
              <h2 className="text-sm font-bold tracking-tight uppercase font-['Poppins']">
                {activeSubTab === 'menu' && 'Menu do Cliente'}
                {activeSubTab === 'agenda' && 'Minha Agenda'}
                {activeSubTab === 'dados' && 'Meus Dados Pessoais'}
                {activeSubTab === 'config' && 'Configurações'}
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {salonName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className={`w-8 h-8 rounded flex items-center justify-center transition active:scale-95 cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
            }`}
            title="Fechar menu"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. CORPO DO DRAWER COM ROLAGEM */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* TOAST DE FEEDBACK DE SALVAMENTO */}
          {savedSuccessToast && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded flex items-center gap-2.5 text-emerald-400 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Dados pessoais atualizados com sucesso!</span>
            </div>
          )}

          {/* VISTA 1: MENU PRINCIPAL DE OPÇÕES */}
          {activeSubTab === 'menu' && (
            <div className="space-y-4">
              {/* CARD DE IDENTIFICAÇÃO DO USUÁRIO */}
              <div className={`p-4 rounded border flex items-center gap-3.5 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="relative w-14 h-14 rounded overflow-hidden ring-2 ring-emerald-500 shrink-0 bg-slate-800">
                  <img 
                    src={userAvatarUrl} 
                    alt={profile.name} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold truncate">{profile.name}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Cliente
                    </span>
                  </div>
                  <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {profile.email}
                  </p>
                  <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {profile.phone}
                  </p>
                </div>
              </div>

              {/* LISTA DE OPÇÕES DO MENU */}
              <div className="space-y-2">
                {/* Opção 1: Minha Agenda */}
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setActiveSubTab('agenda');
                  }}
                  className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-['Poppins']">Minha Agenda</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {appointments.length} {appointments.length === 1 ? 'agendamento' : 'agendamentos'} registrados
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>

                {/* Opção 2: Meus Dados Pessoais */}
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setActiveSubTab('dados');
                  }}
                  className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-['Poppins']">Meus Dados Pessoais</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Nome, e-mail, telefone e endereço
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>

                {/* Opção 3: Alternar Tema */}
                <div className={`p-3.5 rounded border flex items-center justify-between ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold font-['Poppins']">
                        {isDark ? 'Modo Escuro' : 'Modo Claro'}
                      </div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isDark ? 'Tema Slate Noturno ativo' : 'Tema Claro Perolado ativo'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      toggleTheme();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      isDark ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                    title="Alternar Tema"
                    aria-label="Alternar Tema"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isDark ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Opção 4: Configurações & Preferências */}
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setActiveSubTab('config');
                  }}
                  className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-['Poppins']">Notificações & Lembretes</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Lembretes no WhatsApp e vibração
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>

                {/* Opção 5: Falar no WhatsApp */}
                <a
                  href={`https://wa.me/${salonPhone}?text=${encodeURIComponent(`Olá! Sou ${profile.name} e gostaria de tirar uma dúvida sobre meu agendamento na ${salonName}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => hapticLight()}
                  className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-['Poppins']">Fale com o Estabelecimento</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        WhatsApp direto da equipe
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </a>

                {/* Seção de Gestão do Salão (Administração) */}
                {isSalonLoggedIn ? (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-['Poppins']">
                        Gestão do Salão
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500 text-white font-black">
                        CONECTADO
                      </span>
                    </div>

                    {/* Botão: Abrir Painel do Salão */}
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        onClose();
                        onOpenAdminPanel?.();
                      }}
                      className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer shadow-xs ${
                        isDark 
                          ? 'border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-950/60 text-white' 
                          : 'border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-xs">
                          <LayoutDashboard className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-['Poppins'] flex items-center gap-1.5">
                            <span>Painel de Gestão do Salão</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500 text-white font-bold">Admin</span>
                          </div>
                          <div className={`text-[11px] ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            Gerenciar catálogo, equipe, horários e fila
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-emerald-400" />
                    </button>

                    {/* Botão: Sair da Conta do Salão */}
                    <button
                      type="button"
                      onClick={() => {
                        hapticMedium();
                        onLogoutSalon?.();
                      }}
                      className={`w-full p-3 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                        isDark 
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400' 
                          : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <LogOut className="w-4 h-4" />
                        <span className="text-xs font-bold font-['Poppins']">Sair da Conta do Salão</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold">Desconectar</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setIsSalonLoginModalOpen(true);
                        setLoginError(false);
                        setSalonPinInput('');
                      }}
                      className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 text-slate-300 hover:text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-['Poppins']">Acesso do Salão / Gestão</div>
                          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Entrar como gestor para gerenciar o app
                          </div>
                        </div>
                      </div>
                      <KeyRound className="w-4 h-4 text-emerald-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: MINHA AGENDA */}
          {activeSubTab === 'agenda' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-['Poppins']">
                  Histórico de Agendamentos
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {appointments.length} itens
                </span>
              </div>

              {appointments.length === 0 ? (
                <div className={`p-6 rounded border text-center space-y-3 ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                }`}>
                  <Calendar className="w-8 h-8 text-emerald-500 mx-auto opacity-60" />
                  <p className="text-xs font-medium">Você ainda não possui agendamentos cadastrados.</p>
                  {onNavigateToSchedule && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticMedium();
                        onClose();
                        onNavigateToSchedule();
                      }}
                      className="px-4 py-2 bg-[#20C933] hover:bg-[#1bb32d] text-white text-xs font-bold rounded uppercase tracking-wider cursor-pointer"
                    >
                      Agendar Agora
                    </button>
                  )}
                </div>
              ) : (
                appointments.map((item, idx) => (
                  <div
                    key={item.protocolCode || idx}
                    className={`p-3.5 rounded border space-y-2.5 transition ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-emerald-400 border border-slate-700">
                        #{item.protocolCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'CONFIRMADO' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold">{item.service}</h4>
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Profissional: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{item.professional}</strong>
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.dateTime || `${item.dayGroup} às ${item.time}`}</span>
                      </div>
                      <span className="font-bold text-xs">
                        R$ {Number(item.totalPrice).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                ))
              )}

              {onNavigateToSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    onClose();
                    onNavigateToSchedule();
                  }}
                  className="w-full py-3 mt-2 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition uppercase tracking-wider font-['Poppins'] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Scissors className="w-4 h-4" />
                  <span>AGENDAR NOVO HORÁRIO</span>
                </button>
              )}
            </div>
          )}

          {/* VISTA 3: MEUS DADOS PESSOAIS */}
          {activeSubTab === 'dados' && (
            <div className="space-y-4">
              <form onSubmit={handleSaveProfile} className="space-y-3">
                {/* Campo Nome */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Nome Completo</span>
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* Campo E-mail */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <Mail className="w-3.5 h-3.5 text-emerald-500" />
                    <span>E-mail</span>
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    required
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* Campo Telefone */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Telefone / WhatsApp</span>
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    required
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* Campo Endereço */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Endereço Residencial</span>
                  </label>
                  <input
                    type="text"
                    value={profile.address}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* BOTÕES DE AÇÃO DOS DADOS */}
                <div className="pt-2">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setIsEditing(true);
                      }}
                      className="w-full py-3 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition uppercase tracking-wider font-['Poppins'] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      <span>EDITAR DADOS</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setIsEditing(false);
                        }}
                        className={`flex-1 py-3 rounded border text-xs font-bold transition cursor-pointer ${
                          isDark 
                            ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300' 
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                      >
                        CANCELAR
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition uppercase tracking-wider font-['Poppins'] cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>SALVAR</span>
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* VISTA 4: CONFIGURAÇÕES & PREFERÊNCIAS */}
          {activeSubTab === 'config' && (
            <div className="space-y-3">
              {/* Notificações WhatsApp */}
              <div className={`p-3.5 rounded border flex items-center justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold font-['Poppins']">Lembretes de Horário</div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Receber aviso 1h antes no WhatsApp
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title="Ativar/Desativar Lembretes"
                  aria-label="Ativar/Desativar Lembretes"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Vibração Tátil */}
              <div className={`p-3.5 rounded border flex items-center justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold font-['Poppins']">Vibração Tátil (Haptics)</div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Feedback ao clicar em botões e abas
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleHaptics}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    hapticsEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title="Ativar/Desativar Vibração"
                  aria-label="Ativar/Desativar Vibração"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Segurança e Privacidade */}
              <div className={`p-3.5 rounded border space-y-1.5 ${
                isDark ? 'bg-slate-900/60 border-slate-800/80 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Privacidade e Segurança</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Seus dados e agendamentos estão protegidos de acordo com a LGPD e são transmitidos de forma criptografada para {salonName}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. RODAPÉ FIXO DO MENU */}
        <div className={`p-3 border-t text-center text-[10px] shrink-0 ${
          isDark ? 'bg-slate-900/80 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
        }`}>
          <span>{salonName} • App Oficial do Estabelecimento</span>
        </div>
      </div>

      {/* MODAL DE LOGIN DO SALÃO COM PIN */}
      {isSalonLoginModalOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setIsSalonLoginModalOpen(false);
          }}
        >
          <div
            className={`w-full max-w-sm p-5 rounded border shadow-2xl space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold font-['Poppins']">Login da Barbearia</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSalonLoginModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Digite o PIN de acesso do salão para liberar os controles administrativos. (PIN padrão: <strong className="text-emerald-400 font-mono">1234</strong>)
            </p>

            <form onSubmit={handleSalonLoginSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">PIN do Gestor</label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  required
                  value={salonPinInput}
                  onChange={(e) => {
                    setSalonPinInput(e.target.value);
                    setLoginError(false);
                  }}
                  placeholder="Ex: 1234"
                  className={`w-full px-3 py-2.5 text-center text-base tracking-widest font-mono rounded border outline-hidden transition ${
                    loginError 
                      ? 'border-rose-500 bg-rose-500/10 text-rose-300' 
                      : isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
                {loginError && (
                  <p className="text-[11px] text-rose-400 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>PIN incorreto. Tente novamente ou use 1234.</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSalonLoginModalOpen(false)}
                  className="px-3 py-2 rounded text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#20C933] hover:bg-[#1bb32d] text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Acessar Painel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
