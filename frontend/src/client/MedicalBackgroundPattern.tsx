import React from 'react';

export const MedicalBackgroundPattern: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0" aria-hidden="true">
      {/* 1. Ambient Medical Breathing Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl animate-medical-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-teal-500/15 blur-3xl animate-medical-pulse" style={{ animationDelay: '3.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      {/* 2. Abstract Medical Geometric Grid & Cross Constellation SVG */}
      <svg
        className="absolute inset-0 w-full h-full opacity-35 animate-medical-float"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Subtle Institutional Medical Grid Pattern */}
          <pattern id="medical-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            {/* Hexagonal / Diamond Nodes */}
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="1"
            />
            {/* Small Medical Plus / Cross Mark at intersections */}
            <path
              d="M 37 40 L 43 40 M 40 37 L 40 43"
              stroke="rgba(45, 212, 191, 0.28)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="80" cy="80" r="1.5" fill="rgba(56, 189, 248, 0.3)" />
          </pattern>

          {/* Glowing Gradient for ECG Waveform */}
          <linearGradient id="ecg-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="15%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="45%" stopColor="#2dd4bf" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="90%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="ecg-gradient-2" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="25%" stopColor="#10b981" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.85" />
            <stop offset="85%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="ecg-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Grid Layer */}
        <rect width="100%" height="100%" fill="url(#medical-grid)" />

        {/* Abstract Medical Crosshairs / Clinical Target Nodes */}
        <g stroke="rgba(45, 212, 191, 0.22)" strokeWidth="1" fill="none">
          {/* Top Left Clinical Node */}
          <circle cx="160" cy="180" r="28" strokeDasharray="3 3" />
          <circle cx="160" cy="180" r="4" fill="rgba(45, 212, 191, 0.5)" />
          <line x1="160" y1="140" x2="160" y2="220" />
          <line x1="120" y1="180" x2="200" y2="180" />

          {/* Top Right Clinical Node */}
          <circle cx="1280" cy="220" r="34" strokeDasharray="4 4" />
          <circle cx="1280" cy="220" r="5" fill="rgba(56, 189, 248, 0.5)" />
          <line x1="1280" y1="175" x2="1280" y2="265" />
          <line x1="1235" y1="220" x2="1325" y2="220" />

          {/* Bottom Left Node */}
          <circle cx="220" cy="740" r="22" strokeDasharray="2 4" />
          <circle cx="220" cy="740" r="3" fill="rgba(52, 211, 153, 0.5)" />

          {/* Bottom Right Node */}
          <circle cx="1220" cy="700" r="42" strokeDasharray="6 4" stroke="rgba(56, 189, 248, 0.18)" />
          <line x1="1220" y1="645" x2="1220" y2="755" />
          <line x1="1165" y1="700" x2="1275" y2="700" />
        </g>

        {/* Abstract DNA Helix Wave Sine Curves */}
        <path
          d="M 0 320 C 180 260, 360 380, 540 320 C 720 260, 900 380, 1080 320 C 1260 260, 1380 350, 1440 320"
          fill="none"
          stroke="rgba(56, 189, 248, 0.12)"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
        <path
          d="M 0 320 C 180 380, 360 260, 540 320 C 720 380, 900 260, 1080 320 C 1260 380, 1380 290, 1440 320"
          fill="none"
          stroke="rgba(45, 212, 191, 0.12)"
          strokeWidth="2"
          strokeDasharray="6 8"
        />

        {/* 3. Primary Animated Continuous ECG Rhythm Waveforms */}
        {/* Upper Heartbeat Trace */}
        <path
          d="M 0 240 L 180 240 L 195 234 L 205 246 L 215 240 L 230 240 L 240 210 L 252 285 L 264 165 L 276 258 L 288 238 L 302 242 L 320 240 L 500 240 L 515 234 L 525 246 L 535 240 L 550 240 L 560 210 L 572 285 L 584 165 L 596 258 L 608 238 L 622 242 L 640 240 L 820 240 L 835 234 L 845 246 L 855 240 L 870 240 L 880 210 L 892 285 L 904 165 L 916 258 L 928 238 L 942 242 L 960 240 L 1140 240 L 1155 234 L 1165 246 L 1175 240 L 1190 240 L 1200 210 L 1212 285 L 1224 165 L 1236 258 L 1248 238 L 1262 242 L 1280 240 L 1440 240"
          fill="none"
          stroke="url(#ecg-gradient-1)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ecg-glow)"
          className="animate-ecg"
        />

        {/* Lower Counter-Pulse Heartbeat Trace (offset timing) */}
        <path
          d="M 0 660 L 140 660 L 155 654 L 165 666 L 175 660 L 190 660 L 200 630 L 212 705 L 224 585 L 236 678 L 248 658 L 262 662 L 280 660 L 460 660 L 475 654 L 485 666 L 495 660 L 510 660 L 520 630 L 532 705 L 544 585 L 556 678 L 568 658 L 582 662 L 600 660 L 780 660 L 795 654 L 805 666 L 815 660 L 830 660 L 840 630 L 852 705 L 864 585 L 876 678 L 888 658 L 902 662 L 920 660 L 1100 660 L 1115 654 L 1125 666 L 1135 660 L 1150 660 L 1160 630 L 1172 705 L 1184 585 L 1196 678 L 1208 658 L 1222 662 L 1240 660 L 1440 660"
          fill="none"
          stroke="url(#ecg-gradient-2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ecg-glow)"
          className="animate-ecg"
          style={{ animationDuration: '10s', animationDirection: 'reverse' }}
        />
      </svg>
    </div>
  );
};
