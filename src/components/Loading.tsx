import { motion } from 'framer-motion';

const Loading = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b] text-neutral-100 overflow-hidden font-sans">
      <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />

      <div className="relative flex flex-col items-center">
        <motion.div
          className="relative flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-white/20 bg-gradient-to-br from-white/20 via-white/5 to-transparent backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_12px_32px_rgba(0,0,0,0.5)] flex items-center justify-center"
          >
            <div className="w-[90%] h-[90%] rounded-full border border-amber-500/40 border-t-amber-400 border-r-amber-400/20 bg-gradient-to-tr from-amber-500/10 via-transparent to-white/10" />
          </motion.div>

          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 sm:inset-3 rounded-full border border-white/15 bg-white/5 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] flex items-center justify-center"
          >
            <div className="w-[85%] h-[85%] rounded-full border border-neutral-700/50" />
          </motion.div>

          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src="/Logo.png" 
              alt="Cinescape Logo" 
              className="w-6 h-6 object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]"
            />
          </div>

          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-8">
            {[-1, 0, 1].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: 'loop',
                  delay: Math.abs(i) * 0.2,
                }}
                className="w-2 h-2 rounded-sm bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              />
            ))}
          </div>

          <motion.div
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-[10px] tracking-widest uppercase font-semibold text-neutral-300">
              Loading
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-14 text-center flex flex-col items-center justify-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <img 
            src="/Cinescape.png" 
            alt="Cinescape" 
            className="h-6 sm:h-7 object-contain drop-shadow-md"
          />
          <p className="text-neutral-400 text-xs mt-2 tracking-[0.15em]">
            Preparing your experience
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Loading;