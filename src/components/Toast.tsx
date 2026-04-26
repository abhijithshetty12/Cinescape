import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, AlertCircle, Trash2 } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
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

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-400/50';
      case 'error':
        return 'border-red-400/50';
      default:
        return 'border-blue-400/50';
    }
  };

  const getGradientColor = () => {
    switch (type) {
      case 'success':
        return 'from-green-400/20';
      case 'error':
        return 'from-red-400/20';
      default:
        return 'from-blue-400/20';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.9 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30
          }}
          className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-4 sm:w-80 z-50 
            border ${getBorderColor()} rounded-xl shadow-2xl 
            bg-black/60 backdrop-blur-2xl backdrop-saturate-150
            p-4 flex items-center gap-3`}
        >
          {/* Liquid Glass Effect Layer */}
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            {/* Glass reflection sweep */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-white/5 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-white/5 rounded-full blur-xl" />
            {/* Gradient accent */}
            <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${getGradientColor()} to-transparent`} />
            {/* Inner highlight */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent rounded-xl" />
            {/* Liquid shine */}
            <motion.div
              className="absolute inset-0 opacity-30"
              animate={{
                background: [
                  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                  'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
                  'radial-gradient(circle at 40% 80%, rgba(255,255,255,0.06) 0%, transparent 50%)',
                  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                ],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          {/* Icon Container with glow */}
          <div className="relative flex-shrink-0">
            <div className={`absolute -inset-1 ${getGradientColor().replace('/20', '/40')} blur rounded-full animate-pulse`} />
            <div className="relative bg-white/5 backdrop-blur-sm rounded-lg p-1.5 border border-white/10">
              {getIcon()}
            </div>
          </div>

          {/* Message */}
          <p className="text-white/90 text-sm font-small leading-relaxed flex-1 pr-2" style={{ fontSize: '16px' }}>
            {message}
          </p>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 relative w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 backdrop-blur-sm border border-white/10 
              text-gray-400 hover:text-white transition-all duration-200 
              flex items-center justify-center group"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
            <span className="absolute inset-0 rounded-full bg-white/0 group-hover:bg-white/5 transition-colors" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;