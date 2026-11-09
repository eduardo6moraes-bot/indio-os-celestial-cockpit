# Implementation Plan - Mundo Celestial - Jornada Orbital

A premier 3D first-person aerospace simulation game built with React, Three.js, Tailwind CSS, and Web Audio API, inspired by advanced Roblox Studio Luau architecture.

## User Requirements & Customizations
- **Primary Focus**: Full interactive cockpit with biometric startup ritual, switch arming, ignition sequence, and manual flight controls.
- **Controls**: Immersive 3D cockpit interaction with clickable/draggable switches, throttle, flight stick, and smooth first-person camera movement.
- **Visual Style**: Ultra-realistic NASA/SpaceX aerospace aesthetic with gritty PBR materials, procedural lighting, ACES tone mapping, and cinematic celestial backdrop.

---

## Proposed Changes

### 1. Audio & Sound Engine (`src/utils/audio.ts`)
- Implement a procedural Web Audio API sound generator for:
  - `AmbientHum`: Deep continuous cabin frequency.
  - `ScannerLoop`: Rising electrical biometric scan sound.
  - `OrchestralCrescendo`: Epic awakening chord progression.
  - `EngineRumble`: Low-frequency rocket thrust rumble with camera shake.
  - UI clicks and switch activation sounds.

### 2. Three.js 3D Aerospace Scene (`src/components/GameCanvas.tsx`)
- **Environment & Celestial Bodies**:
  - Earth globe with atmosphere glow, orbital launchpad tower, starry skybox, and distant Sun.
- **Cockpit Model (`CockpitModel`)**:
  - Enclosed capsule with curved front glass, pilot seat, ergonomic console table, and 3D props (`CharlesOrb`, `BiometricScanner`, `SwitchPanel`, `IgnitionCover`, `IgnitionButton`, `ThrottleLever`, `FlightStick`).
- **Glass Cockpit MFDs (`MFD_Left`, `MFD_Center`, `MFD_Right`)**:
  - Dynamic HTML/Canvas textures projected onto 3D screens for trajectory, NavBall 3D artificial horizon, and real-time engine telemetries.

### 3. Telemetry Engine (`src/utils/telemetry.ts`)
- Computes 60 FPS flight variables:
  - Altitude (km), Inertial Velocity (km/s), G-Meter ($1.0 \to 3.8$ G), Max-Q dynamic pressure (kPa), Delta-V residual ($9420$ m/s), LOX (310 bar) & CH4 (285 bar) tank pressure.

### 4. Game UI & Shell (`src/components/GameShell.tsx`)
- **Title Screen**: Atmospheric cinematic pan with custom SVG title lockup ("MUNDO CELESTIAL - Jornada Orbital"), start button, and control instructions.
- **HUD Overlay**: Low-occlusion perimeter status clusters, biometric status banner, voice subtitle transcript for AI copilot "Charles", and control dock.
- **Victory / Pause Modal**: Flight mission stats, orbital insertion success screen, and restart options.

---

## Verification Plan

### Automated Checks
- Run `compile_applet` and `lint_applet` to ensure zero compilation or TypeScript errors.

### Manual Verification
- Verify title screen renders correctly and launches into 3D cockpit view.
- Test biometric scanner interaction (click/tap) triggers laser sweep, sound effects, and Charles voice activation.
- Test switch arming, ignition cover opening, and button ignition sequence with camera rumble.
- Test throttle lever and flight stick interaction affecting 3D vehicle state and MFD telemetry readouts.
