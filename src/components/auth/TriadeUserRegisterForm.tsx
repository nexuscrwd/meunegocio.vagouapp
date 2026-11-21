import React, { useState, useEffect, useRef } from 'react';
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
  Chrome,
  HelpCircle,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, generateUuidV4 } from '../../lib/supabase';
import { SalonAuthHeader } from './SalonAuthHeader';
import { OFFICIAL_SECURITY_QUESTIONS } from './TriadeUserRecoveryModal';

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
  salonSlug,
  salonSlogan,
  salonLogoUrl,
}) => {
  const isDark = true;
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

  const [name, setName] = useState<string>(initialDraft?.name || '');
  const [username, setUsername] = useState<string>(initialDraft?.username || '');
  const [confirmUsername, setConfirmUsername] = useState<string>(
    initialDraft?.confirmUsername || ''
  );
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const [email, setEmail] = useState<string>(initialDraft?.email || '');
  const [confirmEmail, setConfirmEmail] = useState<string>(initialDraft?.confirmEmail || '');

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

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityQuestionCode, setSecurityQuestionCode] = useState<string>(() => {
    const idx = Math.floor(Math.random() * OFFICIAL_SECURITY_QUESTIONS.length);
    return OFFICIAL_SECURITY_QUESTIONS[idx].code;
  });
  const [isSecurityListOpen, setIsSecurityListOpen] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const phoneDigits = phone.replace(/\D/g, '');
  const confirmPhoneDigits = confirmPhone.replace(/\D/g, '');
  const isContactValid =
    phoneDigits.length >= 10 &&
    phoneDigits.length <= 11 &&
    phoneDigits === confirmPhoneDigits;

  const cleanName = name.trim();
  const cleanUsername = username.trim().replace(/^[@#&]+|[@#&]+$/g, '');
  const cleanConfirmUsername = confirmUsername.trim().replace(/^[@#&]+|[@#&]+$/g, '');
  const isUsernameConfirmed =
    cleanUsername.length >= 2 &&
    cleanConfirmUsername.length >= 2 &&
    cleanUsername.toLowerCase() === cleanConfirmUsername.toLowerCase();

  useEffect(() => {
    if (cleanUsername.length < 2) {
      setIsCheckingUsername(false);
      setUsernameAvailable(null);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setIsCheckingUsername(false);
      setUsernameAvailable(true);
      return;
    }

    let cancelled = false;
    setIsCheckingUsername(true);

    const timer = setTimeout(async () => {
      try {
        const targetLower = username.trim().toLowerCase();
        const targetStripped = cleanUsername.toLowerCase();
        const [sysAdminsRes, profilesRes, globalPrefRes] = await Promise.all([
          (supabase.from('system_admins' as any) as any).select('username').limit(200),
          (supabase.from('profiles' as any) as any).select('username').limit(500),
          (supabase.from('admin_preferences' as any) as any)
            .select('preferences')
            .eq('id', 'global')
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const matchesUsername = (rows: any[] | null | undefined): boolean => {
          if (!Array.isArray(rows)) return false;
          return rows.some((r) => {
            const rawU = String(r?.username || '').trim().toLowerCase();
            if (!rawU) return false;
            const strippedU = rawU.replace(/^[@#&]+|[@#&]+$/g, '');
            return rawU === targetLower || rawU === targetStripped || strippedU === targetStripped;
          });
        };

        const alreadyExists =
          matchesUsername(sysAdminsRes?.data) ||
          matchesUsername(profilesRes?.data) ||
          matchesUsername(globalPrefRes?.data?.preferences?.auth_directory);

        setUsernameAvailable(!alreadyExists);
      } catch {
        if (!cancelled) {
          setUsernameAvailable(true);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingUsername(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleanUsername]);

  useEffect(() => {
    if (step !== 'address_summary' || !shouldReverseLookupRef.current) {
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
      setCep('');
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

                const exactMatch = data.find((item: any) => {
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
                });

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
                  const itemRoadCore = stripStreetPrefix(
                    String(addr.road || addr.pedestrian || addr.residential || '')
                  );
                  const itemSuburb = normalizeText(
                    String(addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '')
                  );
                  const itemCity = normalizeText(
                    String(addr.city || addr.town || addr.municipality || addr.village || '')
                  );
                  const rawPostcode = String(addr.postcode || '').replace(/\D/g, '');

                  if (
                    rawPostcode.length === 8 &&
                    itemRoadCore === normStreetCore &&
                    (!itemSuburb || itemSuburb === normNeighborhood) &&
                    (!itemCity || itemCity === normCity)
                  ) {
                    foundCepDigits = rawPostcode;
                    break;
                  }
                }
              }
            }
          } catch {}
        }

        if (!cancelled) {
          if (foundCepDigits.length === 8) {
            setCep(formatCEP(foundCepDigits));
          } else {
            setCep('');
          }
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

  const isNameValid =
    cleanName.length >= 2 &&
    cleanUsername.length >= 2 &&
    isUsernameConfirmed &&
    !isCheckingUsername &&
    usernameAvailable !== false;

  const cleanEmail = email.trim().toLowerCase();
  const cleanConfirmEmail = confirmEmail.trim().toLowerCase();
  const isEmailStepValid =
    isValidEmail(cleanEmail) && cleanEmail === cleanConfirmEmail;

  const cepDigits = cep.replace(/\D/g, '');
  const isCepStepValid = cepDigits.length === 8;

  const isAddressNumValid =
    cepDigits.length === 8 &&
    street.trim().length >= 2 &&
    !cepNotFound &&
    !isLookingUpCep &&
    addressNumber.trim().length >= 1;

  const isAddressSummaryValid =
    street.trim().length >= 2 &&
    addressNumber.trim().length >= 1 &&
    neighborhood.trim().length >= 2 &&
    city.trim().length >= 2 &&
    uf.trim().length === 2 &&
    cepDigits.length === 8;

  const hasUpperCase = /[A-Z]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9\s]/.test(password);
  const passwordsMatch =
    password.trim().length > 0 && password.trim() === confirmPassword.trim();
  const isPasswordStepValid =
    hasUpperCase && hasSpecialChar && passwordsMatch;

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

  const handleFinalizeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isPasswordStepValid) {
      setFeedback({
        type: 'error',
        message: 'A senha deve conter ao menos 1 letra maiúscula, 1 caractere especial e confirmação idêntica.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const cleanPass = password.trim();
      const authPassSafe = cleanPass.length >= 6 ? cleanPass : `${cleanPass}#Vagou1`;
      const rawTypedUsername = username.trim().replace(/^@+/, '');
      const normalizedUsername = rawTypedUsername || `@${cleanUsername.toLowerCase().replace(/^@+/, '')}`;
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

      try {
        localStorage.setItem('vagou_user_home_address', fullAddressString);
        localStorage.setItem('vagou_user_address_json', JSON.stringify(addressObj));
      } catch {}

      let userId: string = generateUuidV4();

      if (isSupabaseConfigured && supabase) {
        const metadata: Record<string, any> = {
          full_name: cleanName,
          name: cleanName,
          phone: phone.trim(),
          username: normalizedUsername,
          password_hash: cleanPass,
          address: fullAddressString,
          cep: addressObj.cep,
          street: addressObj.street,
          number: addressObj.number,
          complement: addressObj.complement,
          neighborhood: addressObj.neighborhood,
          city: addressObj.city,
          uf: addressObj.uf,
        };

        try {
          const { data } = await supabase.auth.signUp({
            email: cleanEmail,
            password: authPassSafe,
            options: { data: metadata },
          });
          if (data?.user?.id) {
            userId = data.user.id;
          }
        } catch {}

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
            .eq('id', userId);
        } catch {}

        try {
          const { data: existingClient } = await (supabase.from('clients') as any)
            .select('id, user_id')
            .ilike('email', cleanEmail)
            .limit(1)
            .maybeSingle();

          let resolvedClientId = existingClient?.id ? String(existingClient.id) : '';

          if (existingClient?.id) {
            userId = String(existingClient.user_id || existingClient.id);
            await (supabase.from('clients') as any)
              .update({
                full_name: cleanName,
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
              .eq('id', existingClient.id);
          } else {
            const { data: insertedClient } = await (supabase.from('clients') as any)
              .insert({
                user_id: userId,
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
              })
              .select('id, user_id')
              .maybeSingle();
            if (insertedClient?.id) {
              resolvedClientId = String(insertedClient.id);
              userId = String(insertedClient.user_id || insertedClient.id);
            }
          }

          const normalizedSecAnswer = normalizeText(securityAnswer);
          if (normalizedSecAnswer.length >= 2) {
            const selectedSecQ =
              OFFICIAL_SECURITY_QUESTIONS.find((q) => q.code === securityQuestionCode) ||
              OFFICIAL_SECURITY_QUESTIONS[0];
            if (resolvedClientId) {
              try {
                await (supabase.from('user_security_answers' as any) as any).upsert(
                  {
                    client_id: resolvedClientId,
                    question_code: selectedSecQ.code,
                    answer_hash: normalizedSecAnswer,
                  },
                  { onConflict: 'client_id,question_code' }
                );
              } catch {}
            }
            try {
              await (supabase.from('clients') as any)
                .update({
                  security_question_code: selectedSecQ.code,
                })
                .ilike('email', cleanEmail);
            } catch {}
          }
        } catch {}
      }

      if (normalizeText(securityAnswer).length >= 2) {
        try {
          const prevAnswers = JSON.parse(
            localStorage.getItem('vagou_user_security_answers') || '[]'
          );
          const nextAnswers = Array.isArray(prevAnswers) ? prevAnswers : [];
          nextAnswers.push({
            userId,
            username: normalizedUsername,
            name: cleanName,
            email: cleanEmail,
            questionCode: securityQuestionCode,
            answer: normalizeText(securityAnswer),
          });
          localStorage.setItem('vagou_user_security_answers', JSON.stringify(nextAnswers));
        } catch {}
      }

      const resultData: TriadeUserData = {
        id: userId,
        name: cleanName,
        username: normalizedUsername,
        email: cleanEmail,
        phone: phone.trim(),
        passwordHash: cleanPass,
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
        message: err?.message || 'Erro ao concluir o cadastro.',
      });
    }
  };

  const handleGoogleAccountRegister = async () => {
    setFeedback(null);
    if (!supabase) {
      setFeedback({ type: 'error', message: 'Serviço de autenticação Supabase indisponível.' });
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
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível conectar sua Conta Google.' });
    }
  };

  const stepMeta: Record<RegisterWizardStep, { index: number; total: number; label: string }> = {
    contact: { index: 1, total: 5, label: 'Contato' },
    name: { index: 2, total: 5, label: 'Nome e Usuário' },
    email: { index: 3, total: 5, label: 'E-mail' },
    address_cep: { index: 4, total: 5, label: 'Endereço (CEP)' },
    address_num: { index: 4, total: 5, label: 'Número e Complemento' },
    address_summary: { index: 4, total: 5, label: 'Resumo de Endereço' },
    password: { index: 5, total: 5, label: 'Senha de Acesso' },
    welcome: { index: 5, total: 5, label: 'Boas-Vindas' },
  };

  const currentMeta = stepMeta[step];
  const resolvedSalonTitle = salonName || 'Meu Estabelecimento';

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
          subtitle={`CRIAR CONTA • ${currentMeta.label}`}
          onClose={step === 'welcome' ? onClose : (onSwitchToLogin || onClose)}
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
                  idx <= currentMeta.index ? 'bg-accent' : isDark ? 'bg-slate-800' : 'bg-slate-200'
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
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
              <Phone className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhoneBR(e.target.value));
                  setFeedback(null);
                }}
                placeholder="(11) 99999-9999"
                autoFocus
                className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirme seu Celular / WhatsApp
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
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
            </div>
            {confirmPhoneDigits.length >= 10 && phoneDigits !== confirmPhoneDigits && (
              <p className="text-[11px] text-rose-400 font-medium mt-1">
                Os números de celular digitados não coincidem.
              </p>
            )}
          </div>

          <div className="sticky bottom-0 z-20 pt-2 bg-slate-900">
            <button
              type="button"
              disabled={!isContactValid}
              onClick={() => {
                setFeedback(null);
                setStep('name');
              }}
              className="w-full py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer whitespace-nowrap"
            >
              <span className="text-white">Avançar</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="flex items-center gap-3 py-0.5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] uppercase font-bold text-slate-500">ou</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleAccountRegister}
            disabled={isGoogleLoading}
            className="w-full py-2.5 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Chrome className="w-4 h-4 text-emerald-400" />
            )}
            <span>Conta Google</span>
          </button>
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome de Usuário
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
              <AtSign className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/\s+/g, ''));
                  setFeedback(null);
                }}
                placeholder="Escolha seu nome de usuário"
                className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
              />
              {isCheckingUsername && (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0 ml-2" />
              )}
              {!isCheckingUsername && cleanUsername.length >= 3 && usernameAvailable === true && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
              )}
              {!isCheckingUsername && cleanUsername.length >= 3 && usernameAvailable === false && (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
              )}
            </div>
            {cleanUsername.length >= 3 && !isCheckingUsername && usernameAvailable === false && (
              <p className="text-[11px] text-rose-400 font-medium mt-1">
                Este nome de usuário já existe. Escolha outro.
              </p>
            )}
            {cleanUsername.length >= 3 && !isCheckingUsername && usernameAvailable === true && (
              <p className="text-[11px] text-emerald-400 font-medium mt-1">
                Nome de usuário disponível.
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
                placeholder="Repita seu nome de usuário"
                className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
              />
              {cleanConfirmUsername.length >= 2 && isUsernameConfirmed && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
              )}
              {cleanConfirmUsername.length >= 2 && !isUsernameConfirmed && (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
              )}
            </div>
            {cleanConfirmUsername.length >= 2 && !isUsernameConfirmed && (
              <p className="text-[11px] text-rose-400 font-medium mt-1">
                Os nomes de usuário digitados não coincidem.
              </p>
            )}
          </div>

          <div className="sticky bottom-0 z-20 pt-2 bg-slate-900 grid grid-cols-2 gap-2">
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
              disabled={!isNameValid}
              onClick={() => {
                setFeedback(null);
                setStep('email');
              }}
              className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
            >
              <span className="text-white">Avançar</span>
              <ArrowRight className="w-4 h-4 text-white" />
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
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
              <Mail className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFeedback(null);
                }}
                placeholder="seu@email.com"
                autoFocus
                className="bg-transparent text-sm text-white outline-none w-full placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirme seu E-mail
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2.5 focus-within:border-emerald-500 transition">
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
            </div>
            {cleanConfirmEmail.length > 3 && cleanEmail !== cleanConfirmEmail && (
              <p className="text-[11px] text-rose-400 font-medium mt-1">
                Os e-mails informados não coincidem.
              </p>
            )}
          </div>

          <div className="sticky bottom-0 z-20 pt-2 bg-slate-900 grid grid-cols-2 gap-2">
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
              disabled={!isEmailStepValid}
              onClick={() => {
                setFeedback(null);
                setStep('address_cep');
              }}
              className="py-3 px-4 rounded-[4px] bg-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition cursor-pointer whitespace-nowrap"
            >
              <span className="text-white">Avançar</span>
              <ArrowRight className="w-4 h-4 text-white" />
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
                Endereço não encontrado pelo CEP digitado! Verifique se o CEP digitado acima está correto. Ou clique no botão abaixo.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setCepNotFound(false);
                setCameFromManualCep(true);
                shouldReverseLookupRef.current = true;
                setStep('address_summary');
              }}
              className="w-full py-2.5 px-4 rounded-[4px] bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Não sei meu CEP</span>
            </button>
          </div>

          <div className="sticky bottom-0 z-20 pt-2 bg-slate-900 grid grid-cols-2 gap-2">
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
                Endereço não encontrado pelo CEP digitado! Verifique se o CEP digitado acima está correto. Ou clique no botão abaixo.
              </div>
              <button
                type="button"
                onClick={() => {
                  setCepNotFound(false);
                  setCameFromManualCep(true);
                  shouldReverseLookupRef.current = true;
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
            <div className="w-[72px] shrink-0">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Número
              </label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-[4px] px-2 py-2.5 focus-within:border-emerald-500 transition">
                <Hash className="w-3.5 h-3.5 text-emerald-400 mr-1 shrink-0" />
                <input
                  type="text"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value.slice(0, 5))}
                  placeholder="12345"
                  maxLength={5}
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

          <div className="sticky bottom-0 z-20 pt-2 bg-slate-900 grid grid-cols-2 gap-2">
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
                  shouldReverseLookupRef.current = true;
                  setCep('');
                  setStreet(e.target.value);
                }}
                placeholder="Rua / Avenida"
                className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="w-[54px] shrink-0">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 text-center">
                Número
              </label>
              <input
                type="text"
                value={addressNumber}
                onChange={(e) => {
                  setAddressNumber(e.target.value.slice(0, 5));
                }}
                placeholder="Nº"
                maxLength={5}
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
                onChange={(e) => {
                  setComplement(e.target.value.slice(0, 25));
                }}
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
                  shouldReverseLookupRef.current = true;
                  setCep('');
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
                  shouldReverseLookupRef.current = true;
                  setCep('');
                  setCity(e.target.value);
                }}
                placeholder="Cidade"
                className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="w-[38px] shrink-0">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 text-center">
                UF
              </label>
              <input
                type="text"
                list="triade-uf-options"
                value={uf}
                onChange={(e) => {
                  shouldReverseLookupRef.current = true;
                  setCep('');
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

            <div className="w-[82px] shrink-0">
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
                  shouldReverseLookupRef.current = false;
                  setCep(formatCEP(e.target.value));
                }}
                placeholder="12345-678"
                maxLength={9}
                className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-1 py-2 text-xs text-emerald-400 font-semibold text-center outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-20 pt-2 bg-slate-900 grid grid-cols-2 gap-2">
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
                placeholder="Ao menos 1 maiúscula e 1 caractere especial"
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
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
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
              <span className={hasSpecialChar ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                Ao menos 1 caractere especial (!@#$%&*)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${
                  passwordsMatch ? 'text-emerald-400' : 'text-slate-600'
                }`}
              />
              <span className={passwordsMatch ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
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
                  {(
                    OFFICIAL_SECURITY_QUESTIONS.find((q) => q.code === securityQuestionCode) ||
                    OFFICIAL_SECURITY_QUESTIONS[0]
                  ).questionText}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                    isSecurityListOpen ? 'rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>

              {isSecurityListOpen && (
                <div className="mt-1 bg-slate-950 border border-slate-700 rounded-[4px] overflow-hidden divide-y divide-slate-800/80 shadow-xl">
                  {OFFICIAL_SECURITY_QUESTIONS.map((q) => {
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
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="Sua resposta secreta"
              className="w-full bg-slate-950 border border-slate-800 rounded-[4px] px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
            />
          </div>

          <div className="sticky bottom-0 z-20 pt-2 bg-slate-900 grid grid-cols-2 gap-2">
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
                  <span className="text-white">Avançar</span>
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
              Bem vindo ao {resolvedSalonTitle}, e fazer parte de nós!
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

          <div className="sticky bottom-0 z-20 pt-1 bg-slate-900">
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
