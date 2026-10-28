import React, { useEffect, useRef, useState } from 'react';
import {
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  LocateFixed,
  FastForward,
  Check,
  Compass,
} from 'lucide-react';
import {
  GoogleComputedRouteResult,
  GoogleRouteStep,
  loadGoogleMapsJsSdk,
  snapAndReverseGeocodeGps,
} from '../../services/googleMapsService';
import { hapticLight, hapticMedium } from '../../utils/haptics';

interface InteractiveGoogleRouteMapProps {
  originLat?: number;
  originLng?: number;
  originLabel: string;
  destLat?: number;
  destLng?: number;
  destLabel: string;
  routeData: GoogleComputedRouteResult | null;
  activeStepIndex: number;
  isNavigating: boolean;
  fallbackEmbedUrl: string;
  onStartNavigation: () => void;
  onAdvanceStep: () => void;
  onLiveGpsUpdate?: (lat: number, lng: number, snappedStreetName?: string) => void;
  onArriveAtDestination?: () => void;
}

function getManeuverIcon(maneuver?: string) {
  const m = String(maneuver || '').toUpperCase();
  if (m.includes('LEFT')) return CornerUpLeft;
  if (m.includes('RIGHT')) return CornerUpRight;
  if (m.includes('UTURN')) return RotateCcw;
  return ArrowUp;
}

export const InteractiveGoogleRouteMap: React.FC<InteractiveGoogleRouteMapProps> = ({
  originLat = -23.5505,
  originLng = -46.6333,
  originLabel,
  destLat = -23.5621,
  destLng = -46.4795,
  destLabel,
  routeData,
  activeStepIndex,
  isNavigating,
  fallbackEmbedUrl,
  onStartNavigation,
  onAdvanceStep,
  onLiveGpsUpdate,
  onArriveAtDestination,
}) => {
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
  const [liveSnappedStreet, setLiveSnappedStreet] = useState<string>('');

  const steps: GoogleRouteStep[] = routeData?.steps || [];
  const currentStep: GoogleRouteStep | undefined =
    steps[Math.min(activeStepIndex, Math.max(0, steps.length - 1))];
  const nextStep: GoogleRouteStep | undefined =
    steps[Math.min(activeStepIndex + 1, Math.max(0, steps.length - 1))];

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

  // 2. Initialize Google Map & render route polyline + markers (without any white Embed box!)
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

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new gmaps.Map(mapContainerRef.current, {
        center: startCoord,
        zoom: 14,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
      });
    }

    const map = mapInstanceRef.current;

    // Clear previous polylines
    if (outerPolylineRef.current) outerPolylineRef.current.setMap(null);
    if (innerPolylineRef.current) innerPolylineRef.current.setMap(null);

    outerPolylineRef.current = new gmaps.Polyline({
      path: pathPoints,
      geodesic: true,
      strokeColor: '#064e3b',
      strokeOpacity: 0.85,
      strokeWeight: 9,
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

    // Helper to create clean DOM badges for AdvancedMarkerElement
    const createPinBadge = (bgHex: string, labelText: string) => {
      const el = document.createElement('div');
      el.style.background = bgHex;
      el.style.color = '#ffffff';
      el.style.padding = '4px 8px';
      el.style.borderRadius = '4px';
      el.style.fontWeight = '800';
      el.style.fontSize = '11px';
      el.style.fontFamily = 'Poppins, sans-serif';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.45)';
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
        content: createPinBadge('#0f172a', 'Saída'),
      });

      destMarkerRef.current = new AdvancedMarker({
        map,
        position: endCoord,
        title: destLabel,
        content: createPinBadge('#10b981', destLabel.slice(0, 22)),
      });
    }

    // Fit route bounds when not in close-up navigation mode
    if (!isNavigating && pathPoints.length > 1) {
      const bounds = new gmaps.LatLngBounds();
      pathPoints.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { top: 48, right: 36, bottom: 64, left: 36 });
    }
  }, [sdkReady, routeData, originLat, originLng, destLat, destLng, originLabel, destLabel]);

  // 3. Camera focus & live GPS pin when `isNavigating` or `activeStepIndex` changes
  useEffect(() => {
    if (!sdkReady || !mapInstanceRef.current) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    const map = mapInstanceRef.current;
    const stepCoord =
      currentStep?.startLat && currentStep?.startLng
        ? { lat: currentStep.startLat, lng: currentStep.startLng }
        : liveUserPos ||
          routeData?.decodedPath?.[0] || { lat: originLat, lng: originLng };

    if (isNavigating) {
      map.panTo(stepCoord);
      if ((map.getZoom() || 14) < 17) {
        map.setZoom(17);
      }

      const AdvancedMarker = gmaps.marker?.AdvancedMarkerElement;
      if (AdvancedMarker) {
        if (liveUserMarkerRef.current) {
          liveUserMarkerRef.current.position = stepCoord;
        } else {
          const gpsDot = document.createElement('div');
          gpsDot.style.width = '18px';
          gpsDot.style.height = '18px';
          gpsDot.style.borderRadius = '9999px';
          gpsDot.style.background = '#10b981';
          gpsDot.style.border = '3px solid #ffffff';
          gpsDot.style.boxShadow = '0 0 0 6px rgba(16, 185, 129, 0.35)';
          liveUserMarkerRef.current = new AdvancedMarker({
            map,
            position: stepCoord,
            title: 'Sua Posição Atual',
            content: gpsDot,
          });
        }
      }
    }
  }, [sdkReady, isNavigating, activeStepIndex, currentStep, liveUserPos, routeData, originLat, originLng]);

  // 4. Watch real device GPS when `isNavigating` is active + Snap to Road via Roads API
  useEffect(() => {
    if (!isNavigating || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let lastSnapTs = 0;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        setLiveUserPos({ lat: rawLat, lng: rawLng });

        const now = Date.now();
        if (now - lastSnapTs > 12000) {
          lastSnapTs = now;
          const snapped = await snapAndReverseGeocodeGps(rawLat, rawLng);
          if (snapped) {
            setLiveUserPos({ lat: snapped.lat, lng: snapped.lng });
            if (snapped.streetName) {
              setLiveSnappedStreet(snapped.streetName);
            }
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
  }, [isNavigating]);

  const ManeuverIcon = getManeuverIcon(currentStep?.maneuver);
  const isLastStep = steps.length > 0 && activeStepIndex >= steps.length - 1;

  return (
    <div className="relative flex-1 w-full h-full min-h-[340px] bg-slate-900 overflow-hidden flex flex-col">
      {/* HUD DE NAVEGAÇÃO GPS PASSO A PASSO NO TOPO DO MAPA (QUANDO TRAJETO INICIADO) */}
      {isNavigating && (
        <div className="absolute top-2.5 left-2.5 right-2.5 z-10 rounded-[4px] bg-slate-950/95 text-white p-3 shadow-2xl space-y-2">
          <div className="flex items-start justify-between gap-2.5">
            <div className="w-10 h-10 rounded-[4px] bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <ManeuverIcon className="w-5 h-5 text-white stroke-[2.5]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  {liveSnappedStreet
                    ? `GPS Ativo • ${liveSnappedStreet}`
                    : `Passo ${Math.min(activeStepIndex + 1, Math.max(1, steps.length))} de ${Math.max(1, steps.length)}`}
                </span>
                <span className="px-2 py-0.5 rounded-[3px] bg-emerald-500 text-white text-[11px] font-mono tabular-nums font-black shrink-0">
                  {currentStep?.distanceText || `${routeData?.distanceKm ?? 3.2} km`}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-extrabold text-white leading-snug mt-0.5 line-clamp-2">
                {currentStep?.instruction || `Siga pela rota principal até ${destLabel}`}
              </p>
            </div>
          </div>

          {/* Próxima manobra + controles rápidos do Cockpit */}
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px]">
            <div className="min-w-0 flex-1 truncate text-slate-300">
              {nextStep && !isLastStep ? (
                <span>
                  Depois: <strong className="text-white">{nextStep.instruction}</strong>
                </span>
              ) : (
                <span className="text-emerald-400 font-bold">
                  Destino à frente: {destLabel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    onAdvanceStep();
                  }}
                  className="px-2.5 py-1 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Avançar para a próxima rua da rota"
                >
                  <FastForward className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Próx. Rua</span>
                </button>
              ) : (
                onArriveAtDestination && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      onArriveAtDestination();
                    }}
                    className="px-2.5 py-1 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3 h-3 text-white shrink-0" />
                    <span className="text-white">Concluir Chegada</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  if (mapInstanceRef.current) {
                    const target =
                      currentStep?.startLat && currentStep?.startLng
                        ? { lat: currentStep.startLat, lng: currentStep.startLng }
                        : liveUserPos || { lat: originLat, lng: originLng };
                    mapInstanceRef.current.panTo(target);
                    mapInstanceRef.current.setZoom(17);
                  }
                }}
                className="w-7 h-7 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                title="Centralizar câmera no GPS"
              >
                <LocateFixed className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPERFÍCIE DO MAPA INTERATIVO (SEM CAIXA BRanca DO IFRAME) */}
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

      {/* BOTÃO FLUTUANTE DE INICIAR TRAJETO NO MAPA (QUANDO AINDA NÃO INICIADO) */}
      {!isNavigating && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
          <div className="px-3 py-2 rounded-[4px] bg-slate-950/90 text-white text-[11px] font-bold flex items-center gap-2 shadow-lg pointer-events-auto">
            <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              {routeData?.description || 'Rota Google Maps pronta'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onStartNavigation();
            }}
            className="py-2.5 px-4 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-xl transition cursor-pointer whitespace-nowrap pointer-events-auto active:scale-95"
          >
            <Navigation className="w-4 h-4 text-white shrink-0" />
            <span className="text-white">Iniciar Trajeto</span>
          </button>
        </div>
      )}
    </div>
  );
};
