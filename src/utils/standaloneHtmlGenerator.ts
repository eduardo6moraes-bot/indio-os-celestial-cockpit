/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates the complete, self-contained single-file index.html (HTML5 + CSS3 + Three.js r128 CDN + WebXR)
 * ready for direct deployment to Vercel or Meta Quest Browser.
 */
export function buildStandaloneVercelHtml(videoUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Mundo Celestial: IndioOS — Simulador WebXR & Cockpit 3D</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-touch-callout: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #020408;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    #canvas-container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
    }
    /* CAMADA DE VÍDEO CINEMATOGRÁFICO (00:00 -> 00:19) */
    #intro-video-layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 30;
      background: #000;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
    }
    #intro-video-layer.fade-out {
      opacity: 0;
      pointer-events: none;
    }
    #intro-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* BARRA SUPERIOR DE TELEMETRIA */
    #avionics-bar {
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      pointer-events: none;
      display: none;
      gap: 16px;
      background: rgba(5, 12, 20, 0.92);
      border: 1px solid rgba(0, 242, 254, 0.4);
      border-radius: 4px;
      padding: 6px 16px;
      font-size: 11px;
      color: #94a3b8;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.9);
      white-space: nowrap;
    }
    .data-pill {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .data-pill span.val {
      color: #00f2fe;
      font-weight: 700;
    }
    /* GUIA DE CORREÇÃO DE ROTA (SPACE-WAZE) */
    #route-guidance {
      position: absolute;
      top: 56px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 15;
      pointer-events: none;
      background: rgba(8, 18, 28, 0.92);
      border: 1px solid #00f2fe;
      padding: 5px 16px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      color: #f8fafc;
      letter-spacing: 1.4px;
      display: none;
      white-space: nowrap;
    }
    /* MIRA DE MARTE NO PARA-BRISA */
    #mars-nav-marker {
      position: absolute;
      z-index: 15;
      pointer-events: none;
      display: none;
      transform: translate(-50%, -50%);
    }
    .nav-box {
      border: 2px solid #00f2fe;
      box-shadow: 0 0 12px rgba(0, 242, 254, 0.8);
      width: 52px;
      height: 52px;
      border-radius: 4px;
    }
    .nav-label {
      position: absolute;
      top: 58px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(6, 14, 24, 0.92);
      border: 1px solid #00f2fe;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      color: #00f2fe;
      font-weight: bold;
      white-space: nowrap;
      font-family: monospace;
    }
    /* LEGENDAS DO CHARLES */
    #cinematic-subtitle {
      position: absolute;
      bottom: 58px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      pointer-events: none;
      background: rgba(4, 10, 18, 0.92);
      border: 1px solid rgba(0, 242, 254, 0.35);
      padding: 10px 20px;
      border-radius: 4px;
      max-width: 640px;
      width: 90%;
      text-align: left;
      font-size: 13px;
      line-height: 1.45;
      color: #f8fafc;
      display: none;
    }
    #cinematic-subtitle .tag {
      font-size: 10px;
      letter-spacing: 1.8px;
      color: #00f2fe;
      font-weight: 700;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    #sop-hint {
      position: absolute;
      bottom: 18px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      font-size: 11px;
      letter-spacing: 1.2px;
      color: #94a3b8;
      background: rgba(6, 12, 20, 0.88);
      padding: 6px 14px;
      border-radius: 3px;
      border: 1px solid rgba(0, 242, 254, 0.2);
      pointer-events: none;
      text-transform: uppercase;
      white-space: nowrap;
      display: none;
    }
    .top-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 40;
      background: rgba(8, 18, 30, 0.88);
      border: 1px solid rgba(0, 242, 254, 0.5);
      color: #00f2fe;
      padding: 7px 14px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      border-radius: 4px;
      cursor: pointer;
      text-transform: uppercase;
    }
    #unmute-video-btn {
      right: 145px;
    }
    #gyro-permission-btn {
      top: 52px;
      display: none;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/webxr/VRButton.js"><\/script>
</head>
<body>
  <!-- CAMADA DE VÍDEO DE ABERTURA (CORTE EXATO AOS 19.0s) -->
  <div id="intro-video-layer">
    <video id="intro-video" src="${videoUrl}" playsinline autoplay muted preload="auto"></video>
    <button id="unmute-video-btn" class="top-btn">ATIVAR SOM</button>
    <button id="skip-intro-btn" class="top-btn">PULAR INTRO</button>
  </div>

  <!-- HUD 3D -->
  <div id="avionics-bar">
    <div class="data-pill">INDIO-OS: <span class="val" id="av-mode">DESPERTANDO</span></div>
    <div class="data-pill">DIST MARTE: <span class="val" id="av-dist">54.60M KM</span></div>
    <div class="data-pill">DESVIO: <span class="val" id="av-err">00.0°</span></div>
    <div class="data-pill">VEL: <span class="val" id="av-vel">0 M/S</span></div>
  </div>

  <div id="route-guidance">SISTEMAS ONLINE // ACIONE A IGNIÇÃO À ESQUERDA</div>

  <div id="mars-nav-marker">
    <div class="nav-box"></div>
    <div class="nav-label" id="mars-marker-label">MARTE // 54.60M KM</div>
  </div>

  <div id="cinematic-subtitle">
    <div class="tag" id="sub-tag">COPILOTO QUÂNTICO // CHARLES</div>
    <div id="sub-content">Identidade biométrica confirmada no console direito. Sistemas da cabine online.</div>
  </div>

  <div id="sop-hint">TOQUE NA CHAVE VERMELHA DE IGNIÇÃO À ESQUERDA OU NO LEITOR DE PALMA CIANO</div>
  <button id="gyro-permission-btn" class="top-btn">ATIVAR GIROSCÓPIO</button>
  <div id="canvas-container"></div>

  <script>
    /* =========================================================================
       1. ÁUDIO WEB AUDIO API + SÍNTESE DE VOZ DO COPILOTO CHARLES
       ========================================================================= */
    let charlesVoice = null;
    function pickBestVoice() {
      if (!('speechSynthesis' in window)) return;
      const voices = window.speechSynthesis.getVoices();
      charlesVoice = voices.find(v => v.lang.includes('pt-BR') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural')))
        || voices.find(v => v.lang.includes('pt-BR'))
        || voices.find(v => v.lang.startsWith('pt'));
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = pickBestVoice;
      pickBestVoice();
    }

    const SoundSystem = {
      ctx: null,
      rocketGain: null,
      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioCtx();
          this.startAmbiance();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      },
      startAmbiance() {
        try {
          const hum = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          hum.type = 'sine';
          hum.frequency.setValueAtTime(400, this.ctx.currentTime);
          g.gain.setValueAtTime(0.004, this.ctx.currentTime);
          hum.connect(g);
          g.connect(this.ctx.destination);
          hum.start();
        } catch(e) {}
      },
      playBiometricChime() {
        this.init();
        try {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.055);
            g.gain.setValueAtTime(0.001, this.ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + idx * 0.055 + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.4);
            osc.connect(g);
            g.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + idx * 0.055);
            osc.stop(this.ctx.currentTime + 1.5);
          });
        } catch(e) {}
      },
      playClick() {
        this.init();
        try {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, this.ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.04);
          g.gain.setValueAtTime(0.18, this.ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
          osc.connect(g);
          g.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.045);
        } catch(e) {}
      },
      startThrust() {
        this.init();
        if (this.rocketGain) return;
        try {
          this.rocketGain = this.ctx.createGain();
          this.rocketGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
          const buf = this.ctx.createBuffer(1, 2 * this.ctx.sampleRate, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const noise = this.ctx.createBufferSource();
          noise.buffer = buf;
          noise.loop = true;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(80, this.ctx.currentTime);
          noise.connect(filter);
          filter.connect(this.rocketGain);
          this.rocketGain.connect(this.ctx.destination);
          noise.start();
        } catch(e) {}
      },
      setThrust(p) {
        if (this.rocketGain && this.ctx) {
          this.rocketGain.gain.setTargetAtTime(Math.max(0.001, p * 0.35), this.ctx.currentTime, 0.1);
        }
      }
    };

    function speakCharles(tag, text) {
      SoundSystem.init();
      const sub = document.getElementById('cinematic-subtitle');
      sub.style.display = 'block';
      document.getElementById('sub-tag').innerText = tag;
      document.getElementById('sub-content').innerText = text;
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'pt-BR';
          if (charlesVoice) u.voice = charlesVoice;
          u.rate = 1.02;
          u.pitch = 0.95;
          window.speechSynthesis.speak(u);
        } catch(e) {}
      }
    }

    /* =========================================================================
       2. CENA THREE.JS + COCKPIT FIEL AOS FRAMES 00:16 - 00:19
       ========================================================================= */
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd99b66);
    scene.fog = new THREE.FogExp2(0xd99b66, 0.0018);

    const shipRig = new THREE.Group();
    scene.add(shipRig);

    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.04, 4000);
    const pilotEyePos = new THREE.Vector3(0, 1.24, 0.24);
    camera.position.copy(pilotEyePos);
    shipRig.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    try {
      if (typeof VRButton !== 'undefined') {
        document.body.appendChild(VRButton.createButton(renderer));
      }
    } catch(e) {}

    // Luz Solar do Amanhecer (Frame 00:01 - 00:16) + Luzes Ciano Internas
    const sunLight = new THREE.DirectionalLight(0xffcf96, 3.0);
    sunLight.position.set(-18, 22, -45);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x88d8ff, 0x1a1412, 0.55);
    scene.add(hemiLight);

    const cabinCyanLight = new THREE.PointLight(0x00f2fe, 1.4, 3.8);
    cabinCyanLight.position.set(0, 1.72, -0.15);
    shipRig.add(cabinCyanLight);

    // EXTERIOR: TORRE, FOGUETE E VAPOR DO AMANHECER (VISÍVEIS NO FRAME 00:16)
    const exteriorLaunchpad = new THREE.Group();
    scene.add(exteriorLaunchpad);

    const rocketBooster = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.4, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.3 })
    );
    rocketBooster.position.set(-18, 12, -42);
    exteriorLaunchpad.add(rocketBooster);

    const gantryTower = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 52, 4.5),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6, metalness: 0.5, wireframe: false })
    );
    gantryTower.position.set(16, 14, -48);
    exteriorLaunchpad.add(gantryTower);

    // Nuvens de vapor na base
    const steamGroup = new THREE.Group();
    const steamMat = new THREE.MeshStandardMaterial({ color: 0xffe4c4, roughness: 0.9, transparent: true, opacity: 0.72 });
    for (let i = 0; i < 18; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + (i % 5) * 2.2, 16, 16), steamMat);
      puff.position.set(-28 + i * 3.5, -4 + Math.sin(i) * 2.5, -35 - (i % 4) * 6);
      steamGroup.add(puff);
    }
    exteriorLaunchpad.add(steamGroup);

    // Estrelas e Marte para a subida espacial
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(3600 * 3);
    for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 2400;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.2, color: 0xffffff, transparent: true, opacity: 0.0 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    const marsWorldPos = new THREE.Vector3(90, 180, -1400);
    const marsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(28, 36, 36),
      new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.75, emissive: 0x2a0a02 })
    );
    marsMesh.position.copy(marsWorldPos);
    scene.add(marsMesh);

    // ESTRUTURA DA CABINE (PAREDES DE COMPÓSITO + 3 TIRAS LED CIANO NO TETO + 3 JANELAS ANGULARES)
    const cockpitGroup = new THREE.Group();
    shipRig.add(cockpitGroup);

    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 0.45, metalness: 0.75 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x161f2c, roughness: 0.35, metalness: 0.85 });
    const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });

    // Teto com 3 fileiras de LED ciano (Frame 00:15)
    const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.8), carbonMat);
    roofPanel.position.set(0, 1.92, -0.1);
    roofPanel.rotation.x = 0.12;
    cockpitGroup.add(roofPanel);

    [-0.48, 0, 0.48].forEach(lx => {
      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.015, 1.25), cyanLedMat);
      ledStrip.position.set(lx, 1.87, -0.08);
      ledStrip.rotation.x = 0.12;
      cockpitGroup.add(ledStrip);
    });

    // Colunas angulares do para-brisa de 3 painéis (Frames 00:16 - 00:19)
    const strutGeo = new THREE.BoxGeometry(0.075, 0.95, 0.09);
    const leftStrut = new THREE.Mesh(strutGeo, darkMetalMat);
    leftStrut.position.set(-0.38, 1.46, -0.68);
    leftStrut.rotation.z = -0.26;
    leftStrut.rotation.x = -0.28;
    cockpitGroup.add(leftStrut);

    const rightStrut = new THREE.Mesh(strutGeo, darkMetalMat);
    rightStrut.position.set(0.38, 1.46, -0.68);
    rightStrut.rotation.z = 0.26;
    rightStrut.rotation.x = -0.28;
    cockpitGroup.add(rightStrut);

    const farLeftPillar = new THREE.Mesh(strutGeo, carbonMat);
    farLeftPillar.position.set(-0.98, 1.42, -0.52);
    farLeftPillar.rotation.z = -0.35;
    cockpitGroup.add(farLeftPillar);

    const farRightPillar = new THREE.Mesh(strutGeo, carbonMat);
    farRightPillar.position.set(0.98, 1.42, -0.52);
    farRightPillar.rotation.z = 0.35;
    cockpitGroup.add(farRightPillar);

    // Alça amarela na moldura direita (Frame 00:16 - 00:19)
    const yellowHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.38, 16),
      new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3, metalness: 0.6 })
    );
    yellowHandle.position.set(0.76, 1.22, -0.50);
    yellowHandle.rotation.z = 1.15;
    yellowHandle.rotation.y = -0.4;
    cockpitGroup.add(yellowHandle);

    // CONSOLE FRONTAL ANGULADO (CENTRO + ALA ESQUERDA + ALA DIREITA)
    const consoleRoot = new THREE.Group();
    consoleRoot.position.set(0, 0.84, -0.58);
    cockpitGroup.add(consoleRoot);

    const centerConsole = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.36, 0.72), carbonMat);
    centerConsole.rotation.x = 0.22;
    consoleRoot.add(centerConsole);

    // Ala Direita do Console (onde fica a placa biométrica da palma no frame 00:17 - 00:19)
    const rightConsoleWing = new THREE.Group();
    rightConsoleWing.position.set(0.46, -0.06, 0.28);
    rightConsoleWing.rotation.x = 0.42;
    rightConsoleWing.rotation.y = -0.18;
    consoleRoot.add(rightConsoleWing);

    const rightWingBox = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.48), darkMetalMat);
    rightConsoleWing.add(rightWingBox);

    // Ala Esquerda do Console (Chaves vermelhas e sliders do frame 00:17 - 00:19)
    const leftConsoleWing = new THREE.Group();
    leftConsoleWing.position.set(-0.48, -0.06, 0.28);
    leftConsoleWing.rotation.x = 0.42;
    leftConsoleWing.rotation.y = 0.18;
    consoleRoot.add(leftConsoleWing);

    const leftWingBox = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.48), darkMetalMat);
    leftConsoleWing.add(leftWingBox);

    /* =========================================================================
       3. SCANNER BIOMÉTRICO COM SILHUETA DA PALMA CIANO (FRAME 00:17 - 00:19)
       ========================================================================= */
    const palmCanvas = document.createElement('canvas');
    palmCanvas.width = 512; palmCanvas.height = 512;
    const palmCtx = palmCanvas.getContext('2d');
    const palmTex = new THREE.CanvasTexture(palmCanvas);

    function drawPalmScanner(glowLevel, scanLineY) {
      palmCtx.fillStyle = '#03121c';
      palmCtx.fillRect(0, 0, 512, 512);

      // Moldura arredondada ciano neon
      palmCtx.strokeStyle = '#00f2fe';
      palmCtx.lineWidth = 10;
      palmCtx.strokeRect(26, 26, 460, 340);

      // Brilho de fundo da palma
      const rad = palmCtx.createRadialGradient(256, 195, 15, 256, 195, 165);
      rad.addColorStop(0, \`rgba(0, 242, 254, \${0.35 + glowLevel * 0.45})\`);
      rad.addColorStop(1, 'rgba(0, 242, 254, 0.02)');
      palmCtx.fillStyle = rad;
      palmCtx.fillRect(36, 36, 440, 320);

      // Desenho anatômico da silhueta da mão (5 dedos + palma como no frame 00:17)
      palmCtx.fillStyle = glowLevel > 0.5 ? '#e0faff' : '#7dd3fc';
      palmCtx.beginPath();
      palmCtx.arc(256, 235, 54, 0, Math.PI * 2);
      palmCtx.fill();

      // Dedos: Polegar, Indicador, Médio, Anelar, Mínimo
      const fingers = [
        { x: 175, y: 205, w: 22, h: 68, a: -0.48 },
        { x: 218, y: 132, w: 21, h: 92, a: -0.10 },
        { x: 256, y: 120, w: 22, h: 104, a: 0.0 },
        { x: 294, y: 134, w: 21, h: 92, a: 0.10 },
        { x: 328, y: 162, w: 19, h: 72, a: 0.25 }
      ];
      fingers.forEach(f => {
        palmCtx.save();
        palmCtx.translate(f.x, f.y);
        palmCtx.rotate(f.a);
        palmCtx.beginPath();
        palmCtx.roundRect(-f.w / 2, -f.h / 2, f.w, f.h, 10);
        palmCtx.fill();
        palmCtx.restore();
      });

      // Linhas de telemetria inferiores (como no frame 00:17)
      palmCtx.strokeStyle = '#00f2fe';
      palmCtx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const bx = 40 + i * 74;
        palmCtx.strokeRect(bx, 392, 58, 84);
        const h = 25 + ((i * 19 + Math.floor(glowLevel * 40)) % 48);
        palmCtx.fillStyle = '#00f2fe';
        palmCtx.fillRect(bx + 8, 468 - h, 42, h);
      }

      if (scanLineY >= 0) {
        palmCtx.fillStyle = '#ffffff';
        palmCtx.fillRect(30, scanLineY, 452, 8);
      }
      palmTex.needsUpdate = true;
    }
    drawPalmScanner(0.8, -1);

    const scannerPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.018, 0.28),
      new THREE.MeshBasicMaterial({ map: palmTex })
    );
    scannerPlate.position.set(-0.04, 0.075, -0.02);
    scannerPlate.userData = { type: 'palm_scanner' };
    rightConsoleWing.add(scannerPlate);

    const palmPointLight = new THREE.PointLight(0x00f2fe, 1.8, 1.4);
    palmPointLight.position.set(-0.04, 0.18, -0.02);
    rightConsoleWing.add(palmPointLight);

    /* =========================================================================
       4. QUATRO MONITORES MFD (ESQUERDO, CENTRAL SUP, CENTRAL INF, DIREITO)
       ========================================================================= */
    function makeScreenCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return { c, ctx: c.getContext('2d'), tex: new THREE.CanvasTexture(c) };
    }
    const mfdL = makeScreenCanvas(512, 320);
    const mfdC = makeScreenCanvas(640, 360);
    const mfdLow = makeScreenCanvas(480, 260);
    const mfdR = makeScreenCanvas(512, 320);

    const screenMeshL = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ map: mfdL.tex }));
    screenMeshL.position.set(-0.54, 0.24, -0.10);
    screenMeshL.rotation.y = 0.18;
    consoleRoot.add(screenMeshL);

    const screenMeshC = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.30), new THREE.MeshBasicMaterial({ map: mfdC.tex }));
    screenMeshC.position.set(0, 0.26, -0.14);
    consoleRoot.add(screenMeshC);

    const screenMeshLow = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.21), new THREE.MeshBasicMaterial({ map: mfdLow.tex }));
    screenMeshLow.position.set(0, 0.09, 0.14);
    screenMeshLow.rotation.x = -0.55;
    consoleRoot.add(screenMeshLow);

    const screenMeshR = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ map: mfdR.tex }));
    screenMeshR.position.set(0.54, 0.24, -0.10);
    screenMeshR.rotation.y = -0.18;
    consoleRoot.add(screenMeshR);

    // CONTROLES FÍSICOS NA ALA ESQUERDA + MANCHE CENTRAL
    const interactiveControls = [scannerPlate];

    const ignSwitch = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.045, 0.075),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d })
    );
    ignSwitch.position.set(0.08, 0.085, -0.05);
    ignSwitch.userData = { type: 'ignition' };
    leftConsoleWing.add(ignSwitch);
    interactiveControls.push(ignSwitch);

    const throttleHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.055, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8 })
    );
    throttleHandle.position.set(-0.08, 0.085, 0.06);
    throttleHandle.userData = { type: 'throttle' };
    leftConsoleWing.add(throttleHandle);
    interactiveControls.push(throttleHandle);

    const stickPivot = new THREE.Group();
    stickPivot.position.set(0, -0.02, 0.36);
    const stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.18), darkMetalMat);
    stickShaft.position.y = 0.09;
    stickPivot.add(stickShaft);
    const stickGrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.085, 0.055), carbonMat);
    stickGrip.position.y = 0.09;
    stickShaft.add(stickGrip);
    stickPivot.userData = { type: 'joystick' };
    consoleRoot.add(stickPivot);
    interactiveControls.push(stickPivot);

    // ORBE QUÂNTICA DO COPILOTO CHARLES (PILAR SUPERIOR DIREITO)
    const charlesGroup = new THREE.Group();
    charlesGroup.position.set(0.56, 1.48, -0.56);
    cockpitGroup.add(charlesGroup);

    const charlesCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0faff })
    );
    charlesGroup.add(charlesCore);

    const charlesRings = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: 0.55 })
    );
    charlesGroup.add(charlesRings);

    /* =========================================================================
       5. TRANSIÇÃO EXATA DO VÍDEO AOS 19.0 SEGUNDOS -> COCKPIT 3D
       ========================================================================= */
    const videoEl = document.getElementById('intro-video');
    const videoLayer = document.getElementById('intro-video-layer');
    const unmuteBtn = document.getElementById('unmute-video-btn');
    const skipBtn = document.getElementById('skip-intro-btn');

    let is3DActive = false;
    let scanSweepProgress = 0;

    function trigger3DCrossover() {
      if (is3DActive) return;
      is3DActive = true;
      videoLayer.classList.add('fade-out');
      setTimeout(() => {
        videoEl.pause();
        videoLayer.style.display = 'none';
      }, 220);

      document.getElementById('avionics-bar').style.display = 'flex';
      document.getElementById('route-guidance').style.display = 'block';
      document.getElementById('sop-hint').style.display = 'block';

      SoundSystem.playBiometricChime();
      scanSweepProgress = 1.0;
      speakCharles(
        'COPILOTO QUÂNTICO // CHARLES',
        'Autenticação biométrica concluída no console direito, Comandante. Sistemas online. Acione a chave vermelha à esquerda para ignição.'
      );
    }

    videoEl.addEventListener('timeupdate', () => {
      if (!is3DActive && videoEl.currentTime >= 19.0) {
        trigger3DCrossover();
      }
    });
    videoEl.addEventListener('ended', trigger3DCrossover);
    skipBtn.addEventListener('click', trigger3DCrossover);
    unmuteBtn.addEventListener('click', () => {
      SoundSystem.init();
      videoEl.muted = false;
      videoEl.play().catch(() => {});
      unmuteBtn.style.display = 'none';
    });

    /* =========================================================================
       6. INTERAÇÃO, FÍSICA DE VOO E RENDERIZAÇÃO MFD FIEL AO VÍDEO
       ========================================================================= */
    let flightStage = 'GROUND';
    let throttle = 0.0;
    let velocity = 0.0;
    let altitude = 0.0;
    let distanceToMars = 54600000;
    let routeDeviationAngle = 0.0;
    let shipYaw = 0, shipPitch = 0, shipRoll = 0;
    let stickX = 0, stickY = 0;
    let headYaw = 0, headPitch = -0.18, targetYaw = 0, targetPitch = -0.18;
    let isPointerDown = false, prevX = 0, prevY = 0, activeCtrl = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    window.addEventListener('pointerdown', (e) => {
      SoundSystem.init();
      if (!is3DActive) {
        if (videoEl.muted) {
          videoEl.muted = false;
          unmuteBtn.style.display = 'none';
        }
        return;
      }
      isPointerDown = true;
      prevX = e.clientX; prevY = e.clientY;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactiveControls, true);
      if (hits.length > 0) {
        let o = hits[0].object;
        while (o.parent && !o.userData.type) o = o.parent;
        const t = o.userData.type;
        if (t === 'palm_scanner') {
          SoundSystem.playBiometricChime();
          scanSweepProgress = 1.0;
          speakCharles('BIOMETRIA // INDIO-OS', 'Leitura biométrica revalidada. Todos os barramentos operacionais.');
        } else if (t === 'ignition') {
          SoundSystem.playClick();
          if (flightStage === 'GROUND') {
            flightStage = 'ASCENT';
            throttle = 1.0;
            SoundSystem.startThrust();
            speakCharles('DIRETOR DE VOO // CHARLES', 'Ignição acionada! Deixando a plataforma no amanhecer rumo à órbita e Marte.');
            document.getElementById('av-mode').innerText = 'PROPULSÃO ATIVA';
          }
        } else if (t === 'throttle' || t === 'joystick') {
          activeCtrl = t;
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!isPointerDown || !is3DActive) return;
      const dx = e.clientX - prevX, dy = e.clientY - prevY;
      prevX = e.clientX; prevY = e.clientY;
      if (activeCtrl === 'throttle') {
        throttle = Math.max(0, Math.min(1, throttle - dy * 0.006));
      } else if (activeCtrl === 'joystick' || flightStage !== 'GROUND') {
        stickX = Math.max(-1, Math.min(1, stickX + dx * 0.01));
        stickY = Math.max(-1, Math.min(1, stickY + dy * 0.01));
        stickPivot.rotation.z = -stickX * 0.35;
        stickPivot.rotation.x = stickY * 0.35;
      } else {
        targetYaw = Math.max(-1.1, Math.min(1.1, targetYaw - dx * 0.0035));
        targetPitch = Math.max(-0.6, Math.min(0.5, targetPitch - dy * 0.0035));
      }
    });

    window.addEventListener('pointerup', () => {
      isPointerDown = false; activeCtrl = null;
      stickX = 0; stickY = 0; stickPivot.rotation.set(0, 0, 0);
    });

    function updateMFDs(time) {
      // MFD ESQUERDO (Ondas + Gauges 70% / 35% do frame 00:18)
      const cl = mfdL.ctx;
      cl.fillStyle = '#030d16'; cl.fillRect(0, 0, 512, 320);
      cl.strokeStyle = '#00f2fe'; cl.lineWidth = 2; cl.strokeRect(8, 8, 496, 304);
      cl.fillStyle = '#00f2fe'; cl.font = 'bold 14px monospace';
      cl.fillText('TELEMETRIA // OSCILOSCÓPIO DE EMPUXO', 20, 30);
      [95, 195].forEach((baseY, idx) => {
        cl.strokeStyle = '#0c4a6e'; cl.strokeRect(20, baseY - 38, 320, 76);
        cl.strokeStyle = '#00f2fe'; cl.beginPath();
        for (let x = 0; x < 320; x += 6) {
          const y = baseY + Math.sin(x * 0.06 + time * (4 + idx * 2)) * (16 + throttle * 14);
          if (x === 0) cl.moveTo(20 + x, y); else cl.lineTo(20 + x, y);
        }
        cl.stroke();
      });
      // Gauges 70% e 35%
      [{ y: 105, val: '70%' }, { y: 215, val: '35%' }].forEach(g => {
        cl.beginPath(); cl.arc(420, g.y, 40, 0, Math.PI * 2); cl.stroke();
        cl.fillText(g.val, 404, g.y + 5);
      });
      mfdL.tex.needsUpdate = true;

      // MFD CENTRAL (Radar circular + Horizonte do frame 00:18)
      const cc = mfdC.ctx;
      cc.fillStyle = '#030d16'; cc.fillRect(0, 0, 640, 360);
      cc.strokeStyle = '#00f2fe'; cc.lineWidth = 2; cc.strokeRect(8, 8, 624, 344);
      cc.save();
      cc.translate(320, 180);
      cc.rotate(-shipRoll);
      cc.beginPath(); cc.arc(0, 0, 118, 0, Math.PI * 2); cc.stroke();
      cc.beginPath(); cc.arc(0, 0, 78, 0, Math.PI * 2); cc.stroke();
      const py = shipPitch * 110;
      cc.beginPath(); cc.moveTo(-110, py); cc.lineTo(110, py); cc.stroke();
      cc.restore();
      cc.strokeRect(475, 70, 130, 65);
      cc.fillStyle = '#00f2fe'; cc.font = 'bold 22px monospace';
      cc.fillText('35', 525, 110);
      cc.strokeRect(475, 155, 130, 65);
      cc.fillText('155', 518, 195);
      mfdC.tex.needsUpdate = true;

      // MFD CENTRAL INFERIOR (Grade Tática)
      const clo = mfdLow.ctx;
      clo.fillStyle = '#030d16'; clo.fillRect(0, 0, 480, 260);
      clo.strokeStyle = '#00f2fe'; clo.strokeRect(8, 8, 464, 244);
      clo.beginPath(); clo.arc(240, 130, 82, 0, Math.PI * 2); clo.stroke();
      clo.beginPath(); clo.moveTo(140, 130); clo.lineTo(340, 130); clo.moveTo(240, 40); clo.lineTo(240, 220); clo.stroke();
      mfdLow.tex.needsUpdate = true;

      // MFD DIREITO (Esquemático Wireframe da Cápsula do frame 00:18)
      const cr = mfdR.ctx;
      cr.fillStyle = '#030d16'; cr.fillRect(0, 0, 512, 320);
      cr.strokeStyle = '#00f2fe'; cr.strokeRect(8, 8, 496, 304);
      cr.beginPath();
      cr.moveTo(130, 65); cr.lineTo(185, 140); cr.lineTo(175, 245); cr.lineTo(85, 245); cr.lineTo(75, 140); cr.closePath();
      cr.stroke();
      for (let i = 0; i < 5; i++) {
        cr.fillStyle = '#0c4a6e'; cr.fillRect(240, 65 + i * 42, 230, 22);
        cr.fillStyle = '#00f2fe'; cr.fillRect(240, 65 + i * 42, 160 + Math.sin(time + i) * 40, 22);
      }
      mfdR.tex.needsUpdate = true;
    }

    const clock = new THREE.Clock();
    const skySunrise = new THREE.Color(0xd99b66);
    const skySpace = new THREE.Color(0x010308);
    const marsScreenPos = new THREE.Vector3();

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.08);
      const time = clock.getElapsedTime();

      if (!renderer.xr.isPresenting) {
        headYaw += (targetYaw - headYaw) * 0.12;
        headPitch += (targetPitch - headPitch) * 0.12;
        camera.rotation.order = 'YXZ';
        camera.rotation.y = headYaw;
        camera.rotation.x = headPitch;
      }

      if (scanSweepProgress > 0) {
        scanSweepProgress = Math.max(0, scanSweepProgress - dt * 0.7);
        drawPalmScanner(1.0, (1.0 - scanSweepProgress) * 340);
      } else {
        drawPalmScanner(0.65 + Math.sin(time * 3.5) * 0.25, -1);
      }

      if (flightStage !== 'GROUND') {
        SoundSystem.setThrust(throttle);
        shipYaw -= stickX * 0.6 * dt;
        shipPitch -= stickY * 0.6 * dt;
        shipRoll = -stickX * 0.38;
        shipRig.rotation.set(shipPitch, shipYaw, shipRoll, 'YXZ');

        velocity += throttle * 0.055 * dt;
        altitude = Math.min(1.0, altitude + velocity * dt * 0.18);

        // Transição suave do céu de amanhecer na plataforma para o espaço profundo
        scene.background.lerpColors(skySunrise, skySpace, altitude);
        scene.fog.color.copy(scene.background);
        starMat.opacity = altitude;
        exteriorLaunchpad.position.y -= velocity * dt * 28;

        const shipFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(shipRig.quaternion);
        const toMars = marsWorldPos.clone().sub(shipRig.position).normalize();
        routeDeviationAngle = Math.acos(Math.max(-1, Math.min(1, shipFwd.dot(toMars)))) * (180 / Math.PI);

        if (routeDeviationAngle < 15) {
          distanceToMars = Math.max(1000, distanceToMars - velocity * 480000 * dt);
        }

        marsScreenPos.copy(marsWorldPos).project(camera);
        const marker = document.getElementById('mars-nav-marker');
        if (marsScreenPos.z < 1.0) {
          marker.style.display = 'block';
          marker.style.left = ((marsScreenPos.x * 0.5 + 0.5) * window.innerWidth) + 'px';
          marker.style.top = ((-(marsScreenPos.y * 0.5) + 0.5) * window.innerHeight) + 'px';
        } else {
          marker.style.display = 'none';
        }

        document.getElementById('av-dist').innerText = (distanceToMars / 1e6).toFixed(2) + 'M KM';
        document.getElementById('av-err').innerText = routeDeviationAngle.toFixed(1) + '°';
        document.getElementById('av-vel').innerText = (velocity * 1000).toFixed(0) + ' M/S';
      }

      charlesGroup.position.y = 1.48 + Math.sin(time * 2.6) * 0.014;
      charlesRings.rotation.y += 0.025;

      updateMFDs(time);
      renderer.render(scene, camera);
    });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  <\/script>
</body>
</html>`;
}
