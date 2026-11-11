/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates the complete, self-contained single-file index.html (HTML5 + CSS3 + Three.js r128 CDN + WebXR)
 * featuring the Zordon-style Holographic Charles AI Face, prominent Red Ignition Button,
 * 3D Orbital Highway to Mars, Mars Landing at Base Ares-1, and 4-step Surface Logistics.
 */
export function buildStandaloneVercelHtml(videoUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Mundo Celestial — Jornada Orbital (Simulador WebXR & Logística Marte)</title>
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
    #avionics-bar {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      pointer-events: none;
      display: none;
      gap: 16px;
      background: rgba(5, 12, 20, 0.94);
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
    #route-guidance {
      position: absolute;
      top: 52px;
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
    #action-bar {
      position: absolute;
      top: 86px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      display: none;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .action-btn {
      cursor: pointer;
      padding: 8px 16px;
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 1px;
      border-radius: 4px;
      text-transform: uppercase;
      color: #fff;
      background: #0c2235;
      border: 1px solid #00f2fe;
    }
    .action-btn.red-start {
      background: #7f1d1d;
      border: 2px solid #ef4444;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.85);
    }
    .action-btn.done {
      background: #14532d;
      border-color: #22c55e;
      color: #4ade80;
    }
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
    #cinematic-subtitle {
      position: absolute;
      bottom: 56px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      pointer-events: none;
      background: rgba(4, 10, 18, 0.94);
      border: 1px solid rgba(0, 242, 254, 0.4);
      padding: 10px 20px;
      border-radius: 4px;
      max-width: 650px;
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
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      font-size: 11px;
      letter-spacing: 1.2px;
      color: #94a3b8;
      background: rgba(6, 12, 20, 0.9);
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
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/webxr/VRButton.js"><\/script>
</head>
<body>
  <div id="intro-video-layer">
    <video id="intro-video" src="${videoUrl}" playsinline autoplay muted preload="auto"></video>
    <button id="unmute-video-btn" class="top-btn">ATIVAR SOM</button>
    <button id="skip-intro-btn" class="top-btn">PULAR INTRO</button>
  </div>

  <div id="avionics-bar">
    <div class="data-pill">MUNDO CELESTIAL: <span class="val" id="av-mode">PRONTO P/ PARTIDA</span></div>
    <div class="data-pill">DIST MARTE: <span class="val" id="av-dist">54.60M KM</span></div>
    <div class="data-pill">DESVIO: <span class="val" id="av-err">00.0°</span></div>
    <div class="data-pill">VEL: <span class="val" id="av-vel">0 M/S</span></div>
  </div>

  <div id="route-guidance">CORREDOR ORBITAL DE MARTE PROJETADO NO PARA-BRISA // ACIONE A PARTIDA VERMELHA</div>

  <div id="action-bar">
    <button id="btn-ignite" class="action-btn red-start">● ACIONAR PARTIDA VERMELHA (DECOLAR RUMO A MARTE)</button>
    <button id="btn-warp" class="action-btn" style="display:none;">⏩ SALTO ORBITAL: CHEGAR E POUSAR EM MARTE AGORA</button>
    <button id="btn-log-1" class="action-btn" style="display:none;">1. Conectar Umbilical</button>
    <button id="btn-log-2" class="action-btn" style="display:none;">2. Enviar Rover na Estrada</button>
    <button id="btn-log-3" class="action-btn" style="display:none;">3. Ativar Usina O2</button>
    <button id="btn-log-4" class="action-btn" style="display:none;">4. Concluir Entrega</button>
  </div>

  <div id="mars-nav-marker">
    <div class="nav-box"></div>
    <div class="nav-label" id="mars-marker-label">MARTE // 54.60M KM</div>
  </div>

  <div id="cinematic-subtitle">
    <div class="tag" id="sub-tag">CHARLES // HOLOGRAMA IA</div>
    <div id="sub-content">Saudações, Comandante. Eu sou Charles, a inteligência holográfica da nave Celestial Um.</div>
  </div>

  <div id="sop-hint">CLIQUE NO BOTÃO VERMELHO DE PARTIDA NO PAINEL (OU NO BOTÃO DECOLAR ACIMA)</div>
  <div id="canvas-container"></div>

  <script>
    let charlesVoice = null;
    let isCharlesSpeaking = false;
    function pickBestVoice() {
      if (!('speechSynthesis' in window)) return;
      const voices = window.speechSynthesis.getVoices();
      charlesVoice = voices.find(v => v.lang.includes('pt-BR') && /Google|Natural|Neural|Antonio|Felipe/i.test(v.name))
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
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
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
          this.rocketGain.gain.setTargetAtTime(Math.max(0.0001, p * 0.35), this.ctx.currentTime, 0.1);
        }
      }
    };

    function speakCharles(tag, text) {
      SoundSystem.init();
      const sub = document.getElementById('cinematic-subtitle');
      sub.style.display = 'block';
      document.getElementById('sub-tag').innerText = tag;
      document.getElementById('sub-content').innerText = text;
      isCharlesSpeaking = true;
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'pt-BR';
          if (charlesVoice) u.voice = charlesVoice;
          u.rate = 1.02;
          u.pitch = 0.85;
          u.onend = () => { isCharlesSpeaking = false; };
          window.speechSynthesis.speak(u);
          setTimeout(() => { isCharlesSpeaking = false; }, Math.max(2500, text.length * 68));
        } catch(e) { isCharlesSpeaking = false; }
      }
    }

    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030710);
    scene.fog = new THREE.FogExp2(0x030710, 0.00018);

    const shipRig = new THREE.Group();
    scene.add(shipRig);

    const camera = new THREE.PerspectiveCamera(84, window.innerWidth / window.innerHeight, 0.04, 6000);
    const pilotEyePos = new THREE.Vector3(0, 1.25, 0.22);
    camera.position.copy(pilotEyePos);
    shipRig.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    try {
      if (typeof VRButton !== 'undefined') document.body.appendChild(VRButton.createButton(renderer));
    } catch(e) {}

    const sunLight = new THREE.DirectionalLight(0xfff1dc, 3.2);
    sunLight.position.set(18, 35, -45);
    scene.add(sunLight);

    const cabinLight = new THREE.PointLight(0x00f2fe, 1.8, 4.5);
    cabinLight.position.set(0, 1.74, -0.12);
    shipRig.add(cabinLight);

    // Estrelas e Estrada Espacial até Marte
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(4000 * 3);
    for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 2800;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.3, color: 0xffffff })));

    const spaceHighwayGroup = new THREE.Group();
    scene.add(spaceHighwayGroup);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 18; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.06, 12, 48), ringMat);
      ring.position.set(i * 0.65, 1.4 + i * 1.1, -12 - i * 22);
      spaceHighwayGroup.add(ring);
    }

    const marsWorldPos = new THREE.Vector3(14, 24, -420);
    const marsMesh = new THREE.Mesh(
      new THREE.SphereGeometry(28, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0xd95326, roughness: 0.72, emissive: 0x3b0d04 })
    );
    marsMesh.position.copy(marsWorldPos);
    scene.add(marsMesh);

    // Superfície de Marte e Base Ares-1
    const marsSurfaceGroup = new THREE.Group();
    marsSurfaceGroup.position.set(0, -120, 0);
    marsSurfaceGroup.visible = false;
    scene.add(marsSurfaceGroup);

    const marsGround = new THREE.Mesh(new THREE.CylinderGeometry(260, 260, 4, 48), new THREE.MeshStandardMaterial({ color: 0xb93815, roughness: 0.88 }));
    marsGround.position.set(0, -2.2, -30);
    marsSurfaceGroup.add(marsGround);

    const marsRoad = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 65), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    marsRoad.position.set(0, 0.08, -36);
    marsSurfaceGroup.add(marsRoad);

    const colonyDome = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x0284c7, emissiveIntensity: 0.3 }));
    colonyDome.position.set(0, 0, -68);
    marsSurfaceGroup.add(colonyDome);

    const marsRoverGroup = new THREE.Group();
    marsRoverGroup.position.set(0, 0.55, -8);
    marsRoverGroup.visible = false;
    marsSurfaceGroup.add(marsRoverGroup);
    marsRoverGroup.add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 3.2), new THREE.MeshStandardMaterial({ color: 0xfacc15 })));

    // Cabine e Holograma Estilo Zordon do Charles
    const cockpitGroup = new THREE.Group();
    shipRig.add(cockpitGroup);

    const zordonCanvas = document.createElement('canvas');
    zordonCanvas.width = 512; zordonCanvas.height = 512;
    const zordonCtx = zordonCanvas.getContext('2d');
    const zordonTex = new THREE.CanvasTexture(zordonCanvas);

    const zordonGroup = new THREE.Group();
    zordonGroup.position.set(0.58, 1.42, -0.52);
    zordonGroup.rotation.y = -0.38;
    cockpitGroup.add(zordonGroup);
    zordonGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.32, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.22, side: THREE.DoubleSide })));
    zordonGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.30), new THREE.MeshBasicMaterial({ map: zordonTex, transparent: true })));

    function drawZordonFace(time, speaking) {
      zordonCtx.clearRect(0, 0, 512, 512);
      zordonCtx.fillStyle = 'rgba(0, 242, 254, 0.22)';
      zordonCtx.fillRect(0, 0, 512, 512);
      zordonCtx.fillStyle = '#00f2fe';
      zordonCtx.font = 'bold 20px monospace';
      zordonCtx.textAlign = 'center';
      zordonCtx.fillText('CHARLES // IA DE COMANDO', 256, 36);
      zordonCtx.save();
      zordonCtx.translate(256, 255 + Math.sin(time * 2.2) * 5);
      zordonCtx.fillStyle = '#7dd3fc';
      zordonCtx.beginPath();
      zordonCtx.arc(0, 0, 95, 0, Math.PI * 2);
      zordonCtx.fill();
      zordonCtx.fillStyle = '#ffffff';
      zordonCtx.beginPath();
      zordonCtx.ellipse(-38, -18, 20, 14, 0, 0, Math.PI * 2);
      zordonCtx.ellipse(38, -18, 20, 14, 0, 0, Math.PI * 2);
      zordonCtx.fill();
      const mouthH = speaking ? 6 + Math.abs(Math.sin(time * 22)) * 24 : 3;
      zordonCtx.fillStyle = '#031826';
      zordonCtx.beginPath();
      zordonCtx.ellipse(0, 55, 36, mouthH, 0, 0, Math.PI * 2);
      zordonCtx.fill();
      zordonCtx.restore();
      zordonTex.needsUpdate = true;
    }

    // Console e Botão Vermelho de Partida em destaque
    const consoleRoot = new THREE.Group();
    consoleRoot.position.set(0, 0.84, -0.58);
    cockpitGroup.add(consoleRoot);
    const consoleHull = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.36, 0.68), new THREE.MeshStandardMaterial({ color: 0x0b1017 }));
    consoleHull.rotation.x = 0.20;
    consoleRoot.add(consoleHull);

    const ignitionButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.048, 0.035, 32),
      new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xef4444, emissiveIntensity: 1.6 })
    );
    ignitionButton.position.set(-0.26, 0.14, 0.18);
    ignitionButton.userData = { type: 'ignition' };
    consoleRoot.add(ignitionButton);

    let is3DActive = false;
    let flightStage = 'GROUND';
    let distanceToMars = 54.6;
    let velocity = 0;
    let roverProgress = 0;

    const videoEl = document.getElementById('intro-video');
    const videoLayer = document.getElementById('intro-video-layer');

    function trigger3DCrossover() {
      if (is3DActive) return;
      is3DActive = true;
      videoLayer.classList.add('fade-out');
      setTimeout(() => { videoEl.pause(); videoLayer.style.display = 'none'; }, 200);
      document.getElementById('avionics-bar').style.display = 'flex';
      document.getElementById('route-guidance').style.display = 'block';
      document.getElementById('action-bar').style.display = 'flex';
      document.getElementById('sop-hint').style.display = 'block';
      speakCharles('CHARLES // HOLOGRAMA IA', 'Saudações, Comandante. Eu sou Charles, a inteligência holográfica da nave Celestial Um. Clique no botão vermelho de partida para decolar rumo a Marte.');
    }

    videoEl.addEventListener('timeupdate', () => { if (!is3DActive && videoEl.currentTime >= 19.0) trigger3DCrossover(); });
    videoEl.addEventListener('ended', trigger3DCrossover);
    document.getElementById('skip-intro-btn').addEventListener('click', trigger3DCrossover);
    document.getElementById('unmute-video-btn').addEventListener('click', () => {
      SoundSystem.init(); videoEl.muted = false; videoEl.play().catch(() => {});
      document.getElementById('unmute-video-btn').style.display = 'none';
    });

    function startIgnition() {
      if (flightStage !== 'GROUND') return;
      SoundSystem.playClick();
      SoundSystem.startThrust();
      SoundSystem.setThrust(1.0);
      flightStage = 'ORBITAL_HIGHWAY';
      document.getElementById('btn-ignite').style.display = 'none';
      document.getElementById('btn-warp').style.display = 'inline-block';
      speakCharles('CHARLES // HOLOGRAMA IA', 'Partida confirmada! Siga os anéis luminosos da estrada espacial até Marte.');
    }

    document.getElementById('btn-ignite').addEventListener('click', startIgnition);
    document.getElementById('btn-warp').addEventListener('click', () => { distanceToMars = 2.0; velocity = 18.5; });
    document.getElementById('btn-log-1').addEventListener('click', () => {
      document.getElementById('btn-log-1').classList.add('done');
      speakCharles('CHARLES // LOGÍSTICA MARTE', 'Braço umbilical conectado na Base Ares Um.');
    });
    document.getElementById('btn-log-2').addEventListener('click', () => {
      document.getElementById('btn-log-2').classList.add('done');
      marsRoverGroup.visible = true; roverProgress = 0.01;
      speakCharles('CHARLES // LOGÍSTICA MARTE', 'Rover enviado pela estrada marciana até o Domo Central.');
    });
    document.getElementById('btn-log-3').addEventListener('click', () => {
      document.getElementById('btn-log-3').classList.add('done');
      speakCharles('CHARLES // LOGÍSTICA MARTE', 'Usina de oxigênio e metano ativada. Tanques reabastecidos.');
    });
    document.getElementById('btn-log-4').addEventListener('click', () => {
      document.getElementById('btn-log-4').classList.add('done');
      speakCharles('CHARLES // LOGÍSTICA MARTE', 'Operação logística em Marte concluída com sucesso total, Comandante!');
    });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.08);
      const time = clock.getElapsedTime();
      drawZordonFace(time, isCharlesSpeaking);

      if (flightStage === 'ORBITAL_HIGHWAY') {
        velocity = Math.min(22, velocity + 4.5 * dt);
        distanceToMars = Math.max(0, distanceToMars - velocity * dt * 0.16);
        const ratio = 1.0 - distanceToMars / 54.6;
        marsWorldPos.z = -420 + ratio * 345;
        marsMesh.position.copy(marsWorldPos);
        if (distanceToMars <= 2.0) {
          flightStage = 'MARS_DESCENT';
          spaceHighwayGroup.visible = false;
          marsSurfaceGroup.visible = true;
          marsSurfaceGroup.position.set(0, -48, 0);
          document.getElementById('btn-warp').style.display = 'none';
          speakCharles('CHARLES // HOLOGRAMA IA', 'Entrando na atmosfera de Marte! Iniciando pouso na Base Logística Ares Um.');
        }
      } else if (flightStage === 'MARS_DESCENT') {
        marsSurfaceGroup.position.y = Math.min(-0.2, marsSurfaceGroup.position.y + dt * 9.5);
        if (marsSurfaceGroup.position.y >= -0.22) {
          flightStage = 'MARS_LANDED';
          marsMesh.visible = false;
          SoundSystem.setThrust(0);
          ['btn-log-1', 'btn-log-2', 'btn-log-3', 'btn-log-4'].forEach(id => document.getElementById(id).style.display = 'inline-block');
          speakCharles('CHARLES // HOLOGRAMA IA', 'Pouso confirmado em Marte! Inicie a logística da Base Ares Um.');
        }
      } else if (flightStage === 'MARS_LANDED' && roverProgress > 0 && roverProgress < 1) {
        roverProgress = Math.min(1, roverProgress + dt * 0.15);
        marsRoverGroup.position.z = -8 - roverProgress * 54;
      }

      document.getElementById('av-dist').innerText = distanceToMars.toFixed(2) + 'M KM';
      renderer.render(scene, camera);
    });
  <\/script>
</body>
</html>`;
}
