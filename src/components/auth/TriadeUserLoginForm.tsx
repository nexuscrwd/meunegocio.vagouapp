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

  const cleanLower = trimmed.toLowerCase();
  const cleanNoLeadingAt = cleanLower.replace(/^@+/, '');
  const cleanNoSymbols = cleanLower.replace(/^[@#&]+|[@#&]+$/g, '');
  const digits = trimmed.replace(/\D/g, '');
  const scoredResults: Array<{ priority: number; item: any }> = [];
  const seenKeys = new Set<string>();

  const scoreAndAddRecord = (
    r: any,
    table: 'system_admins' | 'clients' | 'profiles' | 'professionals'
  ) => {
    if (!r || r.is_active === false) return;

    const rUser = String(r.username || '').trim().toLowerCase();
    const rUserNoLeadingAt = rUser.replace(/^@+/, '');
    const rUserNoSymbols = rUser.replace(/^[@#&]+|[@#&]+$/g, '');
    const rEmail = String(r.email || '').trim().toLowerCase();
    const rName = String(r.full_name || r.name || '').trim().toLowerCase();
    const rPhone = String(r.phone_whatsapp || r.phone || '').replace(/\D/g, '');
    const rCpf = String(r.cpf || '').replace(/\D/g, '');

    let priority = 99;
    if (
      (rEmail && rEmail === cleanLower) ||
      (rUser && (rUser === cleanLower || rUser === cleanNoLeadingAt || rUserNoLeadingAt === cleanNoLeadingAt))
    ) {
      priority = 1;
    } else if (
      digits.length >= 8 &&
      ((digits.length === 11 && rCpf && rCpf === digits) ||
        (rPhone &&
          rPhone.length >= 8 &&
          (rPhone === digits ||
            rPhone.endsWith(digits.slice(-8)) ||
            digits.endsWith(rPhone.slice(-8)))))
    ) {
      priority = 2;
    } else if (
      cleanNoSymbols.length >= 2 &&
      rUserNoSymbols &&
      rUserNoSymbols === cleanNoSymbols
    ) {
      priority = 3;
    } else if (
      rName &&
      (rName === cleanLower || (cleanNoSymbols.length >= 3 && rName.replace(/^[@#&]+|[@#&]+$/g, '') === cleanNoSymbols))
    ) {
      priority = 4;
    }

    if (priority === 99) return;

    const rawRole = String(r.role || '').toLowerCase();
    const rawAccess = String(r.access_level || '').toLowerCase();
    const isSuperadmin = Boolean(
      r.isSuperadmin ||
      r.is_superadmin ||
      table === 'system_admins' ||
      r.sourceTable === 'system_admins' ||
      r.source_table === 'system_admins' ||
      rawRole === 'super_admin' ||
      rawRole === 'superadmin' ||
      rawRole.includes('superadmin') ||
      rawAccess === '100' ||
      rawAccess.includes('superadmin')
    );

    const resolvedSourceTable =
      r.sourceTable ||
      r.source_table ||
      (isSuperadmin ? 'system_admins' : table === 'profiles' ? 'clients' : table);

    const dedupeKey = `${resolvedSourceTable}::${String(r.email || r.user_id || r.id || '').toLowerCase()}::${rUser}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);

    scoredResults.push({
      priority: typeof r.match_priority === 'number' ? Math.min(priority, r.match_priority) : priority,
      item: {
        ...r,
        id: String(r.id || r.user_id || ''),
        user_id: r.user_id || (table === 'profiles' ? String(r.id) : r.id),
        sourceTable: resolvedSourceTable,
        name: r.full_name || r.name || r.username || '',
        full_name: r.full_name || r.name || r.username || '',
        username: r.username || '',
        email: r.email || '',
        phone: r.phone_whatsapp || r.phone || '',
        cpf: r.cpf || '',
        avatar_url: r.avatar_url || '',
        isSuperadmin,
      },
    });
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: rpcRows } = await (supabase as any).rpc('resolve_triade_login_account', {
        p_identifier: trimmed,
      });
      if (Array.isArray(rpcRows)) {
        for (const r of rpcRows) {
          scoreAndAddRecord(r, (r.source_table as any) || 'profiles');
        }
      }
    } catch {}

    try {
      const { data: globalPref } = await (supabase.from('admin_preferences' as any) as any)
        .select('preferences')
        .eq('id', 'global')
        .maybeSingle();
      const authDirectory = globalPref?.preferences?.auth_directory;
      if (Array.isArray(authDirectory)) {
        for (const r of authDirectory) {
          scoreAndAddRecord(r, (r.sourceTable as any) || 'profiles');
        }
      }
    } catch {}

    if (scoredResults.length === 0) {
      try {
        const [profilesRes, clientsRes, prosRes] = await Promise.all([
          (supabase.from('profiles' as any) as any).select('*').limit(200),
          (supabase.from('clients') as any).select('*').limit(400),
          (supabase.from('professionals') as any).select('*').limit(200),
        ]);

        if (Array.isArray(profilesRes?.data)) {
          for (const r of profilesRes.data) scoreAndAddRecord(r, 'profiles');
        }
        if (Array.isArray(clientsRes?.data)) {
          for (const r of clientsRes.data) scoreAndAddRecord(r, 'clients');
        }
        if (Array.isArray(prosRes?.data)) {
          for (const r of prosRes.data) scoreAndAddRecord(r, 'professionals');
        }
      } catch {}
    }
  }

  if (scoredResults.length === 0) {
    try {
      const resp = await fetch('/api/auth/resolve-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmed }),
      });
      if (resp.ok) {
        const payload = await resp.json();
        if (Array.isArray(payload?.accounts)) {
          for (const r of payload.accounts) {
            scoreAndAddRecord(r, (r.sourceTable as any) || 'profiles');
          }
        }
      }
    } catch {}
  }

  scoredResults.sort((a, b) => a.priority - b.priority);
  return scoredResults.map((entry) => entry.item);
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
      const hasExplicitClientSuffix = /[#&]$/.test(rawId);
      const isEmailInput = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawId);

      if (supabase && !hasExplicitClientSuffix) {
        const strippedLeadAt = rawId.replace(/^@+/, '');
        const adminCandidates = Array.from(
          new Set(
            [
              strippedLeadAt,
              !isEmailInput && !strippedLeadAt.endsWith('@') ? `${strippedLeadAt}@` : '',
            ].filter(Boolean)
          )
        );

        for (const adminIdent of adminCandidates) {
          try {
            const { data: adm } = await (supabase as any).rpc('verify_admin_login', {
              p_identifier: adminIdent,
              p_password: cleanPass,
            });
            if (adm?.[0]) {
              const a = adm[0];
              let session;
              try {
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
              } catch {}
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
          } catch {}
        }
      }

      const cleanUsername = rawId.replace(/^@+/, '').toLowerCase();
      const matchedList = await findMatchingTriadeAccounts(rawId);

      const candidateAccounts: Array<{ email: string; matched: any }> = [];
      const seenEmails = new Set<string>();

      for (const m of matchedList) {
        const em = String(m?.email || '').trim().toLowerCase();
        if (em && em.includes('@') && !seenEmails.has(em)) {
          seenEmails.add(em);
          candidateAccounts.push({ email: em, matched: m });
        }
      }

      if (isEmailInput && !seenEmails.has(rawId.toLowerCase())) {
        seenEmails.add(rawId.toLowerCase());
        candidateAccounts.push({
          email: rawId.toLowerCase(),
          matched: matchedList[0] || null,
        });
      }

      if (candidateAccounts.length === 0) {
        const fallbackEmail = `${cleanUsername.replace(/[^a-z0-9]/g, '')}@vagouapp.com`;
        candidateAccounts.push({ email: fallbackEmail, matched: null });
      }

      if (supabase) {
        for (const candidate of candidateAccounts.slice(0, 4)) {
          const { data: signInData, error: signInErr } =
            await supabase.auth.signInWithPassword({
              email: candidate.email,
              password: cleanPass,
            });

          if (!signInErr && signInData?.session) {
            const matchedClient = candidate.matched;
            const authUserId = signInData.user?.id || matchedClient?.user_id || matchedClient?.id;
            const userMeta = signInData.user?.user_metadata || {};
            const isSuper = Boolean(
              matchedClient?.isSuperadmin ||
              matchedClient?.sourceTable === 'system_admins' ||
              userMeta?.is_superadmin ||
              String(userMeta?.role || '').toLowerCase().includes('super')
            );

            const resolvedAccountType: 'owner' | 'professional' | 'client' = isSuper
              ? 'owner'
              : matchedClient?.sourceTable === 'professionals'
                ? 'professional'
                : 'client';

            const resolvedPayload: TriadeUserLoginPayload = {
              identifier: rawId,
              id: authUserId,
              name:
                matchedClient?.name ||
                matchedClient?.full_name ||
                userMeta?.full_name ||
                userMeta?.name ||
                cleanUsername,
              username:
                matchedClient?.username ||
                userMeta?.username ||
                cleanUsername,
              email: candidate.email,
              phone: matchedClient?.phone || userMeta?.phone || '',
              cpf: matchedClient?.cpf || userMeta?.cpf || '',
              avatarUrl: matchedClient?.avatar_url || userMeta?.avatar_url || '',
              matchedAccount: matchedClient
                ? { ...matchedClient, isSuperadmin: isSuper }
                : {
                    id: authUserId,
                    user_id: authUserId,
                    email: candidate.email,
                    full_name: userMeta?.full_name || userMeta?.name || cleanUsername,
                    username: userMeta?.username || cleanUsername,
                    phone: userMeta?.phone || '',
                    sourceTable: isSuper ? 'system_admins' : 'clients',
                    isSuperadmin: isSuper,
                  },
              accountType: resolvedAccountType,
              session: {
                access_token: signInData.session.access_token,
                refresh_token: signInData.session.refresh_token,
              },
            };

            setFeedback({ type: 'success', message: 'Acesso validado com sucesso!' });
            setIsLoading(false);
            onSuccess?.(resolvedPayload);
            return;
          }
        }
      }

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

          setFeedback({ type: 'success', message: 'Acesso validado com sucesso!' });
          setIsLoading(false);
          onSuccess?.({
            ...apiBody.account,
            session: apiBody.session,
          });
          return;
        }
      } catch {}

      setIsLoading(false);
      setFeedback({
        type: 'error',
        message:
          'Conta ou senha inválida. Verifique seu usuário, celular ou e-mail.',
      });
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
