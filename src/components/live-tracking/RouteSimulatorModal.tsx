import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  MapPin,
  X,
  Compass,
  Car,
  Bike,
  Footprints,
  Loader2,
  Home,
  Search,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../../utils/haptics';
import { BookingAppointment, TransportMode } from '../../types';
import {
  snapAndReverseGeocodeGps,
  searchGooglePlacesSuggestions,
  geocodeAddressThreeLayers,
  GooglePlaceSuggestion,
} from '../../services/googleMapsService';
import { fetchUserProfileFromDb } from '../../lib/supabase';

interface RouteSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRoute: (appointment: BookingAppointment) => void;
  defaultOriginAddress?: string;
  defaultDestAddress?: string;
}

function resolveSavedUserHomeAddress(): string {
  if (typeof window === 'undefined') return '';

  const directHome = (localStorage.getItem('vagou_user_home_address') || '').trim();
  if (directHome) return directHome;

  const userAddress = (localStorage.getItem('vagou_user_address') || '').trim();
  if (userAddress) return userAddress;

  try {
    const rawAddrJson = localStorage.getItem('vagou_user_address_json');
    if (rawAddrJson) {
      const parsed = JSON.parse(rawAddrJson);
      if (parsed?.street) {
        return `${parsed.street}${parsed.number ? `, ${parsed.number}` : ''}${
          parsed.neighborhood ? ` - ${parsed.neighborhood}` : ''
        }${parsed.city ? `, ${parsed.city}` : ''}${
          parsed.uf ? `/${parsed.uf}` : ''
        }${parsed.cep ? `, CEP ${parsed.cep}` : ''}`;
      }
      if (parsed?.cep) return String(parsed.cep).trim();
    }
  } catch {}

  try {
    const rawProfile = localStorage.getItem('vagou_user_profile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      const profAddr = (parsed?.address || parsed?.default_address || parsed?.cep || '').trim();
      if (profAddr) return profAddr;
    }
  } catch {}

  const userCep = (localStorage.getItem('vagou_user_cep') || '').trim();
  if (userCep) return userCep;

  const testAddr = (localStorage.getItem('vagou_client_test_address') || '').trim();
  if (testAddr) return testAddr;

  return '';
}

export const RouteSimulatorModal: React.FC<RouteSimulatorModalProps> = ({
  isOpen,
  onClose,
  onStartRoute,
  defaultOriginAddress,
  defaultDestAddress,
}) => {
  const { isDark } = useTheme();
  const destInputRef = useRef<HTMLInputElement | null>(null);

  const [originAddress, setOriginAddress] = useState<string>(defaultOriginAddress || '');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [originPlaceId, setOriginPlaceId] = useState<string>('');
  const [isCustomOrigin, setIsCustomOrigin] = useState<boolean>(Boolean(defaultOriginAddress));
  const [originSuggestions, setOriginSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState<boolean>(false);

  // Destino inicia 100% em branco e limpo para receber CEP, endereço ou "Para Casa"
  const [destAddress, setDestAddress] = useState<string>(defaultDestAddress || '');
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destPlaceId, setDestPlaceId] = useState<string>('');
  const [destSuggestions, setDestSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState<boolean>(false);

  const [transportMode, setTransportMode] = useState<TransportMode>('car');
  const [isLocatingOrigin, setIsLocatingOrigin] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Sincroniza endereço residencial do banco caso ainda não esteja no cache local e captura o GPS de partida
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    setDestAddress(defaultDestAddress || '');
    setDestCoords(null);
    setDestPlaceId('');
    setDestSuggestions([]);
    setErrorMessage('');

    // Pré-sincroniza endereço de casa do perfil no Supabase em background
    if (!resolveSavedUserHomeAddress()) {
      fetchUserProfileFromDb()
        .then((dbProf) => {
          if (!active || !dbProf?.address) return;
          try {
            localStorage.setItem('vagou_user_home_address', dbProf.address);
          } catch {}
        })
        .catch(() => {});
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsLocatingOrigin(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!active) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setOriginCoords({ lat, lng });
          setOriginPlaceId('');
          setIsCustomOrigin(false);

          const snapped = await snapAndReverseGeocodeGps(lat, lng);
          if (!active) return;
          if (snapped?.formattedAddress || snapped?.streetName) {
            setOriginAddress(snapped.formattedAddress || snapped.streetName);
          } else {
            setOriginAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
          setIsLocatingOrigin(false);
        },
        () => {
          if (!active) return;
          setIsLocatingOrigin(false);
          if (!originAddress) {
            const saved = resolveSavedUserHomeAddress();
            if (saved) {
              setOriginAddress(saved);
              setIsCustomOrigin(true);
            }
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultDestAddress]);

  if (!isOpen) return null;

  const geocodeAddress = async (
    query: string,
    biasCoords?: { lat: number; lng: number } | null
  ): Promise<{ lat: number; lng: number; placeId?: string } | null> => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    const cepMatch = cleanQuery.match(/\b(\d{5})-?(\d{3})\b/);
    const extractedCep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : '';

    const res = await geocodeAddressThreeLayers({
      address: cleanQuery,
      cep: extractedCep,
      biasLat: biasCoords?.lat ?? originCoords?.lat,
      biasLng: biasCoords?.lng ?? originCoords?.lng,
    });
    if (res && typeof res.lat === 'number' && typeof res.lng === 'number') {
      return { lat: res.lat, lng: res.lng, placeId: res.googlePlaceId || '' };
    }
    return null;
  };

  const handleUseCurrentLocation = () => {
    hapticLight();
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocalização não disponível no navegador.');
      return;
    }

    setIsLocatingOrigin(true);
    setOriginAddress('');
    setOriginPlaceId('');
    setIsCustomOrigin(false);
    setOriginSuggestions([]);
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        hapticSuccess();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setOriginCoords({ lat, lng });

        const snapped = await snapAndReverseGeocodeGps(lat, lng);
        if (snapped?.formattedAddress || snapped?.streetName) {
          setOriginAddress(snapped.formattedAddress || snapped.streetName);
        } else {
          setOriginAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        setIsLocatingOrigin(false);
      },
      (err) => {
        setIsLocatingOrigin(false);
        setErrorMessage(
          err.code === 1
            ? 'Permissão de localização negada. Ative o GPS nas configurações do celular.'
            : 'Não foi possível capturar o GPS atual.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };

  const applyHomeAddressToField = async (target: 'origin' | 'dest') => {
    hapticLight();
    setErrorMessage('');

    let savedHome = resolveSavedUserHomeAddress();
    if (!savedHome) {
      const dbProf = await fetchUserProfileFromDb().catch(() => null);
      if (dbProf?.address) {
        savedHome = dbProf.address.trim();
        try {
          localStorage.setItem('vagou_user_home_address', savedHome);
        } catch {}
      }
    }

    if (!savedHome) {
      setErrorMessage('Cadastre seu endereço em Meus Dados ou digite o CEP/endereço no campo.');
      if (target === 'dest') {
        destInputRef.current?.focus();
      }
      return;
    }

    if (target === 'origin') {
      setIsCustomOrigin(true);
      setOriginSuggestions([]);
      await handleSmartInputChange(
        savedHome,
        setOriginAddress,
        setOriginCoords,
        setOriginPlaceId,
        setOriginSuggestions,
        setIsSearchingOrigin,
        true
      );
    } else {
      setDestSuggestions([]);
      await handleSmartInputChange(
        savedHome,
        setDestAddress,
        setDestCoords,
        setDestPlaceId,
        setDestSuggestions,
        setIsSearchingDest,
        true
      );
    }
  };

  // Manipulador inteligente para buscas de endereço (Texto -> Places API | CEP -> ViaCEP + Geocode)
  const handleSmartInputChange = async (
    rawVal: string,
    setAddress: (val: string) => void,
    setCoords: (coords: { lat: number; lng: number } | null) => void,
    setPlaceId: (id: string) => void,
    setSuggestions: (s: GooglePlaceSuggestion[]) => void,
    setIsSearching: (b: boolean) => void,
    skipAutocompleteDropdown = false
  ) => {
    setAddress(rawVal);
    setCoords(null);
    setPlaceId('');

    const cleanDigits = rawVal.replace(/\D/g, '');
    const hasLetters = /[a-zA-ZÀ-ÿ]/.test(rawVal);

    // Se for digitado CEP (8 dígitos numéricos)
    if (!hasLetters && cleanDigits.length === 8) {
      const formattedCep = `${cleanDigits.slice(0, 5)}-${cleanDigits.slice(5)}`;
      setAddress(formattedCep);
      setIsSearching(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanDigits}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            const fullAddr = `${data.logradouro || ''}${
              data.bairro ? `, ${data.bairro}` : ''
            } - ${data.localidade || ''}/${data.uf || ''}, CEP ${formattedCep}`.replace(
              /^,\s*/,
              ''
            );
            setAddress(fullAddr);
            const structuredRes = await geocodeAddressThreeLayers({
              address: data.logradouro || fullAddr,
              neighborhood: data.bairro || '',
              city: data.localidade || '',
              state: data.uf || 'SP',
              cep: cleanDigits,
              biasLat: originCoords?.lat,
              biasLng: originCoords?.lng,
            });
            if (structuredRes) {
              setCoords({ lat: structuredRes.lat, lng: structuredRes.lng });
              setPlaceId(structuredRes.googlePlaceId || '');
            }
            setSuggestions([]);
            setIsSearching(false);
            return;
          }
        }
      } catch {}
      setIsSearching(false);
    }

    if (skipAutocompleteDropdown) {
      setIsSearching(true);
      const geo = await geocodeAddress(rawVal);
      if (geo) {
        setCoords({ lat: geo.lat, lng: geo.lng });
        setPlaceId(geo.placeId || '');
      }
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    // Se for busca textual (>= 3 caracteres)
    if (rawVal.trim().length >= 3) {
      setIsSearching(true);
      try {
        const list = await searchGooglePlacesSuggestions(
          rawVal.trim(),
          originCoords?.lat,
          originCoords?.lng
        );
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanOrigin = originAddress.trim();
    const cleanDest = destAddress.trim();

    if (!cleanOrigin) {
      setErrorMessage('Informe o endereço de partida.');
      return;
    }
    if (!cleanDest) {
      setErrorMessage('Informe o CEP, endereço de destino ou toque em "Para Casa".');
      destInputRef.current?.focus();
      return;
    }

    hapticMedium();
    setIsSubmitting(true);

    try {
      // 1. Resolve Coordenadas de Origem se ainda não obtidas via GPS ou Google Places
      let resolvedOrigin = originCoords;
      let resolvedOriginPlaceId = originPlaceId;
      if (!resolvedOrigin) {
        const geoOrigin = await geocodeAddress(cleanOrigin);
        if (geoOrigin) {
          resolvedOrigin = { lat: geoOrigin.lat, lng: geoOrigin.lng };
          resolvedOriginPlaceId = geoOrigin.placeId || '';
        }
      }
      if (!resolvedOrigin) {
        resolvedOrigin = { lat: -23.5505, lng: -46.6333 };
      }

      // 2. Resolve Coordenadas de Destino via Google Geocoding API / Places API com viés regional na origem
      let resolvedDest = destCoords;
      let resolvedDestPlaceId = destPlaceId;
      if (!resolvedDest) {
        const geoDest = await geocodeAddress(cleanDest, resolvedOrigin);
        if (geoDest) {
          resolvedDest = { lat: geoDest.lat, lng: geoDest.lng };
          resolvedDestPlaceId = geoDest.placeId || '';
        }
      }
      if (!resolvedDest) {
        const lowerDest = cleanDest.toLowerCase();
        if (lowerDest.includes('guarulhos') || lowerDest.includes('aeroporto')) {
          resolvedDest = { lat: -23.4356, lng: -46.4731 };
        } else if (
          lowerDest.includes('serrana') ||
          lowerDest.includes('cidade líder') ||
          lowerDest.includes('cidade lider')
        ) {
          resolvedDest = { lat: -23.5505, lng: -46.4684 };
        } else {
          resolvedDest = { lat: -23.5621, lng: -46.4795 };
        }
      }

      const destTitle = cleanDest.split(',')[0].split('-')[0].trim() || 'Destino';

      // 3. Cria agendamento de teste para disparar a tela de navegação
      const testAppointment: BookingAppointment = {
        id: `trajeto-${Date.now()}`,
        protocolCode: `#TRAJETO-${Math.floor(1000 + Math.random() * 9000)}`,
        salonName: destTitle,
        service: 'Navegação GPS Provisória (Teste)',
        serviceTitle: 'Navegação GPS Provisória (Teste)',
        dateTime: 'Ao Vivo (Teste de Trajeto)',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        totalPrice: 0,
        status: 'CONFIRMADO',
        tracking_status: 'live_sharing',
        transport_mode: transportMode,
        address: cleanDest,
        client_lat: resolvedOrigin.lat,
        client_lng: resolvedOrigin.lng,
        ...({
          originLat: resolvedOrigin.lat,
          originLng: resolvedOrigin.lng,
          originFormattedAddress: cleanOrigin,
          originPlaceId: resolvedOriginPlaceId,
          isCustomSimulatedOrigin: isCustomOrigin,
          salonLat: resolvedDest.lat,
          salonLng: resolvedDest.lng,
          destinationLat: resolvedDest.lat,
          destinationLng: resolvedDest.lng,
          destPlaceId: resolvedDestPlaceId,
        } as any),
      };

      setIsSubmitting(false);
      hapticSuccess();
      onStartRoute(testAppointment);
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Erro ao iniciar trajeto. Tente novamente.');
    }
  };

  const backdropMouseDownRef = useRef(false);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-[#E6EEF6]/80 backdrop-blur-xs animate-in fade-in"
      onMouseDown={(e) => {
        backdropMouseDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropMouseDownRef.current) {
          onClose();
        }
        backdropMouseDownRef.current = false;
      }}
    >
      <div
        className={`w-full max-w-[430px] h-dvh max-h-dvh flex flex-col overflow-hidden shadow-lg transition ${
          isDark
            ? 'bg-slate-950 text-white'
            : 'bg-[#F7F9FC] text-[#1E293B]'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra Superior Institucional com Botão Voltar */}
        <div
          className={`px-3.5 py-3 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#E6EDF5]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] transition active:scale-95 cursor-pointer text-xs font-bold ${
              isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#F1F5F9] text-[#1E293B]'
            }`}
          >
            <ChevronRight className="w-4 h-4 rotate-180 text-[#2B82C9]" />
            <span>Voltar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-[4px] border flex items-center justify-center transition cursor-pointer shrink-0 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário Rolável */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
          {/* Card de Apresentação da Ferramenta */}
          <div className={`caixa-card p-3.5 rounded-[4px] flex items-center gap-3 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'
          }`}>
            <div className="caixa-icon-halo w-10 h-10 rounded-full shrink-0">
              <Navigation className="w-5 h-5 text-[#2B82C9]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-bold text-[#1E293B] dark:text-white truncate leading-tight">
                  Trajeto (Simulador GPS)
                </h3>
                <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                  Teste Provisório
                </span>
              </div>
              <p
                className={`text-[11px] truncate mt-0.5 ${
                  isDark ? 'text-slate-400' : 'text-[#64748B]'
                }`}
              >
                Defina partida e destino para testar a navegação GPS
              </p>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="p-2.5 rounded-[4px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs font-bold flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 text-[#DC2626]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Card Principal de Campos de Trajeto */}
          <div className={`caixa-card p-4 rounded-[4px] space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'
          }`}>
            {/* CAMPO 1: DE ONDE VOCÊ VAI SAIR? */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1E293B] dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#2B82C9]" />
                  <span>De onde você vai sair?</span>
                </label>

                <div className="flex items-center gap-1.5">
                  {/* Botão "Local Atual" */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocatingOrigin}
                    className="px-2.5 py-1.5 rounded-[4px] bg-[#2B82C9] hover:bg-[#1F6FB0] text-white font-bold text-[10.5px] flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    title="Detectar endereço via GPS do celular"
                  >
                    {isLocatingOrigin ? (
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                    ) : (
                      <Compass className="w-3 h-3 text-white" />
                    )}
                    <span className="text-white">Local Atual</span>
                  </button>

                  {/* Botão "De Casa" */}
                  <button
                    type="button"
                    onClick={() => applyHomeAddressToField('origin')}
                    className={`px-2.5 py-1.5 rounded-[4px] border font-bold text-[10.5px] flex items-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-[#2B82C9]'
                        : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#5F6C7B] hover:border-[#2B82C9] hover:text-[#1E293B]'
                    }`}
                    title="Usar endereço de casa salvo"
                  >
                    <Home className="w-3 h-3 text-[#2B82C9]" />
                    <span>De Casa</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={originAddress}
                  onChange={(e) => {
                    setIsCustomOrigin(true);
                    handleSmartInputChange(
                      e.target.value,
                      setOriginAddress,
                      setOriginCoords,
                      setOriginPlaceId,
                      setOriginSuggestions,
                      setIsSearchingOrigin
                    );
                  }}
                  placeholder={isLocatingOrigin ? '' : 'Digite o endereço ou CEP de partida'}
                  className="caixa-input !pr-16 text-xs"
                />
                <div className="absolute inset-y-0 right-2.5 flex items-center gap-1">
                  {originAddress && !isLocatingOrigin && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setOriginAddress('');
                        setOriginCoords(null);
                        setOriginPlaceId('');
                        setOriginSuggestions([]);
                      }}
                      className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Limpar endereço de partida"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="pointer-events-none flex items-center">
                    {isLocatingOrigin || isSearchingOrigin ? (
                      <Loader2 className="w-4 h-4 text-[#2B82C9] animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-[#64748B]" />
                    )}
                  </span>
                </div>

                {/* Sugestões de Endereço Inteligente (Places API) */}
                {originSuggestions.length > 0 && (
                  <div
                    className={`mt-1 rounded-[4px] border divide-y overflow-hidden shadow-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 divide-slate-800'
                        : 'bg-white border-[#E6EDF5] divide-[#EDF2F7]'
                    }`}
                  >
                    {originSuggestions.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setIsCustomOrigin(true);
                          setOriginAddress(place.formattedAddress);
                          setOriginCoords({ lat: place.lat, lng: place.lng });
                          setOriginPlaceId(place.id || '');
                          setOriginSuggestions([]);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-start gap-2 transition cursor-pointer ${
                          isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#F7F9FC] text-[#1E293B]'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#2B82C9] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold block truncate">{place.title}</span>
                          <span
                            className={`text-[10.5px] block truncate ${
                              isDark ? 'text-slate-400' : 'text-[#64748B]'
                            }`}
                          >
                            {place.formattedAddress}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#EDF2F7] dark:border-slate-800" />

            {/* CAMPO 2: PARA ONDE VOCÊ VAI? (EM BRANCO + BOTÃO "PARA CASA" + CEP/ENDEREÇO) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1E293B] dark:text-slate-200 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#2B82C9]" />
                  <span>Para onde você vai?</span>
                </label>

                {/* Botão "Para Casa" */}
                <button
                  type="button"
                  onClick={() => applyHomeAddressToField('dest')}
                  className={`px-2.5 py-1.5 rounded-[4px] border font-bold text-[10.5px] flex items-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                    isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-[#2B82C9]'
                      : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#5F6C7B] hover:border-[#2B82C9] hover:text-[#1E293B]'
                  }`}
                  title="Ir para o endereço de casa salvo"
                >
                  <Home className="w-3 h-3 text-[#2B82C9]" />
                  <span>Para Casa</span>
                </button>
              </div>

              <div className="relative">
                <input
                  ref={destInputRef}
                  type="text"
                  value={destAddress}
                  onChange={(e) =>
                    handleSmartInputChange(
                      e.target.value,
                      setDestAddress,
                      setDestCoords,
                      setDestPlaceId,
                      setDestSuggestions,
                      setIsSearchingDest
                    )
                  }
                  placeholder="Digite o CEP ou endereço de destino"
                  className="caixa-input !pr-16 text-xs"
                />
                <div className="absolute inset-y-0 right-2.5 flex items-center gap-1">
                  {destAddress && !isSearchingDest && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setDestAddress('');
                        setDestCoords(null);
                        setDestPlaceId('');
                        setDestSuggestions([]);
                        destInputRef.current?.focus();
                      }}
                      className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Limpar destino"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="pointer-events-none flex items-center">
                    {isSearchingDest ? (
                      <Loader2 className="w-4 h-4 text-[#2B82C9] animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-[#64748B]" />
                    )}
                  </span>
                </div>

                {/* Sugestões de Endereço Inteligente para Destino (Places API) */}
                {destSuggestions.length > 0 && (
                  <div
                    className={`mt-1 rounded-[4px] border divide-y overflow-hidden shadow-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 divide-slate-800'
                        : 'bg-white border-[#E6EDF5] divide-[#EDF2F7]'
                    }`}
                  >
                    {destSuggestions.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setDestAddress(place.formattedAddress);
                          setDestCoords({ lat: place.lat, lng: place.lng });
                          setDestPlaceId(place.id || '');
                          setDestSuggestions([]);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-start gap-2 transition cursor-pointer ${
                          isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#F7F9FC] text-[#1E293B]'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#2B82C9] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold block truncate">{place.title}</span>
                          <span
                            className={`text-[10.5px] block truncate ${
                              isDark ? 'text-slate-400' : 'text-[#64748B]'
                            }`}
                          >
                            {place.formattedAddress}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#EDF2F7] dark:border-slate-800" />

            {/* CAMPO 3: MODALIDADE */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#1E293B] dark:text-slate-200 block">
                Modalidade de Deslocamento
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'car' as TransportMode, label: 'Carro', icon: Car },
                  { key: 'motorcycle' as TransportMode, label: 'Moto', icon: Navigation },
                  { key: 'bicycling' as TransportMode, label: 'Bike', icon: Bike },
                  { key: 'walking' as TransportMode, label: 'A pé', icon: Footprints },
                ].map((m) => {
                  const IconComponent = m.icon;
                  const isSel = transportMode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setTransportMode(m.key);
                      }}
                      className={`p-2.5 rounded-[4px] border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                        isSel
                          ? 'bg-[#2B82C9] border-[#2B82C9] text-white font-bold shadow-xs'
                          : isDark
                          ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#5F6C7B] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <IconComponent
                        className={`w-4 h-4 ${isSel ? 'text-white' : 'text-[#2B82C9]'}`}
                      />
                      <span className={`text-[10px] ${isSel ? 'text-white font-bold' : ''}`}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RODAPÉ FIXO: BOTÃO IR */}
          <div
            className={`pt-3 border-t sticky bottom-0 z-20 ${
              isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-[#F7F9FC]/95 border-[#E6EDF5]'
            }`}
          >
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-[4px] bg-[#2B82C9] hover:bg-[#1F6FB0] active:scale-98 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span className="text-white">Calculando Trajeto...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-white fill-white" />
                  <span className="text-white">Ir (Iniciar Navegação)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
