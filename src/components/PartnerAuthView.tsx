import React, { useState } from 'react';
import { 
  Check, Eye, EyeOff, 
  AlertCircle, Loader2,
  Store, Sparkles, X, ArrowRight, ShieldCheck,
  Mail, MessageCircle, HelpCircle
} from 'lucide-react';
import { hapticSuccess, hapticLight, hapticMedium } from '../utils/haptics';
import { 
  signInWithSupabase, 
  supabase, 
  isSupabaseConfigured,
  syncSalonDataToSupabase,
  unifiedGlobalLogin
} from '../lib/supabase';
import { UnifiedRegisterEmbedModal } from './public/UnifiedRegisterEmbedModal';

export interface PartnerAuthSuccessData {
  salonName: string;
  slug: string;
  phoneWhatsapp?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  category?: string;
  customCategory?: string;
  primaryColor?: string;
  legalManagerName?: string;
  legalManagerCpf?: string;
  legalManagerEmail?: string;
  legalManagerPhone?: string;
}

interface PartnerAuthViewProps {
  onSuccess: (data?: PartnerAuthSuccessData, userRole?: 'pro' | 'cliente') => void;
}

export const PartnerAuthView: React.FC<PartnerAuthViewProps> = ({
  onSuccess,
}) => {
  // Estado das Credenciais de Acesso
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Modal para Novo Cadastro de Usuário (Dados Pessoais e Definição de Perfil)
  const [isClientRegisterModalOpen, setIsClientRegisterModalOpen] = useState(false);

  // Modal de Recuperação / Esquecimento de Senha
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [recoveryMessage, setRecoveryMessage] = useState('');

  // Modal para usuário autenticado sem salão vinculado (Opção 1)
  const [noSalonUser, setNoSalonUser] = useState<{ name: string; email: string; userObj?: any } | null>(null);
  const [isCreatingQuickSalon, setIsCreatingQuickSalon] = useState(false);

  // Logotipo do Estabelecimento (persistido e responsivo)
  const [salonLogo] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vagou_salon_logo') || 
                    localStorage.getItem('vagou_salon_logo_dark') || 
                    localStorage.getItem('vagou_salon_icon');
      if (saved) return saved;
      const settingsStr = localStorage.getItem('vagou_salon_admin_settings');
      if (settingsStr) {
        const s = JSON.parse(settingsStr);
        if (s.salonLogo || s.salonLogoDark || s.salonIcon) {
          return s.salonLogo || s.salonLogoDark || s.salonIcon;
        }
      }
    } catch {}
    return '';
  });

  const currentDisplaySalonName = (() => {
    try {
      const partnerDataStr = localStorage.getItem('vagou_partner_data');
      if (partnerDataStr) {
        const p = JSON.parse(partnerDataStr);
        if (p.salonName) return p.salonName;
      }
      const settingsStr = localStorage.getItem('vagou_salon_admin_settings');
      if (settingsStr) {
        const s = JSON.parse(settingsStr);
        if (s.salonName) return s.salonName;
      }
    } catch {}
    return 'Estabelecimento';
  })();

  // Autenticação Real Consultando o Banco Supabase Auth e Banco de Dados (Global Login)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    hapticLight();

    try {
      const activeSlug = localStorage.getItem('vagou_salon_slug') || undefined;
      const result = await unifiedGlobalLogin(loginUser, loginPassword, activeSlug);

      if (!result.success) {
        hapticMedium();
        setIsLoggingIn(false);
        setLoginError(result.errorMessage || 'Credenciais incorretas. Confira seu usuário e senha.');
        return;
      }

      hapticSuccess();
      const proName = result.userName || 'Administrador';
      const salonDisplayName = result.salonName || currentDisplaySalonName || 'Meu Negócio';
      const salonSlug = result.salonSlug || 'meu-negocio';

      localStorage.setItem('vagou_active_partner', result.userEmail || loginUser);
      localStorage.setItem('vagou_user_name', proName);
      localStorage.setItem('vagou_user_email', result.userEmail || loginUser);
      if (result.userPhone) {
        localStorage.setItem('vagou_user_phone', result.userPhone);
      }
      if (result.userAvatarUrl) {
        localStorage.setItem('vagou_user_avatar', result.userAvatarUrl);
      }
      localStorage.setItem('vagou_salon_name', salonDisplayName);
      localStorage.setItem('vagou_salon_slug', salonSlug);
      localStorage.setItem('vagou_dashboard_logged_pro_name', proName);

      const userProfileObj = {
        name: proName,
        email: result.userEmail || loginUser,
        phone: result.userPhone || '',
        address: result.salonData?.address || '',
      };
      localStorage.setItem('vagou_user_profile', JSON.stringify(userProfileObj));

      if (result.salonData) {
        localStorage.setItem('vagou_custom_salon_data', JSON.stringify(result.salonData));
      }

      setIsLoggingIn(false);
      onSuccess({ salonName: salonDisplayName, slug: salonSlug }, result.role);
    } catch (err: any) {
      hapticMedium();
      setIsLoggingIn(false);
      setLoginError(err?.message || 'Erro de conexão com o banco de dados. Tente novamente.');
    }
  };

  // Disparo de Recuperação de Senha por E-mail (Supabase Auth)
  const handleSendPasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = (recoveryEmail || loginUser).trim().toLowerCase();
    
    if (!targetEmail || !targetEmail.includes('@')) {
      setRecoveryStatus('error');
      setRecoveryMessage('Informe um endereço de e-mail válido.');
      hapticMedium();
      return;
    }

    setIsSendingRecovery(true);
    setRecoveryStatus('idle');
    hapticLight();

    try {
      if (isSupabaseConfigured && supabase) {
        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}` : '';
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: redirectUrl,
        });

        if (error) {
          throw error;
        }
      }

      hapticSuccess();
      setRecoveryStatus('success');
      setRecoveryMessage(`Instruções de redefinição enviadas para ${targetEmail}. Verifique sua caixa de entrada.`);
    } catch {
      hapticSuccess();
      setRecoveryStatus('success');
      setRecoveryMessage(`Solicitação registrada para ${targetEmail}. Caso o e-mail esteja cadastrado, você receberá o link de redefinição.`);
    } finally {
      setIsSendingRecovery(false);
    }
  };

  // Redirecionamento Direto para Recuperação via WhatsApp Oficial
  const handleOpenWhatsAppRecovery = () => {
    hapticLight();
    const phone = '5511999999999'; // Central oficial VagouApp
    const msg = encodeURIComponent(
      `Olá, Suporte VagouApp! Sou o gestor do estabelecimento "${currentDisplaySalonName}" e solicito a redefinição/recuperação do meu acesso administrativo.`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  // Opção 1 - Ação A: Criar Negócio Rápido para este Usuário
  const handleCreateQuickSalon = async () => {
    if (!noSalonUser) return;
    setIsCreatingQuickSalon(true);
    hapticLight();

    const userName = noSalonUser.name;
    const userEmail = noSalonUser.email;
    const generatedSalonName = `Espaço ${userName}`;
    const generatedSlug = `espaco-${userName.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      if (isSupabaseConfigured && supabase) {
        await syncSalonDataToSupabase({
          slug: generatedSlug,
          tradeName: generatedSalonName,
          email: userEmail,
          phoneWhatsapp: '(11) 99999-9999',
          address: 'São Paulo, SP',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          latitude: -23.55052,
          longitude: -46.633308,
          operatingModel: 'solo',
          primaryColor: '#20C933',
          ownerUserId: noSalonUser.userObj?.id,
        });
      }

      localStorage.setItem('vagou_active_partner', userEmail);
      localStorage.setItem('vagou_user_name', userName);
      localStorage.setItem('vagou_salon_name', generatedSalonName);
      localStorage.setItem('vagou_salon_slug', generatedSlug);

      hapticSuccess();
      setIsCreatingQuickSalon(false);
      setNoSalonUser(null);
      onSuccess({ salonName: generatedSalonName, slug: generatedSlug });
    } catch {
      setIsCreatingQuickSalon(false);
      setNoSalonUser(null);
      onSuccess({ salonName: generatedSalonName, slug: generatedSlug });
    }
  };

  // Opção 1 - Ação B: Continuar para o salão
  const handleContinueAsAdmin = () => {
    hapticLight();
    const adminName = noSalonUser?.name || 'Usuário';
    const adminEmail = noSalonUser?.email || '';

    if (adminEmail) localStorage.setItem('vagou_active_partner', adminEmail);
    if (adminName) localStorage.setItem('vagou_user_name', adminName);

    setNoSalonUser(null);
    onSuccess(undefined);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden bg-slate-50 text-slate-900 relative select-none">
      {/* Modal de Recuperação de Senha com Canto 4px e Sem Rolagem */}
      {isRecoveryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[4px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Cabeçalho Compacto */}
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#20C933]">
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">Recuperação de Senha</h3>
                  <p className="text-[9.5px] text-slate-500 font-medium">Acesso Administrativo</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsRecoveryModalOpen(false);
                  setRecoveryStatus('idle');
                  setRecoveryMessage('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-[4px] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 space-y-3">
              {recoveryStatus === 'success' ? (
                <div className="text-center space-y-2.5 py-1">
                  <div className="w-9 h-9 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                    {recoveryMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecoveryModalOpen(false);
                      setRecoveryStatus('idle');
                    }}
                    className="w-full py-2 px-3 rounded-[4px] bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
                  >
                    Voltar ao Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendPasswordRecovery} className="space-y-2.5">
                  <p className="text-[10.5px] text-slate-600">
                    Digite seu e-mail de gestor cadastrado para receber o link de redefinição:
                  </p>

                  <label className="block">
                    <span className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
                      E-mail Cadastrado
                    </span>
                    <div className="relative">
                      <input
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        required
                        className="w-full px-3 py-1.5 pl-8 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden transition shadow-2xs"
                      />
                      <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </label>

                  {recoveryStatus === 'error' && (
                    <div className="p-2 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] leading-tight flex items-center gap-1.5 animate-in fade-in duration-150">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>{recoveryMessage}</span>
                    </div>
                  )}

                  {/* Botão Enviar Link */}
                  <button
                    type="submit"
                    disabled={isSendingRecovery || !recoveryEmail}
                    className="w-full py-2 px-3 rounded-[4px] bg-[#00a033] hover:bg-[#00902e] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm disabled:opacity-50"
                  >
                    {isSendingRecovery ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span className="text-white">Enviando Link...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5 text-white" />
                        <span className="text-white">Enviar Link por E-mail</span>
                      </>
                    )}
                  </button>

                  {/* Divisor */}
                  <div className="relative py-0.5 flex items-center justify-center">
                    <div className="w-full border-t border-slate-200" />
                    <span className="absolute bg-white px-2 text-[9px] uppercase font-bold text-slate-400">
                      ou suporte direto
                    </span>
                  </div>

                  {/* Botão WhatsApp */}
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppRecovery}
                    className="w-full py-2 px-3 rounded-[4px] border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 active:scale-[0.99] text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-2xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Solicitar Suporte via WhatsApp</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Inteligente de Reconhecimento de Usuário Sem Salão com Canto 4px */}
      {noSalonUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[4px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Topo Compacto */}
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[#20C933]">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">Conta Reconhecida</h3>
                  <p className="text-[9.5px] text-slate-500 font-medium">{noSalonUser.email}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setNoSalonUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-[4px] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-4 space-y-3">
              <div className="text-center">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Olá, <strong className="text-slate-900">{noSalonUser.name}</strong>! Seu login foi validado com sucesso, mas você ainda não possui um negócio ou equipe vinculada a este perfil.
                </p>
                <p className="text-[10.5px] text-slate-500 mt-0.5">
                  Como deseja continuar?
                </p>
              </div>

              {/* Botão Primário: Criar Estabelecimento */}
              <button
                type="button"
                disabled={isCreatingQuickSalon}
                onClick={handleCreateQuickSalon}
                className="w-full py-2.5 px-3.5 rounded-[4px] bg-[#20C933] hover:bg-[#1db82e] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-between gap-2 cursor-pointer transition shadow-sm disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-white" />
                  <span className="text-white">Cadastrar Meu Negócio</span>
                </div>
                {isCreatingQuickSalon ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-white" />
                )}
              </button>

              {/* Botão Secundário: Continuar como Admin */}
              <button
                type="button"
                onClick={handleContinueAsAdmin}
                className="w-full py-2 px-3.5 rounded-[4px] border border-slate-300 hover:bg-slate-100 active:scale-[0.99] text-slate-800 font-bold text-xs flex items-center justify-between gap-2 cursor-pointer transition shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600" />
                  <span>Acessar como Admin</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho Superior: Exibido APENAS se houver logo cadastrado, sem limitação de caixa quadrada */}
      {salonLogo && salonLogo.trim() !== '' && (
        <header className="w-full bg-white border-b border-slate-200 shrink-0 flex items-center justify-center py-6 sm:py-2.5 px-4 max-h-[192px] sm:max-h-[96px]">
          <img 
            src={salonLogo} 
            alt={currentDisplaySalonName} 
            className="max-h-[60px] sm:max-h-[48px] max-w-[65%] h-auto w-auto object-contain block"
          />
        </header>
      )}

      {/* Conteúdo Principal: Entrada de Usuário / Cliente / Profissional */}
      <section className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center px-4 py-2 sm:py-4">
        <form onSubmit={handleLoginSubmit} className="w-full max-w-[270px] mx-auto space-y-2.5 animate-in fade-in duration-200">
          <label className="block">
            <span className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
              Usuário ou E-mail
            </span>
            <input
              type="text"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              placeholder="Digite seu usuário"
              required
              className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden transition shadow-2xs"
            />
          </label>

          <label className="block">
            <span className="block text-[10.5px] font-bold text-slate-700 mb-0.5">
              Senha
            </span>
            <div className="relative">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                className="w-full px-3 py-1.5 pr-9 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
              >
                {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </label>

          {/* Link Esqueci a Senha */}
          <div className="flex justify-end -mt-0.5">
            <button
              type="button"
              onClick={() => {
                setIsRecoveryModalOpen(true);
                setRecoveryEmail(loginUser);
              }}
              className="text-[10.5px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
            >
              Esqueceu a senha?
            </button>
          </div>

          {/* Botão Oficial com Fundo Verde e Texto Branco Estrito */}
          <button
            type="submit"
            disabled={isLoggingIn || !loginUser || !loginPassword}
            className="w-full mt-1 py-2 px-4 rounded-[4px] bg-[#00a033] hover:bg-[#00902e] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm disabled:opacity-50"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span className="text-white">Verificando no Banco...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                <span className="text-white">Acessar Painel</span>
              </>
            )}
          </button>

          {/* Feedback de erro */}
          {loginError && (
            <div className="p-2 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] leading-tight flex items-center gap-1.5 animate-in fade-in duration-150">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Link Discreto: Cadastre-se */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsClientRegisterModalOpen(true);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline transition-colors cursor-pointer select-none"
            >
              Cadastre-se
            </button>
          </div>
        </form>
      </section>

      {/* Modal Soberano Unificado de Cadastro (ADMVAPP) */}
      <UnifiedRegisterEmbedModal
        isOpen={isClientRegisterModalOpen}
        onClose={() => setIsClientRegisterModalOpen(false)}
        type="professional"
        slug={localStorage.getItem('vagou_salon_slug') || ''}
        onSuccess={(userData) => {
          setIsClientRegisterModalOpen(false);
          hapticSuccess();
          if (userData?.email) {
            setLoginUser(userData.email);
          }
        }}
      />

      {/* Rodapé Fullwidth com Tecnologia VagouApp e Ano 2026 */}
      <footer className="p-3 text-center border-t border-slate-200 bg-white text-slate-500 shrink-0">
        <p className="text-[10px] text-slate-500 font-medium">
          Tecnologia{' '}
          <a 
            href="https://vagou.app" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-bold text-[#20C933] hover:underline cursor-pointer"
          >
            VagouApp
          </a>
          {' '}• 2026
        </p>
      </footer>
    </div>
  );
};

export default PartnerAuthView;
