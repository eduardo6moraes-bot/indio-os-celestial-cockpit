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
const VIDEO_CROSSOVER_TIME = 19.0;

type GameState = 'VIDEO_INTRO' | 'GAMEPLAY';
type FlightStage = 'GROUND' | 'ORBITAL_HIGHWAY' | 'MARS_DESCENT' | 'MARS_LANDED';

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

  // Funções imperativas expostas para os botões de HUD
  const triggerCrossoverFnRef = useRef<(() => void) | null>(null);
  const triggerIgnitionFnRef = useRef<(() => void) | null>(null);
  const triggerWarpToMarsFnRef = useRef<(() => void) | null>(null);
  const triggerLogisticsStepFnRef = useRef<((step: number) => void) | null>(null);
  const adjustFovFnRef = useRef<((deltaFov: number) => void) | null>(null);

  const [gameState, setGameState] = useState<GameState>('VIDEO_INTRO');
  const [uiFlightStage, setUiFlightStage] = useState<FlightStage>('GROUND');
  const [logisticsStep, setLogisticsStep] = useState<number>(0);
  const [videoFadeOut, setVideoFadeOut] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [showGyroBtn, setShowGyroBtn] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [currentFov, setCurrentFov] = useState(84);

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

    let isCharlesSpeaking = false;

    const speakNarration = (sender: string, text: string) => {
      if (subTagRef.current) subTagRef.current.innerText = sender;
      if (subContentRef.current) subContentRef.current.innerText = text;

      SoundSystem.transmitCharles(
        text,
        (msg) => {
          if (subContentRef.current) subContentRef.current.innerText = msg;
        },
        (speaking) => {
          isCharlesSpeaking = speaking;
        }
      );
    };

    /* =========================================================================
       1. INICIALIZAÇÃO THREE.JS & CÉU CÓSMICO NÍTIDO (SEM NEBLINA OPACA)
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
    scene.background = new THREE.Color(0x030710);
    // Neblina sutilíssima apenas no horizonte distante para nunca esconder a rota ou Marte
    scene.fog = new THREE.FogExp2(0x030710, 0.00018);

    const shipRig = new THREE.Group();
    scene.add(shipRig);

    let baseFov = 84;
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
      6000
    );

    const getPilotEyePos = (w: number, h: number) => {
      const aspect = w / Math.max(1, h);
      return new THREE.Vector3(0, 1.25, aspect < 1.0 ? 0.32 : 0.20);
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
    renderer.toneMappingExposure = 1.15;
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
      // WebXR indisponível
    }

    /* =========================================================================
       2. ILUMINAÇÃO INTERNA E EXTERNA
       ========================================================================= */
    const sunLight = new THREE.DirectionalLight(0xfff1dc, 3.2);
    sunLight.position.set(18, 35, -45);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0b101b, 0.55);
    scene.add(hemiLight);

    const cabinCyanLight = new THREE.PointLight(0x00f2fe, 1.9, 4.5);
    cabinCyanLight.position.set(0, 1.74, -0.12);
    shipRig.add(cabinCyanLight);

    const engineReflectionLight = new THREE.PointLight(0xff6600, 0.0, 6.0);
    engineReflectionLight.position.set(0, -0.4, 0.6);
    shipRig.add(engineReflectionLight);

    /* =========================================================================
       3. EXTERIOR: TERRA, CORREDOR HOLOGRÁFICO ("ESTRADA ESPACIAL"), MARTE E BASE ARES-1
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

    // Via Láctea 8K sempre visível lá fora pelo para-brisa
    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(3500, 32, 32),
      new THREE.MeshBasicMaterial({
        map: spaceTex,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.82,
      })
    );
    scene.add(skyDome);

    // Estrelas brilhantes
    const starGeo = new THREE.BufferGeometry();
    const starCount = 4000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 2800;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starField = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ size: 1.3, color: 0xffffff, transparent: true, opacity: 0.92 })
    );
    scene.add(starField);

    // Plataforma de Lançamento Terrestre (visível nas janelas laterais antes da decolagem)
    const launchpadExterior = new THREE.Group();
    scene.add(launchpadExterior);

    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(-19, 8, -38);
    launchpadExterior.add(rocketGroup);

    const boosterWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.4,
      metalness: 0.25,
    });
    const mainStage = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.2, 36, 32),
      boosterWhiteMat
    );
    rocketGroup.add(mainStage);

    const redGantryMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.5,
      metalness: 0.65,
    });
    const gantryTower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 48, 3.2), redGantryMat);
    gantryTower.position.set(17, 12, -42);
    launchpadExterior.add(gantryTower);

    // Planeta Terra Fotográfico abaixo da plataforma
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, -148, -95);
    scene.add(earthGroup);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(128, 64, 64),
      new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.65, metalness: 0.1 })
    );
    earthMesh.rotation.x = 0.35;
    earthGroup.add(earthMesh);

    const earthHalo = new THREE.Mesh(
      new THREE.SphereGeometry(130.8, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      })
    );
    earthGroup.add(earthHalo);

    // =========================================================================
    // A ESTRADA ESPACIAL ("WAZE ESPACIAL" — CORREDOR DE ANÉIS E TRILHOS LUMINOSOS)
    // Visível diretamente através do para-brisa guiando a nave até Marte!
    // =========================================================================
    const spaceHighwayGroup = new THREE.Group();
    scene.add(spaceHighwayGroup);

    const highwayRings: THREE.Mesh[] = [];
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.75,
    });
    const railMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.65,
    });

    for (let i = 0; i < 18; i++) {
      const zDist = -12 - i * 22;
      const yCurve = 1.4 + i * 1.1;
      const xCurve = i * 0.65;

      const portalRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.06, 12, 48), ringMat);
      portalRing.position.set(xCurve, yCurve, zDist);
      spaceHighwayGroup.add(portalRing);
      highwayRings.push(portalRing);

      // Trilhos laterais da "estrada orbital"
      const leftLane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 16), railMat);
      leftLane.position.set(xCurve - 2.6, yCurve - 1.8, zDist);
      spaceHighwayGroup.add(leftLane);

      const rightLane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 16), railMat);
      rightLane.position.set(xCurve + 2.6, yCurve - 1.8, zDist);
      spaceHighwayGroup.add(rightLane);
    }

    // Planeta Marte 3D bem visível ao final do corredor orbital
    const marsWorldPos = new THREE.Vector3(14, 24, -420);
    const marsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(28, 64, 64),
      new THREE.MeshStandardMaterial({
        map: marsTex,
        color: 0xea580c,
        roughness: 0.72,
        emissive: 0x3b0d04,
        emissiveIntensity: 0.45,
      })
    );
    marsMesh.position.copy(marsWorldPos);
    scene.add(marsMesh);

    // =========================================================================
    // SUPERFÍCIE 3D DE MARTE & BASE LOGÍSTICA ARES-1 (PARA POUSO E LOGÍSTICA)
    // =========================================================================
    const marsSurfaceGroup = new THREE.Group();
    marsSurfaceGroup.position.set(0, -120, 0);
    marsSurfaceGroup.visible = false;
    scene.add(marsSurfaceGroup);

    // Solo avermelhado de Marte com textura real
    const marsGround = new THREE.Mesh(
      new THREE.CylinderGeometry(280, 280, 4, 64),
      new THREE.MeshStandardMaterial({
        map: marsTex,
        color: 0xc2410c,
        roughness: 0.88,
        metalness: 0.08,
      })
    );
    marsGround.position.set(0, -2.2, -30);
    marsSurfaceGroup.add(marsGround);

    // Plataforma de Pouso Ares-1 logo à frente/abaixo da nave
    const landingPadMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 10, 0.35, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.7 })
    );
    landingPadMesh.position.set(0, 0, -4);
    marsSurfaceGroup.add(landingPadMesh);

    // Estrada Logística Iluminada em Marte ("A Rua da Base Ares-1" ligando o Pad ao Domo)
    const marsRoad = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.12, 65),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 })
    );
    marsRoad.position.set(0, 0.08, -36);
    marsSurfaceGroup.add(marsRoad);

    // Faixas neon laterais na estrada marciana
    [-2.4, 2.4].forEach((rx) => {
      const roadStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.16, 65),
        new THREE.MeshBasicMaterial({ color: 0x00f2fe })
      );
      roadStrip.position.set(rx, 0.12, -36);
      marsSurfaceGroup.add(roadStrip);
    });

    // Domo Geodésico Central da Colônia Ares-1 ao final da estrada
    const colonyDome = new THREE.Mesh(
      new THREE.SphereGeometry(11, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.25,
        metalness: 0.4,
        emissive: 0x0284c7,
        emissiveIntensity: 0.25,
      })
    );
    colonyDome.position.set(0, 0, -68);
    marsSurfaceGroup.add(colonyDome);

    const colonyFrame = new THREE.Mesh(
      new THREE.SphereGeometry(11.15, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })
    );
    colonyFrame.position.set(0, 0, -68);
    marsSurfaceGroup.add(colonyFrame);

    // Braço Umbilical da Plataforma Ares-1 (Etapa Logística 1)
    const umbilicalArmGroup = new THREE.Group();
    umbilicalArmGroup.position.set(-5.5, 0, -8);
    marsSurfaceGroup.add(umbilicalArmGroup);

    const umbilicalPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 6.5, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.7 })
    );
    umbilicalPillar.position.y = 3.25;
    umbilicalArmGroup.add(umbilicalPillar);

    const umbilicalBoom = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.45, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.8 })
    );
    umbilicalBoom.position.set(1.8, 4.8, 0);
    umbilicalArmGroup.add(umbilicalBoom);

    // Rover Autônomo de Carga 3D (Etapa Logística 2 — percorre a estrada marciana)
    const marsRoverGroup = new THREE.Group();
    marsRoverGroup.position.set(0, 0.55, -8);
    marsRoverGroup.visible = false;
    marsSurfaceGroup.add(marsRoverGroup);

    const roverChassis = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.85, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.65 })
    );
    marsRoverGroup.add(roverChassis);

    const roverCargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 1.8),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.5,
      })
    );
    roverCargoBox.position.set(0, 0.8, -0.3);
    marsRoverGroup.add(roverCargoBox);

    [-1.15, 1.15].forEach((wx) => {
      [-1.1, 0, 1.1].forEach((wz) => {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, -0.25, wz);
        marsRoverGroup.add(wheel);
      });
    });

    // Usina Solar & Extratores de Oxigênio ISRU (Etapa Logística 3)
    const isruPlantGroup = new THREE.Group();
    isruPlantGroup.position.set(12, 0, -24);
    marsSurfaceGroup.add(isruPlantGroup);

    const isruTowers: THREE.Mesh[] = [];
    for (let t = 0; t < 3; t++) {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.4, 7.5, 24),
        new THREE.MeshStandardMaterial({
          color: 0x334155,
          metalness: 0.8,
          roughness: 0.25,
          emissive: 0x00f2fe,
          emissiveIntensity: 0.05,
        })
      );
      tower.position.set(t * 4.2, 3.75, -t * 3.5);
      isruPlantGroup.add(tower);
      isruTowers.push(tower);
    }

    /* =========================================================================
       4. CABINE 3D FIEL AOS FRAMES 00:15 A 00:19 + PARA-BRISA 100% TRANSPARENTE
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

    // Teto com 3 tiras longitudinais de LED ciano (Frame 00:15)
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

    // Colunas angulares do para-brisa de 3 janelas (Frames 00:16 - 00:19)
    const strutGeo = new THREE.BoxGeometry(0.068, 0.98, 0.085);
    const centerLeftStrut = new THREE.Mesh(strutGeo, darkTitaniumMat);
    centerLeftStrut.position.set(-0.38, 1.46, -0.69);
    centerLeftStrut.rotation.z = -0.25;
    centerLeftStrut.rotation.x = -0.28;
    cockpitGroup.add(centerLeftStrut);

    const centerRightStrut = new THREE.Mesh(strutGeo, darkTitaniumMat);
    centerRightStrut.position.set(0.38, 1.46, -0.69);
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

    // Alça de apoio amarela na moldura direita (Frames 00:16 - 00:19)
    const yellowGrabBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.38, 16),
      new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3, metalness: 0.65 })
    );
    yellowGrabBar.position.set(0.76, 1.21, -0.48);
    yellowGrabBar.rotation.z = 1.12;
    yellowGrabBar.rotation.y = -0.42;
    cockpitGroup.add(yellowGrabBar);

    /* =========================================================================
       5. HOLOGRAMA ESTILO ZORDON DO CHARLES (TUBO VOLUMÉTRICO 3D COM ROSTO IA)
       ========================================================================= */
    const zordonGroup = new THREE.Group();
    // Posicionado em destaque à direita do para-brisa, voltado para o comandante
    zordonGroup.position.set(0.58, 1.42, -0.52);
    zordonGroup.rotation.y = -0.38;
    cockpitGroup.add(zordonGroup);

    // Base e topo do projetor cilíndrico de Zordon
    const projectorRingGeo = new THREE.CylinderGeometry(0.145, 0.16, 0.028, 32);
    const projectorRingMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.4,
    });
    const zordonBaseRing = new THREE.Mesh(projectorRingGeo, projectorRingMat);
    zordonBaseRing.position.y = -0.17;
    zordonGroup.add(zordonBaseRing);

    const zordonTopRing = new THREE.Mesh(projectorRingGeo, projectorRingMat);
    zordonTopRing.position.y = 0.17;
    zordonGroup.add(zordonTopRing);

    // Tubo de contenção energética translúcido
    const zordonTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.138, 0.138, 0.32, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    zordonGroup.add(zordonTube);

    // Canvas de alta definição para o Rosto Holográfico estilo Zordon do Charles
    const zordonCanvas = document.createElement('canvas');
    zordonCanvas.width = 512;
    zordonCanvas.height = 512;
    const zordonCtx = zordonCanvas.getContext('2d')!;
    const zordonTex = new THREE.CanvasTexture(zordonCanvas);
    zordonTex.colorSpace = THREE.SRGBColorSpace;

    const zordonFacePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.30),
      new THREE.MeshBasicMaterial({
        map: zordonTex,
        transparent: true,
        depthWrite: false,
      })
    );
    zordonFacePlane.position.z = 0.02;
    zordonGroup.add(zordonFacePlane);

    const zordonLight = new THREE.PointLight(0x00f2fe, 2.2, 2.4);
    zordonGroup.add(zordonLight);

    // Função que desenha o Rosto Holográfico 3D do Charles (estilo Zordon) com sincronia labial
    const drawZordonHologramFace = (time: number, speaking: boolean) => {
      zordonCtx.clearRect(0, 0, 512, 512);

      // Fundo energético azul/ciano do tubo de Zordon
      const bgGrad = zordonCtx.createRadialGradient(256, 250, 20, 256, 250, 240);
      bgGrad.addColorStop(0, 'rgba(0, 242, 254, 0.48)');
      bgGrad.addColorStop(0.55, 'rgba(2, 132, 199, 0.25)');
      bgGrad.addColorStop(1, 'rgba(0, 20, 40, 0.0)');
      zordonCtx.fillStyle = bgGrad;
      zordonCtx.fillRect(0, 0, 512, 512);

      // Rótulo Superior "CHARLES // IA HOLOGRÁFICA"
      zordonCtx.fillStyle = '#00f2fe';
      zordonCtx.font = 'bold 20px monospace';
      zordonCtx.textAlign = 'center';
      zordonCtx.fillText('CHARLES // IA DE COMANDO', 256, 36);

      // Silhueta e malha volumétrica do rosto de Zordon
      zordonCtx.save();
      const headBob = Math.sin(time * 2.2) * 5;
      zordonCtx.translate(256, 255 + headBob);

      // Halo craniano luminoso
      const faceGrad = zordonCtx.createRadialGradient(0, -10, 15, 0, 0, 145);
      faceGrad.addColorStop(0, '#ffffff');
      faceGrad.addColorStop(0.35, '#7dd3fc');
      faceGrad.addColorStop(0.75, '#00f2fe');
      faceGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');

      zordonCtx.fillStyle = faceGrad;
      zordonCtx.beginPath();
      zordonCtx.moveTo(-88, -95);
      zordonCtx.quadraticCurveTo(0, -148, 88, -95);
      zordonCtx.lineTo(96, -10);
      zordonCtx.lineTo(68, 92);
      zordonCtx.quadraticCurveTo(0, 138, -68, 92);
      zordonCtx.lineTo(-96, -10);
      zordonCtx.closePath();
      zordonCtx.fill();

      // Linhas de grade poligonal 3D da face (wireframe facial de IA)
      zordonCtx.strokeStyle = 'rgba(224, 250, 255, 0.55)';
      zordonCtx.lineWidth = 2;
      [-60, -25, 10, 45, 80].forEach((ly) => {
        zordonCtx.beginPath();
        zordonCtx.moveTo(-75, ly);
        zordonCtx.quadraticCurveTo(0, ly + 14, 75, ly);
        zordonCtx.stroke();
      });

      // Sobrancelhas imponentes estilo Zordon
      zordonCtx.strokeStyle = '#ffffff';
      zordonCtx.lineWidth = 5;
      zordonCtx.beginPath();
      zordonCtx.moveTo(-68, -42);
      zordonCtx.lineTo(-20, -32);
      zordonCtx.moveTo(68, -42);
      zordonCtx.lineTo(20, -32);
      zordonCtx.stroke();

      // Olhos brilhantes de energia branca/ciano (com piscar natural)
      const isBlinking = Math.sin(time * 1.7) > 0.96;
      const eyeH = isBlinking ? 3 : 16;
      zordonCtx.fillStyle = '#ffffff';
      zordonCtx.shadowColor = '#00f2fe';
      zordonCtx.shadowBlur = 18;
      zordonCtx.beginPath();
      zordonCtx.ellipse(-44, -18, 22, eyeH, -0.08, 0, Math.PI * 2);
      zordonCtx.ellipse(44, -18, 22, eyeH, 0.08, 0, Math.PI * 2);
      zordonCtx.fill();

      // Pupilas cibernéticas
      if (!isBlinking) {
        zordonCtx.fillStyle = '#0284c7';
        const lookX = Math.sin(time * 0.9) * 4;
        zordonCtx.beginPath();
        zordonCtx.arc(-44 + lookX, -18, 7, 0, Math.PI * 2);
        zordonCtx.arc(44 + lookX, -18, 7, 0, Math.PI * 2);
        zordonCtx.fill();
      }

      // Ponte nasal esculpida
      zordonCtx.strokeStyle = '#e0faff';
      zordonCtx.lineWidth = 3.5;
      zordonCtx.beginPath();
      zordonCtx.moveTo(0, -30);
      zordonCtx.lineTo(-10, 24);
      zordonCtx.lineTo(12, 28);
      zordonCtx.stroke();

      // BOCA ANIMADA COM SINCRONIA LABIAL (abre e fecha quando o Charles fala!)
      const mouthOpen = speaking ? 6 + Math.abs(Math.sin(time * 22)) * 26 : 3;
      zordonCtx.fillStyle = '#031826';
      zordonCtx.strokeStyle = '#ffffff';
      zordonCtx.lineWidth = 4;
      zordonCtx.beginPath();
      zordonCtx.ellipse(0, 66, 38, mouthOpen, 0, 0, Math.PI * 2);
      zordonCtx.fill();
      zordonCtx.stroke();

      // Barras de onda de voz dentro da boca ao falar
      if (speaking) {
        zordonCtx.fillStyle = '#00f2fe';
        for (let b = -24; b <= 24; b += 8) {
          const bh = 4 + Math.abs(Math.sin(time * 28 + b)) * (mouthOpen * 1.2);
          zordonCtx.fillRect(b - 2, 66 - bh / 2, 4, bh);
        }
      }
      zordonCtx.shadowBlur = 0;
      zordonCtx.restore();

      // Scanlines horizontais de holograma
      zordonCtx.fillStyle = 'rgba(0, 242, 254, 0.14)';
      for (let y = 0; y < 512; y += 8) {
        const offset = (y + Math.floor(time * 40)) % 512;
        zordonCtx.fillRect(40, offset, 432, 2);
      }

      // Status de Voz no rodapé do holograma
      zordonCtx.fillStyle = speaking ? '#4ade80' : '#7dd3fc';
      zordonCtx.font = 'bold 16px monospace';
      zordonCtx.fillText(speaking ? '● TRANSMITINDO VOZ ATIVA' : '● HOLOGRAMA ONLINE', 256, 488);

      zordonTex.needsUpdate = true;
    };
    drawZordonHologramFace(0, false);

    /* =========================================================================
       6. CONSOLE CENTRAL, SCANNER BIOMÉTRICO DA PALMA E BOTÃO VERMELHO DE PARTIDA
       ========================================================================= */
    const consoleRoot = new THREE.Group();
    consoleRoot.position.set(0, 0.84, -0.58);
    cockpitGroup.add(consoleRoot);

    const mainDashboardHull = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.36, 0.68),
      carbonCompositeMat
    );
    mainDashboardHull.rotation.x = 0.20;
    consoleRoot.add(mainDashboardHull);

    // Ala Direita Angulada (Scanner Biométrico da Palma do frame 00:17 - 00:19)
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

    // Ala Esquerda Angulada
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

    // SCANNER BIOMÉTRICO DA PALMA CIANO NEON (ALA DIREITA)
    const palmCanvas = document.createElement('canvas');
    palmCanvas.width = 512;
    palmCanvas.height = 512;
    const palmCtx = palmCanvas.getContext('2d')!;
    const palmTex = new THREE.CanvasTexture(palmCanvas);
    palmTex.colorSpace = THREE.SRGBColorSpace;

    const drawPalmScannerCanvas = (glowIntensity: number, laserY: number) => {
      palmCtx.fillStyle = '#03121c';
      palmCtx.fillRect(0, 0, 512, 512);
      palmCtx.strokeStyle = '#00f2fe';
      palmCtx.lineWidth = 10;
      palmCtx.beginPath();
      palmCtx.roundRect(24, 24, 464, 344, 28);
      palmCtx.stroke();

      const rad = palmCtx.createRadialGradient(256, 198, 18, 256, 198, 175);
      rad.addColorStop(0, `rgba(0, 242, 254, ${0.42 + glowIntensity * 0.48})`);
      rad.addColorStop(1, 'rgba(0, 242, 254, 0.02)');
      palmCtx.fillStyle = rad;
      palmCtx.fillRect(30, 30, 452, 332);

      palmCtx.fillStyle = glowIntensity > 0.6 ? '#e8feff' : '#7dd3fc';
      palmCtx.beginPath();
      palmCtx.roundRect(204, 186, 104, 102, 36);
      palmCtx.fill();

      const fingers = [
        { x: 170, y: 212, w: 24, h: 74, angle: -0.52 },
        { x: 215, y: 128, w: 22, h: 96, angle: -0.10 },
        { x: 255, y: 114, w: 23, h: 108, angle: 0.0 },
        { x: 294, y: 128, w: 22, h: 96, angle: 0.10 },
        { x: 329, y: 156, w: 20, h: 76, angle: 0.24 },
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

      palmCtx.strokeStyle = '#00f2fe';
      palmCtx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        const bx = 32 + i * 76;
        palmCtx.strokeRect(bx, 390, 62, 92);
        const barH = 26 + ((i * 23 + Math.floor(glowIntensity * 45)) % 54);
        palmCtx.fillStyle = 'rgba(0, 242, 254, 0.78)';
        palmCtx.fillRect(bx + 8, 474 - barH, 46, barH);
      }

      if (laserY >= 0) {
        palmCtx.fillStyle = '#ffffff';
        palmCtx.fillRect(32, laserY, 448, 9);
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
       7. BOTÃO DE PARTIDA VERMELHO GIGANTE E LUMINOSO BEM NO CENTRO DO CONSOLE!
       ========================================================================= */
    const interactiveControls: THREE.Object3D[] = [scannerPlate];

    // Base destacada do Módulo de Partida / Ignição (bem visível à esquerda do MFD inferior)
    const ignitionModuleGroup = new THREE.Group();
    ignitionModuleGroup.position.set(-0.27, 0.10, 0.16);
    ignitionModuleGroup.rotation.x = 0.35;
    consoleRoot.add(ignitionModuleGroup);

    // Placa de identificação "PARTIDA / IGNIÇÃO" brilhante
    const ignLabelCanvas = document.createElement('canvas');
    ignLabelCanvas.width = 256;
    ignLabelCanvas.height = 64;
    const ignCtx = ignLabelCanvas.getContext('2d')!;
    ignCtx.fillStyle = '#450a0a';
    ignCtx.fillRect(0, 0, 256, 64);
    ignCtx.strokeStyle = '#ef4444';
    ignCtx.lineWidth = 4;
    ignCtx.strokeRect(2, 2, 252, 60);
    ignCtx.fillStyle = '#fecaca';
    ignCtx.font = 'bold 24px monospace';
    ignCtx.textAlign = 'center';
    ignCtx.fillText('PARTIDA MOTOR', 128, 40);
    const ignLabelTex = new THREE.CanvasTexture(ignLabelCanvas);

    const ignBasePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.025, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 })
    );
    ignitionModuleGroup.add(ignBasePlate);

    const ignSignMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.038),
      new THREE.MeshBasicMaterial({ map: ignLabelTex })
    );
    ignSignMesh.position.set(0, 0.016, -0.055);
    ignSignMesh.rotation.x = -Math.PI / 2;
    ignitionModuleGroup.add(ignSignMesh);

    // Capa Vermelha Translúcida Articulada
    const coverPivot = new THREE.Group();
    coverPivot.position.set(0, 0.018, -0.032);
    const coverBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.042, 0.105),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        transparent: true,
        opacity: 0.85,
      })
    );
    coverBox.position.set(0, 0.021, 0.048);
    coverPivot.add(coverBox);
    // Inicia já semi-aberta ou abre no clique para facilitar a partida imediata
    coverPivot.rotation.x = -Math.PI * 0.68;
    coverPivot.userData = { type: 'cover', isOpen: true };
    ignitionModuleGroup.add(coverPivot);
    interactiveControls.push(coverPivot);

    // BOTÃO DE PARTIDA VERMELHO PULSANTE (GRANDE E ILUMINADO)
    const ignBtnMat = new THREE.MeshStandardMaterial({
      color: 0xff1e1e,
      emissive: 0xef4444,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    const ignitionButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.045, 0.032, 32),
      ignBtnMat
    );
    ignitionButton.position.set(0, 0.024, 0.018);
    ignitionButton.userData = { type: 'ignition' };
    ignitionModuleGroup.add(ignitionButton);
    interactiveControls.push(ignitionButton);

    const ignRedPointLight = new THREE.PointLight(0xef4444, 1.8, 0.8);
    ignRedPointLight.position.set(0, 0.08, 0.02);
    ignitionModuleGroup.add(ignRedPointLight);

    // Manete de Empuxo (Throttle Slider)
    const throttleHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.055, 0.048),
      new THREE.MeshStandardMaterial({ color: 0x00f2fe, metalness: 0.8, roughness: 0.2 })
    );
    throttleHandle.position.set(-0.08, 0.092, 0.10);
    throttleHandle.userData = { type: 'throttle' };
    leftConsoleWing.add(throttleHandle);
    interactiveControls.push(throttleHandle);

    // Manche Central 3D (FlightStick)
    const stickPivot = new THREE.Group();
    stickPivot.position.set(0, -0.02, 0.36);

    const stickShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.015, 0.18),
      darkTitaniumMat
    );
    stickShaft.position.set(0, 0.09, 0);
    stickPivot.add(stickShaft);

    const stickGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.09, 0.056),
      carbonCompositeMat
    );
    stickGrip.position.set(0, 0.09, 0);
    stickShaft.add(stickGrip);

    stickPivot.userData = { type: 'joystick' };
    consoleRoot.add(stickPivot);
    interactiveControls.push(stickPivot);

    /* =========================================================================
       8. QUATRO MONITORES MFD (O MFD DIREITO TAMBÉM EXIBE O ROSTO DO CHARLES!)
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

    const screenMeshLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.26),
      new THREE.MeshBasicMaterial({ map: mfdLeft.tex })
    );
    screenMeshLeft.position.set(-0.54, 0.25, -0.08);
    screenMeshLeft.rotation.y = 0.18;
    consoleRoot.add(screenMeshLeft);

    const screenMeshCenter = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.29),
      new THREE.MeshBasicMaterial({ map: mfdCenter.tex })
    );
    screenMeshCenter.position.set(0, 0.26, -0.12);
    consoleRoot.add(screenMeshCenter);

    const screenMeshLower = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.20),
      new THREE.MeshBasicMaterial({ map: mfdLower.tex })
    );
    screenMeshLower.position.set(0.02, 0.085, 0.15);
    screenMeshLower.rotation.x = -0.58;
    consoleRoot.add(screenMeshLower);

    const screenMeshRight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.26),
      new THREE.MeshBasicMaterial({ map: mfdRight.tex })
    );
    screenMeshRight.position.set(0.54, 0.25, -0.08);
    screenMeshRight.rotation.y = -0.18;
    consoleRoot.add(screenMeshRight);

    /* =========================================================================
       9. TRANSIÇÃO VÍDEO -> GAMEPLAY 3D & FASES DA MISSÃO MARTE + LOGÍSTICA
       ========================================================================= */
    let currentGameState: GameState = 'VIDEO_INTRO';
    let flightStage: FlightStage = 'GROUND';
    let currentLogisticsStep = 0;
    let scanWaveTimer = 0.0;

    let throttleTarget = 0.0;
    let throttleActual = 0.0;
    let shipYaw = 0.0;
    let shipPitch = 0.0;
    let shipRoll = 0.0;
    let stickInputX = 0.0;
    let stickInputY = 0.0;

    let velocity = 0.0; // km/s
    let deltaV = 9420; // m/s
    let distanceToMars = 54.6; // Milhões de km (reduz de 54.6M até 0.00M na viagem)
    let routeDeviationAngle = 0.0;
    let roverDriveProgress = 0.0;

    const trigger3DCrossover = () => {
      if (currentGameState === 'GAMEPLAY') return;
      currentGameState = 'GAMEPLAY';

      setVideoFadeOut(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
        setGameState('GAMEPLAY');
      }, 200);

      camera.position.copy(pilotEyePos);
      headYaw = 0;
      headPitch = -0.15;
      targetYaw = 0;
      targetPitch = -0.15;

      scanWaveTimer = 1.6;
      SoundSystem.playAwakeningSwell();

      speakNarration('CHARLES // HOLOGRAMA IA', CHARLES_VOICE_LINES.VIDEO_CROSSOVER_AWAKEN);

      if (avModeRef.current) avModeRef.current.innerText = 'PRONTO P/ PARTIDA';
      if (sopHintRef.current) {
        sopHintRef.current.innerText =
          'CLIQUE NO BOTÃO VERMELHO DE PARTIDA NO PAINEL (OU NO BOTÃO DECOLAR ABAIXO)';
      }

      const devOrient = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (window.DeviceOrientationEvent && typeof devOrient?.requestPermission === 'function') {
        setShowGyroBtn(true);
      }
    };

    triggerCrossoverFnRef.current = trigger3DCrossover;

    // Aciona a Partida / Ignição rumo a Marte
    const triggerIgnitionSequence = () => {
      SoundSystem.init();
      if (!coverPivot.userData.isOpen) {
        SoundSystem.playCoverRelease();
        coverPivot.userData.isOpen = true;
        coverPivot.rotation.x = -Math.PI * 0.68;
      }
      if (flightStage === 'GROUND') {
        SoundSystem.playSwitchClick();
        ignitionButton.position.y = 0.012;
        setTimeout(() => {
          ignitionButton.position.y = 0.024;
        }, 200);

        flightStage = 'ORBITAL_HIGHWAY';
        setUiFlightStage('ORBITAL_HIGHWAY');
        SoundSystem.startRocketThrust();
        throttleTarget = 1.0;
        throttleHandle.position.z = 0.10 - throttleTarget * 0.16;

        targetYaw = 0;
        targetPitch = -0.08;

        speakNarration('CHARLES // HOLOGRAMA IA', CHARLES_VOICE_LINES.IGNITION_START);
        if (avModeRef.current) avModeRef.current.innerText = 'ROTA ORBITAL MARTE';
        if (sopHintRef.current) {
          sopHintRef.current.innerText =
            'SIGA OS ANÉIS LUMINOSOS DA ROTA ESPACIAL ATÉ MARTE (OU USE O SALTO ORBITAL)';
        }
      }
    };
    triggerIgnitionFnRef.current = triggerIgnitionSequence;

    // Salto Orbital Rápido para chegar imediatamente à Entrada Atmosférica de Marte
    const triggerWarpToMars = () => {
      SoundSystem.init();
      if (flightStage === 'GROUND') {
        triggerIgnitionSequence();
      }
      distanceToMars = 2.2;
      velocity = 18.5;
      shipYaw = 0;
      shipPitch = 0;
      shipRoll = 0;
      shipRig.rotation.set(0, 0, 0);
    };
    triggerWarpToMarsFnRef.current = triggerWarpToMars;

    // Executa as 4 etapas da Logística em Solo Marciano (Base Ares-1)
    const executeMarsLogisticsStep = (step: number) => {
      SoundSystem.init();
      SoundSystem.playSwitchClick();
      currentLogisticsStep = step;
      setLogisticsStep(step);

      if (step === 1) {
        // Etapa 1: Conecta Braço Umbilical à nave
        umbilicalBoom.position.x = 3.2;
        speakNarration('CHARLES // LOGÍSTICA MARTE', CHARLES_VOICE_LINES.LOGISTICS_UMBILICAL);
        if (avModeRef.current) avModeRef.current.innerText = 'UMBILICAL CONECTADO';
        if (sopHintRef.current) {
          sopHintRef.current.innerText =
            'ETAPA 1 CONCLUÍDA // AGORA DESEMBARQUE O ROVER DE CARGA PELA ESTRADA MARCIANA';
        }
      } else if (step === 2) {
        // Etapa 2: Desembarca o Rover 3D pela estrada iluminada até o Domo
        marsRoverGroup.visible = true;
        roverDriveProgress = 0.01;
        speakNarration('CHARLES // LOGÍSTICA MARTE', CHARLES_VOICE_LINES.LOGISTICS_ROVER);
        if (avModeRef.current) avModeRef.current.innerText = 'ROVER EM TRÂNSITO';
        if (sopHintRef.current) {
          sopHintRef.current.innerText =
            'OBSERVE O ROVER AMARELO SEGUINDO PELA RUA LOGÍSTICA ATÉ O DOMO CENTRAL';
        }
      } else if (step === 3) {
        // Etapa 3: Ativa Usina Solar e Extrator de O2/Metano (ISRU)
        isruTowers.forEach((t) => {
          (t.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
        });
        deltaV = 9420;
        speakNarration('CHARLES // LOGÍSTICA MARTE', CHARLES_VOICE_LINES.LOGISTICS_ISRU);
        if (avModeRef.current) avModeRef.current.innerText = 'TANQUES 100% CHEIOS';
        if (sopHintRef.current) {
          sopHintRef.current.innerText =
            'USINA DE OXIGÊNIO ATIVA // FINALIZE A ENTREGA DOS SUPRIMENTOS DA COLÔNIA';
        }
      } else if (step === 4) {
        // Etapa 4: Missão Logística Concluída (permite nova decolagem se desejar)
        speakNarration('CHARLES // LOGÍSTICA MARTE', CHARLES_VOICE_LINES.LOGISTICS_COMPLETE);
        if (avModeRef.current) avModeRef.current.innerText = 'COLÔNIA ABASTECIDA';
        if (sopHintRef.current) {
          sopHintRef.current.innerText =
            'MISSÃO LOGÍSTICA EM MARTE COMPLETA COM SUCESSO!';
        }
      } else if (step === 5) {
        // Reinicia voo a partir de Marte
        marsSurfaceGroup.visible = false;
        marsMesh.visible = true;
        spaceHighwayGroup.visible = true;
        distanceToMars = 54.6;
        marsWorldPos.set(14, 24, -420);
        marsMesh.position.copy(marsWorldPos);
        flightStage = 'ORBITAL_HIGHWAY';
        setUiFlightStage('ORBITAL_HIGHWAY');
        currentLogisticsStep = 0;
        setLogisticsStep(0);
        throttleTarget = 1.0;
        SoundSystem.startRocketThrust();
        speakNarration('CHARLES // HOLOGRAMA IA', CHARLES_VOICE_LINES.IGNITION_START);
      }
    };
    triggerLogisticsStepFnRef.current = executeMarsLogisticsStep;

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
       10. RENDERIZAÇÃO DOS 4 MONITORES MFD (INCLUINDO HOLOGRAMA DO CHARLES NO MFD DIREITO)
       ========================================================================= */
    const renderMFDScreens = (time: number) => {
      // 1. MFD ESQUERDO: Telemetria, Ondas e Progresso até Marte
      const cl = mfdLeft.ctx;
      cl.fillStyle = '#030d16';
      cl.fillRect(0, 0, 512, 320);
      cl.strokeStyle = '#00f2fe';
      cl.lineWidth = 2;
      cl.strokeRect(8, 8, 496, 304);

      cl.font = 'bold 13px monospace';
      cl.fillStyle = '#00f2fe';
      cl.fillText('PFD // TELEMETRIA & PROPULSÃO CELESTIAL', 18, 28);

      [92, 192].forEach((cy, idx) => {
        cl.strokeStyle = 'rgba(0, 242, 254, 0.35)';
        cl.strokeRect(18, cy - 38, 315, 76);
        cl.strokeStyle = '#00f2fe';
        cl.lineWidth = 2;
        cl.beginPath();
        for (let x = 0; x <= 315; x += 5) {
          const amp = 12 + throttleActual * 20;
          const y =
            cy +
            Math.sin(x * 0.055 + time * (4.5 + idx * 2.2)) * amp * Math.cos(x * 0.015);
          if (x === 0) cl.moveTo(18 + x, y);
          else cl.lineTo(18 + x, y);
        }
        cl.stroke();
      });

      const gauge1 = Math.round(70 + throttleActual * 30);
      const gauge2 = Math.round((deltaV / 9420) * 100);
      [
        { y: 96, pct: gauge1, lbl: 'THR' },
        { y: 204, pct: gauge2, lbl: 'COMB' },
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
        cl.font = 'bold 14px monospace';
        cl.fillText(`${g.pct}%`, 400, g.y + 5);
      });

      cl.font = '12px monospace';
      cl.fillStyle = '#4ade80';
      cl.fillText(
        `FASE: ${flightStage}  |  DIST MARTE: ${distanceToMars.toFixed(2)}M KM`,
        18,
        292
      );
      mfdLeft.tex.needsUpdate = true;

      // 2. MFD CENTRAL SUPERIOR: Horizonte Artificial + Radar de Rota
      const cc = mfdCenter.ctx;
      cc.fillStyle = '#030d16';
      cc.fillRect(0, 0, 640, 360);
      cc.strokeStyle = '#00f2fe';
      cc.lineWidth = 2;
      cc.strokeRect(8, 8, 624, 344);

      cc.font = 'bold 13px monospace';
      cc.fillStyle = '#00f2fe';
      cc.fillText('WAZE ESPACIAL // HORIZONTE & CORREDOR MARTE', 20, 28);

      cc.save();
      cc.translate(250, 185);
      cc.rotate(-shipRoll);

      cc.strokeStyle = '#00f2fe';
      cc.lineWidth = 2.5;
      cc.beginPath();
      cc.arc(0, 0, 115, 0, Math.PI * 2);
      cc.stroke();

      const pitchOffset = shipPitch * 115;
      cc.strokeStyle = '#e0faff';
      cc.lineWidth = 2;
      cc.beginPath();
      cc.moveTo(-100, pitchOffset);
      cc.lineTo(100, pitchOffset);
      cc.stroke();
      cc.restore();

      cc.strokeStyle = '#00f2fe';
      cc.strokeRect(410, 56, 200, 240);
      cc.fillStyle = '#e0faff';
      cc.font = 'bold 14px monospace';
      cc.fillText('STATUS MISSÃO:', 425, 86);
      cc.fillStyle = '#4ade80';
      cc.fillText(
        flightStage === 'MARS_LANDED'
          ? 'POUSADO EM MARTE'
          : flightStage === 'MARS_DESCENT'
            ? 'DESCIDA MARTE'
            : flightStage === 'ORBITAL_HIGHWAY'
              ? 'EM ROTA ORBITAL'
              : 'NA PLATAFORMA',
        425,
        112
      );
      cc.fillStyle = '#7dd3fc';
      cc.fillText(`VEL: ${(velocity * 1000).toFixed(0)} M/S`, 425, 155);
      cc.fillText(`DESVIO: ${routeDeviationAngle.toFixed(1)}°`, 425, 185);
      cc.fillText(`LOGÍSTICA: ${currentLogisticsStep}/4`, 425, 215);
      mfdCenter.tex.needsUpdate = true;

      // 3. MFD CENTRAL INFERIOR (Mapa da Estrada Espacial / Base Ares-1)
      const clo = mfdLower.ctx;
      clo.fillStyle = '#030d16';
      clo.fillRect(0, 0, 480, 260);
      clo.strokeStyle = '#00f2fe';
      clo.lineWidth = 2;
      clo.strokeRect(8, 8, 464, 244);

      clo.fillStyle = '#00f2fe';
      clo.font = 'bold 12px monospace';
      clo.fillText('MAPA DE ROTA // TERRA -> ESTRADA ORBITAL -> MARTE', 20, 30);

      // Linha da estrada espacial no mapa inferior
      clo.strokeStyle = '#22c55e';
      clo.lineWidth = 4;
      clo.beginPath();
      clo.moveTo(50, 200);
      clo.lineTo(430, 60);
      clo.stroke();

      const shipProgressRatio = 1.0 - Math.max(0, Math.min(1, distanceToMars / 54.6));
      const sx = 50 + shipProgressRatio * 380;
      const sy = 200 - shipProgressRatio * 140;

      clo.fillStyle = '#ffffff';
      clo.beginPath();
      clo.arc(sx, sy, 8, 0, Math.PI * 2);
      clo.fill();

      clo.fillStyle = '#ef4444';
      clo.beginPath();
      clo.arc(430, 60, 12, 0, Math.PI * 2);
      clo.fill();
      clo.fillStyle = '#ffffff';
      clo.fillText('MARTE', 395, 42);
      mfdLower.tex.needsUpdate = true;

      // 4. MFD DIREITO: Espelha o Rosto Holográfico Zordon do Charles + Logística
      const cr = mfdRight.ctx;
      cr.fillStyle = '#030d16';
      cr.fillRect(0, 0, 512, 320);
      cr.strokeStyle = '#00f2fe';
      cr.lineWidth = 2;
      cr.strokeRect(8, 8, 496, 304);

      // Desenha o rosto de Zordon do Charles diretamente na metade esquerda do monitor direito!
      cr.drawImage(zordonCanvas, 12, 18, 245, 280);

      cr.fillStyle = '#00f2fe';
      cr.font = 'bold 13px monospace';
      cr.fillText('COPILOTO CHARLES', 268, 42);
      cr.font = '11px monospace';
      cr.fillStyle = '#e0faff';
      cr.fillText('IA HOLOGRÁFICA ATIVA', 268, 64);

      const checkItems = [
        { s: 1, label: '1. UMBILICAL ARES-1' },
        { s: 2, label: '2. ROVER DE CARGA' },
        { s: 3, label: '3. USINA SOLAR O2' },
        { s: 4, label: '4. SUPRIMENTOS OK' },
      ];
      checkItems.forEach((item, idx) => {
        const done = currentLogisticsStep >= item.s;
        cr.fillStyle = done ? '#4ade80' : '#64748b';
        cr.fillText(`${done ? '[✓]' : '[ ]'} ${item.label}`, 268, 115 + idx * 38);
      });

      mfdRight.tex.needsUpdate = true;
    };

    /* =========================================================================
       11. CONTROLES MULTIMODAIS
       ========================================================================= */
    const raycaster = new THREE.Raycaster();
    const pointerVector = new THREE.Vector2();
    let isPointerDown = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let activeControl: string | null = null;

    let headYaw = 0;
    let headPitch = -0.15;
    let targetYaw = 0;
    let targetPitch = -0.15;

    let gyroActive = false;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      gyroActive = true;
      const b = (event.beta - 45) * (Math.PI / 180);
      const g = event.gamma * (Math.PI / 180);
      targetPitch = Math.max(-0.65, Math.min(0.75, -b * 0.7));
      targetYaw = Math.max(-1.1, Math.min(1.1, -g * 0.7));
    };

    const xrController0 = renderer.xr.getController(0);
    const xrController1 = renderer.xr.getController(1);
    shipRig.add(xrController0);
    shipRig.add(xrController1);

    const triggerPalmRescan = () => {
      scanWaveTimer = 1.6;
      SoundSystem.playAwakeningSwell();
      speakNarration('CHARLES // HOLOGRAMA IA', CHARLES_VOICE_LINES.PALM_RESCAN_OK);
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
          coverPivot.rotation.x = obj.userData.isOpen ? -Math.PI * 0.68 : 0.0;
        } else if (type === 'ignition') {
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
        (flightStage === 'ORBITAL_HIGHWAY' && isPointerDown && !activeControl)
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
      if (flightStage !== 'ORBITAL_HIGHWAY') return;
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
       12. LOOP PRINCIPAL DE SIMULAÇÃO (CORREDOR DE MARTE + POUSO + LOGÍSTICA)
       ========================================================================= */
    const clock = new THREE.Clock();
    const _marsScreenPos = new THREE.Vector3();
    const _shipForward = new THREE.Vector3();
    const _vectorToMars = new THREE.Vector3();

    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.08);
      const time = clock.getElapsedTime();

      if (!renderer.xr.isPresenting) {
        headYaw += (targetYaw - headYaw) * 0.12;
        headPitch += (targetPitch - headPitch) * 0.12;
        camera.rotation.set(0, 0, 0);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = headYaw;
        camera.rotation.x = headPitch;
      }

      // Atualiza o Rosto Holográfico Zordon do Charles em tempo real
      drawZordonHologramFace(time, isCharlesSpeaking);
      zordonGroup.position.y = 1.42 + Math.sin(time * 2.2) * 0.012;

      // Pulso do botão de partida vermelho
      ignBtnMat.emissiveIntensity =
        flightStage === 'GROUND' ? 1.4 + Math.sin(time * 6) * 0.6 : 0.4;

      // Scanner biométrico da palma
      if (scanWaveTimer > 0) {
        scanWaveTimer = Math.max(0, scanWaveTimer - delta);
        const progress = 1.0 - scanWaveTimer / 1.6;
        drawPalmScannerCanvas(1.0, progress * 335);
      } else {
        drawPalmScannerCanvas(0.65 + Math.sin(time * 3.8) * 0.25, -1);
      }

      // Animação dos anéis da Estrada Espacial (sempre visíveis lá fora no espaço)
      highwayRings.forEach((ring, idx) => {
        ring.rotation.z = time * 0.5 + idx * 0.2;
      });

      // FASE 1: VIAGEM PELA ESTRADA ORBITAL RUMO A MARTE
      if (flightStage === 'ORBITAL_HIGHWAY') {
        const turnRate = 0.55 * delta;
        shipYaw -= stickInputX * turnRate;
        shipPitch -= stickInputY * turnRate;
        shipRoll = -stickInputX * 0.35;

        shipRig.rotation.set(0, 0, 0);
        shipRig.rotation.order = 'YXZ';
        shipRig.rotation.y = shipYaw;
        shipRig.rotation.x = shipPitch;
        shipRig.rotation.z = shipRoll;

        throttleActual += (throttleTarget - throttleActual) * delta * 2.5;
        SoundSystem.setRocketPower(throttleActual);

        velocity = Math.min(22.0, velocity + throttleActual * 4.5 * delta);
        deltaV = Math.max(1200, deltaV - throttleActual * 65 * delta);

        // Afastamento rápido da plataforma terrestre e da Terra
        launchpadExterior.position.y -= velocity * delta * 8;
        earthGroup.position.y -= velocity * delta * 4;
        earthGroup.position.z -= velocity * delta * 6;

        // Movimento contínuo dos anéis da Estrada Espacial passando pela nave
        spaceHighwayGroup.position.z += velocity * delta * 4.5;
        if (spaceHighwayGroup.position.z > 44) {
          spaceHighwayGroup.position.z -= 44;
        }

        // Aproximação real de Marte (leva ~18 segundos em potência máxima)
        distanceToMars = Math.max(0, distanceToMars - velocity * delta * 0.16);
        const approachRatio = 1.0 - distanceToMars / 54.6;
        marsWorldPos.z = -420 + approachRatio * 345;
        marsWorldPos.x = 14 * (1 - approachRatio);
        marsWorldPos.y = 24 * (1 - approachRatio);
        marsMesh.position.copy(marsWorldPos);

        _shipForward.set(0, 0, -1).applyQuaternion(shipRig.quaternion);
        _vectorToMars.copy(marsWorldPos).sub(shipRig.position).normalize();
        const dot = Math.max(-1, Math.min(1, _shipForward.dot(_vectorToMars)));
        routeDeviationAngle = Math.acos(dot) * (180 / Math.PI);

        const guideEl = routeGuidanceRef.current;
        if (guideEl) {
          guideEl.innerText =
            routeDeviationAngle < 12
              ? `ESTRADA ESPACIAL TRAVADA // APROXIMANDO DE MARTE (${distanceToMars.toFixed(1)}M KM)`
              : `ALINHE O MANCHE COM OS ANÉIS AZUIS DA ROTA (DESVIO: ${routeDeviationAngle.toFixed(1)}°)`;
        }

        // Quando chega a 2.0M KM, inicia automaticamente a Descida em Marte!
        if (distanceToMars <= 2.0) {
          flightStage = 'MARS_DESCENT';
          setUiFlightStage('MARS_DESCENT');
          spaceHighwayGroup.visible = false;
          marsSurfaceGroup.visible = true;
          marsSurfaceGroup.position.set(0, -48, 0);

          // Nivela a nave para o pouso
          shipYaw = 0;
          shipPitch = 0;
          shipRoll = 0;
          shipRig.rotation.set(0, 0, 0);
          targetPitch = -0.10;

          speakNarration('CHARLES // HOLOGRAMA IA', CHARLES_VOICE_LINES.MARS_APPROACH);
          if (avModeRef.current) avModeRef.current.innerText = 'DESCIDA EM MARTE';
          if (sopHintRef.current) {
            sopHintRef.current.innerText =
              'ENTRANDO NA ATMOSFERA DE MARTE // RETROFOGUETES ACIONADOS PARA POUSO NA BASE ARES-1';
          }
        }
      }
      // FASE 2: ENTRADA ATMOSFÉRICA E POUSO NA BASE ARES-1 EM MARTE
      else if (flightStage === 'MARS_DESCENT') {
        distanceToMars = Math.max(0, distanceToMars - delta * 0.45);
        velocity = Math.max(0.05, velocity * 0.96);

        // O planeta Marte esférico sobe/cede lugar ao terreno 3D da Base Ares-1
        marsMesh.position.z -= delta * 18;
        marsMesh.position.y += delta * 12;

        // O solo 3D de Marte com a Base Ares-1 e a estrada logística sobe até pousar (y = -0.2)
        marsSurfaceGroup.position.y = Math.min(-0.2, marsSurfaceGroup.position.y + delta * 9.5);

        if (routeGuidanceRef.current) {
          routeGuidanceRef.current.innerText = `DESCIDA FINAL NA BASE ARES-1 // ALTITUDE: ${(Math.abs(marsSurfaceGroup.position.y) * 120).toFixed(0)} M`;
        }

        if (marsSurfaceGroup.position.y >= -0.22) {
          flightStage = 'MARS_LANDED';
          setUiFlightStage('MARS_LANDED');
          marsMesh.visible = false;
          velocity = 0;
          distanceToMars = 0;
          throttleTarget = 0;
          throttleActual = 0;
          SoundSystem.stopRocketThrust();

          speakNarration('CHARLES // HOLOGRAMA IA', CHARLES_VOICE_LINES.MARS_LANDED);
          if (avModeRef.current) avModeRef.current.innerText = 'POUSADO EM MARTE';
          if (routeGuidanceRef.current) {
            routeGuidanceRef.current.innerText =
              'POUSO CONFIRMADO NA BASE ARES-1 // COMANDE A LOGÍSTICA DE MARTE ABAIXO';
          }
          if (sopHintRef.current) {
            sopHintRef.current.innerText =
              'USE OS BOTÕES DE LOGÍSTICA PARA CONECTAR O UMBILICAL, ENVIAR O ROVER E ABASTECER A COLÔNIA';
          }
        }
      }
      // FASE 3: OPERAÇÃO LOGÍSTICA EM SOLO MARCIANO (ANIMAÇÃO DO ROVER NA RUA DE MARTE)
      else if (flightStage === 'MARS_LANDED') {
        if (roverDriveProgress > 0 && roverDriveProgress < 1.0) {
          roverDriveProgress = Math.min(1.0, roverDriveProgress + delta * 0.14);
          marsRoverGroup.position.z = -8 - roverDriveProgress * 54;
        }
      }

      // Projeção 2D da mira de Marte no para-brisa (sempre ativa enquanto Marte estiver visível)
      if (currentGameState === 'GAMEPLAY') {
        const markerEl = marsMarkerRef.current;
        if (markerEl) {
          if (flightStage !== 'MARS_LANDED') {
            _marsScreenPos.copy(marsWorldPos).project(camera);
            if (_marsScreenPos.z < 1.0) {
              const sx = (_marsScreenPos.x * 0.5 + 0.5) * window.innerWidth;
              const sy = (-(_marsScreenPos.y * 0.5) + 0.5) * window.innerHeight;
              markerEl.style.display = 'block';
              markerEl.style.left = `${sx}px`;
              markerEl.style.top = `${sy}px`;
              if (marsMarkerLabelRef.current) {
                marsMarkerLabelRef.current.innerText = `MARTE // ${distanceToMars.toFixed(2)}M KM`;
              }
            } else {
              markerEl.style.display = 'none';
            }
          } else {
            markerEl.style.display = 'none';
          }
        }

        if (avDistRef.current) {
          avDistRef.current.innerText = `${distanceToMars.toFixed(2)}M KM`;
        }
        if (avErrRef.current) {
          avErrRef.current.innerText = `${routeDeviationAngle.toFixed(1)}°`;
        }
        if (avVelRef.current) {
          avVelRef.current.innerText = `${(velocity * 1000).toFixed(0)} M/S`;
        }
      }

      earthMesh.rotation.y += delta * 0.01;
      marsMesh.rotation.y += delta * 0.03;

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
      {/* 1. CAMADA DE VÍDEO CINEMATOGRÁFICO (00:00 -> 00:19) */}
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

          <div className="absolute top-4 right-4 z-40 flex flex-wrap items-center gap-2.5">
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

      {/* 2. BARRA SUPERIOR DE TELEMETRIA (MUNDO CELESTIAL // JORNADA ORBITAL) */}
      <div
        id="avionics-bar"
        className={`absolute top-3 left-1/2 z-10 -translate-x-1/2 flex-wrap items-center justify-center gap-3 sm:gap-4 rounded border border-[#00f2fe]/40 bg-[#050c14]/94 px-3.5 py-1.5 font-mono text-[10px] sm:text-[11px] tracking-[1px] text-[#94a3b8] shadow-[0_4px_20px_rgba(0,0,0,0.9)] whitespace-nowrap ${
          gameState === 'GAMEPLAY' ? 'flex' : 'hidden'
        }`}
      >
        <div className="flex items-center gap-1.5">
          MUNDO CELESTIAL:{' '}
          <span ref={avModeRef} id="av-mode" className="font-bold text-[#00f2fe]">
            PRONTO P/ PARTIDA
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
            {isAudioMuted ? 'MUDO' : 'VOZ ATIVA'}
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

      {/* 3. GUIA DE CORREÇÃO DE ROTA (ESTRADA ESPACIAL / WAZE ESPACIAL) */}
      <div
        ref={routeGuidanceRef}
        id="route-guidance"
        className={`pointer-events-none absolute top-[54px] left-1/2 z-15 -translate-x-1/2 rounded border border-[#00f2fe] bg-[#08121c]/92 px-4 py-1 font-mono text-[11px] tracking-[1.4px] text-[#f8fafc] whitespace-nowrap ${
          gameState === 'GAMEPLAY' ? 'block' : 'hidden'
        }`}
      >
        CORREDOR ORBITAL DE MARTE PROJETADO NO PARA-BRISA // ACIONE A PARTIDA VERMELHA
      </div>

      {/* 4. BARRA DE AÇÃO DIRETA (PARTIDA VERMELHA, SALTO PARA MARTE E PAINEL LOGÍSTICO EM MARTE) */}
      {gameState === 'GAMEPLAY' && (
        <div className="pointer-events-auto absolute top-[88px] left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2.5">
          {uiFlightStage === 'GROUND' && (
            <button
              type="button"
              onClick={() => triggerIgnitionFnRef.current?.()}
              className="cursor-pointer rounded border-2 border-[#ef4444] bg-[#7f1d1d]/95 px-5 py-2 font-mono text-xs font-bold tracking-[1.5px] uppercase text-white shadow-[0_0_25px_rgba(239,68,68,0.85)] transition-transform hover:scale-105 hover:bg-[#991b1b]"
            >
              ● ACIONAR PARTIDA VERMELHA (DECOLAR RUMO A MARTE)
            </button>
          )}

          {uiFlightStage === 'ORBITAL_HIGHWAY' && (
            <button
              type="button"
              onClick={() => triggerWarpToMarsFnRef.current?.()}
              className="cursor-pointer rounded border border-[#00f2fe] bg-[#0369a1]/90 px-4 py-1.5 font-mono text-xs font-bold tracking-[1.2px] uppercase text-[#e0faff] shadow-[0_0_18px_rgba(0,242,254,0.6)] hover:bg-[#0284c7]"
            >
              ⏩ SALTO ORBITAL RÁPIDO: CHEGAR E POUSAR EM MARTE AGORA
            </button>
          )}

          {uiFlightStage === 'MARS_LANDED' && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded border border-[#00f2fe]/60 bg-[#050e1a]/95 px-4 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.9)]">
              <span className="mr-1 font-mono text-[11px] font-bold text-[#00f2fe]">
                LOGÍSTICA BASE ARES-1:
              </span>
              <button
                type="button"
                onClick={() => triggerLogisticsStepFnRef.current?.(1)}
                className={`cursor-pointer rounded border px-3 py-1 font-mono text-[11px] font-bold uppercase ${
                  logisticsStep >= 1
                    ? 'border-[#22c55e] bg-[#14532d] text-[#4ade80]'
                    : 'border-[#00f2fe] bg-[#0c2235] text-[#e0faff] hover:bg-[#153652]'
                }`}
              >
                1. Conectar Umbilical
              </button>
              <button
                type="button"
                onClick={() => triggerLogisticsStepFnRef.current?.(2)}
                className={`cursor-pointer rounded border px-3 py-1 font-mono text-[11px] font-bold uppercase ${
                  logisticsStep >= 2
                    ? 'border-[#22c55e] bg-[#14532d] text-[#4ade80]'
                    : 'border-[#00f2fe] bg-[#0c2235] text-[#e0faff] hover:bg-[#153652]'
                }`}
              >
                2. Enviar Rover na Estrada
              </button>
              <button
                type="button"
                onClick={() => triggerLogisticsStepFnRef.current?.(3)}
                className={`cursor-pointer rounded border px-3 py-1 font-mono text-[11px] font-bold uppercase ${
                  logisticsStep >= 3
                    ? 'border-[#22c55e] bg-[#14532d] text-[#4ade80]'
                    : 'border-[#00f2fe] bg-[#0c2235] text-[#e0faff] hover:bg-[#153652]'
                }`}
              >
                3. Ativar Usina O2 / Combustível
              </button>
              <button
                type="button"
                onClick={() => triggerLogisticsStepFnRef.current?.(4)}
                className={`cursor-pointer rounded border px-3 py-1 font-mono text-[11px] font-bold uppercase ${
                  logisticsStep >= 4
                    ? 'border-[#22c55e] bg-[#14532d] text-[#4ade80]'
                    : 'border-[#00f2fe] bg-[#0c2235] text-[#e0faff] hover:bg-[#153652]'
                }`}
              >
                4. Concluir Entrega Colônia
              </button>
              {logisticsStep >= 4 && (
                <button
                  type="button"
                  onClick={() => triggerLogisticsStepFnRef.current?.(5)}
                  className="cursor-pointer rounded border border-[#ef4444] bg-[#7f1d1d] px-3 py-1 font-mono text-[11px] font-bold uppercase text-white hover:bg-[#991b1b]"
                >
                  Decolar Novamente
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. RETÍCULO DE MARTE NO PARA-BRISA */}
      <div
        ref={marsMarkerRef}
        id="mars-nav-marker"
        style={{ display: 'none' }}
        className="pointer-events-none absolute z-15 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative h-[54px] w-[54px] rounded border-2 border-[#00f2fe] shadow-[0_0_12px_rgba(0,242,254,0.8)]" />
        <div
          ref={marsMarkerLabelRef}
          id="mars-marker-label"
          className="absolute top-[60px] left-1/2 -translate-x-1/2 rounded border border-[#00f2fe] bg-[#060e18]/92 px-2 py-0.5 font-mono text-[10px] font-bold tracking-[1px] text-[#00f2fe] whitespace-nowrap"
        >
          MARTE // 54.60M KM
        </div>
      </div>

      {/* 6. LEGENDA DE VOZ DO HOLOGRAMA CHARLES */}
      <div
        id="cinematic-subtitle"
        className={`pointer-events-none absolute bottom-[56px] left-1/2 z-20 w-[90%] max-w-[660px] -translate-x-1/2 rounded border border-[#00f2fe]/40 bg-[#040a12]/94 px-5 py-2.5 text-left text-[13px] leading-[1.45] tracking-[0.4px] text-[#f8fafc] shadow-[0_10px_35px_rgba(0,0,0,0.85)] ${
          gameState === 'GAMEPLAY' ? 'block' : 'hidden'
        }`}
      >
        <div
          ref={subTagRef}
          id="sub-tag"
          className="mb-1 text-[10px] font-bold tracking-[1.8px] uppercase text-[#00f2fe]"
        >
          CHARLES // HOLOGRAMA IA
        </div>
        <div ref={subContentRef} id="sub-content">
          Saudações, Comandante. Eu sou Charles, a inteligência holográfica da nave Celestial Um.
        </div>
      </div>

      {/* 7. DICA DE OPERAÇÃO INFERIOR */}
      <div
        ref={sopHintRef}
        id="sop-hint"
        className={`pointer-events-none absolute bottom-3.5 left-1/2 z-10 -translate-x-1/2 rounded border border-[#00f2fe]/20 bg-[#060c14]/90 px-3.5 py-1.5 font-mono text-[10px] sm:text-[11px] tracking-[1.2px] uppercase text-[#94a3b8] whitespace-nowrap ${
          gameState === 'GAMEPLAY' ? 'block' : 'hidden'
        }`}
      >
        CLIQUE NO BOTÃO VERMELHO DE PARTIDA NO PAINEL (OU NO BOTÃO DECOLAR ACIMA)
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
