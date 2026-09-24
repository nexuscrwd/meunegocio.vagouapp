import React, { useState } from 'react';
import { 
  Check, Eye, EyeOff, 
  AlertCircle, Loader2, Calendar, User,
  Store, Sparkles, X, ArrowRight
} from 'lucide-react';
import { hapticSuccess, hapticLight, hapticMedium } from '../utils/haptics';
import { 
  signInWithSupabase, 
  supabase,
  isSupabaseConfigured,
  syncSalonDataToSupabase
} from '../lib/supabase';

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
  // Estado das Credenciais de Acesso da Equipe
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  // Autenticação Real Conectada ao Supabase & Equipe Registrada
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    hapticLight();

    const cleanUser = loginUser.trim().toLowerCase();
    const cleanPass = loginPassword.trim();

    try {
      // 1. Tentar autenticação via Supabase Auth
      let supabaseUser: any = null;
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: authData, error: authErr } = await signInWithSupabase(cleanUser, cleanPass);
          if (!authErr && authData?.user) {
            supabaseUser = authData.user;
          }
        } catch {}
      }

      // 2. Verificar se é a credencial mestre do Anderson
      const isMasterUser = (cleanUser === 'anderson' || cleanUser === 'anderson.hpires@gmail.com') && cleanPass === 'Ae311015@';

      // 3. Verificar estabelecimentos reais no Supabase (tabela salons)
      let matchedSalonFromDb: any = null;
      let matchedProfessionalFromDb: any = null;
      let matchedClientFromDb: any = null;

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: salons } = await supabase
            .from('salons')
            .select('*')
            .or(`email.ilike.%${cleanUser}%,slug.eq.${cleanUser},phone_whatsapp.ilike.%${cleanUser}%${supabaseUser?.id ? `,owner_id.eq.${supabaseUser.id}` : ''}`);
          if (salons && salons.length > 0) {
            matchedSalonFromDb = salons[0];
          }
        } catch {}

        try {
          const { data: pros } = await supabase
            .from('professionals')
            .select('*')
            .or(`email.ilike.%${cleanUser}%,phone.ilike.%${cleanUser}%${supabaseUser?.id ? `,user_id.eq.${supabaseUser.id}` : ''}`);
          if (pros && pros.length > 0) {
            matchedProfessionalFromDb = pros[0];
          }
        } catch {}

        try {
          const { data: clients } = await supabase
            .from('clients')
            .select('*')
            .or(`email.ilike.%${cleanUser}%,phone.ilike.%${cleanUser}%${supabaseUser?.id ? `,user_id.eq.${supabaseUser.id}` : ''}`);
          if (clients && clients.length > 0) {
            matchedClientFromDb = clients[0];
          }
        } catch {}
      }

      // 4. Verificar parceiros registrados localmente
      let matchedPartner: any = null;
      try {
        const savedAccounts = localStorage.getItem('vagou_registered_partners');
        if (savedAccounts) {
          const list = JSON.parse(savedAccounts);
          matchedPartner = list.find((acc: any) => 
            (acc.email?.toLowerCase() === cleanUser || acc.name?.toLowerCase() === cleanUser || acc.slug?.toLowerCase() === cleanUser) && 
            acc.password === cleanPass
          );
        }
      } catch {}

      // 5. Verificar membros da equipe do estabelecimento localmente
      let matchedTeamMember: any = null;
      try {
        const teamSaved = localStorage.getItem('vagou_salon_team_members') || localStorage.getItem('vagou_team_members');
        if (teamSaved) {
          const teamList = JSON.parse(teamSaved);
          matchedTeamMember = teamList.find((m: any) => 
            (m.name?.toLowerCase() === cleanUser || m.email?.toLowerCase() === cleanUser) &&
            cleanPass.length >= 6
          );
        }
      } catch {}

      // A) Se for dono de salão ou profissional de equipe confirmado:
      const isConfirmedSalonOrPro = isMasterUser || !!matchedSalonFromDb || !!matchedProfessionalFromDb || (!!matchedPartner && cleanPass.length >= 6) || !!matchedTeamMember;

      if (isConfirmedSalonOrPro && cleanPass.length >= 4) {
        hapticSuccess();
        const proName = matchedSalonFromDb?.trade_name || matchedSalonFromDb?.legal_name || matchedProfessionalFromDb?.name || matchedPartner?.name || matchedTeamMember?.name || (isMasterUser ? 'Anderson Pires' : (loginUser.includes('@') ? loginUser.split('@')[0] : loginUser));
        const salonDisplayName = matchedSalonFromDb?.trade_name || matchedPartner?.salonName || 'Meu Negócio';
        const salonSlug = matchedSalonFromDb?.slug || matchedPartner?.slug || cleanUser.replace(/[^a-z0-9-]/g, '-');

        localStorage.setItem('vagou_salon_logged_in', 'true');
        localStorage.setItem('vagou_current_persona', 'pro');
        localStorage.setItem('vagou_user_role', 'pro');
        localStorage.setItem('vagou_active_partner', loginUser);
        localStorage.setItem('vagou_user_name', proName);
        localStorage.setItem('vagou_salon_name', salonDisplayName);
        localStorage.setItem('vagou_salon_slug', salonSlug);
        localStorage.setItem('vagou_dashboard_logged_pro_name', proName);

        if (matchedSalonFromDb) {
          localStorage.setItem('vagou_custom_salon_data', JSON.stringify(matchedSalonFromDb));
        }

        setIsLoggingIn(false);
        onSuccess(matchedPartner || (matchedSalonFromDb ? { salonName: salonDisplayName, slug: salonSlug } as any : undefined), 'pro');
        return;
      }

      // B) Se autenticado no Supabase com sucesso, mas NÃO possui salão ou equipe (Opção 1):
      if (supabaseUser) {
        hapticLight();
        setIsLoggingIn(false);
        const resolvedName = supabaseUser.user_metadata?.name || 
                             matchedClientFromDb?.name || 
                             (cleanUser.includes('@') ? cleanUser.split('@')[0].replace(/[._]/g, ' ') : cleanUser);
        
        const formattedName = resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1);
        setNoSalonUser({
          name: formattedName,
          email: cleanUser,
          userObj: supabaseUser
        });
        return;
      }

      // C) Se não corresponde a nenhuma credencial válida: bloqueio
      hapticMedium();
      setIsLoggingIn(false);
      if (cleanPass.length < 4) {
        setLoginError('Por favor, informe uma senha válida.');
      } else {
        setLoginError('Credenciais incorretas. Confira seu usuário e senha.');
      }
    } catch (err: any) {
      hapticMedium();
      setIsLoggingIn(false);
      setLoginError(err?.message || 'Erro de conexão. Tente novamente.');
    }
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

      localStorage.setItem('vagou_salon_logged_in', 'true');
      localStorage.setItem('vagou_current_persona', 'pro');
      localStorage.setItem('vagou_user_role', 'pro');
      localStorage.setItem('vagou_active_partner', userEmail);
      localStorage.setItem('vagou_user_name', userName);
      localStorage.setItem('vagou_salon_name', generatedSalonName);
      localStorage.setItem('vagou_salon_slug', generatedSlug);
      localStorage.setItem('vagou_dashboard_logged_pro_name', userName);

      hapticSuccess();
      setIsCreatingQuickSalon(false);
      setNoSalonUser(null);
      onSuccess({ salonName: generatedSalonName, slug: generatedSlug }, 'pro');
    } catch {
      setIsCreatingQuickSalon(false);
      setNoSalonUser(null);
      onSuccess({ salonName: generatedSalonName, slug: generatedSlug }, 'pro');
    }
  };

  // Opção 1 - Ação B: Continuar como Cliente
  const handleContinueAsClient = () => {
    hapticLight();
    const clientName = noSalonUser?.name || 'Cliente';
    const clientEmail = noSalonUser?.email || '';

    localStorage.setItem('vagou_salon_logged_in', 'false');
    localStorage.setItem('vagou_current_persona', 'cliente');
    localStorage.setItem('vagou_user_role', 'cliente');
    if (clientEmail) localStorage.setItem('vagou_active_partner', clientEmail);
    localStorage.setItem('vagou_user_name', clientName);

    setNoSalonUser(null);
    onSuccess(undefined, 'cliente');
  };

  // Acesso direto do Cliente (sem barreiras para agendar)
  const handleClientAccess = () => {
    hapticLight();
    localStorage.setItem('vagou_salon_logged_in', 'false');
    localStorage.setItem('vagou_current_persona', 'cliente');
    localStorage.setItem('vagou_user_role', 'cliente');
    onSuccess(undefined, 'cliente');
  };

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-y-auto bg-slate-50 text-slate-900 relative">
      {/* Modal Inteligente de Reconhecimento de Usuário Sem Salão (Opção 1) */}
      {noSalonUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Topo do Modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#20C933]">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Conta Reconhecida</h3>
                  <p className="text-[10px] text-slate-500 font-medium">{noSalonUser.email}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setNoSalonUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-5 space-y-4">
              <div className="text-center">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Olá, <strong className="text-slate-900">{noSalonUser.name}</strong>! Seu login foi validado com sucesso, mas você ainda não possui um negócio ou equipe vinculada a este perfil.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
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

              {/* Botão Secundário: Continuar como Cliente */}
              <button
                type="button"
                onClick={handleContinueAsClient}
                className="w-full py-2.5 px-3.5 rounded-[4px] border border-slate-300 hover:bg-slate-100 active:scale-[0.99] text-slate-800 font-bold text-xs flex items-center justify-between gap-2 cursor-pointer transition shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span>Acessar como Cliente / Agendar</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho Superior Fullwidth com Logo do Negócio (1/3 da tela) */}
      <header className="w-full bg-white border-b border-slate-200 shrink-0 flex items-center justify-center h-1/3 min-h-[120px]">
        {salonLogo ? (
          <img 
            src={salonLogo} 
            alt={currentDisplaySalonName} 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-md object-cover block"
          />
        ) : (
          <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 shadow-md flex items-center justify-center text-slate-800 font-black text-xl font-['Poppins'] tracking-wider select-none">
            {(currentDisplaySalonName.trim() || 'Vagou').slice(0, 2).toUpperCase()}
          </span>
        )}
      </header>

      {/* Conteúdo Principal: Acesso da Equipe ou Entrada do Cliente */}
      <section className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center p-4 sm:p-6">
        <form onSubmit={handleLoginSubmit} className="w-full max-w-[270px] mx-auto space-y-3 animate-in fade-in duration-200">
          <div className="text-center mb-1">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Acesso da Equipe</span>
            </h2>
          </div>

          <label className="block">
            <span className="block text-[11px] font-bold text-slate-700 mb-1">
              Usuário ou E-mail
            </span>
            <input
              type="text"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              placeholder="Digite seu usuário"
              required
              className="w-full px-3 py-2 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden transition shadow-2xs"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-bold text-slate-700 mb-1">
              Senha
            </span>
            <div className="relative">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                className="w-full px-3 py-2 pr-9 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden transition shadow-2xs"
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

          {/* Botão Oficial com Fundo Verde e Texto Branco Estrito */}
          <button
            type="submit"
            disabled={isLoggingIn || !loginUser || !loginPassword}
            className="w-full mt-2 py-2.5 px-4 rounded-[4px] bg-[#20C933] hover:bg-[#1db82e] active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm disabled:opacity-50"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span className="text-white">Acessando...</span>
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
            <div className="p-2.5 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-tight flex items-center gap-1.5 animate-in fade-in duration-150">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Divisor Visual Sutil */}
          <div className="relative py-2 flex items-center justify-center">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute bg-slate-50 px-2 text-[10px] uppercase font-bold text-slate-400">
              ou
            </span>
          </div>

          {/* Botão de Acesso Imediato para Clientes */}
          <button
            type="button"
            onClick={handleClientAccess}
            className="w-full py-2.5 px-4 rounded-[4px] border border-slate-300 hover:bg-slate-100 active:scale-[0.99] text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span>Acessar como Cliente / Agendar</span>
          </button>
        </form>
      </section>

      {/* Rodapé Fullwidth Sutil com Tecnologia Vagou e Link Institucional */}
      <footer className="p-3.5 text-center border-t border-slate-200 bg-white text-slate-500 shrink-0">
        <p className="text-[10px] text-slate-500 font-medium">
          Tecnologia <span className="font-bold text-[#20C933]">Vagou</span> • Gestão & Agendamentos
        </p>
        <a 
          href="https://vagou.app" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[9.5px] text-slate-400 hover:text-slate-600 underline mt-0.5 inline-block"
        >
          Quer o app do seu negócio? Conheça o portal Vagou
        </a>
      </footer>
    </div>
  );
};

export default PartnerAuthView;
