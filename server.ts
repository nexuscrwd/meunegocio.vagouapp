import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import multer from 'multer';
import * as webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://xemenxdhuoekytyhmgyt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbWVueGRodW9la3l0eWhtZ3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDE2MzAsImV4cCI6MjEwNTc3NzYzMH0.P-q6bQspwuQNhub08hjWmsjLrugr3CVA1NIdznWJxuo';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_UPLOAD_BUCKETS = new Set(['avatars', 'branding', 'services', 'salon-media']);
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const isBase64DataUri = (value: unknown): boolean =>
  typeof value === 'string' && /^\s*data:/i.test(value);

const sanitizeNonBase64Url = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isBase64DataUri(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') ? trimmed : null;
};

const getSupabaseServerClient = () => {
  const sUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
  return createClient(sUrl, sKey, {
    auth: { persistSession: false },
  });
};

const verifySupabaseBearerUser = async (req: express.Request): Promise<{ userId: string; role: string } | null> => {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    const role = String((data.user.app_metadata as any)?.role || 'client');
    return { userId: data.user.id, role };
  } catch {
    return null;
  }
};

const configureWebPushVapid = (): boolean => {
  const pub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:suporte@vagouapp.com').trim();
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    return true;
  } catch {
    return false;
  }
};

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : NaN;
  const PORT = !Number.isNaN(cliPort)
    ? cliPort
    : process.env.NODE_ENV === 'production'
    ? Number(process.env.PORT) || 3000
    : 3000;

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!apiKey,
      hasMapsKey: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
    });
  });

  const getMapsApiKey = () =>
    (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

  app.get('/api/maps/config', (_req, res) => {
    const mapsKey = getMapsApiKey();
    res.json({
      apiKey: mapsKey,
      enabled: Boolean(mapsKey),
    });
  });

  const encodeGooglePolyline1e5 = (points: Array<{ lat: number; lng: number }>): string => {
    let lastLat = 0;
    let lastLng = 0;
    let result = '';

    const encodeSignedNumber = (num: number): string => {
      let sgnNum = num << 1;
      if (num < 0) sgnNum = ~sgnNum;
      let encoded = '';
      while (sgnNum >= 0x20) {
        encoded += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
        sgnNum >>= 5;
      }
      encoded += String.fromCharCode(sgnNum + 63);
      return encoded;
    };

    for (const pt of points) {
      const latE5 = Math.round(pt.lat * 1e5);
      const lngE5 = Math.round(pt.lng * 1e5);
      result += encodeSignedNumber(latE5 - lastLat);
      result += encodeSignedNumber(lngE5 - lastLng);
      lastLat = latE5;
      lastLng = lngE5;
    }
    return result;
  };

  const decodeValhallaPolyline1e6 = (encoded: string): Array<{ lat: number; lng: number }> => {
    const points: Array<{ lat: number; lng: number }> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
      let b = 0;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({ lat: lat / 1e6, lng: lng / 1e6 });
    }
    return points;
  };

  const isPlaceholderCoordPair = (lat: number, lng: number): boolean =>
    (Math.abs(lat - -23.5621) < 0.0008 && Math.abs(lng - -46.4795) < 0.0008) ||
    (Math.abs(lat - -23.5592) < 0.0008 && Math.abs(lng - -46.6589) < 0.0008) ||
    (Math.abs(lat - -23.5505) < 0.0008 && Math.abs(lng - -46.6333) < 0.0008);

  const mapOsrmManeuverToGoogle = (
    typeRaw: unknown,
    modifierRaw: unknown,
    roadNameRaw: unknown,
    idx: number
  ): { maneuver: string; instruction: string } => {
    const type = String(typeRaw || '').toLowerCase();
    const mod = String(modifierRaw || '').toLowerCase();
    const road = String(roadNameRaw || '').trim();
    const viaSuffix = road ? ` em ${road}` : '';

    if (type === 'arrive') {
      return {
        maneuver: 'STRAIGHT',
        instruction: road ? `Chegada em ${road}` : 'Chegada ao destino',
      };
    }
    if (mod.includes('uturn')) {
      return {
        maneuver: 'UTURN_LEFT',
        instruction: `Faça o retorno${viaSuffix}`,
      };
    }
    if (type === 'roundabout' || type === 'rotary') {
      return {
        maneuver: mod.includes('left') ? 'ROUNDABOUT_LEFT' : 'ROUNDABOUT_RIGHT',
        instruction: `Na rotatória, pegue a saída${viaSuffix}`,
      };
    }
    if (type === 'on ramp' || type === 'off ramp' || type === 'fork') {
      if (mod.includes('left')) {
        return {
          maneuver: 'RAMP_LEFT',
          instruction: `Pegue o acesso à esquerda${viaSuffix}`,
        };
      }
      return {
        maneuver: 'RAMP_RIGHT',
        instruction: `Pegue o acesso à direita${viaSuffix}`,
      };
    }
    if (mod === 'sharp left') {
      return { maneuver: 'TURN_SHARP_LEFT', instruction: `Curva acentuada à esquerda${viaSuffix}` };
    }
    if (mod === 'left') {
      return { maneuver: 'TURN_LEFT', instruction: `Vire à esquerda${viaSuffix}` };
    }
    if (mod === 'slight left') {
      return { maneuver: 'TURN_SLIGHT_LEFT', instruction: `Mantenha-se à esquerda${viaSuffix}` };
    }
    if (mod === 'sharp right') {
      return { maneuver: 'TURN_SHARP_RIGHT', instruction: `Curva acentuada à direita${viaSuffix}` };
    }
    if (mod === 'right') {
      return { maneuver: 'TURN_RIGHT', instruction: `Vire à direita${viaSuffix}` };
    }
    if (mod === 'slight right') {
      return { maneuver: 'TURN_SLIGHT_RIGHT', instruction: `Mantenha-se à direita${viaSuffix}` };
    }
    return {
      maneuver: 'STRAIGHT',
      instruction: road ? `Siga por ${road}` : `Siga pela via principal (${idx + 1})`,
    };
  };

  const computeServerHaversineMeters = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const resolveSmartCoordinates = async (
    lat: unknown,
    lng: unknown,
    address?: string,
    defaultLat = -23.5505,
    defaultLng = -46.6333,
    options?: {
      mapsKey?: string;
      referer?: string;
      biasLat?: number;
      biasLng?: number;
      placeId?: string;
    }
  ): Promise<{ lat: number; lng: number; placeId?: string }> => {
    const hasExplicitCoords =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng);
    const numLat = hasExplicitCoords ? (lat as number) : defaultLat;
    const numLng = hasExplicitCoords ? (lng as number) : defaultLng;

    const cleanAddr = String(address || '')
      .replace(/^local atual\s*\(gps\)$/i, '')
      .replace(/^estabelecimento$/i, '')
      .trim();

    if (!cleanAddr || (hasExplicitCoords && !isPlaceholderCoordPair(numLat, numLng))) {
      return { lat: numLat, lng: numLng, placeId: options?.placeId };
    }

    const lowerClean = cleanAddr.toLowerCase();
    if (
      lowerClean.includes('ayrton senna') &&
      lowerClean.includes('guarulhos') &&
      !/\d{3,5}/.test(lowerClean)
    ) {
      return { lat: -23.47405, lng: -46.4896, placeId: options?.placeId };
    }

    const queryWithCountry = /brasil|brazil/i.test(cleanAddr) ? cleanAddr : `${cleanAddr}, Brasil`;
    const hasBias =
      typeof options?.biasLat === 'number' &&
      typeof options?.biasLng === 'number' &&
      Number.isFinite(options.biasLat) &&
      Number.isFinite(options.biasLng) &&
      !isPlaceholderCoordPair(options.biasLat, options.biasLng);

    if (options?.mapsKey) {
      try {
        const boundsParam = hasBias
          ? `&bounds=${(options.biasLat! - 0.28).toFixed(4)},${(options.biasLng! - 0.28).toFixed(4)}|${(options.biasLat! + 0.28).toFixed(4)},${(options.biasLng! + 0.28).toFixed(4)}`
          : '';
        const gHeaders: Record<string, string> = {
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        };
        if (options.referer) gHeaders['Referer'] = options.referer;

        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            queryWithCountry
          )}&language=pt-BR&region=br${boundsParam}&key=${encodeURIComponent(options.mapsKey)}`,
          { headers: gHeaders, signal: AbortSignal.timeout(4000) }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const first = geoData?.results?.[0];
          const loc = first?.geometry?.location;
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            return {
              lat: loc.lat,
              lng: loc.lng,
              placeId: first.place_id || options?.placeId,
            };
          }
        }
      } catch {}

      try {
        const gHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': options.mapsKey,
          'X-Goog-FieldMask': 'places.id,places.location',
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        };
        if (options.referer) gHeaders['Referer'] = options.referer;

        const placesPayload: Record<string, any> = {
          textQuery: queryWithCountry,
          languageCode: 'pt-BR',
          regionCode: 'BR',
          maxResultCount: 1,
        };
        if (hasBias) {
          placesPayload.locationBias = {
            circle: {
              center: { latitude: options.biasLat!, longitude: options.biasLng! },
              radius: 35000.0,
            },
          };
        }

        const pRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: gHeaders,
          body: JSON.stringify(placesPayload),
          signal: AbortSignal.timeout(4000),
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          const firstPlace = pData?.places?.[0];
          if (
            typeof firstPlace?.location?.latitude === 'number' &&
            typeof firstPlace?.location?.longitude === 'number'
          ) {
            return {
              lat: firstPlace.location.latitude,
              lng: firstPlace.location.longitude,
              placeId: firstPlace.id || options?.placeId,
            };
          }
        }
      } catch {}
    }

    const strippedForNom = cleanAddr
      .replace(/\b(?:cep\s*)?\d{5}-?\d{3}\b/gi, '')
      .replace(/\s*\/\s*/g, ', ')
      .replace(/\s+-\s+/g, ', ')
      .replace(/,\s*,+/g, ', ')
      .replace(/^,\s*|,\s*$/g, '')
      .trim();

    const nomParts = strippedForNom
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const nomCandidates = Array.from(
      new Set(
        [
          strippedForNom,
          nomParts.length >= 3
            ? `${nomParts[0]}, ${nomParts[nomParts.length - 2]}, ${nomParts[nomParts.length - 1]}`
            : '',
          nomParts[0] || '',
        ].filter((q) => q.length >= 3)
      )
    );

    const viewboxParam = hasBias
      ? `&viewbox=${(options!.biasLng! - 0.3).toFixed(4)},${(options!.biasLat! + 0.3).toFixed(4)},${(options!.biasLng! + 0.3).toFixed(4)},${(options!.biasLat! - 0.3).toFixed(4)}&bounded=0`
      : '';

    for (const candidateQuery of nomCandidates) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br${viewboxParam}&q=${encodeURIComponent(
          candidateQuery
        )}`;
        const nomRes = await fetch(nomUrl, {
          headers: {
            'User-Agent': 'VagouApp-GIS/1.0',
            'Accept-Language': 'pt-BR',
          },
          signal: AbortSignal.timeout(3500),
        });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData) && nomData[0]?.lat && nomData[0]?.lon) {
            return {
              lat: Number(nomData[0].lat),
              lng: Number(nomData[0].lon),
            };
          }
        }
      } catch {}
    }

    const cepMatch = cleanAddr.match(/\b(\d{5})-?(\d{3})\b/);
    if (cepMatch) {
      try {
        const cep8 = `${cepMatch[1]}${cepMatch[2]}`;
        const brRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep8}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (brRes.ok) {
          const brData = await brRes.json();
          const lat = Number(brData?.location?.coordinates?.latitude);
          const lng = Number(brData?.location?.coordinates?.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
            return { lat, lng };
          }
        }
      } catch {}
    }

    return { lat: numLat, lng: numLng };
  };

  app.post(['/api/maps/compute-route', '/api/geo/route'], async (req, res) => {
    const mapsKey = getMapsApiKey();
    const reqReferer = String(req.headers.referer || req.headers.origin || '');
    const {
      originLat,
      originLng,
      originAddress,
      originPlaceId,
      destLat,
      destLng,
      destAddress,
      destPlaceId,
      travelMode = 'DRIVE',
    } = req.body || {};

    const resolvedOrigin = await resolveSmartCoordinates(
      originLat,
      originLng,
      originAddress,
      -23.5505,
      -46.6333,
      { mapsKey, referer: reqReferer, placeId: originPlaceId }
    );
    const resolvedDest = await resolveSmartCoordinates(
      destLat,
      destLng,
      destAddress,
      -23.5621,
      -46.4795,
      {
        mapsKey,
        referer: reqReferer,
        biasLat: resolvedOrigin.lat,
        biasLng: resolvedOrigin.lng,
        placeId: destPlaceId,
      }
    );

    let safeOriginLat = resolvedOrigin.lat;
    let safeOriginLng = resolvedOrigin.lng;
    const safeDestLat = resolvedDest.lat;
    const safeDestLng = resolvedDest.lng;

    const straightMeters = computeServerHaversineMeters(
      safeOriginLat,
      safeOriginLng,
      safeDestLat,
      safeDestLng
    );

    if (straightMeters <= 130) {
      const arrivalPoly = encodeGooglePolyline1e5([
        { lat: safeOriginLat, lng: safeOriginLng },
        {
          lat: (safeOriginLat + safeDestLat) / 2,
          lng: (safeOriginLng + safeDestLng) / 2,
        },
        { lat: safeDestLat, lng: safeDestLng },
      ]);
      return res.json({
        resolvedOrigin: { lat: safeOriginLat, lng: safeOriginLng },
        resolvedDestination: { lat: safeDestLat, lng: safeDestLng },
        routes: [
          {
            distanceMeters: Math.max(10, Math.round(straightMeters)),
            duration: '15s',
            description: destAddress || 'No destino',
            polyline: { encodedPolyline: arrivalPoly },
            legs: [
              {
                distanceMeters: Math.max(10, Math.round(straightMeters)),
                duration: '15s',
                steps: [
                  {
                    distanceMeters: Math.max(10, Math.round(straightMeters)),
                    staticDuration: '15s',
                    startLocation: {
                      latLng: { latitude: safeOriginLat, longitude: safeOriginLng },
                    },
                    endLocation: {
                      latLng: { latitude: safeDestLat, longitude: safeDestLng },
                    },
                    navigationInstruction: {
                      instructions: `Você chegou em ${destAddress || 'seu destino'}`,
                      maneuver: 'STRAIGHT',
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    }

    const normalizedMode = ['DRIVE', 'TWO_WHEELER', 'BICYCLE', 'WALK', 'TRANSIT'].includes(
      String(travelMode).toUpperCase()
    )
      ? String(travelMode).toUpperCase()
      : 'DRIVE';

    if (mapsKey) {
      try {
        const fieldMask = [
          'routes.duration',
          'routes.distanceMeters',
          'routes.description',
          'routes.polyline.encodedPolyline',
          'routes.legs.duration',
          'routes.legs.distanceMeters',
          'routes.legs.steps.distanceMeters',
          'routes.legs.steps.staticDuration',
          'routes.legs.steps.polyline.encodedPolyline',
          'routes.legs.steps.startLocation',
          'routes.legs.steps.endLocation',
          'routes.legs.steps.navigationInstruction',
          'routes.legs.steps.localizedValues',
        ].join(',');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask': fieldMask,
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        };
        if (reqReferer) {
          headers['Referer'] = String(reqReferer);
        }

        const callGoogleComputeRoutes = async (oLat: number, oLng: number) => {
          const payload: Record<string, any> = {
            origin: {
              location: {
                latLng: { latitude: oLat, longitude: oLng },
              },
            },
            destination: {
              location: {
                latLng: { latitude: safeDestLat, longitude: safeDestLng },
              },
            },
            travelMode: normalizedMode,
            computeAlternativeRoutes: true,
            languageCode: 'pt-BR',
            units: 'METRIC',
          };
          if (normalizedMode === 'DRIVE' || normalizedMode === 'TWO_WHEELER') {
            payload.routingPreference = 'TRAFFIC_AWARE';
          }
          const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
          });
          if (!r.ok) return null;
          return await r.json();
        };

        const pickBestGoogleRoute = (routesList: any[]): any | null => {
          const valid = (Array.isArray(routesList) ? routesList : []).filter(
            (rt) => rt?.polyline?.encodedPolyline && Number(rt?.distanceMeters || 0) > 0
          );
          if (valid.length === 0) return null;

          valid.sort((a, b) => {
            const distA = Number(a.distanceMeters || 999999);
            const distB = Number(b.distanceMeters || 999999);
            const durA = Number(String(a.duration || '9999s').replace('s', '')) || 9999;
            const durB = Number(String(b.duration || '9999s').replace('s', '')) || 9999;
            return distA + durA * 6 - (distB + durB * 6);
          });
          return valid[0];
        };

        let bestData = await callGoogleComputeRoutes(safeOriginLat, safeOriginLng);
        let bestRoute = pickBestGoogleRoute(bestData?.routes);

        if (
          bestRoute &&
          (normalizedMode === 'DRIVE' || normalizedMode === 'TWO_WHEELER') &&
          straightMeters >= 800 &&
          Number(bestRoute.distanceMeters || 0) > straightMeters * 1.62 &&
          Number(bestRoute.distanceMeters || 0) - straightMeters > 3800
        ) {
          const dLatSign = safeDestLat <= safeOriginLat ? -1 : 1;
          const dLngSign = safeDestLng >= safeOriginLng ? 1 : -1;
          const candidateOffsets = [
            { lat: safeOriginLat + dLatSign * 0.00028, lng: safeOriginLng },
            { lat: safeOriginLat - dLatSign * 0.00028, lng: safeOriginLng },
            { lat: safeOriginLat, lng: safeOriginLng + dLngSign * 0.00028 },
          ];

          for (const cand of candidateOffsets) {
            const altData = await callGoogleComputeRoutes(cand.lat, cand.lng);
            const altRoute = pickBestGoogleRoute(altData?.routes);
            if (
              altRoute &&
              Number(altRoute.distanceMeters || 0) < Number(bestRoute.distanceMeters || 0) * 0.76
            ) {
              bestRoute = altRoute;
              bestData = { routes: [altRoute] };
              safeOriginLat = cand.lat;
              safeOriginLng = cand.lng;
              break;
            }
          }
        }

        if (bestRoute?.polyline?.encodedPolyline) {
          return res.json({
            routes: [bestRoute],
            resolvedOrigin: { lat: safeOriginLat, lng: safeOriginLng },
            resolvedDestination: { lat: safeDestLat, lng: safeDestLng },
          });
        }
      } catch {}
    }

    const osrmFossgisCluster =
      normalizedMode === 'WALK'
        ? 'routed-foot'
        : normalizedMode === 'BICYCLE'
        ? 'routed-bike'
        : 'routed-car';
    const osrmStandardProfile =
      normalizedMode === 'WALK'
        ? 'foot'
        : normalizedMode === 'BICYCLE'
        ? 'bike'
        : 'driving';

    const osrmEndpoints = [
      `https://routing.openstreetmap.de/${osrmFossgisCluster}/route/v1/driving/${safeOriginLng},${safeOriginLat};${safeDestLng},${safeDestLat}?overview=full&geometries=polyline&steps=true`,
      `https://router.project-osrm.org/route/v1/${osrmStandardProfile}/${safeOriginLng},${safeOriginLat};${safeDestLng},${safeDestLat}?overview=full&geometries=polyline&steps=true`,
    ];

    for (const osrmUrl of osrmEndpoints) {
      try {
        const osrmRes = await fetch(osrmUrl, {
          headers: { 'User-Agent': 'VagouApp-GIS/1.0' },
          signal: AbortSignal.timeout(5500),
        });
        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          const osrmRoute = osrmData?.routes?.[0];
          if (osrmRoute?.geometry) {
            const osrmLeg = osrmRoute.legs?.[0];
            const osrmSteps = Array.isArray(osrmLeg?.steps) ? osrmLeg.steps : [];
            const filteredSteps = osrmSteps.filter(
              (st: any) => Number(st?.distance || 0) > 15 || st?.maneuver?.type === 'arrive'
            );
            return res.json({
              resolvedOrigin: { lat: safeOriginLat, lng: safeOriginLng },
              resolvedDestination: { lat: safeDestLat, lng: safeDestLng },
              routes: [
                {
                  distanceMeters: Math.round(Number(osrmRoute.distance || 3200)),
                  duration: `${Math.round(Number(osrmRoute.duration || 600))}s`,
                  description: osrmLeg?.summary || 'Trajeto Viário Principal',
                  polyline: {
                    encodedPolyline: osrmRoute.geometry,
                  },
                  legs: [
                    {
                      distanceMeters: Math.round(Number(osrmRoute.distance || 3200)),
                      duration: `${Math.round(Number(osrmRoute.duration || 600))}s`,
                      steps: filteredSteps.map((st: any, idx: number) => {
                        const mapped = mapOsrmManeuverToGoogle(
                          st?.maneuver?.type,
                          st?.maneuver?.modifier,
                          st?.name || st?.ref,
                          idx
                        );
                        const loc = Array.isArray(st?.maneuver?.location)
                          ? st.maneuver.location
                          : null;
                        const nextLoc = Array.isArray(filteredSteps[idx + 1]?.maneuver?.location)
                          ? filteredSteps[idx + 1].maneuver.location
                          : null;
                        return {
                          distanceMeters: Math.round(Number(st.distance || 0)),
                          staticDuration: `${Math.round(Number(st.duration || 0))}s`,
                          ...(loc && loc.length >= 2
                            ? {
                                startLocation: {
                                  latLng: { latitude: Number(loc[1]), longitude: Number(loc[0]) },
                                },
                              }
                            : {}),
                          ...(nextLoc && nextLoc.length >= 2
                            ? {
                                endLocation: {
                                  latLng: {
                                    latitude: Number(nextLoc[1]),
                                    longitude: Number(nextLoc[0]),
                                  },
                                },
                              }
                            : {}),
                          navigationInstruction: {
                            instructions: mapped.instruction,
                            maneuver: mapped.maneuver,
                          },
                        };
                      }),
                    },
                  ],
                },
              ],
            });
          }
        }
      } catch {}
    }

    try {
      const valhallaCosting =
        normalizedMode === 'WALK'
          ? 'pedestrian'
          : normalizedMode === 'BICYCLE'
          ? 'bicycle'
          : 'auto';
      const valhallaRes = await fetch('https://valhalla1.openstreetmap.de/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VagouApp-GIS/1.0',
        },
        body: JSON.stringify({
          locations: [
            { lat: safeOriginLat, lon: safeOriginLng },
            { lat: safeDestLat, lon: safeDestLng },
          ],
          costing: valhallaCosting,
          directions_options: { units: 'kilometers', language: 'pt-BR' },
        }),
        signal: AbortSignal.timeout(5500),
      });

      if (valhallaRes.ok) {
        const valhallaData = await valhallaRes.json();
        const leg = valhallaData?.trip?.legs?.[0];
        if (leg?.shape) {
          const decodedPts = decodeValhallaPolyline1e6(leg.shape);
          if (decodedPts.length > 2) {
            const encoded1e5 = encodeGooglePolyline1e5(decodedPts);
            const distMeters = Math.round(Number(leg.summary?.length || 3.2) * 1000);
            const durationSec = Math.round(Number(leg.summary?.time || 840));
            const maneuvers = Array.isArray(leg.maneuvers) ? leg.maneuvers : [];
            return res.json({
              resolvedOrigin: { lat: safeOriginLat, lng: safeOriginLng },
              resolvedDestination: { lat: safeDestLat, lng: safeDestLng },
              routes: [
                {
                  distanceMeters: distMeters,
                  duration: `${durationSec}s`,
                  description: valhallaData?.trip?.summary?.has_highway
                    ? 'Via Expressa Principal'
                    : 'Malha Viária Urbana',
                  polyline: {
                    encodedPolyline: encoded1e5,
                  },
                  legs: [
                    {
                      distanceMeters: distMeters,
                      duration: `${durationSec}s`,
                      steps: maneuvers.map((m: any) => {
                        const instr = String(m.instruction || 'Siga pela via principal');
                        const lower = instr.toLowerCase();
                        const valManeuver = lower.includes('retorno')
                          ? 'UTURN_LEFT'
                          : lower.includes('esquerda')
                          ? 'TURN_LEFT'
                          : lower.includes('direita')
                          ? 'TURN_RIGHT'
                          : 'STRAIGHT';
                        const beginPt =
                          typeof m.begin_shape_index === 'number'
                            ? decodedPts[m.begin_shape_index]
                            : undefined;
                        const endPt =
                          typeof m.end_shape_index === 'number'
                            ? decodedPts[m.end_shape_index]
                            : undefined;
                        return {
                          distanceMeters: Math.round(Number(m.length || 0) * 1000),
                          staticDuration: `${Math.round(Number(m.time || 0))}s`,
                          ...(beginPt
                            ? {
                                startLocation: {
                                  latLng: { latitude: beginPt.lat, longitude: beginPt.lng },
                                },
                              }
                            : {}),
                          ...(endPt
                            ? {
                                endLocation: {
                                  latLng: { latitude: endPt.lat, longitude: endPt.lng },
                                },
                              }
                            : {}),
                          navigationInstruction: {
                            instructions: instr,
                            maneuver: valManeuver,
                          },
                        };
                      }),
                    },
                  ],
                },
              ],
            });
          }
        }
      }
    } catch {}

    const dLat = safeDestLat - safeOriginLat;
    const dLng = safeDestLng - safeOriginLng;
    const segments = 28;
    const corridorPoints: Array<{ lat: number; lng: number }> = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      const orthoWeight = Math.sin(t * Math.PI);
      const latOffset = dLng * 0.08 * orthoWeight * Math.cos(t * Math.PI * 2);
      const lngOffset = -dLat * 0.08 * orthoWeight * Math.sin(t * Math.PI * 2);
      corridorPoints.push({
        lat: safeOriginLat + dLat * t + latOffset,
        lng: safeOriginLng + dLng * t + lngOffset,
      });
    }
    const R = 6371000;
    const radLat = ((safeDestLat - safeOriginLat) * Math.PI) / 180;
    const radLng = ((safeDestLng - safeOriginLng) * Math.PI) / 180;
    const a =
      Math.sin(radLat / 2) ** 2 +
      Math.cos((safeOriginLat * Math.PI) / 180) *
        Math.cos((safeDestLat * Math.PI) / 180) *
        Math.sin(radLng / 2) ** 2;
    const estMeters = Math.max(400, Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.35));
    const estSeconds = Math.max(120, Math.round(estMeters / 8.5));

    return res.json({
      routes: [
        {
          distanceMeters: estMeters,
          duration: `${estSeconds}s`,
          description: 'Corredor Viário Urbano',
          polyline: {
            encodedPolyline: encodeGooglePolyline1e5(corridorPoints),
          },
          legs: [
            {
              distanceMeters: estMeters,
              duration: `${estSeconds}s`,
              steps: [
                {
                  distanceMeters: estMeters,
                  staticDuration: `${estSeconds}s`,
                  navigationInstruction: {
                    instructions: `Siga pela via principal até ${destAddress || 'o destino'}`,
                    maneuver: 'STRAIGHT',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  app.post('/api/maps/route-matrix', async (req, res) => {
    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      return res.status(503).json({ error: 'VITE_GOOGLE_MAPS_API_KEY not configured' });
    }

    try {
      const { originLat, originLng, originAddress, destLat, destLng, destAddress } = req.body || {};

      const buildWaypoint = (lat?: number, lng?: number, address?: string) => {
        if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          return { location: { latLng: { latitude: lat, longitude: lng } } };
        }
        return { address: String(address || 'São Paulo, SP') };
      };

      const originWp = buildWaypoint(originLat, originLng, originAddress);
      const destWp = buildWaypoint(destLat, destLng, destAddress);

      const modes: Array<{ key: string; gmpMode: string }> = [
        { key: 'walking', gmpMode: 'WALK' },
        { key: 'bicycling', gmpMode: 'BICYCLE' },
        { key: 'motorcycle', gmpMode: 'TWO_WHEELER' },
        { key: 'car', gmpMode: 'DRIVE' },
        { key: 'transit', gmpMode: 'TRANSIT' },
      ];

      const results: Record<string, { distanceKm: number; etaMinutes: number; description?: string }> = {};

      await Promise.all(
        modes.map(async ({ key, gmpMode }) => {
          try {
            const payload: Record<string, any> = {
              origin: originWp,
              destination: destWp,
              travelMode: gmpMode,
              languageCode: 'pt-BR',
              units: 'METRIC',
            };
            if (gmpMode === 'DRIVE' || gmpMode === 'TWO_WHEELER') {
              payload.routingPreference = 'TRAFFIC_AWARE';
            }

            const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': mapsKey,
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.description',
                'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
              },
              body: JSON.stringify(payload),
            });

            if (r.ok) {
              const d = await r.json();
              const route = d?.routes?.[0];
              if (route) {
                const distMeters = Number(route.distanceMeters || 0);
                const durSec = Number(String(route.duration || '0s').replace('s', '')) || 0;
                if (distMeters > 0 && durSec > 0) {
                  results[key] = {
                    distanceKm: Math.max(0.2, Number((distMeters / 1000).toFixed(1))),
                    etaMinutes: Math.max(2, Math.ceil(durSec / 60)),
                    description: route.description || undefined,
                  };
                }
              }
            }
          } catch {}
        })
      );

      return res.json({ modes: results });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Falha ao calcular matriz de modais' });
    }
  });

  app.post('/api/maps/places-search', async (req, res) => {
    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      return res.status(503).json({ error: 'VITE_GOOGLE_MAPS_API_KEY not configured' });
    }

    try {
      const { query, biasLat, biasLng } = req.body || {};
      const cleanQuery = String(query || '').trim();
      if (cleanQuery.length < 3) {
        return res.json({ places: [] });
      }

      const reqReferer = String(req.headers.referer || req.headers.origin || '');
      const centerLat =
        typeof biasLat === 'number' && Number.isFinite(biasLat) ? biasLat : -23.515;
      const centerLng =
        typeof biasLng === 'number' && Number.isFinite(biasLng) ? biasLng : -46.515;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      };
      if (reqReferer) headers['Referer'] = reqReferer;

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          textQuery: cleanQuery,
          languageCode: 'pt-BR',
          regionCode: 'BR',
          maxResultCount: 5,
          locationBias: {
            circle: {
              center: { latitude: centerLat, longitude: centerLng },
              radius: 45000.0,
            },
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || 'Erro na busca do Places API (New)',
          places: [],
        });
      }

      const places = Array.isArray(data?.places)
        ? data.places.map((p: any) => ({
            id: p.id,
            title: p.displayName?.text || p.formattedAddress || cleanQuery,
            formattedAddress: p.formattedAddress || p.displayName?.text || cleanQuery,
            lat: p.location?.latitude,
            lng: p.location?.longitude,
          }))
        : [];

      return res.json({ places });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao buscar locais', places: [] });
    }
  });

  app.get('/api/maps/snap-and-reverse', async (req, res) => {
    const mapsKey = getMapsApiKey();
    const reqReferer = String(req.headers.referer || req.headers.origin || '');

    try {
      const rawLat = Number(req.query.lat);
      const rawLng = Number(req.query.lng);
      if (Number.isNaN(rawLat) || Number.isNaN(rawLng)) {
        return res.status(400).json({ error: 'Coordenadas inválidas' });
      }

      let snappedLat = rawLat;
      let snappedLng = rawLng;
      const gHeaders: Record<string, string> = {
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      };
      if (reqReferer) gHeaders['Referer'] = reqReferer;

      if (mapsKey) {
        try {
          const roadsRes = await fetch(
            `https://roads.googleapis.com/v1/nearestRoads?points=${rawLat},${rawLng}&key=${encodeURIComponent(mapsKey)}`,
            { headers: gHeaders }
          );
          if (roadsRes.ok) {
            const roadsData = await roadsRes.json();
            const firstPoint = roadsData?.snappedPoints?.[0]?.location;
            if (
              firstPoint &&
              typeof firstPoint.latitude === 'number' &&
              typeof firstPoint.longitude === 'number'
            ) {
              const shiftMeters = computeServerHaversineMeters(
                rawLat,
                rawLng,
                firstPoint.latitude,
                firstPoint.longitude
              );
              if (shiftMeters <= 11) {
                snappedLat = firstPoint.latitude;
                snappedLng = firstPoint.longitude;
              }
            }
          }
        } catch {}
      }

      let streetName = '';
      let formattedAddress = '';
      if (mapsKey) {
        try {
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${rawLat},${rawLng}&language=pt-BR&key=${encodeURIComponent(mapsKey)}`,
            { headers: gHeaders }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const resultsList: any[] = Array.isArray(geoData?.results) ? geoData.results : [];
            const preferredResult =
              resultsList.find(
                (r) =>
                  Array.isArray(r.types) &&
                  (r.types.includes('street_address') ||
                    r.types.includes('premise') ||
                    r.types.includes('establishment') ||
                    r.types.includes('point_of_interest'))
              ) || resultsList[0];

            if (preferredResult) {
              formattedAddress = preferredResult.formatted_address || '';
              const routeComp = (preferredResult.address_components || []).find(
                (c: any) => Array.isArray(c.types) && c.types.includes('route')
              );
              streetName =
                routeComp?.short_name ||
                routeComp?.long_name ||
                formattedAddress.split(',')[0] ||
                '';
            }
          }
        } catch {}
      }

      if (!formattedAddress) {
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
              rawLat
            )}&lon=${encodeURIComponent(rawLng)}&zoom=18&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'VagouAppTriade/1.0 (https://vagou.app)',
                'Accept-Language': 'pt-BR',
              },
            }
          );
          if (nomRes.ok) {
            const nomData = await nomRes.json();
            const addr = nomData?.address || {};
            const road =
              addr.road ||
              addr.pedestrian ||
              addr.suburb ||
              addr.neighbourhood ||
              '';
            const num = addr.house_number ? `, ${addr.house_number}` : '';
            const neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || '';
            const city = addr.city || addr.town || addr.municipality || '';
            const state = addr.state_code || addr.state || '';
            const postcode = addr.postcode || '';
            streetName = streetName || (road ? `${road}${num}` : 'Local Atual (GPS)');
            formattedAddress =
              [
                road ? `${road}${num}` : '',
                neighborhood,
                city,
                state,
                postcode,
              ]
                .filter(Boolean)
                .join(' - ') ||
              nomData?.display_name ||
              'Local Atual (GPS)';
          }
        } catch {}
      }

      return res.json({
        lat: snappedLat,
        lng: snappedLng,
        streetName: streetName || 'Local Atual (GPS)',
        formattedAddress: formattedAddress || 'Local Atual (GPS)',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro no snap-and-reverse' });
    }
  });

  app.post('/api/geo/geocode', async (req, res) => {
    const mapsKey = getMapsApiKey();
    const {
      address = '',
      streetNumber = '',
      neighborhood = '',
      city = '',
      state = 'SP',
      cep = '',
      biasLat,
      biasLng,
    } = req.body || {};

    const extractedCepMatch = String(address || '').match(/\b(\d{5})-?(\d{3})\b/);
    const cleanCep =
      String(cep || '').replace(/\D/g, '') ||
      (extractedCepMatch ? `${extractedCepMatch[1]}${extractedCepMatch[2]}` : '');

    const queryParts = [
      address ? `${address}${streetNumber ? `, ${streetNumber}` : ''}` : '',
      neighborhood,
      city,
      state,
      cleanCep && !String(address).includes(cleanCep.slice(0, 5))
        ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5, 8)}`
        : '',
      'Brasil',
    ]
      .map((p) => String(p || '').trim())
      .filter(Boolean);
    const fullQuery = queryParts.join(', ');
    const reqReferer = String(req.headers.referer || req.headers.origin || '');
    const hasBias =
      typeof biasLat === 'number' &&
      typeof biasLng === 'number' &&
      Number.isFinite(biasLat) &&
      Number.isFinite(biasLng) &&
      !isPlaceholderCoordPair(biasLat, biasLng);

    if (mapsKey && fullQuery) {
      try {
        const headers: Record<string, string> = {
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        };
        if (reqReferer) headers['Referer'] = reqReferer;
        const boundsParam = hasBias
          ? `&bounds=${(biasLat - 0.28).toFixed(4)},${(biasLng - 0.28).toFixed(4)}|${(biasLat + 0.28).toFixed(4)},${(biasLng + 0.28).toFixed(4)}`
          : '';

        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            fullQuery
          )}&language=pt-BR&region=br${boundsParam}&key=${encodeURIComponent(mapsKey)}`,
          { headers }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const first = geoData?.results?.[0];
          const loc = first?.geometry?.location;
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            return res.json({
              lat: loc.lat,
              lng: loc.lng,
              formattedAddress: first.formatted_address || fullQuery,
              googlePlaceId: first.place_id || '',
              source: 'google_geocoding',
            });
          }
        }
      } catch {}
    }

    if (fullQuery) {
      const strippedNom = String(address || fullQuery)
        .replace(/\b(?:cep\s*)?\d{5}-?\d{3}\b/gi, '')
        .replace(/\bbrasil\b/gi, '')
        .replace(/\s*\/\s*/g, ', ')
        .replace(/\s+-\s+/g, ', ')
        .replace(/,\s*,+/g, ', ')
        .replace(/^,\s*|,\s*$/g, '')
        .trim();

      const nomParts = strippedNom
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const nomCandidates = Array.from(
        new Set(
          [
            strippedNom,
            nomParts.length >= 3
              ? `${nomParts[0]}, ${nomParts[nomParts.length - 2]}, ${nomParts[nomParts.length - 1]}`
              : '',
            city && nomParts[0] ? `${nomParts[0]}, ${city}, ${state || 'SP'}` : '',
            nomParts[0] || '',
          ].filter((q) => q.length >= 3)
        )
      );

      const viewboxParam = hasBias
        ? `&viewbox=${(biasLng - 0.3).toFixed(4)},${(biasLat + 0.3).toFixed(4)},${(biasLng + 0.3).toFixed(4)},${(biasLat - 0.3).toFixed(4)}&bounded=0`
        : '';

      for (const candidateQuery of nomCandidates) {
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br${viewboxParam}&q=${encodeURIComponent(
              candidateQuery
            )}`,
            {
              headers: {
                'User-Agent': 'VagouAppTriade/1.0 (https://vagou.app)',
                'Accept-Language': 'pt-BR',
              },
            }
          );
          if (nomRes.ok) {
            const nomData = await nomRes.json();
            const firstNom = Array.isArray(nomData) ? nomData[0] : null;
            if (firstNom && firstNom.lat && firstNom.lon) {
              return res.json({
                lat: Number(firstNom.lat),
                lng: Number(firstNom.lon),
                formattedAddress: firstNom.display_name || fullQuery,
                googlePlaceId: '',
                source: 'nominatim',
              });
            }
          }
        } catch {}
      }
    }

    if (cleanCep.length === 8) {
      try {
        const brRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
        if (brRes.ok) {
          const brData = await brRes.json();
          const coords = brData?.location?.coordinates;
          const lat = Number(coords?.latitude);
          const lng = Number(coords?.longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
            return res.json({
              lat,
              lng,
              formattedAddress: [
                brData.street || address,
                streetNumber,
                brData.neighborhood || neighborhood,
                brData.city || city,
                brData.state || state,
                cleanCep,
              ]
                .filter(Boolean)
                .join(', '),
              street: brData.street || address,
              neighborhood: brData.neighborhood || neighborhood,
              city: brData.city || city,
              state: brData.state || state,
              cep: cleanCep,
              googlePlaceId: '',
              source: 'brasilapi_v2',
            });
          }
        }
      } catch {}
    }

    return res.status(404).json({ error: 'Não foi possível geocodificar o endereço informado' });
  });

  app.post('/api/user/avatar', async (req, res) => {
    try {
      const {
        avatarData,
        email,
        cpf,
        name,
        phone,
        clientId,
        userId,
      } = req.body || {};

      if (!avatarData || typeof avatarData !== 'string') {
        return res.status(400).json({ error: 'Nenhum dado de avatar fornecido' });
      }

      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim();
      const cleanPhone = String(phone || '').trim();
      const cleanCpf = String(cpf || '').replace(/\D/g, '');
      const storedClientId = String(clientId || '').trim();
      const storedUserId = String(userId || '').trim();

      const supabase = getSupabaseServerClient();
      let resolvedAvatarUrl: string | null = null;
      let storagePublicUrl: string | null = null;
      let uploadedStoragePath: string | null = null;
      let uploadedBucket: string = 'avatars';
      let uploadedMime = 'image/webp';
      let uploadedBytes = 0;

      if (avatarData.startsWith('data:image/')) {
        const mimeMatch = avatarData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!mimeMatch) {
          return res.status(400).json({ error: 'Formato de imagem inválido.' });
        }
        const rawMime = mimeMatch[1].toLowerCase();
        if (!ALLOWED_IMAGE_MIMES.has(rawMime)) {
          return res.status(415).json({ error: 'Tipo de imagem não permitido.' });
        }

        const rawBuffer = Buffer.from(mimeMatch[2], 'base64');
        let finalBuffer: Buffer = rawBuffer;
        let finalExt = rawMime.includes('png') ? 'png' : rawMime.includes('svg') ? 'svg' : 'webp';
        uploadedMime = rawMime === 'image/png' ? 'image/png' : rawMime === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp';

        if (rawMime !== 'image/svg+xml' && rawMime !== 'image/gif') {
          try {
            const pipeline = sharp(rawBuffer).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true });
            finalBuffer =
              uploadedMime === 'image/png'
                ? await pipeline.png({ compressionLevel: 8 }).toBuffer()
                : await pipeline.webp({ quality: 84 }).toBuffer();
          } catch {
            finalBuffer = rawBuffer;
          }
        }
        uploadedBytes = finalBuffer.length;

        const cleanIdentifier = (storedUserId || storedClientId || cleanCpf || cleanEmail || 'user').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `user_avatar/${cleanIdentifier}-${Date.now()}.${finalExt}`;

        const { data: upData, error: upErr } = await supabase.storage
          .from('avatars')
          .upload(fileName, finalBuffer, { contentType: uploadedMime, cacheControl: '31536000', upsert: false });

        if (!upErr && upData?.path) {
          const { data: pubData } = supabase.storage.from('avatars').getPublicUrl(upData.path);
          if (pubData?.publicUrl) {
            storagePublicUrl = pubData.publicUrl;
            resolvedAvatarUrl = pubData.publicUrl;
            uploadedStoragePath = upData.path;
            uploadedBucket = 'avatars';
          }
        }

        if (!storagePublicUrl) {
          return res.status(422).json({
            error: 'Falha ao enviar avatar binário para o Supabase Storage. Persistência Base64 no banco é bloqueada.',
          });
        }
      } else {
        const safeUrl = sanitizeNonBase64Url(avatarData);
        if (!safeUrl) {
          return res.status(400).json({ error: 'URL de avatar inválida ou Base64 não permitido.' });
        }
        resolvedAvatarUrl = safeUrl;
        storagePublicUrl = safeUrl;
      }

      const nowIso = new Date().toISOString();

      if (uploadedStoragePath && storagePublicUrl) {
        try {
          await (supabase.from('media_assets' as any) as any).insert({
            owner_type: 'user_avatar',
            owner_id: UUID_REGEX.test(storedUserId) ? storedUserId : UUID_REGEX.test(storedClientId) ? storedClientId : null,
            bucket: uploadedBucket,
            storage_path: uploadedStoragePath,
            public_url: storagePublicUrl,
            mime_type: uploadedMime,
            size_bytes: uploadedBytes,
            title: cleanName ? `Avatar - ${cleanName}` : 'Avatar de Usuário',
          });
        } catch {}
      }

      try {
        const adminPayload: Record<string, any> = {
          avatar_url: resolvedAvatarUrl,
          updated_at: nowIso,
        };
        if (cleanName) adminPayload.full_name = cleanName;
        if (cleanPhone) adminPayload.phone_whatsapp = cleanPhone;
        if (cleanCpf) adminPayload.cpf = cleanCpf;

        if (storedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedUserId)) {
          await (supabase.from('system_admins' as any) as any).update(adminPayload).eq('id', storedUserId);
        }
        if (cleanEmail) {
          await (supabase.from('system_admins' as any) as any).update(adminPayload).ilike('email', cleanEmail);
          await (supabase.from('system_admins' as any) as any).update(adminPayload).ilike('username', cleanEmail);
        }
        if (cleanName && cleanName !== 'Usuário' && cleanName !== 'Cliente') {
          await (supabase.from('system_admins' as any) as any).update(adminPayload).ilike('full_name', cleanName);
        }
        if (cleanCpf && cleanCpf.length === 11) {
          await (supabase.from('system_admins' as any) as any).update(adminPayload).eq('cpf', cleanCpf);
        }
      } catch (err) {
        console.warn('Aviso: Erro ao atualizar system_admins:', err);
      }

      try {
        const clientPayload: Record<string, any> = {
          avatar_url: resolvedAvatarUrl,
          updated_at: nowIso,
        };
        if (cleanName) clientPayload.name = cleanName;
        if (cleanEmail && cleanEmail.includes('@') && cleanEmail.includes('.')) clientPayload.email = cleanEmail;
        if (cleanPhone) clientPayload.phone = cleanPhone;
        if (cleanCpf) clientPayload.cpf = cleanCpf;

        let clientUpdated = false;
        if (storedClientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedClientId)) {
          const { data } = await (supabase.from('clients' as any) as any).update(clientPayload).eq('id', storedClientId).select('id');
          if (data?.length) clientUpdated = true;
        }
        if (cleanCpf && cleanCpf.length === 11) {
          const { data } = await (supabase.from('clients' as any) as any).update(clientPayload).eq('cpf', cleanCpf).select('id');
          if (data?.length) clientUpdated = true;
        }
        if (cleanEmail) {
          const { data: byEmail } = await (supabase.from('clients' as any) as any).update(clientPayload).ilike('email', cleanEmail).select('id');
          if (byEmail?.length) clientUpdated = true;
          const { data: byUsername } = await (supabase.from('clients' as any) as any).update(clientPayload).ilike('username', cleanEmail).select('id');
          if (byUsername?.length) clientUpdated = true;
        }
        if (cleanName && cleanName !== 'Usuário' && cleanName !== 'Cliente') {
          const { data: byName } = await (supabase.from('clients' as any) as any).update(clientPayload).ilike('name', cleanName).select('id');
          if (byName?.length) clientUpdated = true;
        }
        if (!clientUpdated && (cleanEmail || cleanCpf || cleanName)) {
          await (supabase.from('clients' as any) as any).insert({
            name: cleanName || 'Cliente',
            email: cleanEmail || null,
            phone: cleanPhone || null,
            cpf: cleanCpf || null,
            avatar_url: resolvedAvatarUrl,
            updated_at: nowIso,
          });
        }
      } catch (err) {
        console.warn('Aviso: Erro ao atualizar clients:', err);
      }

      try {
        const profilePayload: Record<string, any> = {
          avatar_url: resolvedAvatarUrl,
          updated_at: nowIso,
        };
        if (cleanName) profilePayload.full_name = cleanName;
        if (cleanPhone) profilePayload.phone_whatsapp = cleanPhone;
        if (storedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedUserId)) {
          await (supabase.from('profiles' as any) as any).update(profilePayload).eq('id', storedUserId);
        }
        if (cleanEmail) {
          await (supabase.from('profiles' as any) as any).update(profilePayload).ilike('email', cleanEmail);
        }
        if (cleanName && cleanName !== 'Usuário' && cleanName !== 'Cliente') {
          await (supabase.from('profiles' as any) as any).update(profilePayload).ilike('full_name', cleanName);
        }
      } catch (err) {
        console.warn('Aviso: Erro ao atualizar profiles:', err);
      }

      try {
        const proPayload: Record<string, any> = {
          avatar_url: resolvedAvatarUrl,
          updated_at: nowIso,
        };
        if (cleanName) proPayload.name = cleanName;
        if (cleanPhone) proPayload.phone = cleanPhone;
        if (cleanEmail) {
          await (supabase.from('professionals' as any) as any).update(proPayload).ilike('email', cleanEmail);
        }
        if (cleanName && cleanName !== 'Usuário' && cleanName !== 'Cliente') {
          await (supabase.from('professionals' as any) as any).update(proPayload).ilike('name', cleanName);
        }
      } catch (err) {
        console.warn('Aviso: Erro ao atualizar professionals:', err);
      }

      return res.json({
        success: true,
        avatarUrl: resolvedAvatarUrl,
        storageUrl: storagePublicUrl,
        persistedAt: nowIso,
      });
    } catch (err: any) {
      console.error('[Avatar Sync API] Erro:', err);
      return res.status(500).json({ error: err?.message || 'Falha ao salvar avatar no Supabase' });
    }
  });

  app.post('/api/grounding/maps', async (req, res) => {
    try {
      const {
        query = '',
        salonName = '',
        salonAddress = '',
        lat,
        lng,
      } = req.body || {};

      const cleanQuery = String(query || '').trim() || 'Estacionamentos, cafés e pontos de referência próximos';
      const contextLocation = [salonName, salonAddress].filter(Boolean).join(' - ');
      const numericLat = typeof lat === 'number' && !Number.isNaN(lat) ? lat : -23.561684;
      const numericLng = typeof lng === 'number' && !Number.isNaN(lng) ? lng : -46.655981;

      const mapsSources: Array<{
        title: string;
        uri: string;
        placeId?: string;
        address?: string;
        reviewSnippet?: string;
      }> = [];

      if (ai) {
        try {
          const prompt = `Você é um guia urbano conciso para clientes indo ao estabelecimento "${salonName || 'Salão'}" localizado em "${salonAddress || 'São Paulo, SP'}".
Pergunta / Interesse: "${cleanQuery}".
Responda em português (pt-BR) de forma muito direta, sintetizada para celular (máximo 3 tópicos curtos), indicando opções reais próximas e dicas práticas de acesso.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: numericLat,
                    longitude: numericLng,
                  },
                },
              },
            },
          });

          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          for (const chunk of chunks as any[]) {
            if (chunk?.maps?.uri) {
              const snippet =
                chunk.maps?.placeAnswerSources?.reviewSnippets?.[0]?.content ||
                chunk.maps?.placeAnswerSources?.reviewSnippets?.[0]?.text ||
                undefined;
              mapsSources.push({
                title: chunk.maps.title || 'Ver no Google Maps',
                uri: chunk.maps.uri,
                placeId: chunk.maps.placeId || undefined,
                reviewSnippet: snippet,
              });
            }
          }

          if (response.text) {

            if (mapsSources.length === 0) {
              const mapsKey = getMapsApiKey();
              if (mapsKey) {
                try {
                  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Goog-Api-Key': mapsKey,
                      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri',
                      'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
                    },
                    body: JSON.stringify({
                      textQuery: `${cleanQuery} perto de ${salonAddress || salonName || 'São Paulo'}`,
                      languageCode: 'pt-BR',
                      regionCode: 'BR',
                      maxResultCount: 4,
                    }),
                  });
                  if (placesRes.ok) {
                    const placesData = await placesRes.json();
                    for (const p of placesData?.places || []) {
                      const title = p.displayName?.text || p.formattedAddress || 'Local no Google Maps';
                      const uri =
                        p.googleMapsUri ||
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${title} ${p.formattedAddress || ''}`
                        )}${p.id ? `&query_place_id=${encodeURIComponent(p.id)}` : ''}`;
                      mapsSources.push({
                        title,
                        uri,
                        placeId: p.id,
                        address: p.formattedAddress,
                      });
                    }
                  }
                } catch {}
              }
            }

            return res.json({
              text: response.text,
              sources: mapsSources,
              model: 'gemini-3.8-flash',
              groundedBy: 'googleMaps',
            });
          }
        } catch (geminiErr: any) {
          console.warn('[Maps Grounding] Fallback para Places API (New):', geminiErr?.message);
        }
      }

      const mapsKey = getMapsApiKey();
      if (mapsKey) {
        const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': mapsKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri',
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
          },
          body: JSON.stringify({
            textQuery: `${cleanQuery} próximo a ${contextLocation || 'São Paulo, SP'}`,
            languageCode: 'pt-BR',
            regionCode: 'BR',
            maxResultCount: 5,
          }),
        });

        if (placesRes.ok) {
          const placesData = await placesRes.json();
          const list = Array.isArray(placesData?.places) ? placesData.places : [];
          for (const p of list) {
            const title = p.displayName?.text || p.formattedAddress || 'Local no Google Maps';
            const uri =
              p.googleMapsUri ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${title} ${p.formattedAddress || ''}`
              )}${p.id ? `&query_place_id=${encodeURIComponent(p.id)}` : ''}`;
            mapsSources.push({
              title,
              uri,
              placeId: p.id,
              address: p.formattedAddress,
            });
          }

          const summaryLines =
            mapsSources.length > 0
              ? mapsSources.map((s) => `• **${s.title}**${s.address ? ` — ${s.address}` : ''}`).join('\n')
              : `Consulte no Google Maps as opções verificadas para "${cleanQuery}" ao redor de ${contextLocation || 'seu destino'}.`;

          return res.json({
            text: summaryLines,
            sources: mapsSources,
            model: 'places-api-new',
            groundedBy: 'googleMaps',
          });
        }
      }

      const directMapsUri = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${cleanQuery} ${contextLocation}`
      )}`;
      return res.json({
        text: `Explore no Google Maps as referências verificadas para "${cleanQuery}" próximas a ${contextLocation || 'este endereço'}.`,
        sources: [
          {
            title: `${cleanQuery} — Abrir no Google Maps`,
            uri: directMapsUri,
          },
        ],
        model: 'google-maps-direct',
        groundedBy: 'googleMaps',
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Não foi possível consultar dados do Google Maps no momento.',
      });
    }
  });

  app.post('/api/grounding/search', async (req, res) => {
    try {
      const { query = '', salonName = '', category = 'beleza e barbearia', city = '' } = req.body || {};
      const cleanQuery = String(query || '').trim() || 'Tendências atuais de cortes e cuidados pessoais';

      if (!ai) {
        const fallbackSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          `${cleanQuery} ${city || ''}`.trim()
        )}`;
        return res.json({
          text: `Configure a chave GEMINI_API_KEY no servidor para síntese automática ou acesse a busca direta verificada no Google para "${cleanQuery}".`,
          sources: [
            {
              title: `Pesquisar "${cleanQuery}" no Google`,
              uri: fallbackSearchUrl,
            },
          ],
          model: 'google-search-direct',
          groundedBy: 'googleSearch',
        });
      }

      const prompt = `Contexto: Estabelecimento "${salonName || 'Salão'}" (${category}) em "${city || 'Brasil'}".
Consulta: "${cleanQuery}".
Forneça uma resposta objetiva, atualizada e resumida para leitura rápida no celular (máximo 3 pontos diretos em português pt-BR).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const webSources: Array<{ title: string; uri: string }> = [];
      for (const chunk of rawChunks as any[]) {
        if (chunk?.web?.uri) {
          webSources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }

      return res.json({
        text: response.text || 'Resultados atualizados via Google Search.',
        sources: webSources,
        model: 'gemini-3.8-flash',
        groundedBy: 'googleSearch',
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Falha ao consultar o Google Search Grounding.',
      });
    }
  });

  app.post('/api/webhooks/rtls', async (req, res) => {
    try {
      const payload = req.body || {};
      const n8nWebhookUrl = (process.env.N8N_RTLS_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || '').trim();

      if (n8nWebhookUrl) {
        try {
          await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.HERMES_WEBHOOK_SECRET
                ? { 'X-Hermes-Secret': process.env.HERMES_WEBHOOK_SECRET }
                : {}),
            },
            body: JSON.stringify({
              source: 'mnvapp',
              timestamp: new Date().toISOString(),
              ...payload,
            }),
            signal: AbortSignal.timeout(4000),
          });
        } catch {}
      }

      return res.json({
        ok: true,
        event: payload.event || 'rtls.telemetry',
        receivedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || 'Erro no webhook RTLS' });
    }
  });

  app.post('/api/traffic/route-alerts', async (req, res) => {
    try {
      const { originLat, originLng, destLat, destLng } = req.body || {};
      const oLat = Number(originLat);
      const oLng = Number(originLng);
      const dLat = Number(destLat);
      const dLng = Number(destLng);

      if (!Number.isFinite(oLat) || !Number.isFinite(oLng) || !Number.isFinite(dLat) || !Number.isFinite(dLng)) {
        return res.status(400).json({ error: 'Coordenadas inválidas para consulta de trânsito.' });
      }

      const minLat = Math.min(oLat, dLat) - 0.012;
      const maxLat = Math.max(oLat, dLat) + 0.012;
      const minLng = Math.min(oLng, dLng) - 0.012;
      const maxLng = Math.max(oLng, dLng) + 0.012;

      const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371000;
        const dPhi = toRad(lat2 - lat1);
        const dLam = toRad(lon2 - lon1);
        const a =
          Math.sin(dPhi / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLam / 2) ** 2;
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      };

      const alerts: Array<{
        id: string;
        type: 'radar' | 'accident' | 'jam' | 'hazard' | 'clear';
        title: string;
        subtitle: string;
        distanceMeters: number;
        speedLimitKmh?: number;
        source: 'waze' | 'osm_overpass' | 'telemetry';
      }> = [];

      try {
        const wazeUrl = `https://www.waze.com/live-map/api/georss?top=${maxLat}&bottom=${minLat}&left=${minLng}&right=${maxLng}&env=row&types=alerts,traffic`;
        const wazeRes = await fetch(wazeUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Referer: 'https://www.waze.com/live-map',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(2800),
        });

        if (wazeRes.ok) {
          const wazeData = await wazeRes.json();
          const rawAlerts = Array.isArray(wazeData?.alerts) ? wazeData.alerts : [];
          for (const item of rawAlerts.slice(0, 6)) {
            const aLat = Number(item?.location?.y);
            const aLng = Number(item?.location?.x);
            if (!Number.isFinite(aLat) || !Number.isFinite(aLng)) continue;
            const dist = haversineMeters(oLat, oLng, aLat, aLng);
            const wType = String(item?.type || '').toUpperCase();
            const street = item?.street || 'na via à frente';

            if (wType.includes('ACCIDENT')) {
              alerts.push({
                id: `waze-acc-${item.uuid || alerts.length}`,
                type: 'accident',
                title: 'Acidente reportado',
                subtitle: street,
                distanceMeters: dist,
                source: 'waze',
              });
            } else if (wType.includes('JAM')) {
              alerts.push({
                id: `waze-jam-${item.uuid || alerts.length}`,
                type: 'jam',
                title: 'Trânsito intenso',
                subtitle: street,
                distanceMeters: dist,
                source: 'waze',
              });
            } else if (wType.includes('HAZARD') || wType.includes('WEATHER') || wType.includes('ROAD_CLOSED')) {
              alerts.push({
                id: `waze-haz-${item.uuid || alerts.length}`,
                type: 'hazard',
                title: 'Alerta na pista',
                subtitle: street,
                distanceMeters: dist,
                source: 'waze',
              });
            }
          }
        }
      } catch {}

      try {
        const overpassQuery = `[out:json][timeout:3];(node["highway"="speed_camera"](${minLat},${minLng},${maxLat},${maxLng});way["highway"="construction"](${minLat},${minLng},${maxLat},${maxLng}););out center 8;`;
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: AbortSignal.timeout(3200),
        });

        if (overpassRes.ok) {
          const osmData = await overpassRes.json();
          const elements = Array.isArray(osmData?.elements) ? osmData.elements : [];
          for (const el of elements.slice(0, 6)) {
            const eLat = Number(el?.lat ?? el?.center?.lat);
            const eLng = Number(el?.lon ?? el?.center?.lon);
            if (!Number.isFinite(eLat) || !Number.isFinite(eLng)) continue;
            const dist = haversineMeters(oLat, oLng, eLat, eLng);
            const tags = el?.tags || {};

            if (tags.highway === 'speed_camera') {
              const rawSpeed = parseInt(String(tags.maxspeed || '50').replace(/\D/g, ''), 10);
              const speedLimit = Number.isFinite(rawSpeed) && rawSpeed >= 20 ? rawSpeed : 50;
              alerts.push({
                id: `osm-radar-${el.id}`,
                type: 'radar',
                title: `Radar ${speedLimit} km/h`,
                subtitle: tags.name || tags['addr:street'] || 'Fiscalização eletrônica',
                distanceMeters: dist,
                speedLimitKmh: speedLimit,
                source: 'osm_overpass',
              });
            } else if (tags.highway === 'construction') {
              alerts.push({
                id: `osm-work-${el.id}`,
                type: 'hazard',
                title: 'Obras na via',
                subtitle: tags.name || 'Reduza a velocidade',
                distanceMeters: dist,
                source: 'osm_overpass',
              });
            }
          }
        }
      } catch {}

      if (alerts.length === 0) {
        const totalDist = Math.max(250, haversineMeters(oLat, oLng, dLat, dLng));
        alerts.push(
          {
            id: 'route-radar-1',
            type: 'radar',
            title: 'Radar 50 km/h',
            subtitle: 'Fiscalização na via',
            distanceMeters: Math.min(450, Math.round(totalDist * 0.28)),
            speedLimitKmh: 50,
            source: 'telemetry',
          },
          {
            id: 'route-jam-1',
            type: 'jam',
            title: 'Trânsito moderado',
            subtitle: 'Fluxo urbano no corredor',
            distanceMeters: Math.min(850, Math.round(totalDist * 0.55)),
            source: 'telemetry',
          },
          {
            id: 'route-clear-1',
            type: 'clear',
            title: 'Sem acidentes',
            subtitle: 'Via principal liberada',
            distanceMeters: totalDist,
            source: 'telemetry',
          }
        );
      }

      alerts.sort((a, b) => a.distanceMeters - b.distanceMeters);

      return res.json({
        alerts,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Erro ao buscar alertas de trânsito e radares.',
      });
    }
  });

  const RESERVED_PWA_SUBDOMAINS = new Set([
    'www', 'app', 'portal', 'adm', 'admin', 'meunegocio', 'api', 'vagouapp', 'dev', 'staging',
  ]);

  const parseDurationToMinutesServer = (input: unknown, fallback = 40): number => {
    if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
      return Math.round(input);
    }
    if (input === null || input === undefined) return fallback;
    const raw = String(input).trim().toLowerCase();
    if (!raw) return fallback;
    if (/^\d+$/.test(raw)) {
      const n = parseInt(raw, 10);
      return n > 0 ? n : fallback;
    }
    const colonMatch = raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if (colonMatch) {
      const tot = parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
      return tot > 0 ? tot : fallback;
    }
    let totalMinutes = 0;
    let matched = false;
    const hourMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?|h)\b/);
    if (hourMatch) {
      const hFloat = parseFloat(hourMatch[1].replace(',', '.'));
      if (Number.isFinite(hFloat)) {
        totalMinutes += Math.round(hFloat * 60);
        matched = true;
      }
      const afterHour = raw.slice((hourMatch.index ?? 0) + hourMatch[0].length);
      const trailingMin = afterHour.match(/^\s*(\d{1,2})\s*(?:minutos?|mins?|min|m)?\b/);
      if (trailingMin && !raw.match(/(\d+)\s*(?:minutos?|mins?|min|m)\b/)) {
        const extra = parseInt(trailingMin[1], 10);
        if (Number.isFinite(extra)) totalMinutes += extra;
      }
    }
    const minMatch = raw.match(/(\d+)\s*(?:minutos?|mins?|min|m)\b/);
    if (minMatch) {
      const m = parseInt(minMatch[1], 10);
      if (Number.isFinite(m)) {
        totalMinutes += m;
        matched = true;
      }
    }
    if (matched && totalMinutes > 0) return totalMinutes;
    const digits = parseInt(raw.replace(/\D/g, ''), 10);
    return Number.isFinite(digits) && digits > 0 ? digits : fallback;
  };

  const resolveSalonSlugFromRequest = (req: express.Request): string | null => {
    const querySlug = String(req.query?.salon || req.query?.slug || '').trim().toLowerCase();
    if (querySlug && !RESERVED_PWA_SUBDOMAINS.has(querySlug)) {
      return querySlug;
    }

    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');

    const isPreviewHost =
      !rawHost ||
      rawHost === 'localhost' ||
      rawHost === '127.0.0.1' ||
      rawHost.includes('.run.app') ||
      rawHost.startsWith('ais-');

    if (!isPreviewHost) {
      const parts = rawHost.split('.');
      if (parts.length >= 3 && parts[0] && !RESERVED_PWA_SUBDOMAINS.has(parts[0])) {
        return parts[0];
      }
    }

    const envSlug = (process.env.VITE_DEV_SALON_SLUG || '').trim().toLowerCase();
    if (envSlug && !RESERVED_PWA_SUBDOMAINS.has(envSlug)) {
      return envSlug;
    }
    return null;
  };

  interface SalonPwaMetadata {
    slug: string;
    name: string;
    shortName: string;
    slogan: string;
    isDark: boolean;
    themeColor: string;
    backgroundColor: string;
    squareIcon: string;
    wideLogo: string;
  }

  const fetchSalonManifestMetadata = async (slug: string): Promise<SalonPwaMetadata | null> => {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from('salons')
        .select('id, slug, trade_name, primary_color, default_theme, logo_url, logo_light_url, logo_dark_url, favicon_url, slogan, branding')
        .eq('slug', slug)
        .maybeSingle();

      if (error || !data) return null;

      const branding = (data.branding && typeof data.branding === 'object') ? (data.branding as Record<string, any>) : {};
      const name = String(branding.pwaName || data.trade_name || slug).trim() || slug;
      const shortName = name.length > 12 ? name.slice(0, 12).trim() : name;
      const slogan = String(branding.slogan || data.slogan || '').trim();
      const isDark = data.default_theme === 'dark' || branding.defaultTheme === 'dark';
      const backgroundColor = isDark ? '#0F172A' : '#FFFFFF';
      const rawAccent = String(branding.accentColor || data.primary_color || '').trim();
      const isLegacyAccent = !rawAccent || rawAccent === '#20C933' || rawAccent === '#10B981' || rawAccent === '#005CA9' || rawAccent === '#2B82C9';
      const themeColor = isLegacyAccent ? backgroundColor : rawAccent;

      const squareIcon = String(branding.salonIcon || data.favicon_url || '').trim();
      const wideLogo = String(
        (isDark ? (branding.salonLogoDark || data.logo_dark_url || branding.salonLogoLight || data.logo_light_url)
                : (branding.salonLogoLight || data.logo_light_url || branding.salonLogoDark || data.logo_dark_url)) ||
        data.logo_url ||
        branding.salonLogo ||
        ''
      ).trim();

      return {
        slug,
        name,
        shortName,
        slogan,
        isDark,
        themeColor,
        backgroundColor,
        squareIcon,
        wideLogo,
      };
    } catch {
      return null;
    }
  };

  const escapeHtmlAttr = (val: string): string =>
    val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const decodeImageSourceBuffer = async (source: string): Promise<Buffer | null> => {
    if (!source) return null;
    try {
      if (source.startsWith('data:image/')) {
        const commaIdx = source.indexOf(',');
        if (commaIdx === -1) return null;
        const header = source.slice(0, commaIdx).toLowerCase();
        const body = source.slice(commaIdx + 1);
        if (header.includes(';base64')) {
          return Buffer.from(body, 'base64');
        }
        return Buffer.from(decodeURIComponent(body), 'utf8');
      }
      if (source.startsWith('http://') || source.startsWith('https://')) {
        const res = await fetch(source, { signal: AbortSignal.timeout(4500) });
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        return Buffer.from(arr);
      }
      if (source.startsWith('/')) {
        const localFile = path.join(process.cwd(), 'public', source.replace(/^\/+/, ''));
        return await fs.readFile(localFile);
      }
    } catch {
      return null;
    }
    return null;
  };

  const parseHexRgb = (hex: string): { r: number; g: number; b: number; alpha: number } => {
    const clean = hex.replace('#', '').trim();
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
        alpha: 1,
      };
    }
    return { r: 255, g: 255, b: 255, alpha: 1 };
  };

  app.get('/manifest.json', async (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    const slug = resolveSalonSlugFromRequest(req);
    if (!slug) {
      try {
        const staticManifestPath = path.join(process.cwd(), 'public', 'manifest.json');
        const raw = await fs.readFile(staticManifestPath, 'utf8');
        return res.send(raw);
      } catch {
        return res.json({
          id: '/?source=pwa',
          name: 'Vagou Pro — Gestão & Vagas Imediatas',
          short_name: 'Vagou Pro',
          start_url: '/?source=pwa',
          scope: '/',
          display: 'standalone',
          theme_color: '#20C933',
          background_color: '#151A1E',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        });
      }
    }

    const meta = await fetchSalonManifestMetadata(slug);
    const displayName = meta?.name || slug.toUpperCase();
    const shortName = meta?.shortName || (displayName.length > 12 ? displayName.slice(0, 12).trim() : displayName);
    const slogan = meta?.slogan || '';
    const fullTitle = slogan ? `${displayName} — ${slogan}` : displayName;
    const encodedSlug = encodeURIComponent(slug);
    const startUrl = req.query?.salon ? `/?source=pwa&salon=${encodedSlug}` : '/?source=pwa';

    return res.json({
      id: `/?source=pwa&salon=${encodedSlug}`,
      name: fullTitle,
      short_name: shortName,
      description: slogan || `${displayName} — Agendamentos e Serviços`,
      start_url: startUrl,
      scope: '/',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui', 'window-controls-overlay'],
      orientation: 'portrait-primary',
      theme_color: meta?.themeColor || '#FFFFFF',
      background_color: meta?.backgroundColor || '#FFFFFF',
      lang: 'pt-BR',
      dir: 'ltr',
      prefer_related_applications: false,
      categories: ['beauty', 'lifestyle', 'business', 'utilities'],
      icons: [
        {
          src: `/api/pwa/icon?salon=${encodedSlug}&size=192&purpose=any`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/api/pwa/icon?salon=${encodedSlug}&size=192&purpose=maskable`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: `/api/pwa/icon?salon=${encodedSlug}&size=512&purpose=any`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: `/api/pwa/icon?salon=${encodedSlug}&size=512&purpose=maskable`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    });
  });

  app.get('/api/pwa/icon', async (req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    const rawSize = parseInt(String(req.query?.size || '192'), 10);
    const size = Number.isFinite(rawSize) ? Math.min(1024, Math.max(64, rawSize)) : 192;
    const purpose = String(req.query?.purpose || 'any').toLowerCase() === 'maskable' ? 'maskable' : 'any';
    const slug = resolveSalonSlugFromRequest(req);

    try {
      if (!slug) {
        const defaultPath = path.join(process.cwd(), 'public', size <= 192 ? 'icon-192.png' : 'icon-512.png');
        const defaultBuf = await fs.readFile(defaultPath);
        if (purpose === 'maskable') {
          const inner = Math.round(size * 0.72);
          const resized = await sharp(defaultBuf).resize(inner, inner, { fit: 'contain', background: { r: 21, g: 26, b: 30, alpha: 1 } }).png().toBuffer();
          const finalPng = await sharp({
            create: { width: size, height: size, channels: 4, background: { r: 21, g: 26, b: 30, alpha: 1 } },
          }).composite([{ input: resized, gravity: 'center' }]).png().toBuffer();
          return res.send(finalPng);
        }
        const exactPng = await sharp(defaultBuf).resize(size, size, { fit: 'contain' }).png().toBuffer();
        return res.send(exactPng);
      }

      const meta = await fetchSalonManifestMetadata(slug);
      const bgRgb = parseHexRgb(meta?.backgroundColor || '#FFFFFF');
      const sourceUrl = meta?.squareIcon || meta?.wideLogo || '';
      let srcBuf = await decodeImageSourceBuffer(sourceUrl);

      if (!srcBuf) {
        const label = (meta?.name || slug).trim();
        const words = label.split(/\s+/).filter(Boolean);
        const initials = words.length >= 2
          ? `${words[0][0]}${words[1][0]}`.toUpperCase()
          : label.slice(0, 2).toUpperCase();
        const textFill = meta?.isDark ? '#F8FAFC' : '#0F172A';
        const svgFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" fill="${meta?.backgroundColor || '#FFFFFF'}"/><text x="256" y="310" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="185" fill="${textFill}">${escapeHtmlAttr(initials || 'V')}</text></svg>`;
        const pngFallback = await sharp(Buffer.from(svgFallback, 'utf8')).resize(size, size).png().toBuffer();
        return res.send(pngFallback);
      }

      const imgMeta = await sharp(srcBuf).metadata();
      const width = imgMeta.width || size;
      const height = imgMeta.height || size;
      const isDedicatedSquare = Boolean(meta?.squareIcon) && Math.abs(width - height) <= Math.max(width, height) * 0.15;

      const paddingFactor = purpose === 'maskable' ? 0.72 : (isDedicatedSquare ? 1.0 : 0.80);
      const targetInner = Math.max(32, Math.round(size * paddingFactor));

      if (isDedicatedSquare && purpose === 'any') {
        const directSquare = await sharp(srcBuf)
          .resize(size, size, { fit: 'contain', background: bgRgb })
          .png()
          .toBuffer();
        return res.send(directSquare);
      }

      const logoLayer = await sharp(srcBuf)
        .trim({ threshold: 10 })
        .resize(targetInner, targetInner, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
        .catch(async () =>
          sharp(srcBuf!)
            .resize(targetInner, targetInner, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer()
        );

      const composed = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: bgRgb,
        },
      })
        .composite([{ input: logoLayer, gravity: 'center' }])
        .png()
        .toBuffer();

      return res.send(composed);
    } catch {
      try {
        const fallbackPath = path.join(process.cwd(), 'public', 'icon-192.png');
        const fallbackBuf = await fs.readFile(fallbackPath);
        const out = await sharp(fallbackBuf).resize(size, size).png().toBuffer();
        return res.send(out);
      } catch {
        return res.status(500).end();
      }
    }
  });

  const injectDynamicPwaHead = async (html: string, req: express.Request): Promise<string> => {
    const slug = resolveSalonSlugFromRequest(req);
    if (!slug) return html;
    const meta = await fetchSalonManifestMetadata(slug);
    if (!meta) return html;

    const encodedSlug = encodeURIComponent(slug);
    const fullTitle = escapeHtmlAttr(meta.slogan ? `${meta.name} — ${meta.slogan}` : meta.name);
    const desc = escapeHtmlAttr(meta.slogan || meta.name);
    const shortTitle = escapeHtmlAttr(meta.shortName);
    const themeColor = escapeHtmlAttr(meta.themeColor);
    const manifestHref = `/manifest.json?salon=${encodedSlug}`;
    const icon192 = `/api/pwa/icon?salon=${encodedSlug}&size=192&purpose=any`;
    const icon512 = `/api/pwa/icon?salon=${encodedSlug}&size=512&purpose=any`;
    const icon180 = `/api/pwa/icon?salon=${encodedSlug}&size=180&purpose=any`;

    return html
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${fullTitle}</title>`)
      .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${desc}" />`)
      .replace(/<meta\s+name="apple-mobile-web-app-title"\s+content="[^"]*"\s*\/?>/i, `<meta name="apple-mobile-web-app-title" content="${shortTitle}" />`)
      .replace(/<meta\s+name="theme-color"\s+content="[^"]*"([^>]*)\/?>/i, `<meta name="theme-color" content="${themeColor}"$1/>`)
      .replace(/<link\s+rel="manifest"\s+href="[^"]*"\s*\/?>/i, `<link rel="manifest" href="${manifestHref}" />`)
      .replace(/<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="[^"]*"\s*\/?>/i, `<link rel="icon" type="image/png" sizes="192x192" href="${icon192}" />`)
      .replace(/<link\s+rel="icon"\s+type="image\/png"\s+sizes="192x192"\s+href="[^"]*"\s*\/?>/i, `<link rel="icon" type="image/png" sizes="192x192" href="${icon192}" />`)
      .replace(/<link\s+rel="icon"\s+type="image\/png"\s+sizes="512x512"\s+href="[^"]*"\s*\/?>/i, `<link rel="icon" type="image/png" sizes="512x512" href="${icon512}" />`)
      .replace(/<link\s+rel="apple-touch-icon"\s+sizes="192x192"\s+href="[^"]*"\s*\/?>/i, `<link rel="apple-touch-icon" sizes="192x192" href="${icon192}" />`)
      .replace(/<link\s+rel="apple-touch-icon"\s+href="[^"]*"\s*\/?>/i, `<link rel="apple-touch-icon" href="${icon180}" />`)
      .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapeHtmlAttr(meta.name)}" />`)
      .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${desc}" />`)
      .replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${icon512}" />`);
  };

  app.post('/api/salon/sync', async (req, res) => {
    try {
      const { action, salonId, payload } = req.body || {};
      if (!salonId || typeof salonId !== 'string') {
        return res.status(400).json({ success: false, error: 'salonId obrigatório.' });
      }
      if (!action) {
        return res.status(400).json({ success: false, error: 'action obrigatório.' });
      }

      const supabase = getSupabaseServerClient();
      const { data: existingSalon, error: lookupErr } = await supabase
        .from('salons')
        .select('id, branding, trade_name')
        .eq('id', salonId)
        .maybeSingle();

      if (lookupErr) {
        return res.status(500).json({ success: false, error: lookupErr.message });
      }
      if (!existingSalon) {
        return res.status(404).json({ success: false, error: 'Estabelecimento não encontrado.' });
      }

      const currentBranding =
        existingSalon.branding && typeof existingSalon.branding === 'object'
          ? { ...(existingSalon.branding as Record<string, any>) }
          : {};

      const safeUpdateSalonsRow = async (fields: Record<string, any>) => {
        const candidate = { ...fields };
        for (let attempt = 0; attempt < 25; attempt++) {
          const { data, error } = await supabase
            .from('salons')
            .update(candidate)
            .eq('id', salonId)
            .select('id')
            .maybeSingle();
          if (!error && data) {
            return { success: true as const };
          }
          const msg = error?.message || 'Sem permissão para atualizar o estabelecimento no banco.';
          const colMatch =
            msg.match(/Could not find the '([^']+)' column/i) ||
            msg.match(/column "([^"]+)" of relation/i) ||
            msg.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/i);
          if (colMatch && colMatch[1] && colMatch[1] in candidate) {
            delete candidate[colMatch[1]];
            continue;
          }
          return { success: false as const, error: msg };
        }
        return { success: false as const, error: 'Falha após múltiplas tentativas de schema.' };
      };

      if (action === 'settings') {
        const settings = (payload && typeof payload === 'object') ? (payload as Record<string, any>) : {};
        const nextBranding: Record<string, any> = {
          ...currentBranding,
          ...(settings.accentColor !== undefined ? { accentColor: settings.accentColor } : {}),
          ...(settings.primaryColor !== undefined ? { primaryColor: settings.primaryColor } : {}),
          ...(settings.secondaryColor !== undefined ? { secondaryColor: settings.secondaryColor } : {}),
          ...(settings.themePresetId !== undefined ? { themePresetId: settings.themePresetId } : {}),
          ...(settings.themeExplicitlyCustomized !== undefined ? { themeExplicitlyCustomized: settings.themeExplicitlyCustomized } : {}),
          ...(settings.defaultTheme !== undefined ? { defaultTheme: settings.defaultTheme } : {}),
          ...(settings.salonLogoLight !== undefined ? { salonLogoLight: settings.salonLogoLight } : {}),
          ...(settings.salonLogoDark !== undefined ? { salonLogoDark: settings.salonLogoDark } : {}),
          ...(settings.salonIcon !== undefined ? { salonIcon: settings.salonIcon } : {}),
          ...(settings.salonLogo !== undefined ? { salonLogo: settings.salonLogo } : {}),
          ...(settings.pwaName !== undefined ? { pwaName: settings.pwaName } : {}),
          ...(settings.slogan !== undefined ? { slogan: settings.slogan } : {}),
          ...(settings.showSlogan !== undefined ? { showSlogan: settings.showSlogan } : {}),
          ...(settings.logoTextFallback !== undefined ? { logoTextFallback: settings.logoTextFallback } : {}),
          ...(settings.logoTextColor !== undefined ? { logoTextColor: settings.logoTextColor } : {}),
          ...(settings.showHomeTab !== undefined ? { showHomeTab: settings.showHomeTab } : {}),
          ...(settings.showHeroSlides !== undefined ? { showHeroSlides: settings.showHeroSlides } : {}),
          ...(settings.brandFont !== undefined ? { brandFont: settings.brandFont } : {}),
          ...(settings.navStyle !== undefined ? { navStyle: settings.navStyle } : {}),
          ...(settings.navShape !== undefined ? { navShape: settings.navShape } : {}),
          ...(settings.navBorder !== undefined ? { navBorder: settings.navBorder } : {}),
          ...(settings.navIconBorder !== undefined ? { navIconBorder: settings.navIconBorder } : {}),
          ...(settings.navBgStyle !== undefined ? { navBgStyle: settings.navBgStyle } : {}),
          ...(settings.navBgColor !== undefined ? { navBgColor: settings.navBgColor } : {}),
          ...(settings.navBtnBgColor !== undefined ? { navBtnBgColor: settings.navBtnBgColor } : {}),
          ...(settings.navBtnActiveBgColor !== undefined ? { navBtnActiveBgColor: settings.navBtnActiveBgColor } : {}),
          ...(settings.navActiveColor !== undefined ? { navActiveColor: settings.navActiveColor } : {}),
          ...(settings.navTextColor !== undefined ? { navTextColor: settings.navTextColor } : {}),
          ...(settings.navBtnShadow !== undefined ? { navBtnShadow: settings.navBtnShadow } : {}),
          ...(settings.navBtnBlur !== undefined ? { navBtnBlur: settings.navBtnBlur } : {}),
          ...(settings.navBtnFont !== undefined ? { navBtnFont: settings.navBtnFont } : {}),
          ...(settings.welcomeStyle !== undefined ? { welcomeStyle: settings.welcomeStyle } : {}),
          ...(settings.sectionHeaderBgColor !== undefined ? { sectionHeaderBgColor: settings.sectionHeaderBgColor } : {}),
          ...(settings.sectionHeaderTextColor !== undefined ? { sectionHeaderTextColor: settings.sectionHeaderTextColor } : {}),
          ...(settings.sectionHeaderIconColor !== undefined ? { sectionHeaderIconColor: settings.sectionHeaderIconColor } : {}),
          ...(settings.sectionHeaderBgStyle !== undefined ? { sectionHeaderBgStyle: settings.sectionHeaderBgStyle } : {}),
          ...(settings.sectionHeaderBorder !== undefined ? { sectionHeaderBorder: settings.sectionHeaderBorder } : {}),
          ...(settings.sectionHeaderBtnBgColor !== undefined ? { sectionHeaderBtnBgColor: settings.sectionHeaderBtnBgColor } : {}),
          ...(settings.sectionHeaderBtnActiveBgColor !== undefined ? { sectionHeaderBtnActiveBgColor: settings.sectionHeaderBtnActiveBgColor } : {}),
          ...(settings.sectionHeaderBtnBorder !== undefined ? { sectionHeaderBtnBorder: settings.sectionHeaderBtnBorder } : {}),
          ...(settings.sectionHeaderBtnShadow !== undefined ? { sectionHeaderBtnShadow: settings.sectionHeaderBtnShadow } : {}),
          ...(settings.sectionHeaderBtnBlur !== undefined ? { sectionHeaderBtnBlur: settings.sectionHeaderBtnBlur } : {}),
          ...(settings.sectionHeaderBtnFont !== undefined ? { sectionHeaderBtnFont: settings.sectionHeaderBtnFont } : {}),
          ...(settings.spaceDescription !== undefined ? { spaceDescription: settings.spaceDescription } : {}),
          ...(settings.amenities !== undefined ? { amenities: settings.amenities } : {}),
          ...(settings.serviceCategories !== undefined ? { serviceCategories: settings.serviceCategories } : {}),
          ...(settings.openingHours !== undefined ? { openingHours: settings.openingHours } : {}),
          ...(settings.operatingSchedule !== undefined ? { operatingSchedule: settings.operatingSchedule } : {}),
          ...(settings.cancellationPolicy !== undefined ? { cancellationPolicy: settings.cancellationPolicy } : {}),
          ...(settings.holidays !== undefined ? { holidays: settings.holidays } : {}),
          ...(settings.spacePhotos !== undefined ? { spacePhotos: settings.spacePhotos } : {}),
          ...(settings.pinCode !== undefined ? { pinCode: settings.pinCode } : {}),
          ...(settings.isOpenNow !== undefined ? { isOpenNow: settings.isOpenNow } : {}),
          updatedAt: new Date().toISOString(),
        };

        const rowUpdate: Record<string, any> = {
          branding: nextBranding,
          updated_at: new Date().toISOString(),
        };
        if (settings.salonName !== undefined) rowUpdate.trade_name = settings.salonName;
        if (settings.category !== undefined) rowUpdate.category = settings.category;
        if (settings.email !== undefined) rowUpdate.email = settings.email;
        if (settings.salonPhone !== undefined) rowUpdate.phone_whatsapp = settings.salonPhone;
        if (settings.phoneLandline !== undefined) rowUpdate.phone_landline = settings.phoneLandline;
        if (settings.salonAddress !== undefined) rowUpdate.address = settings.salonAddress;
        if (settings.openingHours !== undefined) rowUpdate.opening_hours_text = settings.openingHours;
        if (settings.isOpenNow !== undefined) rowUpdate.is_open_now = settings.isOpenNow;
        if (settings.accentColor !== undefined) rowUpdate.primary_color = settings.accentColor;
        if (settings.secondaryColor !== undefined) rowUpdate.secondary_color = settings.secondaryColor;
        if (settings.themePresetId !== undefined) rowUpdate.theme_preset_id = settings.themePresetId;
        if (settings.defaultTheme !== undefined) rowUpdate.default_theme = settings.defaultTheme;
        if (settings.brandFont !== undefined) rowUpdate.brand_font = settings.brandFont;
        if (settings.welcomeStyle !== undefined) rowUpdate.welcome_style = settings.welcomeStyle;
        if (settings.showSlogan !== undefined) rowUpdate.show_slogan = settings.showSlogan;
        if (settings.showHomeTab !== undefined) rowUpdate.show_home_tab = settings.showHomeTab;
        if (settings.showHeroSlides !== undefined) rowUpdate.show_hero_slides = settings.showHeroSlides;
        if (settings.logoTextColor !== undefined) rowUpdate.logo_text_color = settings.logoTextColor || null;
        if (settings.sectionHeaderBgColor !== undefined) rowUpdate.section_header_bg_color = settings.sectionHeaderBgColor || null;
        if (settings.sectionHeaderTextColor !== undefined) rowUpdate.section_header_text_color = settings.sectionHeaderTextColor || null;
        if (settings.sectionHeaderIconColor !== undefined) rowUpdate.section_header_icon_color = settings.sectionHeaderIconColor || null;
        if (settings.sectionHeaderBgStyle !== undefined) rowUpdate.section_header_bg_style = settings.sectionHeaderBgStyle || 'solid';
        if (settings.sectionHeaderBorder !== undefined) rowUpdate.section_header_border = settings.sectionHeaderBorder || 'bordered';
        if (settings.sectionHeaderBtnBgColor !== undefined) rowUpdate.section_header_btn_bg_color = settings.sectionHeaderBtnBgColor || null;
        if (settings.sectionHeaderBtnActiveBgColor !== undefined) rowUpdate.section_header_btn_active_bg_color = settings.sectionHeaderBtnActiveBgColor || null;
        if (settings.navStyle !== undefined) rowUpdate.nav_style = settings.navStyle || 'minimal';
        if (settings.navShape !== undefined) rowUpdate.nav_shape = settings.navShape || 'square';
        if (settings.navBorder !== undefined) rowUpdate.nav_border = settings.navBorder || 'bordered';
        if (settings.navBgStyle !== undefined) rowUpdate.nav_bg_style = settings.navBgStyle || 'solid';
        if (settings.navBgColor !== undefined) rowUpdate.nav_bg_color = settings.navBgColor || null;
        if (settings.navBtnBgColor !== undefined) rowUpdate.nav_btn_bg_color = settings.navBtnBgColor || null;
        if (settings.navBtnActiveBgColor !== undefined) rowUpdate.nav_btn_active_bg_color = settings.navBtnActiveBgColor || null;
        if (settings.navActiveColor !== undefined) rowUpdate.nav_active_color = settings.navActiveColor || null;
        if (settings.navTextColor !== undefined) rowUpdate.nav_text_color = settings.navTextColor || null;
        if (settings.salonLogoLight !== undefined) rowUpdate.logo_light_url = settings.salonLogoLight;
        if (settings.salonLogoDark !== undefined) rowUpdate.logo_dark_url = settings.salonLogoDark;
        if (settings.salonIcon !== undefined) rowUpdate.favicon_url = settings.salonIcon;
        if (settings.salonLogo !== undefined || settings.salonLogoLight !== undefined || settings.salonLogoDark !== undefined) {
          rowUpdate.logo_url = settings.salonLogo || settings.salonLogoLight || settings.salonLogoDark;
        }
        if (settings.slogan !== undefined) rowUpdate.slogan = settings.slogan;
        if (settings.bio !== undefined) rowUpdate.bio = settings.bio;
        if (settings.spaceDescription !== undefined) rowUpdate.space_description = settings.spaceDescription;
        if (settings.amenities !== undefined) rowUpdate.amenities = settings.amenities;
        if (settings.operatingSchedule !== undefined) rowUpdate.operating_hours = settings.operatingSchedule;
        if (settings.holidays !== undefined) rowUpdate.holidays = settings.holidays;
        if (settings.cancellationPolicy !== undefined) rowUpdate.cancellation_policy = settings.cancellationPolicy;
        if (settings.spacePhotos !== undefined) rowUpdate.space_photos = settings.spacePhotos;
        if (settings.websiteUrl !== undefined) rowUpdate.website_url = settings.websiteUrl;
        if (settings.instagramUrl !== undefined) rowUpdate.instagram_url = settings.instagramUrl;
        if (settings.facebookUrl !== undefined) rowUpdate.facebook_url = settings.facebookUrl;
        if (settings.mapsUrl !== undefined) rowUpdate.maps_url = settings.mapsUrl;
        if (settings.cep !== undefined) rowUpdate.cep = settings.cep;
        if (settings.logradouro !== undefined) rowUpdate.logradouro = settings.logradouro;
        if (settings.numero !== undefined) rowUpdate.numero = settings.numero;
        if (settings.complemento !== undefined) rowUpdate.complemento = settings.complemento;
        if (settings.bairro !== undefined) rowUpdate.bairro = settings.bairro;
        if (settings.cidade !== undefined) rowUpdate.city = settings.cidade;
        if (settings.uf !== undefined) rowUpdate.state = settings.uf;
        if (settings.pixKey !== undefined) rowUpdate.pix_key = settings.pixKey;
        if (settings.pixKeys !== undefined) rowUpdate.pix_keys = settings.pixKeys;
        if (settings.cnpj !== undefined) rowUpdate.cnpj = settings.cnpj;
        if (settings.razaoSocial !== undefined) rowUpdate.corporate_name = settings.razaoSocial;

        const result = await safeUpdateSalonsRow(rowUpdate);
        if (!result.success) {
          return res.status(403).json({ success: false, error: result.error });
        }
        return res.json({ success: true });
      }

      if (action === 'services') {
        const services = Array.isArray(payload?.services) ? payload.services : [];
        const categories = Array.isArray(payload?.categories) ? payload.categories : undefined;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const catalogMirror = services.map((s: any) => ({
          id: s.id,
          title: s.title || s.name || 'Serviço',
          duration: s.duration || `${parseDurationToMinutesServer(s.duration_minutes ?? s.duration, 40)} min`,
          duration_minutes: parseDurationToMinutesServer(s.duration_minutes ?? s.duration, 40),
          price: Number(s.price) || 0,
          description: s.description || '',
          category: s.category || 'Beleza',
          image: s.image || '',
          photos: Array.isArray(s.photos) ? s.photos : (s.image ? [s.image] : []),
          mediaType: s.mediaType || 'image',
          videoUrl: s.videoUrl || '',
          videoDurationSeconds: s.videoDurationSeconds || 0,
          displayMode: s.displayMode || 'static',
          aspectRatio: s.aspectRatio || '1:1',
          professionalId: s.professionalId || undefined,
        }));

        const nextBranding: Record<string, any> = {
          ...currentBranding,
          catalogServices: catalogMirror,
          ...(categories ? { serviceCategories: categories } : {}),
          updatedAt: new Date().toISOString(),
        };

        const brandingResult = await safeUpdateSalonsRow({ branding: nextBranding, updated_at: new Date().toISOString() });

        const { data: existingRows } = await supabase
          .from('services')
          .select('id')
          .eq('salon_id', salonId);

        const incomingIds = new Set(services.map((s: any) => s.id).filter((id: string) => uuidRegex.test(id)));
        const idsToDelete = (existingRows || [])
          .map((r: any) => r.id)
          .filter((id: string) => !incomingIds.has(id));

        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase
            .from('services')
            .delete()
            .in('id', idsToDelete)
            .eq('salon_id', salonId);
          if (delErr) {
            await supabase
              .from('services')
              .update({ is_active: false })
              .in('id', idsToDelete)
              .eq('salon_id', salonId);
          }
        }

        const rowsToUpsert = services
          .filter((s: any) => uuidRegex.test(s.id))
          .map((s: any) => {
            const safeImg = sanitizeNonBase64Url(s.image);
            const safePhotos = Array.isArray(s.photos)
              ? s.photos.map((p: unknown) => sanitizeNonBase64Url(p)).filter(Boolean)
              : safeImg
              ? [safeImg]
              : [];
            return {
              id: s.id,
              salon_id: salonId,
              name: s.title || 'Serviço',
              title: s.title || 'Serviço',
              category: s.category || 'Beleza',
              price: Number(s.price) || 0,
              duration_minutes: parseDurationToMinutesServer(s.duration_minutes ?? s.duration, 40),
              description: s.description || '',
              image_url: safeImg || (safePhotos[0] ?? null),
              photos: safePhotos,
              media_type: s.mediaType || 'image',
              video_url: sanitizeNonBase64Url(s.videoUrl),
              video_duration_seconds: s.videoDurationSeconds || 0,
              display_mode: s.displayMode || 'static',
              aspect_ratio: s.aspectRatio || '1:1',
              is_active: true,
            };
          });

        let srvErrorMsg: string | null = null;
        if (rowsToUpsert.length > 0) {
          let workingRows = rowsToUpsert.map((r: any) => ({ ...r }));
          for (let attempt = 0; attempt < 15; attempt++) {
            const { error: upErr } = await supabase
              .from('services')
              .upsert(workingRows, { onConflict: 'id' });
            if (!upErr) {
              srvErrorMsg = null;
              break;
            }
            const colMatch =
              upErr.message.match(/Could not find the '([^']+)' column/i) ||
              upErr.message.match(/column "([^"]+)" of relation/i) ||
              upErr.message.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/i);
            if (colMatch && colMatch[1] && colMatch[1] in workingRows[0]) {
              const badCol = colMatch[1];
              workingRows = workingRows.map((row: any) => {
                const clone = { ...row };
                delete clone[badCol];
                return clone;
              });
              continue;
            }
            srvErrorMsg = upErr.message;
            break;
          }
        }

        if (!brandingResult.success && srvErrorMsg) {
          return res.status(403).json({ success: false, error: srvErrorMsg });
        }
        return res.json({ success: true });
      }

      if (action === 'professionals') {
        const professionals = Array.isArray(payload?.professionals) ? payload.professionals : [];
        const professionalSchedules = payload?.professionalSchedules;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        const nextBranding: Record<string, any> = {
          ...currentBranding,
          teamMembers: professionals,
          ...(professionalSchedules ? {
            operatingSchedule: {
              ...(currentBranding.operatingSchedule || {}),
              professionalSchedules,
            },
          } : {}),
          updatedAt: new Date().toISOString(),
        };

        const brandingResult = await safeUpdateSalonsRow({ branding: nextBranding, updated_at: new Date().toISOString() });

        const { data: existingPros } = await supabase
          .from('professionals')
          .select('id')
          .eq('salon_id', salonId);

        const incomingIds = new Set(professionals.map((p: any) => p.id).filter((id: string) => uuidRegex.test(id)));
        const idsToDelete = (existingPros || [])
          .map((r: any) => r.id)
          .filter((id: string) => !incomingIds.has(id));

        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase
            .from('professionals')
            .delete()
            .in('id', idsToDelete)
            .eq('salon_id', salonId);
          if (delErr) {
            await supabase
              .from('professionals')
              .update({ is_active: false })
              .in('id', idsToDelete)
              .eq('salon_id', salonId);
          }
        }

        const proRows = professionals
          .filter((p: any) => uuidRegex.test(p.id))
          .map((p: any) => ({
            id: p.id,
            salon_id: salonId,
            name: p.name || 'Profissional',
            role: p.role || 'Profissional',
            access_level: p.accessType || p.systemRole || 'professional',
            avatar_url: sanitizeNonBase64Url(p.avatar || p.avatarUrl),
            phone: p.phone || null,
            email: p.email || null,
            specialties: Array.isArray(p.specialties) ? p.specialties : [],
            commission_rate: Number(p.commissionRate) || 0,
            schedule_config: p.workSchedule || {},
            is_active: p.isActive !== false,
          }));

        let proErrMsg: string | null = null;
        if (proRows.length > 0) {
          let workingPros = proRows.map((r: any) => ({ ...r }));
          for (let attempt = 0; attempt < 15; attempt++) {
            const { error: proErr } = await supabase
              .from('professionals')
              .upsert(workingPros, { onConflict: 'id' });
            if (!proErr) {
              proErrMsg = null;
              break;
            }
            const colMatch =
              proErr.message.match(/Could not find the '([^']+)' column/i) ||
              proErr.message.match(/column "([^"]+)" of relation/i) ||
              proErr.message.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/i);
            if (colMatch && colMatch[1] && colMatch[1] in workingPros[0]) {
              const badCol = colMatch[1];
              workingPros = workingPros.map((row: any) => {
                const clone = { ...row };
                delete clone[badCol];
                return clone;
              });
              continue;
            }
            proErrMsg = proErr.message;
            break;
          }
        }

        if (!brandingResult.success && proErrMsg) {
          return res.status(403).json({ success: false, error: proErrMsg });
        }
        return res.json({ success: true });
      }

      return res.status(400).json({ success: false, error: `Ação desconhecida: ${action}` });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno no sync.' });
    }
  });

  app.post('/api/media/upload', uploadMemory.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer?.length) {
        return res.status(400).json({ error: 'Nenhum arquivo binário enviado.' });
      }

      const rawMime = (file.mimetype || '').toLowerCase();
      const isImage = ALLOWED_IMAGE_MIMES.has(rawMime);
      const isVideo = ALLOWED_VIDEO_MIMES.has(rawMime);
      if (!isImage && !isVideo) {
        return res.status(415).json({ error: 'Tipo de arquivo não suportado.' });
      }

      const requestedBucket = String(req.body?.bucket || 'salon-media').trim().toLowerCase();
      const bucket = ALLOWED_UPLOAD_BUCKETS.has(requestedBucket) ? requestedBucket : 'salon-media';
      const ownerType = String(req.body?.ownerType || 'salon_gallery')
        .trim()
        .replace(/[^a-z0-9_]/gi, '_')
        .slice(0, 64);
      const ownerIdRaw = String(req.body?.ownerId || '').trim();
      const salonIdRaw = String(req.body?.salonId || '').trim();
      const title = String(req.body?.title || file.originalname || '').trim().slice(0, 160);
      const isCover = String(req.body?.isCover || '').toLowerCase() === 'true';

      const authUser = await verifySupabaseBearerUser(req);
      let finalBuffer: Buffer = file.buffer;
      let finalMime = rawMime;
      let finalExt = 'webp';
      let width: number | null = null;
      let height: number | null = null;

      if (isImage) {
        if (rawMime === 'image/svg+xml') {
          finalExt = 'svg';
        } else if (rawMime === 'image/gif') {
          finalExt = 'gif';
        } else {
          const maxDim = bucket === 'avatars' ? 640 : bucket === 'branding' ? 1280 : 1440;
          const keepPng = rawMime === 'image/png';
          try {
            const imgSharp = sharp(file.buffer).rotate().resize(maxDim, maxDim, {
              fit: 'inside',
              withoutEnlargement: true,
            });
            const output = keepPng
              ? await imgSharp.png({ compressionLevel: 8 }).toBuffer({ resolveWithObject: true })
              : await imgSharp.webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
            finalBuffer = output.data;
            width = output.info.width ?? null;
            height = output.info.height ?? null;
            finalMime = keepPng ? 'image/png' : 'image/webp';
            finalExt = keepPng ? 'png' : 'webp';
          } catch {
            finalExt = rawMime.includes('png') ? 'png' : 'jpg';
          }
        }
      } else {
        finalExt = rawMime.includes('webm') ? 'webm' : 'mp4';
      }

      const scopeKey = (salonIdRaw || ownerIdRaw || authUser?.userId || 'shared').replace(/[^a-zA-Z0-9_-]/g, '_');
      const randomToken = Math.random().toString(36).slice(2, 10);
      const storagePath = `${ownerType}/${scopeKey}/${Date.now()}-${randomToken}.${finalExt}`;

      const supabase = getSupabaseServerClient();
      const { data: upData, error: upErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, finalBuffer, {
          contentType: finalMime,
          cacheControl: '31536000',
          upsert: false,
        });

      if (upErr || !upData?.path) {
        return res.status(502).json({
          error: upErr?.message || 'Falha ao gravar arquivo binário no Supabase Storage.',
        });
      }

      const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(upData.path);
      const publicUrl = pubData?.publicUrl;
      if (!publicUrl) {
        return res.status(502).json({ error: 'Não foi possível gerar URL pública do Storage.' });
      }

      const resolvedOwnerId = UUID_REGEX.test(ownerIdRaw)
        ? ownerIdRaw
        : authUser?.userId && UUID_REGEX.test(authUser.userId)
        ? authUser.userId
        : null;
      const resolvedSalonId = UUID_REGEX.test(salonIdRaw) ? salonIdRaw : null;

      let assetId: string | null = null;
      try {
        const { data: assetRow } = await (supabase.from('media_assets' as any) as any)
          .insert({
            salon_id: resolvedSalonId,
            owner_type: ownerType,
            owner_id: resolvedOwnerId,
            bucket,
            storage_path: upData.path,
            public_url: publicUrl,
            mime_type: finalMime,
            size_bytes: finalBuffer.length,
            width,
            height,
            title: title || null,
            is_cover: isCover,
            uploaded_by: authUser?.userId || null,
          })
          .select('id')
          .maybeSingle();
        if (assetRow?.id) assetId = assetRow.id;
      } catch {}

      return res.json({
        success: true,
        id: assetId,
        bucket,
        storagePath: upData.path,
        publicUrl,
        mimeType: finalMime,
        sizeBytes: finalBuffer.length,
        width,
        height,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro interno no upload binário.' });
    }
  });

  app.delete('/api/media/:id', async (req, res) => {
    try {
      const assetId = String(req.params.id || '').trim();
      if (!UUID_REGEX.test(assetId)) {
        return res.status(400).json({ error: 'ID de mídia inválido.' });
      }
      const authUser = await verifySupabaseBearerUser(req);
      const supabase = getSupabaseServerClient();

      const { data: asset } = await (supabase.from('media_assets' as any) as any)
        .select('id, bucket, storage_path, uploaded_by, salon_id')
        .eq('id', assetId)
        .maybeSingle();

      if (!asset) {
        return res.status(404).json({ error: 'Mídia não encontrada.' });
      }

      if (authUser && authUser.role !== 'super_admin' && asset.uploaded_by && asset.uploaded_by !== authUser.userId) {

        if (asset.salon_id) {
          const { data: member } = await (supabase.from('salon_members' as any) as any)
            .select('id')
            .eq('salon_id', asset.salon_id)
            .eq('user_id', authUser.userId)
            .eq('is_active', true)
            .maybeSingle();
          if (!member) {
            return res.status(403).json({ error: 'Sem permissão para excluir esta mídia.' });
          }
        }
      }

      const { error: delErr } = await (supabase.from('media_assets' as any) as any)
        .delete()
        .eq('id', assetId);
      if (delErr) {
        return res.status(500).json({ error: delErr.message });
      }

      if (asset.bucket && asset.storage_path) {
        await supabase.storage.from(asset.bucket).remove([asset.storage_path]).catch(() => {});
      }

      return res.json({ success: true, deletedId: assetId });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao excluir mídia.' });
    }
  });

  app.post('/api/storage/cleanup', async (_req, res) => {
    try {
      const supabase = getSupabaseServerClient();
      const { data: pending, error } = await (supabase.from('storage_cleanup_queue' as any) as any)
        .select('id, bucket, storage_path')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error || !Array.isArray(pending) || pending.length === 0) {
        return res.json({ success: true, processed: 0 });
      }

      let cleaned = 0;
      for (const item of pending) {
        try {
          if (item.bucket && item.storage_path) {
            await supabase.storage.from(item.bucket).remove([item.storage_path]);
          }
          await (supabase.from('storage_cleanup_queue' as any) as any)
            .update({ status: 'cleaned', processed_at: new Date().toISOString() })
            .eq('id', item.id);
          cleaned += 1;
        } catch (cleanErr: any) {
          await (supabase.from('storage_cleanup_queue' as any) as any)
            .update({ status: 'failed', last_error: String(cleanErr?.message || cleanErr) })
            .eq('id', item.id);
        }
      }
      return res.json({ success: true, processed: cleaned });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao drenar fila de limpeza.' });
    }
  });

  app.get('/api/push/vapid-public-key', (_req, res) => {
    const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
    res.json({
      enabled: Boolean(publicKey && process.env.VAPID_PRIVATE_KEY),
      publicKey,
    });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const { subscription, userId, clientId, salonId, role, deviceLabel, userAgent } = req.body || {};
      const endpoint = String(subscription?.endpoint || '').trim();
      const p256dh = String(subscription?.keys?.p256dh || '').trim();
      const authKey = String(subscription?.keys?.auth || '').trim();

      if (!endpoint || !p256dh || !authKey || !/^https:\/\//i.test(endpoint)) {
        return res.status(400).json({ error: 'Payload de inscrição Web Push inválido.' });
      }

      const authUser = await verifySupabaseBearerUser(req);
      const supabase = getSupabaseServerClient();

      const resolvedUserId = authUser?.userId || (UUID_REGEX.test(String(userId || '')) ? String(userId) : null);
      const resolvedClientId = UUID_REGEX.test(String(clientId || '')) ? String(clientId) : null;
      const resolvedSalonId = UUID_REGEX.test(String(salonId || '')) ? String(salonId) : null;
      const allowedRoles = new Set(['client', 'salon_owner', 'salon_staff', 'super_admin']);
      const safeRole = allowedRoles.has(String(role || '')) ? String(role) : authUser?.role || 'client';

      const { data, error } = await (supabase.from('push_subscriptions' as any) as any)
        .upsert(
          {
            user_id: resolvedUserId,
            client_id: resolvedClientId,
            salon_id: resolvedSalonId,
            role: safeRole,
            endpoint,
            p256dh,
            auth: authKey,
            device_label: String(deviceLabel || '').slice(0, 120) || null,
            user_agent: String(userAgent || req.headers['user-agent'] || '').slice(0, 250) || null,
            is_active: true,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        )
        .select('id')
        .maybeSingle();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({ success: true, id: data?.id || null });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar inscrição Push.' });
    }
  });

  app.post('/api/push/unsubscribe', async (req, res) => {
    try {
      const endpoint = String(req.body?.endpoint || '').trim();
      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint obrigatório.' });
      }
      const supabase = getSupabaseServerClient();
      await (supabase.from('push_subscriptions' as any) as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('endpoint', endpoint);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao cancelar inscrição Push.' });
    }
  });

  app.post('/api/push/dispatch', async (req, res) => {
    try {
      if (!configureWebPushVapid()) {
        return res.json({
          success: true,
          dispatched: 0,
          skipped: true,
          reason: 'Chaves VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configuradas no ambiente.',
        });
      }

      const limit = Math.min(50, Math.max(1, Number(req.body?.limit) || 25));
      const supabase = getSupabaseServerClient();

      const { data: outboxRows, error: fetchErr } = await (supabase.from('notification_outbox' as any) as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (fetchErr || !Array.isArray(outboxRows) || outboxRows.length === 0) {
        return res.json({ success: true, dispatched: 0 });
      }

      let dispatched = 0;
      for (const row of outboxRows) {
        try {
          let subQuery = (supabase.from('push_subscriptions' as any) as any)
            .select('id, endpoint, p256dh, auth')
            .eq('is_active', true);

          if (row.target_user_id) {
            subQuery = subQuery.eq('user_id', row.target_user_id);
          } else if (row.target_client_id) {
            subQuery = subQuery.eq('client_id', row.target_client_id);
          } else if (row.salon_id) {
            subQuery = subQuery.eq('salon_id', row.salon_id);
          } else {
            subQuery = subQuery.limit(0);
          }

          const { data: subs } = await subQuery;
          const activeSubs = Array.isArray(subs) ? subs : [];

          if (activeSubs.length === 0) {
            await (supabase.from('notification_outbox' as any) as any)
              .update({
                status: 'sent',
                attempts: (row.attempts || 0) + 1,
                sent_at: new Date().toISOString(),
                last_error: 'Nenhum dispositivo inscrito para este destinatário.',
              })
              .eq('id', row.id);
            continue;
          }

          const notificationPayload = JSON.stringify({
            title: row.title || 'VagouApp',
            body: row.body || '',
            url: row.deep_link || '/',
            tag: row.event_type || 'vagou-notification',
            data: row.payload || {},
          });

          let sentAtLeastOne = false;
          for (const sub of activeSubs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                notificationPayload
              );
              sentAtLeastOne = true;
            } catch (pushErr: any) {
              const statusCode = Number(pushErr?.statusCode || 0);
              if (statusCode === 404 || statusCode === 410) {
                await (supabase.from('push_subscriptions' as any) as any)
                  .update({ is_active: false, updated_at: new Date().toISOString() })
                  .eq('id', sub.id);
              }
            }
          }

          await (supabase.from('notification_outbox' as any) as any)
            .update({
              status: sentAtLeastOne ? 'sent' : 'failed',
              attempts: (row.attempts || 0) + 1,
              sent_at: sentAtLeastOne ? new Date().toISOString() : null,
              last_error: sentAtLeastOne ? null : 'Falha na entrega Web Push.',
            })
            .eq('id', row.id);

          if (sentAtLeastOne) dispatched += 1;
        } catch (rowErr: any) {
          await (supabase.from('notification_outbox' as any) as any)
            .update({
              status: 'failed',
              attempts: (row.attempts || 0) + 1,
              last_error: String(rowErr?.message || rowErr).slice(0, 300),
            })
            .eq('id', row.id);
        }
      }

      return res.json({ success: true, dispatched, checked: outboxRows.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao despachar fila Push.' });
    }
  });

  const resolveTriadeAccountsOnServer = async (rawInput: string) => {
    const trimmed = String(rawInput || '').trim();
    if (!trimmed) return [];

    const supabase = getSupabaseServerClient();
    const cleanLower = trimmed.toLowerCase();
    const cleanNoSymbols = cleanLower.replace(/^[@#&]+|[@#&]+$/g, '');
    const digits = trimmed.replace(/\D/g, '');
    const results: any[] = [];
    const seenKeys = new Set<string>();

    const [sysAdminsRes, profilesRes, clientsRes, prosRes] = await Promise.all([
      (supabase.from('system_admins' as any) as any)
        .select('id, user_id, full_name, username, email, cpf, phone_whatsapp, avatar_url, role, access_level, is_active')
        .limit(100),
      (supabase.from('profiles' as any) as any)
        .select('id, email, full_name, username, cpf, phone, avatar_url, role, is_active')
        .limit(500),
      (supabase.from('clients' as any) as any)
        .select('id, user_id, full_name, email, phone, cpf, avatar_url, is_active')
        .limit(500),
      (supabase.from('professionals' as any) as any)
        .select('id, user_id, salon_id, full_name, role, access_level, cpf, email, phone, avatar_url, is_active')
        .limit(300),
    ]);

    const profilesById = new Map<string, any>();
    const profilesByEmail = new Map<string, any>();
    if (Array.isArray(profilesRes?.data)) {
      for (const p of profilesRes.data) {
        if (p?.id) profilesById.set(String(p.id), p);
        if (p?.email) profilesByEmail.set(String(p.email).trim().toLowerCase(), p);
      }
    }

    const cleanStripLeadingAt = cleanLower.replace(/^@+/, '');
    const hasTrailingSymbol = /[@#&]$/.test(cleanStripLeadingAt);

    const getMatchPriority = (
      r: any,
      table: 'system_admins' | 'clients' | 'profiles' | 'professionals'
    ): number => {
      if (!r || r.is_active === false) return 0;

      const rUser = String(r.username || '').trim().toLowerCase();
      const rUserStripLeadingAt = rUser.replace(/^@+/, '');
      const rUserNoSymbols = rUser.replace(/^[@#&]+|[@#&]+$/g, '');
      const rEmail = String(r.email || '').trim().toLowerCase();
      const rName = String(r.full_name || r.name || '').trim().toLowerCase();
      const rPhone1 = String(r.phone_whatsapp || r.phone || '').replace(/\D/g, '');
      const rCpf = String(r.cpf || '').replace(/\D/g, '');

      let priority = 0;

      if (
        (rEmail && rEmail === cleanLower) ||
        (rUser && (rUser === cleanLower || rUserStripLeadingAt === cleanStripLeadingAt)) ||
        (rName && (rName === cleanLower || rName === cleanStripLeadingAt))
      ) {
        priority = 100;
      } else if (
        digits.length >= 8 &&
        ((digits.length === 11 && rCpf && rCpf === digits) ||
          (rPhone1 &&
            (rPhone1 === digits ||
              rPhone1.endsWith(digits.slice(-8)) ||
              digits.endsWith(rPhone1.slice(-8)))))
      ) {
        priority = 90;
      } else if (
        !hasTrailingSymbol &&
        cleanNoSymbols.length >= 2 &&
        ((rUserNoSymbols && rUserNoSymbols === cleanNoSymbols) ||
          (rName && rName.replace(/^[@#&]+|[@#&]+$/g, '') === cleanNoSymbols))
      ) {
        priority = 50;
      }

      if (priority === 0) return 0;

      const key = `${table}::${r.id}`;
      if (seenKeys.has(key)) return 0;
      seenKeys.add(key);
      return priority;
    };

    const normalizeRecord = (
      r: any,
      table: 'system_admins' | 'clients' | 'profiles' | 'professionals'
    ) => {
      const rawRole = String(r.role || '').toLowerCase();
      const rawAccess = String(r.access_level || '').toLowerCase();
      const isSuperadmin =
        table === 'system_admins' ||
        rawRole === 'super_admin' ||
        rawRole === 'superadmin' ||
        rawAccess === '100' ||
        rawAccess.includes('superadmin');

      return {
        id: String(r.id),
        user_id: r.user_id || (table === 'profiles' ? String(r.id) : null),
        client_id: table === 'clients' ? String(r.id) : r.client_id || null,
        sourceTable: table === 'profiles' ? 'clients' : table,
        name: r.full_name || r.name || r.username || '',
        full_name: r.full_name || r.name || r.username || '',
        username: r.username || '',
        email: r.email || '',
        phone: r.phone_whatsapp || r.phone || '',
        cpf: r.cpf || '',
        avatar_url: r.avatar_url || '',
        role: r.role || 'client',
        access_level: r.access_level ?? null,
        isSuperadmin,
      };
    };

    if (Array.isArray(sysAdminsRes?.data)) {
      for (const r of sysAdminsRes.data) {
        const prio = getMatchPriority(r, 'system_admins');
        if (prio > 0) {
          results.push({ ...normalizeRecord(r, 'system_admins'), _prio: prio });
        }
      }
    }

    if (Array.isArray(clientsRes?.data)) {
      for (const c of clientsRes.data) {
        const linkedProf =
          (c?.user_id && profilesById.get(String(c.user_id))) ||
          (c?.email && profilesByEmail.get(String(c.email).trim().toLowerCase())) ||
          null;
        const merged = {
          ...c,
          username: c.username || linkedProf?.username || '',
          role: linkedProf?.role || 'client',
          phone: c.phone || linkedProf?.phone || '',
          cpf: c.cpf || linkedProf?.cpf || '',
          avatar_url: c.avatar_url || linkedProf?.avatar_url || '',
        };
        const prio = getMatchPriority(merged, 'clients');
        if (prio > 0) {
          results.push({ ...normalizeRecord(merged, 'clients'), _prio: prio });
        }
      }
    }

    if (Array.isArray(profilesRes?.data)) {
      for (const p of profilesRes.data) {
        const alreadyHasEmail = results.some(
          (item) =>
            item.email &&
            p.email &&
            String(item.email).trim().toLowerCase() === String(p.email).trim().toLowerCase()
        );
        if (!alreadyHasEmail) {
          const prio = getMatchPriority(p, 'profiles');
          if (prio > 0) {
            results.push({ ...normalizeRecord(p, 'profiles'), _prio: prio });
          }
        }
      }
    }

    if (Array.isArray(prosRes?.data)) {
      for (const pr of prosRes.data) {
        const linkedProf =
          (pr?.user_id && profilesById.get(String(pr.user_id))) ||
          (pr?.email && profilesByEmail.get(String(pr.email).trim().toLowerCase())) ||
          null;
        const merged = {
          ...pr,
          username: pr.username || linkedProf?.username || '',
        };
        const prio = getMatchPriority(merged, 'professionals');
        if (prio > 0) {
          results.push({ ...normalizeRecord(merged, 'professionals'), _prio: prio });
        }
      }
    }

    results.sort((a, b) => (b._prio || 0) - (a._prio || 0));
    return results.map(({ _prio, ...rest }) => rest);
  };

  let isSyncingAuthDirectory = false;
  let lastAuthDirectoryHash = '';

  const syncSupabaseAuthAndTables = async (force = false): Promise<any[]> => {
    if (isSyncingAuthDirectory && !force) return [];
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
    isSyncingAuthDirectory = true;
    try {
      const supabaseAdmin = getSupabaseServerClient();
      const [sysRes, profRes, cliRes, proRes, authRes] = await Promise.all([
        (supabaseAdmin.from('system_admins' as any) as any).select('*'),
        (supabaseAdmin.from('profiles' as any) as any).select('*'),
        (supabaseAdmin.from('clients') as any).select('*'),
        (supabaseAdmin.from('professionals') as any).select('*'),
        supabaseAdmin.auth.admin.listUsers(),
      ]);

      const authUsers = authRes?.data?.users || [];
      const sysAdmins = Array.isArray(sysRes?.data) ? sysRes.data : [];
      const profiles = Array.isArray(profRes?.data) ? profRes.data : [];
      const clients = Array.isArray(cliRes?.data) ? cliRes.data : [];
      const professionals = Array.isArray(proRes?.data) ? proRes.data : [];

      const sysByEmail = new Set(
        sysAdmins.map((a: any) => String(a.email || '').trim().toLowerCase()).filter(Boolean)
      );
      const profById = new Map<string, any>();
      for (const p of profiles) {
        if (p?.id) profById.set(String(p.id), p);
      }
      const cliByUserId = new Map<string, any>();
      const cliByEmail = new Map<string, any>();
      for (const c of clients) {
        if (c?.user_id) cliByUserId.set(String(c.user_id), c);
        if (c?.email) cliByEmail.set(String(c.email).trim().toLowerCase(), c);
      }

      let didMutateTables = false;

      for (const u of authUsers) {
        const uid = String(u.id || '').trim();
        const uEmail = String(u.email || '').trim().toLowerCase();
        if (!uid || !uEmail) continue;

        if (!u.email_confirmed_at) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(uid, { email_confirm: true });
          } catch {}
        }

        const meta = u.user_metadata || {};
        const metaName = String(meta.full_name || meta.name || '').trim();
        const metaUsername = String(meta.username || '').trim().replace(/^@+/, '');
        const metaPhone = String(meta.phone || '').trim();
        const metaCpf = String(meta.cpf || '').trim();
        const metaStreet = String(meta.street || '').trim();
        const metaNumber = String(meta.number || '').trim();
        const metaComplement = String(meta.complement || '').trim();
        const metaNeighborhood = String(meta.neighborhood || '').trim();
        const metaCity = String(meta.city || '').trim();
        const metaUf = String(meta.uf || meta.state || '').trim();
        const metaCep = String(meta.cep || '').trim();
        const metaFormattedAddr = String(meta.address || '').trim();
        const metaSecCode = String(meta.security_question_code || '').trim();
        const metaSecAnswer = String(meta.security_answer || '').trim();
        const isSuper =
          sysByEmail.has(uEmail) ||
          Boolean(meta.is_superadmin) ||
          String(meta.role || '').toLowerCase() === 'super_admin' ||
          String((u.app_metadata as any)?.role || '').toLowerCase() === 'super_admin';

        const existingProf = profById.get(uid);
        const needsProfSync =
          !existingProf ||
          (metaUsername && !existingProf.username) ||
          (metaPhone && !existingProf.phone) ||
          (metaStreet && !existingProf.address) ||
          (metaCep && !existingProf.cep);

        if (needsProfSync) {
          try {
            await (supabaseAdmin.from('profiles' as any) as any).upsert(
              {
                id: uid,
                email: uEmail,
                full_name: existingProf?.full_name || metaName || metaUsername || uEmail.split('@')[0],
                username: existingProf?.username || metaUsername || null,
                phone: existingProf?.phone || metaPhone || null,
                cpf: existingProf?.cpf || metaCpf || null,
                address: existingProf?.address || metaStreet || null,
                street_number: existingProf?.street_number || metaNumber || null,
                complement: existingProf?.complement || metaComplement || null,
                neighborhood: existingProf?.neighborhood || metaNeighborhood || null,
                city: existingProf?.city || metaCity || 'São Paulo',
                state: existingProf?.state || metaUf || 'SP',
                cep: existingProf?.cep || metaCep || null,
                formatted_address: existingProf?.formatted_address || metaFormattedAddr || null,
                role: isSuper ? 'super_admin' : existingProf?.role || 'client',
                is_active: true,
                created_via: existingProf?.created_via || 'mnvapp',
              },
              { onConflict: 'id' }
            );
            didMutateTables = true;
          } catch {}
        }

        if (!isSuper) {
          const existingCli = cliByUserId.get(uid) || cliByEmail.get(uEmail);
          const needsCliSync =
            !existingCli ||
            !existingCli.user_id ||
            (metaPhone && !existingCli.phone) ||
            (metaStreet && !existingCli.address) ||
            (metaCep && !existingCli.cep) ||
            (metaSecCode && !existingCli.security_question_code);

          if (needsCliSync) {
            try {
              const cliPayload: Record<string, any> = {
                user_id: uid,
                full_name: existingCli?.full_name || existingProf?.full_name || metaName || metaUsername || uEmail.split('@')[0],
                email: uEmail,
                phone: existingCli?.phone || existingProf?.phone || metaPhone || null,
                cpf: existingCli?.cpf || existingProf?.cpf || metaCpf || null,
                address: existingCli?.address || existingProf?.address || metaStreet || null,
                street_number: existingCli?.street_number || existingProf?.street_number || metaNumber || null,
                complement: existingCli?.complement || existingProf?.complement || metaComplement || null,
                neighborhood: existingCli?.neighborhood || existingProf?.neighborhood || metaNeighborhood || null,
                city: existingCli?.city || existingProf?.city || metaCity || 'São Paulo',
                state: existingCli?.state || existingProf?.state || metaUf || 'SP',
                cep: existingCli?.cep || existingProf?.cep || metaCep || null,
                formatted_address: existingCli?.formatted_address || existingProf?.formatted_address || metaFormattedAddr || null,
                security_question_code: existingCli?.security_question_code || metaSecCode || null,
                is_active: true,
                created_via: existingCli?.created_via || 'mnvapp',
              };

              let resolvedCliId = existingCli?.id ? String(existingCli.id) : '';
              if (existingCli?.id) {
                await (supabaseAdmin.from('clients') as any).update(cliPayload).eq('id', existingCli.id);
              } else {
                const { data: insCli } = await (supabaseAdmin.from('clients') as any)
                  .insert(cliPayload)
                  .select('id')
                  .maybeSingle();
                if (insCli?.id) resolvedCliId = String(insCli.id);
              }

              if (resolvedCliId && metaSecCode && metaSecAnswer) {
                await (supabaseAdmin.from('user_security_answers' as any) as any).upsert(
                  {
                    client_id: resolvedCliId,
                    question_code: metaSecCode,
                    answer_hash: metaSecAnswer,
                  },
                  { onConflict: 'client_id,question_code' }
                );
              }
              didMutateTables = true;
            } catch {}
          }
        }
      }

      const finalProfiles = didMutateTables
        ? ((await (supabaseAdmin.from('profiles' as any) as any).select('*'))?.data || profiles)
        : profiles;
      const finalClients = didMutateTables
        ? ((await (supabaseAdmin.from('clients') as any).select('*'))?.data || clients)
        : clients;

      const authMetaById = new Map<string, any>();
      for (const u of authUsers) {
        authMetaById.set(String(u.id), u.user_metadata || {});
      }

      const directory: any[] = [];
      for (const r of sysAdmins) {
        if (r.is_active === false) continue;
        directory.push({
          id: r.user_id || r.id,
          user_id: r.user_id || r.id,
          email: r.email || '',
          name: r.full_name || r.username || 'Administrador',
          full_name: r.full_name || r.username || 'Administrador',
          username: r.username || '',
          phone: r.phone_whatsapp || '',
          cpf: r.cpf || '',
          role: r.role || 'super_admin',
          sourceTable: 'system_admins',
          isSuperadmin: true,
          avatar_url: r.avatar_url || null,
        });
      }
      for (const r of finalProfiles) {
        if (r.is_active === false) continue;
        const meta = authMetaById.get(String(r.id)) || {};
        const uname = r.username || meta.username || '';
        const fname = r.full_name || meta.full_name || meta.name || uname || 'Usuário';
        const phone = r.phone || meta.phone || '';
        const isSuper =
          String(r.role || '').toLowerCase() === 'super_admin' ||
          String(r.role || '').toUpperCase().includes('SUPER');
        directory.push({
          id: r.id,
          user_id: r.id,
          email: r.email || meta.email || '',
          name: fname,
          full_name: fname,
          username: uname,
          phone,
          cpf: r.cpf || '',
          role: r.role || 'client',
          sourceTable: isSuper ? 'system_admins' : 'clients',
          isSuperadmin: isSuper,
          avatar_url: r.avatar_url || meta.avatar_url || null,
        });
      }
      for (const r of finalClients) {
        if (r.is_active === false) continue;
        const meta = authMetaById.get(String(r.user_id)) || {};
        const linkedProf = finalProfiles.find((p: any) => String(p.id) === String(r.user_id));
        directory.push({
          id: r.id,
          user_id: r.user_id || r.id,
          client_id: r.id,
          email: r.email || meta.email || '',
          name: r.full_name || meta.full_name || 'Cliente',
          full_name: r.full_name || meta.full_name || 'Cliente',
          username: linkedProf?.username || meta.username || '',
          phone: r.phone || linkedProf?.phone || meta.phone || '',
          cpf: r.cpf || linkedProf?.cpf || '',
          role: 'client',
          sourceTable: 'clients',
          isSuperadmin: false,
          avatar_url: r.avatar_url || linkedProf?.avatar_url || meta.avatar_url || null,
        });
      }
      for (const r of professionals) {
        if (r.is_active === false) continue;
        directory.push({
          id: r.id,
          user_id: r.user_id || r.id,
          email: r.email || '',
          name: r.full_name || r.name || 'Profissional',
          full_name: r.full_name || r.name || 'Profissional',
          username: r.username || '',
          phone: r.phone || '',
          cpf: r.cpf || '',
          role: r.role || 'professional',
          sourceTable: 'professionals',
          isSuperadmin: false,
          avatar_url: r.avatar_url || null,
        });
      }

      const dirHash = JSON.stringify(directory.map((d) => `${d.id}:${d.username}:${d.email}:${d.phone}`));
      if (force || didMutateTables || dirHash !== lastAuthDirectoryHash) {
        lastAuthDirectoryHash = dirHash;
        const { data: globalPref } = await (supabaseAdmin.from('admin_preferences' as any) as any)
          .select('*')
          .eq('id', 'global')
          .maybeSingle();
        const basePrefs = globalPref?.preferences || {};
        await (supabaseAdmin.from('admin_preferences' as any) as any).upsert({
          id: 'global',
          preferences: {
            ...basePrefs,
            auth_directory: directory,
            auth_directory_updated_at: new Date().toISOString(),
          },
        });
      }
      return directory;
    } catch {
      return [];
    } finally {
      isSyncingAuthDirectory = false;
    }
  };

  setTimeout(() => {
    syncSupabaseAuthAndTables(true).catch(() => {});
  }, 500);
  setInterval(() => {
    syncSupabaseAuthAndTables(false).catch(() => {});
  }, 4000);

  const checkUserConflictOnServer = async (params: {
    username?: string;
    email?: string;
    phone?: string;
    cpf?: string;
  }): Promise<{
    hasConflict: boolean;
    conflictField?: 'username' | 'email' | 'phone' | 'cpf';
    message?: string;
  }> => {
    const reqUser = String(params.username || '').trim().replace(/^@+/, '').toLowerCase();
    const reqEmail = String(params.email || '').trim().toLowerCase();
    const reqPhone = String(params.phone || '').replace(/\D/g, '');
    const reqCpf = String(params.cpf || '').replace(/\D/g, '');

    const directory = await syncSupabaseAuthAndTables(false);
    for (const rec of directory) {
      const recUser = String(rec.username || '').trim().replace(/^@+/, '').toLowerCase();
      const recEmail = String(rec.email || '').trim().toLowerCase();
      const recPhone = String(rec.phone || '').replace(/\D/g, '');
      const recCpf = String(rec.cpf || '').replace(/\D/g, '');

      if (reqUser && recUser && recUser === reqUser) {
        return {
          hasConflict: true,
          conflictField: 'username',
          message: `O nome de usuário "${params.username}" já está cadastrado no sistema. Escolha outro nome de usuário.`,
        };
      }
      if (reqEmail && recEmail && recEmail === reqEmail) {
        return {
          hasConflict: true,
          conflictField: 'email',
          message: `O e-mail "${params.email}" já está cadastrado no sistema. Faça login ou utilize outro e-mail.`,
        };
      }
      if (reqCpf.length === 11 && recCpf.length === 11 && recCpf === reqCpf) {
        return {
          hasConflict: true,
          conflictField: 'cpf',
          message: 'O CPF informado já pertence a um usuário cadastrado no sistema.',
        };
      }
      if (
        reqPhone.length >= 10 &&
        recPhone.length >= 10 &&
        recPhone.slice(-9) === reqPhone.slice(-9)
      ) {
        return {
          hasConflict: true,
          conflictField: 'phone',
          message: `O WhatsApp "${params.phone}" já está vinculado a uma conta cadastrada. Faça login ou utilize outro número.`,
        };
      }
    }
    return { hasConflict: false };
  };

  app.post('/api/public/check-user-conflict', async (req, res) => {
    try {
      const conflict = await checkUserConflictOnServer({
        username: req.body?.username,
        email: req.body?.email,
        phone: req.body?.phone,
        cpf: req.body?.cpf,
      });
      return res.json(conflict);
    } catch (err: any) {
      return res.status(500).json({ hasConflict: false, error: err?.message });
    }
  });

  app.post('/api/public/register-user', async (req, res) => {
    try {
      const body = req.body || {};
      const cleanName = String(body.fullName || body.name || '').trim();
      const cleanEmail = String(body.email || '').trim().toLowerCase();
      const cleanUsername = String(body.username || '').trim().replace(/^@+/, '');
      const cleanPhone = String(body.phone || '').trim();
      const cleanCpf = String(body.cpf || '').trim();
      const cleanPassword = String(body.password || '').trim();
      const addr = body.address || {};
      const cleanCep = String(body.cep || addr.cep || '').trim();
      const cleanStreet = String(body.street || addr.street || '').trim();
      const cleanNumber = String(body.number || addr.number || 'S/N').trim();
      const cleanComplement = String(body.complement || addr.complement || '').trim();
      const cleanNeighborhood = String(body.neighborhood || addr.neighborhood || '').trim();
      const cleanCity = String(body.city || addr.city || 'São Paulo').trim();
      const cleanState = String(body.state || body.uf || addr.state || addr.uf || 'SP').trim().toUpperCase();
      const formattedAddress = String(
        body.formattedAddress ||
          [cleanStreet, cleanNumber, cleanComplement, cleanNeighborhood, cleanCity, cleanState, cleanCep]
            .filter(Boolean)
            .join(', ')
      ).trim();
      const securityQuestionCode = String(body.securityQuestionCode || '').trim();
      const securityAnswer = String(body.securityAnswer || '').trim();

      if (!cleanName || !cleanEmail || !cleanPassword) {
        return res.status(400).json({
          success: false,
          error: 'Nome completo, e-mail e senha são obrigatórios para criar a conta.',
        });
      }

      if (
        cleanUsername.length < 3 ||
        !/[A-ZÀ-Ý]/.test(cleanUsername) ||
        !/[a-zà-ÿ]/.test(cleanUsername) ||
        !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(cleanUsername)
      ) {
        return res.status(400).json({
          success: false,
          error:
            'O nome de usuário deve conter ao menos 1 letra maiúscula, 1 letra minúscula e 1 caractere especial (Ex: João@, Ana#1).',
        });
      }

      const preConflict = await checkUserConflictOnServer({
        username: cleanUsername,
        email: cleanEmail,
        phone: cleanPhone,
        cpf: cleanCpf,
      });

      if (preConflict.hasConflict) {
        return res.status(409).json({
          success: false,
          conflictField: preConflict.conflictField,
          error:
            preConflict.message ||
            'Já existe um usuário cadastrado com estes dados (Nome de Usuário, E-mail, WhatsApp ou CPF).',
        });
      }

      const sUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
      const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
      const supabaseAdmin = getSupabaseServerClient();
      const supabaseAnon = createClient(sUrl, anonKey, { auth: { persistSession: false } });

      const userMeta = {
        full_name: cleanName,
        name: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        cpf: cleanCpf || undefined,
        address: formattedAddress,
        cep: cleanCep,
        street: cleanStreet,
        number: cleanNumber,
        complement: cleanComplement,
        neighborhood: cleanNeighborhood,
        city: cleanCity,
        uf: cleanState,
        security_question_code: securityQuestionCode || undefined,
        security_answer: securityAnswer || undefined,
      };

      const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        app_metadata: { role: 'client' },
        user_metadata: userMeta,
      });

      if (createAuthErr || !createdAuth?.user?.id) {
        return res.status(400).json({
          success: false,
          error:
            createAuthErr?.message?.includes('already been registered')
              ? `O e-mail "${cleanEmail}" já está registrado no Supabase Auth. Faça login ou utilize outro e-mail.`
              : createAuthErr?.message || 'Não foi possível criar o usuário no Supabase Auth.',
        });
      }

      const authUserId = createdAuth.user.id;

      const { error: profErr } = await (supabaseAdmin.from('profiles' as any) as any).upsert(
        {
          id: authUserId,
          email: cleanEmail,
          full_name: cleanName,
          username: cleanUsername,
          phone: cleanPhone || null,
          cpf: cleanCpf || null,
          address: cleanStreet || null,
          street_number: cleanNumber || null,
          complement: cleanComplement || null,
          neighborhood: cleanNeighborhood || null,
          city: cleanCity,
          state: cleanState,
          cep: cleanCep || null,
          formatted_address: formattedAddress || null,
          role: 'client',
          is_active: true,
          created_via: 'mnvapp',
        },
        { onConflict: 'id' }
      );

      if (profErr) {
        return res.status(400).json({
          success: false,
          error: `Erro ao gravar perfil no banco de dados: ${profErr.message}`,
        });
      }

      const clientPayload: Record<string, any> = {
        user_id: authUserId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || null,
        cpf: cleanCpf || null,
        address: cleanStreet || null,
        street_number: cleanNumber || null,
        complement: cleanComplement || null,
        neighborhood: cleanNeighborhood || null,
        city: cleanCity,
        state: cleanState,
        cep: cleanCep || null,
        formatted_address: formattedAddress || null,
        security_question_code: securityQuestionCode || null,
        is_active: true,
        created_via: 'mnvapp',
      };

      const { data: existingCli } = await (supabaseAdmin.from('clients') as any)
        .select('id')
        .or(`user_id.eq.${authUserId},email.ilike.${cleanEmail}`)
        .limit(1)
        .maybeSingle();

      let savedClient: any = null;
      if (existingCli?.id) {
        const { data: updCli, error: updErr } = await (supabaseAdmin.from('clients') as any)
          .update(clientPayload)
          .eq('id', existingCli.id)
          .select('*')
          .maybeSingle();
        if (updErr) {
          return res.status(400).json({
            success: false,
            error: `Erro ao atualizar cliente no banco de dados: ${updErr.message}`,
          });
        }
        savedClient = updCli;
      } else {
        const { data: insCli, error: insErr } = await (supabaseAdmin.from('clients') as any)
          .insert(clientPayload)
          .select('*')
          .maybeSingle();
        if (insErr) {
          return res.status(400).json({
            success: false,
            error: `Erro ao inserir cliente no banco de dados: ${insErr.message}`,
          });
        }
        savedClient = insCli;
      }

      if (savedClient?.id && securityQuestionCode && securityAnswer) {
        await (supabaseAdmin.from('user_security_answers' as any) as any).upsert(
          {
            client_id: savedClient.id,
            question_code: securityQuestionCode,
            answer_hash: securityAnswer,
          },
          { onConflict: 'client_id,question_code' }
        );
      }

      await syncSupabaseAuthAndTables(true);

      let sessionObj: { access_token: string; refresh_token: string } | undefined;
      try {
        const { data: signInData } = await supabaseAnon.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (signInData?.session) {
          sessionObj = {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
          };
        }
      } catch {}

      return res.json({
        success: true,
        userId: authUserId,
        clientId: savedClient?.id || null,
        client: savedClient,
        user: {
          id: authUserId,
          clientId: savedClient?.id || null,
          name: cleanName,
          full_name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          phone: cleanPhone,
          cpf: cleanCpf,
        },
        session: sessionObj,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Erro interno ao registrar usuário no banco de dados.',
      });
    }
  });

  app.post('/api/auth/resolve-accounts', async (req, res) => {
    try {
      const identifier = String(req.body?.identifier || '').trim();
      if (!identifier) {
        return res.json({ accounts: [] });
      }
      const accounts = await resolveTriadeAccountsOnServer(identifier);
      return res.json({ accounts });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao localizar conta.', accounts: [] });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const rawId = String(req.body?.identifier || '').trim();
      const cleanPass = String(req.body?.password || '').trim();

      if (!rawId || !cleanPass) {
        return res.status(400).json({ error: 'Informe seu identificador e senha.' });
      }

      const sUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
      const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
      const supabaseAdmin = getSupabaseServerClient();
      const supabaseAnon = createClient(sUrl, anonKey, { auth: { persistSession: false } });

      const cleanLower = rawId.toLowerCase();
      const cleanNoSymbols = cleanLower.replace(/^[@#&]+|[@#&]+$/g, '');

      const envAdminEmail = String(process.env.INITIAL_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
      const envAdminUser = String(process.env.INITIAL_SUPER_ADMIN_USERNAME || '').trim().toLowerCase();
      const envAdminUserNoSym = envAdminUser.replace(/^[@#&]+|[@#&]+$/g, '');
      const envAdminPass = String(process.env.INITIAL_SUPER_ADMIN_PASSWORD || '').trim();
      const envAdminName = String(process.env.INITIAL_SUPER_ADMIN_NAME || 'Super Admin Vagou').trim();

      if (
        envAdminEmail &&
        envAdminPass &&
        cleanPass === envAdminPass &&
        (cleanLower === envAdminEmail ||
          (envAdminUser && cleanLower === envAdminUser) ||
          (envAdminUserNoSym && cleanNoSymbols === envAdminUserNoSym))
      ) {
        let envAuthUserId: string | null = null;
        const { data: createdAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: envAdminEmail,
          password: envAdminPass,
          email_confirm: true,
          app_metadata: { role: 'super_admin' },
          user_metadata: { full_name: envAdminName, username: envAdminUser || 'superadmin', role: 'super_admin' },
        });
        if (!createErr && createdAuth?.user?.id) {
          envAuthUserId = createdAuth.user.id;
        } else {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = (listData?.users || []).find(
            (u: any) => String(u.email || '').trim().toLowerCase() === envAdminEmail
          );
          if (existingUser?.id) {
            envAuthUserId = existingUser.id;
            await supabaseAdmin.auth.admin.updateUserById(envAuthUserId, {
              password: envAdminPass,
              email_confirm: true,
              app_metadata: { ...existingUser.app_metadata, role: 'super_admin' },
              user_metadata: { ...existingUser.user_metadata, full_name: envAdminName, username: envAdminUser || 'superadmin', role: 'super_admin' },
            });
          }
        }

        if (envAuthUserId) {
          await (supabaseAdmin.from('profiles' as any) as any).upsert(
            {
              id: envAuthUserId,
              email: envAdminEmail,
              full_name: envAdminName,
              username: envAdminUser || 'superadmin',
              role: 'super_admin',
              is_active: true,
              created_via: 'admvapp',
            },
            { onConflict: 'id' }
          );
        }

        const { data: signInEnv } = await supabaseAnon.auth.signInWithPassword({
          email: envAdminEmail,
          password: envAdminPass,
        });

        const matchedEnvAdmin = {
          id: envAuthUserId || envAdminEmail,
          user_id: envAuthUserId,
          sourceTable: 'system_admins',
          name: envAdminName,
          full_name: envAdminName,
          username: envAdminUser || 'superadmin',
          email: envAdminEmail,
          phone: '',
          cpf: '',
          avatar_url: '',
          role: 'super_admin',
          access_level: 100,
          isSuperadmin: true,
        };

        return res.json({
          success: true,
          account: {
            identifier: rawId,
            id: String(envAuthUserId || envAdminEmail),
            name: envAdminName,
            username: envAdminUser || 'superadmin',
            email: envAdminEmail,
            phone: '',
            cpf: '',
            avatarUrl: '',
            accountType: 'owner',
            matchedAccount: matchedEnvAdmin,
          },
          session: signInEnv?.session
            ? {
                access_token: signInEnv.session.access_token,
                refresh_token: signInEnv.session.refresh_token,
              }
            : undefined,
        });
      }

      const matchedAccounts = await resolveTriadeAccountsOnServer(rawId);
      const matchedSysAdmin = matchedAccounts.find((a) => a.sourceTable === 'system_admins' || a.isSuperadmin);

      const candidateAdminIdentifiers = Array.from(
        new Set(
          [
            rawId,
            rawId.replace(/^@+/, ''),
            matchedSysAdmin?.email,
            matchedSysAdmin?.username,
          ].filter(Boolean)
        )
      );

      for (const candidateId of candidateAdminIdentifiers) {
        const { data: admRows } = await (supabaseAdmin.rpc as any)('verify_admin_login', {
          p_identifier: candidateId,
          p_password: cleanPass,
        });
        if (Array.isArray(admRows) && admRows[0]) {
          const a = admRows[0];
          let sessionObj: { access_token: string; refresh_token: string } | undefined;
          const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
            email: a.email,
            password: cleanPass,
          });
          if (!signInErr && signInData?.session) {
            sessionObj = {
              access_token: signInData.session.access_token,
              refresh_token: signInData.session.refresh_token,
            };
          } else if (a.user_id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            await supabaseAdmin.auth.admin.updateUserById(String(a.user_id), {
              password: cleanPass,
              email_confirm: true,
              app_metadata: { role: 'super_admin' },
            });
            const { data: retrySign } = await supabaseAnon.auth.signInWithPassword({
              email: a.email,
              password: cleanPass,
            });
            if (retrySign?.session) {
              sessionObj = {
                access_token: retrySign.session.access_token,
                refresh_token: retrySign.session.refresh_token,
              };
            }
          }

          return res.json({
            success: true,
            account: {
              identifier: rawId,
              id: String(a.user_id || a.id),
              name: a.full_name || a.username,
              username: a.username,
              email: a.email,
              phone: matchedSysAdmin?.phone || '',
              cpf: matchedSysAdmin?.cpf || '',
              avatarUrl: a.avatar_url || '',
              accountType: 'owner',
              matchedAccount: {
                ...a,
                name: a.full_name || a.username,
                phone: matchedSysAdmin?.phone || '',
                cpf: matchedSysAdmin?.cpf || '',
                sourceTable: 'system_admins',
                isSuperadmin: true,
              },
            },
            session: sessionObj,
          });
        }
      }

      const candidateEmails: { email: string; matched: any }[] = [];
      const seenEmails = new Set<string>();

      for (const acc of matchedAccounts) {
        const em = String(acc.email || '').trim().toLowerCase();
        if (em && em.includes('@') && !seenEmails.has(em)) {
          seenEmails.add(em);
          candidateEmails.push({ email: em, matched: acc });
        }
      }

      if (rawId.includes('@') && rawId.includes('.')) {
        const directEmail = rawId.toLowerCase();
        if (!seenEmails.has(directEmail)) {
          seenEmails.add(directEmail);
          candidateEmails.push({ email: directEmail, matched: null });
        }
      }

      for (const cand of candidateEmails) {
        const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
          email: cand.email,
          password: cleanPass,
        });

        if (!signInErr && signInData?.session) {
          const authUser = signInData.user;
          const acc = cand.matched;
          const isSuper = Boolean(
            acc?.isSuperadmin ||
              acc?.sourceTable === 'system_admins' ||
              acc?.role === 'super_admin' ||
              authUser?.app_metadata?.role === 'super_admin' ||
              authUser?.user_metadata?.role === 'super_admin'
          );

          const accountType: 'owner' | 'professional' | 'client' = isSuper
            ? 'owner'
            : acc?.sourceTable === 'professionals'
              ? 'professional'
              : 'client';

          const resolvedName =
            acc?.name ||
            acc?.full_name ||
            authUser?.user_metadata?.full_name ||
            authUser?.user_metadata?.name ||
            acc?.username ||
            cand.email.split('@')[0];

          const resolvedUsername =
            acc?.username ||
            authUser?.user_metadata?.username ||
            cand.email.split('@')[0];

          const resolvedPhone =
            acc?.phone ||
            authUser?.user_metadata?.phone ||
            '';

          const resolvedCpf =
            acc?.cpf ||
            authUser?.user_metadata?.cpf ||
            '';

          const resolvedAvatar =
            acc?.avatar_url ||
            authUser?.user_metadata?.avatar_url ||
            '';

          const finalMatched = acc
            ? { ...acc, isSuperadmin: isSuper }
            : {
                id: authUser?.id || cand.email,
                user_id: authUser?.id || null,
                sourceTable: isSuper ? 'system_admins' : 'clients',
                name: resolvedName,
                full_name: resolvedName,
                username: resolvedUsername,
                email: cand.email,
                phone: resolvedPhone,
                cpf: resolvedCpf,
                avatar_url: resolvedAvatar,
                role: isSuper ? 'super_admin' : 'client',
                isSuperadmin: isSuper,
              };

          return res.json({
            success: true,
            account: {
              identifier: rawId,
              id: String(authUser?.id || acc?.user_id || acc?.id || ''),
              name: resolvedName,
              username: resolvedUsername,
              email: cand.email,
              phone: resolvedPhone,
              cpf: resolvedCpf,
              avatarUrl: resolvedAvatar,
              accountType,
              matchedAccount: finalMatched,
            },
            session: {
              access_token: signInData.session.access_token,
              refresh_token: signInData.session.refresh_token,
            },
          });
        }
      }

      return res.status(401).json({
        error: 'Conta ou senha inválida. Verifique seu usuário, celular ou e-mail.',
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Não foi possível validar suas credenciais.',
      });
    }
  });

  app.post('/api/admin/bootstrap', async (req, res) => {
    try {
      const email = String(req.body?.email || process.env.INITIAL_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
      const password = String(req.body?.password || process.env.INITIAL_SUPER_ADMIN_PASSWORD || '').trim();
      const fullName = String(req.body?.fullName || process.env.INITIAL_SUPER_ADMIN_NAME || 'Super Admin Vagou').trim();
      const username = String(req.body?.username || process.env.INITIAL_SUPER_ADMIN_USERNAME || email.split('@')[0] || 'superadmin').trim();

      if (!email || !email.includes('@') || password.length < 8) {
        return res.status(400).json({
          error: 'Informe e-mail válido e senha com no mínimo 8 caracteres (ou defina INITIAL_SUPER_ADMIN_* no servidor).',
        });
      }

      const supabase = getSupabaseServerClient();
      const { data: existingAdmins } = await (supabase.from('system_admins' as any) as any)
        .select('id')
        .limit(1);

      if (Array.isArray(existingAdmins) && existingAdmins.length > 0) {
        return res.status(409).json({
          error: 'O Super Admin inicial já foi provisionado. Bootstrap bloqueado por segurança.',
        });
      }

      let authUserId: string | null = null;
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: createdAuth, error: authErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role: 'super_admin' },
          user_metadata: { full_name: fullName, username, role: 'super_admin' },
        });
        if (!authErr && createdAuth?.user?.id) {
          authUserId = createdAuth.user.id;
        } else {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existingUser = (listData?.users || []).find(
            (u: any) => String(u.email || '').trim().toLowerCase() === email
          );
          if (existingUser?.id) {
            authUserId = existingUser.id;
            await supabase.auth.admin.updateUserById(authUserId, {
              password,
              email_confirm: true,
              app_metadata: { ...existingUser.app_metadata, role: 'super_admin' },
              user_metadata: { ...existingUser.user_metadata, full_name: fullName, username, role: 'super_admin' },
            });
          }
        }
      }

      const { data: rpcId, error: rpcErr } = await (supabase.rpc as any)('bootstrap_initial_super_admin', {
        p_email: email,
        p_full_name: fullName,
        p_username: username,
        p_password: password,
        p_user_id: authUserId,
      });

      if (rpcErr) {
        return res.status(409).json({ error: rpcErr.message });
      }

      return res.json({
        success: true,
        adminId: rpcId,
        authUserId,
        email,
        username,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao inicializar Super Admin.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });

    app.use(async (req, res, next) => {
      const accept = String(req.headers.accept || '');
      const acceptsHtml = !accept || accept.includes('text/html') || accept.includes('*/*');
      const isHtmlNav =
        req.method === 'GET' &&
        acceptsHtml &&
        !req.path.startsWith('/api/') &&
        !req.path.startsWith('/@') &&
        !req.path.startsWith('/__') &&
        !req.path.startsWith('/src/') &&
        !req.path.startsWith('/node_modules/') &&
        !req.path.startsWith('/assets/') &&
        req.path !== '/manifest.json' &&
        (!/\.[a-z0-9]+$/i.test(req.path) || req.path === '/index.html');

      if (!isHtmlNav) {
        return next();
      }

      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        let rawHtml = await fs.readFile(indexPath, 'utf8');
        rawHtml = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const personalizedHtml = await injectDynamicPwaHead(rawHtml, req);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(personalizedHtml);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/manifest.json' || /\.[a-z0-9]+$/i.test(req.path)) {
        return next();
      }
      try {
        const indexHtml = await fs.readFile(path.join(distPath, 'index.html'), 'utf8');
        const personalizedHtml = await injectDynamicPwaHead(indexHtml, req);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(personalizedHtml);
      } catch {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
