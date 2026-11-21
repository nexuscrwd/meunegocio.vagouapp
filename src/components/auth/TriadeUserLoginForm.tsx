import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Chrome,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { SalonAuthHeader } from './SalonAuthHeader';

export interface TriadeUserLoginPayload {
  identifier: string;
  id?: string;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  avatarUrl?: string;
  passwordHash?: string;
  matchedAccount?: any;
  accountType?: 'client' | 'professional' | 'owner';
  session?: {
    access_token: string;
    refresh_token: string;
  };
}

export type UserLoginPhase = 'credentials' | 'recovery';

export interface TriadeUserLoginFormProps {
  onSuccess?: (data: TriadeUserLoginPayload) => void;
  onSwitchToRegister?: () => void;
  onOpenRecovery?: () => void;
  onClose?: () => void;
  showHeader?: boolean;
  variant?: 'card' | 'flat';
  title?: string;
  subtitle?: string;
  submitButtonText?: string;
  activePhase?: UserLoginPhase;
  onPhaseChange?: (phase: UserLoginPhase) => void;
  showSwitchToRegister?: boolean;
  salonName?: string;
  salonSlug?: string;
  salonSlogan?: string;
  salonLogoUrl?: string;
  initialIdentifier?: string;
}

export async function findMatchingTriadeAccounts(rawInput: string): Promise<any[]> {
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  try {
    const resp = await fetch('/api/auth/resolve-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: trimmed }),
    });
    if (resp.ok) {
      const payload = await resp.json();
      if (Array.isArray(payload?.accounts) && payload.accounts.length > 0) {
        return payload.accounts;
      }
    }
  } catch {}

  if (!isSupabaseConfigured || !supabase) return [];

  const cleanLower = trimmed.toLowerCase();
  const cleanNoSymbols = cleanLower.replace(/^[@#&]+|[@#&]+$/g, '');
  const digits = trimmed.replace(/\D/g, '');
  const results: any[] = [];
  const seenKeys = new Set<string>();

  const matchesRecord = (
    r: any,
    table: 'system_admins' | 'clients' | 'profiles' | 'professionals'
  ): boolean => {
    if (!r || r.is_active === false) return false;

    const rUser = String(r.username || '').trim().toLowerCase();
    const rUserNoSymbols = rUser.replace(/^[@#&]+|[@#&]+$/g, '');
    const rEmail = String(r.email || '').trim().toLowerCase();
    const rName = String(r.full_name || r.name || '').trim().toLowerCase();
    const rPhone1 = String(r.phone_whatsapp || r.phone || '').replace(/\D/g, '');
    const rCpf = String(r.cpf || '').replace(/\D/g, '');

    const matchesText =
      (rUser &&
        (rUser === cleanLower ||
          (cleanNoSymbols.length >= 2 && rUserNoSymbols === cleanNoSymbols))) ||
      (rEmail && rEmail === cleanLower) ||
      (rName && rName === cleanLower);

    const matchesDigits =
      digits.length >= 8 &&
      ((digits.length === 11 && rCpf && rCpf === digits) ||
        (rPhone1 &&
          (rPhone1 === digits ||
            rPhone1.endsWith(digits.slice(-8)) ||
            digits.endsWith(rPhone1.slice(-8)))));

    if (!matchesText && !matchesDigits) return false;

    const key = `${table}::${r.id}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  };

  const normalizeRecord = (
    r: any,
    table: 'system_admins' | 'clients' | 'profiles' | 'professionals'
  ) => {
    const rawRole = String(r.role || '').toLowerCase();
    const rawAccess = String(r.access_level || '').toLowerCase();
    const isSuperadmin =
      table === 'system_admins' ||
      rawRole === 'super_admin' ||
      rawRole === 'superadmin' ||
      rawAccess === '100' ||
      rawAccess.includes('superadmin');

    return {
      ...r,
      id: String(r.id),
      user_id: r.user_id || (table === 'profiles' ? String(r.id) : null),
      sourceTable: table === 'profiles' ? 'clients' : table,
      name: r.full_name || r.name || r.username || '',
      full_name: r.full_name || r.name || r.username || '',
      username: r.username || '',
      email: r.email || '',
      phone: r.phone_whatsapp || r.phone || '',
      cpf: r.cpf || '',
      avatar_url: r.avatar_url || '',
      isSuperadmin,
    };
  };

  try {
    const [profilesRes, clientsRes, prosRes] = await Promise.all([
      (supabase.from('profiles' as any) as any).select('*').limit(200),
      (supabase.from('clients') as any).select('*').limit(400),
      (supabase.from('professionals') as any).select('*').limit(200),
    ]);

    if (Array.isArray(profilesRes?.data)) {
      for (const r of profilesRes.data) {
        if (matchesRecord(r, 'profiles')) results.push(normalizeRecord(r, 'profiles'));
      }
    }
    if (Array.isArray(clientsRes?.data)) {
      for (const r of clientsRes.data) {
        if (matchesRecord(r, 'clients')) results.push(normalizeRecord(r, 'clients'));
      }
    }
    if (Array.isArray(prosRes?.data)) {
      for (const r of prosRes.data) {
        if (matchesRecord(r, 'professionals'))
          results.push(normalizeRecord(r, 'professionals'));
      }
    }
  } catch {}

  return results;
}

export const TriadeUserLoginForm: React.FC<TriadeUserLoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
  onOpenRecovery,
  onClose,
  showHeader = true,
  variant = 'card',
  subtitle,
  submitButtonText = 'Entrar',
  showSwitchToRegister = true,
  salonName,
  salonSlug,
  salonSlogan,
  salonLogoUrl,
  initialIdentifier = '',
}) => {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (initialIdentifier) {
      setIdentifier(initialIdentifier);
    }
  }, [initialIdentifier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const rawId = identifier.trim();
    const cleanPass = password.trim();

    if (!rawId) {
      setFeedback({
        type: 'error',
        message: 'Informe seu usuário, e-mail ou celular.',
      });
      return;
    }
    if (!cleanPass) {
      setFeedback({ type: 'error', message: 'Informe sua senha de acesso.' });
      return;
    }

    setIsLoading(true);

    try {
      try {
        const apiResp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: rawId, password: cleanPass }),
        });

        const apiBody = await apiResp.json().catch(() => null);

        if (apiResp.ok && apiBody?.success && apiBody?.account) {
          if (
            apiBody.session?.access_token &&
            apiBody.session?.refresh_token &&
            supabase
          ) {
            try {
              await supabase.auth.setSession({
                access_token: apiBody.session.access_token,
                refresh_token: apiBody.session.refresh_token,
              });
            } catch {}
          }

          const resolvedPayload: TriadeUserLoginPayload = {
            ...apiBody.account,
            session: apiBody.session,
          };

          setFeedback({ type: 'success', message: 'Acesso validado com sucesso!' });
          setIsLoading(false);
          onSuccess?.(resolvedPayload);
          return;
        }

        if (apiResp.status === 401 && apiBody?.error) {
          setIsLoading(false);
          setFeedback({
            type: 'error',
            message: apiBody.error,
          });
          return;
        }
      } catch {}

      if (supabase) {
        const { data: adm } = await (supabase as any).rpc('verify_admin_login', {
          p_identifier: rawId.replace(/^@+/, ''),
          p_password: cleanPass,
        });
        if (adm?.[0]) {
          const a = adm[0];
          let session;
          const { data: s } = await supabase.auth.signInWithPassword({
            email: a.email,
            password: cleanPass,
          });
          if (s?.session) {
            session = {
              access_token: s.session.access_token,
              refresh_token: s.session.refresh_token,
            };
          }
          setFeedback({ type: 'success', message: 'Acesso validado com sucesso!' });
          setIsLoading(false);
          onSuccess?.({
            identifier: rawId,
            id: String(a.user_id || a.id),
            name: a.full_name,
            username: a.username,
            email: a.email,
            avatarUrl: a.avatar_url || '',
            accountType: 'owner',
            session,
            matchedAccount: { ...a, sourceTable: 'system_admins', isSuperadmin: true },
          });
          return;
        }
      }

      const cleanUsername = rawId.replace(/^@+/, '').toLowerCase();
      const matchedList = await findMatchingTriadeAccounts(rawId);
      const matchedClient = matchedList[0] || null;
      const resolvedEmail = (
        matchedClient?.email ||
        (rawId.includes('@') && rawId.includes('.')
          ? rawId
          : `${cleanUsername.replace(/[^a-z0-9]/g, '')}@vagouapp.com`)
      ).toLowerCase();

      let authSession: any = undefined;
      let authUserId = matchedClient?.user_id || matchedClient?.id;

      if (supabase) {
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email: resolvedEmail,
            password: cleanPass,
          });

        if (!signInErr && signInData?.session) {
          authUserId = signInData.user?.id || authUserId;
          authSession = {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
          };
        } else {
          setIsLoading(false);
          setFeedback({
            type: 'error',
            message:
              'Conta ou senha inválida. Verifique seu usuário, celular ou e-mail.',
          });
          return;
        }
      }

      const resolvedAccountType: 'owner' | 'professional' | 'client' =
        matchedClient?.isSuperadmin || matchedClient?.sourceTable === 'system_admins'
          ? 'owner'
          : matchedClient?.sourceTable === 'professionals'
            ? 'professional'
            : 'client';

      const resolvedPayload: TriadeUserLoginPayload = {
        identifier: rawId,
        id: authUserId,
        name: matchedClient?.name || matchedClient?.full_name || cleanUsername,
        username: matchedClient?.username || cleanUsername,
        email: matchedClient?.email || resolvedEmail,
        phone: matchedClient?.phone || '',
        cpf: matchedClient?.cpf || '',
        avatarUrl: matchedClient?.avatar_url || '',
        matchedAccount: matchedClient,
        accountType: resolvedAccountType,
        session: authSession,
      };

      setFeedback({ type: 'success', message: 'Acesso validado com sucesso!' });
      setIsLoading(false);
      onSuccess?.(resolvedPayload);
    } catch (err: any) {
      setIsLoading(false);
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao processar acesso.',
      });
    }
  };

  const handleGoogleAccountLogin = async () => {
    setFeedback(null);
    if (!supabase) {
      setFeedback({
        type: 'error',
        message: 'Serviço de autenticação Supabase indisponível no momento.',
      });
      return;
    }
    setIsGoogleLoading(true);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (oauthErr) {
        throw oauthErr;
      }
    } catch (err: any) {
      setIsGoogleLoading(false);
      setFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível autenticar com sua Conta Google.',
      });
    }
  };

  return (
    <div
      className={`w-full max-w-md mx-auto text-white ${
        variant === 'card'
          ? 'bg-slate-950/75 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden'
          : ''
      }`}
    >

      {showHeader && (
        <SalonAuthHeader
          salonName={salonName}
          salonSlug={salonSlug}
          salonSlogan={salonSlogan}
          salonLogoUrl={salonLogoUrl}
          subtitle={subtitle}
          onClose={onClose}
        />
      )}

      <div className="px-6 pb-6 pt-2">
        {feedback && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Usuário, Celular ou E-mail
            </label>
            <div className="flex items-center bg-white/[0.07] hover:bg-white/[0.10] focus-within:bg-white/[0.12] focus-within:ring-1 focus-within:ring-[#20C933] rounded-xl px-3.5 py-3 min-h-[46px] text-white transition">
              <User className="w-4 h-4 text-emerald-400 mr-2.5 shrink-0" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="@usuario, (11) 99999-9999 ou e-mail"
                className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Senha
            </label>
            <div className="flex items-center bg-white/[0.07] hover:bg-white/[0.10] focus-within:bg-white/[0.12] focus-within:ring-1 focus-within:ring-[#20C933] rounded-xl px-3.5 py-3 min-h-[46px] text-white transition">
              <Lock className="w-4 h-4 text-emerald-400 mr-2.5 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none w-full"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-white transition ml-2 cursor-pointer"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#20C933] hover:bg-[#1bb32d] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition cursor-pointer whitespace-nowrap"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <span className="text-white font-bold">
                  {submitButtonText === 'ACESSAR' ? 'Entrar' : submitButtonText}
                </span>
                <ArrowRight className="w-4 h-4 text-white" />
              </>
            )}
          </button>

          <div className="flex items-center gap-3 py-0.5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] font-semibold text-slate-400">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleAccountLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer whitespace-nowrap"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Chrome className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-white font-bold">Conta Google</span>
          </button>

          <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between gap-4">
            {onOpenRecovery && (
              <button
                type="button"
                onClick={onOpenRecovery}
                className="bg-transparent border-0 p-0 text-slate-400 hover:text-white font-medium text-xs transition cursor-pointer whitespace-nowrap"
              >
                Esqueci a senha
              </button>
            )}

            {showSwitchToRegister && onSwitchToRegister && (
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="bg-transparent border-0 p-0 text-emerald-400 hover:text-emerald-300 font-bold text-xs transition cursor-pointer whitespace-nowrap ml-auto"
              >
                Criar conta
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
