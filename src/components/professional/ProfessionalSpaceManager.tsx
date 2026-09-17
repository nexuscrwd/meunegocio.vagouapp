import React, { useState } from 'react';
import { 
  Store, MapPin, Phone, Clock, Users, Plus, 
  Trash2, Edit2, Check, X, ShieldCheck, KeyRound,
  FileText, Sparkles, AlertCircle
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../../utils/haptics';
import { SalonAdminSettings } from '../../types';
import { SalonProfessionalItem } from '../SalonBookingModal';

interface ProfessionalSpaceManagerProps {
  adminSettings?: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => void;
  professionals: SalonProfessionalItem[];
  onUpdateProfessionals: (professionals: SalonProfessionalItem[]) => void;
}

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&q=80',
];

export const ProfessionalSpaceManager: React.FC<ProfessionalSpaceManagerProps> = ({
  adminSettings = { isOpenNow: true, salonName: 'Barbearia Rota 99', salonPhone: '(41) 99882-1140', salonAddress: 'Rua das Flores, 1420 - Centro', openingHours: 'Seg a Sáb: 09:00 às 20:00', pinCode: '1234' },
  onUpdateSettings,
  professionals,
  onUpdateProfessionals,
}) => {
  const { isDark } = useTheme();

  // Estados locais do formulário de dados do espaço
  const [salonName, setSalonName] = useState<string>(adminSettings?.salonName || 'Barbearia Rota 99');
  const [salonPhone, setSalonPhone] = useState<string>(adminSettings?.salonPhone || '(41) 99882-1140');
  const [salonAddress, setSalonAddress] = useState<string>(adminSettings?.salonAddress || 'Rua das Flores, 1420 - Centro');
  const [openingHours, setOpeningHours] = useState<string>(adminSettings?.openingHours || 'Seg a Sáb: 09:00 às 20:00');
  const [pinCode, setPinCode] = useState<string>(adminSettings?.pinCode || '1234');

  // Gestão de Equipe
  const [isAddProfessionalModalOpen, setIsAddProfessionalModalOpen] = useState<boolean>(false);
  const [newProfName, setNewProfName] = useState<string>('');
  const [newProfRole, setNewProfRole] = useState<string>('Master Barber');
  const [newProfAvatar, setNewProfAvatar] = useState<string>(SAMPLE_AVATARS[0]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Salvar Informações do Espaço
  const handleSaveAllInfo = (e: React.FormEvent) => {
    e.preventDefault();
    hapticSuccess();
    onUpdateSettings({
      salonName: salonName.trim(),
      salonPhone: salonPhone.trim(),
      salonAddress: salonAddress.trim(),
      openingHours: openingHours.trim(),
      pinCode: pinCode.trim(),
    });
    showToast('Informações do espaço atualizadas!');
  };

  // Adicionar Profissional à Equipe
  const handleAddProfessional = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfName.trim()) return;

    const newProf: SalonProfessionalItem = {
      name: newProfName.trim(),
      role: newProfRole.trim() || 'Profissional',
      avatar: newProfAvatar,
      rating: 5.0,
    };

    const updated = [...professionals, newProf];
    onUpdateProfessionals(updated);
    hapticSuccess();
    showToast(`${newProfName} adicionado à equipe!`);
    setIsAddProfessionalModalOpen(false);
    setNewProfName('');
  };

  // Remover Profissional
  const handleRemoveProfessional = (nameToRemove: string) => {
    hapticMedium();
    const updated = professionals.filter((p) => p.name !== nameToRemove);
    onUpdateProfessionals(updated);
    showToast('Profissional removido da equipe.');
  };

  return (
    <div className="w-full h-full flex flex-col justify-start overflow-hidden relative">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded bg-emerald-500 text-white font-bold text-xs shadow-lg animate-in fade-in flex items-center gap-1.5 whitespace-nowrap">
          <Check className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOPO: CABEÇALHO DA SEÇÃO DE EDIÇÃO DO ESPAÇO */}
      <div className={`p-3.5 border-b transition-colors shrink-0 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <h3 className={`text-sm font-bold font-['Poppins'] flex items-center gap-1.5 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          <Store className="w-4 h-4 text-emerald-400" />
          Gerenciar Informações do Espaço
        </h3>
        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Edite as informações e a equipe exibidas para os clientes
        </p>
      </div>

      {/* CONTEÚDO ROLÁVEL COM FORMULÁRIOS PLANOS */}
      <form onSubmit={handleSaveAllInfo} className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-4 no-scrollbar">
        {/* BLOCO 1: DADOS DO ESTABELECIMENTO */}
        <div className="space-y-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Dados do Estabelecimento
          </span>

          {/* Nome do Salão */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Nome do Salão / Barbearia *
            </label>
            <input
              type="text"
              required
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              className={`w-full px-3 py-2 rounded text-xs border ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
              } outline-hidden`}
            />
          </div>

          {/* Telefone / WhatsApp */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Telefone / WhatsApp de Atendimento *
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={salonPhone}
                onChange={(e) => setSalonPhone(e.target.value)}
                className={`w-full pl-8 pr-3 py-2 rounded text-xs border ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                } outline-hidden`}
              />
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Endereço Completo & Bairro *
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={salonAddress}
                onChange={(e) => setSalonAddress(e.target.value)}
                className={`w-full pl-8 pr-3 py-2 rounded text-xs border ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                } outline-hidden`}
              />
            </div>
          </div>

          {/* Horários de Funcionamento */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Horário de Funcionamento *
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="Ex: Seg a Sáb: 09:00 às 20:00"
                className={`w-full pl-8 pr-3 py-2 rounded text-xs border ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                } outline-hidden`}
              />
            </div>
          </div>
        </div>

        {/* BLOCO 2: GESTÃO DA EQUIPE DE PROFISSIONAIS */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Equipe de Profissionais ({professionals.length})
            </span>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsAddProfessionalModalOpen(true);
              }}
              className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Adicionar Membro</span>
            </button>
          </div>

          {/* Lista de Membros da Equipe */}
          <div className="space-y-2">
            {professionals.map((prof, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={prof.avatar}
                    alt={prof.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-emerald-500/40"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {prof.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">
                      {prof.role || 'Barber'}
                    </p>
                  </div>
                </div>

                {professionals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProfessional(prof.name)}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                    title="Remover Profissional"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BLOCO 3: SEGURANÇA E PIN DE ACESSO */}
        <div className="space-y-2 pt-2">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Segurança de Acesso
          </span>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              PIN de Acesso do Profissional (4 dígitos)
            </label>
            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                maxLength={8}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className={`w-full pl-8 pr-3 py-2 rounded text-xs tracking-widest font-mono border ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                } outline-hidden`}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Código utilizado para desbloquear o modo profissional.
            </p>
          </div>
        </div>

        {/* BOTÃO SALVAR FIXO NO FINAL DO FORMULÁRIO */}
        <div className="pt-2 pb-6">
          <button
            type="submit"
            className="w-full py-2.5 rounded bg-[#20C933] hover:bg-[#1bb32d] active:scale-98 text-white font-bold text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 text-white stroke-[2.5]" />
            <span>SALVAR INFORMAÇÕES DO ESPAÇO</span>
          </button>
        </div>
      </form>

      {/* MODAL DE ADICIONAR PROFISSIONAL */}
      {isAddProfessionalModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsAddProfessionalModalOpen(false)}
        >
          <div 
            className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold font-['Poppins']">
                  Novo Profissional na Equipe
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProfessionalModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProfessional} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newProfName}
                  onChange={(e) => setNewProfName(e.target.value)}
                  placeholder="Ex: Gabriel Santos"
                  className={`w-full px-3 py-2 rounded text-xs border ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  } outline-hidden`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Especialidade / Cargo *
                </label>
                <input
                  type="text"
                  required
                  value={newProfRole}
                  onChange={(e) => setNewProfRole(e.target.value)}
                  placeholder="Ex: Master Barber, Visagista, Colorista"
                  className={`w-full px-3 py-2 rounded text-xs border ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  } outline-hidden`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Foto de Perfil (Escolha Rápida)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {SAMPLE_AVATARS.map((avatarUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNewProfAvatar(avatarUrl)}
                      className={`aspect-square rounded-full overflow-hidden border-2 transition cursor-pointer ${
                        newProfAvatar === avatarUrl ? 'border-emerald-500 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded bg-[#20C933] hover:bg-[#1bb32d] active:scale-98 text-white font-bold text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-white stroke-[2.5]" />
                  <span>ADICIONAR À EQUIPE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
