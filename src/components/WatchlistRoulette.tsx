import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useSpring } from 'framer-motion';
import { Star, X, Play, RotateCcw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';

interface Movie {
  id: string;
  movieId: string | number;
  mediaType: string;
  posterPath: string;
  title?: string;
  name?: string;
  vote_average?: number;
  releaseDate?: string;
  first_air_date?: string;
  genres: string[];
}

interface WatchlistRouletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: Movie[];
}

const CARD_WIDTH_MOBILE = 125;
const CARD_HEIGHT_MOBILE = 181;
const CARD_WIDTH_DESKTOP = 190;
const CARD_HEIGHT_DESKTOP = 275;
const GAP_MOBILE = 10;
const GAP_DESKTOP = 16;

const WatchlistRoulette: React.FC<WatchlistRouletteProps> = ({ isOpen, onClose, items }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<Movie | null>(null);
  const [showResult, setShowResult] = useState(false);
  const navigate = useNavigate();

  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const xOffset = useMotionValue(0);
  const indicatorScale = useSpring(1, { stiffness: 400, damping: 15 });

  const getPosterSrc = useCallback((m: Movie | null) => {
    if (!m?.posterPath) return '';
    return `https://image.tmdb.org/t/p/w500${m.posterPath}`;
  }, []);

  const reelItems = useMemo(() => {
    if (items.length === 0) return [];
    const shuffle = (array: Movie[]) => [...array].sort(() => Math.random() - 0.5);
    
    const repeated: Movie[] = [];
    const repetitions = Math.max(15, Math.ceil(150 / items.length));
    
    for (let i = 0; i < repetitions; i++) {
      repeated.push(...shuffle(items));
    }
    return repeated;
  }, [items]);

  const triggerConfetti = useCallback(() => {
    const canvasElement = modalCanvasRef.current;
    if (!canvasElement || typeof canvasElement.getBoundingClientRect !== 'function') {
      return;
    }

    try {
      const localizedConfetti = confetti.create(canvasElement, {
        resize: true,
        useWorker: true
      });

      localizedConfetti({
        particleCount: 60,
        spread: 55,
        gravity: 1.1,
        scalar: 0.9,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#f59e0b', '#fbbf24', '#ffffff', '#d97706', '#78350f']
      });
    } catch (err) {
      console.warn("Confetti dropped execution cleanly due to canvas layout shifts:", err);
    }
  }, []);

  const startSpin = useCallback(() => {
    if (items.length === 0) return;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
    const isMobile = vw < 640;
    
    const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP;
    const gap = isMobile ? GAP_MOBILE : GAP_DESKTOP;
    const totalWidth = cardWidth + gap;
    const centerOffset = (vw / 2) - (cardWidth / 2);

    setIsSpinning(true);
    setWinner(null);
    setShowResult(false);
    xOffset.set(0);

    const winnerItem = items[Math.floor(Math.random() * items.length)];
    const startIdx = Math.floor(reelItems.length * 0.7);
    const endIdx = Math.floor(reelItems.length * 0.85);
    
    const possibleIndices: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (reelItems[i].id === winnerItem.id) possibleIndices.push(i);
    }

    const targetIndex = possibleIndices.length > 0 
      ? possibleIndices[Math.floor(Math.random() * possibleIndices.length)]
      : Math.floor((startIdx + endIdx) / 2);

    const targetX = -(targetIndex * totalWidth) + centerOffset;
    let lastTickIndex = -1;

    const controls = animate(0, targetX, {
      duration: 5.4,
      ease: [0.1, 0.88, 0.25, 1],
      onUpdate: (latest) => {
        xOffset.set(latest);
        
        const absolutePassedProgress = Math.abs(latest - centerOffset);
        const currentTickIndex = Math.round(absolutePassedProgress / totalWidth);
        
        if (currentTickIndex !== lastTickIndex) {
          lastTickIndex = currentTickIndex;
          indicatorScale.set(1.2);
          setTimeout(() => indicatorScale.set(1), 40);
        }
      },
      onComplete: () => {
        setIsSpinning(false);
        setWinner(reelItems[targetIndex]);
        setShowResult(true);
      }
    });

    return () => controls.stop();
  }, [items, reelItems, xOffset, indicatorScale]);

  useEffect(() => {
    if (showResult && winner) {
      const timer = setTimeout(() => {
        triggerConfetti();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [showResult, winner, triggerConfetti]);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      startSpin();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] flex flex-col items-center justify-between py-6 overflow-hidden bg-[#09090b] touch-none select-none w-screen h-screen min-h-screen">
      
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05),transparent_65%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      <motion.div 
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative text-center w-full px-6 z-10 shrink-0 mt-4 sm:mt-6"
      >
        <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tighter uppercase italic">
          Watchlist <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">Roulette</span>
        </h2>
        <p className="text-zinc-500 mt-1 font-bold tracking-[0.22em] uppercase text-[9px] sm:text-xs">Deciding your next cinematic choice</p>
      </motion.div>

      <div className="relative w-full flex items-center justify-center overflow-hidden my-auto z-10 h-[240px] sm:h-[340px]">
        
        <motion.div style={{ scale: indicatorScale }} className="absolute top-2 z-50 text-amber-500 transform rotate-180 drop-shadow-[0_4px_10px_rgba(245,158,11,0.3)]">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
        </motion.div>
        <motion.div style={{ scale: indicatorScale }} className="absolute bottom-2 z-50 text-amber-500 drop-shadow-[0_-4px_10px_rgba(245,158,11,0.3)]">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
        </motion.div>

        <div 
          className="absolute rounded-2xl z-40 border-2 border-amber-500/40 pointer-events-none bg-amber-500/[0.02] shadow-[0_0_40px_rgba(245,158,11,0.15)] transition-all duration-300 w-[131px] h-[187px] sm:w-[196px] sm:h-[281px]"
        />

        <div className="absolute left-0 w-full overflow-visible flex items-center justify-start h-full">
          <motion.div 
            className="flex will-change-transform transform-gpu gap-[10px] sm:gap-[16px]"
            style={{ x: xOffset }}
          >
            {reelItems.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                className="relative shrink-0 overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl transition-all duration-500 rounded-xl w-[125px] h-[181px] sm:w-[190px] sm:h-[275px]"
                style={{
                  opacity: isSpinning ? 0.45 : 1,
                  scale: isSpinning ? 0.94 : 1,
                }}
              >
                {getPosterSrc(item) ? (
                  <img 
                    src={getPosterSrc(item)} 
                    alt=""
                    className="w-full h-full object-cover select-none pointer-events-none"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-3 text-center text-[10px] sm:text-xs font-bold text-zinc-600 bg-zinc-950">
                    {item.title || item.name}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-40" />
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="h-6 w-full shrink-0 z-0 pointer-events-none" />

      <AnimatePresence>
        {showResult && winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <canvas 
              ref={modalCanvasRef} 
              className="absolute inset-0 w-full h-full pointer-events-none z-[130]"
            />

            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 210 }}
              className="w-full max-w-[340px] bg-zinc-900/90 border border-amber-500/20 rounded-3xl p-5 sm:p-6 text-center shadow-2xl relative overflow-hidden z-[120] max-h-[85vh] flex flex-col justify-center items-center"
              style={{ backdropFilter: 'blur(20px)' }}
            >
              <button 
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-950/40 hover:bg-zinc-950/80 text-zinc-400 hover:text-white border border-white/5 transition-all z-[140] active:scale-95"
                aria-label="Close Reveal Layout"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/5 rounded-full filter blur-[40px] pointer-events-none" />

              <div className="relative mx-auto mb-3.5 w-[125px] h-[181px] sm:w-[190px] sm:h-[275px] rounded-xl overflow-hidden bg-zinc-950 shadow-xl shrink-0">
                {getPosterSrc(winner) ? (
                  <img
                    src={getPosterSrc(winner)}
                    alt={winner.title || winner.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                <div className="absolute inset-0 rounded-xl border-2 border-amber-500/40 pointer-events-none bg-amber-500/[0.02] shadow-[inset_0_0_20px_rgba(245,158,11,0.2)] z-20" />
              </div>
              
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold tracking-widest uppercase mb-2">
                <Sparkles className="w-2.5 h-2.5 text-amber-400 fill-current" />
                Winner Picked
              </div>

              <h3 className="text-base sm:text-xl font-black text-white mb-2 tracking-tight line-clamp-2 px-1 leading-tight shrink-0">
                {winner.title || winner.name}
              </h3>
              
              <div className="flex items-center justify-center gap-3 mb-4 text-[11px]">
                <div className="flex items-center gap-1 bg-zinc-950/50 px-2 py-0.5 rounded-lg border border-white/5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-white font-bold">{winner.vote_average?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="w-px h-3 bg-zinc-800" />
                <span className="text-zinc-400 font-medium tracking-wide">
                  {winner.releaseDate || winner.first_air_date 
                    ? new Date(winner.releaseDate || winner.first_air_date || '').getFullYear() 
                    : 'N/A'}
                </span>
              </div>

              <div className="flex flex-col gap-2 w-full shrink-0 mt-1">
                <button 
                  onClick={() => {
                    navigate(`/${winner.mediaType}/${winner.movieId}`);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-amber-500/5 active:scale-[0.96]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Watch Selection
                </button>
                <button 
                  onClick={startSpin}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-zinc-800/90 hover:bg-zinc-750 border border-white/5 text-zinc-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl transition-all active:scale-[0.96]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Spin Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistRoulette;