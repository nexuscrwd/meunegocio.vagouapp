import React, { useState, useMemo } from 'react';
import { 
  Building2, UserCheck, 
  Save, Check, Search, Loader2, Sparkles, 
  ArrowLeft, AlertCircle, FileText,
  Tag
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { 
  SalonAdminSettings, 
  SalonProfessionalItem 
} from '../../types';
import { hapticSuccess, hapticLight, hapticMedium } from '../../utils/haptics';
import { getSectionHeaderStyleData } from '../../utils/sectionHeaderStyle';

export type BusinessDataTabId = 'comercial' | 'horarios' | 'endereco' | 'contato';

export interface BusinessDataCardViewProps {
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => Promise<any> | void;
  professionals?: SalonProfessionalItem[];
  onUpdateProfessionals?: (professionals: SalonProfessionalItem[]) => void;
  onOpenVisualIdentity?: () => void;
  onBack: () => void;
  initialTab?: BusinessDataTabId;
}

const SALON_CATEGORIES = [
  'Barbearia',
  'Salão de Beleza',
  'Clínica de Estética',
  'Studio de Unhas / Nail Designer',
  'Lash & Sobrancelhas',
  'Spa & Massoterapia',
  'Multi-Serviços',
];

// Validador Matemático Oficial de CPF (Receita Federal — Módulo 11)
export function isValidCPF(cpf: string): boolean {
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

// Validador Matemático Oficial de CNPJ (Receita Federal — Módulo 11)
export function isValidCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false;
  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;
  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1), 10);
}

export const BusinessDataCardView: React.FC<BusinessDataCardViewProps> = ({
  adminSettings,
  onUpdateSettings,
  onBack,
}) => {
  const { isDark } = useTheme();

  // 1. INFORMAÇÕES COMERCIAIS
  const [salonName, setSalonName] = useState(adminSettings.salonName || '');
  const [category, setCategory] = useState(adminSettings.category || 'Barbearia');

  // 2. FISCAL (Autônomo vs CNPJ + BrasilAPI + Responsável Legal CPF)
  const initialCnpjDigits = (adminSettings.cnpj || '').replace(/\D/g, '');
  const [hasCnpj, setHasCnpj] = useState<boolean>(initialCnpjDigits.length === 14);
  const [razaoSocial, setRazaoSocial] = useState(initialCnpjDigits.length === 14 ? (adminSettings.razaoSocial || '') : '');
  const [cnpj, setCnpj] = useState(initialCnpjDigits.length === 14 ? (adminSettings.cnpj || '') : '');
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [cpfError, setCpfError] = useState('');

  const [legalManagerName, setLegalManagerName] = useState(adminSettings.legalManagerName || '');
  const [legalManagerCpf, setLegalManagerCpf] = useState(adminSettings.legalManagerCpf || adminSettings.ownerCpf || '');
  const [legalManagerPhone, setLegalManagerPhone] = useState(adminSettings.legalManagerPhone || adminSettings.salonPhone || '');
  const [legalManagerEmail, setLegalManagerEmail] = useState(adminSettings.legalManagerEmail || adminSettings.email || '');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Formatação em tempo real de CNPJ (XX.XXX.XXX/XXXX-XX)
  const handleCnpjChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 14);
    let formatted = raw;
    if (raw.length > 2) formatted = `${raw.slice(0, 2)}.${raw.slice(2)}`;
    if (raw.length > 5) formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
    if (raw.length > 8) formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
    if (raw.length > 12) formatted = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
    setCnpj(formatted);
    setCnpjFeedback(null);
  };

  // Formatação em tempo real de CPF (XXX.XXX.XXX-XX)
  const handleCpfChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 3) formatted = `${raw.slice(0, 3)}.${raw.slice(3)}`;
    if (raw.length > 6) formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
    if (raw.length > 9) formatted = `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
    setLegalManagerCpf(formatted);

    if (raw.length === 11) {
      if (!isValidCPF(raw)) {
        setCpfError('CPF inválido. Confira os 11 dígitos.');
      } else {
        setCpfError('');
      }
    } else {
      setCpfError('');
    }
  };

  // Formatação em tempo real de Telefone / WhatsApp ((XX) 9XXXX-XXXX)
  const handlePhoneChange = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 0) formatted = `(${raw.slice(0, 2)}`;
    if (raw.length > 2) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length > 7) formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    setLegalManagerPhone(formatted);
  };

  // Consulta Automatizada de CNPJ (BrasilAPI com Fallback para ReceitaWS)
  const handleSearchCnpj = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      setCnpjFeedback({ type: 'error', message: 'Digite os 14 dígitos do CNPJ para buscar.' });
      return;
    }

    if (!isValidCNPJ(cleanCnpj)) {
      setCnpjFeedback({ type: 'error', message: 'Dígitos verificadores do CNPJ são inválidos.' });
      return;
    }

    setIsSearchingCnpj(true);
    setCnpjFeedback(null);
    hapticLight();

    try {
      // 1ª Tentativa: BrasilAPI (sem autenticação, rápida)
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (res.ok) {
        const data = await res.json();
        const nomeFantasia = (data.nome_fantasia || '').trim();
        const razao = (data.razao_social || '').trim();

        if (razao) setRazaoSocial(razao);
        if (nomeFantasia && (!salonName || salonName === 'Meu Salão' || salonName === 'Meu Estabelecimento')) {
          setSalonName(nomeFantasia);
        } else if (!salonName && razao) {
          setSalonName(razao);
        }

        if (data.ddd_telefone_1 && !legalManagerPhone) {
          const rawPhone = data.ddd_telefone_1.replace(/\D/g, '');
          if (rawPhone.length >= 10) {
            handlePhoneChange(rawPhone);
          }
        }

        if (data.email && !legalManagerEmail) {
          setLegalManagerEmail(data.email.toLowerCase().trim());
        }

        setCnpjFeedback({
          type: 'success',
          message: `Dados carregados: ${razao || nomeFantasia}`,
        });
        hapticSuccess();
        return;
      }

      // Fallback: ReceitaWS via JSONP / CORS proxy público
      const fallbackRes = await fetch(`https://minhareceita.org/${cleanCnpj}`);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const razao = (fallbackData.razao_social || '').trim();
        const nomeFantasia = (fallbackData.nome_fantasia || '').trim();

        if (razao) setRazaoSocial(razao);
        if (nomeFantasia && (!salonName || salonName === 'Meu Salão' || salonName === 'Meu Estabelecimento')) {
          setSalonName(nomeFantasia);
        }

        setCnpjFeedback({
          type: 'success',
          message: `Dados carregados: ${razao || nomeFantasia}`,
        });
        hapticSuccess();
        return;
      }

      setCnpjFeedback({
        type: 'error',
        message: 'CNPJ não encontrado na base pública. Você pode preencher manualmente.',
      });
    } catch {
      setCnpjFeedback({
        type: 'error',
        message: 'Instabilidade ao consultar CNPJ. Preencha a Razão Social manualmente.',
      });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  // Salvar Dados do Negócio (Identificação Comercial e Fiscal)
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const rawCpfDigits = legalManagerCpf.replace(/\D/g, '');
    if (rawCpfDigits.length > 0 && !isValidCPF(rawCpfDigits)) {
      setCpfError('Informe um CPF válido (11 dígitos verificados pela Receita Federal).');
      hapticMedium();
      return;
    }

    const rawCnpjDigits = cnpj.replace(/\D/g, '');
    if (hasCnpj && rawCnpjDigits.length > 0 && !isValidCNPJ(rawCnpjDigits)) {
      setCnpjFeedback({ type: 'error', message: 'CNPJ inválido. Confira os 14 dígitos informados.' });
      hapticMedium();
      return;
    }

    hapticSuccess();

    const isValidCnpj = hasCnpj && rawCnpjDigits.length === 14;
    const finalCnpj = isValidCnpj ? cnpj.trim() : '';
    const finalRazaoSocial = isValidCnpj ? razaoSocial.trim() : '';
    const resolvedEmail = (legalManagerEmail.trim() || adminSettings.email || '').toLowerCase();
    const resolvedWhatsapp = legalManagerPhone.trim() || adminSettings.salonPhone || '';

    onUpdateSettings({
      salonName: salonName.trim() || 'Meu Estabelecimento',
      category: category.trim() || 'Barbearia',
      razaoSocial: finalRazaoSocial,
      cnpj: finalCnpj,
      ownerCpf: legalManagerCpf.trim(),
      legalManagerName: legalManagerName.trim(),
      legalManagerCpf: legalManagerCpf.trim(),
      legalManagerPhone: resolvedWhatsapp,
      legalManagerEmail: resolvedEmail,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const sectionHeaderStyleData = useMemo(() => {
    return getSectionHeaderStyleData(adminSettings, isDark);
  }, [adminSettings, isDark]);

  return (
    <div className={`w-full h-full flex flex-col justify-between overflow-y-auto no-scrollbar ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Barra de Topo Fixa */}
      <div 
        className={`${sectionHeaderStyleData.containerClass} flex-col gap-2`}
        style={sectionHeaderStyleData.containerStyle}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className={`p-1.5 rounded-[4px] transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" style={sectionHeaderStyleData.iconStyle} />
            </button>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 shrink-0" style={sectionHeaderStyleData.iconStyle} />
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']" style={sectionHeaderStyleData.titleStyle}>
                Dados do Negócio
              </h2>
            </div>
          </div>

          {savedSuccess && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-[4px] shadow-xs animate-in fade-in">
              <Check className="w-3 h-3 text-white" />
              Salvo
            </span>
          )}
        </div>
      </div>

      {/* Formulário Principal: Identificação Comercial & Fiscal */}
      <form onSubmit={handleSave} className="p-3.5 space-y-4 pb-24 flex-1">
        {/* ============================================================== */}
        {/* 1. INFORMAÇÕES (Identificação Comercial: Nome Fantasia & Categoria) */}
        {/* ============================================================== */}
        <div className={`p-3.5 rounded-[4px] border space-y-3.5 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
              Identificação Comercial
            </h3>
          </div>

          {/* Nome Fantasia & Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nome Fantasia <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                placeholder="Ex: Studio Elegance"
                className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Categoria Principal
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition appearance-none cursor-pointer ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                >
                  {SALON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. DADOS FISCAIS & TRIBUTÁRIOS (Autônomo vs CNPJ + Titular) */}
        {/* ============================================================== */}
        <div className={`p-3.5 rounded-[4px] border space-y-3.5 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                Dados Fiscais & Cadastro
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {hasCnpj ? 'Pessoa Jurídica' : 'Pessoa Física / Autônomo'}
            </span>
          </div>

          {/* Seletor: Possui CNPJ ou Atua como Autônomo (CPF) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Enquadramento Tributário
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setHasCnpj(false);
                  setCnpjFeedback(null);
                }}
                className={`py-2 px-3 rounded-[4px] border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  !hasCnpj
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <UserCheck className={`w-3.5 h-3.5 ${!hasCnpj ? 'text-white' : 'text-slate-400'}`} />
                <span className={!hasCnpj ? 'text-white' : ''}>Autônomo (CPF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setHasCnpj(true);
                  setCnpjFeedback(null);
                }}
                className={`py-2 px-3 rounded-[4px] border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  hasCnpj
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 ${hasCnpj ? 'text-white' : 'text-slate-400'}`} />
                <span className={hasCnpj ? 'text-white' : ''}>Empresa (CNPJ / MEI)</span>
              </button>
            </div>
          </div>

          {/* Bloco Dinâmico: CNPJ com Busca Automatizada */}
          {hasCnpj && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  CNPJ (MEI, ME ou EPP)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => handleCnpjChange(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    className={`flex-1 px-3 py-2 rounded-[4px] border text-xs font-mono outline-hidden transition ${
                      isDark 
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleSearchCnpj}
                    disabled={isSearchingCnpj || cnpj.replace(/\D/g, '').length !== 14}
                    className="px-3 py-2 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    title="Buscar dados na Receita Federal"
                  >
                    {isSearchingCnpj ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-white" />
                    )}
                    <span className="hidden sm:inline text-white">Buscar</span>
                  </button>
                </div>

                {cnpjFeedback && (
                  <p className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                    cnpjFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {cnpjFeedback.type === 'success' ? (
                      <Sparkles className="w-3 h-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    )}
                    <span>{cnpjFeedback.message}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Razão Social Registrada
                </label>
                <input
                  type="text"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Nome empresarial na Receita Federal"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Dados do Responsável Legal / Titular do Negócio */}
          <div className="pt-2 border-t border-slate-800/60 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Responsável Legal / Titular
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Nome Completo do Titular
                </label>
                <input
                  type="text"
                  value={legalManagerName}
                  onChange={(e) => setLegalManagerName(e.target.value)}
                  placeholder="Nome civil do proprietário"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  CPF do Titular <span className="text-slate-500">(Verificado)</span>
                </label>
                <input
                  type="text"
                  value={legalManagerCpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs font-mono outline-hidden transition ${
                    cpfError
                      ? 'border-rose-500 bg-rose-500/10 text-white'
                      : isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
                {cpfError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{cpfError}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  WhatsApp Oficial do Negócio
                </label>
                <input
                  type="tel"
                  value={legalManagerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs font-mono outline-hidden transition ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  E-mail Oficial do Negócio
                </label>
                <input
                  type="email"
                  value={legalManagerEmail}
                  onChange={(e) => setLegalManagerEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* RODAPÉ FIXO DE AÇÃO */}
      <div className={`p-3 border-t shrink-0 sticky bottom-0 z-20 flex items-center justify-between gap-3 ${
        isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
      }`}>
        <button
          type="button"
          onClick={() => {
            hapticLight();
            onBack();
          }}
          className={`px-4 py-2.5 rounded-[4px] border text-xs font-bold transition cursor-pointer ${
            isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => handleSave()}
          className="flex-1 py-2.5 px-4 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
        >
          <Save className="w-4 h-4 text-white" />
          <span className="text-white">Salvar Dados do Negócio</span>
        </button>
      </div>
    </div>
  );
};
