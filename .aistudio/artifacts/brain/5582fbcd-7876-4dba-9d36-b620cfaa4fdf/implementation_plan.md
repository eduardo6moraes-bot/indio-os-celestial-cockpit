# Mundo Celestial: IndioOS — Transição Vídeo-para-3D & Cockpit Fiel aos Frames (WebXR / Mobile / Desktop)

Integração sem cortes entre o vídeo cinematográfico de abertura (`00:00` a `00:19`) e a cabine 3D interativa em primeira pessoa, replicando fielmente a geometria, iluminação LED ciano, telas MFD, scanner biométrico com silhueta de mão à direita e ambiente de amanhecer na plataforma com decolagem rumo a Marte.

## User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo foram confirmadas para garantir fidelidade visual absoluta aos frames `00:15`–`00:19` do vídeo e compatibilidade direta com a Vercel e o Meta Quest.

- **Decisão Confirmada 1 (Estado do Painel no Corte aos 19s)**: A transição ocorre aos `19.0s` (ou `onended`) com crossfade de `0.2s` exatamente quando a luva toca o leitor de palma ciano. A cena 3D já inicia sincronizada com o pulso de energia ciano do toque, despertando as 4 telas MFD, as tiras de LED do teto e a orbe holográfica do copiloto Charles (permitindo também re-interagir com a placa biométrica a qualquer momento).
- **Decisão Confirmada 2 (Cenário Externo no Para-Brisa Angular)**: O exterior visto através do para-brisa panorâmico de 3 painéis inicia no **amanhecer dourado na plataforma de lançamento** (com nuvens volumétricas de vapor, torre metálica e iluminação solar quente), transitando suavemente para a estratosfera e o espaço profundo com a mira orbital de Marte durante a ignição e subida.
- **Decisão Confirmada 3 (Entrega para a Vercel)**: A aplicação roda ao vivo em tela cheia no navegador/Meta Quest e disponibiliza um botão dedicado (**Baixar index.html Vercel**) que gera e baixa instantaneamente o arquivo único `index.html` (HTML5 + CSS3 + Three.js r128 via CDN + WebXR) pronto para deploy imediato.

---

## 1. Overview & Core Concept

- **O Que Faz**: Inicia com a sequência cinematográfica em vídeo em tela cheia (com controle de áudio/desbloqueio imediato sob clique e opção de pular para o 3D). No instante exato do toque da luva na placa biométrica (`00:19`), realiza um crossfade imperceptível (`200ms`) para a câmera 3D do Three.js posicionada exatamente no ponto de vista dos olhos do piloto olhando para o console central.
- **Público e Plataformas**: Avaliadores da competição Meta Quest (WebXR com Hand Tracking e controles VR), jogadores Mobile (Giroscópio nativo + toque direto) e Desktop (Mouse + Teclado `WASD`/Setas).
- **Valor Principal**: Continuidade visual cinematográfica entre o filme de introdução e a simulação espacial 3D em tempo real, mantendo a mesma geometria de cabine, paleta de cores e disposição de instrumentos vista nos frames `00:16` a `00:19`.

---

## 2. User Experience & Visual Design (Fidelidade aos Frames 00:15–00:19)

### Fluxo de Experiência do Usuário
1. **Abertura Cinematográfica em Vídeo (`00:00` – `00:19`)**:
   - Reproduz o vídeo oficial anexado em tela cheia (`object-fit: cover`).
   - Qualquer clique/toque ativa o barramento de áudio Web Audio API e desmuta o vídeo caso o navegador tenha iniciado em autoplay silencioso.
   - No instante `19.0s` (quando a luva direita repousa sobre a silhueta da palma ciano e soa o acorde harmônico), o vídeo faz um crossfade de `0.2s` para o canvas WebGL 3D.
2. **Despertar Sincronizado da Cabine (`00:19+`)**:
   - A câmera 3D está posicionada exatamente no ângulo do frame `00:19`, enquadrando os 3 painéis do para-brisa angular no topo e o console chanfrado embaixo.
   - O pulso luminoso ciano percorre o console direito, acendendo os 4 monitores MFD, as barras de LED ciano no teto e despertando a **Orbe Quântica do Charles** no pilar superior direito.
3. **Procedimento de Ignição e Pilotagem Orbital**:
   - O jogador interage com as chaves vermelhas e manetes na ala esquerda do console, aciona a ignição principal e controla o manche central para alinhar a cápsula ao vetor orbital de Marte enquanto o amanhecer na plataforma dá lugar ao espaço profundo.

### Identidade Visual, Geometria e Paleta (Baseada nos Frames)
- **Estrutura da Cabine e Teto (Frame `00:15`)**:
  - Paredes anguladas em compósito de fibra de carbono fosca (`#0b0f16`, `roughness: 0.48`, `metalness: 0.72`).
  - Três fileiras longitudinais de tiras de LED ciano/teal (`#00f2fe` / `#06b6d4`) embutidas no teto e frisos luminosos nas laterais inferiores.
  - Para-brisa frontal dividido em **3 janelas trapezoidais angulares** por duas colunas estruturais inclinadas em titânio escuro, com alça de apoio amarela (`grab bar`) na moldura direita (exatamente como nos frames `00:16`–`00:19`).
- **Console Frontal & 4 Monitores MFD (Frames `00:17`–`00:19`)**:
  - **MFD Esquerdo**: Gráficos duplos de forma de onda (pressão/vibração) + 2 medidores circulares (`70%` e `35%`) em ciano/verde militar.
  - **MFD Central Superior (Wide)**: Horizonte artificial circular, radar azimutal, escala de arfagem e indicadores digitais (`35`, `155`).
  - **MFD Central Inferior (Inclinado)**: Tela tática de radar/alinhamento vetorial posicionada logo abaixo do monitor central.
  - **MFD Direito**: Diagrama esquemático wireframe da cápsula espacial + barras de diagnóstico de sistemas e suporte à vida.
- **Ala Direita — Scanner Biométrico da Palma (Frames `00:17`–`00:19`)**:
  - Posicionado no módulo chanfrado à direita do console central.
  - Placa capacitiva quadrada com cantos arredondados exibindo a **silhueta luminosa de 5 dedos da mão** em ciano neon pulsante, acompanhada por barras de telemetria inferiores e botões luminosos vermelhos/âmbar na lateral direita.
- **Ala Esquerda — Chaves Mecânicas e Manetes (Frames `00:17`–`00:19`)**:
  - Conjuntos de alavancas vermelhas, cursores deslizantes de empuxo (sliders com marcações graduadas) e botões seletores retroiluminados.
- **Orbe Holográfica do Copiloto Charles**:
  - Esfera quântica translúcida com anéis energéticos flutuando junto ao pilar superior direito (`x: 0.58, y: 1.46, z: -0.58`), emitindo luz volumétrica azul/branca que pulsa em sincronia com a voz do copiloto.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Crossfade Imperceptível aos 19.0s com Pré-Renderização 3D**
  - *Abordagem Escolhida*: O motor Three.js inicializa e pré-compila os shaders em background desde o segundo `00:00` enquanto o vídeo roda por cima. Aos `18.85s`–`19.0s` (`timeupdate` / `requestVideoFrameCallback`), a opacidade do vídeo cai para `0` em `0.2s` enquanto a câmera 3D já está renderizando no mesmo FOV e inclinação (`pitch: -0.18 rad`).
  - *Por Quê*: Elimina qualquer tela preta, travamento ou salto de perspectiva na passagem do vídeo para o WebGL.
- **Decisão 2: Exportador Integrado de Arquivo Único (`index.html`) para a Vercel**
  - *Abordagem Escolhida*: Além de executar a experiência completa ao vivo, incluímos um gerador/botão de download que entrega o código completo autocontido em um único arquivo `index.html` (usando Three.js r128 e `VRButton.js` via CDN, exatamente como especificado).
  - *Por Quê*: Permite testar imediatamente no AI Studio / Meta Quest e fazer upload direto do `index.html` único na Vercel sem etapas extras de build.

---

## 4. Technical Architecture & Data Strategy

### Diagrama de Arquitetura e Componentes

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   CAMADA DE TRANSIÇÃO VÍDEO -> WEBGL 3D                    │
│  [ <video> Fullscreen (00:00 -> 00:19) ] ──(Crossfade 0.2s @ 19.0s)──┐     │
└──────────────────────────────────────────────────────────────────────┼─────┘
                                                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     CENA 3D THREE.JS + WEBXR (shipRig)                     │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                │
│  │  Cabine & Iluminação     │  │  Exterior & Atmosfera    │                │
│  │  • Paredes Fibra Carbono │  │  • Amanhecer Dourado     │                │
│  │  • 3 Fileiras LED Ciano  │  │  • Torre & Vapor Denso   │                │
│  │  • Para-Brisa 3 Painéis  │  │  • Subida p/ Espaço/Marte│                │
│  │  • Alça Amarela Direita  │  └──────────────────────────┘                │
│  │  • Orbe Quântica Charles │                                              │
│  └─────────────┬────────────┘                                              │
│                ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                 CONSOLE ANGULAR FIEL AOS FRAMES 00:16–00:19          │  │
│  │  [Ala Esq: Chaves Vermelhas & Throttle]                              │  │
│  │  [MFD Esq: Ondas/Gauges] [MFD Centro + Tático Inf] [MFD Dir: Cápsula]│  │
│  │  [Manche Central 3D]     [Ala Dir: Placa Biométrica Silhueta da Mão] │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            SISTEMA MULTIMODAL DE ENTRADA, ÁUDIO DSP E EXPORTAÇÃO           │
│  • WebXR Hand Tracking / Controllers (Proximidade na Placa Biométrica)     │
│  • Mobile (Giroscópio DeviceOrientation + Toque Raycaster)                 │
│  • Desktop (Mouse Look / Arraste + Teclado WASD/Setas)                     │
│  • Web Audio API (Acorde Biométrico, Quindar NASA, Voz Charles, Motores)   │
│  • Gerador/Download do Arquivo Único `index.html` (Three.js r128 CDN)      │
└────────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento de Estados e Interações
- **`VIDEO_INTRO` (`0.0s` – `19.0s`)**: Vídeo em reprodução com botão de ativação de som e botão "Pular para Cockpit 3D". Ao atingir `19.0s`, dispara o evento de transição `trigger3DCrossover()`.
- **`COCKPIT_AWAKENING` (`19.0s` – `22.0s`)**: O pulso do toque da luva no frame `00:19` propaga-se no console 3D: a placa biométrica com a silhueta da mão brilha intensamente em ciano, o feixe laser conclui a varredura, a Orbe do Charles acende no pilar superior direito e saúda o comandante.
- **`FLIGHT_READY` & `ASCENT_TO_MARS`**: O jogador pode acionar as chaves da ala esquerda, empurrar o manete de empuxo, acionar a ignição e pilotar pelo manche central (ou `WASD`/toque/mãos VR) observando o amanhecer na plataforma dar lugar à subida orbital rumo a Marte.
