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
  signInWithGoogle,
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
 * Busca registros em todo o Ecossistema da Tríade (system_admins, clients, salon_users, professionals)
 * que correspondam ao identificador informado (username como 'Anderson@', 'Elisa@', 'Luiza@', 'Momy@',
 * 'fabio#', 'Samira Soraia', e-mail, nome completo, CPF ou telefone).
 */
async function findMatchingClients(rawInput: string): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const cleanLower = trimmed.toLowerCase();
  const cleanNoSymbols = cleanLower.replace(/^[@#&]+|[@#&]+$/g, '');
  const digits = trimmed.replace(/\D/g, '');
  const results: any[] = [];
  const seenKeys = new Set<string>();

  const matchesRecord = (r: any, table: 'system_admins' | 'clients' | 'salon_users' | 'professionals'): boolean => {
    if (!r) return false;
    if (r.is_active === false) return false;

    const rUser = String(r.username || '').trim().toLowerCase();
    const rUserNoSymbols = rUser.replace(/^[@#&]+|[@#&]+$/g, '');
    const rEmail = String(r.email || '').trim().toLowerCase();
    const rName = String(r.full_name || r.name || '').trim().toLowerCase();
    const rPhone1 = String(r.phone_whatsapp || r.phone || '').replace(/\D/g, '');
    const rPhone2 = String(r.phone_secondary || '').replace(/\D/g, '');
    const rCpf = String(r.cpf || '').replace(/\D/g, '');

    const matchesText =
      (rUser && (rUser === cleanLower || (cleanNoSymbols.length >= 3 && rUserNoSymbols === cleanNoSymbols))) ||
      (rEmail && rEmail === cleanLower) ||
      (rName && rName === cleanLower);

    const matchesDigits =
      digits.length >= 8 &&
      ((digits.length === 11 && rCpf && rCpf === digits) ||
        (rPhone1 && (rPhone1 === digits || rPhone1.endsWith(digits) || digits.endsWith(rPhone1))) ||
        (rPhone2 && (rPhone2 === digits || rPhone2.endsWith(digits) || digits.endsWith(rPhone2))));

    if (!matchesText && !matchesDigits) return false;

    const key = `${table}::${r.id}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  };

  const normalizeRecord = (r: any, table: 'system_admins' | 'clients' | 'salon_users' | 'professionals') => {
    const rawRole = String(r.role || '').toLowerCase();
    const rawAccess = String(r.access_level || '').toLowerCase();
    const isSuperadmin =
      table === 'system_admins' ||
      rawRole === 'superadmin' ||
      rawAccess.includes('superadmin') ||
      rawAccess.includes('administrador master');

    return {
      ...r,
      id: String(r.id),
      user_id: r.user_id || null,
      sourceTable: table,
      name: r.full_name || r.name || r.username || '',
      username: r.username || '',
      email: r.email || '',
      phone: r.phone_whatsapp || r.phone || r.phone_secondary || '',
      cpf: r.cpf || '',
      password_hash: r.password_hash ?? null,
      avatar_url: r.avatar_url || '',
      isSuperadmin,
    };
  };

  try {
    const [sysAdminsRes, clientsRes, salonUsersRes, prosRes] = await Promise.all([
      (supabase.from('system_admins' as any) as any).select('*').limit(100),
      (supabase.from('clients') as any).select('*').limit(400),
      (supabase.from('salon_users' as any) as any).select('*').limit(200),
      (supabase.from('professionals') as any).select('*').limit(200),
    ]);

    if (Array.isArray(sysAdminsRes?.data)) {
      for (const r of sysAdminsRes.data) {
        if (matchesRecord(r, 'system_admins')) {
          results.push(normalizeRecord(r, 'system_admins'));
        }
      }
    }

    if (Array.isArray(clientsRes?.data)) {
      for (const r of clientsRes.data) {
        if (matchesRecord(r, 'clients')) {
          results.push(normalizeRecord(r, 'clients'));
        }
      }
    }

    if (Array.isArray(salonUsersRes?.data)) {
      for (const r of salonUsersRes.data) {
        if (matchesRecord(r, 'salon_users')) {
          results.push(normalizeRecord(r, 'salon_users'));
        }
      }
    }

    if (Array.isArray(prosRes?.data)) {
      for (const r of prosRes.data) {
        if (matchesRecord(r, 'professionals')) {
          results.push(normalizeRecord(r, 'professionals'));
        }
      }
    }
  } catch {}

  return results;
}

/**
 * Resolve um identificador (E-mail, Telefone, CPF ou Usuário) para o e-mail e contas cadastradas no Supabase
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
  const recordWithEmail = matchedClients.find(
    (c: any) => c.email && isValidEmailAddress(String(c.email))
  );
  if (recordWithEmail?.email) {
    return {
      email: String(recordWithEmail.email).trim().toLowerCase(),
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
    // 1. Se possui dígitos de telefone ou CPF (8 a 14 dígitos), buscar em salons
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

  // Campos de Recuperação Direta de Senha
  const [forgotStep, setForgotStep] = useState<'identify' | 'reset'>('identify');
  const [forgotMatchedAccounts, setForgotMatchedAccounts] = useState<any[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

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
    (typeof window !== 'undefined'
      ? (isDark
          ? localStorage.getItem('vagou_salon_logo_dark') || localStorage.getItem('vagou_salon_logo_light')
          : localStorage.getItem('vagou_salon_logo_light') || localStorage.getItem('vagou_salon_logo_dark')) ||
        localStorage.getItem('vagou_salon_icon') ||
        ''
      : '') ||
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
      setForgotStep('identify');
      setForgotMatchedAccounts([]);
      setNewPassword('');
      setConfirmNewPassword('');
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
    existingAccountRow?: any
  ) => {
    const isSuperadmin = Boolean(
      existingAccountRow?.isSuperadmin ||
      existingAccountRow?.sourceTable === 'system_admins' ||
      userMeta?.isSuperadmin ||
      String(existingAccountRow?.access_level || '').toLowerCase().includes('superadmin') ||
      String(existingAccountRow?.role || '').toLowerCase() === 'superadmin'
    );

    let clientRow: any =
      existingAccountRow?.sourceTable === 'clients' || (!existingAccountRow?.sourceTable && existingAccountRow?.id)
        ? existingAccountRow
        : null;

    // Se a conta veio de system_admins, salon_users ou professionals, garante espelho em public.clients para FKs de agendamento
    if (!clientRow && supabase) {
      try {
        const candidateEmail = existingAccountRow?.email || (isValidEmailAddress(emailOrUsername) ? emailOrUsername : '');
        const candidateUsername = existingAccountRow?.username || (!isValidEmailAddress(emailOrUsername) ? emailOrUsername : '');
        if (candidateEmail) {
          const { data: cByEmail } = await (supabase.from('clients') as any)
            .select('*')
            .ilike('email', candidateEmail)
            .limit(1)
            .maybeSingle();
          if (cByEmail) clientRow = cByEmail;
        }
        if (!clientRow && candidateUsername) {
          const { data: cByUser } = await (supabase.from('clients') as any)
            .select('*')
            .ilike('username', candidateUsername)
            .limit(1)
            .maybeSingle();
          if (cByUser) clientRow = cByUser;
        }
      } catch {}
    }

    if (!clientRow) {
      const ensured = await ensureClientRow(
        userId,
        isValidEmailAddress(emailOrUsername) ? emailOrUsername : (existingAccountRow?.email || null),
        {
          full_name: fallbackName || existingAccountRow?.name || userMeta?.full_name || userMeta?.name,
          phone: fallbackPhone || existingAccountRow?.phone || userMeta?.phone,
          cpf: fallbackCpf || existingAccountRow?.cpf || userMeta?.cpf,
          username:
            existingAccountRow?.username ||
            userMeta?.username ||
            (!isValidEmailAddress(emailOrUsername) ? emailOrUsername : undefined),
          password_hash: existingAccountRow?.password_hash || userMeta?.password_hash,
        }
      );
      clientRow = ensured.client;
    }

    const effectiveUserId = String(
      userId || existingAccountRow?.id || clientRow?.user_id || clientRow?.id || ''
    ).trim();
    const effectiveClientId = String(clientRow?.id || effectiveUserId).trim();
    const cleanCpf = (
      fallbackCpf ||
      existingAccountRow?.cpf ||
      clientRow?.cpf ||
      userMeta?.cpf ||
      ''
    ).replace(/\D/g, '');
    const effectiveIdentity = (
      existingAccountRow?.email ||
      clientRow?.email ||
      emailOrUsername ||
      existingAccountRow?.username ||
      clientRow?.username ||
      ''
    ).trim();
    const effectiveUsername = (
      existingAccountRow?.username ||
      clientRow?.username ||
      effectiveIdentity
    ).trim();

    try {
      if (isSuperadmin) {
        localStorage.setItem('vagou_is_superadmin', 'true');
      } else {
        localStorage.removeItem('vagou_is_superadmin');
      }
    } catch {}

    // Verifica vínculo com o salão atual (Superadmin Master, Dono, Gerente, Profissional ou Cliente)
    const membership = await checkUserSalonMembership(
      effectiveUserId,
      currentSlug,
      effectiveIdentity,
      cleanCpf
    );

    const resolvedName =
      fallbackName ||
      existingAccountRow?.name ||
      clientRow?.name ||
      existingAccountRow?.username ||
      clientRow?.username ||
      userMeta?.full_name ||
      userMeta?.name ||
      (effectiveIdentity ? effectiveIdentity.split('@')[0] : 'Usuário');

    const resolvedPhone =
      fallbackPhone || existingAccountRow?.phone || clientRow?.phone || userMeta?.phone || '';

    const resolvedAvatar =
      existingAccountRow?.avatar_url || clientRow?.avatar_url || userMeta?.avatar_url || '';

    const finalIsSuperadmin = isSuperadmin || membership.role === 'owner' && existingAccountRow?.sourceTable === 'system_admins';

    try {
      if (effectiveUserId) localStorage.setItem('vagou_auth_user_id', effectiveUserId);
      if (effectiveClientId) localStorage.setItem('vagou_client_id', effectiveClientId);
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
        'vagou_user_role',
        finalIsSuperadmin ? 'superadmin' : membership.role
      );
      localStorage.setItem(
        'vagou_client_session',
        JSON.stringify({
          id: effectiveUserId || effectiveClientId,
          clientId: effectiveClientId || effectiveUserId,
          name: resolvedName,
          email: effectiveIdentity,
          username: effectiveUsername,
          phone: resolvedPhone,
          cpf: cleanCpf,
          role: finalIsSuperadmin ? 'superadmin' : membership.role,
          accessLevel: finalIsSuperadmin
            ? 'Superadmin Master'
            : existingAccountRow?.access_level || clientRow?.access_level || membership.role,
          isSuperadmin: finalIsSuperadmin,
        })
      );
    } catch {}

    const mappedRole: 'pro' | 'cliente' =
      finalIsSuperadmin || membership.isMember ? 'pro' : 'cliente';

    window.dispatchEvent(
      new CustomEvent('vagou:auth-updated', {
        detail: {
          userId: effectiveUserId,
          email: effectiveIdentity,
          cpf: cleanCpf,
          name: resolvedName,
          accountType: finalIsSuperadmin ? 'owner' : membership.role,
          isSuperadmin: finalIsSuperadmin,
        },
      })
    );

    hapticSuccess();
    onAuthenticated(
      {
        id: effectiveClientId || effectiveUserId,
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

      // 1. Verifica autenticação direta nas tabelas oficiais da Tríade (system_admins, clients, salon_users, professionals)
      if (resolved.matchedClients.length > 0) {
        const matchedByHash = resolved.matchedClients.find(
          (c: any) =>
            c.password_hash !== null &&
            c.password_hash !== undefined &&
            String(c.password_hash).trim() === cleanPass
        );

        if (matchedByHash) {
          const finalUserId = String(matchedByHash.user_id || matchedByHash.id);
          const finalIdentity = String(
            matchedByHash.email || matchedByHash.username || cleanIdentifier
          ).trim();

          await finalizeAuthentication(
            finalUserId,
            finalIdentity,
            matchedByHash.name || matchedByHash.username || cleanIdentifier,
            matchedByHash.phone || '',
            matchedByHash.cpf || '',
            {
              full_name: matchedByHash.name,
              phone: matchedByHash.phone,
              cpf: matchedByHash.cpf,
              username: matchedByHash.username,
              password_hash: cleanPass,
              isSuperadmin: matchedByHash.isSuperadmin,
            },
            matchedByHash
          );
          return;
        }
      }

      // 2. Caso não tenha autenticado via password_hash nas tabelas da Tríade, tenta via Supabase Auth (apenas se houver e-mail válido)
      if (!resolved.email || !isValidEmailAddress(resolved.email)) {
        if (resolved.matchedClients.length > 0) {
          setErrorMsg('Credenciais inválidas. Verifique seu usuário e senha.');
        } else {
          setErrorMsg(resolved.error || 'Conta não localizada. Verifique seu usuário, e-mail ou telefone.');
        }
        setIsSubmitting(false);
        return;
      }

      // Se todas as contas localizadas já possuem password_hash diferente da senha digitada, rejeita sem disparar erro 400 no GoTrue
      const allMatchedHaveDifferentHash =
        resolved.matchedClients.length > 0 &&
        resolved.matchedClients.every(
          (c: any) =>
            c.password_hash !== null &&
            c.password_hash !== undefined &&
            String(c.password_hash).trim().length > 0 &&
            String(c.password_hash).trim() !== cleanPass
        );

      if (allMatchedHaveDifferentHash) {
        setErrorMsg('Credenciais inválidas. Verifique seu usuário e senha.');
        setIsSubmitting(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolved.email,
        password: cleanPass,
      });

      if (!error && data?.user) {
        const matchedClientRow = resolved.matchedClients[0] || undefined;
        if (matchedClientRow?.id && matchedClientRow?.sourceTable === 'clients' && !matchedClientRow.password_hash) {
          try {
            await (supabase.from('clients') as any)
              .update({ password_hash: cleanPass })
              .eq('id', matchedClientRow.id);
          } catch {}
        }
        await finalizeAuthentication(
          data.user.id,
          data.user.email || resolved.email,
          matchedClientRow?.name,
          matchedClientRow?.phone,
          matchedClientRow?.cpf,
          { ...(data.user.user_metadata || {}), password_hash: cleanPass },
          matchedClientRow
        );
        return;
      }

      // 3. Fallback resiliente para contas criadas via admvapp em public.salons / public.clients sem password_hash
      const rawMsg = error?.message || '';
      const cleanEmailLower = resolved.email.toLowerCase();
      let fallbackAccount: {
        id?: string;
        name?: string;
        phone?: string;
        cpf?: string;
        clientRow?: any;
      } | null = null;

      // 3a. Cliente já existente em public.clients sem password_hash gravado
      const clientWithoutHash = resolved.matchedClients.find(
        (c: any) =>
          c.sourceTable === 'clients' &&
          (!c.password_hash || String(c.password_hash).trim() === '')
      );
      if (clientWithoutHash) {
        try {
          await (supabase.from('clients') as any)
            .update({ password_hash: cleanPass })
            .eq('id', clientWithoutHash.id);
        } catch {}
        fallbackAccount = {
          id: String(clientWithoutHash.user_id || clientWithoutHash.id),
          name: clientWithoutHash.name || clientWithoutHash.username,
          phone: clientWithoutHash.phone || '',
          cpf: clientWithoutHash.cpf || '',
          clientRow: { ...clientWithoutHash, password_hash: cleanPass },
        };
      }

      // 3b. Titular / Parceiro em public.salons (cadastrado no admvapp)
      if (!fallbackAccount) {
        try {
          const { data: salonsPool } = await (supabase.from('salons') as any)
            .select('id, owner_id, trade_name, legal_name, email, phone_whatsapp, owner_cpf, document_number, branding')
            .limit(100);
          if (Array.isArray(salonsPool)) {
            const matchedSalon = salonsPool.find((s: any) => {
              const emails = [
                s.email,
                s.branding?.ownerEmail,
                s.branding?.legalManagerEmail,
                s.branding?.email,
              ]
                .filter(Boolean)
                .map((em: any) => String(em).trim().toLowerCase());
              return emails.includes(cleanEmailLower);
            });
            if (matchedSalon) {
              const storedSalonPass =
                matchedSalon.branding?.password ||
                matchedSalon.branding?.adminPassword ||
                matchedSalon.branding?.ownerPassword;
              if (!storedSalonPass || String(storedSalonPass).trim() === cleanPass) {
                fallbackAccount = {
                  id: String(matchedSalon.owner_id || matchedSalon.id),
                  name:
                    matchedSalon.branding?.legalManagerName ||
                    matchedSalon.legal_name ||
                    matchedSalon.trade_name ||
                    cleanEmailLower.split('@')[0],
                  phone: matchedSalon.phone_whatsapp || '',
                  cpf: matchedSalon.owner_cpf || matchedSalon.branding?.ownerCpf || '',
                };
              }
            }
          }
        } catch {}
      }

      if (fallbackAccount) {
        await finalizeAuthentication(
          fallbackAccount.id || '',
          cleanEmailLower,
          fallbackAccount.name,
          fallbackAccount.phone,
          fallbackAccount.cpf,
          { full_name: fallbackAccount.name, phone: fallbackAccount.phone, password_hash: cleanPass },
          fallbackAccount.clientRow
        );
        return;
      }

      if (rawMsg.includes('Invalid login credentials')) {
        setErrorMsg('Credenciais inválidas. Verifique seu e-mail/usuário e senha.');
      } else if (rawMsg.includes('Email not confirmed')) {
        setErrorMsg('E-mail pendente de confirmação. Verifique sua caixa de entrada.');
      } else {
        setErrorMsg(rawMsg || 'Não foi possível autenticar. Verifique seus dados.');
      }
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      const { data, error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error.message || 'Erro ao conectar com Google.');
        setIsSubmitting(false);
        return;
      }
      // O fluxo OAuth abre popup/redirect — o listener onAuthStateChange
      // em supabase.ts captura o retorno e finaliza a autenticação
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao conectar com Google.');
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

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Serviço indisponível no momento.');
      return;
    }

    if (forgotStep === 'identify') {
      const cleanIdent = identifier.trim();
      if (!cleanIdent) {
        setErrorMsg('Informe seu usuário, e-mail ou telefone cadastrado.');
        return;
      }

      setIsSubmitting(true);
      try {
        const matched = await findMatchingClients(cleanIdent);
        if (matched.length === 0) {
          setErrorMsg('Conta não localizada com este identificador.');
          setIsSubmitting(false);
          return;
        }
        setForgotMatchedAccounts(matched);
        setForgotStep('reset');
        setSuccessMsg(`Conta localizada (${matched[0].name || matched[0].username || matched[0].email}). Defina sua nova senha abaixo.`);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Erro ao localizar conta.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Etapa 2: Redefinir senha diretamente nas tabelas da Tríade
    const cleanNewPass = newPassword.trim();
    const cleanConfirmPass = confirmNewPassword.trim();

    if (cleanNewPass.length < 6) {
      setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (cleanNewPass !== cleanConfirmPass) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      for (const acc of forgotMatchedAccounts) {
        const table = acc.sourceTable || 'clients';
        try {
          await (supabase.from(table as any) as any)
            .update({ password_hash: cleanNewPass, updated_at: new Date().toISOString() })
            .eq('id', acc.id);
        } catch {}

        // Também sincroniza em public.clients pelo e-mail ou username caso exista espelho
        if (acc.email) {
          try {
            await (supabase.from('clients') as any)
              .update({ password_hash: cleanNewPass })
              .ilike('email', acc.email);
          } catch {}
        }
      }

      setPassword(cleanNewPass);
      setForgotStep('identify');
      setForgotMatchedAccounts([]);
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('login');
      setSuccessMsg('Senha atualizada com sucesso! Clique em Entrar.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao atualizar a senha.');
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

            {/* Divisor + Botão Google */}
            <div className="flex items-center gap-3 py-1">
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <span className={`text-[10px] uppercase font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ou</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>
            <button
              type="button"
              onClick={() => { hapticLight(); handleGoogleSignIn(); }}
              disabled={isSubmitting}
              className={`w-full py-3 px-4 rounded-[4px] font-bold text-xs flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-60 border ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar com Google
            </button>

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
            {forgotStep === 'identify' ? (
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
                    className={inputBaseClass}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label
                    className={`block text-[11px] font-bold ${
                      isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    Nova Senha de Acesso{' '}
                    <span style={{ color: resolvedPrimaryColor }}>*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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

                <div className="space-y-1.5">
                  <label
                    className={`block text-[11px] font-bold ${
                      isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    Confirmar Nova Senha{' '}
                    <span style={{ color: resolvedPrimaryColor }}>*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      autoComplete="new-password"
                      className={inputBaseClass}
                    />
                  </div>
                </div>
              </>
            )}

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
                    <span className="text-white">
                      {forgotStep === 'identify' ? 'Localizando...' : 'Salvando...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-white">
                      {forgotStep === 'identify' ? 'Localizar Conta' : 'Salvar Nova Senha'}
                    </span>
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
                  setForgotStep('identify');
                  setForgotMatchedAccounts([]);
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
