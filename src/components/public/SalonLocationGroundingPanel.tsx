import React, { useState, useEffect, useCallback } from 'react';
import {
  Bus,
  Car,
  Coffee,
  Compass,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { hapticLight, hapticMedium } from '../../utils/haptics';

export interface GroundingSourceItem {
  title: string;
  uri: string;
  placeId?: string;
  address?: string;
  reviewSnippet?: string;
}

export interface SalonLocationGroundingPanelProps {
  salonName: string;
  salonAddress: string;
  salonCity?: string;
  category?: string;
  lat?: number;
  lng?: number;
  isDark?: boolean;
}

type GroundingTabMode = 'maps' | 'search';

const MAPS_QUICK_TOPICS = [
  { id: 'parking', label: 'Estacionamentos', query: 'Estacionamentos próximos e seguros', Icon: Car },
  { id: 'transit', label: 'Metrô & Ônibus', query: 'Estações de metrô e pontos de ônibus próximos', Icon: Bus },
  { id: 'coffee', label: 'Cafés & Espera', query: 'Cafeterias e padarias próximas para aguardar', Icon: Coffee },
  { id: 'landmarks', label: 'Referências', query: 'Pontos de referência comerciais na mesma rua ou esquina', Icon: Compass },
] as const;

const SEARCH_QUICK_TOPICS = [
  { id: 'trends', label: 'Tendências 2026', query: 'Tendências de cortes masculinos, barbearia e beleza em alta no Brasil', Icon: Sparkles },
  { id: 'traffic', label: 'Trânsito & Clima', query: 'Condições atuais de clima e mobilidade urbana hoje', Icon: Globe },
  { id: 'care', label: 'Pós-Atendimento', query: 'Dicas práticas de manutenção de corte, barba e hidratação capilar', Icon: Compass },
] as const;

export const SalonLocationGroundingPanel: React.FC<SalonLocationGroundingPanelProps> = ({
  salonName,
  salonAddress,
  salonCity = '',
  category = 'barbearia e estética',
  lat,
  lng,
  isDark = true,
}) => {
  const [mode, setMode] = useState<GroundingTabMode>('maps');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [activeTopicId, setActiveTopicId] = useState<string>('parking');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resultText, setResultText] = useState<string>('');
  const [sources, setSources] = useState<GroundingSourceItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runGroundingQuery = useCallback(
    async (targetMode: GroundingTabMode, queryText: string, topicId?: string) => {
      const cleanQuery = queryText.trim();
      if (!cleanQuery) return;

      if (topicId) {
        setActiveTopicId(topicId);
      }
      setIsLoading(true);
      setErrorMsg(null);

      try {
        // Opcionalmente captura coordenadas do navegador se não fornecidas pelo salão
        let resolvedLat = lat;
        let resolvedLng = lng;
        if (
          targetMode === 'maps' &&
          (typeof resolvedLat !== 'number' || typeof resolvedLng !== 'number') &&
          typeof navigator !== 'undefined' &&
          'geolocation' in navigator
        ) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 2200,
                maximumAge: 120000,
              });
            });
            resolvedLat = pos.coords.latitude;
            resolvedLng = pos.coords.longitude;
          } catch {}
        }

        const endpoint =
          targetMode === 'maps' ? '/api/grounding/maps' : '/api/grounding/search';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: cleanQuery,
            salonName,
            salonAddress: [salonAddress, salonCity].filter(Boolean).join(', '),
            city: salonCity,
            category,
            lat: resolvedLat,
            lng: resolvedLng,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Não foi possível consultar os dados verificados.');
        }

        setResultText(String(data?.text || ''));
        setSources(Array.isArray(data?.sources) ? data.sources : []);
      } catch (err: any) {
        setErrorMsg(
          err?.message || 'Não foi possível carregar os dados verificados. Verifique sua conexão.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [salonName, salonAddress, salonCity, category, lat, lng]
  );

  // Carrega automaticamente o primeiro tópico de estacionamentos ao montar
  useEffect(() => {
    runGroundingQuery('maps', MAPS_QUICK_TOPICS[0].query, 'parking');
  }, [runGroundingQuery]);

  const handleModeSwitch = (nextMode: GroundingTabMode) => {
    if (nextMode === mode) return;
    hapticLight();
    setMode(nextMode);
    setCustomQuery('');
    if (nextMode === 'maps') {
      runGroundingQuery('maps', MAPS_QUICK_TOPICS[0].query, 'parking');
    } else {
      runGroundingQuery('search', SEARCH_QUICK_TOPICS[0].query, 'trends');
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    hapticMedium();
    setActiveTopicId('custom');
    runGroundingQuery(mode, customQuery.trim(), 'custom');
  };

  const formattedParagraphs = resultText
    .split('\n')
    .map((line) => line.replace(/\*\*/g, '').trim())
    .filter(Boolean);

  return (
    <div
      className={`rounded-[4px] p-3 space-y-2.5 ${
        isDark ? 'bg-slate-950/90 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Seletor de Modo: Radar Google Maps vs Google Search Web */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Radar Inteligente da Região
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleModeSwitch('maps')}
            className={`px-2 py-1 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              mode === 'maps'
                ? 'bg-emerald-500 text-white'
                : isDark
                ? 'bg-slate-900 text-slate-400 hover:text-white'
                : 'bg-slate-200 text-slate-700 hover:text-slate-950'
            }`}
          >
            <MapPin className={`w-3 h-3 shrink-0 ${mode === 'maps' ? 'text-white' : 'text-emerald-400'}`} />
            <span className={mode === 'maps' ? 'text-white' : ''}>Google Maps</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeSwitch('search')}
            className={`px-2 py-1 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
              mode === 'search'
                ? 'bg-emerald-500 text-white'
                : isDark
                ? 'bg-slate-900 text-slate-400 hover:text-white'
                : 'bg-slate-200 text-slate-700 hover:text-slate-950'
            }`}
          >
            <Globe className={`w-3 h-3 shrink-0 ${mode === 'search' ? 'text-white' : 'text-emerald-400'}`} />
            <span className={mode === 'search' ? 'text-white' : ''}>Busca Google</span>
          </button>
        </div>
      </div>

      {/* Chips Objetivos de 1 Toque */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(mode === 'maps' ? MAPS_QUICK_TOPICS : SEARCH_QUICK_TOPICS).map(({ id, label, query, Icon }) => {
          const isSelected = activeTopicId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                hapticLight();
                runGroundingQuery(mode, query, id);
              }}
              className={`px-2.5 py-1.5 rounded-[4px] text-[10px] font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-emerald-500 text-white'
                  : isDark
                  ? 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3 h-3 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />
              <span className={isSelected ? 'text-white' : ''}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Pesquisa Direta */}
      <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder={
              mode === 'maps'
                ? 'Buscar farmácia, banco, estacionamento perto...'
                : 'Pesquisar tendências, clima ou trânsito no Google...'
            }
            className={`w-full pl-8 pr-2.5 py-1.5 rounded-[4px] text-[11px] outline-none transition ${
              isDark
                ? 'bg-slate-900 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-500'
                : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500'
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !customQuery.trim()}
          className="px-3 py-1.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
        >
          <span className="text-white">Consultar</span>
        </button>
      </form>

      {/* Resultado Sintetizado + Links Verificados Obrigatórios (Google Maps / Google Search) */}
      <div
        className={`rounded-[4px] p-2.5 space-y-2 ${
          isDark ? 'bg-slate-900/90' : 'bg-white'
        }`}
      >
        {isLoading ? (
          <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500 shrink-0" />
            <span>
              {mode === 'maps'
                ? 'Consultando Google Maps ao redor do salão...'
                : 'Consultando Google Search em tempo real...'}
            </span>
          </div>
        ) : errorMsg ? (
          <p className="text-[11px] text-amber-400">{errorMsg}</p>
        ) : (
          <>
            {formattedParagraphs.length > 0 && (
              <div className="space-y-1">
                {formattedParagraphs.slice(0, 4).map((line, i) => (
                  <p
                    key={i}
                    className={`text-[11px] leading-snug ${
                      isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* Fontes & Links Diretos Obrigatórios (groundingChunks.maps.uri / groundingChunks.web.uri) */}
            {sources.length > 0 && (
              <div className="pt-1.5 space-y-1">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-400 block">
                  {mode === 'maps'
                    ? 'Locais Verificados no Google Maps:'
                    : 'Fontes Verificadas no Google Search:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {sources.map((src, idx) => (
                    <a
                      key={`${src.uri}-${idx}`}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[10px] font-bold transition cursor-pointer max-w-full ${
                        isDark
                          ? 'bg-slate-950 hover:bg-emerald-500 text-emerald-400 hover:text-white'
                          : 'bg-slate-100 hover:bg-emerald-500 text-slate-800 hover:text-white'
                      }`}
                      title={src.reviewSnippet || src.address || src.title}
                    >
                      {mode === 'maps' ? (
                        <MapPin className="w-3 h-3 shrink-0" />
                      ) : (
                        <Globe className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate max-w-[190px]">{src.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
