import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  checkUserSalonMembership,
  ensureClientRow,
} from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticSuccess } from '../utils/haptics';

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
  salonSlug?: string;
  salonLogo?: string;
  salonLogoLight?: string;
  salonLogoDark?: string;
  primaryColor?: string;
  secondaryColor?: string;
  themeMode?: 'light' | 'dark';
  initialMode?: 'login' | 'register';
  onAuthenticated: (user: SalonClientAuthUser, role?: 'pro' | 'cliente') => void;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(clean.charAt(10), 10);
}

function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Busca registros em public.clients que correspondam ao identificador informado
 * (username como 'Momy@', 'fabio#', 'Samira Soraia', e-mail, nome completo, CPF ou telefone)
 */
async function findMatchingClients(rawInput: string): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const cleanLower = trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, '');
  const resultsMap = new Map<string, any>();

  const addRows = (rows: any[] | null | undefined) => {
    if (!Array.isArray(rows)) return;
    for (const r of rows) {
      if (r && r.id && !resultsMap.has(String(r.id))) {
        resultsMap.set(String(r.id), r);
      }
    }
  };

  try {
    // 1. Busca direta por username (suporta Momy@, Luiza@, fabio#, Maria&, Samira Soraia)
    const { data: byUsername } = await (supabase.from('clients') as any)
      .select('*')
      .ilike('username', trimmed)
      .limit(10);
    addRows(byUsername);

    // 2. Busca direta por e-mail caso tenha formato de e-mail
    if (isValidEmailAddress(trimmed)) {
      const { data: byEmail } = await (supabase.from('clients') as any)
        .select('*')
        .ilike('email', trimmed)
        .limit(10);
      addRows(byEmail);
    }

    // 3. Busca direta por nome completo
    const { data: byName } = await (supabase.from('clients') as any)
      .select('*')
      .ilike('name', trimmed)
      .limit(10);
    addRows(byName);

    // 4. Varredura em memória resiliente (imune a caracteres especiais @, #, & ou espaços no banco)
    if (resultsMap.size === 0 || digits.length >= 8) {
      const { data: pool } = await (supabase.from('clients') as any)
        .select('*')
        .limit(300);

      if (Array.isArray(pool)) {
        for (const c of pool) {
          const cUser = String(c.username || '').trim().toLowerCase();
          const cEmail = String(c.email || '').trim().toLowerCase();
          const cName = String(c.name || '').trim().toLowerCase();
          const cPhone = String(c.phone || '').replace(/\D/g, '');
          const cCpf = String(c.cpf || '').replace(/\D/g, '');

          const matchesText =
            (cUser && cUser === cleanLower) ||
            (cEmail && cEmail === cleanLower) ||
            (cName && cName === cleanLower);

          const matchesDigits =
            digits.length >= 8 &&
            ((cCpf && cCpf === digits) ||
              (cPhone && (cPhone === digits || cPhone.endsWith(digits) || digits.endsWith(cPhone))));

          if (matchesText || matchesDigits) {
            resultsMap.set(String(c.id), c);
          }
        }
      }
    }
  } catch {}

  return Array.from(resultsMap.values());
}

/**
 * Resolve um identificador (E-mail, Telefone, CPF ou Usuário) para o e-mail cadastrado no Supabase
 */
async function resolveIdentifierToEmail(rawInput: string): Promise<{
  email: string | null;
  matchedClients: any[];
  error?: string;
}> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { email: null, matchedClients: [], error: 'Informe seu usuário, e-mail ou telefone.' };
  }

  const matchedClients = await findMatchingClients(trimmed);
  const clientWithEmail = matchedClients.find(
    (c: any) => c.email && isValidEmailAddress(String(c.email))
  );
  if (clientWithEmail?.email) {
    return {
      email: String(clientWithEmail.email).trim().toLowerCase(),
      matchedClients,
    };
  }

  // Só considera o próprio input como e-mail se tiver formato válido (nome@dominio.ext)
  if (isValidEmailAddress(trimmed)) {
    return { email: trimmed.toLowerCase(), matchedClients };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { email: null, matchedClients, error: 'Informe seu usuário ou endereço de e-mail para entrar.' };
  }

  const digits = trimmed.replace(/\D/g, '');
  const cleanLower = trimmed.toLowerCase();

  try {
    // 1. Se possui dígitos de telefone ou CPF (8 a 14 dígitos), buscar em salons e professionals
    if (digits.length >= 8) {
      const { data: salonsData } = await (supabase.from('salons') as any)
        .select('email, phone_whatsapp, owner_cpf, document_number, branding')
        .limit(50);

      if (Array.isArray(salonsData)) {
        const matchedSalon = salonsData.find((s: any) => {
          const sPhone = String(s.phone_whatsapp || '').replace(/\D/g, '');
          const sCpf = String(s.owner_cpf || s.branding?.ownerCpf || '').replace(/\D/g, '');
          const sDoc = String(s.document_number || '').replace(/\D/g, '');
          return (
            (sCpf && sCpf === digits) ||
            (sDoc && sDoc === digits) ||
            (sPhone && (sPhone === digits || sPhone.endsWith(digits) || digits.endsWith(sPhone)))
          );
        });
        const salonEmail =
          matchedSalon?.email ||
          matchedSalon?.branding?.ownerEmail ||
          matchedSalon?.branding?.email;
        if (salonEmail && isValidEmailAddress(String(salonEmail))) {
          return { email: String(salonEmail).trim().toLowerCase(), matchedClients };
        }
      }

      const { data: prosData } = await (supabase.from('professionals') as any)
        .select('email, phone')
        .not('email', 'is', null)
        .limit(50);

      if (Array.isArray(prosData)) {
        const matchedPro = prosData.find((p: any) => {
          const pPhone = String(p.phone || '').replace(/\D/g, '');
          return pPhone && (pPhone === digits || pPhone.endsWith(digits) || digits.endsWith(pPhone));
        });
        if (matchedPro?.email && isValidEmailAddress(String(matchedPro.email))) {
          return { email: String(matchedPro.email).trim().toLowerCase(), matchedClients };
        }
      }
    }

    // 2. Busca por slug em salons
    const { data: salonBySlug } = await (supabase.from('salons') as any)
      .select('email, branding')
      .eq('slug', cleanLower)
      .maybeSingle();

    const slugEmail = salonBySlug?.email || salonBySlug?.branding?.ownerEmail;
    if (slugEmail && isValidEmailAddress(String(slugEmail))) {
      return { email: String(slugEmail).trim().toLowerCase(), matchedClients };
    }
  } catch {}

  return {
    email: null,
    matchedClients,
    error: 'Conta não localizada com este identificador. Verifique seu usuário ou e-mail.',
  };
}

export const SalonClientAuthModal: React.FC<SalonClientAuthModalProps> = ({
  isOpen,
  onClose,
  salonName,
  salonSlug,
  salonLogo,
  salonLogoLight,
  salonLogoDark,
  primaryColor,
  themeMode,
  initialMode = 'login',
  onAuthenticated,
}) => {
  const { theme } = useTheme();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Campos de Cadastro
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resolvedTheme: 'light' | 'dark' = themeMode || theme || 'dark';
  const isDark = resolvedTheme === 'dark';

  const resolvedPrimaryColor =
    primaryColor ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_accent_color') : null) ||
    '#20C933';

  // Resolução estrita do Logo do Salão (nunca usa logo da Vagou)
  const rawLogo = (
    salonLogo ||
    (isDark ? salonLogoDark : salonLogoLight) ||
    salonLogoDark ||
    salonLogoLight ||
    ''
  ).trim();

  // Considera que há logo apenas se existir URL/DataURI válida e não for ícone genérico vazio
  const hasSalonLogo = Boolean(rawLogo.length > 0);

  const currentSlug =
    salonSlug ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode]);

  // Fechar com tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const finalizeAuthentication = async (
    userId: string,
    emailOrUsername: string,
    fallbackName?: string,
    fallbackPhone?: string,
    fallbackCpf?: string,
    userMeta?: Record<string, any>,
    existingClientRow?: any
  ) => {
    let client = existingClientRow || null;

    if (!client) {
      const ensured = await ensureClientRow(
        userId,
        isValidEmailAddress(emailOrUsername) ? emailOrUsername : null,
        {
          full_name: fallbackName || userMeta?.full_name || userMeta?.name,
          phone: fallbackPhone || userMeta?.phone,
          cpf: fallbackCpf || userMeta?.cpf,
          username: userMeta?.username || (!isValidEmailAddress(emailOrUsername) ? emailOrUsername : undefined),
          password_hash: userMeta?.password_hash,
        }
      );
      client = ensured.client;
    }

    const effectiveUserId = String(userId || client?.user_id || client?.id || '').trim();
    const cleanCpf = (fallbackCpf || client?.cpf || userMeta?.cpf || '').replace(/\D/g, '');
    const effectiveIdentity = (client?.email || emailOrUsername || client?.username || '').trim();

    // Verifica vínculo com o salão atual (Dono, Gerente, Profissional ou Cliente)
    const membership = await checkUserSalonMembership(
      effectiveUserId,
      currentSlug,
      effectiveIdentity,
      cleanCpf
    );

    const resolvedName =
      fallbackName ||
      client?.name ||
      client?.username ||
      userMeta?.full_name ||
      userMeta?.name ||
      (effectiveIdentity ? effectiveIdentity.split('@')[0] : 'Usuário');

    const resolvedPhone =
      fallbackPhone || client?.phone || userMeta?.phone || '';

    const resolvedAvatar =
      client?.avatar_url || userMeta?.avatar_url || '';

    try {
      if (effectiveUserId) localStorage.setItem('vagou_auth_user_id', effectiveUserId);
      if (client?.id) localStorage.setItem('vagou_client_id', String(client.id));
      if (resolvedName) localStorage.setItem('vagou_user_name', resolvedName);
      if (effectiveIdentity) {
        localStorage.setItem('vagou_user_email', effectiveIdentity);
        localStorage.setItem('vagou_active_partner', effectiveIdentity);
      }
      if (cleanCpf) localStorage.setItem('vagou_user_cpf', cleanCpf);
      if (resolvedPhone) localStorage.setItem('vagou_user_phone', resolvedPhone);
      if (resolvedAvatar && !resolvedAvatar.includes('unsplash.com')) {
        localStorage.setItem('vagou_user_avatar', resolvedAvatar);
      }
      localStorage.setItem(
        'vagou_client_session',
        JSON.stringify({
          id: effectiveUserId || client?.id,
          clientId: client?.id || effectiveUserId,
          name: resolvedName,
          email: effectiveIdentity,
          username: client?.username || effectiveIdentity,
          phone: resolvedPhone,
          cpf: cleanCpf,
        })
      );
    } catch {}

    const mappedRole: 'pro' | 'cliente' = membership.isMember ? 'pro' : 'cliente';

    window.dispatchEvent(
      new CustomEvent('vagou:auth-updated', {
        detail: {
          userId: effectiveUserId,
          email: effectiveIdentity,
          cpf: cleanCpf,
          name: resolvedName,
          accountType: membership.role,
        },
      })
    );

    hapticSuccess();
    onAuthenticated(
      {
        id: effectiveUserId,
        name: resolvedName,
        phone: resolvedPhone,
        email: effectiveIdentity,
      },
      mappedRole
    );
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanIdentifier = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanIdentifier || !cleanPass) {
      setErrorMsg('Preencha seu usuário/e-mail e sua senha de acesso.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Serviço de autenticação indisponível no momento.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resolved = await resolveIdentifierToEmail(cleanIdentifier);

      // 1. Verifica autenticação direta na tabela public.clients (username / email / phone / cpf + password_hash)
      if (resolved.matchedClients.length > 0) {
        const matchedByHash = resolved.matchedClients.find(
          (c: any) =>
            c.password_hash !== null &&
            c.password_hash !== undefined &&
            String(c.password_hash).trim() === cleanPass
        );

        if (matchedByHash) {
          let authUser: any = null;
          const candidateEmail = matchedByHash.email || resolved.email;
          if (candidateEmail && isValidEmailAddress(String(candidateEmail))) {
            try {
              const { data: authData } = await supabase.auth.signInWithPassword({
                email: String(candidateEmail).trim().toLowerCase(),
                password: cleanPass,
              });
              if (authData?.user) {
                authUser = authData.user;
              }
            } catch {}
          }

          const finalUserId = String(authUser?.id || matchedByHash.user_id || matchedByHash.id);
          const finalIdentity = String(
            authUser?.email || matchedByHash.email || matchedByHash.username || cleanIdentifier
          ).trim();

          await finalizeAuthentication(
            finalUserId,
            finalIdentity,
            matchedByHash.name || matchedByHash.username || cleanIdentifier,
            matchedByHash.phone || '',
            matchedByHash.cpf || '',
            authUser?.user_metadata,
            matchedByHash
          );
          return;
        }
      }

      // 2. Caso não tenha autenticado via password_hash em public.clients, tenta via Supabase Auth
      if (!resolved.email) {
        // Se encontrou o usuário em public.clients mas a senha não conferiu com password_hash
        if (resolved.matchedClients.length > 0) {
          setErrorMsg('Credenciais inválidas. Verifique seu usuário e senha.');
        } else {
          setErrorMsg(resolved.error || 'Conta não localizada. Verifique seu usuário, e-mail ou telefone.');
        }
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolved.email,
        password: cleanPass,
      });

      if (error || !data?.user) {
        const rawMsg = error?.message || '';
        if (rawMsg.includes('Invalid login credentials')) {
          setErrorMsg('Credenciais inválidas. Verifique seu e-mail/usuário e senha.');
        } else if (rawMsg.includes('Email not confirmed')) {
          setErrorMsg('E-mail pendente de confirmação. Verifique sua caixa de entrada.');
        } else {
          setErrorMsg(rawMsg || 'Não foi possível autenticar. Verifique seus dados.');
        }
        setIsSubmitting(false);
        return;
      }

      const matchedClientRow = resolved.matchedClients[0] || undefined;
      await finalizeAuthentication(
        data.user.id,
        data.user.email || resolved.email,
        matchedClientRow?.name,
        matchedClientRow?.phone,
        matchedClientRow?.cpf,
        data.user.user_metadata,
        matchedClientRow
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = fullName.trim();
    const cleanInput = identifier.trim();
    const cleanPhone = phone.trim();
    const cleanCpfDigits = cpf.replace(/\D/g, '');
    const cleanPass = password.trim();

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Informe seu nome completo.');
      return;
    }
    if (!cleanInput || cleanInput.length < 3) {
      setErrorMsg('Informe um e-mail ou nome de usuário válido.');
      return;
    }
    if (cleanPhone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Informe um WhatsApp/telefone válido com DDD.');
      return;
    }
    if (cleanCpfDigits.length > 0 && !isValidCPF(cleanCpfDigits)) {
      setErrorMsg('O CPF informado é inválido.');
      return;
    }
    if (cleanPass.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Serviço de autenticação indisponível no momento.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEmail = isValidEmailAddress(cleanInput);
      const authEmail = isEmail
        ? cleanInput.toLowerCase()
        : `${cleanInput.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}.${Date.now()}@vagouapp.com`;

      const metadata: Record<string, any> = {
        full_name: cleanName,
        name: cleanName,
        phone: cleanPhone,
        username: cleanInput,
        password_hash: cleanPass,
        ...(cleanCpfDigits ? { cpf: cleanCpfDigits } : {}),
      };

      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: cleanPass,
        options: {
          data: metadata,
        },
      });

      if (error && isEmail) {
        if (error.message?.includes('already registered')) {
          setErrorMsg('Este e-mail já possui conta. Faça login com sua senha.');
        } else {
          setErrorMsg(error.message || 'Erro ao criar conta.');
        }
        setIsSubmitting(false);
        return;
      }

      if (data?.user) {
        await finalizeAuthentication(
          data.user.id,
          isEmail ? authEmail : cleanInput,
          cleanName,
          cleanPhone,
          cleanCpfDigits,
          metadata
        );
      } else {
        setSuccessMsg('Conta criada com sucesso! Faça login abaixo.');
        setMode('login');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível concluir o cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Informe seu usuário ou e-mail cadastrado para recuperar a senha.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Serviço indisponível no momento.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resolved = await resolveIdentifierToEmail(identifier);
      if (!resolved.email) {
        setErrorMsg(resolved.error || 'Informe um e-mail válido.');
        setIsSubmitting(false);
        return;
      }

      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(resolved.email, {
        redirectTo,
      });

      if (error) {
        setErrorMsg(error.message || 'Não foi possível enviar o e-mail de recuperação.');
      } else {
        setSuccessMsg(`Enviamos as instruções de recuperação para ${resolved.email}.`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao solicitar recuperação de senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBaseClass = `w-full pl-10 pr-4 py-3 text-xs rounded-[4px] border outline-none transition font-['Poppins'] ${
    isDark
      ? 'bg-[#0D131F] border-slate-800 text-white placeholder:text-slate-500 focus:border-slate-600'
      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-slate-400'
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200 font-['Poppins']"
      onClick={onClose}
    >
      {/* Modal Nativo Camaleão (Layout Plano, Zero Box-in-Box, Raio 4px) */}
      <div
        className={`relative w-full max-w-[400px] rounded-[4px] border p-6 sm:p-7 shadow-2xl my-auto animate-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-[#090D16] border-slate-800/80 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar (X) no canto superior direito */}
        <button
          type="button"
          onClick={() => {
            hapticLight();
            onClose();
          }}
          className={`absolute top-4 right-4 p-1.5 rounded-[4px] transition cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* REGRA CAMALEÃO DO CABEÇALHO:
            - Se o salão possui logo próprio (hasSalonLogo): Exibe o logo do salão e o cabeçalho.
            - Se NÃO possui logo (!hasSalonLogo): Oculta logo e cabeçalho completamente. */}
        {hasSalonLogo && (
          <div
            className={`flex flex-col items-center text-center pb-5 mb-5 border-b ${
              isDark ? 'border-slate-800/80' : 'border-slate-200'
            }`}
          >
            <img
              src={rawLogo}
              alt={salonName}
              className="max-h-12 max-w-[180px] w-auto object-contain mb-2.5"
            />
            <h2
              className={`text-sm font-extrabold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {mode === 'login'
                ? 'Acessar Meu Estabelecimento'
                : mode === 'register'
                ? 'Criar Conta de Acesso'
                : 'Recuperar Senha de Acesso'}
            </h2>
          </div>
        )}

        {/* Alertas de Erro ou Sucesso */}
        {errorMsg && (
          <div
            className={`mb-4 px-3 py-2.5 rounded-[4px] border flex items-center gap-2 text-[11px] font-medium ${
              isDark
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            className={`mb-4 px-3 py-2.5 rounded-[4px] border flex items-center gap-2 text-[11px] font-medium ${
              isDark
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODO 1: LOGIN (Idêntico ao modelo solicitado) */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className={`space-y-4 ${!hasSalonLogo ? 'pt-3' : ''}`}>
            <div className="space-y-1.5">
              <label
                className={`block text-[11px] font-bold ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                Usuário, E-mail ou Telefone{' '}
                <span style={{ color: resolvedPrimaryColor }}>*</span>
              </label>
              <div className="relative">
                <User
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Usuário, E-mail ou Telefone"
                  autoComplete="username"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className={`block text-[11px] font-bold ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  Senha de Acesso{' '}
                  <span style={{ color: resolvedPrimaryColor }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMode('forgot');
                  }}
                  style={{ color: resolvedPrimaryColor }}
                  className="text-[11px] font-bold hover:underline cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className={`${inputBaseClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-[4px] transition cursor-pointer ${
                    isDark
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                  tabIndex={-1}
                  aria-label="Alternar visibilidade da senha"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Botão Principal na Cor do Salão com Texto e Ícone 100% Brancos */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: resolvedPrimaryColor }}
                className="w-full py-3.5 px-4 rounded-[4px] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition hover:brightness-110 active:scale-[0.99] cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span className="text-white">Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span className="text-white">Entrar no App do Salão</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>

            {/* Rodapé para Cadastro */}
            <div
              className={`pt-4 mt-4 border-t text-center text-[11px] ${
                isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
              }`}
            >
              <span>Ainda não possui conta? </span>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setMode('register');
                }}
                style={{ color: resolvedPrimaryColor }}
                className="font-bold hover:underline cursor-pointer"
              >
                Cadastrar agora
              </button>
            </div>
          </form>
        )}

        {/* MODO 2: CADASTRO NATIVO */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className={`space-y-3.5 ${!hasSalonLogo ? 'pt-3' : ''}`}>
            <div className="space-y-1">
              <label
                className={`block text-[11px] font-bold ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                Nome Completo <span style={{ color: resolvedPrimaryColor }}>*</span>
              </label>
              <div className="relative">
                <User
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome e sobrenome"
                  autoComplete="name"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                className={`block text-[11px] font-bold ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                E-mail <span style={{ color: resolvedPrimaryColor }}>*</span>
              </label>
              <div className="relative">
                <Mail
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                />
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  className={`block text-[11px] font-bold ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  WhatsApp <span style={{ color: resolvedPrimaryColor }}>*</span>
                </label>
                <div className="relative">
                  <Phone
                    className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                    placeholder="(11) 99999-9999"
                    autoComplete="tel"
                    className={inputBaseClass}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  className={`block text-[11px] font-bold ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  CPF (Opcional)
                </label>
                <div className="relative">
                  <FileText
                    className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={inputBaseClass}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label
                className={`block text-[11px] font-bold ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                Criar Senha <span style={{ color: resolvedPrimaryColor }}>*</span>
              </label>
              <div className="relative">
                <Lock
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete="new-password"
                  className={`${inputBaseClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-[4px] transition cursor-pointer ${
                    isDark
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: resolvedPrimaryColor }}
                className="w-full py-3.5 px-4 rounded-[4px] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition hover:brightness-110 active:scale-[0.99] cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span className="text-white">Criando conta...</span>
                  </>
                ) : (
                  <>
                    <span className="text-white">Cadastrar e Entrar</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>

            <div
              className={`pt-3.5 mt-3 border-t text-center text-[11px] ${
                isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
              }`}
            >
              <span>Já possui uma conta? </span>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setMode('login');
                }}
                style={{ color: resolvedPrimaryColor }}
                className="font-bold hover:underline cursor-pointer"
              >
                Fazer login
              </button>
            </div>
          </form>
        )}

        {/* MODO 3: RECUPERAR SENHA */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className={`space-y-4 ${!hasSalonLogo ? 'pt-3' : ''}`}>
            <div className="space-y-1.5">
              <label
                className={`block text-[11px] font-bold ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                Usuário, E-mail ou Telefone{' '}
                <span style={{ color: resolvedPrimaryColor }}>*</span>
              </label>
              <div className="relative">
                <Mail
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}
                />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Digite seu e-mail ou telefone"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: resolvedPrimaryColor }}
                className="w-full py-3.5 px-4 rounded-[4px] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition hover:brightness-110 active:scale-[0.99] cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span className="text-white">Enviando...</span>
                  </>
                ) : (
                  <>
                    <span className="text-white">Recuperar Senha</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>

            <div
              className={`pt-4 mt-4 border-t text-center text-[11px] ${
                isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setMode('login');
                }}
                style={{ color: resolvedPrimaryColor }}
                className="inline-flex items-center gap-1.5 font-bold hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para o login</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
