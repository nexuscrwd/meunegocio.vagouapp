import React, { useState, useEffect } from 'react';
import { 
  X, LayoutDashboard, Scissors, Users, Calendar, Settings, 
  Plus, Trash2, Edit2, Check, Clock, Phone, MapPin, 
  CheckCircle2, AlertCircle, LogOut, ArrowRight, Store, 
  DollarSign, Sparkles, MessageCircle, ShieldCheck, ChevronRight,
  UserCheck, Pause, Play, Eye
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../utils/haptics';
import { BookingAppointment, SalonAdminSettings } from '../types';
import { CatalogServiceItem, SalonProfessionalItem } from './SalonBookingModal';

interface SalonAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  salonName: string;
  salonPhone?: string;
  salonAddress?: string;
  services: CatalogServiceItem[];
  professionals: SalonProfessionalItem[];
  onUpdateServices?: (services: CatalogServiceItem[]) => void;
  onUpdateProfessionals?: (professionals: SalonProfessionalItem[]) => void;
  onUpdateSettings?: (settings: Partial<SalonAdminSettings>) => void;
}

const DEFAULT_ADMIN_SETTINGS: SalonAdminSettings = {
  salonName: 'Barbearia Rota 99',
  salonPhone: '5511987654321',
  salonAddress: 'Rua das Flores, 1420 - Centro, Curitiba - PR',
  openingHours: 'Seg a Sáb: 09:00 às 20:00',
  isOpenNow: true,
  pinCode: '1234',
};

export const SalonAdminModal: React.FC<SalonAdminModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  salonName,
  salonPhone = '5511987654321',
  salonAddress = 'Rua das Flores, 1420 - Centro',
  services,
  professionals,
  onUpdateServices,
  onUpdateProfessionals,
  onUpdateSettings,
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'servicos' | 'equipe' | 'agendamentos' | 'config'>('visao_geral');

  // Configurações do Salão
  const [adminSettings, setAdminSettings] = useState<SalonAdminSettings>(() => {
    try {
      const saved = localStorage.getItem('vagou_salon_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_ADMIN_SETTINGS,
          ...parsed,
          isOpenNow: parsed.isOpenNow !== undefined ? parsed.isOpenNow : true,
          salonName: salonName || DEFAULT_ADMIN_SETTINGS.salonName
        };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_ADMIN_SETTINGS, salonName: salonName || DEFAULT_ADMIN_SETTINGS.salonName };
  });

  // Lista local de serviços administráveis
  const [adminServices, setAdminServices] = useState<CatalogServiceItem[]>(services);

  // Lista local de equipe
  const [adminProfessionals, setAdminProfessionals] = useState<SalonProfessionalItem[]>(professionals);

  // Lista de Agendamentos do Salão
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
    return [
      {
        protocolCode: 'VGA-84920',
        service: 'Corte Degradê & Barboterapia',
        professional: 'Carlos Henrique',
        salonName: salonName || 'Barbearia Rota 99',
        dateTime: 'Hoje às 16:30',
        dayGroup: 'Hoje',
        time: '16:30',
        totalPrice: 45.0,
        status: 'CONFIRMADO',
        address: salonAddress,
      },
      {
        protocolCode: 'VGA-91823',
        service: 'Barboterapia & Toalha Quente',
        professional: 'Mateus Ramos',
        salonName: salonName || 'Barbearia Rota 99',
        dateTime: 'Hoje às 17:15',
        dayGroup: 'Hoje',
        time: '17:15',
        totalPrice: 35.0,
        status: 'CONFIRMADO',
        address: salonAddress,
      },
      {
        protocolCode: 'VGA-61042',
        service: 'Corte Social na Tesoura',
        professional: 'Carlos Henrique',
        salonName: salonName || 'Barbearia Rota 99',
        dateTime: '10/09 às 14:00',
        dayGroup: '10/09',
        time: '14:00',
        totalPrice: 40.0,
        status: 'CONCLUÍDO',
        address: salonAddress,
      },
    ];
  });

  // Estados de Edição de Serviço
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({
    title: '',
    price: 45,
    duration: '45 min',
    category: 'Cabelo',
    description: '',
  });

  // Estados de Edição de Profissional
  const [isAddingProfessional, setIsAddingProfessional] = useState(false);
  const [professionalForm, setProfessionalForm] = useState({
    name: '',
    role: 'Master Barber',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    rating: 5.0,
  });

  // Mensagem Toast de Sucesso
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Salvar configurações
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    hapticSuccess();
    try {
      localStorage.setItem('vagou_salon_admin_settings', JSON.stringify(adminSettings));
    } catch {
      // ignore
    }
    onUpdateSettings?.(adminSettings);
    showToast('Configurações da barbearia salvas!');
  };

  // Alternar status do salão (Aberto / Fechado)
  const handleToggleOpenStatus = () => {
    hapticLight();
    const updated = { ...adminSettings, isOpenNow: !adminSettings.isOpenNow };
    setAdminSettings(updated);
    try {
      localStorage.setItem('vagou_salon_admin_settings', JSON.stringify(updated));
    } catch {
      // ignore
    }
    showToast(updated.isOpenNow ? 'Salão aberto para agendamentos!' : 'Salão marcado como temporariamente fechado.');
  };

  // Atualizar Status do Agendamento
  const handleUpdateAppointmentStatus = (protocolCode: string, newStatus: BookingAppointment['status']) => {
    hapticLight();
    const updated = appointments.map((apt) => 
      apt.protocolCode === protocolCode ? { ...apt, status: newStatus } : apt
    );
    setAppointments(updated);
    try {
      localStorage.setItem('vagou_user_appointments', JSON.stringify(updated));
    } catch {
      // ignore
    }
    showToast(`Agendamento #${protocolCode} marcado como ${newStatus}.`);
  };

  // Salvar Novo / Editar Serviço
  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.title.trim()) return;
    hapticSuccess();

    let updatedList: CatalogServiceItem[];
    if (editingServiceId) {
      updatedList = adminServices.map((srv) => 
        srv.id === editingServiceId 
          ? { ...srv, ...serviceForm }
          : srv
      );
      showToast('Serviço atualizado com sucesso!');
    } else {
      const newSrv: CatalogServiceItem = {
        id: `srv-${Date.now()}`,
        title: serviceForm.title,
        price: Number(serviceForm.price) || 40,
        duration: serviceForm.duration || '40 min',
        category: serviceForm.category || 'Cabelo',
        description: serviceForm.description || 'Procedimento realizado com produtos profissionais.',
        image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80',
        aspectRatio: 'aspect-square',
      };
      updatedList = [newSrv, ...adminServices];
      showToast('Novo serviço cadastrado no catálogo!');
    }

    setAdminServices(updatedList);
    onUpdateServices?.(updatedList);
    try {
      localStorage.setItem('vagou_custom_services', JSON.stringify(updatedList));
    } catch {
      // ignore
    }

    setIsAddingService(false);
    setEditingServiceId(null);
    setServiceForm({ title: '', price: 45, duration: '45 min', category: 'Cabelo', description: '' });
  };

  // Deletar Serviço
  const handleDeleteService = (id: string) => {
    hapticMedium();
    const updated = adminServices.filter((s) => s.id !== id);
    setAdminServices(updated);
    onUpdateServices?.(updated);
    try {
      localStorage.setItem('vagou_custom_services', JSON.stringify(updated));
    } catch {
      // ignore
    }
    showToast('Serviço removido do catálogo.');
  };

  // Salvar Novo Profissional
  const handleSaveProfessional = (e: React.FormEvent) => {
    e.preventDefault();
    if (!professionalForm.name.trim()) return;
    hapticSuccess();

    const newProf: SalonProfessionalItem = {
      name: professionalForm.name,
      role: professionalForm.role || 'Barber',
      avatar: professionalForm.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      rating: 5.0,
    };

    const updated = [...adminProfessionals, newProf];
    setAdminProfessionals(updated);
    onUpdateProfessionals?.(updated);
    try {
      localStorage.setItem('vagou_custom_professionals', JSON.stringify(updated));
    } catch {
      // ignore
    }

    setIsAddingProfessional(false);
    setProfessionalForm({ name: '', role: 'Master Barber', avatar: '', rating: 5.0 });
    showToast('Novo profissional adicionado à equipe!');
  };

  // Deletar Profissional
  const handleDeleteProfessional = (name: string) => {
    hapticMedium();
    const updated = adminProfessionals.filter((p) => p.name !== name);
    setAdminProfessionals(updated);
    onUpdateProfessionals?.(updated);
    try {
      localStorage.setItem('vagou_custom_professionals', JSON.stringify(updated));
    } catch {
      // ignore
    }
    showToast('Profissional removido da equipe.');
  };

  // Estatísticas Rápidas
  const totalRevenueToday = appointments
    .filter((a) => a.status === 'CONFIRMADO' || a.status === 'CONCLUÍDO')
    .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMADO').length;

  // Fechar no ESC
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
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className={`w-full max-w-2xl h-full sm:h-[90vh] sm:max-h-[820px] rounded-none sm:rounded border flex flex-col shadow-2xl transition-colors cursor-default overflow-hidden ${
          isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. CABEÇALHO DO PAINEL ADMINISTRATIVO */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight font-['Poppins']">
                  Painel de Gestão do Salão
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-white uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {adminSettings.salonName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Logout da Conta do Salão */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onLogout();
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isDark 
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30' 
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
              }`}
              title="Sair da Conta do Salão (Voltar para Modo Cliente)"
              aria-label="Sair da conta do salão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Sair do Salão</span>
            </button>

            {/* Fechar */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onClose();
              }}
              className={`w-8 h-8 rounded flex items-center justify-center transition active:scale-95 cursor-pointer ${
                isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Fechar painel"
              aria-label="Fechar painel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. BARRA DE ABAS DE GESTÃO (ROLANDO HORIZONTALMENTE SE NECESSÁRIO) */}
        <div className={`px-4 py-2 border-b flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100/80 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveTab('visao_geral');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'visao_geral'
                ? 'bg-emerald-500 text-white shadow-xs'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Visão Geral</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveTab('servicos');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'servicos'
                ? 'bg-emerald-500 text-white shadow-xs'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Serviços & Preços</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveTab('equipe');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'equipe'
                ? 'bg-emerald-500 text-white shadow-xs'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Equipe</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveTab('agendamentos');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'agendamentos'
                ? 'bg-emerald-500 text-white shadow-xs'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Agendamentos</span>
            {confirmedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-700 text-white font-black">
                {confirmedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveTab('config');
            }}
            className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-emerald-500 text-white shadow-xs'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Dados do Salão</span>
          </button>
        </div>

        {/* 3. CONTEÚDO DA ABA SELECIONADA */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* TOAST DE FEEDBACK */}
          {toastMessage && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded flex items-center gap-2.5 text-emerald-400 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* ABA 1: VISÃO GERAL */}
          {activeTab === 'visao_geral' && (
            <div className="space-y-4">
              {/* CARD DE STATUS OPERACIONAL */}
              <div className={`p-4 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${adminSettings.isOpenNow ? 'bg-[#20C933] shadow-[0_0_10px_#20C933]' : 'bg-rose-500'}`} />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Status do Estabelecimento: {adminSettings.isOpenNow ? 'Aberto' : 'Fechado'}
                    </h3>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {adminSettings.isOpenNow 
                        ? 'Clientes podem ver vagas e agendar serviços normalmente.' 
                        : 'Agendamentos pausados temporariamente pelo gestor.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleOpenStatus}
                  className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    adminSettings.isOpenNow
                      ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40'
                      : 'bg-[#20C933] text-white hover:bg-[#1bb32d] shadow-xs'
                  }`}
                >
                  {adminSettings.isOpenNow ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{adminSettings.isOpenNow ? 'Pausar Atendimentos' : 'Abrir Salão Agora'}</span>
                </button>
              </div>

              {/* KPIS RÁPIDOS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3.5 rounded border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Agendamentos
                  </span>
                  <div className="text-xl font-extrabold mt-1 font-['Poppins']">
                    {appointments.length}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">Registrados no app</span>
                </div>

                <div className={`p-3.5 rounded border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Confirmados
                  </span>
                  <div className="text-xl font-extrabold mt-1 font-['Poppins'] text-emerald-400">
                    {confirmedCount}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Aguardando atendimento</span>
                </div>

                <div className={`p-3.5 rounded border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Faturamento
                  </span>
                  <div className="text-xl font-extrabold mt-1 font-['Poppins'] text-emerald-400">
                    R$ {totalRevenueToday.toFixed(0)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Previsão confirmada</span>
                </div>

                <div className={`p-3.5 rounded border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Equipe Ativa
                  </span>
                  <div className="text-xl font-extrabold mt-1 font-['Poppins']">
                    {adminProfessionals.length}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Profissionais disponíveis</span>
                </div>
              </div>

              {/* LISTA RÁPIDA DE PRÓXIMOS ATENDIMENTOS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins'] text-emerald-400">
                    Próximos Atendimentos
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('agendamentos')}
                    className="text-xs text-emerald-500 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Todos</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {appointments.slice(0, 3).map((apt) => (
                  <div
                    key={apt.protocolCode}
                    className={`p-3.5 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate">{apt.service}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          apt.status === 'CONFIRMADO' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : apt.status === 'CONCLUÍDO'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                      <div className={`text-xs flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span>{apt.dateTime}</span>
                        <span>•</span>
                        <span>Profissional: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{apt.professional}</strong></span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">R$ {apt.totalPrice.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {apt.status === 'CONFIRMADO' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateAppointmentStatus(apt.protocolCode, 'CONCLUÍDO')}
                          className="px-2.5 py-1.5 rounded text-xs font-bold bg-[#20C933] hover:bg-[#1bb32d] text-white flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          title="Marcar como Concluído"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Concluir</span>
                        </button>
                      )}
                      <a
                        href={`https://wa.me/${salonPhone}?text=${encodeURIComponent(`Olá! Confirmando seu agendamento de ${apt.service} (${apt.dateTime}) na ${adminSettings.salonName}. Código: #${apt.protocolCode}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1.5 rounded border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-emerald-600 hover:bg-slate-200'
                        }`}
                        title="Enviar mensagem no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 2: SERVIÇOS & PREÇOS */}
          {activeTab === 'servicos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins'] text-emerald-400">
                    Catálogo de Serviços ({adminServices.length})
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Gerencie valores, tempo de atendimento e procedimentos da barbearia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setEditingServiceId(null);
                    setServiceForm({ title: '', price: 45, duration: '45 min', category: 'Cabelo', description: '' });
                    setIsAddingService(true);
                  }}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-[#20C933] hover:bg-[#1bb32d] text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Novo Serviço</span>
                </button>
              </div>

              {/* FORMULÁRIO DE ADIÇÃO / EDIÇÃO DE SERVIÇO */}
              {isAddingService && (
                <form
                  onSubmit={handleSaveService}
                  className={`p-4 rounded border space-y-3 animate-in fade-in ${
                    isDark ? 'bg-slate-900 border-emerald-500/40' : 'bg-slate-50 border-emerald-500/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      {editingServiceId ? 'Editar Serviço' : 'Cadastrar Novo Serviço'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Título do Serviço</label>
                      <input
                        type="text"
                        required
                        value={serviceForm.title}
                        onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                        placeholder="Ex: Corte Degradê Navalhado"
                        className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Preço (R$)</label>
                      <input
                        type="number"
                        required
                        step="1"
                        min="5"
                        value={serviceForm.price}
                        onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                        className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Duração</label>
                      <input
                        type="text"
                        required
                        value={serviceForm.duration}
                        onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                        placeholder="Ex: 40 min"
                        className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Categoria</label>
                      <select
                        value={serviceForm.category}
                        onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                        className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                        }`}
                      >
                        <option value="Cabelo">Cabelo / Cortes</option>
                        <option value="Barba">Barba / Barboterapia</option>
                        <option value="Combo">Combos & Especiais</option>
                        <option value="Tratamentos">Tratamentos & Hidratação</option>
                        <option value="Estética">Estética & Rosto</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Descrição</label>
                    <input
                      type="text"
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                      placeholder="Breve resumo do serviço para o cliente..."
                      className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#20C933] hover:bg-[#1bb32d] text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Salvar Serviço</span>
                    </button>
                  </div>
                </form>
              )}

              {/* LISTA DE SERVIÇOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {adminServices.map((srv) => (
                  <div
                    key={srv.id}
                    className={`p-3.5 rounded border flex flex-col justify-between gap-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold truncate">{srv.title}</h4>
                        <span className="text-xs font-black text-emerald-400 shrink-0">
                          R$ {srv.price.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className={`text-[11px] line-clamp-2 mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {srv.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {srv.duration}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {srv.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setEditingServiceId(srv.id);
                          setServiceForm({
                            title: srv.title,
                            price: srv.price,
                            duration: srv.duration,
                            category: srv.category,
                            description: srv.description,
                          });
                          setIsAddingService(true);
                        }}
                        className={`p-1.5 rounded border text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-950'
                        }`}
                        title="Editar Serviço"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteService(srv.id)}
                        className={`p-1.5 rounded border text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                          isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        }`}
                        title="Excluir Serviço"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 3: EQUIPE & PROFISSIONAIS */}
          {activeTab === 'equipe' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins'] text-emerald-400">
                    Profissionais Cadastrados ({adminProfessionals.length})
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Controle de barbeiros e especialistas da equipe.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setIsAddingProfessional(true);
                  }}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-[#20C933] hover:bg-[#1bb32d] text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Novo Barbeiro</span>
                </button>
              </div>

              {/* FORMULÁRIO DE ADIÇÃO DE PROFISSIONAL */}
              {isAddingProfessional && (
                <form
                  onSubmit={handleSaveProfessional}
                  className={`p-4 rounded border space-y-3 animate-in fade-in ${
                    isDark ? 'bg-slate-900 border-emerald-500/40' : 'bg-slate-50 border-emerald-500/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Adicionar Membro da Equipe
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingProfessional(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={professionalForm.name}
                        onChange={(e) => setProfessionalForm({ ...professionalForm, name: e.target.value })}
                        placeholder="Ex: Rafael Souza"
                        className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Especialidade / Cargo</label>
                      <input
                        type="text"
                        required
                        value={professionalForm.role}
                        onChange={(e) => setProfessionalForm({ ...professionalForm, role: e.target.value })}
                        placeholder="Ex: Master Barber & Visagista"
                        className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">URL da Foto de Perfil</label>
                    <input
                      type="url"
                      value={professionalForm.avatar}
                      onChange={(e) => setProfessionalForm({ ...professionalForm, avatar: e.target.value })}
                      placeholder="https://..."
                      className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingProfessional(false)}
                      className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#20C933] hover:bg-[#1bb32d] text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Cadastrar Profissional</span>
                    </button>
                  </div>
                </form>
              )}

              {/* LISTA DE PROFISSIONAIS */}
              <div className="space-y-3">
                {adminProfessionals.map((prof) => (
                  <div
                    key={prof.name}
                    className={`p-3.5 rounded border flex items-center justify-between gap-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded overflow-hidden ring-1.5 ring-emerald-500 shrink-0 bg-slate-800">
                        <img
                          src={prof.avatar}
                          alt={prof.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold truncate">{prof.name}</h4>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ★ {prof.rating.toFixed(1)}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {prof.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteProfessional(prof.name)}
                        className={`p-2 rounded border text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                          isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        }`}
                        title="Remover Profissional"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 4: GESTÃO DE AGENDAMENTOS */}
          {activeTab === 'agendamentos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins'] text-emerald-400">
                    Histórico & Fila de Atendimento ({appointments.length})
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Controle de confirmação, conclusão e cancelamento de agendamentos.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.protocolCode}
                    className={`p-4 rounded border space-y-3 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          #{apt.protocolCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          apt.status === 'CONFIRMADO' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : apt.status === 'CONCLUÍDO'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-400">
                        R$ {apt.totalPrice.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">Serviço: </span>
                        <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{apt.service}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Profissional: </span>
                        <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{apt.professional}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Data / Horário: </span>
                        <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{apt.dateTime}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <a
                        href={`https://wa.me/${salonPhone}?text=${encodeURIComponent(`Olá! Entrando em contato sobre seu agendamento de ${apt.service} (${apt.dateTime}) na ${adminSettings.salonName}. Código: #${apt.protocolCode}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#20C933] hover:underline font-bold cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Falar no WhatsApp</span>
                      </a>

                      <div className="flex items-center gap-2">
                        {apt.status !== 'CONFIRMADO' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAppointmentStatus(apt.protocolCode, 'CONFIRMADO')}
                            className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer transition active:scale-95"
                          >
                            Confirmar
                          </button>
                        )}
                        {apt.status !== 'CONCLUÍDO' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAppointmentStatus(apt.protocolCode, 'CONCLUÍDO')}
                            className="px-2.5 py-1 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition active:scale-95"
                          >
                            Concluir
                          </button>
                        )}
                        {apt.status !== 'CANCELADO' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateAppointmentStatus(apt.protocolCode, 'CANCELADO')}
                            className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40 cursor-pointer transition active:scale-95"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 5: DADOS & CONFIGURAÇÕES */}
          {activeTab === 'config' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins'] text-emerald-400">
                  Dados do Estabelecimento
                </h3>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Informações comerciais e horários exibidos no aplicativo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Nome Fantasia da Barbearia</label>
                  <input
                    type="text"
                    required
                    value={adminSettings.salonName}
                    onChange={(e) => setAdminSettings({ ...adminSettings, salonName: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">WhatsApp Comercial (com DDD)</label>
                  <input
                    type="text"
                    required
                    value={adminSettings.salonPhone}
                    onChange={(e) => setAdminSettings({ ...adminSettings, salonPhone: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    required
                    value={adminSettings.salonAddress}
                    onChange={(e) => setAdminSettings({ ...adminSettings, salonAddress: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Horário de Funcionamento</label>
                  <input
                    type="text"
                    required
                    value={adminSettings.openingHours}
                    onChange={(e) => setAdminSettings({ ...adminSettings, openingHours: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">PIN de Acesso Admin (4 dígitos)</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={adminSettings.pinCode}
                    onChange={(e) => setAdminSettings({ ...adminSettings, pinCode: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded border outline-hidden transition ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#20C933] hover:bg-[#1bb32d] text-white font-bold text-xs rounded transition flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Salvar Configurações</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 4. RODAPÉ FIXO DO PAINEL */}
        <div className={`p-3.5 border-t flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Modo Administrativo Conectado</span>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded transition active:scale-95 cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
