import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, Trash2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'delete';

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    delete: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface SingleToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

const SingleToast: React.FC<SingleToastProps> = ({ toast, onClose }) => {
  const { id, message, type = 'success', duration = 3200 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-[18px] h-[18px] text-emerald-400" />,
          glow: 'rgba(52,211,153,0.18)',
          tint: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
          border: 'border-emerald-500/20',
          accentBg: 'bg-emerald-400/15',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-[18px] h-[18px] text-rose-400" />,
          glow: 'rgba(251,113,133,0.18)',
          tint: 'from-rose-500/10 via-rose-500/5 to-transparent',
          border: 'border-rose-500/20',
          accentBg: 'bg-rose-400/15',
        };
      case 'delete':
        return {
          icon: <Trash2 className="w-[18px] h-[18px] text-amber-400" />,
          glow: 'rgba(251,191,36,0.18)',
          tint: 'from-amber-500/10 via-amber-500/5 to-transparent',
          border: 'border-amber-500/20',
          accentBg: 'bg-amber-400/15',
        };
      default:
        return {
          icon: <Info className="w-[18px] h-[18px] text-sky-400" />,
          glow: 'rgba(56,189,248,0.18)',
          tint: 'from-sky-500/10 via-sky-500/5 to-transparent',
          border: 'border-sky-500/20',
          accentBg: 'bg-sky-400/15',
        };
    }
  };

  const theme = getTheme();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -16, scale: 0.95, filter: 'blur(6px)' }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
        mass: 0.8,
      }}
      className="group relative w-full sm:w-[340px] rounded-[22px] p-[1px] overflow-hidden select-none bg-gradient-to-b from-white/20 via-white/5 to-white/0"
      style={{
        boxShadow: `0 20px 48px -12px rgba(0,0,0,0.6), 0 0 24px -4px ${theme.glow}`,
      }}
    >
      <div className="relative w-full rounded-[21px] bg-zinc-950/75 backdrop-blur-2xl p-3.5 flex items-center gap-3 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-r ${theme.tint} opacity-80 pointer-events-none`} />

        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        <motion.div
          className="absolute -inset-full opacity-30 pointer-events-none"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
            repeatDelay: 2,
          }}
          style={{
            background:
              'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
          }}
        />

        <div className="relative flex-shrink-0 flex items-center justify-center">
          <div className={`absolute inset-0 ${theme.accentBg} blur-md rounded-full`} />
          <div className={`relative w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border ${theme.border} flex items-center justify-center shadow-inner`}>
            {theme.icon}
          </div>
        </div>

        <div className="relative flex-1 min-w-0 pr-1">
          <p className="text-zinc-100 text-[13.5px] font-medium leading-snug tracking-tight truncate antialiased" title={message}>
            {message}
          </p>
        </div>

        <button
          onClick={() => onClose(id)}
          className="relative flex-shrink-0 w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 active:scale-90 border border-white/10 text-zinc-400 hover:text-zinc-100 transition-all duration-200 flex items-center justify-center backdrop-blur-md"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="absolute inset-x-3 bottom-0.5 h-[2px] rounded-full overflow-hidden bg-white/5">
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className="h-full w-full origin-left bg-gradient-to-r from-white/20 via-white/40 to-white/10"
          />
        </div>
      </div>
    </motion.div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success', duration = 3200) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = {
    success: useCallback((msg: string, dur?: number) => addToast(msg, 'success', dur), [addToast]),
    error: useCallback((msg: string, dur?: number) => addToast(msg, 'error', dur), [addToast]),
    info: useCallback((msg: string, dur?: number) => addToast(msg, 'info', dur), [addToast]),
    delete: useCallback((msg: string, dur?: number) => addToast(msg, 'delete', dur), [addToast]),
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toast }}>
      {children}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[9999] flex flex-col items-center sm:items-end gap-2.5 pointer-events-none max-w-[90vw] sm:max-w-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toastItem) => (
            <div key={toastItem.id} className="pointer-events-auto w-full sm:w-auto">
              <SingleToast toast={toastItem} onClose={removeToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

interface LegacyToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<LegacyToastProps> = ({
  message,
  type = 'success',
  isVisible,
  onClose,
  duration = 3200,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[9999] pointer-events-none max-w-[90vw] sm:max-w-none">
      <AnimatePresence>
        <div className="pointer-events-auto w-full sm:w-auto">
          <SingleToast
            toast={{ id: 'legacy-toast', message, type, duration }}
            onClose={onClose}
          />
        </div>
      </AnimatePresence>
    </div>
  );
};

export default Toast;