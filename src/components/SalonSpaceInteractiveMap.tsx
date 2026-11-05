import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Plus,
  Minus,
  LocateFixed,
  Clock,
  X,
  Compass,
  ChevronDown,
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

// Logos Oficiais em Data URI (Google Maps & Waze) para renderização fiel em <img>
const GOOGLE_MAPS_LOGO_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <path fill="#48b564" d="M35.76,26.36h0.01c0,0-3.77,5.53-6.94,9.64c-2.74,3.55-3.54,6.59-3.77,8.06C24.97,44.6,24.53,45,24,45s-0.97-0.4-1.06-0.94c-0.23-1.47-1.03-4.51-3.77-8.06c-0.42-0.55-0.85-1.12-1.28-1.7L28.24,22l8.33-9.88C37.49,14.05,38,16.21,38,18.5C38,21.4,37.17,24.09,35.76,26.36z"/>
      <path fill="#fcc60e" d="M28.24,22L17.89,34.3c-2.82-3.78-5.66-7.94-5.66-7.94h0.01c-0.3-0.48-0.57-0.97-0.8-1.48L19.76,15c-0.79,0.95-1.26,2.17-1.26,3.5c0,3.04,2.46,5.5,5.5,5.5C25.71,24,27.24,23.22,28.24,22z"/>
      <path fill="#2c85eb" d="M28.4,4.74l-8.57,10.18L13.27,9.2C15.83,6.02,19.69,4,24,4C25.54,4,27.02,4.26,28.4,4.74z"/>
      <path fill="#ed5748" d="M19.83,14.92L19.76,15l-8.32,9.88C10.52,22.95,10,20.79,10,18.5c0-3.54,1.23-6.79,3.27-9.3L19.83,14.92z"/>
      <path fill="#5695f6" d="M28.24,22c0.79-0.95,1.26-2.17,1.26-3.5c0-3.04-2.46-5.5-5.5-5.5c-1.71,0-3.24,0.78-4.24,2L28.4,4.74c3.59,1.22,6.53,3.91,8.17,7.38L28.24,22z"/>
      <circle cx="24" cy="18.5" r="4.8" fill="#ffffff"/>
    </svg>`
  );

const WAZE_LOGO_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="12" fill="#33CCFF"/>
      <path fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5" stroke-linejoin="round" d="M38.8,22.2c0-7.5-6.5-13.2-14.4-13.2c-7.9,0-14.2,5.7-14.2,13c0,2.8,0.9,5.2,0.9,5.2c-1.8,0.8-3.3,1.2-4.3,1.2c-0.8,0-1,0.9-0.4,1.6c1.5,1.9,5,3.9,9.6,4.3h16.8C36.8,33.1,38.8,28.1,38.8,22.2z"/>
      <circle cx="20.5" cy="20.2" r="2" fill="#1E293B"/>
      <circle cx="28.7" cy="20.2" r="2" fill="#1E293B"/>
      <path fill="none" stroke="#1E293B" stroke-width="2.3" stroke-linecap="round" d="M20.3,25.4c1.3,1.9,3.4,2.7,5.8,2.3c1.4-0.2,2.6-1,3.3-2.3"/>
      <circle cx="17.5" cy="35.4" r="3.6" fill="#1E293B"/>
      <circle cx="17.5" cy="35.4" r="1.4" fill="#94A3B8"/>
      <circle cx="30.8" cy="35.4" r="3.6" fill="#1E293B"/>
      <circle cx="30.8" cy="35.4" r="1.4" fill="#94A3B8"/>
    </svg>`
  );

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
  pinCircle.style.boxShadow =
    '0 4px 12px rgba(0, 92, 169, 0.55), 0 0 0 4px rgba(0, 92, 169, 0.22)';
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const salonMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeOuterLineRef = useRef<L.Polyline | null>(null);
  const routeInnerLineRef = useRef<L.Polyline | null>(null);

  // Painel inferior (KM, tempo e botões de rota) OCULTO por padrão conforme solicitado
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState<boolean>(false);

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

  // 2. Obtém a localização real do usuário via GPS
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
        // mantém fallback sem travar
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

  // 3. Calcula distância viária real (KM) e tempo (XX:MM) + polilinha viária da rota
  useEffect(() => {
    let cancelled = false;

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

  // 4. Inicializa o Mapa Leaflet (Focado no Marcador do Salão)
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
      zoomSnap: 0.1,
      zoomDelta: 1,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });

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

    // Linhas de rota viária
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

    // Marcador do Salão em destaque
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

  // 5. Controlador Unificado de Gestos (1 Dedo Arrasto como Google Maps/Waze + 2 Dedos Pinça Contínua + Mouse)
  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    let isOneFingerDragging = false;
    let lastX = 0;
    let lastY = 0;

    let isTwoFingerPinching = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 16;
    let lastPinchMidX = 0;
    let lastPinchMidY = 0;

    let lastTapTime = 0;

    const isInteractiveControl = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest('button, a'));
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isInteractiveControl(e.target)) return;
      e.stopPropagation();

      const lmap = leafletMapRef.current;

      if (e.touches.length === 1) {
        isOneFingerDragging = true;
        isTwoFingerPinching = false;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;

        // Duplo toque com 1 dedo para dar zoom no ponto tocado (igual Google Maps/Waze)
        const now = Date.now();
        if (now - lastTapTime < 280 && lmap) {
          const rect = viewportEl.getBoundingClientRect();
          const pt = L.point(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
          lmap.setZoomAround(pt, Math.min(19, Math.round(lmap.getZoom() + 1)), {
            animate: true,
          });
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
      } else if (e.touches.length >= 2) {
        isOneFingerDragging = false;
        isTwoFingerPinching = true;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        pinchStartDist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        pinchStartZoom = lmap ? lmap.getZoom() : 16;
        lastPinchMidX = (t0.clientX + t1.clientX) / 2;
        lastPinchMidY = (t0.clientY + t1.clientY) / 2;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const lmap = leafletMapRef.current;
      if (!lmap) return;

      if (e.touches.length === 1 && isOneFingerDragging) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        const curX = e.touches[0].clientX;
        const curY = e.touches[0].clientY;
        const dx = curX - lastX;
        const dy = curY - lastY;
        lastX = curX;
        lastY = curY;

        if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
          lmap.panBy([-dx, -dy], { animate: false });
        }
      } else if (e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const curDist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        const curMidX = (t0.clientX + t1.clientX) / 2;
        const curMidY = (t0.clientY + t1.clientY) / 2;

        if (!isTwoFingerPinching) {
          isTwoFingerPinching = true;
          isOneFingerDragging = false;
          pinchStartDist = curDist;
          pinchStartZoom = lmap.getZoom();
          lastPinchMidX = curMidX;
          lastPinchMidY = curMidY;
          return;
        }

        // Arrasto simultâneo do ponto médio da pinça
        const midDx = curMidX - lastPinchMidX;
        const midDy = curMidY - lastPinchMidY;
        lastPinchMidX = curMidX;
        lastPinchMidY = curMidY;

        if (Math.abs(midDx) > 0.3 || Math.abs(midDy) > 0.3) {
          lmap.panBy([-midDx, -midDy], { animate: false });
        }

        // Pinça contínua ancorada no centro dos 2 dedos (igual Google Maps / Waze)
        const scale = curDist / pinchStartDist;
        const targetZoom = Math.min(19, Math.max(11, pinchStartZoom + Math.log2(scale) * 1.35));
        if (Math.abs(targetZoom - lmap.getZoom()) >= 0.06) {
          const rect = viewportEl.getBoundingClientRect();
          const pinchPt = L.point(curMidX - rect.left, curMidY - rect.top);
          lmap.setZoomAround(pinchPt, targetZoom, { animate: false });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isOneFingerDragging = false;
        isTwoFingerPinching = false;
      } else if (e.touches.length === 1) {
        isTwoFingerPinching = false;
        isOneFingerDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };

    // Suporte completo para arrasto com 1 clique (Mouse / Preview no Desktop) e Zoom na Roda do Mouse
    let isMouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isInteractiveControl(e.target)) return;
      e.stopPropagation();
      isMouseDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const lmap = leafletMapRef.current;
      if (!lmap) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        lmap.panBy([-dx, -dy], { animate: false });
      }
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (isInteractiveControl(e.target)) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const lmap = leafletMapRef.current;
      if (!lmap) return;
      const rect = viewportEl.getBoundingClientRect();
      const mousePt = L.point(e.clientX - rect.left, e.clientY - rect.top);
      const zoomDelta = e.deltaY < 0 ? 0.65 : -0.65;
      lmap.setZoomAround(mousePt, Math.min(19, Math.max(11, lmap.getZoom() + zoomDelta)), {
        animate: false,
      });
    };

    viewportEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewportEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewportEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    viewportEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    viewportEl.addEventListener('mousedown', handleMouseDown);
    viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      viewportEl.removeEventListener('touchstart', handleTouchStart);
      viewportEl.removeEventListener('touchmove', handleTouchMove);
      viewportEl.removeEventListener('touchend', handleTouchEnd);
      viewportEl.removeEventListener('touchcancel', handleTouchEnd);
      viewportEl.removeEventListener('mousedown', handleMouseDown);
      viewportEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Reajusta o tamanho do mapa quando o painel inferior abre/fecha
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        leafletMapRef.current?.invalidateSize();
      } catch {}
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isRoutePanelOpen]);

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
    if (lmap) lmap.setZoom(Math.min(19, Math.round(lmap.getZoom() + 1)));
  };

  const handleZoomOut = () => {
    hapticLight();
    const lmap = leafletMapRef.current;
    if (lmap) lmap.setZoom(Math.max(11, Math.round(lmap.getZoom() - 1)));
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
      {/* Palco do Mapa Interativo (Arrasto livre com 1 dedo + Zoom de pinça com 2 dedos + Marcador do Salão) */}
      <div
        ref={viewportRef}
        className={`relative w-full flex-1 min-h-[240px] rounded-[4px] overflow-hidden border shadow-xs select-none cursor-grab active:cursor-grabbing ${
          isDark
            ? 'bg-slate-950 border-slate-800 vagou-map-dark'
            : 'bg-slate-100 border-[#E6EDF5]'
        }`}
        style={{ touchAction: 'none' }}
      >
        <div ref={mapContainerRef} className="w-full h-full z-0 pointer-events-none" />

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

        {/* Botão Flutuante para Mostrar o Elemento de Rota & Distância (oculto por padrão) */}
        {!isRoutePanelOpen && (
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setIsRoutePanelOpen(true);
            }}
            className="absolute bottom-2.5 right-2.5 z-10 px-3 py-2 rounded-[4px] bg-[#005CA9] hover:bg-[#004A87] text-white shadow-lg border border-white/20 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="text-white">Como Chegar</span>
            <span className="px-1.5 py-0.5 rounded-[3px] bg-white/20 text-white font-mono-tabular text-[10px]">
              {formattedDistanceKm} KM
            </span>
          </button>
        )}
      </div>

      {/* Elemento Inferior (Oculto por padrão — exibido ao clicar no botão "Como Chegar") */}
      {isRoutePanelOpen && (
        <div className="caixa-card p-2.5 shrink-0 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
          {/* Linha 1: Contador de Distância (KM) e Tempo (À XX:MM do seu local) + Botão Ocultar */}
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

            <div className="flex items-center gap-1.5 shrink-0">
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
                <span>{hasRealGps ? 'GPS Ativo' : 'Usar GPS'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setIsRoutePanelOpen(false);
                }}
                title="Ocultar painel de rota"
                className={`w-6 h-6 rounded-[4px] border flex items-center justify-center transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    : 'bg-slate-100 border-[#D6E0EC] text-[#5F6C7B] hover:text-[#1E293B]'
                }`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Linha 2: Botões de Navegação — No App | Logo Oficial Google Maps | Logo Oficial Waze */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Abrir no App (Cockpit de Rota GPS Nativo) */}
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                setIsInAppCockpitOpen(true);
              }}
              className="h-10 px-2.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Compass className="w-4 h-4 text-white shrink-0" />
              <span className="text-white">No App</span>
            </button>

            {/* 2. Botão com Logo Oficial Google Maps */}
            <a
              href={navigationLinks.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => hapticLight()}
              title="Abrir no Google Maps"
              className={`h-10 px-2.5 rounded-[4px] border font-bold text-[11px] flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                  : 'bg-white hover:bg-slate-50 border-[#D6E0EC] text-[#1E293B]'
              }`}
            >
              <img
                src={GOOGLE_MAPS_LOGO_DATA_URI}
                alt="Google Maps"
                className="w-6 h-6 object-contain shrink-0"
              />
              <span>Maps</span>
            </a>

            {/* 3. Botão com Logo Oficial Waze */}
            <a
              href={navigationLinks.wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => hapticLight()}
              title="Abrir no Waze"
              className={`h-10 px-2.5 rounded-[4px] border font-bold text-[11px] flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                  : 'bg-white hover:bg-slate-50 border-[#D6E0EC] text-[#1E293B]'
              }`}
            >
              <img
                src={WAZE_LOGO_DATA_URI}
                alt="Waze"
                className="w-6 h-6 object-contain shrink-0 rounded-[4px]"
              />
              <span>Waze</span>
            </a>
          </div>
        </div>
      )}

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
                className="px-2.5 py-1.5 rounded-[4px] bg-white text-[#1E293B] text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <img src={GOOGLE_MAPS_LOGO_DATA_URI} alt="Google Maps" className="w-4 h-4 object-contain" />
                <span>Maps</span>
              </a>
              <a
                href={navigationLinks.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-[4px] bg-white text-[#1E293B] text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <img src={WAZE_LOGO_DATA_URI} alt="Waze" className="w-4 h-4 object-contain rounded-[3px]" />
                <span>Waze</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
