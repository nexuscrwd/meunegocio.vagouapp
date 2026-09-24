import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Check, 
  Sparkles, 
  Heart, 
  Calendar,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticSuccess } from '../utils/haptics';

// Avatares premium pré-selecionados para o usuário escolher
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
];

interface UserDashboardProps {
  onBack: () => void;
  onUpdateProfile?: (name: string, avatarUrl: string) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({ 
  onBack,
  onUpdateProfile
}) => {
  const { isDark } = useTheme();
  
  // Carregar dados iniciais do localStorage ou usar fallbacks
  const [name, setName] = useState(() => {
    return localStorage.getItem('vagou_user_name') || 'Usuário';
  });
  
  const [avatarUrl, setAvatarUrl] = useState(() => {
    return localStorage.getItem('vagou_user_avatar') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80';
  });

  const [email, setEmail] = useState(() => {
    return localStorage.getItem('vagou_user_email') || '';
  });

  const [phone, setPhone] = useState(() => {
    return localStorage.getItem('vagou_user_phone') || '';
  });

  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contadores dinâmicos para a seção de estatísticas do cliente
  const [stats, setStats] = useState({
    activeCount: 0,
    concludedCount: 0
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        const list = JSON.parse(saved);
        const active = list.filter((apt: any) => apt.status === 'CONFIRMADO' || apt.status === 'AGENDADO' || apt.status === 'PENDENTE').length;
        const concluded = list.filter((apt: any) => apt.status === 'CONCLUÍDO' || apt.status === 'concluido').length;
        setStats({ activeCount: active, concludedCount: concluded });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Formatar telefone no padrão brasileiro
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length > 6) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
      } else if (numbers.length > 2) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      }
      return numbers;
    }
    return value;
  };

  // Processamento de arquivos para troca de avatar (suporta drag-and-drop e input clássico)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, envie apenas arquivos de imagem.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
        hapticLight();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      localStorage.setItem('vagou_user_name', name.trim());
      localStorage.setItem('vagou_user_avatar', avatarUrl);
      localStorage.setItem('vagou_user_email', email.trim());
      localStorage.setItem('vagou_user_phone', phone.trim());
      
      // Chamar callback global para propagar atualizações no resto do App
      if (onUpdateProfile) {
        onUpdateProfile(name.trim(), avatarUrl);
      }
      
      hapticSuccess();
      setIsSavedSuccessfully(true);
      setTimeout(() => setIsSavedSuccessfully(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-transparent">
      {/* CABEÇALHO UNIFICADO */}
      <header className={`sticky top-0 z-40 px-4 py-3.5 flex items-center justify-between border-b ${
        isDark ? 'bg-slate-950/95 border-slate-900/60' : 'bg-white border-slate-200'
      } backdrop-blur-md`}>
        <button
          type="button"
          onClick={() => {
            hapticLight();
            onBack();
          }}
          className={`p-1.5 rounded-[4px] transition active:scale-95 cursor-pointer ${
            isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-black uppercase tracking-wider font-['Poppins'] text-emerald-400">
          Meus Dados Pessoais
        </h1>
        <div className="w-8 h-8" /> {/* Spacer */}
      </header>

      {/* CONTEÚDO ROLANTE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
        
        {/* EDITAR FOTO / AVATAR (ÁREA DE UPLOAD E PRESETS) */}
        <div className={`p-4 rounded-[4px] border ${
          isDark ? 'bg-slate-900/70 border-slate-800/80' : 'bg-white border-slate-200'
        } space-y-4`}>
          <div className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-emerald-400">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Foto do Perfil</span>
          </div>

          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4">
            
            {/* Imagem do Perfil Ativa + Upload trigger */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative w-24 h-24 rounded-full border-2 cursor-pointer group flex items-center justify-center overflow-hidden transition-all shrink-0 ${
                isDragging 
                  ? 'border-emerald-400 bg-emerald-500/10 scale-105' 
                  : isDark 
                    ? 'border-slate-800 hover:border-emerald-500 bg-slate-950' 
                    : 'border-slate-300 hover:border-emerald-500 bg-slate-100 shadow-2xs'
              }`}
            >
              <img 
                src={avatarUrl || PRESET_AVATARS[0]} 
                alt="Foto do Perfil" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white">
                <Upload className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-[9px] font-bold text-slate-300 uppercase">Enviar</span>
              </div>
              
              {/* Botão flutuante para indicar editabilidade */}
              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </div>

            {/* Input escondido */}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Informações de Drag-and-Drop */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="space-y-0.5">
                <p className={`text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  Arraste uma foto ou clique para escolher
                </p>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Suporta arquivos PNG, JPG ou GIF. Máximo de 2MB.
                </p>
              </div>

              {/* Seletor Rápido de Avatares Clássicos */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Ou escolha um avatar clássico:
                </span>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  {PRESET_AVATARS.map((url, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setAvatarUrl(url);
                      }}
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 transition active:scale-95 cursor-pointer ${
                        avatarUrl === url ? 'border-emerald-400 scale-110 shadow-md' : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <img 
                        src={url} 
                        alt={`Preset ${index}`} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* METRICAS / DASHBOARD ESTATÍSTICO */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-[4px] border ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200 shadow-2xs'
          }`}>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ativos</span>
            </div>
            <div className="text-xl font-black text-emerald-400 leading-none">
              {stats.activeCount}
            </div>
            <div className="text-[9px] text-slate-400 mt-1">
              Agendamentos agendados
            </div>
          </div>

          <div className={`p-3 rounded-[4px] border ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200 shadow-2xs'
          }`}>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Concluídos</span>
            </div>
            <div className="text-xl font-black text-emerald-400 leading-none">
              {stats.concludedCount}
            </div>
            <div className="text-[9px] text-slate-400 mt-1">
              Visitas concluídas no estabelecimento
            </div>
          </div>
        </div>

        {/* FORMULÁRIO DE DADOS PESSOAIS */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className={`p-4 rounded-[4px] border ${
            isDark ? 'bg-slate-900/70 border-slate-800/80' : 'bg-white border-slate-200'
          } space-y-3`}>
            
            {/* Campo: Nome Completo */}
            <div className="space-y-1">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Nome Completo</span>
              </label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Insira seu nome completo"
                className={`w-full px-3 py-2.5 rounded-[4px] text-xs border outline-hidden transition font-semibold ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 focus:border-emerald-500 text-slate-100' 
                    : 'bg-white border-slate-200 focus:border-emerald-500 text-slate-950 focus:ring-1 focus:ring-emerald-500 shadow-2xs'
                }`}
              />
            </div>

            {/* Campo: E-mail */}
            <div className="space-y-1">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>E-mail</span>
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="exemplo@email.com"
                className={`w-full px-3 py-2.5 rounded-[4px] text-xs border outline-hidden transition font-semibold ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 focus:border-emerald-500 text-slate-100' 
                    : 'bg-white border-slate-200 focus:border-emerald-500 text-slate-950 focus:ring-1 focus:ring-emerald-500 shadow-2xs'
                }`}
              />
            </div>

            {/* Campo: Telefone */}
            <div className="space-y-1">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Telefone Celular</span>
              </label>
              <input 
                type="text" 
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
                placeholder="(11) 99999-9999"
                className={`w-full px-3 py-2.5 rounded-[4px] text-xs border outline-hidden transition font-semibold ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 focus:border-emerald-500 text-slate-100' 
                    : 'bg-white border-slate-200 focus:border-emerald-500 text-slate-950 focus:ring-1 focus:ring-emerald-500 shadow-2xs'
                }`}
              />
            </div>
          </div>

          {/* Banner de Salvo com sucesso */}
          {isSavedSuccessfully && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs py-2 px-3 rounded-[4px] font-bold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Perfil salvo com sucesso! Seus dados foram sincronizados.</span>
            </div>
          )}

          {/* Botão de Envio Unificado */}
          <button
            type="submit"
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-black text-xs rounded-[4px] transition uppercase tracking-widest font-['Poppins'] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <Check className="w-4 h-4 text-white" />
            <span className="text-white">Salvar Alterações</span>
          </button>
        </form>
      </div>
    </div>
  );
};
