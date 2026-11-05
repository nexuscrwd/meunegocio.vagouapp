import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Plus,
  Minus,
  LocateFixed,
  Clock,
  Route,
  X,
  Compass,
} from 'lucide-react';
import {
  geocodeBrazilLocation,
  calculateDrivingRouteDistanceAndEta,
  calculateHaversineDistanceAndEta,
} from '../utils/bookingSlots';
import {
  computeGoogleDetailedRoute,
  GoogleComputedRouteResult,
} from '../services/googleMapsService';
import { InteractiveGoogleRouteMap } from './live-tracking/InteractiveGoogleRouteMap';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface SalonSpaceInteractiveMapProps {
  salonName: string;
  salonAvatar?: string;
  salonAddress: string;
  salonCep?: string;
  initialSalonLat?: number;
  initialSalonLng?: number;
  userAvatarUrl?: string;
  isDark?: boolean;
}

const DEFAULT_SALON_COORDS = {
  lat: -23.5453,
  lng: -46.5648,
};

const DEFAULT_USER_FALLBACK_COORDS = {
  lat: -23.5558,
  lng: -46.5784,
};

function formatMinutesToHHMM(totalMinutes: number): string {
  const safeMin = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(safeMin / 60);
  const mins = safeMin % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function createSalonMarkerHtml(salonName: string, salonAvatar?: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'flex-end';
  wrapper.style.width = '160px';
  wrapper.style.height = '76px';
  wrapper.style.pointerEvents = 'none';

  // Etiqueta superior com o nome do salão
  const labelBadge = document.createElement('div');
  labelBadge.style.background = '#005CA9';
  labelBadge.style.color = '#FFFFFF';
  labelBadge.style.padding = '3px 8px';
  labelBadge.style.borderRadius = '4px';
  labelBadge.style.fontSize = '10px';
  labelBadge.style.fontWeight = '800';
  labelBadge.style.fontFamily = 'Poppins, sans-serif';
  labelBadge.style.whiteSpace = 'nowrap';
  labelBadge.style.maxWidth = '154px';
  labelBadge.style.overflow = 'hidden';
  labelBadge.style.textOverflow = 'ellipsis';
  labelBadge.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.35)';
  labelBadge.style.border = '1.5px solid #FFFFFF';
  labelBadge.style.marginBottom = '4px';
  labelBadge.style.zIndex = '3';
  labelBadge.textContent = salonName || 'Salão';

  // Pino circular principal com foto/ícone do salão
  const pinCircle = document.createElement('div');
  pinCircle.style.width = '38px';
  pinCircle.style.height = '38px';
  pinCircle.style.borderRadius = '9999px';
  pinCircle.style.background = '#005CA9';
  pinCircle.style.border = '2.5px solid #FFFFFF';
  pinCircle.style.boxShadow = '0 4px 12px rgba(0, 92, 169, 0.55), 0 0 0 4px rgba(0, 92, 169, 0.22)';
  pinCircle.style.overflow = 'hidden';
  pinCircle.style.display = 'flex';
  pinCircle.style.alignItems = 'center';
  pinCircle.style.justifyContent = 'center';
  pinCircle.style.position = 'relative';
  pinCircle.style.zIndex = '2';

  const fallbackText = document.createElement('span');
  fallbackText.style.color = '#FFFFFF';
  fallbackText.style.fontWeight = '900';
  fallbackText.style.fontSize = '13px';
  fallbackText.style.fontFamily = 'Poppins, sans-serif';
  fallbackText.textContent = (salonName || 'S').trim().charAt(0).toUpperCase();

  if (salonAvatar && salonAvatar.trim().length > 4) {
    const img = document.createElement('img');
    img.src = salonAvatar.trim();
    img.alt = salonName;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.onerror = () => {
      img.remove();
      pinCircle.appendChild(fallbackText);
    };
    pinCircle.appendChild(img);
  } else {
    pinCircle.appendChild(fallbackText);
  }

  // Ponta inferior do marcador apontando para a coordenada exata
  const pointerTip = document.createElement('div');
  pointerTip.style.width = '0';
  pointerTip.style.height = '0';
  pointerTip.style.borderLeft = '6px solid transparent';
  pointerTip.style.borderRight = '6px solid transparent';
  pointerTip.style.borderTop = '8px solid #005CA9';
  pointerTip.style.marginTop = '-1px';
  pointerTip.style.filter = 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))';
  pointerTip.style.zIndex = '1';

  wrapper.appendChild(labelBadge);
  wrapper.appendChild(pinCircle);
  wrapper.appendChild(pointerTip);

  return wrapper;
}

function createUserLocationDotHtml(): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.width = '24px';
  wrapper.style.height = '24px';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.pointerEvents = 'none';

  const dot = document.createElement('div');
  dot.style.width = '14px';
  dot.style.height = '14px';
  dot.style.borderRadius = '9999px';
  dot.style.background = '#10B981';
  dot.style.border = '2.5px solid #FFFFFF';
  dot.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4), 0 0 0 4px rgba(16, 185, 129, 0.28)';

  wrapper.appendChild(dot);
  return wrapper;
}

export const SalonSpaceInteractiveMap: React.FC<SalonSpaceInteractiveMapProps> = ({
  salonName,
  salonAvatar,
  salonAddress,
  salonCep,
  initialSalonLat,
  initialSalonLng,
  userAvatarUrl,
  isDark = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const salonMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeOuterLineRef = useRef<L.Polyline | null>(null);
  const routeInnerLineRef = useRef<L.Polyline | null>(null);

  const [salonCoords, setSalonCoords] = useState<{ lat: number; lng: number }>(() => {
    if (
      typeof initialSalonLat === 'number' &&
      typeof initialSalonLng === 'number' &&
      Number.isFinite(initialSalonLat) &&
      Number.isFinite(initialSalonLng)
    ) {
      return { lat: initialSalonLat, lng: initialSalonLng };
    }
    return DEFAULT_SALON_COORDS;
  });

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>(() => {
    try {
      const savedRaw = localStorage.getItem('vagou_client_last_coords');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          return { lat: parsed.lat, lng: parsed.lng };
        }
      }
    } catch {}
    return DEFAULT_USER_FALLBACK_COORDS;
  });

  const [hasRealGps, setHasRealGps] = useState<boolean>(false);
  const [distanceKm, setDistanceKm] = useState<number>(1.8);
  const [etaMinutes, setEtaMinutes] = useState<number>(7);
  const [computedRoute, setComputedRoute] = useState<GoogleComputedRouteResult | null>(null);
  const [isInAppCockpitOpen, setIsInAppCockpitOpen] = useState<boolean>(false);

  // 1. Geocodifica o endereço ou CEP do salão para posicionar o marcador no local exato
  useEffect(() => {
    let cancelled = false;

    if (
      typeof initialSalonLat === 'number' &&
      typeof initialSalonLng === 'number' &&
      Number.isFinite(initialSalonLat) &&
      Number.isFinite(initialSalonLng)
    ) {
      setSalonCoords({ lat: initialSalonLat, lng: initialSalonLng });
      return;
    }

    const query = (salonAddress || salonCep || '').trim();
    if (!query || query.length < 4) return;

    const runGeocode = async () => {
      try {
        const result = await geocodeBrazilLocation(query);
        if (!cancelled && result && Number.isFinite(result.lat) && Number.isFinite(result.lng)) {
          setSalonCoords({ lat: result.lat, lng: result.lng });
        }
      } catch {
        // mantém coordenada padrão em caso de falha de rede
      }
    };

    runGeocode();
    return () => {
      cancelled = true;
    };
  }, [salonAddress, salonCep, initialSalonLat, initialSalonLng]);

  // 2. Obtém a localização real do usuário via GPS (watchPosition / getCurrentPosition)
  const requestUserGps = useCallback((centerOnUser = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserCoords(next);
        setHasRealGps(true);
        try {
          localStorage.setItem('vagou_client_last_coords', JSON.stringify(next));
        } catch {}

        if (centerOnUser && leafletMapRef.current) {
          leafletMapRef.current.setView([next.lat, next.lng], 16, { animate: true });
        }
      },
      () => {
        // Caso o usuário negue permissão, mantém o fallback local sem travar a UI
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  }, []);

  useEffect(() => {
    requestUserGps(false);
  }, [requestUserGps]);

  // 3. Calcula distância viária real (KM) e tempo (XX:MM) + polilinha viária da rota (Zero Linha Reta)
  useEffect(() => {
    let cancelled = false;

    // Estimativa imediata Haversine + fator viário para resposta instantânea
    const quick = calculateHaversineDistanceAndEta(
      userCoords.lat,
      userCoords.lng,
      salonCoords.lat,
      salonCoords.lng,
      'car'
    );
    setDistanceKm(quick.distanceKm);
    setEtaMinutes(quick.etaMinutes);

    const fetchRoadMetrics = async () => {
      try {
        const [drivingMetrics, detailedRoute] = await Promise.all([
          calculateDrivingRouteDistanceAndEta(
            userCoords.lat,
            userCoords.lng,
            salonCoords.lat,
            salonCoords.lng,
            'car'
          ),
          computeGoogleDetailedRoute({
            originLat: userCoords.lat,
            originLng: userCoords.lng,
            destLat: salonCoords.lat,
            destLng: salonCoords.lng,
            destAddress: salonAddress,
            mode: 'car',
          }),
        ]);

        if (cancelled) return;

        if (detailedRoute && detailedRoute.distanceKm > 0) {
          setDistanceKm(detailedRoute.distanceKm);
          setEtaMinutes(detailedRoute.etaMinutes);
          setComputedRoute(detailedRoute);

          if (
            detailedRoute.decodedPath &&
            detailedRoute.decodedPath.length > 2 &&
            routeOuterLineRef.current &&
            routeInnerLineRef.current
          ) {
            const latlngs = detailedRoute.decodedPath.map(
              (p) => [p.lat, p.lng] as [number, number]
            );
            routeOuterLineRef.current.setLatLngs(latlngs);
            routeInnerLineRef.current.setLatLngs(latlngs);
            return;
          }
        } else if (drivingMetrics && drivingMetrics.distanceKm > 0) {
          setDistanceKm(drivingMetrics.distanceKm);
          setEtaMinutes(drivingMetrics.etaMinutes);
        }

        // Fallback OSRM malha viária para desenhar polilinha por ruas reais
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${userCoords.lng},${userCoords.lat};${salonCoords.lng},${salonCoords.lat}?overview=full&geometries=geojson`;
        const osrmRes = await fetch(osrmUrl);
        if (!cancelled && osrmRes.ok) {
          const osrmData = await osrmRes.json();
          const coords = osrmData?.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length > 2) {
            const latlngs = coords.map(
              (c: [number, number]) => [c[1], c[0]] as [number, number]
            );
            routeOuterLineRef.current?.setLatLngs(latlngs);
            routeInnerLineRef.current?.setLatLngs(latlngs);
          }
        }
      } catch {
        // silencioso se offline
      }
    };

    fetchRoadMetrics();
    return () => {
      cancelled = true;
    };
  }, [userCoords.lat, userCoords.lng, salonCoords.lat, salonCoords.lng, salonAddress]);

  // 4. Inicializa o Mapa Interativo Leaflet (Arrasto com 1 dedo + Zoom com 2 dedos + Marcador do Salão)
  useEffect(() => {
    const containerEl = mapContainerRef.current;
    if (!containerEl) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const lmap = L.map(containerEl, {
      center: [salonCoords.lat, salonCoords.lng],
      zoom: 16,
      zoomSnap: 1,
      zoomDelta: 1,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: false,
      // Desativa tapHold para não bloquear arrasto com 1 dedo em telas mobile iOS/Android
      tapHold: false,
    } as L.MapOptions);

    const tileProviders = [
      {
        url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      },
      {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
      },
    ];

    let currentIdx = 0;
    let errorCount = 0;
    let currentLayer: L.TileLayer | null = null;

    const mountTiles = (idx: number) => {
      const provider = tileProviders[idx] || tileProviders[tileProviders.length - 1];
      if (currentLayer) {
        try {
          lmap.removeLayer(currentLayer);
        } catch {}
      }
      const layer = L.tileLayer(provider.url, {
        subdomains: provider.subdomains,
        maxZoom: 20,
        keepBuffer: 4,
      });
      layer.on('tileerror', () => {
        errorCount += 1;
        if (errorCount >= 4 && currentIdx < tileProviders.length - 1) {
          errorCount = 0;
          currentIdx += 1;
          mountTiles(currentIdx);
        }
      });
      layer.addTo(lmap);
      currentLayer = layer;
    };

    mountTiles(0);

    // Linhas de rota viária (quando carregadas)
    const outerLine = L.polyline([], {
      color: '#003B73',
      weight: 7,
      opacity: 0.75,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(lmap);

    const innerLine = L.polyline([], {
      color: '#2B82C9',
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(lmap);

    routeOuterLineRef.current = outerLine;
    routeInnerLineRef.current = innerLine;

    // Marcador do Salão (sempre visível em destaque)
    const salonIcon = L.divIcon({
      html: createSalonMarkerHtml(salonName, salonAvatar),
      className: 'vagou-salon-space-marker',
      iconSize: [160, 76],
      iconAnchor: [80, 74],
    });

    const sMarker = L.marker([salonCoords.lat, salonCoords.lng], {
      icon: salonIcon,
      zIndexOffset: 1000,
    }).addTo(lmap);
    salonMarkerRef.current = sMarker;

    // Marcador da posição do usuário
    const userIcon = L.divIcon({
      html: createUserLocationDotHtml(),
      className: 'vagou-user-space-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const uMarker = L.marker([userCoords.lat, userCoords.lng], {
      icon: userIcon,
      zIndexOffset: 800,
    }).addTo(lmap);
    userMarkerRef.current = uMarker;

    leafletMapRef.current = lmap;

    const timer = window.setTimeout(() => {
      try {
        lmap.invalidateSize();
      } catch {}
    }, 100);

    let resizeObs: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        try {
          lmap.invalidateSize();
        } catch {}
      });
      resizeObs.observe(containerEl);
    }

    return () => {
      window.clearTimeout(timer);
      resizeObs?.disconnect();
      lmap.remove();
      leafletMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza posição e visual do marcador do Salão quando geocodificado
  useEffect(() => {
    const lmap = leafletMapRef.current;
    const sMarker = salonMarkerRef.current;
    if (!lmap || !sMarker) return;

    sMarker.setLatLng([salonCoords.lat, salonCoords.lng]);
    const updatedIcon = L.divIcon({
      html: createSalonMarkerHtml(salonName, salonAvatar),
      className: 'vagou-salon-space-marker',
      iconSize: [160, 76],
      iconAnchor: [80, 74],
    });
    sMarker.setIcon(updatedIcon);
    lmap.setView([salonCoords.lat, salonCoords.lng], lmap.getZoom(), { animate: true });
  }, [salonCoords.lat, salonCoords.lng, salonName, salonAvatar]);

  // Atualiza marcador do Usuário quando o GPS atualiza
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userCoords.lat, userCoords.lng]);
    }
  }, [userCoords.lat, userCoords.lng]);

  // Controles de Zoom e Centralização
  const handleZoomIn = () => {
    hapticLight();
    const lmap = leafletMapRef.current;
    if (lmap) lmap.setZoom(Math.min(19, lmap.getZoom() + 1));
  };

  const handleZoomOut = () => {
    hapticLight();
    const lmap = leafletMapRef.current;
    if (lmap) lmap.setZoom(Math.max(11, lmap.getZoom() - 1));
  };

  const handleCenterOnSalon = () => {
    hapticLight();
    const lmap = leafletMapRef.current;
    if (lmap) {
      lmap.setView([salonCoords.lat, salonCoords.lng], 16, { animate: true });
    }
  };

  const handleFitRouteInMap = () => {
    hapticLight();
    const lmap = leafletMapRef.current;
    if (lmap) {
      const bounds = L.latLngBounds(
        [userCoords.lat, userCoords.lng],
        [salonCoords.lat, salonCoords.lng]
      );
      lmap.fitBounds(bounds, { padding: [36, 36], maxZoom: 16, animate: true });
    }
  };

  // Links de navegação externa (Google Maps e Waze)
  const navigationLinks = useMemo(() => {
    const destQuery = `${salonName}, ${salonAddress}`.trim();
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destQuery || `${salonCoords.lat},${salonCoords.lng}`
    )}&travelmode=driving`;

    const wazeUrl = `https://waze.com/ul?ll=${salonCoords.lat},${salonCoords.lng}&navigate=yes`;

    return { googleMapsUrl, wazeUrl };
  }, [salonName, salonAddress, salonCoords.lat, salonCoords.lng]);

  const formattedEtaHHMM = useMemo(() => formatMinutesToHHMM(etaMinutes), [etaMinutes]);
  const formattedDistanceKm = useMemo(
    () => distanceKm.toFixed(1).replace('.', ','),
    [distanceKm]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Palco do Mapa Interativo (Arrasto livre com 1 dedo + Zoom com 2 dedos + Marcador do Salão) */}
      <div
        className={`relative w-full flex-1 min-h-[220px] rounded-[4px] overflow-hidden border shadow-xs select-none ${
          isDark
            ? 'bg-slate-950 border-slate-800 vagou-map-dark'
            : 'bg-slate-100 border-[#E6EDF5]'
        }`}
        style={{ touchAction: 'none' }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Controles Flutuantes do Mapa (Focar Salão, Enquadrar Rota, Zoom + / -) */}
        <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleCenterOnSalon}
            title="Centralizar no Salão"
            className="w-8 h-8 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white shadow-md flex items-center justify-center transition cursor-pointer active:scale-95"
          >
            <MapPin className="w-4 h-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => {
              requestUserGps(false);
              handleFitRouteInMap();
            }}
            title="Ver trajeto completo no mapa"
            className={`w-8 h-8 rounded-[4px] shadow-md border flex items-center justify-center transition cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-slate-900/95 border-slate-700 text-white hover:bg-slate-800'
                : 'bg-white/95 border-[#D6E0EC] text-[#1E293B] hover:bg-slate-50'
            }`}
          >
            <LocateFixed className="w-4 h-4 text-[#2B82C9]" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Ampliar mapa"
            className={`w-8 h-8 rounded-[4px] shadow-md border flex items-center justify-center transition cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-slate-900/95 border-slate-700 text-white hover:bg-slate-800'
                : 'bg-white/95 border-[#D6E0EC] text-[#1E293B] hover:bg-slate-50'
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Reduzir mapa"
            className={`w-8 h-8 rounded-[4px] shadow-md border flex items-center justify-center transition cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-slate-900/95 border-slate-700 text-white hover:bg-slate-800'
                : 'bg-white/95 border-[#D6E0EC] text-[#1E293B] hover:bg-slate-50'
            }`}
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Selo Flutuante Discreto no Topo Esquerdo indicando Marcador do Salão */}
        <button
          type="button"
          onClick={handleCenterOnSalon}
          className={`absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-[4px] shadow-md border flex items-center gap-1.5 text-[10px] font-bold transition cursor-pointer active:scale-95 ${
            isDark
              ? 'bg-slate-900/95 border-slate-700 text-white'
              : 'bg-white/95 border-[#D6E0EC] text-[#1E293B]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate max-w-[150px]">{salonName}</span>
        </button>
      </div>

      {/* Barra Inferior: Telemetria (KM e Tempo À XX:MM do seu local) + Botões (No App, Google Maps, Waze) */}
      <div className="caixa-card p-2.5 shrink-0 flex flex-col gap-2">
        {/* Linha 1: Contador de Distância (KM) e Tempo (À XX:MM do seu local) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-[4px] bg-[#005CA9] text-white font-mono-tabular text-[11px] font-extrabold tracking-tight whitespace-nowrap">
              {formattedDistanceKm} KM
            </span>
            <div
              className={`flex items-center gap-1 text-[11px] font-bold truncate ${
                isDark ? 'text-slate-200' : 'text-[#1E293B]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-mono-tabular">À {formattedEtaHHMM}</span>
              <span
                className={`text-[10px] font-medium truncate ${
                  isDark ? 'text-slate-400' : 'text-[#5F6C7B]'
                }`}
              >
                do seu local
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              requestUserGps(false);
              handleFitRouteInMap();
            }}
            className="text-[10px] font-bold text-[#2B82C9] hover:underline flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
          >
            <LocateFixed className="w-3 h-3 text-[#2B82C9]" />
            <span>{hasRealGps ? 'GPS Ativo' : 'Usar meu GPS'}</span>
          </button>
        </div>

        {/* Linha 2: Ações Diretas — Abrir no App | Google Maps | Waze */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* 1. Abrir no App (Cockpit de Rota GPS Nativo) */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setIsInAppCockpitOpen(true);
            }}
            className="py-2 px-2 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Compass className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="text-white">No App</span>
          </button>

          {/* 2. Abrir no Google Maps */}
          <a
            href={navigationLinks.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticLight()}
            className="py-2 px-2 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Route className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="text-white">Google Maps</span>
            <ExternalLink className="w-2.5 h-2.5 text-white shrink-0" />
          </a>

          {/* 3. Abrir no Waze */}
          <a
            href={navigationLinks.wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => hapticLight()}
            className={`py-2 px-2 rounded-[4px] font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 border transition cursor-pointer active:scale-95 whitespace-nowrap ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                : 'bg-[#F0F5FA] hover:bg-[#E2ECF7] border-[#D0DFEE] text-[#005CA9]'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-[#2B82C9] shrink-0" />
            <span>Waze</span>
            <ExternalLink className="w-2.5 h-2.5 text-[#2B82C9] shrink-0" />
          </a>
        </div>
      </div>

      {/* Modal Cockpit GPS Nativo ("Abrir no App") com Navegação Course-Up em Tempo Real */}
      {isInAppCockpitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex flex-col">
          {/* Cabeçalho do Cockpit no App */}
          <div className="px-3.5 py-2.5 bg-[#005CA9] text-white flex items-center justify-between gap-2 shrink-0 border-b border-white/15">
            <div className="flex items-center gap-2 min-w-0">
              <Compass className="w-4 h-4 text-white shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate text-white">
                  Rota no App • {salonName}
                </div>
                <div className="text-[10px] text-white/85 font-mono-tabular truncate">
                  {formattedDistanceKm} KM • À {formattedEtaHHMM} do seu local
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsInAppCockpitOpen(false);
              }}
              className="w-7 h-7 rounded-[4px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Mapa GPS Course-Up em Tela Cheia */}
          <div className="flex-1 min-h-0 relative">
            <InteractiveGoogleRouteMap
              originLat={userCoords.lat}
              originLng={userCoords.lng}
              originLabel="Seu Local"
              destLat={salonCoords.lat}
              destLng={salonCoords.lng}
              destLabel={salonName}
              userAvatarUrl={userAvatarUrl}
              routeData={computedRoute}
              initialDistanceKm={distanceKm}
              initialEtaMinutes={etaMinutes}
              onTelemetryUpdate={(dist, eta) => {
                setDistanceKm(dist);
                setEtaMinutes(eta);
              }}
            />
          </div>

          {/* Rodapé Fixo de Ação no Cockpit */}
          <div className="sticky bottom-0 z-20 p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-[4px] bg-emerald-500 text-white font-mono-tabular text-xs font-extrabold">
                {formattedDistanceKm} KM
              </span>
              <span className="text-xs font-bold text-white font-mono-tabular">
                À {formattedEtaHHMM} do seu local
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <a
                href={navigationLinks.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-[4px] bg-[#005CA9] text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap"
              >
                <span className="text-white">Maps</span>
                <ExternalLink className="w-3 h-3 text-white" />
              </a>
              <a
                href={navigationLinks.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-[4px] bg-slate-800 text-white border border-slate-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap"
              >
                <span className="text-white">Waze</span>
                <ExternalLink className="w-3 h-3 text-white" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
