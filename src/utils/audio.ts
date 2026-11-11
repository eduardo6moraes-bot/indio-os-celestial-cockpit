/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const neuralAudioCache = new Map<string, string>();
let activeHtmlAudio: HTMLAudioElement | null = null;

export const CHARLES_VOICE_LINES = {
  VIDEO_CROSSOVER_AWAKEN:
    'Saudações, Comandante. Eu sou Charles, a inteligência holográfica da nave Celestial Um. Biometria confirmada. O corredor orbital para Marte já está projetado à sua frente. Acione a ignição à esquerda para decolar.',
  PALM_RESCAN_OK:
    'Biometria confirmada, Comandante. Todos os sistemas de navegação e suporte à vida estão operacionais.',
  COVER_WARN:
    'Comandante, abra a capa vermelha na ala esquerda ou clique em Decolar para iniciar a propulsão.',
  IGNITION_START:
    'Ignição principal confirmada! Deixando a plataforma terrestre. Siga os anéis luminosos da rota espacial pelo para-brisa rumo a Marte.',
  HIGHWAY_CRUISE:
    'Velocidade de cruzeiro interplanetário atingida. Mantenha a nave dentro dos pórticos holográficos da rota para aproximação rápida de Marte.',
  MARS_APPROACH:
    'Atenção Comandante: Orbita de Marte alcançada! Iniciando entrada atmosférica e acionando retrofoguetes para descida na Base Logística Ares Um.',
  MARS_LANDED:
    'Pouso confirmado em solo marciano! Bem-vindo à Base Ares Um, Comandante. Inicie agora o protocolo de logística: conecte o umbilical, envie o Rover de carga e ative a usina de oxigênio.',
  LOGISTICS_UMBILICAL:
    'Braço umbilical conectado e eclusa pressurizada. Energia da Base Ares Um estabilizada.',
  LOGISTICS_ROVER:
    'Rover autônomo de carga enviado pela estrada marciana até o Domo Central de Suprimentos.',
  LOGISTICS_ISRU:
    'Matriz solar e extrator de oxigênio e metano ativados em solo marciano. Tanques da nave reabastecidos em cem por cento.',
  LOGISTICS_COMPLETE:
    'Operação logística em Marte concluída com sucesso total, Comandante! A colônia Ares Um está abastecida e pronta para expansão.',
  ROUTE_DEVIATION_WARN:
    'Atenção Comandante: Você está saindo da estrada espacial. Alinhe o manche com os anéis luminosos de Marte.',
  ROUTE_ALIGNED_OK:
    'Trajetória perfeitamente alinhada no corredor orbital de Marte.',
};

export const SoundSystem = {
  ctx: null as AudioContext | null,
  ventGain: null as GainNode | null,
  rocketGain: null as GainNode | null,
  isMuted: false,

  init() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.startCockpitAmbiance();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ventGain && this.ctx) {
      this.ventGain.gain.setTargetAtTime(muted ? 0.0001 : 0.06, this.ctx.currentTime, 0.1);
    }
    if (muted) {
      if (activeHtmlAudio) {
        activeHtmlAudio.pause();
        activeHtmlAudio = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  },

  // Pré-carrega em background as falas neurais humanas do Charles via Gemini TTS
  prefetchNeuralLines() {
    Object.values(CHARLES_VOICE_LINES).forEach((line) => {
      if (neuralAudioCache.has(line)) return;
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: line, voiceName: 'Charon' }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.audioBase64) {
            neuralAudioCache.set(line, data.audioBase64);
          }
        })
        .catch(() => {
          // Silencioso: fallback para voz nativa caso offline
        });
    });
  },

  // Ruído de fundo realista de cabine (Ar condicionado ECLSS + Inversores 400Hz)
  startCockpitAmbiance() {
    if (!this.ctx) return;
    try {
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, this.ctx.currentTime);

      this.ventGain = this.ctx.createGain();
      this.ventGain.gain.setValueAtTime(this.isMuted ? 0.0001 : 0.06, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(this.ventGain);

      // Zumbido elétrico sutil de aviônicos (400 Hz padrão aeroespacial)
      const hum = this.ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.setValueAtTime(400, this.ctx.currentTime);
      const humGain = this.ctx.createGain();
      humGain.gain.setValueAtTime(0.005, this.ctx.currentTime);

      hum.connect(humGain);
      humGain.connect(this.ventGain);

      this.ventGain.connect(this.ctx.destination);
      noise.start();
      hum.start();
    } catch {
      // Ignore audio autoplay locks before interaction
    }
  },

  // Bip Quindar real da NASA (Tom de abertura/fechamento de telemetria VHF)
  playQuindarTone(intro = true) {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(intro ? 2525 : 2475, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.24);
    } catch {
      // Ignore
    }
  },

  // Pulso harmônico de leitura biométrica a laser
  playBiometricPulse(progress: number) {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 360 + progress * 520;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, this.ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.025, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {
      // Ignore
    }
  },

  // Acorde harmônico cinematográfico ao despertar os sistemas da nave
  playAwakeningSwell() {
    if (!this.ctx || this.isMuted) return;
    try {
      const freqs = [110, 164.81, 220, 277.18, 329.63, 440];
      freqs.forEach((f, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx < 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, this.ctx.currentTime + idx * 0.06);
        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.045, this.ctx.currentTime + idx * 0.06 + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 3.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.06);
        osc.stop(this.ctx.currentTime + 3.3);
      });
    } catch {
      // Ignore
    }
  },

  // Som tátil mecânico de disjuntor/chave de alta densidade
  playSwitchClick() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.045);
    } catch {
      // Ignore
    }
  },

  // Liberação de trava da capa de segurança
  playCoverRelease() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {
      // Ignore
    }
  },

  // Sonoridade dos motores de queima contínua e turbobombas criogênicas
  startRocketThrust() {
    this.init();
    if (!this.ctx || this.rocketGain) return;
    try {
      this.rocketGain = this.ctx.createGain();
      this.rocketGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(75, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(this.rocketGain);

      // Sub-grave estrutural de queima (38 Hz + 76 Hz harmônico)
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(38, this.ctx.currentTime);
      sub.connect(this.rocketGain);

      this.rocketGain.connect(this.ctx.destination);
      noise.start();
      sub.start();
    } catch {
      // Ignore
    }
  },

  setRocketPower(power: number) {
    if (!this.rocketGain || !this.ctx) return;
    const effectivePower = this.isMuted ? 0.0001 : Math.max(0.001, Math.min(0.38, power * 0.38));
    this.rocketGain.gain.setTargetAtTime(effectivePower, this.ctx.currentTime, 0.1);
  },

  stopRocketThrust() {
    if (!this.rocketGain || !this.ctx) return;
    this.rocketGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.8);
  },

  // Protocolo de Transmissão Aeroespacial do Charles (Voz Neural + Ressonância Zordon + Quindar)
  async transmitCharles(
    msg: string,
    onBannerUpdate: (text: string) => void,
    onSpeakingState?: (speaking: boolean) => void
  ) {
    this.init();
    onBannerUpdate(msg);

    if (this.isMuted) {
      onSpeakingState?.(false);
      return;
    }

    this.playQuindarTone(true);
    onSpeakingState?.(true);

    if (activeHtmlAudio) {
      activeHtmlAudio.pause();
      activeHtmlAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const playWavBase64 = (base64: string): Promise<boolean> => {
      return new Promise((resolve) => {
        try {
          const audio = new Audio(`data:audio/wav;base64,${base64}`);
          activeHtmlAudio = audio;
          audio.onended = () => {
            activeHtmlAudio = null;
            onSpeakingState?.(false);
            setTimeout(() => this.playQuindarTone(false), 80);
            resolve(true);
          };
          audio.onerror = () => {
            activeHtmlAudio = null;
            resolve(false);
          };
          audio.play().catch(() => resolve(false));
        } catch {
          resolve(false);
        }
      });
    };

    // 1. Verifica cache imediato da voz neural Gemini TTS
    const cachedWav = neuralAudioCache.get(msg);
    if (cachedWav) {
      const ok = await playWavBase64(cachedWav);
      if (ok) return;
    }

    // 2. Busca rápida da voz neural (timeout curto de 1100ms para nunca atrasar a fala)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1100);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg, voiceName: 'Charon' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.audioBase64) {
          neuralAudioCache.set(msg, data.audioBase64);
          const ok = await playWavBase64(data.audioBase64);
          if (ok) return;
        }
      }
    } catch {
      // Fallback imediato para síntese local caso a rede demore
    }

    // 3. Voz imediata do navegador (timbre imponente estilo Zordon pt-BR)
    if ('speechSynthesis' in window) {
      try {
        const utter = new SpeechSynthesisUtterance(msg);
        utter.lang = 'pt-BR';
        const voices = window.speechSynthesis.getVoices();
        const ptVoices = voices.filter((v) => v.lang.toLowerCase().includes('pt'));
        const preferredVoice =
          ptVoices.find((v) => /natural|neural|google|antonio|felipe|daniel|luciana/i.test(v.name)) ||
          ptVoices[0];
        if (preferredVoice) {
          utter.voice = preferredVoice;
        }
        utter.rate = 1.02;
        utter.pitch = 0.85;
        utter.onend = () => {
          onSpeakingState?.(false);
          setTimeout(() => this.playQuindarTone(false), 90);
        };
        utter.onerror = () => {
          onSpeakingState?.(false);
        };
        window.speechSynthesis.speak(utter);

        // Garante que o estado de fala encerre mesmo se onend não disparar em mobile WebViews
        const estimatedMs = Math.max(2500, msg.length * 68);
        setTimeout(() => {
          onSpeakingState?.(false);
        }, estimatedMs);
      } catch {
        onSpeakingState?.(false);
      }
    } else {
      setTimeout(() => onSpeakingState?.(false), 3000);
    }
  },
};
