import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Plus,
  Minus,
} from 'lucide-react';
import { geocodeBrazilLocation } from '../utils/bookingSlots';
import { hapticLight } from '../utils/haptics';

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

export const SalonSpaceInteractiveMap: React.FC<SalonSpaceInteractiveMapProps> = ({
  salonName,
  salonAvatar,
  salonAddress,
  salonCep,
  initialSalonLat,
  initialSalonLng,
  isDark = false,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const salonMarkerRef = useRef<L.Marker | null>(null);

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

  // 2. Inicializa o Mapa Leaflet (Apenas o Mapa Focado no Marcador do Salão — Sem Rotas)
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

  // 3. Controlador Unificado de Gestos (1 Dedo Arrasto + 2 Dedos Pinça + Mouse)
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

        const midDx = curMidX - lastPinchMidX;
        const midDy = curMidY - lastPinchMidY;
        lastPinchMidX = curMidX;
        lastPinchMidY = curMidY;

        if (Math.abs(midDx) > 0.3 || Math.abs(midDy) > 0.3) {
          lmap.panBy([-midDx, -midDy], { animate: false });
        }

        const scale = curDist / pinchStartDist;
        const targetZoom = Math.min(19, Math.max(11, Math.round(pinchStartZoom + Math.log2(scale) * 1.35)));
        if (targetZoom !== lmap.getZoom()) {
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
      const zoomDelta = e.deltaY < 0 ? 1 : -1;
      lmap.setZoomAround(mousePt, Math.min(19, Math.max(11, Math.round(lmap.getZoom() + zoomDelta))), {
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

  // Controles de Zoom e Centralização no Salão
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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Palco do Mapa Interativo (Apenas o Mapa com o Marcador do Salão — Sem Rotas) */}
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

        {/* Controles Flutuantes do Mapa (Centralizar no Salão e Zoom + / -) */}
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
      </div>
    </div>
  );
};

