import React from "react";

const License: React.FC = () => (
  <footer className="fixed bottom-3 left-3 z-[9999] select-none sm:bottom-4 sm:left-5">
    <a
      href="https://abhijithshetty.vercel.app/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Made by Abhijith — visit portfolio"
      className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2 py-1 text-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_20px_rgba(0,0,0,0.2)] backdrop-blur-xl transition-all duration-300 hover:border-white/25 hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <img src="/A.png" alt="" aria-hidden="true" className="h-3 w-3 shrink-0 object-contain transition-transform duration-300 group-hover:scale-110" />
      <span className="text-[10px] leading-none tracking-tight">
        Made by <span className="font-medium text-white/85 underline decoration-white/20 underline-offset-[3px] transition-colors duration-200 group-hover:text-white group-hover:decoration-white/60">Abhijith</span>
      </span>
    </a>
  </footer>
);

export default License;