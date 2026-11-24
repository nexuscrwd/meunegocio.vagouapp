import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  AtSign,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Hash,
  Building2,
  Loader2,
  HelpCircle,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { SalonAuthHeader } from './SalonAuthHeader';
import {
  OFFICIAL_SECURITY_QUESTIONS,
  SecurityQuestionItem,
  normalizeSecurityQuestionCode,
} from './TriadeUserRecoveryModal';

const BRAZIL_UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stripStreetPrefix(value: string): string {
  return normalizeText(value)
    .replace(
      /^(rua|r\.|r|avenida|av\.|av|alameda|al\.|al|travessa|tv\.|tv|praca|pca\.|pca|estrada|est\.|est|rodovia|rod\.|rod|viela|largo|beco)\s+/i,
      ''
    )
    .replace(/[,#-].*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBrazilPhoneDigits(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

function phonesMatchBrazil(aRaw: string, bRaw: string): boolean {
  const a = normalizeBrazilPhoneDigits(aRaw);
  const b = normalizeBrazilPhoneDigits(bRaw);
  if (a.length < 10 || b.length < 10) return false;
  if (a === b) return true;
  if (a.slice(0, 2) !== b.slice(0, 2)) return false;
  return a.slice(-8) === b.slice(-8);
}

export interface TriadeUserAddressData {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  uf: string;
}

export interface TriadeUserData {
  id?: string;
  name: string;
  username?: string;
  email: string;
  phone: string;
  cpf?: string;
  avatarUrl?: string;
  passwordHash?: string;
  address?: TriadeUserAddressData;
  accountType?: 'client' | 'professional' | 'owner';
}

export interface TriadeUserRegisterFormProps {
  onSuccess?: (data: TriadeUserData, options?: { keepModalOpen?: boolean }) => void;
  onSwitchToLogin?: () => void;
  onClose?: () => void;
  showHeader?: boolean;
  showSwitchToLogin?: boolean;
  variant?: 'card' | 'flat';
  origin?: 'portal' | 'establishment';
  salonId?: string;
  salonName?: string;
  salonSlug?: string;
  salonSlogan?: string;
  salonLogoUrl?: string;
  logoTextFallback?: string;
  salonAccentColor?: string;
}

type RegisterWizardStep =
  | 'contact'
  | 'name'
  | 'email'
  | 'address_cep'
  | 'address_num'
  | 'address_summary'
  | 'password'
  | 'welcome';

type FieldCheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

interface FieldCheckState {
  status: FieldCheckStatus;
  message: string;
  checkedValue: string;
}

const INITIAL_FIELD_CHECK: FieldCheckState = {
  status: 'idle',
  message: '',
  checkedValue: '',
};

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

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const TriadeUserRegisterForm: React.FC<TriadeUserRegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
  onClose,
  showHeader = true,
  variant = 'card',
  salonName,
}) => {
  const initialDraft = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem('vagou_register_wizard_draft');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, []);

  const [step, setStep] = useState<RegisterWizardStep>(
    initialDraft?.step && initialDraft.step !== 'welcome' ? initialDraft.step : 'contact'
  );

  const [phone, setPhone] = useState<string>(initialDraft?.phone || '');
  const [confirmPhone, setConfirmPhone] = useState<string>(initialDraft?.confirmPhone || '');
  const [phoneCheck, setPhoneCheck] = useState<FieldCheckState>(INITIAL_FIELD_CHECK);

  const [name, setName] = useState<string>(initialDraft?.name || '');
  const [username, setUsername] = useState<string>(initialDraft?.username || '');
  const [confirmUsername, setConfirmUsername] = useState<string>(
    initialDraft?.confirmUsername || ''
  );
  const [usernameCheck, setUsernameCheck] = useState<FieldCheckState>(INITIAL_FIELD_CHECK);

  const [email, setEmail] = useState<string>(initialDraft?.email || '');
  const [confirmEmail, setConfirmEmail] = useState<string>(initialDraft?.confirmEmail || '');
  const [emailCheck, setEmailCheck] = useState<FieldCheckState>(INITIAL_FIELD_CHECK);
  const [emailTouched, setEmailTouched] = useState(false);

  const [cep, setCep] = useState<string>(initialDraft?.cep || '');
  const [street, setStreet] = useState<string>(initialDraft?.street || '');
  const [addressNumber, setAddressNumber] = useState<string>(initialDraft?.addressNumber || '');
  const [complement, setComplement] = useState<string>(initialDraft?.complement || '');
  const [neighborhood, setNeighborhood] = useState<string>(initialDraft?.neighborhood || '');
  const [city, setCity] = useState<string>(initialDraft?.city || '');
  const [uf, setUf] = useState<string>(initialDraft?.uf || '');
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);
  const [isReverseLookingUpCep, setIsReverseLookingUpCep] = useState(false);
  const [cepNotFound, setCepNotFound] = useState(false);
  const [cameFromManualCep, setCameFromManualCep] = useState<boolean>(
    Boolean(initialDraft?.cameFromManualCep)
  );
  const shouldReverseLookupRef = useRef(false);
  const manualCepLockedRef = useRef(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestionItem[]>(
    OFFICIAL_SECURITY_QUESTIONS
  );
  const [securityQuestionCode, setSecurityQuestionCode] = useState<string>(
    OFFICIAL_SECURITY_QUESTIONS[0].code
  );
  const [isSecurityListOpen, setIsSecurityListOpen] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;
    (async () => {
      try {
        const { data } = await (supabase.from('security_questions' as any) as any)
          .select('code, question_text, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (!active || !Array.isArray(data) || data.length === 0) return;
        const mapped: SecurityQuestionItem[] = data.map((row: any, idx: number) => ({
          id: `sq-db-${idx + 1}`,
          code: String(row.code),
          categoryLabel: `Pergunta ${idx + 1}`,
          questionText: String(row.question_text),
        }));
        setSecurityQuestions(mapped);
        setSecurityQuestionCode((prev) =>
          mapped.some((q) => q.code === prev) ? prev : mapped[0].code
        );
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      if (step === 'welcome') {
        sessionStorage.removeItem('vagou_register_wizard_draft');
        return;
      }
      sessionStorage.setItem(
        'vagou_register_wizard_draft',
        JSON.stringify({
          step,
          phone,
          confirmPhone,
          name,
          username,
          confirmUsername,
          email,
          confirmEmail,
          cep,
          street,
          addressNumber,
          complement,
          neighborhood,
          city,
          uf,
          cameFromManualCep,
        })
      );
    } catch {}
  }, [
    step,
    phone,
    confirmPhone,
    name,
    username,
    confirmUsername,
    email,
    confirmEmail,
    cep,
    street,
    addressNumber,
    complement,
    neighborhood,
    city,
    uf,
    cameFromManualCep,
  ]);

  const checkUserFieldConflict = useCallback(
    async (params: {
      phone?: string;
      username?: string;
      email?: string;
    }): Promise<{ conflict: boolean; field?: string; message?: string }> => {
      const apiCandidates = [
        '/api/public/check-user-conflict',
        'https://ais-pre-vk4cbfzrlyp7qy3ovw7223-465857221829.us-west1.run.app/api/public/check-user-conflict',
        'https://ais-dev-vk4cbfzrlyp7qy3ovw7223-465857221829.us-west1.run.app/api/public/check-user-conflict',
      ];

      for (const endpoint of apiCandidates) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const json = await res.json();
            if (
              json &&
              (typeof json.conflict === 'boolean' || typeof json.hasConflict === 'boolean')
            ) {
              return {
                conflict: Boolean(json.conflict ?? json.hasConflict),
                field: json.field || json.conflictField,
                message: json.message,
              };
            }
          }
        } catch {}
      }

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: rpcConflict, error: rpcErr } = await (supabase.rpc as any)(
            'check_triade_user_conflict',
            {
              p_phone: params.phone || null,
              p_username: params.username || null,
              p_email: params.email || null,
              p_cpf: null,
            }
          );
          if (!rpcErr && rpcConflict && typeof rpcConflict.has_conflict === 'boolean') {
            return {
              conflict: Boolean(rpcConflict.has_conflict),
              field: rpcConflict.conflict_field || undefined,
              message: rpcConflict.message || undefined,
            };
          }
        } catch {}

        try {
          const singleIdentifier = params.username || params.email || params.phone || '';
          if (singleIdentifier) {
            const { data: resolvedRows } = await (supabase.rpc as any)(
              'resolve_triade_login_account',
              { p_identifier: singleIdentifier }
            );
            if (Array.isArray(resolvedRows) && resolvedRows.length > 0) {
              const pDigits = normalizeBrazilPhoneDigits(params.phone || '');
              const uClean = String(params.username || '')
                .trim()
                .replace(/^@+/, '')
                .toLowerCase();
              const eClean = String(params.email || '').trim().toLowerCase();

              for (const row of resolvedRows) {
                const rUser = String(row?.username || '')
                  .trim()
                  .replace(/^@+/, '')
                  .toLowerCase();
                const rEmail = String(row?.email || '').trim().toLowerCase();
                const rPhone = String(row?.phone || '');

                if (uClean && rUser && rUser === uClean) {
                  return {
                    conflict: true,
                    field: 'username',
                    message: `O nome de usuário "${params.username}" já está cadastrado no sistema. Escolha outro.`,
                  };
                }
                if (eClean && rEmail && rEmail === eClean) {
                  return {
                    conflict: true,
                    field: 'email',
                    message: `O e-mail "${params.email}" já está cadastrado no sistema. Faça login ou utilize outro e-mail.`,
                  };
                }
                if (pDigits.length >= 10 && phonesMatchBrazil(pDigits, rPhone)) {
                  return {
                    conflict: true,
                    field: 'phone',
                    message: `O celular "${params.phone}" já está vinculado a uma conta cadastrada. Faça login ou utilize outro número.`,
                  };
                }
              }
            }
          }
        } catch {}

        try {
          const { data: globalPref } = await (supabase.from('admin_preferences' as any) as any)
            .select('preferences')
            .eq('id', 'global')
            .maybeSingle();

          const allEntries: any[] = Array.isArray(globalPref?.preferences?.auth_directory)
            ? globalPref.preferences.auth_directory
            : [];

          const pDigits = normalizeBrazilPhoneDigits(params.phone || '');
          if (pDigits.length >= 10) {
            const hasPhone = allEntries.some((row) =>
              phonesMatchBrazil(pDigits, String(row?.phone || ''))
            );
            if (hasPhone) {
              return {
                conflict: true,
                field: 'phone',
                message: `O celular "${params.phone}" já está vinculado a uma conta cadastrada. Faça login ou utilize outro número.`,
              };
            }
          }

          const uClean = String(params.username || '')
            .trim()
            .replace(/^@+/, '')
            .toLowerCase();
          if (uClean.length >= 2) {
            const hasUser = allEntries.some((row) => {
              const rUser = String(row?.username || '')
                .trim()
                .replace(/^@+/, '')
                .toLowerCase();
              return rUser && rUser === uClean;
            });
            if (hasUser) {
              return {
                conflict: true,
                field: 'username',
                message: `O nome de usuário "${params.username}" já está cadastrado no sistema. Escolha outro.`,
              };
            }
          }

          const eClean = String(params.email || '').trim().toLowerCase();
          if (eClean.includes('@')) {
            const hasEmail = allEntries.some((row) => {
              const rEmail = String(row?.email || '').trim().toLowerCase();
              return rEmail && rEmail === eClean;
            });
            if (hasEmail) {
              return {
                conflict: true,
                field: 'email',
                message: `O e-mail "${params.email}" já está cadastrado no sistema. Faça login ou utilize outro e-mail.`,
              };
            }
          }
        } catch {}
      }

      return { conflict: false };
    },
    []
  );

  const phoneDigits = phone.replace(/\D/g, '');
  const confirmPhoneDigits = confirmPhone.replace(/\D/g, '');
  const isPhoneFormatValid = phoneDigits.length >= 10 && phoneDigits.length <= 11;

  const verifyPhoneNow = useCallback(
    async (rawPhone: string): Promise<boolean> => {
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) {
        setPhoneCheck(INITIAL_FIELD_CHECK);
        return false;
      }
      setPhoneCheck({
        status: 'checking',
        message: 'Verificando celular no banco de dados...',
        checkedValue: digits,
      });
      const res = await checkUserFieldConflict({ phone: rawPhone.trim() });
      if (res.conflict) {
        setPhoneCheck({
          status: 'taken',
          message:
            res.message ||
            'Este celular / WhatsApp já está cadastrado no sistema. Faça login ou utilize outro número.',
          checkedValue: digits,
        });
        return false;
      }
      setPhoneCheck({
        status: 'available',
        message: 'Celular disponível para cadastro.',
        checkedValue: digits,
      });
      return true;
    },
    [checkUserFieldConflict]
  );

  useEffect(() => {
    if (!isPhoneFormatValid) {
      setPhoneCheck(INITIAL_FIELD_CHECK);
      return;
    }
    let cancelled = false;
    setPhoneCheck({
      status: 'checking',
      message: 'Verificando celular no banco de dados...',
      checkedValue: phoneDigits,
    });

    const timer = setTimeout(async () => {
      const res = await checkUserFieldConflict({ phone: phone.trim() });
      if (cancelled) return;
      if (res.conflict) {
        setPhoneCheck({
          status: 'taken',
          message:
            res.message ||
            'Este celular / WhatsApp já está cadastrado no sistema. Faça login ou utilize outro número.',
          checkedValue: phoneDigits,
        });
      } else {
        setPhoneCheck({
          status: 'available',
          message: 'Celular disponível para cadastro.',
          checkedValue: phoneDigits,
        });
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone, phoneDigits, isPhoneFormatValid, checkUserFieldConflict]);

  const isContactValid =
    isPhoneFormatValid &&
    phoneDigits === confirmPhoneDigits &&
    phoneCheck.status === 'available' &&
    phoneCheck.checkedValue === phoneDigits;

  const cleanName = name.trim();
  const cleanUsername = username.trim().replace(/^@+/, '');
  const cleanConfirmUsername = confirmUsername.trim().replace(/^@+/, '');
  const userRules = {
    hasMinLen: cleanUsername.length >= 3,
    hasUpper: /[A-ZÀ-Ý]/.test(cleanUsername),
    hasLower: /[a-zà-ÿ]/.test(cleanUsername),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(cleanUsername),
  };
  const isUsernameFormatValid =
    userRules.hasMinLen && userRules.hasUpper && userRules.hasLower && userRules.hasSpecial;
  const isUsernameConfirmed =
    isUsernameFormatValid &&
    cleanConfirmUsername.length >= 3 &&
    cleanUsername === cleanConfirmUsername;

  const verifyUsernameNow = useCallback(
    async (rawUser: string): Promise<boolean> => {
      const cleanU = rawUser.trim().replace(/^@+/, '');
      if (
        cleanU.length < 3 ||
        !/[A-ZÀ-Ý]/.test(cleanU) ||
        !/[a-zà-ÿ]/.test(cleanU) ||
        !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(cleanU)
      ) {
        setUsernameCheck(INITIAL_FIELD_CHECK);
        return false;
      }
      const lower = cleanU.toLowerCase();
      setUsernameCheck({
        status: 'checking',
        message: 'Verificando disponibilidade do usuário...',
        checkedValue: lower,
      });
      const res = await checkUserFieldConflict({ username: cleanU });
      if (res.conflict) {
        setUsernameCheck({
          status: 'taken',
          message: res.message || 'Este nome de usuário já está cadastrado. Escolha outro.',
          checkedValue: lower,
        });
        return false;
      }
      setUsernameCheck({
        status: 'available',
        message: 'Nome de usuário disponível.',
        checkedValue: lower,
      });
      return true;
    },
    [checkUserFieldConflict]
  );

  useEffect(() => {
    if (!isUsernameFormatValid) {
      setUsernameCheck(INITIAL_FIELD_CHECK);
      return;
    }
    let cancelled = false;
    const targetLower = cleanUsername.toLowerCase();
    setUsernameCheck({
      status: 'checking',
      message: 'Verificando disponibilidade do usuário...',
      checkedValue: targetLower,
    });

    const timer = setTimeout(async () => {
      const res = await checkUserFieldConflict({ username: cleanUsername });
      if (cancelled) return;
      if (res.conflict) {
        setUsernameCheck({
          status: 'taken',
          message: res.message || 'Este nome de usuário já está cadastrado. Escolha outro.',
          checkedValue: targetLower,
        });
      } else {
        setUsernameCheck({
          status: 'available',
          message: 'Nome de usuário disponível.',
          checkedValue: targetLower,
        });
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleanUsername, isUsernameFormatValid, checkUserFieldConflict]);

  const isNameValid =
    cleanName.length >= 2 &&
    isUsernameFormatValid &&
    isUsernameConfirmed &&
    usernameCheck.status === 'available' &&
    usernameCheck.checkedValue === cleanUsername.toLowerCase();

  const cleanEmail = email.trim().toLowerCase();
  const cleanConfirmEmail = confirmEmail.trim().toLowerCase();
  const isEmailFormatValid = isValidEmail(cleanEmail);

  const verifyEmailNow = useCallback(
    async (rawEmail: string): Promise<boolean> => {
      const normalized = rawEmail.trim().toLowerCase();
      if (!isValidEmail(normalized)) {
        setEmailCheck(INITIAL_FIELD_CHECK);
        return false;
      }
      setEmailCheck({
        status: 'checking',
        message: 'Verificando e-mail no banco de dados...',
        checkedValue: normalized,
      });
      const res = await checkUserFieldConflict({ email: normalized });
      if (res.conflict) {
        setEmailCheck({
          status: 'taken',
          message:
            res.message ||
            'Este e-mail já está cadastrado no sistema. Faça login ou utilize outro e-mail.',
          checkedValue: normalized,
        });
        return false;
      }
      setEmailCheck({
        status: 'available',
        message: 'E-mail disponível para cadastro.',
        checkedValue: normalized,
      });
      return true;
    },
    [checkUserFieldConflict]
  );

  useEffect(() => {
    if (!isEmailFormatValid) {
      setEmailCheck(INITIAL_FIELD_CHECK);
      return;
    }
    let cancelled = false;
    setEmailCheck({
      status: 'checking',
      message: 'Verificando e-mail no banco de dados...',
      checkedValue: cleanEmail,
    });

    const timer = setTimeout(async () => {
      const res = await checkUserFieldConflict({ email: cleanEmail });
      if (cancelled) return;
      if (res.conflict) {
        setEmailCheck({
          status: 'taken',
          message:
            res.message ||
            'Este e-mail já está cadastrado no sistema. Faça login ou utilize outro e-mail.',
          checkedValue: cleanEmail,
        });
      } else {
        setEmailCheck({
          status: 'available',
          message: 'E-mail disponível para cadastro.',
          checkedValue: cleanEmail,
        });
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleanEmail, isEmailFormatValid, checkUserFieldConflict]);

  const isEmailStepValid =
    isEmailFormatValid &&
    cleanEmail === cleanConfirmEmail &&
    emailCheck.status === 'available' &&
    emailCheck.checkedValue === cleanEmail;

  useEffect(() => {
    if (step !== 'address_summary' || !shouldReverseLookupRef.current || manualCepLockedRef.current) {
      return;
    }

    const cleanStreet = street.trim();
    const cleanNeighborhood = neighborhood.trim();
    const cleanCity = city.trim();
    const cleanUf = uf.trim().toUpperCase();

    const normStreetCore = stripStreetPrefix(cleanStreet);
    const normNeighborhood = normalizeText(cleanNeighborhood);
    const normCity = normalizeText(cleanCity);

    if (
      normStreetCore.length < 3 ||
      normNeighborhood.length < 2 ||
      normCity.length < 3 ||
      cleanUf.length !== 2
    ) {
      setIsReverseLookingUpCep(false);
      return;
    }

    let cancelled = false;
    setIsReverseLookingUpCep(true);

    const timer = setTimeout(async () => {
      try {
        const streetQueries = Array.from(
          new Set([normStreetCore, cleanStreet].filter((q) => q.length >= 3))
        );

        let foundCepDigits = '';

        for (const streetQuery of streetQueries) {
          if (cancelled || foundCepDigits) break;
          try {
            const url = `https://viacep.com.br/ws/${encodeURIComponent(cleanUf)}/${encodeURIComponent(cleanCity)}/${encodeURIComponent(streetQuery)}/json/`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                const exactMatch =
                  data.find((item: any) => {
                    const itemStreetCore = stripStreetPrefix(String(item?.logradouro || ''));
                    const itemBairro = normalizeText(String(item?.bairro || ''));
                    const itemCity = normalizeText(String(item?.localidade || ''));
                    const itemUf = String(item?.uf || '').trim().toUpperCase();
                    return (
                      itemStreetCore === normStreetCore &&
                      itemBairro === normNeighborhood &&
                      itemCity === normCity &&
                      itemUf === cleanUf
                    );
                  }) || data[0];

                if (exactMatch) {
                  const rawCep = String(exactMatch?.cep || '').replace(/\D/g, '');
                  if (rawCep.length === 8) {
                    foundCepDigits = rawCep;
                  }
                }
              }
            }
          } catch {}
        }

        if (!foundCepDigits && !cancelled) {
          try {
            const queryParts = [cleanStreet, cleanNeighborhood, cleanCity, cleanUf, 'Brasil']
              .filter(Boolean)
              .join(', ');
            const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=br&limit=5&q=${encodeURIComponent(queryParts)}`;
            const nomRes = await fetch(nomUrl, {
              headers: { 'Accept-Language': 'pt-BR' },
            });
            if (nomRes.ok) {
              const nomData = await nomRes.json();
              if (Array.isArray(nomData) && nomData.length > 0) {
                for (const item of nomData) {
                  const addr = item?.address || {};
                  const rawPostcode = String(addr.postcode || '').replace(/\D/g, '');
                  if (rawPostcode.length === 8) {
                    foundCepDigits = rawPostcode;
                    break;
                  }
                }
              }
            }
          } catch {}
        }

        if (!cancelled && foundCepDigits.length === 8) {
          setCep(formatCEP(foundCepDigits));
        }
      } finally {
        if (!cancelled) {
          setIsReverseLookingUpCep(false);
        }
      }
    }, 380);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, street, neighborhood, city, uf]);

  const cepDigits = cep.replace(/\D/g, '');
  const isCepStepValid = cepDigits.length === 8;

  const isAddressNumValid =
    cepDigits.length === 8 &&
    street.trim().length >= 2 &&
    !cepNotFound &&
    !isLookingUpCep &&
    addressNumber.trim().length >= 1;

  const missingAddressFields: string[] = [];
  if (street.trim().length < 2) missingAddressFields.push('Endereço');
  if (addressNumber.trim().length < 1) missingAddressFields.push('Número');
  if (neighborhood.trim().length < 2) missingAddressFields.push('Bairro');
  if (city.trim().length < 2) missingAddressFields.push('Cidade');
  if (uf.trim().length !== 2) missingAddressFields.push('UF');
  if (cepDigits.length !== 8) missingAddressFields.push('CEP (8 dígitos)');

  const isAddressSummaryValid = missingAddressFields.length === 0;

  const hasMinLength = password.trim().length >= 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9\s]/.test(password);
  const passwordsMatch =
    password.trim().length > 0 && password.trim() === confirmPassword.trim();
  const isSecurityAnswerValid = normalizeText(securityAnswer).length >= 2;
  const isPasswordStepValid =
    hasMinLength && hasUpperCase && hasSpecialChar && passwordsMatch && isSecurityAnswerValid;

  const lookupCepAndAdvance = async (rawCepValue: string, autoAdvance = true) => {
    const digits = rawCepValue.replace(/\D/g, '');
    if (digits.length !== 8) return;

    setFeedback(null);
    setCepNotFound(false);
    setIsLookingUpCep(true);

    try {
      let foundData: {
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      } | null = null;

      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        if (res.ok) {
          const json = await res.json();
          if (json && !json.erro && (json.logradouro || json.localidade)) {
            foundData = {
              logradouro: json.logradouro || '',
              bairro: json.bairro || '',
              localidade: json.localidade || '',
              uf: json.uf || '',
            };
          }
        }
      } catch {}

      if (!foundData) {
        try {
          const resBr = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`);
          if (resBr.ok) {
            const jsonBr = await resBr.json();
            if (jsonBr && (jsonBr.street || jsonBr.city)) {
              foundData = {
                logradouro: jsonBr.street || '',
                bairro: jsonBr.neighborhood || '',
                localidade: jsonBr.city || '',
                uf: jsonBr.state || '',
              };
            }
          }
        } catch {}
      }

      setIsLookingUpCep(false);

      if (!foundData) {
        setStreet('');
        setNeighborhood('');
        setCity('');
        setUf('');
        setCepNotFound(true);
        return;
      }

      shouldReverseLookupRef.current = false;
      manualCepLockedRef.current = false;
      setStreet(foundData.logradouro || '');
      setNeighborhood(foundData.bairro || '');
      setCity(foundData.localidade || '');
      setUf((foundData.uf || '').toUpperCase());
      setCameFromManualCep(false);

      if (autoAdvance) {
        setStep('address_num');
      }
    } catch {
      setIsLookingUpCep(false);
      setStreet('');
      setNeighborhood('');
      setCity('');
      setUf('');
      setCepNotFound(true);
    }
  };

  const handleCepInputChange = (val: string) => {
    const formatted = formatCEP(val);
    setCep(formatted);
    setCepNotFound(false);
    setFeedback(null);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      lookupCepAndAdvance(digits, true);
    } else {
      setStreet('');
      setNeighborhood('');
      setCity('');
      setUf('');
    }
  };

  const handleAdvanceContactStep = async () => {
    if (isLoading) return;
    setFeedback(null);
    if (!isPhoneFormatValid) {
      setFeedback({ type: 'error', message: 'Digite um celular / WhatsApp válido com DDD.' });
      return;
    }
    if (phoneDigits !== confirmPhoneDigits) {
      setFeedback({ type: 'error', message: 'Os números de celular digitados não coincidem.' });
      return;
    }
    setIsLoading(true);
    try {
      const ok =
        phoneCheck.status === 'available' && phoneCheck.checkedValue === phoneDigits
          ? true
          : await verifyPhoneNow(phone);
      if (!ok) return;
      setStep('name');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvanceNameStep = async () => {
    if (isLoading) return;
    setFeedback(null);
    if (cleanName.length < 2) {
      setFeedback({ type: 'error', message: 'Informe seu nome completo.' });
      return;
    }
    if (!isUsernameFormatValid) {
      setFeedback({
        type: 'error',
        message:
          'O nome de usuário deve conter ao menos 3 caracteres, 1 maiúscula, 1 minúscula e 1 caractere especial (Ex: João@).',
      });
      return;
    }
    if (!isUsernameConfirmed) {
      setFeedback({ type: 'error', message: 'Os nomes de usuário digitados não coincidem.' });
      return;
    }
    setIsLoading(true);
    try {
      const ok =
        usernameCheck.status === 'available' &&
        usernameCheck.checkedValue === cleanUsername.toLowerCase()
          ? true
          : await verifyUsernameNow(cleanUsername);
      if (!ok) return;
      setStep('email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvanceEmailStep = async () => {
    if (isLoading) return;
    setFeedback(null);
    setEmailTouched(true);
    if (!isEmailFormatValid) {
      setFeedback({ type: 'error', message: 'Informe um endereço de e-mail válido.' });
      return;
    }
    if (cleanEmail !== cleanConfirmEmail) {
      setFeedback({ type: 'error', message: 'Os e-mails informados não coincidem.' });
      return;
    }
    setIsLoading(true);
    try {
      const ok =
        emailCheck.status === 'available' && emailCheck.checkedValue === cleanEmail
          ? true
          : await verifyEmailNow(cleanEmail);
      if (!ok) return;
      setStep('address_cep');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isPhoneFormatValid) {
      setFeedback({ type: 'error', message: 'Informe um celular / WhatsApp válido.' });
      setStep('contact');
      return;
    }

    if (cleanName.length < 2 || !isUsernameFormatValid) {
      setFeedback({
        type: 'error',
        message:
          'Verifique seu nome completo e o nome de usuário (1 maiúscula, 1 minúscula e 1 caractere especial).',
      });
      setStep('name');
      return;
    }

    if (!isEmailFormatValid) {
      setFeedback({ type: 'error', message: 'Informe um e-mail válido.' });
      setStep('email');
      return;
    }

    if (!isAddressSummaryValid) {
      setFeedback({
        type: 'error',
        message: `Complete seu endereço antes de finalizar: ${missingAddressFields.join(', ')}.`,
      });
      setStep('address_summary');
      return;
    }

    if (!hasMinLength || !hasUpperCase || !hasSpecialChar || !passwordsMatch) {
      setFeedback({
        type: 'error',
        message:
          'A senha deve ter no mínimo 6 caracteres, 1 letra maiúscula, 1 caractere especial e confirmação idêntica.',
      });
      return;
    }

    if (!isSecurityAnswerValid) {
      setFeedback({
        type: 'error',
        message: 'Informe uma resposta secreta (mínimo 2 caracteres) para recuperar sua conta.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const cleanPass = password.trim();
      const normalizedUsername = cleanUsername;
      const effectiveNum = addressNumber.trim() || 'S/N';
      const fullAddressString = `${street.trim()}, ${effectiveNum}${
        complement.trim() ? ` (${complement.trim()})` : ''
      } - ${neighborhood.trim()}, ${city.trim()} - ${uf.trim().toUpperCase()}${
        cep.trim() ? `, ${formatCEP(cep)}` : ''
      }`;

      const addressObj: TriadeUserAddressData = {
        cep: formatCEP(cep),
        street: street.trim(),
        number: effectiveNum,
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        uf: uf.trim().toUpperCase(),
      };

      const selectedSecQ =
        securityQuestions.find((q) => q.code === securityQuestionCode) || securityQuestions[0];
      const canonicalSecCode = normalizeSecurityQuestionCode(selectedSecQ?.code);
      const normalizedSecAnswer = normalizeText(securityAnswer);

      const preCheck = await checkUserFieldConflict({
        phone: phone.trim(),
        username: normalizedUsername,
        email: cleanEmail,
      });

      if (preCheck.conflict) {
        if (preCheck.field === 'phone') {
          setPhoneCheck({
            status: 'taken',
            message: preCheck.message || 'Celular já cadastrado.',
            checkedValue: phoneDigits,
          });
          setStep('contact');
        } else if (preCheck.field === 'username') {
          setUsernameCheck({
            status: 'taken',
            message: preCheck.message || 'Nome de usuário já cadastrado.',
            checkedValue: normalizedUsername.toLowerCase(),
          });
          setStep('name');
        } else if (preCheck.field === 'email') {
          setEmailCheck({
            status: 'taken',
            message: preCheck.message || 'E-mail já cadastrado.',
            checkedValue: cleanEmail,
          });
          setStep('email');
        }
        throw new Error(
          preCheck.message || 'Já existe um cadastro com estes dados no sistema.'
        );
      }

      let persistedUserId = '';
      let persistedClientId = '';
      let apiRespondedWithJson = false;

      const registerPayload = {
        full_name: cleanName,
        username: normalizedUsername,
        email: cleanEmail,
        phone: phone.trim(),
        password: cleanPass,
        address: addressObj.street,
        street: addressObj.street,
        number: addressObj.number,
        complement: addressObj.complement,
        neighborhood: addressObj.neighborhood,
        city: addressObj.city,
        uf: addressObj.uf,
        cep: addressObj.cep,
        formatted_address: fullAddressString,
        security_question_code: canonicalSecCode,
        security_answer: normalizedSecAnswer,
        account_type: 'client',
      };

      const apiRegisterCandidates = [
        '/api/public/register-user',
        'https://ais-pre-vk4cbfzrlyp7qy3ovw7223-465857221829.us-west1.run.app/api/public/register-user',
        'https://ais-dev-vk4cbfzrlyp7qy3ovw7223-465857221829.us-west1.run.app/api/public/register-user',
      ];

      for (const endpoint of apiRegisterCandidates) {
        if (persistedUserId) break;
        let res: Response | null = null;
        try {
          res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerPayload),
          });
        } catch {
          continue;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) continue;

        apiRespondedWithJson = true;
        const apiJson = await res.json();

        if (!res.ok || apiJson?.success === false || apiJson?.conflict) {
          const errField = apiJson?.field || apiJson?.conflictField;
          const errMsg =
            apiJson?.error || 'Não foi possível concluir o cadastro. Verifique os dados informados.';
          const isConflictError =
            res.status === 409 || Boolean(apiJson?.conflict || apiJson?.hasConflict);

          if (errField === 'phone') {
            if (isConflictError) {
              setPhoneCheck({ status: 'taken', message: errMsg, checkedValue: phoneDigits });
            }
            setStep('contact');
          } else if (errField === 'username') {
            if (isConflictError) {
              setUsernameCheck({
                status: 'taken',
                message: errMsg,
                checkedValue: normalizedUsername.toLowerCase(),
              });
            }
            setStep('name');
          } else if (errField === 'email') {
            if (isConflictError) {
              setEmailCheck({ status: 'taken', message: errMsg, checkedValue: cleanEmail });
            }
            setStep('email');
          }

          throw new Error(errMsg);
        }

        if (apiJson?.success && apiJson?.userId) {
          persistedUserId = String(apiJson.userId);
          persistedClientId = String(apiJson?.client?.id || apiJson.clientId || apiJson.userId);
          if (
            isSupabaseConfigured &&
            supabase &&
            apiJson?.session?.access_token &&
            apiJson?.session?.refresh_token
          ) {
            try {
              await supabase.auth.setSession({
                access_token: apiJson.session.access_token,
                refresh_token: apiJson.session.refresh_token,
              });
            } catch {}
          }
          break;
        }
      }

      if (!persistedUserId && !apiRespondedWithJson && isSupabaseConfigured && supabase) {
        const metadata: Record<string, any> = {
          full_name: cleanName,
          name: cleanName,
          phone: phone.trim(),
          username: normalizedUsername,
          address: fullAddressString,
          formatted_address: fullAddressString,
          cep: addressObj.cep,
          street: addressObj.street,
          number: addressObj.number,
          complement: addressObj.complement,
          neighborhood: addressObj.neighborhood,
          city: addressObj.city,
          uf: addressObj.uf,
          security_question_code: canonicalSecCode,
          security_answer: normalizedSecAnswer,
          created_via: 'mnvapp',
        };

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: { data: metadata },
        });

        if (signUpError) {
          const msgLower = String(signUpError.message || '').toLowerCase();
          if (msgLower.includes('already registered') || msgLower.includes('already exists')) {
            setEmailCheck({
              status: 'taken',
              message: 'Este e-mail já está cadastrado no sistema.',
              checkedValue: cleanEmail,
            });
            setStep('email');
            throw new Error(
              'Este e-mail já está cadastrado no sistema. Faça login ou utilize outro e-mail.'
            );
          }
          if (msgLower.includes('rate limit') || msgLower.includes('over_email_send_rate_limit')) {
            throw new Error(
              'Limite temporário de envio atingido. Aguarde 60 segundos e tente novamente.'
            );
          }
          throw new Error(signUpError.message || 'Falha ao registrar usuário no Supabase.');
        }

        if (
          Array.isArray(signUpData?.user?.identities) &&
          signUpData.user.identities.length === 0
        ) {
          setEmailCheck({
            status: 'taken',
            message: 'Este e-mail já está cadastrado no sistema.',
            checkedValue: cleanEmail,
          });
          setStep('email');
          throw new Error(
            'Este e-mail já está cadastrado no sistema. Faça login ou utilize outro e-mail.'
          );
        }

        if (!signUpData?.user?.id) {
          throw new Error(
            'O banco de dados não confirmou a criação do usuário. Verifique sua conexão e tente novamente.'
          );
        }

        persistedUserId = String(signUpData.user.id);

        try {
          await (supabase.from('profiles' as any) as any)
            .update({
              full_name: cleanName,
              username: normalizedUsername,
              phone: phone.trim(),
              address: addressObj.street,
              street_number: addressObj.number,
              complement: addressObj.complement,
              neighborhood: addressObj.neighborhood,
              city: addressObj.city,
              state: addressObj.uf,
              cep: addressObj.cep,
              formatted_address: fullAddressString,
            })
            .eq('id', persistedUserId);
        } catch {}

        try {
          const clientPayload = {
            user_id: persistedUserId,
            full_name: cleanName,
            email: cleanEmail,
            phone: phone.trim(),
            address: addressObj.street,
            street_number: addressObj.number,
            complement: addressObj.complement,
            neighborhood: addressObj.neighborhood,
            city: addressObj.city,
            state: addressObj.uf,
            cep: addressObj.cep,
            formatted_address: fullAddressString,
            security_question_code: canonicalSecCode,
            is_active: true,
          };

          const { data: existingClient } = await (supabase.from('clients') as any)
            .select('id')
            .eq('user_id', persistedUserId)
            .limit(1)
            .maybeSingle();

          const { data: savedClientRow } = existingClient?.id
            ? await (supabase.from('clients') as any)
                .update(clientPayload)
                .eq('id', existingClient.id)
                .select('id, user_id')
                .maybeSingle()
            : await (supabase.from('clients') as any)
                .insert(clientPayload)
                .select('id, user_id')
                .maybeSingle();

          if (savedClientRow?.id) {
            persistedClientId = String(savedClientRow.id);
          }
        } catch {}

        if (normalizedSecAnswer.length >= 2 && persistedClientId) {
          try {
            const { data: existingSecRow } = await (
              supabase.from('user_security_answers' as any) as any
            )
              .select('id')
              .eq('client_id', persistedClientId)
              .eq('question_code', canonicalSecCode)
              .limit(1)
              .maybeSingle();

            if (existingSecRow?.id) {
              await (supabase.from('user_security_answers' as any) as any)
                .update({ answer_hash: normalizedSecAnswer })
                .eq('id', existingSecRow.id);
            } else {
              await (supabase.from('user_security_answers' as any) as any).insert({
                client_id: persistedClientId,
                question_code: canonicalSecCode,
                answer_hash: normalizedSecAnswer,
              });
            }
          } catch {}
        }

        try {
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPass,
          });
        } catch {}
      }

      if (!persistedUserId) {
        throw new Error(
          'Não foi possível gravar o usuário no banco de dados Supabase. Tente novamente.'
        );
      }

      try {
        localStorage.setItem('vagou_user_home_address', fullAddressString);
        localStorage.setItem('vagou_user_address_json', JSON.stringify(addressObj));
      } catch {}

      if (normalizedSecAnswer.length >= 2) {
        try {
          const prevAnswers = JSON.parse(
            localStorage.getItem('vagou_user_security_answers') || '[]'
          );
          const nextAnswers = Array.isArray(prevAnswers) ? prevAnswers : [];
          nextAnswers.push({
            userId: persistedUserId,
            clientId: persistedClientId || persistedUserId,
            username: normalizedUsername,
            name: cleanName,
            email: cleanEmail,
            questionCode: canonicalSecCode,
            answer: normalizedSecAnswer,
          });
          localStorage.setItem('vagou_user_security_answers', JSON.stringify(nextAnswers));
        } catch {}
      }

      const resultData: TriadeUserData = {
        id: persistedUserId,
        name: cleanName,
        username: normalizedUsername,
        email: cleanEmail,
        phone: phone.trim(),
        address: addressObj,
        accountType: 'client',
      };

      setIsLoading(false);
      onSuccess?.(resultData, { keepModalOpen: true });
      setStep('welcome');
    } catch (err: any) {
      setIsLoading(false);
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao concluir o cadastro no banco de dados.',
      });
    }
  };

  const stepMeta: Record<RegisterWizardStep, { index: number; total: number; label: string }> = {
    contact: { index: 1, total: 5, label: 'Contato' },
    name: { index: 2, total: 5, label: 'Nome e Usuário' },
    email: { index: 3, total: 5, label: 'E-mail' },
    address_cep: { index: 4, total: 5, label: 'Endereço (CEP)' },
    address_num: { index: 4, total: 5, label: 'Número e Complemento' },
    address_summary: { index: 4, total: 5, label: 'Resumo de Endereço' },
    password: { index: 5, total: 5, label: 'Senha e Segurança' },
    welcome: { index: 5, total: 5, label: 'Boas-Vindas' },
  };

  const currentMeta = stepMeta[step];
  const resolvedSalonTitle = salonName || 'VagouApp';
  const selectedQuestionObj =
    securityQuestions.find((q) => q.code === securityQuestionCode) || securityQuestions[0];

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
          brandMode="vagou"
          subtitle={`CRIAR CONTA • ${currentMeta.label}`}
          onClose={step === 'welcome' ? onClose : onSwitchToLogin || onClose}
        />
      )}

      <div className="px-6 pb-6 pt-2">
        {step !== 'welcome' && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
              <span className="text-accent uppercase tracking-wider">{currentMeta.label}</span>
              <span>
                Fase {currentMeta.index} de {currentMeta.total}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-[4px] transition-all ${
                    idx <= currentMeta.index ? 'bg-accent' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`p-3 rounded-[4px] mb-4 text-xs font-semibold flex items-center gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
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

        {step === 'contact' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Digite seu Celular / WhatsApp
              </label>
              <div
                className={`flex items-center bg-slate-950 border rounded-[4px] px-3 py-2.5 transition ${
                  phoneCheck.status === 'taken'
                    ? 'border-rose-500 focus-within:border-rose-500'
                    : phoneCheck.status === 'available'
                      ? 'border-emerald-500/60 focus-within:border-emerald-500'
                      : 'border-slate-800 focus-within:border-emerald-500'
                }`}
              >
                <Phone className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhoneBR(e.target.value));
                    setFeedback(null);
                  }}
                  onBlur={() => {
                    if (isPhoneFormatValid && phoneCheck.checkedValue !== phoneDigits) {
                      verifyPhoneNow(phone);
                    }
                  }}
                  placeholder="(11) 99999-9999"
                  autoFocus
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {phoneCheck.status === 'checking' && (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0 ml-2" />
                )}
                {phoneCheck.status === 'available' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                )}
                {phoneCheck.status === 'taken' && (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                )}
              </div>
              {phoneCheck.status === 'checking' && (
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  {phoneCheck.message}
                </p>
              )}
              {phoneCheck.status === 'available' && (
                <p className="text-[11px] text-emerald-400 font-medium mt-1">
                  {phoneCheck.message}
                </p>
              )}
              {phoneCheck.status === 'taken' && (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[11px] text-rose-400 font-medium">{phoneCheck.message}</p>
                  {onSwitchToLogin && (
                    <button
                      type="button"
                      onClick={onSwitchToLogin}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      Já tem conta? Ir para o login
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirme seu Celular / WhatsApp
              </label>
              <div
                className={`flex items-center bg-slate-950 border rounded-[4px] px-3 py-2.5 transition ${
                  confirmPhoneDigits.length >= 10 && phoneDigits !== confirmPhoneDigits
                    ? 'border-rose-500 focus-within:border-rose-500'
                    : isPhoneFormatValid && phoneDigits === confirmPhoneDigits
                      ? 'border-emerald-500/60 focus-within:border-emerald-500'
                      : 'border-slate-800 focus-within:border-emerald-500'
                }`}
              >
                <Phone className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="tel"
                  value={confirmPhone}
                  onChange={(e) => {
                    setConfirmPhone(formatPhoneBR(e.target.value));
                    setFeedback(null);
                  }}
                  placeholder="Repita seu (11) 99999-9999"
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {isPhoneFormatValid && phoneDigits === confirmPhoneDigits && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                )}
                {confirmPhoneDigits.length >= 10 && phoneDigits !== confirmPhoneDigits && (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                )}
              </div>
              {confirmPhoneDigits.length >= 10 && phoneDigits !== confirmPhoneDigits && (
                <p className="text-[11px] text-rose-400 font-medium mt-1">
                  Os números de celular digitados não coincidem.
                </p>
              )}
            </div>

            <div className="sticky bottom-0 z-20 pt-2 bg-slate-950/90">
              <button
                type="button"
                disabled={!isContactValid || isLoading || phoneCheck.status === 'checking'}
                onClick={handleAdvanceContactStep}
                className="w-full py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                {isLoading || phoneCheck.status === 'checking' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span className="text-white">Avançar</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome Completo
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
                <User className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Digite seu nome e sobrenome"
                  autoFocus
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
              </div>
              {name.length > 0 && cleanName.length < 2 && (
                <p className="text-[11px] text-amber-400 font-medium mt-1">
                  Informe pelo menos 2 caracteres para seu nome.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome de Usuário
              </label>
              <div
                className={`flex items-center bg-slate-950 border rounded-[4px] px-3 py-2.5 transition ${
                  usernameCheck.status === 'taken'
                    ? 'border-rose-500 focus-within:border-rose-500'
                    : cleanUsername.length > 0 && !isUsernameFormatValid
                      ? 'border-amber-500/60 focus-within:border-amber-500'
                      : usernameCheck.status === 'available'
                        ? 'border-emerald-500/60 focus-within:border-emerald-500'
                        : 'border-slate-800 focus-within:border-emerald-500'
                }`}
              >
                <AtSign className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/\s+/g, ''));
                    setFeedback(null);
                  }}
                  onBlur={() => {
                    if (
                      isUsernameFormatValid &&
                      usernameCheck.checkedValue !== cleanUsername.toLowerCase()
                    ) {
                      verifyUsernameNow(cleanUsername);
                    }
                  }}
                  placeholder="Ex: João@"
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {usernameCheck.status === 'checking' && (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0 ml-2" />
                )}
                {usernameCheck.status === 'available' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                )}
                {usernameCheck.status !== 'checking' &&
                  cleanUsername.length > 0 &&
                  (!isUsernameFormatValid || usernameCheck.status === 'taken') && (
                    <AlertCircle
                      className={`w-4 h-4 shrink-0 ml-2 ${
                        usernameCheck.status === 'taken' ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    />
                  )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-[4px] font-medium transition whitespace-nowrap ${
                    userRules.hasUpper
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  • 1 Maiúscula (A-Z)
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-[4px] font-medium transition whitespace-nowrap ${
                    userRules.hasLower
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  • 1 Minúscula (a-z)
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-[4px] font-medium transition whitespace-nowrap ${
                    userRules.hasSpecial
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  • 1 Especial (@, #, $, !)
                </span>
              </div>
              {usernameCheck.status === 'checking' && (
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  {usernameCheck.message}
                </p>
              )}
              {usernameCheck.status === 'taken' && (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[11px] text-rose-400 font-medium">{usernameCheck.message}</p>
                  {onSwitchToLogin && (
                    <button
                      type="button"
                      onClick={onSwitchToLogin}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      Já tem conta? Ir para o login
                    </button>
                  )}
                </div>
              )}
              {usernameCheck.status === 'available' && (
                <p className="text-[11px] text-emerald-400 font-medium mt-1">
                  {usernameCheck.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirme o Nome de Usuário
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
                <AtSign className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={confirmUsername}
                  onChange={(e) => {
                    setConfirmUsername(e.target.value.replace(/\s+/g, ''));
                    setFeedback(null);
                  }}
                  placeholder="Repita seu nome de usuário (Ex: João@)"
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {cleanConfirmUsername.length >= 2 && isUsernameConfirmed && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                )}
                {cleanConfirmUsername.length >= 2 && !isUsernameConfirmed && (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                )}
              </div>
              {cleanConfirmUsername.length >= 2 && cleanUsername !== cleanConfirmUsername && (
                <p className="text-[11px] text-rose-400 font-medium mt-1">
                  Os nomes de usuário digitados não coincidem.
                </p>
              )}
              {cleanConfirmUsername.length >= 2 &&
                cleanUsername === cleanConfirmUsername &&
                !isUsernameFormatValid && (
                  <p className="text-[11px] text-amber-400 font-medium mt-1">
                    O usuário deve ter 1 maiúscula, 1 minúscula e 1 caractere especial (Ex: João@).
                  </p>
                )}
            </div>

            <div className="sticky bottom-0 z-20 pt-2 bg-slate-950/90 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setStep('contact');
                }}
                className="py-3 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                disabled={!isNameValid || isLoading || usernameCheck.status === 'checking'}
                onClick={handleAdvanceNameStep}
                className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                {isLoading || usernameCheck.status === 'checking' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span className="text-white">Avançar</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'email' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                E-mail Principal
              </label>
              <div
                className={`flex items-center bg-slate-950 border rounded-[4px] px-3 py-2.5 transition ${
                  emailCheck.status === 'taken'
                    ? 'border-rose-500 focus-within:border-rose-500'
                    : emailTouched && cleanEmail.length > 0 && !isEmailFormatValid
                      ? 'border-amber-500/60 focus-within:border-amber-500'
                      : emailCheck.status === 'available'
                        ? 'border-emerald-500/60 focus-within:border-emerald-500'
                        : 'border-slate-800 focus-within:border-emerald-500'
                }`}
              >
                <Mail className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFeedback(null);
                  }}
                  onBlur={() => {
                    setEmailTouched(true);
                    if (isEmailFormatValid && emailCheck.checkedValue !== cleanEmail) {
                      verifyEmailNow(cleanEmail);
                    }
                  }}
                  placeholder="seu@email.com"
                  autoFocus
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {emailCheck.status === 'checking' && (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0 ml-2" />
                )}
                {emailCheck.status === 'available' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                )}
                {emailCheck.status === 'taken' && (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                )}
              </div>
              {emailTouched && cleanEmail.length > 0 && !isEmailFormatValid && (
                <p className="text-[11px] text-amber-400 font-medium mt-1">
                  Digite um endereço de e-mail válido (ex: nome@dominio.com).
                </p>
              )}
              {emailCheck.status === 'checking' && (
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  {emailCheck.message}
                </p>
              )}
              {emailCheck.status === 'available' && (
                <p className="text-[11px] text-emerald-400 font-medium mt-1">
                  {emailCheck.message}
                </p>
              )}
              {emailCheck.status === 'taken' && (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[11px] text-rose-400 font-medium">{emailCheck.message}</p>
                  {onSwitchToLogin && (
                    <button
                      type="button"
                      onClick={onSwitchToLogin}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      Já tem conta? Ir para o login
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirme seu E-mail
              </label>
              <div
                className={`flex items-center bg-slate-950 border rounded-[4px] px-3 py-2.5 transition ${
                  cleanConfirmEmail.length > 3 && cleanEmail !== cleanConfirmEmail
                    ? 'border-rose-500 focus-within:border-rose-500'
                    : isEmailFormatValid && cleanEmail === cleanConfirmEmail
                      ? 'border-emerald-500/60 focus-within:border-emerald-500'
                      : 'border-slate-800 focus-within:border-emerald-500'
                }`}
              >
                <Mail className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => {
                    setConfirmEmail(e.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Repita seu@email.com"
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {isEmailFormatValid && cleanEmail === cleanConfirmEmail && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                )}
                {cleanConfirmEmail.length > 3 && cleanEmail !== cleanConfirmEmail && (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                )}
              </div>
              {cleanConfirmEmail.length > 3 && cleanEmail !== cleanConfirmEmail && (
                <p className="text-[11px] text-rose-400 font-medium mt-1">
                  Os e-mails informados não coincidem.
                </p>
              )}
            </div>

            <div className="sticky bottom-0 z-20 pt-2 bg-slate-950/90 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setStep('name');
                }}
                className="py-3 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                disabled={!isEmailStepValid || isLoading || emailCheck.status === 'checking'}
                onClick={handleAdvanceEmailStep}
                className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                {isLoading || emailCheck.status === 'checking' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span className="text-white">Avançar</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'address_cep' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Digite seu CEP
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
                <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => handleCepInputChange(e.target.value)}
                  placeholder="12345-678"
                  maxLength={9}
                  autoFocus
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {isLookingUpCep && (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0 ml-2" />
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {cepNotFound && (
                <div className="p-3 rounded-[4px] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
                  CEP não encontrado. Confira os 8 dígitos ou clique em "Não sei meu CEP" para informar o endereço.
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setCepNotFound(false);
                  setCameFromManualCep(true);
                  shouldReverseLookupRef.current = true;
                  manualCepLockedRef.current = false;
                  setStep('address_summary');
                }}
                className="w-full py-2.5 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
              >
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>Não sei meu CEP</span>
              </button>
            </div>

            <div className="sticky bottom-0 z-20 pt-2 bg-slate-950/90 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setCepNotFound(false);
                  setStep('email');
                }}
                className="py-3 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                disabled={!isCepStepValid || isLookingUpCep}
                onClick={() => lookupCepAndAdvance(cepDigits, true)}
                className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                {isLookingUpCep ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span className="text-white">Avançar</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'address_num' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Digite seu CEP
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
                <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => handleCepInputChange(e.target.value)}
                  placeholder="12345-678"
                  maxLength={9}
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                {isLookingUpCep && (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0 ml-2" />
                )}
              </div>
            </div>

            {cepNotFound && (
              <div className="space-y-2.5">
                <div className="p-3 rounded-[4px] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
                  CEP não encontrado. Confira os 8 dígitos ou preencha o endereço manualmente.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCepNotFound(false);
                    setCameFromManualCep(true);
                    shouldReverseLookupRef.current = true;
                    manualCepLockedRef.current = false;
                    setStep('address_summary');
                  }}
                  className="w-full py-2.5 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                >
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  <span>Não sei meu CEP</span>
                </button>
              </div>
            )}

            {street && !cepNotFound && (
              <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-emerald-400 block truncate">{street}</span>
                <span className="text-[11px] text-slate-400 truncate block">
                  {neighborhood} • {city}/{uf} • CEP {formatCEP(cep)}
                </span>
              </div>
            )}

            <div className="flex items-start gap-2.5">
              <div className="w-[78px] shrink-0">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Número</label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-2 py-2.5 focus-within:border-emerald-500 transition">
                  <Hash className="w-3.5 h-3.5 text-emerald-400 mr-1 shrink-0" />
                  <input
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value.slice(0, 8))}
                    placeholder="123"
                    maxLength={8}
                    autoFocus
                    className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Complemento
                </label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-2.5 py-2.5 focus-within:border-emerald-500 transition">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400 mr-1.5 shrink-0" />
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value.slice(0, 25))}
                    placeholder="Apto, Bloco (opcional)"
                    maxLength={25}
                    className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 pt-2 bg-slate-950/90 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep('address_cep')}
                className="py-3 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                disabled={!isAddressNumValid}
                onClick={() => setStep('address_summary')}
                className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                <span className="text-white">Avançar</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}

        {step === 'address_summary' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => {
                    shouldReverseLookupRef.current = !manualCepLockedRef.current;
                    setStreet(e.target.value);
                  }}
                  placeholder="Rua / Avenida"
                  className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="w-[62px] shrink-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 text-center">
                  Número
                </label>
                <input
                  type="text"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value.slice(0, 8))}
                  placeholder="Nº"
                  maxLength={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-1 py-2 text-xs text-white text-center outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="w-[115px] sm:w-[125px] shrink-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value.slice(0, 25))}
                  placeholder="Apto, Bloco"
                  maxLength={25}
                  className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-2 py-2 text-xs text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => {
                    shouldReverseLookupRef.current = !manualCepLockedRef.current;
                    setNeighborhood(e.target.value);
                  }}
                  placeholder="Bairro"
                  className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    shouldReverseLookupRef.current = !manualCepLockedRef.current;
                    setCity(e.target.value);
                  }}
                  placeholder="Cidade"
                  className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="w-[42px] shrink-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 text-center">
                  UF
                </label>
                <input
                  type="text"
                  list="triade-uf-options"
                  value={uf}
                  onChange={(e) => {
                    shouldReverseLookupRef.current = !manualCepLockedRef.current;
                    setUf(e.target.value.toUpperCase().slice(0, 2));
                  }}
                  placeholder="UF"
                  maxLength={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-0.5 py-2 text-xs text-white uppercase text-center outline-none focus:border-emerald-500 transition"
                />
                <datalist id="triade-uf-options">
                  {BRAZIL_UF_LIST.map((stateUf) => (
                    <option key={stateUf} value={stateUf} />
                  ))}
                </datalist>
              </div>

              <div className="w-[86px] shrink-0">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-center gap-1">
                  <span>CEP</span>
                  {isReverseLookingUpCep && (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  )}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => {
                    const formatted = formatCEP(e.target.value);
                    shouldReverseLookupRef.current = false;
                    manualCepLockedRef.current = formatted.replace(/\D/g, '').length > 0;
                    setCep(formatted);
                  }}
                  placeholder="12345-678"
                  maxLength={9}
                  className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-1 py-2 text-xs text-emerald-400 font-semibold text-center outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {!isAddressSummaryValid && (
              <p className="text-[11px] text-amber-400 font-medium">
                Falta preencher: {missingAddressFields.join(', ')}.
              </p>
            )}

            <div className="sticky bottom-0 z-20 pt-2 bg-slate-950/90 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep(cameFromManualCep ? 'address_cep' : 'address_num')}
                className="py-3 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                disabled={!isAddressSummaryValid}
                onClick={() => {
                  setFeedback(null);
                  setStep('password');
                }}
                className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span className="text-white">Confirmar</span>
              </button>
            </div>
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={handleFinalizeRegistration} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Digite uma Senha
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
                <Lock className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Mínimo 6 caracteres, 1 maiúscula e 1 especial"
                  autoFocus
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-white transition ml-2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirme sua Senha
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
                <Lock className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Repita sua senha"
                  className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-slate-400 hover:text-white transition ml-2 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    hasMinLength ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={hasMinLength ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                  Mínimo de 6 caracteres
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    hasUpperCase ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className={hasUpperCase ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                  Ao menos 1 letra maiúscula (A–Z)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    hasSpecialChar ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span
                  className={hasSpecialChar ? 'text-emerald-300 font-semibold' : 'text-slate-400'}
                >
                  Ao menos 1 caractere especial (!@#$%&*)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    passwordsMatch ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span
                  className={passwordsMatch ? 'text-emerald-300 font-semibold' : 'text-slate-400'}
                >
                  Confirmação de senha idêntica
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-300">
                Pergunta Secreta (para recuperar seu Usuário)
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSecurityListOpen((prev) => !prev)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-emerald-500/60 rounded-[4px] px-3 py-2.5 text-xs text-white text-left flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <span className="whitespace-normal break-words leading-snug">
                    {selectedQuestionObj.questionText}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      isSecurityListOpen ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>

                {isSecurityListOpen && (
                  <div className="mt-1 bg-slate-950 border border-slate-700 rounded-[4px] overflow-hidden divide-y divide-slate-800/80 shadow-xl">
                    {securityQuestions.map((q) => {
                      const isSelected = q.code === securityQuestionCode;
                      return (
                        <button
                          key={q.code}
                          type="button"
                          onClick={() => {
                            setSecurityQuestionCode(q.code);
                            setIsSecurityListOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 text-xs text-left whitespace-normal break-words leading-snug transition cursor-pointer ${
                            isSelected
                              ? 'bg-accent text-white font-bold'
                              : 'text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {q.questionText}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => {
                  setSecurityAnswer(e.target.value);
                  setFeedback(null);
                }}
                placeholder="Sua resposta secreta (mínimo 2 caracteres)"
                className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
              />
              {!isSecurityAnswerValid && (
                <p className="text-[11px] text-amber-400 font-medium">
                  Informe sua resposta secreta para finalizar o cadastro.
                </p>
              )}
            </div>

            <div className="sticky bottom-0 z-20 pt-2 bg-slate-950/90 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep('address_summary')}
                className="py-3 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="submit"
                disabled={!isPasswordStepValid || isLoading}
                className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span className="text-white">Finalizar</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'welcome' && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-[4px] bg-accent text-white flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-white leading-snug">
                Bem-vindo ao {resolvedSalonTitle}!
              </h4>
              <p className="text-xs text-emerald-400 font-semibold">
                Seu cadastro foi realizado com sucesso.
              </p>
            </div>

            <div className="p-3.5 rounded-[4px] bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 font-medium">Nome Completo:</span>
                <span className="text-white font-bold text-right truncate">{cleanName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 font-medium">Nome de Usuário:</span>
                <span className="text-emerald-400 font-bold text-right truncate">
                  @{cleanUsername.replace(/^@+/, '')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 font-medium">E-mail:</span>
                <span className="text-white font-bold text-right truncate">{cleanEmail}</span>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 pt-1 bg-slate-950/90">
              <button
                type="button"
                onClick={() => onClose?.()}
                className="w-full py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span className="text-white">Continuar Conectado</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
