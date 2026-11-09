/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SoundSystem, CHARLES_VOICE_LINES } from '../utils/audio';
import { Volume2, VolumeX, ChevronDown, ChevronUp, Eye, RotateCcw } from 'lucide-react';

import earthAlbedoUrl from '../assets/images/earth_orbital_albedo_1794203961335.jpg';
import marsAlbedoUrl from '../assets/images/mars_surface_albedo_1794203963170.jpg';
import milkyWayUrl from '../assets/images/deep_space_milkyway_1794203965838.jpg';

export type CameraPreset = 'PILOT' | 'MFD_CLOSEUP' | 'IGNITION_DECK' | 'ORBITAL_WINDOW';

export const CockpitGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [avMode, setAvMode] = useState<string>('STANDBY');
  const [gLoadText, setGLoadText] = useState<string>('1.00 G');
  const [altText, setAltText] = useState<string>('0.045 KM');
  const [velText, setVelText] = useState<string>('0.0 M/S');

  const [commMessage, setCommMessage] = useState<string>('');
  const [sopHint, setSopHint] = useState<string>('POSICIONE A PALMA NO LEITOR BIOMÉTRICO CENTRAL');
  const [scanPercent, setScanPercent] = useState<number | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPreset>('PILOT');

  // Callbacks e refs para sincronizar com o loop WebGL sem re-renderizar o canvas
  const cameraPresetRef = useRef<CameraPreset>('PILOT');
  const charlesSpeakingRef = useRef<boolean>(false);
  const triggerResetRef = useRef<(() => void) | null>(null);
  const quickActionRef = useRef<((action: 'SCAN' | 'COVER' | 'IGNITE') => void) | null>(null);

  const transmitCharles = useCallback((msg: string) => {
    SoundSystem.transmitCharles(
      msg,
      (txt) => setCommMessage(txt),
      (speaking) => {
        charlesSpeakingRef.current = speaking;
      }
    );
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    SoundSystem.setMuted(next);
  };

  const handleCameraPreset = (preset: CameraPreset) => {
    setActiveCameraPreset(preset);
    cameraPresetRef.current = preset;
  };

  useEffect(() => {
    // Pré-carrega as falas neurais humanas do Charles via Gemini 3.8 TTS
    SoundSystem.prefetchNeuralLines();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 1. Detecção de Software WebGL (SwiftShader / llvmpipe) conforme diretrizes Three.js
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    /* =========================================================================
       MOTOR GRÁFICO THREE.JS: PBR REALISTA, ROOM ENVIRONMENT & ACES FILMIC
       ========================================================================= */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010204);
    scene.fog = new THREE.FogExp2(0x010204, 0.00045);

    const camera = new THREE.PerspectiveCamera(
      58,
      container.clientWidth / container.clientHeight,
      0.04,
      4500
    );
    const pilotEyePos = new THREE.Vector3(0, 1.28, 0.02);
    const currentBaseCamPos = pilotEyePos.clone();
    camera.position.copy(pilotEyePos);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // Reflexos físicos realistas em metais usinados e vidro (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // Controles de câmera suaves para Desktop e Mobile
    const controls = new OrbitControls(camera, renderer.domElement);
    const defaultTarget = new THREE.Vector3(0, 1.06, -0.65);
    controls.target.copy(defaultTarget);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 0.25;
    controls.maxDistance = 0.95;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = -0.35;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.minAzimuthAngle = -Math.PI * 0.45;
    controls.maxAzimuthAngle = Math.PI * 0.45;
    controls.update();

    // Botão Nativo WebXR (Meta Quest)
    let vrBtn: HTMLElement | null = null;
    try {
      vrBtn = VRButton.createButton(renderer);
      vrBtn.style.bottom = '18px';
      vrBtn.style.right = '18px';
      vrBtn.style.left = 'auto';
      vrBtn.style.zIndex = '30';
      container.appendChild(vrBtn);
    } catch {
      // WebXR indisponível neste dispositivo
    }

    /* =========================================================================
       ILUMINAÇÃO SOLAR ORBITAL & AMBIENTAÇÃO INTERNA DA CÁPSULA
       ========================================================================= */
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.35);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5ea, 3.2);
    sunLight.position.set(18, 32, -25);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 120;
    const d = 4;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const cabinUtilityLight = new THREE.PointLight(0xd9ecff, 0.14, 4.2);
    cabinUtilityLight.position.set(0, 1.75, -0.22);
    scene.add(cabinUtilityLight);

    const footwellLight = new THREE.PointLight(0x0284c7, 0.25, 2.5);
    footwellLight.position.set(0, 0.45, -0.35);
    scene.add(footwellLight);

    const engineReflectionLight = new THREE.PointLight(0xff7722, 0.0, 8.0);
    engineReflectionLight.position.set(0, -0.4, 0.6);
    scene.add(engineReflectionLight);

    /* =========================================================================
       TEXTURAS PROCEDURAIS PBR DE ALTA PRECISÃO + MAPAS DE SATÉLITE 8K
       ========================================================================= */
    function createBrushedMetalTexture() {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#1e242c';
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 18000; i++) {
        const y = Math.random() * 512;
        const len = 12 + Math.random() * 85;
        const x = Math.random() * 512;
        const alpha = 0.02 + Math.random() * 0.05;
        ctx.fillStyle =
          Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(x, y, len, 1);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createCarbonMatteTexture() {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#12161d';
      ctx.fillRect(0, 0, 256, 256);

      ctx.fillStyle = '#181e27';
      for (let y = 0; y < 256; y += 8) {
        for (let x = 0; x < 256; x += 8) {
          if ((x / 8 + y / 8) % 2 === 0) {
            ctx.fillRect(x, y, 8, 8);
          }
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(18, 18);
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createEarthProceduralFallback() {
      const c = document.createElement('canvas');
      c.width = 2048;
      c.height = 1024;
      const ctx = c.getContext('2d')!;

      const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      oceanGrad.addColorStop(0, '#061733');
      oceanGrad.addColorStop(0.5, '#0a2659');
      oceanGrad.addColorStop(1, '#051126');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      ctx.fillStyle = '#243c2e';
      for (let i = 0; i < 90; i++) {
        const cx = Math.random() * 2048;
        const cy = 180 + Math.random() * 660;
        const rad = 55 + Math.random() * 150;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad * 1.5, rad, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(240, 248, 255, 0.45)';
      for (let i = 0; i < 180; i++) {
        const nx = Math.random() * 2048;
        const ny = 90 + Math.random() * 840;
        const nrad = 35 + Math.random() * 115;
        ctx.beginPath();
        ctx.arc(nx, ny, nrad, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    const metalTex = createBrushedMetalTexture();
    const carbonTex = createCarbonMatteTexture();
    const textureLoader = new THREE.TextureLoader();

    /* =========================================================================
       EXTERIOR ESPACIAL: TERRA FOTORREALISTA, SHADER RAYLEIGH, MARTE E VIA LÁCTEA
       ========================================================================= */
    const earthGeometry = new THREE.SphereGeometry(120, 64, 64);
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: createEarthProceduralFallback(),
      roughness: 0.68,
      metalness: 0.12,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.position.set(0, -145, -85);
    earthMesh.rotation.x = 0.35;
    scene.add(earthMesh);

    // Aplica a imagem de satélite 8K gerada para o Planeta Terra
    textureLoader.load(earthAlbedoUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      earthMaterial.map = tex;
      earthMaterial.needsUpdate = true;
    });

    // Halo de dispersão atmosférica Rayleigh (Fresnel físico)
    const atmosGeometry = new THREE.SphereGeometry(122.8, 64, 64);
    const atmosMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.22, 0.62, 0.98, 1.0) * intensity * 1.55;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
    earthMesh.add(atmosMesh);

    // Campo Estelar de Alta Resolução (Classes Espectrais O, B, A, G, M)
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 3500;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const spectralClasses = [
      new THREE.Color(0xaabbff), // Classe B (Azulada)
      new THREE.Color(0xffffff), // Classe A (Branca pura)
      new THREE.Color(0xffeedd), // Classe G (Solar)
      new THREE.Color(0xffbb88), // Classe M (Alaranjada/Vermelha)
    ];

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 1800;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 1800;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 1800;

      const c = spectralClasses[Math.floor(Math.random() * spectralClasses.length)];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 1.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // Fundo Nebulosa da Via Láctea no Espaço Profundo
    const milkyWayPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 900),
      new THREE.MeshBasicMaterial({
        color: 0x334455,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })
    );
    milkyWayPlane.position.set(0, 180, -1400);
    scene.add(milkyWayPlane);

    textureLoader.load(milkyWayUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      (milkyWayPlane.material as THREE.MeshBasicMaterial).map = tex;
      (milkyWayPlane.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
      milkyWayPlane.material.needsUpdate = true;
    });

    // Planeta Marte Fotorealista com Atmosfera de Óxido de Ferro
    const marsGeometry = new THREE.SphereGeometry(24, 64, 64);
    const marsMaterial = new THREE.MeshStandardMaterial({
      color: 0xd46a43,
      roughness: 0.82,
      metalness: 0.08,
      emissive: 0x1a0702,
    });
    const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
    marsMesh.position.set(95, 195, -1050);
    scene.add(marsMesh);

    textureLoader.load(marsAlbedoUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      marsMaterial.map = tex;
      marsMaterial.color.setHex(0xffffff);
      marsMaterial.needsUpdate = true;
    });

    const marsAtmos = new THREE.Mesh(
      new THREE.SphereGeometry(24.9, 48, 48),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
            gl_FragColor = vec4(0.92, 0.42, 0.18, 1.0) * intensity * 1.2;
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      })
    );
    marsMesh.add(marsAtmos);

    /* =========================================================================
       TORRE DE LANÇAMENTO EXTERNA (EARTH GROUND LAUNCHPAD)
       ========================================================================= */
    const launchpadGroup = new THREE.Group();
    launchpadGroup.position.set(-1.9, 0.2, -3.4);
    scene.add(launchpadGroup);

    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x2a323d,
      metalness: 0.82,
      roughness: 0.4,
      map: metalTex,
    });
    const towerPillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.5, 0.45), towerMat);
    towerPillar.position.set(0, 1.5, 0);
    launchpadGroup.add(towerPillar);

    const umbilicalArm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.24), towerMat);
    umbilicalArm.position.set(0.8, 1.25, 1.2);
    launchpadGroup.add(umbilicalArm);

    const padBeacon = new THREE.PointLight(0xff5500, 1.5, 6);
    padBeacon.position.set(1.2, 1.4, 1.3);
    launchpadGroup.add(padBeacon);

    /* =========================================================================
       COCKPIT AEROESPACIAL: GEOMETRIA ESTRUTURAL, TITÂNIO USINADO & VIDRO BALÍSTICO
       ========================================================================= */
    const cockpitGroup = new THREE.Group();
    scene.add(cockpitGroup);

    // Casco pressurizado envolvente (Evita vazio preto ao olhar para os lados no VR)
    const hullInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x0d1219,
      roughness: 0.55,
      metalness: 0.75,
      map: carbonTex,
      side: THREE.BackSide,
    });
    const pressureDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.85, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.75),
      hullInteriorMat
    );
    pressureDome.position.set(0, 0.95, -0.1);
    cockpitGroup.add(pressureDome);

    // Para-brisa Frontal Curvo com Transparência Físico-Óptica
    const windshieldGeo = new THREE.CylinderGeometry(
      1.48,
      1.62,
      1.1,
      48,
      1,
      true,
      -Math.PI * 0.42,
      Math.PI * 0.84
    );
    const windshieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1420,
      metalness: 0.05,
      roughness: 0.04,
      transmission: isSoftwareGl ? 0 : 0.92,
      ior: 1.52,
      transparent: true,
      opacity: isSoftwareGl ? 0.22 : 0.28,
      reflectivity: 0.4,
      depthWrite: false,
    });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0, 1.35, -0.62);
    windshield.rotation.x = -0.28;
    windshield.renderOrder = 2;
    cockpitGroup.add(windshield);

    // Pilares Estruturais em Titânio Usinado
    const canopyFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1b222c,
      roughness: 0.42,
      metalness: 0.88,
      map: metalTex,
    });
    const mainArch = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.048, 16, 48, Math.PI),
      canopyFrameMat
    );
    mainArch.position.set(0, 1.28, -0.65);
    mainArch.rotation.x = 0.25;
    cockpitGroup.add(mainArch);

    // Pilares Laterais Esquerdo e Direito + Alças de Apoio Zero-G
    const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 1.2, 16), canopyFrameMat);
    leftPillar.position.set(-0.98, 1.32, -0.68);
    leftPillar.rotation.z = -0.28;
    leftPillar.rotation.x = 0.22;
    cockpitGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 1.2, 16), canopyFrameMat);
    rightPillar.position.set(0.98, 1.32, -0.68);
    rightPillar.rotation.z = 0.28;
    rightPillar.rotation.x = 0.22;
    cockpitGroup.add(rightPillar);

    // Parafusos Aeroespaciais Hexagonais nos Pilares (InstancedMesh para performance)
    const boltGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.006, 6);
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.92,
      roughness: 0.18,
    });
    const boltCount = 13;
    const boltInstanced = new THREE.InstancedMesh(boltGeo, boltMat, boltCount);
    const dummy = new THREE.Object3D();
    for (let i = -6; i <= 6; i++) {
      const idx = i + 6;
      const angle = (i / 7) * (Math.PI * 0.45);
      dummy.position.set(
        Math.sin(angle) * 1.52,
        1.28 + Math.cos(angle) * 1.52,
        -0.65
      );
      dummy.rotation.set(0, 0, angle);
      dummy.updateMatrix();
      boltInstanced.setMatrixAt(idx, dummy.matrix);
    }
    boltInstanced.computeBoundingSphere();
    cockpitGroup.add(boltInstanced);

    // Assento Anatômico do Comandante (Visível ao olhar para baixo em VR)
    const pilotSeatGroup = new THREE.Group();
    pilotSeatGroup.position.set(0, 0.55, 0.08);
    const seatMat = new THREE.MeshStandardMaterial({
      color: 0x161c26,
      roughness: 0.7,
      metalness: 0.2,
    });
    const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.54), seatMat);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.85, 0.1), seatMat);
    seatBack.position.set(0, 0.42, 0.24);
    seatBack.rotation.x = -0.12;
    pilotSeatGroup.add(seatCushion, seatBack);
    cockpitGroup.add(pilotSeatGroup);

    // Mesa Principal do Console Ergonômico + Coifa Antirreflexo (Glare Shield)
    const consoleGeo = new THREE.BoxGeometry(1.72, 0.32, 0.88);
    const consoleMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.45,
      metalness: 0.75,
      map: carbonTex,
    });
    const consoleTable = new THREE.Mesh(consoleGeo, consoleMat);
    consoleTable.position.set(0, 0.82, -0.58);
    consoleTable.rotation.x = 0.26;
    consoleTable.receiveShadow = true;
    cockpitGroup.add(consoleTable);

    // Coifa Superior do Painel (Glare Shield sobre os 3 MFDs)
    const glareShield = new THREE.Mesh(
      new THREE.BoxGeometry(1.66, 0.035, 0.34),
      canopyFrameMat
    );
    glareShield.position.set(0, 0.38, -0.12);
    glareShield.rotation.x = -0.15;
    consoleTable.add(glareShield);

    /* =========================================================================
       LEITOR BIOMÉTRICO ÓPTICO-CAPACITIVO (PADRÃO MILITAR MIL-AERO 810-H)
       ========================================================================= */
    function createBiometricPlateTexture() {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = '#070d14';
      ctx.fillRect(0, 0, 512, 512);

      // Malha capacitiva ultrafina
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 512; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }

      // Silhueta geométrica técnica de palma da mão
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 10;

      ctx.strokeRect(36, 36, 440, 440);

      ctx.beginPath();
      ctx.moveTo(180, 430);
      ctx.lineTo(332, 430);
      ctx.lineTo(350, 320);
      ctx.lineTo(430, 270);
      ctx.lineTo(400, 230);
      ctx.lineTo(320, 280);
      ctx.lineTo(330, 90);
      ctx.lineTo(290, 90);
      ctx.lineTo(285, 250);
      ctx.lineTo(270, 70);
      ctx.lineTo(230, 70);
      ctx.lineTo(230, 250);
      ctx.lineTo(215, 100);
      ctx.lineTo(175, 100);
      ctx.lineTo(185, 270);
      ctx.lineTo(165, 170);
      ctx.lineTo(130, 180);
      ctx.lineTo(150, 340);
      ctx.closePath();
      ctx.stroke();

      // Pontos nodais biométricos nas falanges
      const nodes = [
        [310, 95],
        [250, 75],
        [195, 105],
        [148, 178],
        [412, 250],
        [256, 345],
      ];
      ctx.fillStyle = '#38bdf8';
      nodes.forEach(([nx, ny]) => {
        ctx.beginPath();
        ctx.arc(nx, ny, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('VORTEX ID // SENSOR CAPACITIVO', 52, 72);
      ctx.fillText('PADRÃO MIL-AERO 810-H', 52, 456);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    const scannerBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.012, 0.28),
      canopyFrameMat
    );
    scannerBezel.position.set(0, 0.16, 0.16);
    consoleTable.add(scannerBezel);

    const scannerPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.255, 0.016, 0.255),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.6,
        map: createBiometricPlateTexture(),
        emissive: 0x082f49,
        emissiveIntensity: 0.55,
      })
    );
    scannerPlate.position.set(0, 0.165, 0.16);
    consoleTable.add(scannerPlate);

    const scannerLight = new THREE.PointLight(0x38bdf8, 0.9, 1.2);
    scannerLight.position.set(0, 0.24, 0.16);
    consoleTable.add(scannerLight);

    const laserBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.005, 0.012),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
    );
    laserBeam.position.set(0, 0.176, 0.05);
    laserBeam.visible = false;
    consoleTable.add(laserBeam);

    /* =========================================================================
       COPILOTO CHARLES: EMISSOR HOLOGRÁFICO ÓPTICO QUÂNTICO
       ========================================================================= */
    const charlesGroup = new THREE.Group();
    charlesGroup.position.set(0.65, 1.44, -0.64);
    charlesGroup.visible = false;
    scene.add(charlesGroup);

    const projectorMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.052, 0.06, 24),
      canopyFrameMat
    );
    projectorMount.position.copy(charlesGroup.position);
    projectorMount.position.y -= 0.12;
    scene.add(projectorMount);

    const charlesCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x0284c7,
        emissiveIntensity: 1.6,
        roughness: 0.1,
      })
    );
    charlesGroup.add(charlesCore);

    const charlesRings = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      })
    );
    charlesGroup.add(charlesRings);

    const charlesOuterGimbal = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.003, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.7 })
    );
    charlesOuterGimbal.rotation.x = Math.PI * 0.35;
    charlesGroup.add(charlesOuterGimbal);

    const charlesLight = new THREE.PointLight(0x38bdf8, 0.0, 2.5);
    charlesGroup.add(charlesLight);

    /* =========================================================================
       GLASS COCKPIT MILITAR: 3 MFDs ULTRA-DETALHADOS (60 FPS)
       ========================================================================= */
    function createMFDCanvas() {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 400;
      return c;
    }

    const canvasLeft = createMFDCanvas();
    const ctxLeft = canvasLeft.getContext('2d')!;
    const texLeft = new THREE.CanvasTexture(canvasLeft);
    texLeft.colorSpace = THREE.SRGBColorSpace;
    texLeft.anisotropy = maxAnisotropy;

    const canvasMid = createMFDCanvas();
    const ctxMid = canvasMid.getContext('2d')!;
    const texMid = new THREE.CanvasTexture(canvasMid);
    texMid.colorSpace = THREE.SRGBColorSpace;
    texMid.anisotropy = maxAnisotropy;

    const canvasRight = createMFDCanvas();
    const ctxRight = canvasRight.getContext('2d')!;
    const texRight = new THREE.CanvasTexture(canvasRight);
    texRight.colorSpace = THREE.SRGBColorSpace;
    texRight.anisotropy = maxAnisotropy;

    const mfdGeo = new THREE.PlaneGeometry(0.42, 0.26);
    const mfdBezelGeo = new THREE.BoxGeometry(0.445, 0.285, 0.018);

    const createMFDUnit = (xPos: number, tex: THREE.CanvasTexture) => {
      const bezel = new THREE.Mesh(mfdBezelGeo, canopyFrameMat);
      bezel.position.set(xPos, 0.25, -0.09);
      consoleTable.add(bezel);

      const screen = new THREE.Mesh(
        mfdGeo,
        new THREE.MeshStandardMaterial({
          roughness: 0.12,
          metalness: 0.1,
          map: tex,
          emissive: 0xffffff,
          emissiveMap: tex,
          emissiveIntensity: 0.65,
        })
      );
      screen.position.set(xPos, 0.25, -0.079);
      consoleTable.add(screen);
      return screen;
    };

    createMFDUnit(-0.52, texLeft);
    createMFDUnit(0, texMid);
    createMFDUnit(0.52, texRight);

    /* =========================================================================
       PAINEL DE COMANDOS TÁTIL AEROESPACIAL (CHAVES, CAPA, IGNIÇÃO, THROTTLE, MANCHE)
       ========================================================================= */
    const interactiveControls: THREE.Object3D[] = [];

    function createAerospaceSwitch(xPos: number, label: string) {
      const group = new THREE.Group();
      group.position.set(xPos, 0.165, 0.16);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.028, 0.014, 16),
        new THREE.MeshStandardMaterial({ color: 0x222a36, metalness: 0.8, roughness: 0.3 })
      );
      group.add(base);

      // Guarda lateral metálica (Switch Guard)
      const guardLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.004, 0.032, 0.036),
        canopyFrameMat
      );
      guardLeft.position.set(-0.024, 0.016, 0);
      const guardRight = guardLeft.clone();
      guardRight.position.x = 0.024;
      group.add(guardLeft, guardRight);

      const lever = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.008, 0.065, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 })
      );
      lever.position.set(0, 0.03, 0);
      lever.rotation.x = -Math.PI * 0.25;
      group.add(lever);

      // LED indicador de status da chave
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 12), ledMat);
      led.position.set(0, 0.008, -0.034);
      group.add(led);

      group.userData = {
        type: 'switch',
        active: false,
        leverMesh: lever,
        ledMat,
        label,
      };
      consoleTable.add(group);
      interactiveControls.push(group);
      return group;
    }

    const switchAvionics = createAerospaceSwitch(-0.36, 'AVIONICS');
    const switchHydraulics = createAerospaceSwitch(-0.26, 'RCS_ARM');

    // Capa Protetora de Ignição Articulada (Guarded Switch Cover)
    const coverPivot = new THREE.Group();
    coverPivot.position.set(0.28, 0.175, 0.13);

    const coverBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.034, 0.092),
      new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        roughness: 0.3,
        metalness: 0.25,
        transparent: true,
        opacity: 0.88,
      })
    );
    coverBox.position.set(0, 0.016, 0.04);
    coverPivot.add(coverBox);
    coverPivot.userData = { type: 'cover', isOpen: false };
    consoleTable.add(coverPivot);
    interactiveControls.push(coverPivot);

    // Base + Botão de Ignição Principal com Afundamento Físico de 10mm
    const ignCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.04, 0.012, 32),
      canopyFrameMat
    );
    ignCollar.position.set(0.28, 0.16, 0.17);
    consoleTable.add(ignCollar);

    const ignBtnMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0x250505,
      roughness: 0.25,
      metalness: 0.4,
    });
    const ignitionButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.024, 32),
      ignBtnMat
    );
    ignitionButton.position.set(0.28, 0.165, 0.17);
    ignitionButton.userData = { type: 'ignition' };
    consoleTable.add(ignitionButton);
    interactiveControls.push(ignitionButton);

    // Manete de Throttle Deslizante Contínua
    const throttleRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.016, 0.23),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.4 })
    );
    throttleRail.position.set(0.66, 0.165, 0.07);
    consoleTable.add(throttleRail);

    const throttleHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.054, 0.062, 0.048),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.85 })
    );
    throttleHandle.position.set(0.66, 0.2, 0.15);
    throttleHandle.userData = { type: 'throttle' };
    consoleTable.add(throttleHandle);
    interactiveControls.push(throttleHandle);

    // Manche Articulado 3D (FlightStick)
    const stickPivot = new THREE.Group();
    stickPivot.position.set(0, 0.18, 0.34);

    const stickBoot = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 })
    );
    stickBoot.position.set(0, 0.02, 0);
    stickPivot.add(stickBoot);

    const stickShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.015, 0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 })
    );
    stickShaft.position.set(0, 0.09, 0);
    stickPivot.add(stickShaft);

    const stickGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.092, 0.054),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.3 })
    );
    stickGrip.position.set(0, 0.09, 0);
    stickShaft.add(stickGrip);

    stickPivot.userData = { type: 'joystick' };
    consoleTable.add(stickPivot);
    interactiveControls.push(stickPivot);

    /* =========================================================================
       DINÂMICA DE VOO, EQUAÇÕES DE PROPULSÃO E TELEMETRIA (60 FPS)
       ========================================================================= */
    let systemsOnline = false;
    let mfdCascadeTime = [0, 0, 0];
    let isScanning = false;
    let scanDuration = 0;
    let lastPulseBucket = -1;

    let flightStage = 'GROUND'; // GROUND -> IGNITION -> ASCENT -> MAX_Q -> ORBIT
    let throttleTarget = 0.0;
    let throttleActual = 0.0;

    let velocity = 0.0; // km/s
    let altitude = 0.045; // km
    let gForce = 1.0; // G
    let maxQ = 0.0; // kPa
    let deltaV = 9420; // m/s
    let loxPressure = 310; // bar
    let ch4Pressure = 285; // bar

    let pitchAngle = 0.0;
    let rollAngle = 0.0;

    function completeBiometricUnlock() {
      if (systemsOnline) return;
      systemsOnline = true;
      isScanning = false;
      laserBeam.visible = false;
      setScanPercent(null);

      SoundSystem.playAwakeningSwell();

      cabinUtilityLight.intensity = 1.95;
      scannerLight.color.setHex(0x10b981);
      ignBtnMat.emissive.setHex(0xb91c1c);

      charlesGroup.visible = true;
      charlesLight.intensity = 2.2;
      transmitCharles(CHARLES_VOICE_LINES.BIOMETRIC_OK);

      const nowMs = performance.now();
      mfdCascadeTime = [nowMs, nowMs + 250, nowMs + 500];

      setAvMode('SISTEMAS ONLINE');
      setSopHint('LEVANTE A PROTEÇÃO VERMELHA E PRESSIONE A IGNIÇÃO');
    }

    function triggerEngineIgnition() {
      if (!systemsOnline) {
        transmitCharles(CHARLES_VOICE_LINES.LOCKED_WARN);
        return;
      }
      if (!coverPivot.userData.isOpen) {
        transmitCharles(CHARLES_VOICE_LINES.COVER_WARN);
        return;
      }
      if (flightStage === 'GROUND') {
        SoundSystem.playSwitchClick();
        ignitionButton.position.y = 0.155;
        setTimeout(() => {
          ignitionButton.position.y = 0.165;
        }, 180);

        // Arma automaticamente as chaves se o usuário ainda não clicou nelas
        [switchAvionics, switchHydraulics].forEach((sw) => {
          sw.userData.active = true;
          sw.userData.leverMesh.rotation.x = Math.PI * 0.25;
          sw.userData.ledMat.color.setHex(0x10b981);
        });

        flightStage = 'IGNITION';
        SoundSystem.startRocketThrust();
        throttleTarget = 1.0;
        transmitCharles(CHARLES_VOICE_LINES.IGNITION_START);
        setAvMode('PROPULSÃO ATIVA');
        setSopHint('DECOLAGEM EM CURSO // AJUSTE O THROTTLE OU MANCHE');
      }
    }

    // Ações rápidas acessíveis pelo dock inferior para acessibilidade e testes rápidos
    quickActionRef.current = (action) => {
      SoundSystem.init();
      if (action === 'SCAN') {
        completeBiometricUnlock();
      } else if (action === 'COVER') {
        SoundSystem.playCoverRelease();
        coverPivot.userData.isOpen = !coverPivot.userData.isOpen;
        coverPivot.rotation.x = coverPivot.userData.isOpen ? -Math.PI * 0.7 : 0.0;
      } else if (action === 'IGNITE') {
        if (!systemsOnline) completeBiometricUnlock();
        if (!coverPivot.userData.isOpen) {
          coverPivot.userData.isOpen = true;
          coverPivot.rotation.x = -Math.PI * 0.7;
        }
        triggerEngineIgnition();
      }
    };

    triggerResetRef.current = () => {
      SoundSystem.stopRocketThrust();
      systemsOnline = false;
      isScanning = false;
      scanDuration = 0;
      flightStage = 'GROUND';
      throttleTarget = 0.0;
      throttleActual = 0.0;
      velocity = 0.0;
      altitude = 0.045;
      gForce = 1.0;
      maxQ = 0.0;
      deltaV = 9420;
      loxPressure = 310;
      ch4Pressure = 285;
      pitchAngle = 0.0;
      rollAngle = 0.0;

      cabinUtilityLight.intensity = 0.14;
      scannerLight.color.setHex(0x38bdf8);
      ignBtnMat.emissive.setHex(0x250505);
      charlesGroup.visible = false;
      charlesLight.intensity = 0;
      coverPivot.userData.isOpen = false;
      coverPivot.rotation.x = 0;
      throttleHandle.position.z = 0.15;
      stickPivot.rotation.set(0, 0, 0);

      earthMesh.position.set(0, -145, -85);
      marsMesh.position.set(95, 195, -1050);
      launchpadGroup.position.set(-1.9, 0.2, -3.4);

      setAvMode('STANDBY');
      setCommMessage('');
      setSopHint('POSICIONE A PALMA NO LEITOR BIOMÉTRICO CENTRAL');
      setScanPercent(null);
    };

    function renderMFDScreens() {
      const now = performance.now();

      // ================= PFD-1 (ESQUERDO) =================
      const leftActive = systemsOnline && now > mfdCascadeTime[0];
      ctxLeft.fillStyle = leftActive ? '#050b14' : '#020408';
      ctxLeft.fillRect(0, 0, 640, 400);

      ctxLeft.strokeStyle = leftActive ? '#1e293b' : '#0f172a';
      ctxLeft.lineWidth = 2;
      ctxLeft.strokeRect(6, 6, 628, 388);

      ctxLeft.font = 'bold 15px monospace';
      ctxLeft.fillStyle = leftActive ? '#38bdf8' : '#334155';
      ctxLeft.fillText('PRIMARY FLIGHT DISPLAY // PFD-1', 20, 32);

      if (leftActive) {
        // Speed Tape (Esquerda)
        ctxLeft.fillStyle = '#0b1320';
        ctxLeft.fillRect(20, 50, 95, 300);
        ctxLeft.strokeStyle = '#38bdf8';
        ctxLeft.strokeRect(20, 50, 95, 300);

        ctxLeft.font = '13px monospace';
        ctxLeft.fillStyle = '#94a3b8';
        const vDisplay = velocity * 3600;
        for (let i = -3; i <= 3; i++) {
          const tickVal = Math.max(0, Math.floor(vDisplay / 500) * 500 + i * 500);
          const yPos = 200 - i * 40;
          ctxLeft.fillText(`${tickVal}`, 26, yPos + 4);
          ctxLeft.fillRect(100, yPos, 15, 2);
        }

        ctxLeft.fillStyle = '#0284c7';
        ctxLeft.fillRect(15, 185, 105, 30);
        ctxLeft.fillStyle = '#ffffff';
        ctxLeft.font = 'bold 14px monospace';
        ctxLeft.fillText(`${vDisplay.toFixed(0)} KM/H`, 20, 205);

        // Curva de Perfil de Ascensão Orbital (Centro do PFD-1)
        ctxLeft.strokeStyle = '#1e293b';
        ctxLeft.strokeRect(135, 55, 370, 240);
        ctxLeft.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctxLeft.setLineDash([4, 4]);
        ctxLeft.beginPath();
        ctxLeft.moveTo(150, 275);
        ctxLeft.quadraticCurveTo(260, 85, 490, 80);
        ctxLeft.stroke();
        ctxLeft.setLineDash([]);

        // Posição Atual da Nave na Curva TMI
        const prog = Math.min(1, altitude / 95);
        const shipX = 150 + prog * 340;
        const shipY = 275 - Math.sin(prog * Math.PI * 0.5) * 195;
        ctxLeft.fillStyle = '#4ade80';
        ctxLeft.beginPath();
        ctxLeft.arc(shipX, shipY, 6, 0, Math.PI * 2);
        ctxLeft.fill();
        ctxLeft.font = '12px monospace';
        ctxLeft.fillStyle = '#94a3b8';
        ctxLeft.fillText(`FASE: ${flightStage}`, 148, 78);
        ctxLeft.fillText('ALVO: INJEÇÃO TRANS-MARTE (TMI)', 148, 286);

        // Altitude Tape (Direita)
        ctxLeft.fillStyle = '#0b1320';
        ctxLeft.fillRect(525, 50, 95, 300);
        ctxLeft.strokeStyle = '#38bdf8';
        ctxLeft.strokeRect(525, 50, 95, 300);

        ctxLeft.fillStyle = '#94a3b8';
        for (let i = -3; i <= 3; i++) {
          const altTick = Math.max(0, altitude + i * 8);
          const yPos = 200 - i * 40;
          ctxLeft.fillText(`${altTick.toFixed(1)}k`, 538, yPos + 4);
          ctxLeft.fillRect(525, yPos, 12, 2);
        }
        ctxLeft.fillStyle = '#0284c7';
        ctxLeft.fillRect(520, 185, 105, 30);
        ctxLeft.fillStyle = '#ffffff';
        ctxLeft.font = 'bold 14px monospace';
        ctxLeft.fillText(`${altitude.toFixed(2)} KM`, 528, 205);

        ctxLeft.font = 'bold 14px monospace';
        ctxLeft.fillStyle = gForce > 3.2 ? '#ef4444' : '#4ade80';
        ctxLeft.fillText(`ACCEL: ${gForce.toFixed(2)} G`, 150, 335);

        ctxLeft.fillStyle = maxQ > 30 ? '#ef4444' : '#38bdf8';
        ctxLeft.fillText(`MAX-Q: ${maxQ.toFixed(1)} kPa`, 335, 335);
      } else {
        ctxLeft.fillStyle = '#334155';
        ctxLeft.fillText('SISTEMA INERTE // AGUARDANDO AUTENTICAÇÃO', 135, 210);
      }
      texLeft.needsUpdate = true;

      // ================= NAVBALL 3D ADI (CENTRAL) =================
      const midActive = systemsOnline && now > mfdCascadeTime[1];
      ctxMid.fillStyle = midActive ? '#050b14' : '#020408';
      ctxMid.fillRect(0, 0, 640, 400);

      ctxMid.strokeStyle = midActive ? '#1e293b' : '#0f172a';
      ctxMid.lineWidth = 2;
      ctxMid.strokeRect(6, 6, 628, 388);

      ctxMid.font = 'bold 15px monospace';
      ctxMid.fillStyle = midActive ? '#38bdf8' : '#334155';
      ctxMid.fillText('ATTITUDE DIRECTOR INDICATOR // ADI', 20, 32);

      if (midActive) {
        ctxMid.save();
        ctxMid.beginPath();
        ctxMid.arc(320, 195, 125, 0, Math.PI * 2);
        ctxMid.clip();

        ctxMid.translate(320, 195);
        ctxMid.rotate((rollAngle * Math.PI) / 180);

        const pitchOffset = pitchAngle * 2.5;

        // Céu
        ctxMid.fillStyle = '#0c2d48';
        ctxMid.fillRect(-160, -240 + pitchOffset, 320, 240);

        // Solo / Terra
        ctxMid.fillStyle = '#3b2314';
        ctxMid.fillRect(-160, pitchOffset, 320, 240);

        // Linha do Horizonte
        ctxMid.strokeStyle = '#ffffff';
        ctxMid.lineWidth = 2.5;
        ctxMid.beginPath();
        ctxMid.moveTo(-140, pitchOffset);
        ctxMid.lineTo(140, pitchOffset);
        ctxMid.stroke();

        // Pitch Ladder
        ctxMid.strokeStyle = 'rgba(255, 255, 255, 0.78)';
        ctxMid.font = '11px monospace';
        ctxMid.fillStyle = '#ffffff';
        for (let p = -60; p <= 60; p += 10) {
          if (p === 0) continue;
          const y = pitchOffset - p * 2.5;
          if (Math.abs(y) < 115) {
            ctxMid.beginPath();
            ctxMid.moveTo(-28, y);
            ctxMid.lineTo(28, y);
            ctxMid.stroke();
            ctxMid.fillText(`${p}°`, 34, y + 4);
          }
        }
        ctxMid.restore();

        // Anel Externo da NavBall
        ctxMid.strokeStyle = '#38bdf8';
        ctxMid.lineWidth = 2.5;
        ctxMid.beginPath();
        ctxMid.arc(320, 195, 125, 0, Math.PI * 2);
        ctxMid.stroke();

        // Retículo Central Fixo da Nave (Amarelo MIL-STD)
        ctxMid.strokeStyle = '#facc15';
        ctxMid.lineWidth = 3;
        ctxMid.beginPath();
        ctxMid.moveTo(265, 195);
        ctxMid.lineTo(302, 195);
        ctxMid.moveTo(338, 195);
        ctxMid.lineTo(375, 195);
        ctxMid.stroke();
        ctxMid.strokeRect(315, 190, 10, 10);

        ctxMid.font = 'bold 13px monospace';
        ctxMid.fillStyle = '#38bdf8';
        ctxMid.fillText(
          `PITCH: ${pitchAngle.toFixed(1)}°  |  ROLL: ${rollAngle.toFixed(1)}°`,
          205,
          362
        );
      } else {
        ctxMid.fillStyle = '#334155';
        ctxMid.fillText('NAVBALL DESLIGADA', 240, 210);
      }
      texMid.needsUpdate = true;

      // ================= PROPULSÃO E ECLSS (DIREITO) =================
      const rightActive = systemsOnline && now > mfdCascadeTime[2];
      ctxRight.fillStyle = rightActive ? '#050b14' : '#020408';
      ctxRight.fillRect(0, 0, 640, 400);

      ctxRight.strokeStyle = rightActive ? '#1e293b' : '#0f172a';
      ctxRight.lineWidth = 2;
      ctxRight.strokeRect(6, 6, 628, 388);

      ctxRight.font = 'bold 15px monospace';
      ctxRight.fillStyle = rightActive ? '#38bdf8' : '#334155';
      ctxRight.fillText('PROPULSION & ECLSS // SED-3', 20, 32);

      if (rightActive) {
        ctxRight.font = '14px monospace';
        ctxRight.fillStyle = '#e2e8f0';

        ctxRight.fillText(`EMPUXO PRINCIPAL : ${(throttleActual * 100).toFixed(0)} %`, 30, 76);
        ctxRight.fillStyle = '#1e293b';
        ctxRight.fillRect(30, 88, 580, 14);
        ctxRight.fillStyle = '#38bdf8';
        ctxRight.fillRect(30, 88, 580 * throttleActual, 14);

        ctxRight.fillStyle = '#e2e8f0';
        ctxRight.fillText(`DELTA-V RESIDUAL : ${deltaV.toFixed(0)} M/S`, 30, 138);
        ctxRight.fillText(`PRESSÃO TANQUE LOX: ${loxPressure.toFixed(0)} BAR`, 30, 178);
        ctxRight.fillText(`PRESSÃO TANQUE CH4: ${ch4Pressure.toFixed(0)} BAR`, 30, 218);

        ctxRight.strokeStyle = '#1e293b';
        ctxRight.strokeRect(30, 248, 580, 108);

        ctxRight.fillStyle = '#38bdf8';
        ctxRight.fillText('SUPORTE DE VIDA (ECLSS):', 45, 275);
        ctxRight.fillStyle = '#4ade80';
        ctxRight.fillText('CABINE: 101.3 kPa | pO2: 21.3 kPa | pN2: 79.5 kPa', 45, 305);
        ctxRight.fillText('TEMPERATURA INTERNA: 21.4 °C | UMIDADE: 45%', 45, 333);
      } else {
        ctxRight.fillStyle = '#334155';
        ctxRight.fillText('TELEMETRIA INDISPONÍVEL', 225, 210);
      }
      texRight.needsUpdate = true;
    }

    /* =========================================================================
       INTERAÇÃO E ENTRADA DE DADOS: PC, TOUCH, TECLADO E CONTROLADORES WEBXR
       ========================================================================= */
    const raycaster = new THREE.Raycaster();
    const pointerVector = new THREE.Vector2();
    const xrMatrix = new THREE.Matrix4();
    let isInteracting = false;
    let draggedElement: string | null = null;

    function startBiometricReading() {
      if (systemsOnline) return;
      isScanning = true;
      laserBeam.visible = true;
      setScanPercent(0);
      setSopHint('LENDO DADOS BIOMÉTRICOS... MANTENHA O CONTATO');
    }

    function abortBiometricReading() {
      if (systemsOnline || !isScanning) return;
      isScanning = false;
      scanDuration = 0;
      lastPulseBucket = -1;
      laserBeam.visible = false;
      setScanPercent(null);
      setSopHint('POSICIONE A PALMA NO LEITOR BIOMÉTRICO CENTRAL');
    }

    function executeRaycastInteraction(origin: THREE.Vector2 | THREE.Object3D, isXR = false) {
      SoundSystem.init();

      let hits: THREE.Intersection[] = [];
      if (isXR && origin instanceof THREE.Object3D) {
        xrMatrix.extractRotation(origin.matrixWorld);
        raycaster.ray.origin.setFromMatrixPosition(origin.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(xrMatrix);
        hits = raycaster.intersectObjects([scannerPlate, ...interactiveControls], true);
      } else if (origin instanceof THREE.Vector2) {
        raycaster.setFromCamera(origin, camera);
        hits = raycaster.intersectObjects([scannerPlate, ...interactiveControls], true);
      }

      if (hits.length > 0) {
        controls.enabled = false;

        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && obj.parent && !obj.userData?.type && obj !== scannerPlate) {
          obj = obj.parent;
        }
        if (!obj) return;

        if (obj === scannerPlate) {
          startBiometricReading();
          return;
        }

        const data = obj.userData;
        if (!data || !data.type) return;

        if (data.type === 'switch') {
          SoundSystem.playSwitchClick();
          data.active = !data.active;
          data.leverMesh.rotation.x = data.active ? Math.PI * 0.25 : -Math.PI * 0.25;
          if (data.ledMat) {
            data.ledMat.color.setHex(data.active ? 0x10b981 : 0xef4444);
          }
        } else if (data.type === 'cover') {
          SoundSystem.playCoverRelease();
          data.isOpen = !data.isOpen;
          coverPivot.rotation.x = data.isOpen ? -Math.PI * 0.7 : 0.0;
        } else if (data.type === 'ignition') {
          triggerEngineIgnition();
        } else if (data.type === 'throttle' || data.type === 'joystick') {
          draggedElement = data.type;
        }
      }
    }

    function releaseInteraction() {
      abortBiometricReading();
      draggedElement = null;
      controls.enabled = true;
    }

    const handlePointerDown = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      isInteracting = true;
      executeRaycastInteraction(pointerVector, false);
    };

    const handlePointerUp = () => {
      isInteracting = false;
      releaseInteraction();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isInteracting || !draggedElement) return;

      if (draggedElement === 'throttle') {
        const delta = -e.movementY * 0.007;
        throttleTarget = Math.max(0.0, Math.min(1.0, throttleTarget + delta));
        throttleHandle.position.z = 0.15 - throttleTarget * 0.16;
      } else if (draggedElement === 'joystick') {
        stickPivot.rotation.z -= e.movementX * 0.006;
        stickPivot.rotation.x += e.movementY * 0.006;
        stickPivot.rotation.z = Math.max(-0.35, Math.min(0.35, stickPivot.rotation.z));
        stickPivot.rotation.x = Math.max(-0.35, Math.min(0.35, stickPivot.rotation.x));

        rollAngle = -stickPivot.rotation.z * 60;
        pitchAngle = -stickPivot.rotation.x * 60;
      }
    };

    // Suporte a Teclado para Pilotagem Precisa (WASD / Setas / Espaço)
    const heldKeys = new Set<string>();
    const handleKeyDown = (e: KeyboardEvent) => {
      heldKeys.add(e.code);
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };
    const handleBlur = () => heldKeys.clear();

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // Controladores WebXR Nativos com feixe laser visível no Meta Quest
    const vrLaserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1.5),
    ]);
    const vrLaserMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
    });

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const rayLine = new THREE.Line(vrLaserGeo, vrLaserMat);
      controller.add(rayLine);
      scene.add(controller);
      controller.addEventListener('selectstart', () => executeRaycastInteraction(controller, true));
      controller.addEventListener('selectend', releaseInteraction);
    }

    // Cancela transição de preset de câmera se o usuário mover o OrbitControls manualmente
    let activePresetTransition = false;
    controls.addEventListener('start', () => {
      activePresetTransition = false;
    });

    /* =========================================================================
       LOOP PRINCIPAL DE SIMULAÇÃO E RENDERIZAÇÃO
       ========================================================================= */
    const clock = new THREE.Clock();
    let lastHudUpdate = 0;
    let lastPresetWatched: CameraPreset = 'PILOT';
    const targetCamPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();

    const stepSimulation = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      // Transições suaves de câmera para presets selecionados no dock
      if (cameraPresetRef.current !== lastPresetWatched) {
        lastPresetWatched = cameraPresetRef.current;
        activePresetTransition = true;
      }

      if (activePresetTransition && !renderer.xr.isPresenting) {
        if (lastPresetWatched === 'PILOT') {
          targetCamPos.set(0, 1.28, 0.02);
          targetLookAt.set(0, 1.06, -0.65);
        } else if (lastPresetWatched === 'MFD_CLOSEUP') {
          targetCamPos.set(0, 1.16, -0.18);
          targetLookAt.set(0, 1.02, -0.68);
        } else if (lastPresetWatched === 'IGNITION_DECK') {
          targetCamPos.set(0.12, 1.18, -0.12);
          targetLookAt.set(0.18, 0.92, -0.45);
        } else if (lastPresetWatched === 'ORBITAL_WINDOW') {
          targetCamPos.set(0, 1.36, -0.18);
          targetLookAt.set(0, 1.32, -1.5);
        }

        currentBaseCamPos.lerp(targetCamPos, 1 - Math.exp(-6 * delta));
        camera.position.lerp(targetCamPos, 1 - Math.exp(-6 * delta));
        controls.target.lerp(targetLookAt, 1 - Math.exp(-6 * delta));
        controls.update();

        if (camera.position.distanceTo(targetCamPos) < 0.01) {
          activePresetTransition = false;
        }
      }

      // Controles de voo via teclado (Setas / WASD)
      if (heldKeys.has('ArrowUp') || heldKeys.has('KeyW')) {
        stickPivot.rotation.x = Math.max(-0.35, stickPivot.rotation.x - delta * 0.6);
        pitchAngle = -stickPivot.rotation.x * 60;
      }
      if (heldKeys.has('ArrowDown') || heldKeys.has('KeyS')) {
        stickPivot.rotation.x = Math.min(0.35, stickPivot.rotation.x + delta * 0.6);
        pitchAngle = -stickPivot.rotation.x * 60;
      }
      if (heldKeys.has('ArrowLeft') || heldKeys.has('KeyA')) {
        stickPivot.rotation.z = Math.min(0.35, stickPivot.rotation.z + delta * 0.6);
        rollAngle = -stickPivot.rotation.z * 60;
      }
      if (heldKeys.has('ArrowRight') || heldKeys.has('KeyD')) {
        stickPivot.rotation.z = Math.max(-0.35, stickPivot.rotation.z - delta * 0.6);
        rollAngle = -stickPivot.rotation.z * 60;
      }

      // PROGRESSO DA LEITURA BIOMÉTRICA (3 SEGUNDOS DE CONTATO)
      if (isScanning && !systemsOnline) {
        scanDuration += delta;
        const progress = Math.min(1, scanDuration / 3.0);
        laserBeam.position.z = 0.16 + Math.sin(time * 14) * 0.08;
        setScanPercent(Math.round(progress * 100));

        const bucket = Math.floor(scanDuration * 5);
        if (bucket !== lastPulseBucket) {
          lastPulseBucket = bucket;
          SoundSystem.playBiometricPulse(progress);
        }

        if (scanDuration >= 3.0) {
          completeBiometricUnlock();
        }
      }

      // DINÂMICA DE VOO E EQUAÇÕES FÍSICAS
      if (flightStage !== 'GROUND') {
        throttleActual += (throttleTarget - throttleActual) * delta * 2.0;
        throttleHandle.position.z = 0.15 - throttleActual * 0.16;
        SoundSystem.setRocketPower(throttleActual);

        if (flightStage === 'IGNITION' && throttleActual > 0.88) {
          flightStage = 'ASCENT';
        }

        if (flightStage === 'ASCENT' || flightStage === 'MAX_Q') {
          const thrust = throttleActual * 0.046; // km/s^2
          const gravityDecay = 0.00981 / (1 + altitude / 6371);
          velocity += (thrust - gravityDecay * 0.2) * delta;
          altitude += velocity * delta * 28;

          deltaV = Math.max(0, deltaV - throttleActual * 92 * delta);
          loxPressure = Math.max(14, loxPressure - delta * 0.6 * throttleActual);
          ch4Pressure = Math.max(12, ch4Pressure - delta * 0.5 * throttleActual);

          // Equação barométrica de pressão dinâmica: q = 0.5 * rho * v^2
          const airDensity = Math.exp(-altitude / 8.5);
          maxQ = 0.5 * airDensity * Math.pow(velocity * 140, 2);
          gForce = 1.0 + throttleActual * 2.92;

          if (altitude > 11 && altitude < 23) {
            if (flightStage !== 'MAX_Q') {
              flightStage = 'MAX_Q';
              transmitCharles(CHARLES_VOICE_LINES.MAX_Q);
              setAvMode('ENVELOPE MAX-Q');
            }
          } else if (altitude >= 90 && (flightStage as string) !== 'ORBIT') {
            flightStage = 'ORBIT';
            throttleTarget = 0.0;
            velocity = 7.76; // km/s
            gForce = 0.0; // Gravidade zero
            maxQ = 0.0;
            SoundSystem.stopRocketThrust();
            transmitCharles(CHARLES_VOICE_LINES.ORBIT_MECO);
            setAvMode('INSERÇÃO ORBITAL');
            setSopHint('MANOBRE A NAVE EM DIREÇÃO A MARTE');
          }

          if (altitude > 10 && !isInteracting) {
            pitchAngle = Math.min(65, pitchAngle + delta * 2.5);
            stickPivot.rotation.x = -pitchAngle / 60;
          }
        }

        if (flightStage === 'ORBIT') {
          altitude += velocity * delta * 1.5;
          marsMesh.position.z = Math.min(-220, marsMesh.position.z + delta * 18);
          marsMesh.rotation.y += delta * 0.03;
        }

        // Tremor Estrutural de Câmera Realista (Camera Shake)
        let shake = 0.0;
        if (flightStage === 'ASCENT') shake = 0.0045 * throttleActual;
        if (flightStage === 'MAX_Q') shake = 0.019 * throttleActual;

        if (shake > 0 && !renderer.xr.isPresenting) {
          camera.position.x = currentBaseCamPos.x + (Math.random() - 0.5) * shake;
          camera.position.y = currentBaseCamPos.y + (Math.random() - 0.5) * shake;
          camera.position.z = currentBaseCamPos.z + (Math.random() - 0.5) * shake;
          engineReflectionLight.intensity = 1.8 + Math.random() * 2.2 * throttleActual;
        } else {
          engineReflectionLight.intensity = 0.0;
        }

        // Afastamento da Torre de Lançamento e Planeta Terra
        launchpadGroup.position.y -= velocity * delta * 450;
        earthMesh.position.y -= velocity * delta * 14;
        earthMesh.position.z -= velocity * delta * 20;
        earthMesh.rotation.y += delta * 0.015;

        const starArray = starField.geometry.attributes.position.array as Float32Array;
        for (let i = 1; i < starCount * 3; i += 3) {
          starArray[i] -= velocity * delta * 85;
          if (starArray[i] < -900) starArray[i] = 900;
        }
        starField.geometry.attributes.position.needsUpdate = true;
      } else {
        earthMesh.rotation.y += delta * 0.005;
      }

      // Atualiza os indicadores do HUD Superior a ~15Hz para evitar re-renders excessivos no React
      if (time - lastHudUpdate > 0.065) {
        lastHudUpdate = time;
        setGLoadText(`${gForce.toFixed(2)} G`);
        setAltText(`${altitude.toFixed(3)} KM`);
        setVelText(`${(velocity * 1000).toFixed(1)} M/S`);
      }

      // Animação da Orbe Quântica do Charles (Pulsa com a voz humana neural!)
      if (charlesGroup.visible) {
        charlesGroup.position.y = 1.44 + Math.sin(time * 2.5) * 0.015;
        charlesRings.rotation.y += 0.022;
        charlesRings.rotation.x += 0.012;
        charlesOuterGimbal.rotation.z -= 0.018;

        const voiceBoost = charlesSpeakingRef.current
          ? 1.0 + Math.abs(Math.sin(time * 18)) * 0.45
          : 1.0;
        charlesCore.scale.setScalar(voiceBoost);
        charlesLight.intensity = charlesSpeakingRef.current ? 2.2 * voiceBoost : 1.8;
      }

      renderMFDScreens();
      renderer.render(scene, camera);
    };

    // Pacing para Software WebGL vs Hardware GPU / WebXR
    let frameId = 0;
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    if (isSoftwareGl) {
      const swTick = () => {
        stepSimulation();
        afterDraw(swTick);
      };
      swTick();
    } else {
      renderer.compile(scene, camera);
      renderer.setAnimationLoop(stepSimulation);
    }

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      renderer.setAnimationLoop(null);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      if (vrBtn && container.contains(vrBtn)) {
        container.removeChild(vrBtn);
      }
    };
  }, [transmitCharles]);

  return (
    <div className="relative w-full h-screen bg-[#010204] text-[#d8e5f2] overflow-hidden select-none touch-none">
      {/* Container 3D WebGL / WebXR Isolado */}
      <div ref={containerRef} id="canvas-container" className="absolute inset-0 w-full h-full z-0" />

      {/* BARRA SUPERIOR DE TELEMETRIA MIL-STD */}
      <header
        id="avionics-bar"
        className="absolute top-3.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-wrap items-center justify-center gap-5 md:gap-7 bg-[#080c12]/90 border border-[#506e8c]/40 rounded px-5 py-1.5 font-mono text-[11px] tracking-wider text-[#92b0c9] shadow-[0_4px_20px_rgba(0,0,0,0.75)] tabular-nums"
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>SISTEMA:</span>
          <span className="text-[#4fe3c1] font-bold">{avMode}</span>
        </div>
        <span aria-hidden="true" className="text-slate-700">
          ·
        </span>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>G-LOAD:</span>
          <span className="text-[#4fe3c1] font-bold">{gLoadText}</span>
        </div>
        <span aria-hidden="true" className="text-slate-700">
          ·
        </span>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>ALT:</span>
          <span className="text-[#4fe3c1] font-bold">{altText}</span>
        </div>
        <span aria-hidden="true" className="text-slate-700">
          ·
        </span>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>VEL:</span>
          <span className="text-[#4fe3c1] font-bold">{velText}</span>
        </div>
      </header>

      {/* ANEL DE PROGRESSO BIOMÉTRICO CENTRAL */}
      {scanPercent !== null && (
        <div
          id="scanner-progress-ring"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border-2 border-[#38bdf8]/25 border-t-[#38bdf8] flex flex-col items-center justify-center pointer-events-none z-20 bg-[#060b12]/80"
        >
          <span className="font-mono text-xs tracking-widest text-[#38bdf8]">VORTEX ID</span>
          <span className="font-mono text-2xl font-bold text-white tabular-nums mt-0.5">
            {scanPercent}%
          </span>
        </div>
      )}

      {/* LEGENDA E RÁDIO COMMS DO CHARLES */}
      {commMessage && (
        <div
          id="comm-banner"
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 pointer-events-none bg-[#0a0e16]/95 border border-[#38bdf8]/35 px-6 py-3.5 rounded max-w-[680px] w-[88%] shadow-[0_8px_32px_rgba(0,0,0,0.85)]"
        >
          <div className="text-[#38bdf8] font-mono text-[11px] tracking-[0.14em] uppercase mb-1">
            DIRETOR DE VOO · CHARLES [IA DE BORDO NEURAL]
          </div>
          <div id="comm-text" className="text-[13.5px] leading-relaxed text-[#f1f5f9]">
            {commMessage}
          </div>
        </div>
      )}

      {/* DICA DE PROCEDIMENTO OPERACIONAL + DOCK RETRÁTIL DE CÂMERA E COMANDOS */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center w-[94vw] max-w-[880px] pointer-events-none">
        {/* Procedimento Operacional Padrão (SOP) */}
        <div className="flex items-center gap-2 mb-2 pointer-events-auto">
          <div
            id="sop-hint"
            className="font-mono text-[11px] tracking-wider text-[#94a3b8] bg-[#080c12]/85 px-4 py-1.5 rounded border border-white/10 uppercase"
          >
            {sopHint}
          </div>
          <button
            onClick={() => setDockCollapsed(!dockCollapsed)}
            title="Mostrar/Ocultar Controles de Visão (Atalho: H)"
            className="flex items-center gap-1 px-3 py-1.5 bg-[#080c12]/90 hover:bg-[#111927] text-[#38bdf8] border border-[#38bdf8]/30 rounded font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? 'Controles' : 'Ocultar'}</span>
          </button>
        </div>

        {/* Dock Horizontal Compacto (Sem obstruir o centro do 3D) */}
        {!dockCollapsed && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 w-full bg-[#080c12]/92 border border-[#506e8c]/35 rounded px-3.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.8)]">
            {/* Câmeras do Cockpit */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-slate-400 mr-1.5 flex items-center gap-1">
                <Eye className="w-3 h-3 text-[#38bdf8]" />
                VISÃO:
              </span>
              {(
                [
                  ['PILOT', 'Piloto'],
                  ['MFD_CLOSEUP', 'Monitores MFD'],
                  ['IGNITION_DECK', 'Console Ignição'],
                  ['ORBITAL_WINDOW', 'Janela Orbital'],
                ] as [CameraPreset, string][]
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  onClick={() => handleCameraPreset(preset)}
                  className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                    activeCameraPreset === preset
                      ? 'bg-[#0284c7] text-white font-semibold'
                      : 'bg-[#0f172a] text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Atalhos Táticos de Procedimento & Áudio */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => quickActionRef.current?.('SCAN')}
                className="px-2.5 py-1 bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/30 rounded font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                Autenticar Biometria
              </button>
              <button
                onClick={() => quickActionRef.current?.('COVER')}
                className="px-2.5 py-1 bg-[#0f172a] hover:bg-[#1e293b] text-amber-400 border border-amber-500/30 rounded font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                Abrir Capa
              </button>
              <button
                onClick={() => quickActionRef.current?.('IGNITE')}
                className="px-2.5 py-1 bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-500/50 rounded font-mono text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Ignição Master
              </button>
              <button
                onClick={() => triggerResetRef.current?.()}
                title="Reiniciar Simulação"
                className="p-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border border-slate-700 rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleToggleMute}
                title={isMuted ? 'Ativar Áudio' : 'Silenciar Áudio'}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border border-slate-700 rounded font-mono text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#4fe3c1]" />
                )}
                <span>{isMuted ? 'Mudo' : 'Áudio'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
