/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Rocket, Sparkles, Shield, Play, Volume2, Globe } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  return (
    <div className="relative w-full h-screen bg-[#020208] text-white flex flex-col items-center justify-between overflow-hidden p-6 md:p-12 select-none">
      {/* Background Starfield Canvas simulation effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0a1128] via-[#020208] to-[#010104] pointer-events-none" />
      
      {/* Glowing orbital grid accents */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#00ffff10_1px,transparent_1px),linear-gradient(to_bottom,#00ffff10_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-6xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.4)]">
            <Rocket className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs tracking-[0.3em] text-cyan-400 font-mono uppercase">INDIO-OS SPATIAL</h1>
            <p className="text-[10px] tracking-[0.15em] text-slate-400 font-mono">VERSÃO 4.8.2 // ORBITAL</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 px-4 py-2 rounded-full backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>JANELA DE TRANSFERÊNCIA: ABERTA</span>
        </div>
      </div>

      {/* Hero Centerpiece */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl my-auto space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-900/40 border border-blue-500/40 text-blue-300 text-xs tracking-widest font-mono shadow-[0_0_20px_rgba(0,120,255,0.3)]">
          <Globe className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>SIMULAÇÃO AEROESPACIAL EM PRIMEIRA PESSOA</span>
        </div>

        {/* Custom SVG Title Lockup */}
        <div className="space-y-2">
          <h2 className="text-4xl md:text-7xl font-black tracking-wider bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(0,200,255,0.5)] uppercase font-mono">
            Mundo Celestial
          </h2>
          <p className="text-xl md:text-3xl font-light tracking-[0.4em] text-slate-300 uppercase font-mono">
            Jornada Orbital
          </p>
        </div>

        <p className="text-slate-400 text-sm md:text-base max-w-xl font-light leading-relaxed">
          Entre na cápsula de comando avançada. Autentique sua biometria com o copiloto Charles, armem os sistemas criogênicos e preparem a decolagem rumo a Marte.
        </p>

        {/* Start CTA */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={onStart}
            className="group relative inline-flex items-center space-x-4 px-8 py-4 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-mono text-sm tracking-[0.2em] uppercase rounded-xl shadow-[0_0_30px_rgba(0,180,255,0.5)] border border-cyan-400/50 transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current text-white animate-pulse" />
            <span>INICIAR MISSÃO ESPACIAL</span>
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </button>
        </div>
      </div>

      {/* Footer Control Hint */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col md:flex-row items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/80 pt-6 gap-4">
        <div className="flex items-center space-x-6">
          <span className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>CLIQUE / TOQUE NO SCANNER PARA AUTENTICAÇÃO</span>
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1 text-cyan-400">
            <Volume2 className="w-4 h-4" />
            <span>ÁUDIO ESPACIAL ATIVADO</span>
          </span>
          <span>•</span>
          <span>ESPAÇO / VR SUPORTADO</span>
        </div>
      </div>
    </div>
  );
};
