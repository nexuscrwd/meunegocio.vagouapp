import React, { useState } from 'react';
import { 
  X, User, Phone, Mail, Lock, Eye, EyeOff, Loader2, 
  CheckCircle2, ArrowRight, ShieldCheck, Sparkles 
} from 'lucide-react';
import { signInWithSupabase, signUpWithSupabase } from '../lib/supabase';
import { hapticLight, hapticSuccess, hapticMedium } from '../utils/haptics';

export interface SalonClientAuthUser {
  id?: string;
  name: string;
  phone: string;
  email: string;
}

interface SalonClientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName: string;
  salonLogo?: string;
  primaryColor?: string;
  onAuthenticated: (user: SalonClientAuthUser) => void;
}

export const SalonClientAuthModal: React.FC<SalonClientAuthModalProps> = ({
  isOpen,
  onClose,
  salonName,
  salonLogo,
  primaryColor = '#00a033',
  onAuthenticated,
}) => {
  const [tab, setTab] = useState<'signup' | 'login'>('signup');

  // Campos de Cadastro
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos de Login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Estados de Carregamento & Erro
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // Formatar Telefone WhatsApp em tempo real
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) {
      setPhone(digits);
    } else if (digits.length <= 7) {
      setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
    } else {
      setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
    }
  };

  // Submissão do Cadastro do Cliente no Salão
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    hapticLight();

    if (!name.trim()) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Informe um WhatsApp válido com DDD.');
      return;
    }
    if (!email.includes('@')) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await signUpWithSupabase(cleanEmail, password, {
        full_name: name.trim(),
        phone: phone.trim(),
        role: 'cliente',
        registered_at_salon: salonName,
      });

      if (error) {
        // Se a conta já existe, direciona amigavelmente para o Login
        if (error.message.includes('already registered') || error.message.includes('User already exists')) {
          setErrorMessage('Você já possui cadastro no Vagou! Faça login com sua senha.');
          setLoginIdentifier(cleanEmail);
          setTab('login');
          setLoading(false);
          return;
        }
        setErrorMessage(error.message || 'Erro ao realizar cadastro.');
        setLoading(false);
        return;
      }

      hapticSuccess();
      const authenticatedUser: SalonClientAuthUser = {
        id: data?.user?.id,
        name: name.trim(),
        phone: phone.trim(),
        email: cleanEmail,
      };

      // Gravar sessão do cliente
      try {
        localStorage.setItem('vagou_user_name', authenticatedUser.name);
        localStorage.setItem('vagou_user_phone', authenticatedUser.phone);
        localStorage.setItem('vagou_user_email', authenticatedUser.email);
        localStorage.setItem('vagou_current_persona', 'cliente');
        localStorage.setItem('vagou_user_role', 'cliente');
      } catch {}

      onAuthenticated(authenticatedUser);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha na conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Submissão do Login do Cliente no Salão
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    hapticLight();

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage('Preencha seu e-mail e sua senha.');
      return;
    }

    setLoading(true);

    try {
      const cleanIdent = loginIdentifier.trim().toLowerCase();
      const { data, error } = await signInWithSupabase(cleanIdent, loginPassword);

      if (error) {
        setErrorMessage('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      hapticSuccess();
      const userMeta = data?.user?.user_metadata || {};
      const authenticatedUser: SalonClientAuthUser = {
        id: data?.user?.id,
        name: userMeta.full_name || userMeta.name || loginIdentifier.split('@')[0],
        phone: userMeta.phone || '',
        email: data?.user?.email || cleanIdent,
      };

      try {
        localStorage.setItem('vagou_user_name', authenticatedUser.name);
        if (authenticatedUser.phone) localStorage.setItem('vagou_user_phone', authenticatedUser.phone);
        localStorage.setItem('vagou_user_email', authenticatedUser.email);
        localStorage.setItem('vagou_current_persona', 'cliente');
        localStorage.setItem('vagou_user_role', 'cliente');
      } catch {}

      onAuthenticated(authenticatedUser);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-4 duration-200 font-['Poppins']"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo com Identidade do Salão (White-Label Dinâmico) */}
        <div className="relative p-5 pb-4 bg-slate-50 border-b border-slate-200 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Logo do Salão */}
          {salonLogo ? (
            <img 
              src={salonLogo} 
              alt={salonName} 
              className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-slate-200 mb-2.5"
            />
          ) : (
            <div 
              style={{ backgroundColor: primaryColor }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm mb-2.5"
            >
              {salonName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <h3 className="text-sm font-black text-slate-900 leading-tight">
            {salonName}
          </h3>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            {tab === 'signup' 
              ? 'Seja bem-vindo(a)! Cadastre-se apenas uma vez e tenha agendamento rápido sempre que voltar.'
              : 'Bem-vindo(a) de volta! Acesse sua conta para confirmar.'}
          </p>

          {/* Abas Alternadoras: Cadastro vs Login */}
          <div className="grid grid-cols-2 gap-1 w-full bg-slate-200/70 p-1 rounded-lg mt-3">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setTab('signup');
                setErrorMessage('');
              }}
              className={`py-1.5 text-xs font-bold rounded-md transition ${
                tab === 'signup'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Primeira vez aqui
            </button>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setTab('login');
                setErrorMessage('');
              }}
              className={`py-1.5 text-xs font-bold rounded-md transition ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Já sou cliente
            </button>
          </div>
        </div>

        {/* Formulário Rolável */}
        <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-slate-800">
          {errorMessage && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium leading-snug flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {tab === 'signup' ? (
            /* Formulário de Cadastro Rápido do Salão */
            <form onSubmit={handleSignUp} className="space-y-3">
              {/* Card de Boas-Vindas & Cadastro Único */}
              <div className="p-2.5 rounded bg-emerald-50/90 border border-emerald-200/80 text-emerald-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-snug">
                  <strong>Cadastro único:</strong> Ao se cadastrar, seu acesso fica salvo neste aparelho. Nos próximos agendamentos, você confirma com 1 toque!
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Amanda Silva"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  WhatsApp com DDD
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(11) 98888-8888"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Seu E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="amanda@exemplo.com"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Crie uma Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    required
                    className="w-full pl-9 pr-9 py-2 rounded border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Botão de Envio com Fundo Verde e Texto Branco Estrito */}
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: primaryColor }}
                className="w-full mt-2 py-2.5 px-4 rounded font-bold text-xs text-white uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md hover:brightness-105 active:scale-[0.99] transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span className="text-white">Criando Perfil...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span className="text-white">Concluir & Agendar Horário</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Formulário de Login do Cliente */
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Seu E-mail Cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Digite seu e-mail"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Sua Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    required
                    className="w-full pl-9 pr-9 py-2 rounded border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-800 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                  >
                    {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Botão de Login com Fundo Verde e Texto Branco Estrito */}
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: primaryColor }}
                className="w-full mt-2 py-2.5 px-4 rounded font-bold text-xs text-white uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md hover:brightness-105 active:scale-[0.99] transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span className="text-white">Acessando...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 text-white" />
                    <span className="text-white">Entrar & Confirmar Horário</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Rodapé Discreto: Selo Tecnológico Sem Fricção */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Agendamento seguro • Tecnologia por Vagou</span>
          </div>
        </div>
      </div>
    </div>
  );
};
