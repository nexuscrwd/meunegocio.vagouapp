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

  // 2. Routes API v2 — computeRoutes + /api/geo/route (Real route, polyline, and turn-by-turn steps)
  app.post(['/api/maps/compute-route', '/api/geo/route'], async (req, res) => {
    const mapsKey = getMapsApiKey();
    const {
      originLat,
      originLng,
      originAddress,
      destLat,
      destLng,
      destAddress,
      travelMode = 'DRIVE',
    } = req.body || {};

    const safeOriginLat =
      typeof originLat === 'number' && !Number.isNaN(originLat) ? originLat : -23.5505;
    const safeOriginLng =
      typeof originLng === 'number' && !Number.isNaN(originLng) ? originLng : -46.6333;
    const safeDestLat =
      typeof destLat === 'number' && !Number.isNaN(destLat) ? destLat : -23.5621;
    const safeDestLng =
      typeof destLng === 'number' && !Number.isNaN(destLng) ? destLng : -46.4795;

    const isGenericAddress = (addr?: string) => {
      const clean = String(addr || '').trim().toLowerCase();
      return (
        !clean ||
        clean.includes('endereço de saída') ||
        clean.includes('endereco de saida') ||
        clean.includes('estabelecimento') ||
        clean.includes('endereço residencial')
      );
    };

    const buildWaypoint = (lat: number, lng: number, address?: string) => {
      if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        return {
          location: {
            latLng: { latitude: lat, longitude: lng },
          },
        };
      }
      if (!isGenericAddress(address)) {
        return { address: String(address) };
      }
      return {
        location: {
          latLng: { latitude: lat, longitude: lng },
        },
      };
    };

    const normalizedMode = ['DRIVE', 'TWO_WHEELER', 'BICYCLE', 'WALK', 'TRANSIT'].includes(
      String(travelMode).toUpperCase()
    )
      ? String(travelMode).toUpperCase()
      : 'DRIVE';

    if (mapsKey) {
      try {
        const bodyPayload: Record<string, any> = {
          origin: buildWaypoint(safeOriginLat, safeOriginLng, originAddress),
          destination: buildWaypoint(safeDestLat, safeDestLng, destAddress),
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

        const reqReferer = req.headers.referer || req.headers.origin || '';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-FieldMask': fieldMask,
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        };
        if (reqReferer) {
          headers['Referer'] = String(reqReferer);
        }

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
        });

        const data = await response.json();
        if (response.ok && data?.routes?.[0]?.polyline?.encodedPolyline) {
          return res.json(data);
        }
      } catch {}
    }

    // Fallback de Malha Viária Real (OSRM Road Network) caso a chave tenha restrição de Referer HTTP ou Routes API v2 falhe
    try {
      const osrmProfile =
        normalizedMode === 'WALK'
          ? 'foot'
          : normalizedMode === 'BICYCLE'
          ? 'bike'
          : 'driving';
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${safeOriginLng},${safeOriginLat};${safeDestLng},${safeDestLat}?overview=full&geometries=polyline&steps=true`;
      const osrmRes = await fetch(osrmUrl);
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        const osrmRoute = osrmData?.routes?.[0];
        if (osrmRoute?.geometry) {
          const osrmLeg = osrmRoute.legs?.[0];
          const osrmSteps = Array.isArray(osrmLeg?.steps) ? osrmLeg.steps : [];
          return res.json({
            routes: [
              {
                distanceMeters: Math.round(Number(osrmRoute.distance || 3200)),
                duration: `${Math.round(Number(osrmRoute.duration || 840))}s`,
                description: osrmLeg?.summary || 'Trajeto Viário Principal',
                polyline: {
                  encodedPolyline: osrmRoute.geometry,
                },
                legs: [
                  {
                    distanceMeters: Math.round(Number(osrmRoute.distance || 3200)),
                    duration: `${Math.round(Number(osrmRoute.duration || 840))}s`,
                    steps: osrmSteps
                      .filter((st: any) => Number(st?.distance || 0) > 15)
                      .map((st: any, idx: number) => ({
                        distanceMeters: Math.round(Number(st.distance || 0)),
                        staticDuration: `${Math.round(Number(st.duration || 0))}s`,
                        navigationInstruction: {
                          instructions: st.name
                            ? `Siga por ${st.name}`
                            : `Continue pelo trecho ${idx + 1}`,
                          maneuver: 'STRAIGHT',
                        },
                      })),
                  },
                ],
              },
            ],
          });
        }
      }
    } catch {}

    return res.status(503).json({ error: 'Não foi possível calcular a malha viária da rota' });
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
    const reqReferer = String(req.headers.referer || req.headers.origin || '');

    try {
      const rawLat = Number(req.query.lat);
      const rawLng = Number(req.query.lng);
      if (Number.isNaN(rawLat) || Number.isNaN(rawLng)) {
        return res.status(400).json({ error: 'Coordenadas inválidas' });
      }

      let snappedLat = rawLat;
      let snappedLng = rawLng;
      const gHeaders: Record<string, string> = {};
      if (reqReferer) gHeaders['Referer'] = reqReferer;

      // Step A: Snap to nearest road via Roads API
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
              snappedLat = firstPoint.latitude;
              snappedLng = firstPoint.longitude;
            }
          }
        } catch {}
      }

      // Step B: Reverse Geocode snapped coordinate to get street name (Camada 1: Google Geocoding API)
      let streetName = '';
      let formattedAddress = '';
      if (mapsKey) {
        try {
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${snappedLat},${snappedLng}&language=pt-BR&key=${encodeURIComponent(mapsKey)}`,
            { headers: gHeaders }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const firstResult = geoData?.results?.[0];
            if (firstResult) {
              formattedAddress = firstResult.formatted_address || '';
              const routeComp = (firstResult.address_components || []).find(
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

      // Step C: Fallback Reverse Geocode via Nominatim OpenStreetMap
      if (!formattedAddress) {
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
              snappedLat
            )}&lon=${encodeURIComponent(snappedLng)}&zoom=18&addressdetails=1`,
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

  // 6. Geocodificação em 3 Camadas (/api/geo/geocode: Google Geocoding API com Referer ➔ Nominatim ➔ BrasilAPI v2)
  app.post('/api/geo/geocode', async (req, res) => {
    const mapsKey = getMapsApiKey();
    const {
      address = '',
      streetNumber = '',
      neighborhood = '',
      city = '',
      state = 'SP',
      cep = '',
    } = req.body || {};

    const cleanCep = String(cep || '').replace(/\D/g, '');
    const queryParts = [
      address ? `${address}${streetNumber ? `, ${streetNumber}` : ''}` : '',
      neighborhood,
      city,
      state,
      cleanCep ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5, 8)}` : '',
      'Brasil',
    ]
      .map((p) => String(p || '').trim())
      .filter(Boolean);
    const fullQuery = queryParts.join(', ');
    const reqReferer = String(req.headers.referer || req.headers.origin || '');

    // Camada 1: Google Geocoding API (com cabeçalho Referer encaminhado)
    if (mapsKey && fullQuery) {
      try {
        const headers: Record<string, string> = {};
        if (reqReferer) headers['Referer'] = reqReferer;

        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            fullQuery
          )}&language=pt-BR&region=br&key=${encodeURIComponent(mapsKey)}`,
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

    // Camada 2: Nominatim OpenStreetMap
    if (fullQuery) {
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(
            fullQuery
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

    // Camada 3: BrasilAPI v2 (CEP com coordenadas)
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
