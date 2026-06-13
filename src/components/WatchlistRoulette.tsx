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

const WatchlistRoulette: React.FC<WatchlistRouletteProps> = ({ isOpen, onClose, items }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<Movie | null>(null);
  const [showResult, setShowResult] = useState(false);
  const navigate = useNavigate();

  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const xOffset = useMotionValue(0);
  const indicatorScale = useSpring(1, { stiffness: 400, damping: 15 });

  // Mobile-Optimized Grid Metrics Calculation Block
  const getLayoutDimensions = useCallback(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const isMobile = vw < 640;
    // Proportional downscaling so smaller viewports don't push layouts past screen boundaries
    const cardWidth = isMobile ? 125 : 190;
    const gap = isMobile ? 10 : 16;
    return { vw, cardWidth, gap, totalWidth: cardWidth + gap };
  }, []);

  const getPosterSrc = useCallback((m: Movie | null) => {
    if (!m?.posterPath) return '';
    return `https://image.tmdb.org/t/p/w500${m.posterPath}`;
  }, []);

  const reelItems = useMemo(() => {
    if (items.length === 0) return [];
    const shuffle = (array: Movie[]) => [...array].sort(() => Math.random() - 0.5);
    
    const repeated: Movie[] = [];
    const repetitions = Math.max(12, Math.ceil(120 / items.length));
    
    for (let i = 0; i < repetitions; i++) {
      repeated.push(...shuffle(items));
    }
    return repeated;
  }, [items]);

  // Premium Gold Sparkle Confetti Layer
  const triggerConfetti = useCallback(() => {
    if (!modalCanvasRef.current) return;

    const localizedConfetti = confetti.create(modalCanvasRef.current, {
      resize: true,
      useWorker: true
    });

    localizedConfetti({
      particleCount: 80,
      spread: 65,
      gravity: 1.2,
      scalar: 1.0,
      origin: { x: 0.5, y: 0.4 },
      colors: ['#f59e0b', '#fbbf24', '#ffffff', '#d97706', '#78350f']
    });
  }, []);

  const startSpin = useCallback(() => {
    if (items.length === 0) return;

    const { vw, cardWidth, totalWidth } = getLayoutDimensions();
    const centerOffset = (vw / 2) - (cardWidth / 2);

    setIsSpinning(true);
    setWinner(null);
    setShowResult(false);
    xOffset.set(0);

    const winnerItem = items[Math.floor(Math.random() * items.length)];
    const startIdx = Math.floor(reelItems.length * 0.65);
    const endIdx = Math.floor(reelItems.length * 0.8);
    
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
      duration: 5.2,
      ease: [0.12, 0.88, 0.32, 1],
      onUpdate: (latest) => {
        xOffset.set(latest);
        
        const absolutePassedProgress = Math.abs(latest - centerOffset);
        const currentTickIndex = Math.round(absolutePassedProgress / totalWidth);
        
        if (currentTickIndex !== lastTickIndex) {
          lastTickIndex = currentTickIndex;
          indicatorScale.set(1.25);
          setTimeout(() => indicatorScale.set(1), 50);
        }
      },
      onComplete: () => {
        setIsSpinning(false);
        setWinner(reelItems[targetIndex]);
        setShowResult(true);
      }
    });

    return () => controls.stop();
  }, [items, reelItems, xOffset, indicatorScale, getLayoutDimensions]);

  useEffect(() => {
    if (showResult && winner) {
      const timer = setTimeout(() => {
        triggerConfetti();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showResult, winner, triggerConfetti]);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      startSpin();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const { cardWidth, gap } = getLayoutDimensions();

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#09090b] touch-none select-none">
      
      {/* Golden Ambient Blur Background Mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      {/* Header Container Layout */}
      <motion.div 
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-8 sm:top-14 text-center w-full px-6 z-10"
      >
        <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tighter uppercase italic">
          Watchlist <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">Roulette</span>
        </h2>
        <p className="text-zinc-500 mt-1 font-bold tracking-[0.25em] uppercase text-[8px] sm:text-xs">Deciding your next cinematic choice</p>
      </motion.div>

      {/* Close Action Wrapper */}
      {!isSpinning && (
        <motion.button 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={onClose}
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2.5 sm:p-3 rounded-xl bg-zinc-900/60 border border-amber-500/10 text-zinc-400 hover:text-white transition-all z-[100] active:scale-90"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <X className="w-5 h-5" />
        </motion.button>
      )}

      {/* Mechanical Reel viewport */}
      <div className="relative w-full py-6 flex flex-col items-center justify-center overflow-hidden">
        
        {/* Selector Pointers - Swapped from Red to Gold */}
        <motion.div style={{ scale: indicatorScale }} className="absolute top-0 z-50 text-amber-500 transform rotate-180 drop-shadow-[0_4px_10px_rgba(245,158,11,0.4)]">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
        </motion.div>
        <motion.div style={{ scale: indicatorScale }} className="absolute bottom-0 z-50 text-amber-500 drop-shadow-[0_-4px_10px_rgba(245,158,11,0.4)]">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
        </motion.div>

        {/* Ambient Center Highlight Box */}
        <div 
          className="absolute rounded-2xl z-40 border-2 border-amber-500/30 pointer-events-none bg-amber-500/[0.01] shadow-[0_0_35px_rgba(245,158,11,0.12)] transition-all duration-300"
          style={{
            width: cardWidth + 6,
            height: cardWidth * 1.45 + 6,
          }}
        />

        <div className="w-full overflow-visible flex items-center h-full">
          <motion.div 
            className="flex will-change-transform transform-gpu"
            style={{ x: xOffset, gap: gap }}
          >
            {reelItems.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                className="relative shrink-0 overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl transition-all duration-500 rounded-xl"
                style={{
                  width: cardWidth,
                  height: cardWidth * 1.45,
                  opacity: isSpinning ? 0.5 : 1,
                  scale: isSpinning ? 0.95 : 1,
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

      {/* Winner Reveal Modal Overlay Layer */}
      <AnimatePresence>
        {showResult && winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <canvas 
              ref={modalCanvasRef} 
              className="absolute inset-0 w-full h-full pointer-events-none z-[130]"
            />

            <motion.div 
              initial={{ scale: 0.92, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 190 }}
              className="w-full max-w-sm bg-zinc-900/90 border border-amber-500/20 rounded-3xl p-5 sm:p-8 text-center shadow-2xl relative overflow-hidden z-[120] max-h-[92vh] flex flex-col justify-center items-center"
              style={{ backdropFilter: 'blur(20px)' }}
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/5 rounded-full filter blur-[40px] pointer-events-none" />

              {/* Responsive Poster Canvas Layout */}
              <div className="mx-auto mb-4 w-[105px] h-[155px] sm:w-[140px] sm:h-[205px] rounded-xl overflow-hidden bg-zinc-950 border border-amber-500/10 shadow-2xl relative shrink-0">
                {getPosterSrc(winner) ? (
                  <img
                    src={getPosterSrc(winner)}
                    alt={winner.title || winner.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold tracking-widest uppercase mb-2.5">
                <Sparkles className="w-3 h-3 text-amber-400 fill-current" />
                Winner Picked
              </div>

              <h3 className="text-lg sm:text-2xl font-black text-white mb-3 tracking-tight line-clamp-2 px-1 leading-snug">
                {winner.title || winner.name}
              </h3>
              
              <div className="flex items-center justify-center gap-3 mb-5 text-xs">
                <div className="flex items-center gap-1 bg-zinc-950/50 px-2.5 py-0.5 rounded-lg border border-white/5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-white font-bold">{winner.vote_average?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="w-px h-3 bg-zinc-800" />
                <span className="text-zinc-400 font-medium tracking-wide">
                  {winner.releaseDate || winner.first_air_date 
                    ? new Date(winner.releaseDate || winner.first_air_date || '').getFullYear() 
                    : 'N/A'}
                </span>
              </div>

              {/* High-Performance Mobile Action Layout Actions */}
              <div className="flex flex-col gap-2.5 w-full shrink-0">
                <button 
                  onClick={() => {
                    navigate(`/${winner.mediaType}/${winner.movieId}`);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/5 active:scale-[0.97]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Watch Selection
                </button>
                <button 
                  onClick={startSpin}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-zinc-800 hover:bg-zinc-750 border border-white/5 text-zinc-300 hover:text-white font-bold text-sm rounded-xl transition-all active:scale-[0.97]"
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