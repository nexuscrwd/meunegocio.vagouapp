import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  GoogleComputedRouteResult,
  loadGoogleMapsJsSdk,
  snapAndReverseGeocodeGps,
  decodeGooglePolyline,
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

function createPinBadge(bgHex: string, textHex: string, labelText: string): HTMLDivElement {
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
  const lastFittedKeyRef = useRef<string>('');
  const lastReportedGpsRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);

  const onLiveGpsUpdateRef = useRef(onLiveGpsUpdate);
  onLiveGpsUpdateRef.current = onLiveGpsUpdate;

  const onDestinationReachedRef = useRef(onDestinationReachedChange);
  onDestinationReachedRef.current = onDestinationReachedChange;

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

  // Verifica se o cliente chegou ao destino (<= 0.15 km ou 00:00)
  const hasReachedDestination = remainingDistanceKm <= 0.15 || remainingMinutes <= 0;

  useEffect(() => {
    onDestinationReachedRef.current?.(hasReachedDestination);
  }, [hasReachedDestination]);

  // 1. Carrega Google Maps JS SDK apenas uma vez
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

  // 2. Inicializa a instância do Google Map APENAS quando o SDK fica pronto ou o tema muda (ZERO piscar!)
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    const map = new gmaps.Map(mapContainerRef.current, {
      center: { lat: originLat, lng: originLng },
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

    mapInstanceRef.current = map;

    outerPolylineRef.current = new gmaps.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#064e3b',
      strokeOpacity: 0.78,
      strokeWeight: 8,
      map,
    });

    innerPolylineRef.current = new gmaps.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#10b981',
      strokeOpacity: 1.0,
      strokeWeight: 5,
      map,
    });

    const AdvancedMarker = gmaps.marker?.AdvancedMarkerElement;
    if (AdvancedMarker) {
      originMarkerRef.current = new AdvancedMarker({
        map,
        position: { lat: originLat, lng: originLng },
        title: originLabel,
        content: createPinBadge(
          isDark ? '#0f172a' : '#ffffff',
          isDark ? '#ffffff' : '#0f172a',
          'Saída'
        ),
      });

      destMarkerRef.current = new AdvancedMarker({
        map,
        position: { lat: destLat, lng: destLng },
        title: destLabel,
        content: createPinBadge('#10b981', '#ffffff', destLabel.slice(0, 22)),
      });
    }

    // Força ajuste de bounds para a nova instância
    lastFittedKeyRef.current = '';
  }, [sdkReady, isDark]);

  // 3. Atualiza a geometria da rota (Polilinha Seguindo as Ruas Reais) e marcadores de forma imperativa SEM recriar o mapa
  useEffect(() => {
    if (!sdkReady || !mapInstanceRef.current) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    let cancelled = false;
    const map = mapInstanceRef.current;

    const applyRoadPathToMap = (roadPath: Array<{ lat: number; lng: number }>) => {
      if (cancelled || !roadPath || roadPath.length < 2) return;

      const startPt = roadPath[0];
      const endPt = roadPath[roadPath.length - 1];

      if (outerPolylineRef.current) {
        outerPolylineRef.current.setPath(roadPath);
      }
      if (innerPolylineRef.current) {
        innerPolylineRef.current.setPath(roadPath);
      }

      if (originMarkerRef.current) {
        originMarkerRef.current.position = startPt;
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.position = endPt;
        destMarkerRef.current.content = createPinBadge(
          '#10b981',
          '#ffffff',
          destLabel.slice(0, 22)
        );
      }

      const routeFitKey = `${startPt.lat.toFixed(3)},${startPt.lng.toFixed(3)}->${endPt.lat.toFixed(3)},${endPt.lng.toFixed(3)}:${roadPath.length > 2 ? 'road' : 'init'}`;
      if (lastFittedKeyRef.current !== routeFitKey) {
        lastFittedKeyRef.current = routeFitKey;
        const bounds = new gmaps.LatLngBounds();
        roadPath.forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds, { top: 36, right: 36, bottom: 56, left: 36 });
      }
    };

    // Caso 1: Já temos a malha viária decodificada com múltiplos pontos da Routes API v2 / OSRM
    if (routeData?.decodedPath && routeData.decodedPath.length > 2) {
      applyRoadPathToMap(routeData.decodedPath);
      return;
    }

    // Caso 2: Busca a geometria viária real direto pelo DirectionsService do navegador ou OSRM (NUNCA linha reta!)
    const fetchBrowserRoadGeometry = async () => {
      if (gmaps.DirectionsService) {
        try {
          const directionsService = new gmaps.DirectionsService();
          const result: any = await new Promise((resolve) => {
            directionsService.route(
              {
                origin: { lat: originLat, lng: originLng },
                destination: { lat: destLat, lng: destLng },
                travelMode: gmaps.TravelMode?.DRIVING || 'DRIVING',
              },
              (res: any, status: string) => {
                if (status === 'OK' && res) resolve(res);
                else resolve(null);
              }
            );
          });

          const overviewPath = result?.routes?.[0]?.overview_path;
          if (Array.isArray(overviewPath) && overviewPath.length > 2) {
            const pts = overviewPath.map((p: any) => ({
              lat: typeof p.lat === 'function' ? p.lat() : Number(p.lat),
              lng: typeof p.lng === 'function' ? p.lng() : Number(p.lng),
            }));
            applyRoadPathToMap(pts);
            return;
          }
        } catch {}
      }

      // Fallback OSRM direto para garantir contorno real das ruas mesmo se Directions API ainda estiver propagando
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline`;
        const res = await fetch(osrmUrl);
        if (res.ok) {
          const data = await res.json();
          const encoded = data?.routes?.[0]?.geometry;
          if (encoded) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) {
              applyRoadPathToMap(pts);
              return;
            }
          }
        }
      } catch {}
    };

    fetchBrowserRoadGeometry();

    return () => {
      cancelled = true;
    };
  }, [sdkReady, isDark, routeData, originLat, originLng, destLat, destLng, destLabel]);

  // 4. Rastreamento GPS em tempo real com throttle para evitar re-renders em cascata
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const avgMinutesPerKm =
      baseDistanceKm > 0 ? baseEtaMinutes / baseDistanceKm : 4.2;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;

        const prev = lastReportedGpsRef.current;
        const now = Date.now();
        const movedKm = prev
          ? computeRoadDistanceKm(prev.lat, prev.lng, rawLat, rawLng)
          : 999;

        // Ignora micro-oscilações de GPS (< 20m em menos de 10s) para zero flicker
        if (prev && movedKm < 0.02 && now - prev.ts < 10000) {
          return;
        }

        setLiveUserPos({ lat: rawLat, lng: rawLng });

        const liveDistKm = computeRoadDistanceKm(rawLat, rawLng, destLat, destLng);
        if (liveDistKm <= 100) {
          setRemainingDistanceKm(liveDistKm);
          const nextMin =
            liveDistKm <= 0.15
              ? 0
              : Math.max(1, Math.round(liveDistKm * avgMinutesPerKm));
          setRemainingMinutes(nextMin);
        }

        if (!prev || now - prev.ts >= 15000) {
          lastReportedGpsRef.current = { lat: rawLat, lng: rawLng, ts: now };
          const snapped = await snapAndReverseGeocodeGps(rawLat, rawLng);
          if (snapped) {
            setLiveUserPos({ lat: snapped.lat, lng: snapped.lng });
            onLiveGpsUpdateRef.current?.(snapped.lat, snapped.lng, snapped.streetName);
            return;
          }
          onLiveGpsUpdateRef.current?.(rawLat, rawLng);
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 8000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [destLat, destLng, baseDistanceKm, baseEtaMinutes]);

  // 5. Atualiza apenas o pino da posição atual do cliente no mapa sem tocar na câmera nem recriar o mapa
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
