/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { SoundSystem, CHARLES_VOICE_LINES } from '../utils/audio';
import { buildStandaloneVercelHtml } from '../utils/standaloneHtmlGenerator';

import earthTextureUrl from '../assets/images/earth_orbital_albedo_1794203961335.jpg';
import marsTextureUrl from '../assets/images/mars_surface_albedo_1794203963170.jpg';
import spaceTextureUrl from '../assets/images/deep_space_milkyway_1794203965838.jpg';

const INTRO_VIDEO_PATH = '/assets/aistudio/gemini_generated_video_8422d505_daa78cad.mp4';
const VIDEO_CROSSOVER_TIME = 19.0; // Instante exato do toque da luva na placa biométrica ciano

type GameState = 'VIDEO_INTRO' | 'GAMEPLAY';
type FlightStage = 'GROUND' | 'ASCENT' | 'CRUISE' | 'LOST_ORBIT';

export const CockpitGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Refs diretos para telemetria 60fps
  const avModeRef = useRef<HTMLSpanElement | null>(null);
  const avDistRef = useRef<HTMLSpanElement | null>(null);
  const avErrRef = useRef<HTMLSpanElement | null>(null);
  const avVelRef = useRef<HTMLSpanElement | null>(null);
  const sopHintRef = useRef<HTMLDivElement | null>(null);
  const routeGuidanceRef = useRef<HTMLDivElement | null>(null);
  const marsMarkerRef = useRef<HTMLDivElement | null>(null);
  const marsMarkerLabelRef = useRef<HTMLDivElement | null>(null);
  const subTagRef = useRef<HTMLDivElement | null>(null);
  const subContentRef = useRef<HTMLDivElement | null>(null);

  const triggerCrossoverFnRef = useRef<(() => void) | null>(null);
  const adjustFovFnRef = useRef<((deltaFov: number) => void) | null>(null);

  const [gameState, setGameState] = useState<GameState>('VIDEO_INTRO');
  const [videoFadeOut, setVideoFadeOut] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [showGyroBtn, setShowGyroBtn] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [currentFov, setCurrentFov] = useState(82);

  // Desbloqueia o som do vídeo e o Web Audio API ao clicar
  const handleUnmuteVideo = useCallback(() => {
    SoundSystem.init();
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {});
    }
    setVideoMuted(false);
  }, []);

  const handleSkipTo3D = useCallback(() => {
    SoundSystem.init();
    triggerCrossoverFnRef.current?.();
  }, []);

  const handleReplayVideo = useCallback(() => {
    SoundSystem.init();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false;
      setVideoMuted(false);
      setVideoFadeOut(false);
      setGameState('VIDEO_INTRO');
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleToggleAudioMute = useCallback(() => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      SoundSystem.setMuted(next);
      return next;
    });
  }, []);

  const handleAdjustFov = useCallback((delta: number) => {
    adjustFovFnRef.current?.(delta);
  }, []);

  // Baixa o arquivo único index.html autocontido pronto para a Vercel
  const handleDownloadVercelHtml = useCallback(() => {
    const htmlContent = buildStandaloneVercelHtml(window.location.origin + INTRO_VIDEO_PATH);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    SoundSystem.prefetchNeuralLines();

    const speakNarration = (sender: string, text: string, onPulse?: (speaking: boolean) => void) => {
      if (subTagRef.current) subTagRef.current.innerText = sender;
      if (subContentRef.current) subContentRef.current.innerText = text;

      SoundSystem.transmitCharles(
        text,
        (msg) => {
          if (subContentRef.current) subContentRef.current.innerText = msg;
        },
        onPulse
      );
    };

    /* =========================================================================
       1. INICIALIZAÇÃO THREE.JS & DETECÇÃO DE SOFTWARE WEBGL
       ========================================================================= */
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    const skySunriseColor = new THREE.Color(0xd89b68);
    const skySpaceColor = new THREE.Color(0x010308);
    scene.background = skySunriseColor.clone();
    scene.fog = new THREE.FogExp2(0xd89b68, 0.0014);

    // Hierarquia principal da nave (gira em 3D ao pilotar o manche)
    const shipRig = new THREE.Group();
    scene.add(shipRig);

    let baseFov = 82;
    const computeEffectiveFov = (w: number, h: number, targetBase: number) => {
      const aspect = w / Math.max(1, h);
      if (aspect < 1.0) {
        return Math.min(108, Math.round(targetBase + (1.0 - aspect) * 34));
      }
      return targetBase;
    };

    const initialFov = computeEffectiveFov(window.innerWidth, window.innerHeight, baseFov);
    const camera = new THREE.PerspectiveCamera(
      initialFov,
      window.innerWidth / window.innerHeight,
      0.04,
      5000
    );

    // Posição exata dos olhos do piloto no último frame do vídeo (00:19)
    const getPilotEyePos = (w: number, h: number) => {
      const aspect = w / Math.max(1, h);
      return new THREE.Vector3(0, 1.24, aspect < 1.0 ? 0.30 : 0.18);
    };
    const pilotEyePos = getPilotEyePos(window.innerWidth, window.innerHeight);
    camera.position.copy(pilotEyePos);
    shipRig.add(camera);

    adjustFovFnRef.current = (deltaFov: number) => {
      baseFov = Math.max(64, Math.min(104, baseFov + deltaFov));
      const eff = computeEffectiveFov(window.innerWidth, window.innerHeight, baseFov);
      camera.fov = eff;
      camera.updateProjectionMatrix();
      setCurrentFov(eff);
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    let vrBtnElement: HTMLElement | null = null;
    try {
      vrBtnElement = VRButton.createButton(renderer);
      document.body.appendChild(vrBtnElement);
    } catch {
      // WebXR indisponível neste navegador
    }

    /* =========================================================================
       2. ILUMINAÇÃO (SOL DOURADO DO AMANHECER + TIRAS LED CIANO DA CABINE)
       ========================================================================= */
    const sunLight = new THREE.DirectionalLight(0xffcf96, 3.2);
    sunLight.position.set(-18, 24, -45);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1a1412, 0.55);
    scene.add(hemiLight);

    // Iluminação ciano interna (refletindo as 3 tiras de LED do teto nos frames 00:15 - 00:19)
    const cabinCyanLight = new THREE.PointLight(0x00f2fe, 1.8, 4.2);
    cabinCyanLight.position.set(0, 1.74, -0.15);
    shipRig.add(cabinCyanLight);

    const engineReflectionLight = new THREE.PointLight(0xff6600, 0.0, 6.0);
    engineReflectionLight.position.set(0, -0.4, 0.6);
    shipRig.add(engineReflectionLight);

    /* =========================================================================
       3. EXTERIOR: AMANHECER NA PLATAFORMA (FRAME 00:01-00:16) -> ESPAÇO PROFUNDO
       ========================================================================= */
    const textureLoader = new THREE.TextureLoader();
    const loadTex = (url: string) => {
      const t = textureLoader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    };

    const earthTex = loadTex(earthTextureUrl);
    const marsTex = loadTex(marsTextureUrl);
    const spaceTex = loadTex(spaceTextureUrl);

    // Domo da Via Láctea (aparece gradualmente conforme a nave sobe para o espaço)
    const skyDomeMat = new THREE.MeshBasicMaterial({
      map: spaceTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.0,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(3200, 32, 32), skyDomeMat);
    scene.add(skyDome);

    // Plataforma de Lançamento no Amanhecer (visível através do para-brisa no frame 00:16)
    const launchpadExterior = new THREE.Group();
    scene.add(launchpadExterior);

    // Foguete Saturn/SLS branco e preto à esquerda (como visto na janela esquerda do frame 00:16)
    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(-19, 10, -42);
    launchpadExterior.add(rocketGroup);

    const boosterWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.4,
      metalness: 0.25,
    });
    const boosterBlackMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.4,
    });
    const mainStage = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.3, 38, 32),
      boosterWhiteMat
    );
    rocketGroup.add(mainStage);

    const interstage = new THREE.Mesh(
      new THREE.CylinderGeometry(2.12, 2.12, 5.5, 32),
      boosterBlackMat
    );
    interstage.position.y = 6;
    rocketGroup.add(interstage);

    const noseCone = new THREE.Mesh(new THREE.ConeGeometry(2.1, 9, 32), boosterWhiteMat);
    noseCone.position.y = 23.5;
    rocketGroup.add(noseCone);

    // Torre metálica vermelha e antena à direita (como visto na janela direita do frame 00:16)
    const redGantryMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.55,
      metalness: 0.65,
    });
    const gantryTower = new THREE.Mesh(new THREE.BoxGeometry(3.8, 52, 3.8), redGantryMat);
    gantryTower.position.set(18, 14, -48);
    launchpadExterior.add(gantryTower);

    const lightningMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.35, 36, 12),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 })
    );
    lightningMast.position.set(12, 8, -36);
    launchpadExterior.add(lightningMast);

    // Nuvens volumétricas de vapor dourado na plataforma (Frames 00:01 - 00:19)
    const steamClouds: THREE.Mesh[] = [];
    const steamMat = new THREE.MeshStandardMaterial({
      color: 0xffe4c4,
      emissive: 0x3b2110,
      roughness: 0.92,
      transparent: true,
      opacity: 0.68,
    });
    for (let i = 0; i < 22; i++) {
      const radius = 3.5 + (i % 5) * 2.1;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 16), steamMat);
      puff.position.set(
        -32 + i * 3.1,
        -5.5 + Math.sin(i * 1.7) * 2.8,
        -28 - (i % 4) * 5.5
      );
      launchpadExterior.add(puff);
      steamClouds.push(puff);
    }

    // Planeta Terra Fotográfico (abaixo da plataforma, revelado na subida orbital)
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, -162, -95);
    scene.add(earthGroup);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(130, 64, 64),
      new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.7, metalness: 0.1 })
    );
    earthMesh.rotation.x = 0.35;
    earthGroup.add(earthMesh);

    // Estrelas de alta resolução
    const starGeo = new THREE.BufferGeometry();
    const starCount = 4000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 2600;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.2,
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Alvo Orbital Marte (Coordenada Real para o Space-Waze)
    const marsWorldPos = new THREE.Vector3(95, 195, -1600);
    const marsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(30, 48, 48),
      new THREE.MeshStandardMaterial({
        map: marsTex,
        color: 0xd95326,
        roughness: 0.75,
        emissive: 0x240803,
        emissiveIntensity: 0.45,
      })
    );
    marsMesh.position.copy(marsWorldPos);
    scene.add(marsMesh);

    /* =========================================================================
       4. REPLICAÇÃO 3D DO COCKPIT FIEL AOS FRAMES 00:15 A 00:19
       ========================================================================= */
    const cockpitGroup = new THREE.Group();
    shipRig.add(cockpitGroup);

    const carbonCompositeMat = new THREE.MeshStandardMaterial({
      color: 0x0b1017,
      roughness: 0.46,
      metalness: 0.74,
    });
    const darkTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x16202e,
      roughness: 0.34,
      metalness: 0.86,
    });
    const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });

    // Assento do Piloto (PilotSeat)
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.68), carbonCompositeMat);
    seatBase.position.set(0, 0.44, 0.12);
    cockpitGroup.add(seatBase);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.92, 0.12), darkTitaniumMat);
    seatBack.position.set(0, 1.04, 0.42);
    cockpitGroup.add(seatBack);

    // Teto angulado com as 3 tiras longitudinais de LED ciano (Frame 00:15)
    const ceilingShell = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.08, 1.85),
      carbonCompositeMat
    );
    ceilingShell.position.set(0, 1.92, -0.12);
    ceilingShell.rotation.x = 0.12;
    cockpitGroup.add(ceilingShell);

    [-0.46, 0, 0.46].forEach((lx) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.016, 1.32), cyanLedMat);
      strip.position.set(lx, 1.87, -0.1);
      strip.rotation.x = 0.12;
      cockpitGroup.add(strip);
    });

    // Paredes laterais inferiores chanfradas com friso de LED ciano no piso (Frame 00:16)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 1.65), carbonCompositeMat);
    leftWall.position.set(-1.02, 0.72, -0.15);
    leftWall.rotation.z = -0.18;
    cockpitGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 1.65), carbonCompositeMat);
    rightWall.position.set(1.02, 0.72, -0.15);
    rightWall.rotation.z = 0.18;
    cockpitGroup.add(rightWall);

    const floorLedRight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.95), cyanLedMat);
    floorLedRight.position.set(0.64, 0.34, 0.05);
    cockpitGroup.add(floorLedRight);

    // PARA-BRISA PANORÂMICO ANGULAR DE 3 PAINÉIS (FRAMES 00:16 A 00:19)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x05101a,
      roughness: 0.04,
      transmission: isSoftwareGl ? 0 : 0.93,
      transparent: true,
      opacity: isSoftwareGl ? 0.16 : 0.22,
      depthWrite: false,
    });
    const windshieldPane = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.95), glassMat);
    windshieldPane.position.set(0, 1.46, -0.72);
    windshieldPane.rotation.x = -0.28;
    cockpitGroup.add(windshieldPane);

    // Duas colunas centrais inclinadas dividindo o para-brisa em 3 janelas trapezoidais
    const strutGeo = new THREE.BoxGeometry(0.072, 0.98, 0.095);
    const centerLeftStrut = new THREE.Mesh(strutGeo, darkTitaniumMat);
    centerLeftStrut.position.set(-0.37, 1.46, -0.69);
    centerLeftStrut.rotation.z = -0.25;
    centerLeftStrut.rotation.x = -0.28;
    cockpitGroup.add(centerLeftStrut);

    const centerRightStrut = new THREE.Mesh(strutGeo, darkTitaniumMat);
    centerRightStrut.position.set(0.37, 1.46, -0.69);
    centerRightStrut.rotation.z = 0.25;
    centerRightStrut.rotation.x = -0.28;
    cockpitGroup.add(centerRightStrut);

    const outerLeftStrut = new THREE.Mesh(strutGeo, carbonCompositeMat);
    outerLeftStrut.position.set(-0.98, 1.42, -0.52);
    outerLeftStrut.rotation.z = -0.36;
    cockpitGroup.add(outerLeftStrut);

    const outerRightStrut = new THREE.Mesh(strutGeo, carbonCompositeMat);
    outerRightStrut.position.set(0.98, 1.42, -0.52);
    outerRightStrut.rotation.z = 0.36;
    cockpitGroup.add(outerRightStrut);

    const upperHeaderBeam = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.09, 0.14),
      darkTitaniumMat
    );
    upperHeaderBeam.position.set(0, 1.84, -0.58);
    cockpitGroup.add(upperHeaderBeam);

    // Alça de apoio amarela na moldura direita do para-brisa (visível nos frames 00:16 a 00:19)
    const yellowGrabBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.38, 16),
      new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3, metalness: 0.65 })
    );
    yellowGrabBar.position.set(0.76, 1.21, -0.48);
    yellowGrabBar.rotation.z = 1.12;
    yellowGrabBar.rotation.y = -0.42;
    cockpitGroup.add(yellowGrabBar);

    /* =========================================================================
       5. CONSOLE FRONTAL, ALA ESQUERDA, ALA DIREITA E 4 TELAS MFD
       ========================================================================= */
    const consoleRoot = new THREE.Group();
    consoleRoot.position.set(0, 0.84, -0.58);
    cockpitGroup.add(consoleRoot);

    // Corpo central do painel de instrumentos
    const mainDashboardHull = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.36, 0.68),
      carbonCompositeMat
    );
    mainDashboardHull.rotation.x = 0.20;
    consoleRoot.add(mainDashboardHull);

    // Ala Direita Angulada (Contém o Scanner Biométrico da Palma do frame 00:17 - 00:19)
    const rightConsoleWing = new THREE.Group();
    rightConsoleWing.position.set(0.45, -0.06, 0.28);
    rightConsoleWing.rotation.x = 0.40;
    rightConsoleWing.rotation.y = -0.18;
    consoleRoot.add(rightConsoleWing);

    const rightWingBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.14, 0.48),
      darkTitaniumMat
    );
    rightConsoleWing.add(rightWingBody);

    // Botões luminosos vermelhos/âmbar na lateral direita da placa biométrica (Frame 00:17)
    const redIndMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const amberIndMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    for (let r = 0; r < 4; r++) {
      const btn = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, 0.016, 0.022),
        r < 2 ? redIndMat : amberIndMat
      );
      btn.position.set(0.18, 0.075, -0.08 + r * 0.055);
      rightConsoleWing.add(btn);
    }

    // Ala Esquerda Angulada (Contém as Chaves Vermelhas e Manetes do frame 00:17 - 00:19)
    const leftConsoleWing = new THREE.Group();
    leftConsoleWing.position.set(-0.46, -0.06, 0.28);
    leftConsoleWing.rotation.x = 0.40;
    leftConsoleWing.rotation.y = 0.18;
    consoleRoot.add(leftConsoleWing);

    const leftWingBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.14, 0.48),
      darkTitaniumMat
    );
    leftConsoleWing.add(leftWingBody);

    /* =========================================================================
       6. SCANNER BIOMÉTRICO COM SILHUETA DA PALMA CIANO NEON (FRAME 00:17-00:19)
       ========================================================================= */
    const palmCanvas = document.createElement('canvas');
    palmCanvas.width = 512;
    palmCanvas.height = 512;
    const palmCtx = palmCanvas.getContext('2d')!;
    const palmTex = new THREE.CanvasTexture(palmCanvas);
    palmTex.colorSpace = THREE.SRGBColorSpace;
    palmTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const drawPalmScannerCanvas = (glowIntensity: number, laserY: number) => {
      palmCtx.fillStyle = '#03121c';
      palmCtx.fillRect(0, 0, 512, 512);

      // Moldura arredondada ciano neon brilhante
      palmCtx.strokeStyle = '#00f2fe';
      palmCtx.lineWidth = 10;
      palmCtx.beginPath();
      palmCtx.roundRect(24, 24, 464, 344, 28);
      palmCtx.stroke();

      palmCtx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
      palmCtx.lineWidth = 3;
      palmCtx.beginPath();
      palmCtx.roundRect(42, 42, 428, 308, 18);
      palmCtx.stroke();

      // Halo radial ciano pulsante
      const rad = palmCtx.createRadialGradient(256, 198, 18, 256, 198, 175);
      rad.addColorStop(0, `rgba(0, 242, 254, ${0.42 + glowIntensity * 0.48})`);
      rad.addColorStop(0.65, `rgba(6, 182, 212, ${0.18 + glowIntensity * 0.22})`);
      rad.addColorStop(1, 'rgba(0, 242, 254, 0.02)');
      palmCtx.fillStyle = rad;
      palmCtx.fillRect(30, 30, 452, 332);

      // Silhueta anatômica da palma da mão + 5 dedos (fiel ao frame 00:17)
      palmCtx.fillStyle = glowIntensity > 0.6 ? '#e8feff' : '#7dd3fc';
      palmCtx.beginPath();
      palmCtx.roundRect(204, 186, 104, 102, 36);
      palmCtx.fill();

      const fingers = [
        { x: 170, y: 212, w: 24, h: 74, angle: -0.52 }, // Polegar
        { x: 215, y: 128, w: 22, h: 96, angle: -0.10 }, // Indicador
        { x: 255, y: 114, w: 23, h: 108, angle: 0.0 },  // Médio
        { x: 294, y: 128, w: 22, h: 96, angle: 0.10 },  // Anelar
        { x: 329, y: 156, w: 20, h: 76, angle: 0.24 },  // Mínimo
      ];
      fingers.forEach((f) => {
        palmCtx.save();
        palmCtx.translate(f.x, f.y);
        palmCtx.rotate(f.angle);
        palmCtx.beginPath();
        palmCtx.roundRect(-f.w / 2, -f.h / 2, f.w, f.h, 11);
        palmCtx.fill();
        palmCtx.restore();
      });

      // Gráficos e barras de telemetria inferiores (abaixo da palma no frame 00:17 - 00:19)
      palmCtx.strokeStyle = '#00f2fe';
      palmCtx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        const bx = 32 + i * 76;
        palmCtx.strokeRect(bx, 390, 62, 92);
        const barH = 26 + ((i * 23 + Math.floor(glowIntensity * 45)) % 54);
        palmCtx.fillStyle = 'rgba(0, 242, 254, 0.78)';
        palmCtx.fillRect(bx + 8, 474 - barH, 46, barH);
      }

      // Feixe laser de varredura quando acionado
      if (laserY >= 0) {
        palmCtx.fillStyle = '#ffffff';
        palmCtx.fillRect(32, laserY, 448, 9);
        palmCtx.fillStyle = 'rgba(0, 242, 254, 0.55)';
        palmCtx.fillRect(32, laserY - 10, 448, 28);
      }

      palmTex.needsUpdate = true;
    };
    drawPalmScannerCanvas(0.85, -1);

    const scannerPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.018, 0.29),
      new THREE.MeshBasicMaterial({ map: palmTex })
    );
    scannerPlate.position.set(-0.04, 0.074, -0.01);
    scannerPlate.userData = { type: 'palm_scanner' };
    rightConsoleWing.add(scannerPlate);

    const palmGlowLight = new THREE.PointLight(0x00f2fe, 1.9, 1.3);
    palmGlowLight.position.set(-0.04, 0.18, -0.01);
    rightConsoleWing.add(palmGlowLight);

    /* =========================================================================
       7. QUATRO MONITORES MFD (ESQUERDO, CENTRAL SUP, CENTRAL INF, DIREITO)
       ========================================================================= */
    const createScreen = (w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return { c, ctx, tex };
    };

    const mfdLeft = createScreen(512, 320);
    const mfdCenter = createScreen(640, 360);
    const mfdLower = createScreen(480, 260);
    const mfdRight = createScreen(512, 320);

    // MFD Esquerdo (Angulado para o piloto)
    const screenMeshLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.26),
      new THREE.MeshBasicMaterial({ map: mfdLeft.tex })
    );
    screenMeshLeft.position.set(-0.54, 0.25, -0.08);
    screenMeshLeft.rotation.y = 0.18;
    consoleRoot.add(screenMeshLeft);

    // MFD Central Principal (Horizonte Artificial + Radar)
    const screenMeshCenter = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.29),
      new THREE.MeshBasicMaterial({ map: mfdCenter.tex })
    );
    screenMeshCenter.position.set(0, 0.26, -0.12);
    consoleRoot.add(screenMeshCenter);

    // MFD Central Inferior Inclinado (Grade Tática vista nos frames 00:16 - 00:19)
    const screenMeshLower = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.21),
      new THREE.MeshBasicMaterial({ map: mfdLower.tex })
    );
    screenMeshLower.position.set(0, 0.085, 0.15);
    screenMeshLower.rotation.x = -0.58;
    consoleRoot.add(screenMeshLower);

    // MFD Direito (Diagrama Esquemático da Cápsula + Diagnóstico)
    const screenMeshRight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.26),
      new THREE.MeshBasicMaterial({ map: mfdRight.tex })
    );
    screenMeshRight.position.set(0.54, 0.25, -0.08);
    screenMeshRight.rotation.y = -0.18;
    consoleRoot.add(screenMeshRight);

    /* =========================================================================
       8. CONTROLES MECÂNICOS NA ALA ESQUERDA & MANCHE CENTRAL 3D
       ========================================================================= */
    const interactiveControls: THREE.Object3D[] = [scannerPlate];

    // Capa Protetora Vermelha Articulada na Ala Esquerda (Frame 00:17)
    const coverPivot = new THREE.Group();
    coverPivot.position.set(0.08, 0.075, -0.08);
    const coverBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.032, 0.088),
      new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        roughness: 0.3,
        transparent: true,
        opacity: 0.92,
      })
    );
    coverBox.position.set(0, 0.016, 0.038);
    coverPivot.add(coverBox);
    coverPivot.userData = { type: 'cover', isOpen: false };
    leftConsoleWing.add(coverPivot);
    interactiveControls.push(coverPivot);

    // Botão Vermelho de Ignição Principal
    const ignBtnMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.85,
    });
    const ignitionButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.024, 24),
      ignBtnMat
    );
    ignitionButton.position.set(0.08, 0.068, -0.04);
    ignitionButton.userData = { type: 'ignition' };
    leftConsoleWing.add(ignitionButton);
    interactiveControls.push(ignitionButton);

    // Manete Linear de Empuxo (Throttle Slider graduado na ala esquerda)
    const throttleTrack = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.01, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x05080f })
    );
    throttleTrack.position.set(-0.09, 0.072, 0.02);
    leftConsoleWing.add(throttleTrack);

    const throttleHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.052, 0.046),
      new THREE.MeshStandardMaterial({ color: 0x00f2fe, metalness: 0.8, roughness: 0.2 })
    );
    throttleHandle.position.set(-0.09, 0.092, 0.10);
    throttleHandle.userData = { type: 'throttle' };
    leftConsoleWing.add(throttleHandle);
    interactiveControls.push(throttleHandle);

    // Manche Central 3D (FlightStick)
    const stickPivot = new THREE.Group();
    stickPivot.position.set(0, -0.02, 0.36);

    const stickShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.014, 0.18),
      darkTitaniumMat
    );
    stickShaft.position.set(0, 0.09, 0);
    stickPivot.add(stickShaft);

    const stickGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.088, 0.054),
      carbonCompositeMat
    );
    stickGrip.position.set(0, 0.09, 0);
    stickShaft.add(stickGrip);

    stickPivot.userData = { type: 'joystick' };
    consoleRoot.add(stickPivot);
    interactiveControls.push(stickPivot);

    /* =========================================================================
       9. COPILOTO CHARLES (ORBE QUÂNTICA HOLOGRÁFICA NO PILAR SUPERIOR DIREITO)
       ========================================================================= */
    const charlesGroup = new THREE.Group();
    charlesGroup.position.set(0.56, 1.48, -0.56);
    cockpitGroup.add(charlesGroup);

    const charlesCoreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f2fe,
      emissiveIntensity: 1.8,
    });
    const charlesCore = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 24), charlesCoreMat);
    charlesGroup.add(charlesCore);

    const charlesRings = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      })
    );
    charlesGroup.add(charlesRings);

    const charlesLight = new THREE.PointLight(0x00f2fe, 2.2, 2.2);
    charlesGroup.add(charlesLight);

    /* =========================================================================
       10. TRANSIÇÃO VÍDEO -> GAMEPLAY 3D AOS 19.0 SEGUNDOS
       ========================================================================= */
    let currentGameState: GameState = 'VIDEO_INTRO';
    let scanWaveTimer = 0.0;
    let isCharlesSpeaking = false;

    const trigger3DCrossover = () => {
      if (currentGameState === 'GAMEPLAY') return;
      currentGameState = 'GAMEPLAY';

      // Inicia o crossfade de 0.2s do vídeo para o canvas 3D
      setVideoFadeOut(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
        setGameState('GAMEPLAY');
      }, 200);

      // Posiciona a câmera 3D no ângulo exato do último frame (00:19)
      camera.position.copy(pilotEyePos);
      headYaw = 0;
      headPitch = -0.18;
      targetYaw = 0;
      targetPitch = -0.18;

      // Sincroniza o despertar da cabine com o toque da luva no leitor biométrico aos 19s
      scanWaveTimer = 1.6;
      SoundSystem.playAwakeningSwell();

      speakNarration(
        'COPILOTO QUÂNTICO // CHARLES',
        CHARLES_VOICE_LINES.VIDEO_CROSSOVER_AWAKEN,
        (speaking) => {
          isCharlesSpeaking = speaking;
        }
      );

      if (avModeRef.current) avModeRef.current.innerText = 'SISTEMAS ONLINE';
      if (sopHintRef.current) {
        sopHintRef.current.innerText =
          'LEVANTE A CAPA VERMELHA NA ALA ESQUERDA E ACIONE A IGNIÇÃO';
      }

      const devOrient = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (window.DeviceOrientationEvent && typeof devOrient?.requestPermission === 'function') {
        setShowGyroBtn(true);
      }
    };

    triggerCrossoverFnRef.current = trigger3DCrossover;

    const videoEl = videoRef.current;
    const onVideoTimeUpdate = () => {
      if (
        videoEl &&
        currentGameState === 'VIDEO_INTRO' &&
        videoEl.currentTime >= VIDEO_CROSSOVER_TIME
      ) {
        trigger3DCrossover();
      }
    };
    const onVideoEnded = () => {
      if (currentGameState === 'VIDEO_INTRO') {
        trigger3DCrossover();
      }
    };

    if (videoEl) {
      videoEl.addEventListener('timeupdate', onVideoTimeUpdate);
      videoEl.addEventListener('ended', onVideoEnded);
      videoEl.play().catch(() => {});
    }

    /* =========================================================================
       11. RENDERIZAÇÃO DOS 4 MONITORES MFD (FIEL AOS FRAMES 00:17 A 00:19)
       ========================================================================= */
    let flightStage: FlightStage = 'GROUND';
    let throttleTarget = 0.0;
    let throttleActual = 0.0;
    let shipYaw = 0.0;
    let shipPitch = 0.0;
    let shipRoll = 0.0;
    let stickInputX = 0.0;
    let stickInputY = 0.0;

    let velocity = 0.0; // km/s
    let altitudeProgress = 0.0; // 0 (plataforma no amanhecer) -> 1 (espaço profundo)
    let deltaV = 9420; // m/s
    let distanceToMars = 54600000; // km
    let routeDeviationAngle = 0.0;
    let warningCooldown = 0.0;

    const renderMFDScreens = (time: number) => {
      // 1. MFD ESQUERDO: Osciloscópio Duplo + 2 Gauges Circulares (70% e 35% do frame 00:18)
      const cl = mfdLeft.ctx;
      cl.fillStyle = '#030d16';
      cl.fillRect(0, 0, 512, 320);
      cl.strokeStyle = '#00f2fe';
      cl.lineWidth = 2;
      cl.strokeRect(8, 8, 496, 304);

      cl.font = 'bold 13px monospace';
      cl.fillStyle = '#00f2fe';
      cl.fillText('TELEMETRIA // PRESSÃO & ACELERAÇÃO', 18, 28);

      // Duas janelas de ondas senoidais à esquerda
      [92, 192].forEach((cy, idx) => {
        cl.strokeStyle = 'rgba(0, 242, 254, 0.35)';
        cl.strokeRect(18, cy - 38, 315, 76);
        cl.strokeStyle = '#00f2fe';
        cl.lineWidth = 2;
        cl.beginPath();
        for (let x = 0; x <= 315; x += 5) {
          const amp = 14 + throttleActual * 18;
          const y =
            cy +
            Math.sin(x * 0.055 + time * (4.5 + idx * 2.2)) * amp * Math.cos(x * 0.015);
          if (x === 0) cl.moveTo(18 + x, y);
          else cl.lineTo(18 + x, y);
        }
        cl.stroke();
      });

      // Dois medidores circulares à direita (70% e 35% como no frame 00:18)
      const gauge1 = Math.round(70 + throttleActual * 28);
      const gauge2 = Math.round(35 + throttleActual * 55);
      [
        { y: 96, pct: gauge1 },
        { y: 204, pct: gauge2 },
      ].forEach((g) => {
        cl.strokeStyle = 'rgba(0, 242, 254, 0.25)';
        cl.lineWidth = 5;
        cl.beginPath();
        cl.arc(418, g.y, 38, 0, Math.PI * 2);
        cl.stroke();

        cl.strokeStyle = '#00f2fe';
        cl.beginPath();
        cl.arc(418, g.y, 38, -Math.PI / 2, -Math.PI / 2 + (g.pct / 100) * Math.PI * 2);
        cl.stroke();

        cl.fillStyle = '#e0faff';
        cl.font = 'bold 15px monospace';
        cl.fillText(`${g.pct}%`, 400, g.y + 5);
      });

      cl.font = '12px monospace';
      cl.fillStyle = '#7dd3fc';
      cl.fillText(
        `VEL: ${(velocity * 3600).toFixed(0)} KM/H  |  DV: ${deltaV.toFixed(0)} M/S`,
        18,
        292
      );
      mfdLeft.tex.needsUpdate = true;

      // 2. MFD CENTRAL SUPERIOR: Horizonte Artificial + Radar Circular + Indicadores 35 / 155
      const cc = mfdCenter.ctx;
      cc.fillStyle = '#030d16';
      cc.fillRect(0, 0, 640, 360);
      cc.strokeStyle = '#00f2fe';
      cc.lineWidth = 2;
      cc.strokeRect(8, 8, 624, 344);

      cc.font = 'bold 13px monospace';
      cc.fillStyle = '#00f2fe';
      cc.fillText('ADI // HORIZONTE ARTIFICIAL & RADAR VETORIAL', 20, 28);

      // Grade lateral esquerda
      cc.strokeStyle = 'rgba(0, 242, 254, 0.35)';
      cc.strokeRect(20, 48, 125, 250);
      for (let i = 0; i < 6; i++) {
        cc.fillStyle = '#00f2fe';
        cc.fillRect(30, 62 + i * 38, 85 + Math.sin(time * 2 + i) * 18, 10);
      }

      // Círculo principal do Horizonte Artificial (centro)
      cc.save();
      cc.translate(305, 182);
      cc.rotate(-shipRoll);

      cc.strokeStyle = '#00f2fe';
      cc.lineWidth = 2.5;
      cc.beginPath();
      cc.arc(0, 0, 118, 0, Math.PI * 2);
      cc.stroke();

      cc.strokeStyle = 'rgba(0, 242, 254, 0.45)';
      cc.lineWidth = 1.5;
      cc.beginPath();
      cc.arc(0, 0, 82, 0, Math.PI * 2);
      cc.stroke();

      const pitchOffset = shipPitch * 115;
      cc.strokeStyle = '#e0faff';
      cc.lineWidth = 2;
      cc.beginPath();
      cc.moveTo(-105, pitchOffset);
      cc.lineTo(105, pitchOffset);
      cc.stroke();

      // Escala de arfagem (Pitch Ladder)
      for (let p = -2; p <= 2; p++) {
        if (p === 0) continue;
        const py = pitchOffset + p * 24;
        cc.beginPath();
        cc.moveTo(-30, py);
        cc.lineTo(30, py);
        cc.stroke();
      }
      cc.restore();

      // Caixas numéricas à direita ("35" e "155" fiéis ao frame 00:18)
      cc.strokeStyle = '#00f2fe';
      cc.lineWidth = 2;
      cc.strokeRect(468, 56, 142, 74);
      cc.beginPath();
      cc.arc(539, 93, 26, 0, Math.PI * 2);
      cc.stroke();
      cc.fillStyle = '#e0faff';
      cc.font = 'bold 18px monospace';
      const hdgVal = Math.round(35 + ((shipYaw * 57.3 + 360) % 360) * 0.1);
      cc.fillText(`${hdgVal}`, 527, 99);

      cc.strokeRect(468, 148, 142, 64);
      cc.font = 'bold 24px monospace';
      const thrustVal = Math.round(155 + throttleActual * 845);
      cc.fillText(`${thrustVal}`, 514, 188);

      cc.font = '12px monospace';
      cc.fillStyle = routeDeviationAngle < 10 ? '#4ade80' : '#facc15';
      cc.fillText(`DESVIO MARTE: ${routeDeviationAngle.toFixed(1)}°`, 468, 255);
      mfdCenter.tex.needsUpdate = true;

      // 3. MFD CENTRAL INFERIOR (Radar Tático Inclinado do frame 00:17 - 00:19)
      const clo = mfdLower.ctx;
      clo.fillStyle = '#030d16';
      clo.fillRect(0, 0, 480, 260);
      clo.strokeStyle = '#00f2fe';
      clo.lineWidth = 2;
      clo.strokeRect(8, 8, 464, 244);

      clo.strokeStyle = 'rgba(0, 242, 254, 0.3)';
      for (let gx = 40; gx < 440; gx += 40) {
        clo.beginPath();
        clo.moveTo(gx, 16);
        clo.lineTo(gx, 244);
        clo.stroke();
      }
      for (let gy = 40; gy < 240; gy += 40) {
        clo.beginPath();
        clo.moveTo(16, gy);
        clo.lineTo(464, gy);
        clo.stroke();
      }

      clo.strokeStyle = '#00f2fe';
      clo.lineWidth = 2;
      clo.beginPath();
      clo.arc(240, 130, 84, 0, Math.PI * 2);
      clo.stroke();
      clo.beginPath();
      clo.arc(240, 130, 44, 0, Math.PI * 2);
      clo.stroke();

      // Ponto de alinhamento de Marte no radar tático
      const blipX = 240 - shipYaw * 85;
      const blipY = 130 + shipPitch * 85;
      clo.fillStyle = '#00f2fe';
      clo.beginPath();
      clo.arc(
        Math.max(150, Math.min(330, blipX)),
        Math.max(45, Math.min(215, blipY)),
        6,
        0,
        Math.PI * 2
      );
      clo.fill();
      mfdLower.tex.needsUpdate = true;

      // 4. MFD DIREITO: Diagrama Wireframe da Cápsula + Diagnóstico (Frame 00:17 - 00:19)
      const cr = mfdRight.ctx;
      cr.fillStyle = '#030d16';
      cr.fillRect(0, 0, 512, 320);
      cr.strokeStyle = '#00f2fe';
      cr.lineWidth = 2;
      cr.strokeRect(8, 8, 496, 304);

      cr.font = 'bold 13px monospace';
      cr.fillStyle = '#00f2fe';
      cr.fillText('DIAGNÓSTICO ESTRUTURAL // CÁPSULA INDIO-1', 18, 28);

      // Silhueta wireframe da cápsula à esquerda (fiel ao frame 00:18)
      cr.strokeStyle = '#00f2fe';
      cr.lineWidth = 2;
      cr.strokeRect(24, 48, 175, 220);

      cr.beginPath();
      cr.moveTo(112, 68);
      cr.lineTo(158, 135);
      cr.lineTo(148, 242);
      cr.lineTo(76, 242);
      cr.lineTo(66, 135);
      cr.closePath();
      cr.stroke();

      cr.beginPath();
      cr.ellipse(112, 135, 45, 14, 0, 0, Math.PI * 2);
      cr.stroke();
      cr.beginPath();
      cr.moveTo(112, 68);
      cr.lineTo(112, 242);
      cr.stroke();

      // Barras horizontais de sistemas à direita
      const sysLabels = ['ECLSS O2', 'ESCUDOS', 'AVIÔNICOS', 'HIDRÁULICA', 'REATOR Q'];
      sysLabels.forEach((lbl, idx) => {
        const by = 56 + idx * 44;
        cr.fillStyle = '#7dd3fc';
        cr.font = '11px monospace';
        cr.fillText(lbl, 220, by + 12);

        cr.strokeStyle = '#00f2fe';
        cr.strokeRect(305, by, 175, 18);
        const fillW = 135 + Math.sin(time * 2 + idx) * 22;
        cr.fillStyle = 'rgba(0, 242, 254, 0.75)';
        cr.fillRect(308, by + 3, fillW, 12);
      });

      cr.fillStyle = '#4ade80';
      cr.font = '12px monospace';
      cr.fillText(
        `DIST MARTE: ${(distanceToMars / 1000000).toFixed(2)}M KM // BIOMETRIA OK`,
        24,
        294
      );
      mfdRight.tex.needsUpdate = true;
    };

    /* =========================================================================
       12. CONTROLES MULTIMODAIS (WEBXR HAND/CONTROLLER, MOBILE GYRO, DESKTOP)
       ========================================================================= */
    const raycaster = new THREE.Raycaster();
    const pointerVector = new THREE.Vector2();
    let isPointerDown = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let activeControl: string | null = null;

    let headYaw = 0;
    let headPitch = -0.18;
    let targetYaw = 0;
    let targetPitch = -0.18;

    let gyroActive = false;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      gyroActive = true;
      const b = (event.beta - 45) * (Math.PI / 180);
      const g = event.gamma * (Math.PI / 180);
      targetPitch = Math.max(-0.65, Math.min(0.75, -b * 0.7));
      targetYaw = Math.max(-1.1, Math.min(1.1, -g * 0.7));
    };

    // Suporte a controladores e mãos no WebXR (Meta Quest)
    const xrController0 = renderer.xr.getController(0);
    const xrController1 = renderer.xr.getController(1);
    shipRig.add(xrController0);
    shipRig.add(xrController1);

    const triggerPalmRescan = () => {
      scanWaveTimer = 1.6;
      SoundSystem.playAwakeningSwell();
      speakNarration(
        'BIOMETRIA // INDIO-OS',
        CHARLES_VOICE_LINES.PALM_RESCAN_OK,
        (speaking) => {
          isCharlesSpeaking = speaking;
        }
      );
    };

    const triggerIgnitionSequence = () => {
      if (!coverPivot.userData.isOpen) {
        SoundSystem.playCoverRelease();
        coverPivot.userData.isOpen = true;
        coverPivot.rotation.x = -Math.PI * 0.72;
      }
      if (flightStage === 'GROUND') {
        SoundSystem.playSwitchClick();
        ignitionButton.position.y = 0.058;
        setTimeout(() => {
          ignitionButton.position.y = 0.068;
        }, 180);

        flightStage = 'ASCENT';
        SoundSystem.startRocketThrust();
        throttleTarget = 1.0;
        throttleHandle.position.z = 0.10 - throttleTarget * 0.16;

        targetYaw = 0;
        targetPitch = -0.12;

        speakNarration(
          'DIRETOR DE VOO // CHARLES',
          CHARLES_VOICE_LINES.IGNITION_START,
          (speaking) => {
            isCharlesSpeaking = speaking;
          }
        );
        if (avModeRef.current) avModeRef.current.innerText = 'PROPULSÃO ATIVA';
        if (sopHintRef.current) {
          sopHintRef.current.innerText =
            'PILOTE PELO MANCHE CENTRAL (OU WASD) E ALINHE COM O RETÍCULO DE MARTE';
        }
      }
    };

    xrController0.addEventListener('selectstart', triggerIgnitionSequence);
    xrController1.addEventListener('selectstart', triggerPalmRescan);

    const onPointerDown = (e: PointerEvent) => {
      SoundSystem.init();
      if (currentGameState === 'VIDEO_INTRO') {
        if (videoRef.current && videoRef.current.muted) {
          videoRef.current.muted = false;
          setVideoMuted(false);
        }
        return;
      }

      isPointerDown = true;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;

      pointerVector.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerVector.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointerVector, camera);
      const hits = raycaster.intersectObjects(interactiveControls, true);

      if (hits.length > 0) {
        let obj: THREE.Object3D = hits[0].object;
        while (obj.parent && !obj.userData?.type) {
          obj = obj.parent;
        }
        const type = obj.userData?.type;
        if (!type) return;

        if (type === 'palm_scanner') {
          triggerPalmRescan();
        } else if (type === 'cover') {
          SoundSystem.playCoverRelease();
          obj.userData.isOpen = !obj.userData.isOpen;
          coverPivot.rotation.x = obj.userData.isOpen ? -Math.PI * 0.72 : 0.0;
        } else if (type === 'ignition') {
          if (!coverPivot.userData.isOpen) {
            speakNarration('DIRETOR DE VOO // CHARLES', CHARLES_VOICE_LINES.COVER_WARN);
            return;
          }
          triggerIgnitionSequence();
        } else if (type === 'throttle' || type === 'joystick') {
          activeControl = type;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown || currentGameState === 'VIDEO_INTRO') return;
      const dx = e.clientX - prevPointerX;
      const dy = e.clientY - prevPointerY;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;

      if (activeControl === 'throttle') {
        throttleTarget = Math.max(0.0, Math.min(1.0, throttleTarget - dy * 0.006));
        throttleHandle.position.z = 0.10 - throttleTarget * 0.16;
      } else if (
        activeControl === 'joystick' ||
        (flightStage !== 'GROUND' && isPointerDown && !activeControl)
      ) {
        stickInputX = Math.max(-1.0, Math.min(1.0, stickInputX + dx * 0.01));
        stickInputY = Math.max(-1.0, Math.min(1.0, stickInputY + dy * 0.01));
        stickPivot.rotation.z = -stickInputX * 0.35;
        stickPivot.rotation.x = stickInputY * 0.35;
      } else if (!gyroActive && !renderer.xr.isPresenting) {
        targetYaw -= dx * 0.0035;
        targetPitch -= dy * 0.0035;
        targetPitch = Math.max(-0.65, Math.min(0.55, targetPitch));
        targetYaw = Math.max(-1.2, Math.min(1.2, targetYaw));
      }
    };

    const onPointerUp = () => {
      isPointerDown = false;
      activeControl = null;
      stickInputX = 0;
      stickInputY = 0;
      stickPivot.rotation.set(0, 0, 0);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (currentGameState === 'VIDEO_INTRO') return;
      if (e.key === ' ' && flightStage === 'GROUND') {
        triggerIgnitionSequence();
        return;
      }
      if (flightStage === 'GROUND') return;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') stickInputX = -0.7;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') stickInputX = 0.7;
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') stickInputY = -0.7;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') stickInputY = 0.7;
      stickPivot.rotation.z = -stickInputX * 0.35;
      stickPivot.rotation.x = stickInputY * 0.35;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight'].includes(e.key)) stickInputX = 0;
      if (['w', 'W', 's', 'S', 'ArrowUp', 'ArrowDown'].includes(e.key)) stickInputY = 0;
      stickPivot.rotation.z = -stickInputX * 0.35;
      stickPivot.rotation.x = stickInputY * 0.35;
    };

    const onWheel = (e: WheelEvent) => {
      if (currentGameState === 'VIDEO_INTRO') return;
      adjustFovFnRef.current?.(e.deltaY > 0 ? 3 : -3);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('wheel', onWheel, { passive: true });

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      const eff = computeEffectiveFov(w, h, baseFov);
      camera.fov = eff;
      setCurrentFov(eff);
      pilotEyePos.copy(getPilotEyePos(w, h));
      camera.position.copy(pilotEyePos);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    /* =========================================================================
       13. LOOP PRINCIPAL DE SIMULAÇÃO
       ========================================================================= */
    const clock = new THREE.Clock();
    const _marsScreenPos = new THREE.Vector3();
    const _shipForward = new THREE.Vector3();
    const _vectorToMars = new THREE.Vector3();
    const _localTarget = new THREE.Vector3();
    const _invQuat = new THREE.Quaternion();
    const _scannerWorldPos = new THREE.Vector3();
    const _xrHandWorldPos = new THREE.Vector3();

    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.08);
      const time = clock.getElapsedTime();

      // Animação contínua das nuvens de vapor na plataforma no amanhecer
      steamClouds.forEach((puff, idx) => {
        puff.position.x += Math.sin(time * 0.4 + idx) * delta * 0.6;
        puff.position.y += delta * 0.35;
        if (puff.position.y > 4.0) puff.position.y = -6.0;
      });

      // Câmera em primeira pessoa (suave no Desktop/Mobile; nativa no WebXR)
      if (!renderer.xr.isPresenting) {
        headYaw += (targetYaw - headYaw) * 0.12;
        headPitch += (targetPitch - headPitch) * 0.12;
        camera.rotation.set(0, 0, 0);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = headYaw;
        camera.rotation.x = headPitch;
      } else {
        // Detecção de proximidade da mão/controle WebXR sobre a placa biométrica da palma
        scannerPlate.getWorldPosition(_scannerWorldPos);
        xrController0.getWorldPosition(_xrHandWorldPos);
        if (_xrHandWorldPos.distanceTo(_scannerWorldPos) < 0.22 && scanWaveTimer <= 0) {
          triggerPalmRescan();
        }
        xrController1.getWorldPosition(_xrHandWorldPos);
        if (_xrHandWorldPos.distanceTo(_scannerWorldPos) < 0.22 && scanWaveTimer <= 0) {
          triggerPalmRescan();
        }
      }

      // Atualização do Scanner Biométrico da Palma (laser de varredura + pulso neon)
      if (scanWaveTimer > 0) {
        scanWaveTimer = Math.max(0, scanWaveTimer - delta);
        const progress = 1.0 - scanWaveTimer / 1.6;
        drawPalmScannerCanvas(1.0, progress * 335);
        palmGlowLight.intensity = 2.8;
      } else {
        const pulse = 0.65 + Math.sin(time * 3.8) * 0.25;
        drawPalmScannerCanvas(pulse, -1);
        palmGlowLight.intensity = 1.6 + pulse * 0.6;
      }

      // Física de Subida Orbital e Waze Espacial rumo a Marte
      if (flightStage !== 'GROUND') {
        const turnRate = 0.65 * delta;
        shipYaw -= stickInputX * turnRate;
        shipPitch -= stickInputY * turnRate;
        shipRoll = -stickInputX * 0.4;

        shipRig.rotation.set(0, 0, 0);
        shipRig.rotation.order = 'YXZ';
        shipRig.rotation.y = shipYaw;
        shipRig.rotation.x = shipPitch;
        shipRig.rotation.z = shipRoll;

        throttleActual += (throttleTarget - throttleActual) * delta * 2.0;
        SoundSystem.setRocketPower(throttleActual);

        velocity += throttleActual * 0.052 * delta;
        deltaV = Math.max(0, deltaV - throttleActual * 85 * delta);

        // Transição atmosférica contínua: Amanhecer Dourado -> Estratosfera -> Espaço Profundo
        altitudeProgress = Math.min(1.0, altitudeProgress + velocity * delta * 0.22);
        (scene.background as THREE.Color).lerpColors(
          skySunriseColor,
          skySpaceColor,
          altitudeProgress
        );
        (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);
        skyDomeMat.opacity = altitudeProgress * 0.82;
        starMat.opacity = altitudeProgress;
        sunLight.color.lerpColors(
          new THREE.Color(0xffcf96),
          new THREE.Color(0xffffff),
          altitudeProgress
        );

        // Afastamento da plataforma de lançamento e da Terra
        launchpadExterior.position.y -= velocity * delta * 26;
        earthGroup.position.y -= velocity * delta * 12;
        earthGroup.position.z -= velocity * delta * 16;

        // Cálculo vetorial do Space-Waze para Marte
        _shipForward.set(0, 0, -1).applyQuaternion(shipRig.quaternion);
        _vectorToMars.copy(marsWorldPos).sub(shipRig.position).normalize();

        const dot = Math.max(-1, Math.min(1, _shipForward.dot(_vectorToMars)));
        routeDeviationAngle = Math.acos(dot) * (180 / Math.PI);

        if (routeDeviationAngle < 15.0 && throttleActual > 0.1) {
          distanceToMars = Math.max(1200, distanceToMars - velocity * 480000 * delta);
          marsWorldPos.z += delta * 15;
          marsMesh.position.copy(marsWorldPos);
        } else if (routeDeviationAngle >= 25.0 && throttleActual > 0.5) {
          distanceToMars += velocity * 120000 * delta;
        }

        if (deltaV <= 0 && distanceToMars > 500000 && flightStage !== 'LOST_ORBIT') {
          flightStage = 'LOST_ORBIT';
          throttleTarget = 0.0;
          SoundSystem.stopRocketThrust();
          speakNarration('DIRETOR DE VOO // CHARLES', CHARLES_VOICE_LINES.LOST_ORBIT);
          if (avModeRef.current) avModeRef.current.innerText = 'DERIVA ESPACIAL';
        }

        warningCooldown -= delta;
        if (warningCooldown <= 0 && flightStage !== 'LOST_ORBIT') {
          if (routeDeviationAngle > 30.0) {
            speakNarration(
              'DIRETOR DE VOO // CHARLES',
              CHARLES_VOICE_LINES.ROUTE_DEVIATION_WARN
            );
            warningCooldown = 12.0;
          } else if (routeDeviationAngle < 5.0 && throttleActual > 0.8) {
            speakNarration('DIRETOR DE VOO // CHARLES', CHARLES_VOICE_LINES.ROUTE_ALIGNED_OK);
            warningCooldown = 20.0;
          }
        }

        const guideEl = routeGuidanceRef.current;
        if (guideEl) {
          if (routeDeviationAngle < 8.0) {
            guideEl.className =
              'pointer-events-none absolute top-[58px] left-1/2 z-15 -translate-x-1/2 rounded border border-[#22c55e] bg-[#08121c]/92 px-4 py-1 font-mono text-[11px] tracking-[1.4px] text-[#22c55e] whitespace-nowrap';
            guideEl.innerText = `ROTA CORRETA // VETOR DE MARTE TRAVADO (${routeDeviationAngle.toFixed(1)}°)`;
          } else {
            _invQuat.copy(shipRig.quaternion).invert();
            _localTarget.copy(_vectorToMars).applyQuaternion(_invQuat);
            const yawDir = _localTarget.x > 0 ? 'DIREITA' : 'ESQUERDA';
            const pitchDir = _localTarget.y > 0 ? 'SUBIR' : 'DESCER';
            guideEl.className =
              routeDeviationAngle > 22.0
                ? 'pointer-events-none absolute top-[58px] left-1/2 z-15 -translate-x-1/2 rounded border border-[#ef4444] bg-[#08121c]/92 px-4 py-1 font-mono text-[11px] tracking-[1.4px] text-[#ef4444] whitespace-nowrap'
                : 'pointer-events-none absolute top-[58px] left-1/2 z-15 -translate-x-1/2 rounded border border-[#00f2fe] bg-[#08121c]/92 px-4 py-1 font-mono text-[11px] tracking-[1.4px] text-[#f8fafc] whitespace-nowrap';
            guideEl.innerText = `CORRIJA O MANCHE: GUINADA À ${yawDir} E ${pitchDir} (DESVIO: ${routeDeviationAngle.toFixed(1)}°)`;
          }
        }

        // Tremor físico sutil da cabine sob empuxo
        const shake = 0.0028 * throttleActual;
        camera.position.x = pilotEyePos.x + (Math.random() - 0.5) * shake;
        camera.position.y = pilotEyePos.y + (Math.random() - 0.5) * shake;
        engineReflectionLight.intensity = 1.5 + Math.random() * 1.8 * throttleActual;
      }

      // Projeção 2D da mira de Marte no para-brisa
      if (currentGameState === 'GAMEPLAY') {
        _marsScreenPos.copy(marsWorldPos).project(camera);
        const markerEl = marsMarkerRef.current;
        if (markerEl) {
          if (_marsScreenPos.z < 1.0 && altitudeProgress > 0.15) {
            const sx = (_marsScreenPos.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-(_marsScreenPos.y * 0.5) + 0.5) * window.innerHeight;
            markerEl.style.display = 'block';
            markerEl.style.left = `${sx}px`;
            markerEl.style.top = `${sy}px`;
            if (marsMarkerLabelRef.current) {
              marsMarkerLabelRef.current.innerText = `MARTE // ${(distanceToMars / 1000000).toFixed(2)}M KM`;
            }
          } else {
            markerEl.style.display = 'none';
          }
        }

        if (avDistRef.current) {
          avDistRef.current.innerText = `${(distanceToMars / 1000000).toFixed(2)}M KM`;
        }
        if (avErrRef.current) {
          avErrRef.current.innerText = `${routeDeviationAngle.toFixed(1)}°`;
        }
        if (avVelRef.current) {
          avVelRef.current.innerText = `${(velocity * 1000).toFixed(0)} M/S`;
        }
      }

      // Animação da Orbe Holográfica do Copiloto Charles
      charlesGroup.position.y = 1.48 + Math.sin(time * 2.6) * 0.014;
      charlesRings.rotation.y += 0.024;
      charlesRings.rotation.x = Math.sin(time * 1.4) * 0.25;
      const voicePulse = isCharlesSpeaking ? 1.18 + Math.sin(time * 18) * 0.16 : 1.0;
      charlesCore.scale.setScalar(voicePulse);

      renderMFDScreens(time);
      renderer.render(scene, camera);
    });

    const gyroBtn = document.getElementById('gyro-permission-btn');
    const onGyroClick = () => {
      const devOrient = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof devOrient?.requestPermission === 'function') {
        devOrient.requestPermission().then((state: string) => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
            setShowGyroBtn(false);
          }
        });
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
        setShowGyroBtn(false);
      }
    };
    gyroBtn?.addEventListener('click', onGyroClick);

    return () => {
      renderer.setAnimationLoop(null);
      if (videoEl) {
        videoEl.removeEventListener('timeupdate', onVideoTimeUpdate);
        videoEl.removeEventListener('ended', onVideoEnded);
      }
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('deviceorientation', handleOrientation);
      gyroBtn?.removeEventListener('click', onGyroClick);
      if (vrBtnElement && vrBtnElement.parentNode) {
        vrBtnElement.parentNode.removeChild(vrBtnElement);
      }
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#020408] text-[#e2e8f0] select-none touch-none font-sans">
      {/* 1. CAMADA DE VÍDEO CINEMATOGRÁFICO (00:00 -> 00:19 COM CROSSFADE DE 0.2s) */}
      {gameState === 'VIDEO_INTRO' && (
        <div
          className={`absolute inset-0 z-30 h-full w-full bg-black transition-opacity duration-200 ${
            videoFadeOut ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          <video
            ref={videoRef}
            src={INTRO_VIDEO_PATH}
            playsInline
            autoPlay
            muted
            preload="auto"
            className="h-full w-full object-cover"
          />

          {/* Controles sobre o vídeo */}
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2.5">
            {videoMuted && (
              <button
                type="button"
                onClick={handleUnmuteVideo}
                className="cursor-pointer rounded border border-[#00f2fe] bg-[#06101a]/90 px-3.5 py-1.5 font-mono text-[11px] font-bold tracking-[1px] uppercase text-[#00f2fe] shadow-[0_0_15px_rgba(0,242,254,0.4)] hover:bg-[#0c2235]"
              >
                ATIVAR SOM DO VÍDEO
              </button>
            )}
            <button
              type="button"
              onClick={handleSkipTo3D}
              className="cursor-pointer rounded border border-[#00f2fe]/50 bg-[#06101a]/88 px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-[1px] uppercase text-[#e2e8f0] hover:border-[#00f2fe] hover:text-[#00f2fe]"
            >
              IR PARA COCKPIT 3D (19s)
            </button>
            <button
              type="button"
              onClick={handleDownloadVercelHtml}
              className="cursor-pointer rounded border border-[#00f2fe]/50 bg-[#06101a]/88 px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-[1px] uppercase text-[#00f2fe] hover:bg-[#0c2235]"
            >
              BAIXAR INDEX.HTML (VERCEL)
            </button>
          </div>
        </div>
      )}

      {/* 2. BARRA SUPERIOR DE TELEMETRIA NO COCKPIT 3D */}
      <div
        id="avionics-bar"
        className={`absolute top-3 left-1/2 z-10 -translate-x-1/2 flex-wrap items-center justify-center gap-3 sm:gap-4 rounded border border-[#00f2fe]/40 bg-[#050c14]/94 px-3.5 py-1.5 font-mono text-[10px] sm:text-[11px] tracking-[1px] text-[#94a3b8] shadow-[0_4px_20px_rgba(0,0,0,0.9)] whitespace-nowrap ${
          gameState === 'GAMEPLAY' ? 'flex' : 'hidden'
        }`}
      >
        <div className="flex items-center gap-1.5">
          INDIO-OS:{' '}
          <span ref={avModeRef} id="av-mode" className="font-bold text-[#00f2fe]">
            SISTEMAS ONLINE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          DIST MARTE:{' '}
          <span ref={avDistRef} id="av-dist" className="font-bold text-[#00f2fe]">
            54.60M KM
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          DESVIO:{' '}
          <span ref={avErrRef} id="av-err" className="font-bold text-[#00f2fe]">
            00.0°
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          VEL:{' '}
          <span ref={avVelRef} id="av-vel" className="font-bold text-[#00f2fe]">
            0 M/S
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 border-l border-[#00f2fe]/25 pl-2.5">
          <span className="text-[9px] text-[#64748b]">FOV {currentFov}°</span>
          <button
            type="button"
            onClick={() => handleAdjustFov(-4)}
            className="cursor-pointer rounded border border-[#00f2fe]/35 bg-[#0a1826] px-1.5 py-0.5 text-[10px] font-bold text-[#00f2fe] hover:bg-[#122b42]"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => handleAdjustFov(4)}
            className="cursor-pointer rounded border border-[#00f2fe]/35 bg-[#0a1826] px-1.5 py-0.5 text-[10px] font-bold text-[#00f2fe] hover:bg-[#122b42]"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleToggleAudioMute}
            className="cursor-pointer rounded border border-[#00f2fe]/35 bg-[#0a1826] px-2 py-0.5 text-[9px] uppercase text-[#94a3b8] hover:text-white"
          >
            {isAudioMuted ? 'MUDO' : 'ÁUDIO'}
          </button>
          <button
            type="button"
            onClick={handleReplayVideo}
            className="cursor-pointer rounded border border-[#00f2fe]/35 bg-[#0a1826] px-2 py-0.5 text-[9px] uppercase text-[#00f2fe] hover:bg-[#122b42]"
          >
            REVER INTRO
          </button>
          <button
            type="button"
            onClick={handleDownloadVercelHtml}
            className="cursor-pointer rounded border border-[#00f2fe] bg-[#00f2fe]/15 px-2 py-0.5 text-[9px] font-bold uppercase text-[#00f2fe] hover:bg-[#00f2fe]/25"
          >
            BAIXAR INDEX.HTML
          </button>
        </div>
      </div>

      {/* 3. GUIA DE CORREÇÃO DE ROTA (SPACE-WAZE) */}
      <div
        ref={routeGuidanceRef}
        id="route-guidance"
        className={`pointer-events-none absolute top-[58px] left-1/2 z-15 -translate-x-1/2 rounded border border-[#00f2fe] bg-[#08121c]/92 px-4 py-1 font-mono text-[11px] tracking-[1.4px] text-[#f8fafc] whitespace-nowrap ${
          gameState === 'GAMEPLAY' ? 'block' : 'hidden'
        }`}
      >
        BIOMETRIA CONFIRMADA // ACIONE A IGNIÇÃO NA ALA ESQUERDA
      </div>

      {/* 4. RETÍCULO DE MARTE NO PARA-BRISA */}
      <div
        ref={marsMarkerRef}
        id="mars-nav-marker"
        style={{ display: 'none' }}
        className="pointer-events-none absolute z-15 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative h-[52px] w-[52px] rounded border-2 border-[#00f2fe] shadow-[0_0_12px_rgba(0,242,254,0.8)]" />
        <div
          ref={marsMarkerLabelRef}
          id="mars-marker-label"
          className="absolute top-[58px] left-1/2 -translate-x-1/2 rounded border border-[#00f2fe] bg-[#060e18]/92 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[1px] text-[#00f2fe] whitespace-nowrap"
        >
          MARTE // 54.60M KM
        </div>
      </div>

      {/* 5. LEGENDA DE COMUNICAÇÃO DO COPILOTO CHARLES */}
      <div
        id="cinematic-subtitle"
        className={`pointer-events-none absolute bottom-[58px] left-1/2 z-20 w-[90%] max-w-[650px] -translate-x-1/2 rounded border border-[#00f2fe]/35 bg-[#040a12]/92 px-5 py-2.5 text-left text-[13px] leading-[1.45] tracking-[0.4px] text-[#f8fafc] shadow-[0_10px_35px_rgba(0,0,0,0.85)] ${
          gameState === 'GAMEPLAY' ? 'block' : 'hidden'
        }`}
      >
        <div
          ref={subTagRef}
          id="sub-tag"
          className="mb-1 text-[10px] font-bold tracking-[1.8px] uppercase text-[#00f2fe]"
        >
          COPILOTO QUÂNTICO // CHARLES
        </div>
        <div ref={subContentRef} id="sub-content">
          Identidade biométrica confirmada no console direito, Comandante. Sistemas Indio-OS online.
        </div>
      </div>

      {/* 6. DICA DE OPERAÇÃO INFERIOR */}
      <div
        ref={sopHintRef}
        id="sop-hint"
        className={`pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded border border-[#00f2fe]/20 bg-[#060c14]/90 px-3.5 py-1.5 font-mono text-[10px] sm:text-[11px] tracking-[1.2px] uppercase text-[#94a3b8] whitespace-nowrap ${
          gameState === 'GAMEPLAY' ? 'block' : 'hidden'
        }`}
      >
        TOQUE NA CAPA E BOTÃO VERMELHO À ESQUERDA PARA DECOLAR (OU BARRA DE ESPAÇO)
      </div>

      {/* BOTÃO ATIVAR GIROSCÓPIO (MOBILE) */}
      <button
        id="gyro-permission-btn"
        type="button"
        style={{ display: showGyroBtn ? 'block' : 'none' }}
        className="pointer-events-auto absolute top-[52px] right-4 z-25 cursor-pointer rounded border border-[#00f2fe] bg-[#08121e]/90 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[1px] uppercase text-[#00f2fe]"
      >
        ATIVAR GIROSCÓPIO
      </button>

      {/* CONTAINER WEBGL / THREE.JS */}
      <div ref={containerRef} id="canvas-container" className="absolute inset-0 z-1 h-full w-full" />
    </div>
  );
};
