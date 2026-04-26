import React from 'react';
import { motion } from 'framer-motion';

const Loading = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-md">
      <div className="relative flex flex-col items-center">
        {/* Animated film reel */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Spinning reel rings */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-full border-2 border-amber-500/30 border-t-amber-500/80"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-2 w-20 h-20 rounded-full border border-neutral-700/50"
          />
          
          {/* Center hub */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-500 to-red-500 shadow-lg shadow-amber-500/20" />
          </div>

          {/* Film strip holes animated */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-8">
            {[-1, 0, 1].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatType: "loop", delay: Math.abs(i) * 0.2 }}
                className="w-2 h-2 rounded-sm bg-neutral-700"
              />
            ))}
          </div>

          {/* Play indicator */}
          <motion.div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-neutral-500"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs tracking-wider uppercase">Loading</span>
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <h2 className="text-white text-lg font-medium tracking-[0.3em] uppercase">
            Cinescape
          </h2>
          <p className="text-neutral-500 text-xs mt-2 tracking-[0.15em]">
            Preparing your experience
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Loading;