import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, AlertCircle, Info, Trash2 } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'delete';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  isVisible,
  onClose,
  duration = 3000
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
          border: 'border-emerald-500/20 hover:border-emerald-500/30',
          bgGlow: 'from-emerald-500/10 via-transparent to-transparent',
          accentGlow: 'bg-emerald-400/20',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
          border: 'border-rose-500/20 hover:border-rose-500/30',
          bgGlow: 'from-rose-500/10 via-transparent to-transparent',
          accentGlow: 'bg-rose-400/20',
        };
      case 'delete':
        return {
          icon: <Trash2 className="w-4 h-4 text-orange-400" />,
          border: 'border-orange-500/20 hover:border-orange-500/30',
          bgGlow: 'from-orange-500/10 via-transparent to-transparent',
          accentGlow: 'bg-orange-400/20',
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-sky-400" />,
          border: 'border-sky-500/20 hover:border-sky-500/30',
          bgGlow: 'from-sky-500/10 via-transparent to-transparent',
          accentGlow: 'bg-sky-400/20',
        };
    }
  };

  const theme = getTheme();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          // Standardized top entry point that clears fixed/sticky elements smoothly
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 28
          }}
          // CHANGED: Boosted z-index to z-[9999] and positioned at top-6 for clean visibility
          className={`fixed top-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-80 z-[9999] 
            border ${theme.border} rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] 
            bg-zinc-950/85 backdrop-blur-xl p-3.5 flex items-start gap-3 
            transition-colors duration-300 overflow-hidden`}
        >
          {/* Subtle Ambient Background Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGlow} pointer-events-none`} />

          {/* Liquid Polish Shine Streak */}
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            <motion.div
              className="absolute inset-0 opacity-20"
              animate={{
                background: [
                  'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
                  'radial-gradient(circle at 90% 80%, rgba(255,255,255,0.05) 0%, transparent 40%)',
                  'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
                ],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          {/* Micro Icon Container with Ambient Halo Glow */}
          <div className="relative flex-shrink-0 mt-0.5">
            <div className={`absolute -inset-1 ${theme.accentGlow} blur-md rounded-full`} />
            <div className="relative bg-zinc-900/80 backdrop-blur-sm rounded-lg p-1.5 border border-white/5">
              {theme.icon}
            </div>
          </div>

          {/* Typography Content Field */}
          <div className="flex-1 min-w-0 pr-1">
            <p className="text-zinc-200 text-[13px] font-medium leading-relaxed select-none break-words">
              {message}
            </p>
          </div>

          {/* Glass Style Dismiss Button Controls */}
          <button
            onClick={onClose}
            className="flex-shrink-0 relative w-6 h-6 rounded-md bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-sm border border-white/5 
              text-zinc-500 hover:text-zinc-300 transition-all duration-200 
              flex items-center justify-center group mt-0.5"
            aria-label="Close notification"
          >
            <X className="w-3 h-3 transform group-hover:scale-105 transition-transform" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;