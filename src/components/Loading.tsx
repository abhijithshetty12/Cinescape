import React from 'react';
import { motion } from 'framer-motion';

const Loading = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col items-center">
        <svg width="64" height="96" viewBox="0 0 64 96" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="8" width="48" height="80" rx="24" fill="url(#glass-gradient)" />
          <path d="M16 8 Q32 48 48 8" stroke="#fff" strokeWidth="2" fill="none" opacity="0.2"/>
          <path d="M16 88 Q32 48 48 88" stroke="#fff" strokeWidth="2" fill="none" opacity="0.2"/>
          <motion.polygon
            points="20,16 44,16 32,40"
            fill="url(#sand-gradient)"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatType: "loop" }}
          />
          <motion.rect
            x="30" y="40" width="4" height="16" rx="2"
            fill="url(#sand-gradient)"
            initial={{ opacity: 0.8, scaleY: 1 }}
            animate={{ opacity: [0.8, 0.2, 0.8], scaleY: [1, 1.5, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatType: "loop" }}
            style={{ transformOrigin: "center top" }}
          />
          <motion.ellipse
            cx="32" cy="80" rx="12" ry="6"
            fill="url(#sand-gradient)"
            initial={{ opacity: 0.2, scaleY: 0.5 }}
            animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatType: "loop" }}
          />
          <defs>
            <linearGradient id="glass-gradient" x1="8" y1="8" x2="56" y2="88" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22223b" />
              <stop offset="1" stopColor="#4a4e69" />
            </linearGradient>
            <linearGradient id="sand-gradient" x1="32" y1="16" x2="32" y2="88" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#e11d48" />
            </linearGradient>
          </defs>
        </svg>
        <span className="mt-6 text-white text-lg font-bold tracking-widest animate-pulse">Loading...</span>
      </div>
    </div>
  );
};

export default Loading;