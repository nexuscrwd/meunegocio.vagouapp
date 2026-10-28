import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  GoogleComputedRouteResult,
  loadGoogleMapsJsSdk,
  snapAndReverseGeocodeGps,
} from '../../services/googleMapsService';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight } from '../../utils/haptics';

interface InteractiveGoogleRouteMapProps {
  originLat?: number;
  originLng?: number;
  originLabel: string;
  destLat?: number;
  destLng?: number;
  destLabel: string;
  routeData: GoogleComputedRouteResult | null;
  initialDistanceKm: number;
  initialEtaMinutes: number;
  fallbackEmbedUrl: string;
  onLiveGpsUpdate?: (lat: number, lng: number, snappedStreetName?: string) => void;
  onDestinationReachedChange?: (reached: boolean) => void;
}

function computeRoadDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;
  if (straightKm < 0.05) return 0;
  return Number((straightKm * 1.35).toFixed(1));
}

/**
 * Formata minutos restantes no padrão regressivo HH:MM (ex.: 14 min -> "00:14", 75 min -> "01:15")
 */
function formatCountdownHhMm(totalMinutes: number): string {
  const safeMin = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMin / 60);
  const mins = safeMin % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export const InteractiveGoogleRouteMap: React.FC<InteractiveGoogleRouteMapProps> = ({
  originLat = -23.5505,
  originLng = -46.6333,
  originLabel,
  destLat = -23.5621,
  destLng = -46.4795,
  destLabel,
  routeData,
  initialDistanceKm,
  initialEtaMinutes,
  fallbackEmbedUrl,
  onLiveGpsUpdate,
  onDestinationReachedChange,
}) => {
  const { isDark } = useTheme();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const outerPolylineRef = useRef<any>(null);
  const innerPolylineRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const liveUserMarkerRef = useRef<any>(null);

  const [sdkReady, setSdkReady] = useState<boolean>(false);
  const [sdkFailed, setSdkFailed] = useState<boolean>(false);
  const [liveUserPos, setLiveUserPos] = useState<{ lat: number; lng: number } | null>(null);

  const baseDistanceKm = routeData?.distanceKm ?? initialDistanceKm ?? 3.2;
  const baseEtaMinutes = routeData?.etaMinutes ?? initialEtaMinutes ?? 14;

  const [remainingDistanceKm, setRemainingDistanceKm] = useState<number>(baseDistanceKm);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(baseEtaMinutes);

  // Sincroniza quando a rota base da API chega
  useEffect(() => {
    setRemainingDistanceKm(baseDistanceKm);
    setRemainingMinutes(baseEtaMinutes);
  }, [baseDistanceKm, baseEtaMinutes]);

  // Verifica se o cliente chegou ao destino (<= 0.1 km ou 00:00)
  const hasReachedDestination = remainingDistanceKm <= 0.15 || remainingMinutes <= 0;

  useEffect(() => {
    onDestinationReachedChange?.(hasReachedDestination);
  }, [hasReachedDestination]);

  // 1. Load Google Maps JS SDK
  useEffect(() => {
    let mounted = true;
    loadGoogleMapsJsSdk().then((loaded) => {
      if (!mounted) return;
      if (loaded) {
        setSdkReady(true);
      } else {
        setSdkFailed(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Initialize Clean Google Map (Sem botões extras e respeitando o tema Claro/Escuro)
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    const pathPoints =
      routeData?.decodedPath && routeData.decodedPath.length > 1
        ? routeData.decodedPath
        : [
            { lat: originLat, lng: originLng },
            { lat: destLat, lng: destLng },
          ];

    const startCoord = pathPoints[0] || { lat: originLat, lng: originLng };
    const endCoord = pathPoints[pathPoints.length - 1] || { lat: destLat, lng: destLng };

    // Se o tema mudar, recria a instância com o colorScheme correspondente (LIGHT ou DARK)
    mapInstanceRef.current = new gmaps.Map(mapContainerRef.current, {
      center: startCoord,
      zoom: 14,
      mapId: 'DEMO_MAP_ID',
      colorScheme: isDark ? 'DARK' : 'LIGHT',
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    });

    const map = mapInstanceRef.current;

    if (outerPolylineRef.current) outerPolylineRef.current.setMap(null);
    if (innerPolylineRef.current) innerPolylineRef.current.setMap(null);

    outerPolylineRef.current = new gmaps.Polyline({
      path: pathPoints,
      geodesic: true,
      strokeColor: '#064e3b',
      strokeOpacity: 0.75,
      strokeWeight: 8,
      map,
    });

    innerPolylineRef.current = new gmaps.Polyline({
      path: pathPoints,
      geodesic: true,
      strokeColor: '#10b981',
      strokeOpacity: 1.0,
      strokeWeight: 5,
      map,
    });

    const createPinBadge = (bgHex: string, textHex: string, labelText: string) => {
      const el = document.createElement('div');
      el.style.background = bgHex;
      el.style.color = textHex;
      el.style.padding = '3px 7px';
      el.style.borderRadius = '4px';
      el.style.fontWeight = '800';
      el.style.fontSize = '10.5px';
      el.style.fontFamily = 'Poppins, sans-serif';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.28)';
      el.style.whiteSpace = 'nowrap';
      el.textContent = labelText;
      return el;
    };

    const AdvancedMarker = gmaps.marker?.AdvancedMarkerElement;
    if (AdvancedMarker) {
      if (originMarkerRef.current) originMarkerRef.current.map = null;
      if (destMarkerRef.current) destMarkerRef.current.map = null;

      originMarkerRef.current = new AdvancedMarker({
        map,
        position: startCoord,
        title: originLabel,
        content: createPinBadge(
          isDark ? '#0f172a' : '#ffffff',
          isDark ? '#ffffff' : '#0f172a',
          'Saída'
        ),
      });

      destMarkerRef.current = new AdvancedMarker({
        map,
        position: endCoord,
        title: destLabel,
        content: createPinBadge('#10b981', '#ffffff', destLabel.slice(0, 22)),
      });
    }

    if (pathPoints.length > 1) {
      const bounds = new gmaps.LatLngBounds();
      pathPoints.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { top: 36, right: 36, bottom: 56, left: 36 });
    }
  }, [sdkReady, isDark, routeData, originLat, originLng, destLat, destLng, originLabel, destLabel]);

  // 3. Rastreamento GPS em tempo real: recalcula km e HH:MM conforme aproxima ou se distancia do destino
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let lastSnapTs = 0;
    const avgMinutesPerKm =
      baseDistanceKm > 0 ? baseEtaMinutes / baseDistanceKm : 4.2;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        setLiveUserPos({ lat: rawLat, lng: rawLng });

        const liveDistKm = computeRoadDistanceKm(rawLat, rawLng, destLat, destLng);
        // Atualiza a distância e o tempo regressivo se o GPS estiver dentro de um raio urbano plausível (< 100 km)
        if (liveDistKm <= 100) {
          setRemainingDistanceKm(liveDistKm);
          const nextMin =
            liveDistKm <= 0.15
              ? 0
              : Math.max(1, Math.round(liveDistKm * avgMinutesPerKm));
          setRemainingMinutes(nextMin);
        }

        const now = Date.now();
        if (now - lastSnapTs > 15000) {
          lastSnapTs = now;
          const snapped = await snapAndReverseGeocodeGps(rawLat, rawLng);
          if (snapped) {
            setLiveUserPos({ lat: snapped.lat, lng: snapped.lng });
            onLiveGpsUpdate?.(snapped.lat, snapped.lng, snapped.streetName);
            return;
          }
        }
        onLiveGpsUpdate?.(rawLat, rawLng);
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [destLat, destLng, baseDistanceKm, baseEtaMinutes]);

  // Atualiza pino da posição atual no mapa quando houver GPS ao vivo
  useEffect(() => {
    if (!sdkReady || !mapInstanceRef.current || !liveUserPos) return;
    const gmaps = (window as any).google?.maps;
    const AdvancedMarker = gmaps?.marker?.AdvancedMarkerElement;
    if (!AdvancedMarker) return;

    if (liveUserMarkerRef.current) {
      liveUserMarkerRef.current.position = liveUserPos;
    } else {
      const gpsDot = document.createElement('div');
      gpsDot.style.width = '16px';
      gpsDot.style.height = '16px';
      gpsDot.style.borderRadius = '9999px';
      gpsDot.style.background = '#10b981';
      gpsDot.style.border = '3px solid #ffffff';
      gpsDot.style.boxShadow = '0 0 0 5px rgba(16, 185, 129, 0.35)';
      liveUserMarkerRef.current = new AdvancedMarker({
        map: mapInstanceRef.current,
        position: liveUserPos,
        title: 'Posição Atual',
        content: gpsDot,
      });
    }
  }, [sdkReady, liveUserPos]);

  const formattedKm = useMemo(
    () => remainingDistanceKm.toFixed(1).replace('.', ','),
    [remainingDistanceKm]
  );

  const formattedHhMm = useMemo(
    () => formatCountdownHhMm(remainingMinutes),
    [remainingMinutes]
  );

  return (
    <div
      className={`relative flex-1 w-full h-full min-h-[340px] overflow-hidden flex flex-col ${
        isDark ? 'bg-slate-900' : 'bg-slate-100'
      }`}
    >
      {/* SUPERFÍCIE DO MAPA LIMPO */}
      {!sdkFailed ? (
        <div
          ref={mapContainerRef}
          className="w-full flex-1 min-h-[340px]"
          style={{ minHeight: '340px', height: '100%' }}
        />
      ) : (
        <iframe
          title={`Mapa da Rota - ${destLabel}`}
          src={fallbackEmbedUrl}
          className="w-full flex-1 min-h-[340px] border-0"
          allowFullScreen
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      {/* CANTO INFERIOR DIREITO DO MAPA: KM RESTANTE E HH:MM REGRESSIVO COM COR ALPHA TRANSLÚCIDA */}
      <button
        type="button"
        onClick={() => {
          hapticLight();
          if (remainingDistanceKm > 0.15) {
            const stepKm = Math.max(0.4, Number((baseDistanceKm / 4).toFixed(1)));
            const nextKm = Math.max(0, Number((remainingDistanceKm - stepKm).toFixed(1)));
            const ratio = baseDistanceKm > 0 ? nextKm / baseDistanceKm : 0;
            setRemainingDistanceKm(nextKm);
            setRemainingMinutes(nextKm <= 0.15 ? 0 : Math.max(1, Math.round(baseEtaMinutes * ratio)));
          } else {
            setRemainingDistanceKm(baseDistanceKm);
            setRemainingMinutes(baseEtaMinutes);
          }
        }}
        title="Distância e tempo restantes até o destino (toque para simular aproximação)"
        className={`absolute bottom-3 right-3 z-10 px-3 py-1.5 rounded-[4px] backdrop-blur-[2px] flex items-baseline gap-3 select-none cursor-pointer transition ${
          isDark
            ? 'bg-slate-950/40 text-white/75'
            : 'bg-white/50 text-slate-900/75'
        }`}
      >
        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight opacity-85">
            {formattedKm}
          </span>
          <span className="text-[11px] font-extrabold uppercase opacity-70">km</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight text-emerald-500/80">
            {formattedHhMm}
          </span>
        </div>
      </button>
    </div>
  );
};
