import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Box,
  Camera,
  ChevronDown,
  ChevronUp,
  Coffee,
  Eye,
  RotateCw,
  Scissors,
  Sliders,
  Sparkles,
  Sun,
} from 'lucide-react';
import { hapticLight, hapticMedium } from '../../utils/haptics';

export interface SalonStudio3DViewProps {
  salonName: string;
  category?: string;
  accentColor?: string;
  isDark?: boolean;
  onSelectStationForBooking?: (stationLabel: string) => void;
}

type CameraPresetKey = 'overview' | 'station1' | 'station2' | 'lounge';
type LightingModeKey = 'warm' | 'emerald' | 'daylight';

interface StationMeta {
  key: CameraPresetKey;
  title: string;
  subtitle: string;
  badge: string;
  cameraPos: [number, number, number];
  targetPos: [number, number, number];
}

const STATION_PRESETS: Record<CameraPresetKey, StationMeta> = {
  overview: {
    key: 'overview',
    title: 'Visão Geral do Estúdio',
    subtitle: 'Toque em uma cadeira ou bancada 3D para inspecionar',
    badge: 'PBR 3D',
    cameraPos: [0, 3.3, 5.4],
    targetPos: [0, 1.05, -0.4],
  },
  station1: {
    key: 'station1',
    title: 'Estação VIP 01 • Cadeira Hidráulica',
    subtitle: 'Couro legítimo, pistão cromado e espelho LED camarim',
    badge: 'Cadeira 01',
    cameraPos: [-1.35, 1.85, 2.35],
    targetPos: [-1.45, 1.1, -0.9],
  },
  station2: {
    key: 'station2',
    title: 'Estação Master 02 • Bancada & Espelho',
    subtitle: 'Bancada em mármore escuro, secador pro e iluminação dedicada',
    badge: 'Cadeira 02',
    cameraPos: [1.35, 1.85, 2.35],
    targetPos: [1.45, 1.1, -0.9],
  },
  lounge: {
    key: 'lounge',
    title: 'Recepção & Lounge Café Espresso',
    subtitle: 'Balcão ripado chanfrado, café gourmet e espera climatizada',
    badge: 'Lounge VIP',
    cameraPos: [2.5, 1.95, 2.9],
    targetPos: [0.0, 0.95, 1.15],
  },
};

export const SalonStudio3DView: React.FC<SalonStudio3DViewProps> = ({
  salonName,
  accentColor = '#20C933',
  isDark = true,
  onSelectStationForBooking,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [activePreset, setActivePreset] = useState<CameraPresetKey>('overview');
  const [lightingMode, setLightingMode] = useState<LightingModeKey>('warm');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [isChairReclined, setIsChairReclined] = useState<boolean>(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);

  // Refs sincronizadas com o loop Three.js
  const targetCamPosRef = useRef<THREE.Vector3>(
    new THREE.Vector3(...STATION_PRESETS.overview.cameraPos)
  );
  const targetLookAtRef = useRef<THREE.Vector3>(
    new THREE.Vector3(...STATION_PRESETS.overview.targetPos)
  );
  const isTransitioningCameraRef = useRef<boolean>(false);
  const autoRotateRef = useRef<boolean>(true);
  const reclinedRef = useRef<boolean>(false);
  const lightingModeRef = useRef<LightingModeKey>('warm');
  const requestRenderRef = useRef<(() => void) | null>(null);

  const handleSelectPreset = (presetKey: CameraPresetKey) => {
    hapticLight();
    setActivePreset(presetKey);
    const meta = STATION_PRESETS[presetKey];
    targetCamPosRef.current.set(...meta.cameraPos);
    targetLookAtRef.current.set(...meta.targetPos);
    isTransitioningCameraRef.current = true;
    if (presetKey !== 'overview') {
      setAutoRotate(false);
      autoRotateRef.current = false;
    }
    requestRenderRef.current?.();
  };

  const handleToggleAutoRotate = () => {
    hapticLight();
    const next = !autoRotate;
    setAutoRotate(next);
    autoRotateRef.current = next;
    requestRenderRef.current?.();
  };

  const handleToggleRecline = () => {
    hapticMedium();
    const next = !isChairReclined;
    setIsChairReclined(next);
    reclinedRef.current = next;
    requestRenderRef.current?.();
  };

  const handleCycleLighting = () => {
    hapticLight();
    const order: LightingModeKey[] = ['warm', 'emerald', 'daylight'];
    const next = order[(order.indexOf(lightingMode) + 1) % order.length];
    setLightingMode(next);
    lightingModeRef.current = next;
    requestRenderRef.current?.();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(280, container.clientWidth);
    const height = Math.max(260, container.clientHeight);

    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    const dbg = probeGl?.getExtension('WEBGL_debug_renderer_info');
    const rendererInfo = dbg ? String(probeGl?.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(rendererInfo);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d14);
    scene.fog = new THREE.FogExp2(0x090d14, 0.065);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 60);
    camera.position.set(...STATION_PRESETS.overview.cameraPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minPolarAngle = 0.25;
    controls.minDistance = 1.6;
    controls.maxDistance = 8.5;
    controls.target.set(...STATION_PRESETS.overview.targetPos);
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 0.75;

    // Materiais PBR Reutilizáveis (Studio Palette)
    const brandColor = new THREE.Color(accentColor || '#20C933');
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111722,
      roughness: 0.72,
      metalness: 0.12,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x161f2e,
      roughness: 0.82,
      metalness: 0.08,
    });
    const woodSlatsMat = new THREE.MeshStandardMaterial({
      color: 0x4a2f1d,
      roughness: 0.52,
      metalness: 0.08,
    });
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.12,
      clearcoat: 0.6,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.82,
      roughness: 0.28,
    });
    const leatherMat = new THREE.MeshPhysicalMaterial({
      color: 0x18181b,
      roughness: 0.36,
      metalness: 0.06,
      clearcoat: 0.28,
      clearcoatRoughness: 0.35,
      sheen: 0.55,
      sheenColor: new THREE.Color(0x3f3f46),
    });
    const camelLeatherMat = new THREE.MeshPhysicalMaterial({
      color: 0x7c4a27,
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 0.22,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xa16207),
    });
    const mirrorGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.98,
      roughness: 0.03,
      clearcoat: 1.0,
      envMapIntensity: 1.5,
    });
    const ledAccentMat = new THREE.MeshStandardMaterial({
      color: brandColor,
      emissive: brandColor,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const marbleMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.18,
      metalness: 0.15,
      clearcoat: 0.8,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.55,
      metalness: 0.05,
    });

    // 1. Arquitetura do Estúdio (Piso, Tapete Central, Parede de Fundo com Ripado)
    const studioGroup = new THREE.Group();
    scene.add(studioGroup);

    const floorGeo = new THREE.CylinderGeometry(5.2, 5.4, 0.14, 48);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.07;
    floorMesh.receiveShadow = true;
    studioGroup.add(floorMesh);

    // Anel LED de borda do palco
    const stageRingGeo = new THREE.TorusGeometry(4.95, 0.025, 12, 64);
    const stageRing = new THREE.Mesh(stageRingGeo, ledAccentMat);
    stageRing.rotation.x = Math.PI / 2;
    stageRing.position.y = 0.01;
    studioGroup.add(stageRing);

    // Parede principal traseira
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.1, 0.18), wallMat);
    backWall.position.set(0, 1.55, -2.15);
    backWall.receiveShadow = true;
    backWall.castShadow = true;
    studioGroup.add(backWall);

    // Painel ripado arquitetônico (16 ripas verticais de madeira nobre)
    const slatsGroup = new THREE.Group();
    const slatGeo = new THREE.BoxGeometry(0.07, 2.95, 0.06);
    for (let i = -14; i <= 14; i++) {
      if (Math.abs(i) >= 4 && Math.abs(i) <= 11) continue; // Espaço para os espelhos
      const slat = new THREE.Mesh(slatGeo, woodSlatsMat);
      slat.position.set(i * 0.2, 1.52, -2.03);
      slat.castShadow = true;
      slatsGroup.add(slat);
    }
    studioGroup.add(slatsGroup);

    // 2. Função construtora de Bancada + Espelho Camarim (7 sub-partes compostas)
    const interactiveObjects: THREE.Object3D[] = [];

    function buildMirrorStation(xPos: number, stationKey: CameraPresetKey): THREE.Group {
      const station = new THREE.Group();
      station.position.set(xPos, 0, -1.92);
      station.userData = { presetKey: stationKey };

      // Parte 1: Halo traseiro de LED
      const ledHalo = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.78, 0.03), ledAccentMat);
      ledHalo.position.set(0, 1.72, -0.08);
      station.add(ledHalo);

      // Parte 2: Moldura chanfrada do espelho
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.06), darkMetalMat);
      frame.position.set(0, 1.72, -0.05);
      frame.castShadow = true;
      station.add(frame);

      // Parte 3: Lâmina reflexiva do espelho
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.58, 0.02), mirrorGlassMat);
      mirror.position.set(0, 1.72, -0.01);
      station.add(mirror);

      // Parte 4: Bancada suspensa em mármore escuro
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.48), marbleMat);
      counter.position.set(0, 0.82, 0.16);
      counter.castShadow = true;
      counter.receiveShadow = true;
      station.add(counter);

      // Parte 5: Gaveteiro inferior com puxador cromado
      const drawerBox = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 0.44), woodSlatsMat);
      drawerBox.position.set(0, 0.66, 0.15);
      drawerBox.castShadow = true;
      station.add(drawerBox);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 12), chromeMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, 0.66, 0.39);
      station.add(handle);

      // Parte 6 & 7: Secador profissional & organizador de ferramentas sobre a bancada
      const dryerBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.055, 0.18, 16),
        darkMetalMat
      );
      dryerBody.rotation.z = Math.PI / 2.3;
      dryerBody.position.set(0.45, 0.93, 0.2);
      station.add(dryerBody);

      const dryerHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.025, 0.14, 12),
        chromeMat
      );
      dryerHandle.position.set(0.48, 0.88, 0.2);
      station.add(dryerHandle);

      station.traverse((child) => {
        child.userData = { presetKey: stationKey };
      });
      interactiveObjects.push(station);
      return station;
    }

    studioGroup.add(buildMirrorStation(-1.45, 'station1'));
    studioGroup.add(buildMirrorStation(1.45, 'station2'));

    // 3. Função construtora de Cadeira Hidráulica de Salão/Barbearia (9 sub-partes articuladas)
    interface ArticulatedChair {
      root: THREE.Group;
      seatRig: THREE.Group;
      backrestRig: THREE.Group;
    }

    function buildHydraulicChair(xPos: number, stationKey: CameraPresetKey): ArticulatedChair {
      const root = new THREE.Group();
      root.position.set(xPos, 0, -0.75);
      root.userData = { presetKey: stationKey };

      // Parte 1: Base disco cromada chanfrada
      const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.045, 32), chromeMat);
      baseDisc.position.y = 0.022;
      baseDisc.castShadow = true;
      baseDisc.receiveShadow = true;
      root.add(baseDisc);

      // Parte 2: Pistão hidráulico telescópico
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.48, 24), chromeMat);
      piston.position.y = 0.26;
      piston.castShadow = true;
      root.add(piston);

      // Parte 3: Pedal de bombeamento hidráulico
      const pumpPedal = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.06), chromeMat);
      pumpPedal.position.set(-0.18, 0.18, -0.1);
      pumpPedal.rotation.z = 0.25;
      root.add(pumpPedal);

      // Rig superior móvel (sobe/desce e gira suavemente)
      const seatRig = new THREE.Group();
      seatRig.position.y = 0.52;
      root.add(seatRig);

      // Parte 4: Assento estofado anatômico em couro
      const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.13, 0.58), leatherMat);
      seatCushion.position.set(0, 0.06, 0);
      seatCushion.castShadow = true;
      seatCushion.receiveShadow = true;
      seatRig.add(seatCushion);

      // Parte 5 & 6: Braços laterais estofados + hastes cromadas
      [-0.34, 0.34].forEach((armX) => {
        const armSupport = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.24, 16),
          chromeMat
        );
        armSupport.position.set(armX, 0.18, 0.05);
        seatRig.add(armSupport);

        const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.48), camelLeatherMat);
        armPad.position.set(armX, 0.3, 0.02);
        armPad.castShadow = true;
        seatRig.add(armPad);
      });

      // Parte 7: Apoio de pés dianteiro em aço escovado
      const footrestLegL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.38, 12),
        chromeMat
      );
      footrestLegL.position.set(-0.2, -0.16, 0.36);
      footrestLegL.rotation.x = 0.45;
      seatRig.add(footrestLegL);

      const footrestLegR = footrestLegL.clone();
      footrestLegR.position.x = 0.2;
      seatRig.add(footrestLegR);

      const footrestPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.025, 0.18),
        chromeMat
      );
      footrestPlate.position.set(0, -0.32, 0.46);
      footrestPlate.castShadow = true;
      seatRig.add(footrestPlate);

      // Parte 8 & 9: Encosto reclinável articulado + Apoio de cabeça ajustável
      const backrestRig = new THREE.Group();
      backrestRig.position.set(0, 0.12, -0.26);
      seatRig.add(backrestRig);

      const backrestCushion = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.56, 0.11),
        leatherMat
      );
      backrestCushion.position.set(0, 0.28, 0);
      backrestCushion.castShadow = true;
      backrestRig.add(backrestCushion);

      const headrest = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.075, 0.24, 8, 16),
        camelLeatherMat
      );
      headrest.rotation.z = Math.PI / 2;
      headrest.position.set(0, 0.66, 0.02);
      headrest.castShadow = true;
      backrestRig.add(headrest);

      root.traverse((child) => {
        child.userData = { presetKey: stationKey };
      });
      interactiveObjects.push(root);

      return { root, seatRig, backrestRig };
    }

    const chair1 = buildHydraulicChair(-1.45, 'station1');
    const chair2 = buildHydraulicChair(1.45, 'station2');
    studioGroup.add(chair1.root);
    studioGroup.add(chair2.root);

    // 4. Recepção & Lounge Café Central/Frontal (7 sub-partes compostas)
    const loungeGroup = new THREE.Group();
    loungeGroup.position.set(0, 0, 1.15);
    loungeGroup.userData = { presetKey: 'lounge' as CameraPresetKey };

    const deskBody = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.92, 0.52), woodSlatsMat);
    deskBody.position.set(0, 0.46, 0);
    deskBody.castShadow = true;
    deskBody.receiveShadow = true;
    loungeGroup.add(deskBody);

    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.06, 0.58), marbleMat);
    deskTop.position.set(0, 0.95, 0);
    deskTop.castShadow = true;
    loungeGroup.add(deskTop);

    const deskLedStrip = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.025, 0.54), ledAccentMat);
    deskLedStrip.position.set(0, 0.9, 0.01);
    loungeGroup.add(deskLedStrip);

    // Máquina de Café Espresso Cromada na Recepção
    const espressoMachine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.26), chromeMat);
    espressoMachine.position.set(-0.42, 1.12, 0);
    espressoMachine.castShadow = true;
    loungeGroup.add(espressoMachine);

    // Vaso arquitetônico + planta ornamental
    const planterPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.42, 20),
      darkMetalMat
    );
    planterPot.position.set(1.25, 0.21, 0.15);
    planterPot.castShadow = true;
    loungeGroup.add(planterPot);

    const plantFoliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), foliageMat);
    plantFoliage.position.set(1.25, 0.58, 0.15);
    plantFoliage.castShadow = true;
    loungeGroup.add(plantFoliage);

    loungeGroup.traverse((child) => {
      child.userData = { presetKey: 'lounge' as CameraPresetKey };
    });
    interactiveObjects.push(loungeGroup);
    studioGroup.add(loungeGroup);

    // 5. Luminárias Pendentes de Teto + Sistema de Iluminação Studio
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(3.5, 5.5, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    const d = 4.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const accentPointLight = new THREE.PointLight(brandColor, 2.4, 9, 1.8);
    accentPointLight.position.set(0, 2.4, -1.5);
    scene.add(accentPointLight);

    const fillLight = new THREE.HemisphereLight(0xe2e8f0, 0x0f172a, 0.65);
    scene.add(fillLight);

    // Raycasting para seleção interativa de estações (sem conflito com arrasto de câmera)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Foi rotação de câmera, não clique

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveObjects, true);
      if (hits.length > 0) {
        const hitPreset = hits[0].object.userData?.presetKey as CameraPresetKey | undefined;
        if (hitPreset && STATION_PRESETS[hitPreset]) {
          handleSelectPreset(hitPreset);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // Loop de Renderização com amortecimento exponencial e guarda para Software WebGL
    const clock = new THREE.Clock();
    let animFrameId = 0;
    let isDisposed = false;

    const renderFrame = () => {
      if (isDisposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // 1. Transição suave de câmera quando um preset ou objeto é clicado
      if (isTransitioningCameraRef.current) {
        const damp = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(targetCamPosRef.current, damp);
        controls.target.lerp(targetLookAtRef.current, damp);
        if (
          camera.position.distanceTo(targetCamPosRef.current) < 0.03 &&
          controls.target.distanceTo(targetLookAtRef.current) < 0.03
        ) {
          isTransitioningCameraRef.current = false;
        }
      }

      // 2. Animação articulada das cadeiras hidráulicas (Reclinar + Elevação Hidráulica)
      const targetBackrestRot = reclinedRef.current ? -0.42 : -0.08;
      const targetSeatHeight = reclinedRef.current ? 0.59 : 0.52;
      const chairDamp = 1 - Math.exp(-6 * dt);

      [chair1, chair2].forEach((ch, idx) => {
        ch.backrestRig.rotation.x = THREE.MathUtils.lerp(
          ch.backrestRig.rotation.x,
          targetBackrestRot,
          chairDamp
        );
        ch.seatRig.position.y = THREE.MathUtils.lerp(
          ch.seatRig.position.y,
          targetSeatHeight,
          chairDamp
        );
        if (!isSoftwareGl) {
          ch.seatRig.rotation.y = Math.sin(elapsed * 0.7 + idx * 1.4) * 0.12;
        }
      });

      // 3. Presets de Iluminação do Estúdio
      const mode = lightingModeRef.current;
      if (mode === 'warm') {
        keyLight.color.setHex(0xfff1e0);
        keyLight.intensity = 2.2;
        accentPointLight.color.copy(brandColor);
        accentPointLight.intensity = 2.2;
      } else if (mode === 'emerald') {
        keyLight.color.setHex(0xa7f3d0);
        keyLight.intensity = 1.4;
        accentPointLight.color.setHex(0x10b981);
        accentPointLight.intensity = 3.8;
      } else {
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 3.1;
        accentPointLight.color.setHex(0x38bdf8);
        accentPointLight.intensity = 1.6;
      }

      controls.autoRotate = autoRotateRef.current && !isTransitioningCameraRef.current;
      controls.update();

      renderer.render(scene, camera);
      afterDraw();
    };

    function afterDraw() {
      if (!isSoftwareGl && !isDisposed) {
        animFrameId = requestAnimationFrame(renderFrame);
      }
    }

    const requestRender = () => {
      if (isSoftwareGl && !isDisposed) {
        cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(renderFrame);
      }
    };
    requestRenderRef.current = requestRender;

    controls.addEventListener('change', () => {
      if (isSoftwareGl) requestRender();
    });

    // Primeiro frame imediato
    renderFrame();

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = Math.max(280, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, [accentColor]);

  const currentStation = STATION_PRESETS[activePreset];

  return (
    <div
      className={`relative w-full h-[350px] sm:h-[390px] rounded-[4px] overflow-hidden border flex flex-col justify-between select-none ${
        isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-900'
      }`}
    >
      {/* Palco WebGL Three.js */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* HUD Superior Compacto (Sem backdrop-filter sobre WebGL para máxima performance GPU) */}
      <div className="relative z-10 p-2.5 flex items-start justify-between gap-2 pointer-events-none">
        <div className="bg-slate-950/90 border border-slate-800 rounded-[4px] px-2.5 py-1.5 max-w-[72%] pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold text-white truncate">
              {currentStation.title}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">
            {currentStation.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            type="button"
            onClick={handleCycleLighting}
            className="px-2 py-1.5 rounded-[4px] bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap transition"
            title="Alternar iluminação do estúdio"
          >
            <Sun className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              {lightingMode === 'warm'
                ? 'Luz Quente'
                : lightingMode === 'emerald'
                ? 'Luz Neon'
                : 'Luz Dia'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleAutoRotate}
            className={`p-1.5 rounded-[4px] border transition cursor-pointer ${
              autoRotate
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-slate-950/90 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Alternar giro automático 360°"
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'text-white' : 'text-emerald-400'}`} />
          </button>
        </div>
      </div>

      {/* Dock Inferior Retrátil de Câmeras & Interação 3D (Sólido escuro sem backdrop-filter sobre WebGL) */}
      <div className="relative z-10 m-2 bg-slate-950/95 border border-slate-800 rounded-[4px] transition-all">
        <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">
              Tour 3D • {salonName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleRecline}
              className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap transition ${
                isChairReclined
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Sliders className={`w-3 h-3 ${isChairReclined ? 'text-white' : 'text-emerald-400'}`} />
              <span className={isChairReclined ? 'text-white' : ''}>
                {isChairReclined ? 'Cadeira Reclinada' : 'Reclinar Cadeira'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsDockCollapsed((prev) => !prev);
              }}
              className="p-1 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
              title={isDockCollapsed ? 'Expandir controles 3D' : 'Recolher controles 3D'}
            >
              {isDockCollapsed ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {!isDockCollapsed && (
          <div className="p-2 space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { key: 'overview', label: 'Geral', Icon: Eye },
                  { key: 'station1', label: 'Cadeira 01', Icon: Scissors },
                  { key: 'station2', label: 'Cadeira 02', Icon: Sparkles },
                  { key: 'lounge', label: 'Lounge', Icon: Coffee },
                ] as const
              ).map(({ key, label, Icon }) => {
                const isSelected = activePreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPreset(key)}
                    className={`py-1.5 px-2 rounded-[4px] text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <Icon
                      className={`w-3 h-3 shrink-0 ${
                        isSelected ? 'text-white' : 'text-emerald-400'
                      }`}
                    />
                    <span className={isSelected ? 'text-white' : ''}>{label}</span>
                  </button>
                );
              })}
            </div>

            {onSelectStationForBooking && activePreset !== 'overview' && (
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  onSelectStationForBooking(currentStation.title);
                }}
                className="w-full py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Scissors className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="text-white">Reservar Horário nesta Estação</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
