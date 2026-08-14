import { motion } from 'framer-motion';

const Loading = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-3xl backdrop-saturate-200 antialiased select-none p-4 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 h-80 w-80 sm:h-96 sm:w-96 rounded-full bg-amber-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-80 w-80 sm:h-96 sm:w-96 rounded-full bg-orange-500/20 blur-[120px]" />
      
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-orange-500/10" />

      <div className="relative flex flex-col items-center justify-center">
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-amber-500/30 border-t-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-white/20"
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/40" />
          </div>

          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-6 sm:gap-8">
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
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-sm bg-white/30"
              />
            ))}
          </div>

          <motion.div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-zinc-400"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-zinc-300">
              Loading
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h2 className="text-white text-base sm:text-lg font-bold tracking-[0.3em] uppercase pl-1 drop-shadow-md">
            Cinescape
          </h2>
          <p className="text-amber-200/70 text-[11px] sm:text-xs mt-1.5 tracking-[0.15em] font-medium drop-shadow">
            Preparing your experience
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Loading;