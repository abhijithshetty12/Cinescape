import React from "react";

const License: React.FC = () => (
  <footer className="fixed bottom-3 right-3 z-[9999] select-none">
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/5 transition-all duration-300 hover:bg-black/30 hover:border-white/10">
      <span className="text-[0.6rem] font-semibold bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text text-transparent">
        Abhijith
      </span>
      <span className="text-[0.6rem] text-white font-light">
        &copy; {new Date().getFullYear()}
      </span>
    </div>
  </footer>
);

export default License;