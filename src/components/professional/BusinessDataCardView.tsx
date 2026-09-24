import React, { useState, useEffect } from 'react';
import { 
  Building2, MapPin, Clock, UserCheck, 
  Save, Check, Search, Loader2, Sparkles, 
  ArrowLeft, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { SalonAdminSettings, DayOperatingHours, OperatingSchedule } from '../../types';
import { hapticSuccess, hapticLight, hapticMedium } from '../../utils/haptics';

export interface BusinessDataCardViewProps {
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => void;
  onBack: () => void;
}

const DEFAULT_DAYS: DayOperatingHours[] = [
  { dayKey: 'seg', dayLabel: 'Seg', isOpen: true, openTime: '09:00', closeTime: '20:00' },
  { dayKey: 'ter', dayLabel: 'Ter', isOpen: true, openTime: '09:00', closeTime: '20:00' },
  { dayKey: 'qua', dayLabel: 'Qua', isOpen: true, openTime: '09:00', closeTime: '20:00' },
  { dayKey: 'qui', dayLabel: 'Qui', isOpen: true, openTime: '09:00', closeTime: '20:00' },
  { dayKey: 'sex', dayLabel: 'Sex', isOpen: true, openTime: '09:00', closeTime: '20:00' },
  { dayKey: 'sab', dayLabel: 'Sáb', isOpen: true, openTime: '09:00', closeTime: '18:00' },
  { dayKey: 'dom', dayLabel: 'Dom', isOpen: false, openTime: '09:00', closeTime: '14:00' },
];

export const BusinessDataCardView: React.FC<BusinessDataCardViewProps> = ({
  adminSettings,
  onUpdateSettings,
  onBack,
}) => {
  const { isDark } = useTheme();

  // 1. Dados do Estabelecimento
  const [salonName, setSalonName] = useState(adminSettings.salonName || '');
  const [razaoSocial, setRazaoSocial] = useState(adminSettings.razaoSocial || '');
  const [cnpj, setCnpj] = useState(adminSettings.cnpj || '');

  // 2. Localização & CEP
  const [cep, setCep] = useState(adminSettings.cep || '');
  const [logradouro, setLogradouro] = useState(adminSettings.logradouro || adminSettings.salonAddress || '');
  const [numero, setNumero] = useState(adminSettings.numero || '');
  const [complemento, setComplemento] = useState(adminSettings.complemento || '');
  const [bairro, setBairro] = useState(adminSettings.bairro || '');
  const [cidade, setCidade] = useState(adminSettings.cidade || '');
  const [uf, setUf] = useState(adminSettings.uf || '');
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  // 3. Atendimento Inteligente
  const [schedulePreset, setSchedulePreset] = useState<'salao' | 'comercial' | 'todos' | 'personalizado'>(
    adminSettings.operatingSchedule?.preset || 'salao'
  );
  const [days, setDays] = useState<DayOperatingHours[]>(() => {
    if (adminSettings.operatingSchedule?.days && adminSettings.operatingSchedule.days.length > 0) {
      return adminSettings.operatingSchedule.days;
    }
    return DEFAULT_DAYS;
  });
  const [batchOpenTime, setBatchOpenTime] = useState('09:00');
  const [batchCloseTime, setBatchCloseTime] = useState('20:00');

  // 4. Responsável Legal
  const [legalManagerName, setLegalManagerName] = useState(adminSettings.legalManagerName || '');
  const [legalManagerCpf, setLegalManagerCpf] = useState(adminSettings.legalManagerCpf || '');
  const [legalManagerPhone, setLegalManagerPhone] = useState(adminSettings.legalManagerPhone || adminSettings.salonPhone || '');
  const [legalManagerEmail, setLegalManagerEmail] = useState(adminSettings.legalManagerEmail || '');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Máscaras de entrada
  const formatCpf = (v: string) => {
    const raw = v.replace(/\D/g, '').slice(0, 11);
    return raw
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const formatCnpj = (v: string) => {
    const raw = v.replace(/\D/g, '').slice(0, 14);
    return raw
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const formatPhone = (v: string) => {
    const raw = v.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 10) {
      return raw
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return raw
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const formatCep = (v: string) => {
    const raw = v.replace(/\D/g, '').slice(0, 8);
    return raw.replace(/^(\d{5})(\d)/, '$1-$2');
  };

  // Busca automática por CEP via ViaCEP
  const searchCepAddress = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsSearchingCep(true);
    setCepError('');

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepError('CEP não encontrado. Verifique o número digitado.');
        hapticMedium();
      } else {
        setLogradouro(data.logradouro || '');
        setBairro(data.bairro || '');
        setCidade(data.localidade || '');
        setUf(data.uf || '');
        if (data.complemento && !complemento) {
          setComplemento(data.complemento);
        }
        hapticSuccess();
      }
    } catch {
      setCepError('Erro ao buscar o CEP. Preencha os campos manualmente.');
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = formatCep(e.target.value);
    setCep(masked);
    const raw = masked.replace(/\D/g, '');
    if (raw.length === 8) {
      searchCepAddress(masked);
    } else {
      setCepError('');
    }
  };

  // Aplicação dos Presets de Horário
  const applyPreset = (preset: 'salao' | 'comercial' | 'todos' | 'personalizado') => {
    hapticLight();
    setSchedulePreset(preset);

    if (preset === 'salao') {
      // Seg a Sáb das 09h às 20h (Sáb 09h às 18h), Dom fechado
      setDays([
        { dayKey: 'seg', dayLabel: 'Seg', isOpen: true, openTime: '09:00', closeTime: '20:00' },
        { dayKey: 'ter', dayLabel: 'Ter', isOpen: true, openTime: '09:00', closeTime: '20:00' },
        { dayKey: 'qua', dayLabel: 'Qua', isOpen: true, openTime: '09:00', closeTime: '20:00' },
        { dayKey: 'qui', dayLabel: 'Qui', isOpen: true, openTime: '09:00', closeTime: '20:00' },
        { dayKey: 'sex', dayLabel: 'Sex', isOpen: true, openTime: '09:00', closeTime: '20:00' },
        { dayKey: 'sab', dayLabel: 'Sáb', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayKey: 'dom', dayLabel: 'Dom', isOpen: false, openTime: '09:00', closeTime: '14:00' },
      ]);
    } else if (preset === 'comercial') {
      // Seg a Sex das 09h às 18h, Sáb e Dom fechados
      setDays([
        { dayKey: 'seg', dayLabel: 'Seg', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayKey: 'ter', dayLabel: 'Ter', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayKey: 'qua', dayLabel: 'Qua', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayKey: 'qui', dayLabel: 'Qui', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayKey: 'sex', dayLabel: 'Sex', isOpen: true, openTime: '09:00', closeTime: '18:00' },
        { dayKey: 'sab', dayLabel: 'Sáb', isOpen: false, openTime: '09:00', closeTime: '14:00' },
        { dayKey: 'dom', dayLabel: 'Dom', isOpen: false, openTime: '09:00', closeTime: '14:00' },
      ]);
    } else if (preset === 'todos') {
      // Seg a Dom aberto
      setDays((prev) =>
        prev.map((d) => ({ ...d, isOpen: true, openTime: '09:00', closeTime: '20:00' }))
      );
    }
  };

  // Toggle do dia individual
  const toggleDay = (dayKey: string) => {
    hapticLight();
    setSchedulePreset('personalizado');
    setDays((prev) =>
      prev.map((d) => (d.dayKey === dayKey ? { ...d, isOpen: !d.isOpen } : d))
    );
  };

  // Atualização de horário de dia específico
  const updateDayTime = (dayKey: string, field: 'openTime' | 'closeTime', value: string) => {
    setDays((prev) =>
      prev.map((d) => (d.dayKey === dayKey ? { ...d, [field]: value } : d))
    );
  };

  // Aplicar horário em lote aos dias ativos
  const handleApplyBatchTimes = () => {
    hapticSuccess();
    setDays((prev) =>
      prev.map((d) =>
        d.isOpen ? { ...d, openTime: batchOpenTime, closeTime: batchCloseTime } : d
      )
    );
  };

  // Gerar string descritiva sintética de horários para a vitrine
  const generateOpeningHoursSummary = (): string => {
    const openDays = days.filter((d) => d.isOpen);
    if (openDays.length === 0) return 'Fechado temporariamente';
    if (openDays.length === 7) return `Seg a Dom • ${batchOpenTime} às ${batchCloseTime}`;
    const hasSegToSex = ['seg', 'ter', 'qua', 'qui', 'sex'].every((k) =>
      days.find((d) => d.dayKey === k)?.isOpen
    );
    const sab = days.find((d) => d.dayKey === 'sab');
    if (hasSegToSex && sab?.isOpen) {
      return `Seg a Sáb • ${days[0].openTime} às ${days[0].closeTime}`;
    }
    if (hasSegToSex && !sab?.isOpen) {
      return `Seg a Sex • ${days[0].openTime} às ${days[0].closeTime}`;
    }
    return `${openDays.map((d) => d.dayLabel).join(', ')} • ${batchOpenTime} às ${batchCloseTime}`;
  };

  // Salvar Dados
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    hapticSuccess();

    const fullAddress = [
      logradouro,
      numero ? `Nº ${numero}` : '',
      complemento,
      bairro,
      cidade && uf ? `${cidade} - ${uf}` : cidade || uf,
      cep ? `CEP: ${cep}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    const operatingSchedule: OperatingSchedule = {
      preset: schedulePreset,
      days,
      defaultOpenTime: batchOpenTime,
      defaultCloseTime: batchCloseTime,
    };

    onUpdateSettings({
      salonName: salonName.trim() || 'Meu Estabelecimento',
      razaoSocial: razaoSocial.trim(),
      cnpj: cnpj.trim(),
      cep: cep.trim(),
      logradouro: logradouro.trim(),
      numero: numero.trim(),
      complemento: complemento.trim(),
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      uf: uf.trim(),
      salonAddress: fullAddress || adminSettings.salonAddress,
      operatingSchedule,
      openingHours: generateOpeningHoursSummary(),
      legalManagerName: legalManagerName.trim(),
      legalManagerCpf: legalManagerCpf.trim(),
      legalManagerPhone: legalManagerPhone.trim(),
      legalManagerEmail: legalManagerEmail.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className={`w-full h-full flex flex-col justify-between overflow-y-auto no-scrollbar ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Barra de Topo com Ação de Voltar */}
      <div className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between gap-2 sticky top-0 z-30 ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onBack();
            }}
            className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Voltar ao Gerenciamento"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
              Dados do Negócio
            </h2>
          </div>
        </div>

        {savedSuccess && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded shadow-xs animate-in fade-in">
            <Check className="w-3 h-3 text-white" />
            Salvo
          </span>
        )}
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleSave} className="p-3.5 space-y-4 pb-24">
        
        {/* SEÇÃO 1: DADOS DO ESTABELECIMENTO */}
        <div className={`p-3.5 rounded border space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
              Dados do Estabelecimento
            </h3>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Nome Fantasia <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder="Ex: Studio Bella, Barbearia Silva..."
              className={`w-full px-3 py-2 rounded border text-xs font-semibold outline-hidden transition ${
                isDark 
                  ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Razão Social <span className="text-[10px] font-normal text-slate-500">(Opcional)</span>
              </label>
              <input
                type="text"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex: Empresa de Beleza LTDA"
                className={`w-full px-3 py-2 rounded border text-xs outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                CNPJ {razaoSocial.trim() && <span className="text-emerald-400 font-bold">*</span>}
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                className={`w-full px-3 py-2 rounded border text-xs font-mono outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: LOCALIZAÇÃO INTELIGENTE (ViaCEP) */}
        <div className={`p-3.5 rounded border space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                Localização & Endereço
              </h3>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Busca por CEP
            </span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              CEP <span className="text-emerald-400 font-bold">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={cep}
                onChange={handleCepChange}
                placeholder="00000-000"
                maxLength={9}
                className={`w-full pl-3 pr-10 py-2 rounded border text-xs font-mono font-bold outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isSearchingCep ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <button
                    type="button"
                    onClick={() => searchCepAddress(cep)}
                    className="text-slate-400 hover:text-emerald-400 transition"
                    title="Buscar endereço pelo CEP"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {cepError && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {cepError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Endereço / Logradouro
              </label>
              <input
                type="text"
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                placeholder="Ex: Rua Harmonia"
                className={`w-full px-3 py-2 rounded border text-xs outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nº <span className="text-emerald-400 font-bold">*</span>
              </label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="123"
                className={`w-full px-3 py-2 rounded border text-xs font-semibold outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Sala 2, Loja B"
                className={`w-full px-3 py-2 rounded border text-xs outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Vila Madalena"
                className={`w-full px-3 py-2 rounded border text-xs outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="São Paulo"
                  className={`w-full px-2.5 py-2 rounded border text-xs outline-hidden transition ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  UF
                </label>
                <input
                  type="text"
                  value={uf}
                  maxLength={2}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className={`w-full px-1.5 py-2 rounded border text-xs uppercase text-center font-bold outline-hidden transition ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: ATENDIMENTO & HORÁRIOS INTELIGENTES */}
        <div className={`p-3.5 rounded border space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                Horários de Atendimento
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Presets & Ajuste Fino
            </span>
          </div>

          {/* Atalhos Rápidos de Presets */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              1. Padrão Rápido
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { key: 'salao', label: 'Seg a Sáb (Salão)' },
                { key: 'comercial', label: 'Seg a Sex (Comercial)' },
                { key: 'todos', label: 'Todos os Dias' },
                { key: 'personalizado', label: 'Personalizado' },
              ].map((preset) => {
                const isSelected = schedulePreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset.key as any)}
                    className={`py-1.5 px-2 rounded text-[11px] font-bold border transition cursor-pointer whitespace-nowrap text-center ${
                      isSelected
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                        : isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500/50'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-emerald-500/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletor de Dias Ativos (Chips) */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              2. Dias de Funcionamento (Toque para ativar/desativar)
            </label>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => (
                <button
                  key={d.dayKey}
                  type="button"
                  onClick={() => toggleDay(d.dayKey)}
                  className={`py-2 rounded text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center select-none ${
                    d.isOpen
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                      : isDark
                      ? 'bg-slate-950 border-slate-800/80 text-slate-500 hover:text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className={d.isOpen ? 'text-white' : ''}>{d.dayLabel}</span>
                  <span className={`text-[9px] mt-0.5 ${d.isOpen ? 'text-white/90 font-medium' : 'text-slate-600'}`}>
                    {d.isOpen ? 'Aberto' : 'Off'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Horários Padrão em Lote */}
          <div className={`p-2.5 rounded border space-y-2 ${
            isDark ? 'bg-slate-950/60 border-slate-800/70' : 'bg-slate-50 border-slate-200'
          }`}>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              3. Aplicar Horário Geral em Lote
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] text-slate-400">Das</span>
                <input
                  type="time"
                  value={batchOpenTime}
                  onChange={(e) => setBatchOpenTime(e.target.value)}
                  className={`px-2 py-1 rounded border text-xs font-mono font-bold outline-hidden ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] text-slate-400">às</span>
                <input
                  type="time"
                  value={batchCloseTime}
                  onChange={(e) => setBatchCloseTime(e.target.value)}
                  className={`px-2 py-1 rounded border text-xs font-mono font-bold outline-hidden ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyBatchTimes}
                className="px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition cursor-pointer shadow-xs whitespace-nowrap"
              >
                Aplicar aos Dias Ativos
              </button>
            </div>
          </div>

          {/* Ajustes Individuais por Dia */}
          <div className="space-y-1 pt-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Ajuste Específico por Dia (Ex: Sábado horário reduzido)
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar pr-1">
              {days.map((d) => (
                <div
                  key={d.dayKey}
                  className={`px-2.5 py-1.5 rounded border flex items-center justify-between text-xs transition ${
                    d.isOpen
                      ? isDark
                        ? 'bg-slate-900/60 border-slate-800'
                        : 'bg-white border-slate-200'
                      : isDark
                      ? 'bg-slate-950/40 border-slate-850 opacity-40'
                      : 'bg-slate-100 border-slate-200 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold w-9">{d.dayLabel}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      d.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {d.isOpen ? 'Aberto' : 'Fechado'}
                    </span>
                  </div>

                  {d.isOpen ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={d.openTime}
                        onChange={(e) => updateDayTime(d.dayKey, 'openTime', e.target.value)}
                        className={`px-1.5 py-0.5 rounded border text-[11px] font-mono outline-hidden ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400">às</span>
                      <input
                        type="time"
                        value={d.closeTime}
                        onChange={(e) => updateDayTime(d.dayKey, 'closeTime', e.target.value)}
                        className={`px-1.5 py-0.5 rounded border text-[11px] font-mono outline-hidden ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">Sem atendimento</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SEÇÃO 4: RESPONSÁVEL LEGAL */}
        <div className={`p-3.5 rounded border space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/60">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
              Responsável Legal
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nome Completo <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={legalManagerName}
                onChange={(e) => setLegalManagerName(e.target.value)}
                placeholder="Ex: Anderson Henrique Pires"
                className={`w-full px-3 py-2 rounded border text-xs outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                CPF <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={legalManagerCpf}
                onChange={(e) => setLegalManagerCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                className={`w-full px-3 py-2 rounded border text-xs font-mono outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Telefone / WhatsApp <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={legalManagerPhone}
                onChange={(e) => setLegalManagerPhone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                className={`w-full px-3 py-2 rounded border text-xs font-mono outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                E-mail de Contato <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={legalManagerEmail}
                onChange={(e) => setLegalManagerEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className={`w-full px-3 py-2 rounded border text-xs outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
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
          className={`px-4 py-2.5 rounded border text-xs font-bold transition cursor-pointer ${
            isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => handleSave()}
          className="flex-1 py-2.5 px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
        >
          <Save className="w-4 h-4 text-white" />
          <span>Salvar Dados do Negócio</span>
        </button>
      </div>
    </div>
  );
};
