import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? Number(process.argv[portArgIndex + 1]) : NaN;
  const PORT = !Number.isNaN(cliPort) ? cliPort : (Number(process.env.PORT) || 3000);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize Gemini AI
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!apiKey,
      hasMapsKey: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
    });
  });

  const getMapsApiKey = () =>
    (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();

  // 1. Public config endpoint for Maps JS SDK initialization
  app.get('/api/maps/config', (_req, res) => {
    const mapsKey = getMapsApiKey();
    res.json({
      apiKey: mapsKey,
      enabled: Boolean(mapsKey),
    });
  });

  // 2. Routes API v2 — computeRoutes (Real route, polyline, and turn-by-turn steps)
  app.post('/api/maps/compute-route', async (req, res) => {
    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      return res.status(503).json({ error: 'VITE_GOOGLE_MAPS_API_KEY not configured' });
    }

    try {
      const {
        originLat,
        originLng,
         originAddress,
        destLat,
        destLng,
        destAddress,
        travelMode = 'DRIVE',
      } = req.body || {};

      const buildWaypoint = (lat?: number, lng?: number, address?: string) => {
        if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          return {
            location: {
              latLng: { latitude: lat, longitude: lng },
            },
          };
        }
        return { address: String(address || 'São Paulo, SP') };
      };

      const normalizedMode = ['DRIVE', 'TWO_WHEELER', 'BICYCLE', 'WALK', 'TRANSIT'].includes(
        String(travelMode).toUpperCase()
      )
        ? String(travelMode).toUpperCase()
        : 'DRIVE';

      const bodyPayload: Record<string, any> = {
        origin: buildWaypoint(originLat, originLng, originAddress),
        destination: buildWaypoint(destLat, destLng, destAddress),
        travelMode: normalizedMode,
        languageCode: 'pt-BR',
        units: 'METRIC',
      };

      if (normalizedMode === 'DRIVE' || normalizedMode === 'TWO_WHEELER') {
        bodyPayload.routingPreference = 'TRAFFIC_AWARE';
      }

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

      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask': fieldMask,
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || 'Erro ao calcular rota via Routes API v2',
          details: data,
        });
      }

      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Falha interna ao calcular rota' });
    }
  });

  // 3. Routes API v2 — Simultaneous 5-Modal Route Matrix
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

  // 4. Places API (New v1) — Search Text & Address Autocomplete Suggestions
  app.post('/api/maps/places-search', async (req, res) => {
    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      return res.status(503).json({ error: 'VITE_GOOGLE_MAPS_API_KEY not configured' });
    }

    try {
      const { query } = req.body || {};
      const cleanQuery = String(query || '').trim();
      if (cleanQuery.length < 3) {
        return res.json({ places: [] });
      }

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify({
          textQuery: cleanQuery,
          languageCode: 'pt-BR',
          regionCode: 'BR',
          maxResultCount: 5,
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

  // 5. Roads API (nearestRoads) + Geocoding API (Reverse Geocode) for Live GPS Snap-to-Road
  app.get('/api/maps/snap-and-reverse', async (req, res) => {
    const mapsKey = getMapsApiKey();
    if (!mapsKey) {
      return res.status(503).json({ error: 'VITE_GOOGLE_MAPS_API_KEY not configured' });
    }

    try {
      const rawLat = Number(req.query.lat);
      const rawLng = Number(req.query.lng);
      if (Number.isNaN(rawLat) || Number.isNaN(rawLng)) {
        return res.status(400).json({ error: 'Coordenadas inválidas' });
      }

      let snappedLat = rawLat;
      let snappedLng = rawLng;

      // Step A: Snap to nearest road via Roads API
      try {
        const roadsRes = await fetch(
          `https://roads.googleapis.com/v1/nearestRoads?points=${rawLat},${rawLng}&key=${mapsKey}`
        );
        if (roadsRes.ok) {
          const roadsData = await roadsRes.json();
          const firstPoint = roadsData?.snappedPoints?.[0]?.location;
          if (
            firstPoint &&
            typeof firstPoint.latitude === 'number' &&
            typeof firstPoint.longitude === 'number'
          ) {
            snappedLat = firstPoint.latitude;
            snappedLng = firstPoint.longitude;
          }
        }
      } catch {}

      // Step B: Reverse Geocode snapped coordinate to get street name
      let streetName = '';
      let formattedAddress = '';
      try {
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${snappedLat},${snappedLng}&language=pt-BR&key=${mapsKey}`
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const firstResult = geoData?.results?.[0];
          if (firstResult) {
            formattedAddress = firstResult.formatted_address || '';
            const routeComp = (firstResult.address_components || []).find(
              (c: any) => Array.isArray(c.types) && c.types.includes('route')
            );
            streetName = routeComp?.short_name || routeComp?.long_name || formattedAddress.split(',')[0] || '';
          }
        }
      } catch {}

      return res.json({
        lat: snappedLat,
        lng: snappedLng,
        streetName: streetName || 'Via em deslocamento',
        formattedAddress,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro no snap-and-reverse' });
    }
  });

  // AI Structure & Screen Analysis endpoint
  app.post('/api/analyze-design', async (req, res) => {
    try {
      const { fileName, fileType, imageBase64, mimeType, additionalContext } = req.body;

      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY não configurada no servidor. Configure a chave no menu de segredos.',
        });
      }

      const prompt = `Você é um Arquiteto de Software e Especialista em UI/UX e Design Systems.
Analise detalhadamente o arquivo/tela fornecido (Arquivo: ${fileName || 'design/video/tela'}, Tipo: ${fileType || mimeType || 'design'}).
${additionalContext ? `Contexto adicional do usuário: ${additionalContext}` : ''}

Por favor, forneça uma análise estrutural e técnica completa em formato JSON estrito com o seguinte esquema:
{
  "title": "Título descritivo da tela ou fluxo",
  "summary": "Resumo executivo da finalidade da tela/vídeo e arquitetura geral",
  "screensIdentified": [
    {
      "name": "Nome da tela ou seção",
      "description": "Explicação do papel desta tela no fluxo",
      "keyElements": ["Lista de elementos principais, ex: header com busca, card de métricas, tabela paginada"],
      "purpose": "Objetivo de negócio / interação do usuário"
    }
  ],
  "informationArchitecture": {
    "hierarchy": ["Nível 1: Header e Navegação", "Nível 2: Grid de Conteúdo Principal", "Nível 3: Modais e Gavetas"],
    "userFlows": ["Passo a passo do fluxo que o usuário realiza nesta interface"]
  },
  "designTokens": {
    "primaryColors": ["#hex ou nome da cor identificada/sugerida com descrição de uso"],
    "typographyHints": ["Sugestões de fontes, pesos (Regular 400, Bold 700) e tamanhos"],
    "layoutGrid": "Descrição da malha (ex: Grid responsivo de 12 colunas, espaçamentos p-4 / gap-6)"
  },
  "componentBlueprint": [
    {
      "component": "Nome do Componente React (ex: MetricsCard, FileFilterBar)",
      "propsDescription": "Props sugeridas (ex: title, value, changePercentage, icon)",
      "tailwindClassHints": "Classes Tailwind CSS sugeridas (ex: bg-white rounded-xl shadow-sm border border-slate-200 p-6)"
    }
  ],
  "recommendations": [
    "Boas práticas de acessibilidade, estados de carregamento, validações e responsividade"
  ]
}

Responda APENAS com o JSON válido, sem blocos de código adicionais além do JSON.`;

      const contents: any[] = [];

      if (imageBase64 && (mimeType?.startsWith('image/') || mimeType === 'application/pdf')) {
        contents.push({
          inlineData: {
            data: imageBase64,
            mimeType: mimeType || 'image/png',
          },
        });
      }

      contents.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (err) {
        // clean possible markdown codeblocks if any
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleaned);
      }

      return res.json({ success: true, analysis: parsedData });
    } catch (error: any) {
      console.error('Erro na análise com Gemini:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao processar a análise com IA.',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
