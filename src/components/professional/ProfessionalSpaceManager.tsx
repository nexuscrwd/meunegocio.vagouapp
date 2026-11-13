import React, { useState, useMemo } from 'react';
import { 
  Store, Phone, MapPin, Save, Check,
  Sparkles, Search, Loader2, Plus, X,
  QrCode, Printer, Copy, ExternalLink,
  Mail, Globe, Instagram, Facebook,
  Wifi, Wind, Coffee, Car, Accessibility,
  Baby, Tv, Plug, Wine, PawPrint, ArrowLeft,
  Armchair, Gamepad2, Music, Flame, ShieldCheck,
  Gift, Heart, Star, Award
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { SalonAdminSettings, SalonProfessionalItem } from '../../types';
import { hapticSuccess, hapticLight, hapticMedium } from '../../utils/haptics';
import { getSectionHeaderStyleData } from '../../utils/sectionHeaderStyle';

export type SpaceManagementTabId = 'estrutura' | 'localizacao' | 'contatos';

export interface ProfessionalSpaceManagerProps {
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => Promise<any> | void;
  professionals?: SalonProfessionalItem[];
  onUpdateProfessionals?: (professionals: SalonProfessionalItem[]) => void;
  onBack?: () => void;
  initialTab?: SpaceManagementTabId;
}

export const PREDEFINED_SPACE_AMENITIES = [
  { label: 'Wi-Fi de Alta Velocidade', icon: Wifi },
  { label: 'Ambiente Climatizado', icon: Wind },
  { label: 'Café Expresso & Bebidas', icon: Coffee },
  { label: 'Estacionamento Próprio', icon: Car },
  { label: 'Acessibilidade', icon: Accessibility },
  { label: 'Espaço Kids', icon: Baby },
  { label: 'TV & Música Ambiente', icon: Tv },
  { label: 'Carregadores / Tomadas', icon: Plug },
  { label: 'Bebidas & Bar', icon: Wine },
  { label: 'Pet Friendly', icon: PawPrint },
];

export const DEFAULT_SPACE_AMENITIES = [
  'Wi-Fi de Alta Velocidade',
  'Ambiente Climatizado',
  'Café Expresso & Bebidas',
  'Estacionamento Próprio',
];

export const CUSTOM_SPACE_ICON_OPTIONS = [
  { key: 'sparkles', label: 'Destaque', icon: Sparkles },
  { key: 'armchair', label: 'Poltrona', icon: Armchair },
  { key: 'gamepad', label: 'Games', icon: Gamepad2 },
  { key: 'flame', label: 'Spa / Quente', icon: Flame },
  { key: 'music', label: 'Música', icon: Music },
  { key: 'shield', label: 'Biossegurança', icon: ShieldCheck },
  { key: 'gift', label: 'Cortesia', icon: Gift },
  { key: 'wine', label: 'Bar / Chopp', icon: Wine },
  { key: 'coffee', label: 'Café / Lanche', icon: Coffee },
  { key: 'tv', label: 'TV / Telão', icon: Tv },
  { key: 'plug', label: 'Tomada / USB', icon: Plug },
  { key: 'car', label: 'Vaga / Valet', icon: Car },
  { key: 'wind', label: 'Climatizado', icon: Wind },
  { key: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { key: 'baby', label: 'Kids', icon: Baby },
  { key: 'paw', label: 'Pet', icon: PawPrint },
  { key: 'accessibility', label: 'Acessível', icon: Accessibility },
  { key: 'heart', label: 'Bem-estar', icon: Heart },
  { key: 'star', label: 'VIP', icon: Star },
  { key: 'award', label: 'Premium', icon: Award },
] as const;

export type CustomSpaceIconKey = typeof CUSTOM_SPACE_ICON_OPTIONS[number]['key'];

const CUSTOM_AMENITY_ICONS_STORAGE_KEY = 'vagou_custom_amenity_icons';

const getSavedCustomAmenityIconsMap = (): Record<string, CustomSpaceIconKey> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_AMENITY_ICONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const detectIconKeyFromText = (text: string): CustomSpaceIconKey => {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/poltrona|massagem|cadeira|sofa|descanso|relax/.test(t)) return 'armchair';
  if (/game|jogo|playstation|ps5|ps4|xbox|fliperama|sinuca|bilhar/.test(t)) return 'gamepad';
  if (/toalha|quente|vapor|ozonio|spa|sauna|barboterapia/.test(t)) return 'flame';
  if (/musica|som|spotify|fone|audio|ambiente|dj/.test(t)) return 'music';
  if (/esteriliz|autoclave|seguranca|camera|higien|biosseguranca|descartave/.test(t)) return 'shield';
  if (/brinde|cortesia|mimo|presente|kit/.test(t)) return 'gift';
  if (/cerveja|chopp|bar|whisky|vinho|drink|bebida|gelada/.test(t)) return 'wine';
  if (/cafe|expresso|capuccino|cha|agua|lanche|biscoito|snack/.test(t)) return 'coffee';
  if (/tv|televisao|telao|futebol|streaming|netflix/.test(t)) return 'tv';
  if (/tomada|carregador|usb|energia|bateria/.test(t)) return 'plug';
  if (/estacionamento|garagem|manobrista|valet|vaga|moto/.test(t)) return 'car';
  if (/ar-condicionado|climatiz|ventil|ar condicionado/.test(t)) return 'wind';
  if (/wifi|wi-fi|internet|rede/.test(t)) return 'wifi';
  if (/kids|crianca|infantil|brinquedo|fraldario/.test(t)) return 'baby';
  if (/pet|cachorro|animal|cao|gato/.test(t)) return 'paw';
  if (/acessibilidade|rampa|cadeirante|pcd|elevador/.test(t)) return 'accessibility';
  if (/cuid|estetica|pele|massoterap|bem-estar/.test(t)) return 'heart';
  if (/vip|exclusiv|prime|lounge/.test(t)) return 'star';
  if (/premio|certificad|excelencia|master/.test(t)) return 'award';
  return 'sparkles';
};

export const resolveSpaceAmenityIcon = (label: string) => {
  const cleanLabel = (label || '').trim();
  const predefined = PREDEFINED_SPACE_AMENITIES.find(
    (item) => item.label.toLowerCase() === cleanLabel.toLowerCase()
  );
  if (predefined) return predefined.icon;

  const savedMap = getSavedCustomAmenityIconsMap();
  const savedKey = savedMap[cleanLabel.toLowerCase()];
  if (savedKey) {
    const found = CUSTOM_SPACE_ICON_OPTIONS.find((opt) => opt.key === savedKey);
    if (found) return found.icon;
  }

  const autoKey = detectIconKeyFromText(cleanLabel);
  const autoFound = CUSTOM_SPACE_ICON_OPTIONS.find((opt) => opt.key === autoKey);
  return autoFound ? autoFound.icon : Sparkles;
};

export const ProfessionalSpaceManager: React.FC<ProfessionalSpaceManagerProps> = ({
  adminSettings,
  onUpdateSettings,
  onBack,
  initialTab = 'estrutura',
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<SpaceManagementTabId>(initialTab);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // ==============================================================
  // 1. ABA ESTRUTURA (Lista Pré-definida + Inserir Mais Itens + Descrição)
  // ==============================================================
  const [spaceDescription, setSpaceDescription] = useState(
    adminSettings.spaceDescription ||
    adminSettings.bio ||
    'Espaço premium especializado em estética masculina e feminina de alta precisão, barboterapia, cortes modernos e bem-estar.'
  );
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(() => {
    if (Array.isArray(adminSettings.amenities) && adminSettings.amenities.length > 0) {
      return adminSettings.amenities;
    }
    return DEFAULT_SPACE_AMENITIES;
  });
  const [customAmenityInput, setCustomAmenityInput] = useState('');
  const [selectedCustomIconKey, setSelectedCustomIconKey] = useState<CustomSpaceIconKey>('sparkles');
  const [hasManualIconSelection, setHasManualIconSelection] = useState(false);
  const [customIconsMap, setCustomIconsMap] = useState<Record<string, CustomSpaceIconKey>>(() =>
    getSavedCustomAmenityIconsMap()
  );

  const predefinedLabels = useMemo(
    () => new Set(PREDEFINED_SPACE_AMENITIES.map((a) => a.label)),
    []
  );

  const customAmenities = useMemo(
    () => selectedAmenities.filter((item) => !predefinedLabels.has(item)),
    [selectedAmenities, predefinedLabels]
  );

  const toggleAmenity = (label: string) => {
    hapticLight();
    setSelectedAmenities((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const handleCustomInputChange = (value: string) => {
    setCustomAmenityInput(value);
    if (!hasManualIconSelection) {
      setSelectedCustomIconKey(detectIconKeyFromText(value));
    }
    if (!value.trim()) {
      setHasManualIconSelection(false);
      setSelectedCustomIconKey('sparkles');
    }
  };

  const handleAddCustomAmenity = () => {
    const clean = customAmenityInput.trim();
    if (!clean) return;
    hapticSuccess();
    const resolvedKey = hasManualIconSelection
      ? selectedCustomIconKey
      : detectIconKeyFromText(clean);

    const updatedMap = {
      ...customIconsMap,
      [clean.toLowerCase()]: resolvedKey,
    };
    setCustomIconsMap(updatedMap);
    try {
      localStorage.setItem(CUSTOM_AMENITY_ICONS_STORAGE_KEY, JSON.stringify(updatedMap));
    } catch {}

    setSelectedAmenities((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setCustomAmenityInput('');
    setHasManualIconSelection(false);
    setSelectedCustomIconKey('sparkles');
  };

  const handleRemoveCustomAmenity = (label: string) => {
    hapticLight();
    setSelectedAmenities((prev) => prev.filter((item) => item !== label));
  };

  // ==============================================================
  // 2. ABA LOCALIZAÇÃO (CEP, Endereço, Número, Compl., Bairro, Cidade, UF — movido de Dados do Negócio)
  // ==============================================================
  const [cep, setCep] = useState(adminSettings.cep || '');
  const [logradouro, setLogradouro] = useState(adminSettings.logradouro || adminSettings.salonAddress || '');
  const [numero, setNumero] = useState(adminSettings.numero || '');
  const [complemento, setComplemento] = useState(adminSettings.complemento || '');
  const [bairro, setBairro] = useState(adminSettings.bairro || '');
  const [cidade, setCidade] = useState(adminSettings.cidade || '');
  const [uf, setUf] = useState(adminSettings.uf || '');
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState('');

  // ==============================================================
  // 3. ABA CONTATOS (WhatsApp, Tel. Fixo, E-mail, Site, Instagram, Facebook — movido de Dados do Negócio)
  // ==============================================================
  const [salonPhone, setSalonPhone] = useState(adminSettings.salonPhone || adminSettings.legalManagerPhone || '');
  const [phoneLandline, setPhoneLandline] = useState(adminSettings.phoneLandline || '');
  const [commercialEmail, setCommercialEmail] = useState(
    adminSettings.email || adminSettings.legalManagerEmail || (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_email') || '' : '')
  );
  const [websiteUrl, setWebsiteUrl] = useState(adminSettings.websiteUrl || '');
  const [instagramUrl, setInstagramUrl] = useState(adminSettings.instagramUrl || '');
  const [facebookUrl, setFacebookUrl] = useState(adminSettings.facebookUrl || '');
  const [isStorefrontQrModalOpen, setIsStorefrontQrModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Máscaras de formatação
  const formatCep = (v: string) => {
    const raw = v.replace(/\D/g, '').slice(0, 8);
    return raw.replace(/^(\d{5})(\d)/, '$1-$2');
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

  const formatLandline = (v: string) => {
    const raw = v.replace(/\D/g, '').slice(0, 10);
    return raw
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
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

  const resolvedSlug =
    adminSettings.salonSlug ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '') ||
    (adminSettings.salonName || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

  const storefrontUrl = resolvedSlug
    ? `https://${resolvedSlug}.vagouapp.com`
    : (typeof window !== 'undefined' ? window.location.origin : 'https://vagouapp.com');

  const storefrontQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(storefrontUrl)}`;

  const handleCopyStorefrontLink = async () => {
    hapticSuccess();
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {}
  };

  // Salvar configurações da seção Espaço
  const handleSaveSettings = (e?: React.FormEvent) => {
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

    const updatedSettings: Partial<SalonAdminSettings> = {
      spaceDescription: spaceDescription.trim(),
      amenities: selectedAmenities,
      cep: cep.trim(),
      logradouro: logradouro.trim(),
      numero: numero.trim(),
      complemento: complemento.trim(),
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      uf: uf.trim(),
      salonAddress: fullAddress || adminSettings.salonAddress,
      salonPhone: salonPhone.trim(),
      phoneLandline: phoneLandline.trim(),
      email: commercialEmail.trim().toLowerCase(),
      websiteUrl: websiteUrl.trim(),
      instagramUrl: instagramUrl.trim(),
      facebookUrl: facebookUrl.trim(),
    };

    onUpdateSettings(updatedSettings);

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
      {/* Barra de Topo Fixa com as 3 Abas: Estrutura | Localização | Contatos */}
      <div
        className={`${sectionHeaderStyleData.containerClass} flex-col gap-2`}
        style={sectionHeaderStyleData.containerStyle}
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            {onBack && (
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
            )}
            <div className="flex items-center gap-1.5">
              <Store className="w-4 h-4 shrink-0" style={sectionHeaderStyleData.iconStyle} />
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']" style={sectionHeaderStyleData.titleStyle}>
                Gestão do Espaço
              </h2>
            </div>
          </div>

          {savedSuccess && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold brand-btn px-2 py-0.5 rounded-[4px] shadow-xs animate-in fade-in">
              <Check className="w-3 h-3 text-white" />
              Salvo
            </span>
          )}
        </div>

        {/* 3 Abas Dedicadas: Estrutura | Contatos | Localização */}
        <div className="grid grid-cols-3 gap-1.5 w-full">
          {[
            { id: 'estrutura' as SpaceManagementTabId, label: 'Estrutura', icon: Sparkles },
            { id: 'contatos' as SpaceManagementTabId, label: 'Contatos', icon: Phone },
            { id: 'localizacao' as SpaceManagementTabId, label: 'Localização', icon: MapPin },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveTab(tab.id);
                }}
                className={`py-2 px-2 rounded-[4px] text-[11px] font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isSel
                    ? 'brand-btn shadow-xs'
                    : isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-[var(--brand-primary)]'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-[var(--brand-primary)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSel ? 'text-white' : 'brand-icon'}`} />
                <span className={isSel ? 'text-white' : ''}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleSaveSettings} className="p-3.5 space-y-4 pb-24 flex-1">
        {/* ============================================================== */}
        {/* ABA 1: ESTRUTURA (Lista Pré-definida + Inserir Mais Itens + Sobre o Espaço) */}
        {/* ============================================================== */}
        {activeTab === 'estrutura' && (
          <div className={`p-3.5 rounded-[4px] border space-y-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 brand-icon" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                  Estrutura & Comodidades
                </h3>
              </div>
              <span className="text-[10px] font-bold brand-text">
                {selectedAmenities.length} ativos
              </span>
            </div>

            {/* Descrição / Sobre o Espaço */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Sobre o Espaço
              </label>
              <textarea
                rows={2}
                value={spaceDescription}
                onChange={(e) => setSpaceDescription(e.target.value)}
                placeholder="Descreva a estrutura e o ambiente do seu estabelecimento..."
                className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition resize-none ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                }`}
              />
            </div>

            {/* Lista Pré-definida de Itens de Estrutura */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Itens Pré-definidos da Estrutura
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {PREDEFINED_SPACE_AMENITIES.map((item) => {
                  const Icon = item.icon;
                  const isActive = selectedAmenities.includes(item.label);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => toggleAmenity(item.label)}
                      className={`py-2 px-2.5 rounded-[4px] text-xs font-bold transition flex items-center justify-between gap-2 cursor-pointer text-left ${
                        isActive
                          ? 'brand-btn shadow-xs'
                          : isDark
                          ? 'bg-slate-950 text-slate-300 hover:text-white'
                          : 'bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'brand-icon'}`} />
                        <span className={`truncate ${isActive ? 'text-white' : ''}`}>{item.label}</span>
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inserir Mais Itens Personalizados */}
            <div className={`pt-2 border-t space-y-2.5 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Inserir Mais Itens na Estrutura
                </label>
                <span className="text-[10px] font-semibold brand-text">
                  {hasManualIconSelection ? 'Ícone selecionado' : 'Ícone automático por texto'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 flex items-center">
                  {(() => {
                    const ActiveInputIcon =
                      CUSTOM_SPACE_ICON_OPTIONS.find((o) => o.key === selectedCustomIconKey)?.icon || Sparkles;
                    return (
                      <ActiveInputIcon className="w-3.5 h-3.5 brand-icon absolute left-2.5 pointer-events-none shrink-0" />
                    );
                  })()}
                  <input
                    type="text"
                    value={customAmenityInput}
                    onChange={(e) => handleCustomInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomAmenity();
                      }
                    }}
                    placeholder="Ex: Poltrona de Massagem, Vídeo Game, Toalha Quente..."
                    className={`w-full pl-8 pr-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomAmenity}
                  className="px-3 py-2 rounded-[4px] brand-btn text-xs font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Inserir</span>
                </button>
              </div>

              {/* Seletor Rápido de Ícone para o Novo Item */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Escolha o Ícone do Item
                </span>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                  {CUSTOM_SPACE_ICON_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    const isIconSelected = selectedCustomIconKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setSelectedCustomIconKey(opt.key);
                          setHasManualIconSelection(true);
                        }}
                        title={opt.label}
                        className={`px-2 py-1.5 rounded-[4px] text-[10px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap ${
                          isIconSelected
                            ? 'brand-btn shadow-xs'
                            : isDark
                            ? 'bg-slate-950 text-slate-300 hover:text-white'
                            : 'bg-slate-100 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <OptIcon className={`w-3.5 h-3.5 shrink-0 ${isIconSelected ? 'text-white' : 'brand-icon'}`} />
                        <span className={isIconSelected ? 'text-white' : ''}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de Itens Personalizados Adicionados */}
              {customAmenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {customAmenities.map((item) => {
                    const CustomItemIcon =
                      CUSTOM_SPACE_ICON_OPTIONS.find((o) => o.key === customIconsMap[item.toLowerCase()])?.icon ||
                      resolveSpaceAmenityIcon(item);
                    return (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] brand-btn text-xs font-bold"
                      >
                        <CustomItemIcon className="w-3.5 h-3.5 text-white shrink-0" />
                        <span className="text-white">{item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomAmenity(item)}
                          className="p-0.5 rounded-[4px] hover:bg-black/20 text-white transition cursor-pointer"
                          title="Remover item"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA 2: LOCALIZAÇÃO & ENDEREÇO (Movida de Dados do Negócio) */}
        {/* ============================================================== */}
        {activeTab === 'localizacao' && (
          <div className={`p-3.5 rounded-[4px] border space-y-3 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 brand-icon" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                  Localização & Endereço
                </h3>
              </div>
              <span className="text-[10px] brand-text font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 brand-icon" />
                ViaCEP + Maps
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  CEP <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    className={`w-full pl-2.5 pr-8 py-2 rounded-[4px] border text-xs font-mono outline-hidden transition ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                    }`}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {isSearchingCep ? (
                      <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Endereço <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Rua, Avenida, Alameda..."
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            {cepError && (
              <p className="text-[11px] text-rose-400 font-medium">{cepError}</p>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Número <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="123"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Compl.
                </label>
                <input
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Sala 2, Loja B, Galeria..."
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2.5">
              <div className="col-span-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Bairro <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Centro"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Cidade <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="São Paulo"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="col-span-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  UF <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className={`w-full px-2 py-2 rounded-[4px] border text-xs font-mono text-center uppercase outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA 3: CONTATOS & REDES SOCIAIS (Movida de Dados do Negócio) */}
        {/* ============================================================== */}
        {activeTab === 'contatos' && (
          <div className={`p-3.5 rounded-[4px] border space-y-3.5 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className={`flex items-center gap-2 pb-2 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <Phone className="w-4 h-4 brand-icon" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                Contato & Canais Digitais
              </h3>
            </div>

            {/* Link Exclusivo & QR Code da Vitrine */}
            <div className={`space-y-2 pb-3 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 brand-icon" />
                  <span>Link Exclusivo & QR Code da Vitrine</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setIsStorefrontQrModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-[4px] brand-btn text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3 h-3 text-white" />
                  <span className="text-white">Placa QR Code</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono font-bold brand-text truncate">
                    {storefrontUrl}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyStorefrontLink}
                    className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded-[4px] brand-btn text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span className="text-white">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-white" />
                        <span className="text-white">Copiar Link</span>
                      </>
                    )}
                  </button>
                  <a
                    href={storefrontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-2.5 py-1.5 rounded-[4px] border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap ${
                      isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5 brand-icon" />
                    <span>Abrir</span>
                  </a>
                </div>
              </div>
            </div>

            {/* WhatsApp, Tel. Fixo, E-mail */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Phone className="w-3 h-3 brand-icon" />
                  <span>WhatsApp <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={salonPhone}
                  onChange={(e) => setSalonPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs font-mono outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Tel. Fixo
                </label>
                <input
                  type="text"
                  value={phoneLandline}
                  onChange={(e) => setPhoneLandline(formatLandline(e.target.value))}
                  placeholder="(00) 0000-0000"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs font-mono outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Mail className="w-3 h-3 brand-icon" />
                  <span>E-mail</span>
                </label>
                <input
                  type="email"
                  value={commercialEmail}
                  onChange={(e) => setCommercialEmail(e.target.value)}
                  placeholder="contato@salao.com"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                  }`}
                />
              </div>
            </div>

            {/* Site, Instagram e Facebook */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Globe className="w-3 h-3 brand-icon" />
                  <span>Site</span>
                </label>
                <input
                  type="text"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="www.meusalao.com.br"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Instagram className="w-3 h-3 brand-icon" />
                  <span>Instagram</span>
                </label>
                <input
                  type="text"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="@meusalao"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                  }`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Facebook className="w-3 h-3 brand-icon" />
                  <span>Facebook</span>
                </label>
                <input
                  type="text"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="facebook.com/meusalao"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-[var(--brand-primary)]'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[var(--brand-primary)]'
                  }`}
                />
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Modal de Impressão da Placa QR Code de Agendamento da Vitrine */}
      {isStorefrontQrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsStorefrontQrModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[4px] overflow-hidden flex flex-col max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 brand-icon" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Placa QR Code da Vitrine
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStorefrontQrModalOpen(false)}
                className="p-1 rounded-[4px] text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col items-center text-center space-y-3 overflow-y-auto">
              <span className="px-2.5 py-0.5 rounded-[4px] brand-btn text-[10px] font-bold uppercase tracking-wider">
                Agende Seu Horário Online
              </span>
              <h4 className="text-base font-black text-white">
                {adminSettings.salonName || 'Meu Estabelecimento'}
              </h4>
              {adminSettings.slogan && (
                <p className="text-[11px] text-slate-400">{adminSettings.slogan}</p>
              )}
              <div className="p-3 bg-white rounded-[4px] shadow-md">
                <img
                  src={storefrontQrUrl}
                  alt={`QR Code Vitrine ${adminSettings.salonName}`}
                  className="w-44 h-44 object-contain"
                />
              </div>
              <p className="text-[11px] font-mono font-bold brand-text break-all">
                {storefrontUrl}
              </p>
              <p className="text-[10px] text-slate-400">
                Aponte a câmera do celular para ver os serviços e agendar sem fila.
              </p>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 sticky bottom-0 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyStorefrontLink}
                className="flex-1 py-2.5 px-3 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5 text-white" />
                <span className="text-white">{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 rounded-[4px] brand-btn text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span className="text-white">Imprimir Placa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RODAPÉ FIXO DE AÇÃO (STICKY BOTTOM-0 Z-20) */}
      <div className={`sticky bottom-0 z-20 p-3 border-t backdrop-blur-md flex items-center justify-between gap-3 ${
        isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
      }`}>
        {onBack && (
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
        )}
        <button
          type="button"
          onClick={() => handleSaveSettings()}
          className="flex-1 py-2.5 px-4 rounded-[4px] brand-btn font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
        >
          <Save className="w-4 h-4 text-white" />
          <span className="text-white">Salvar Espaço</span>
        </button>
      </div>
    </div>
  );
};
