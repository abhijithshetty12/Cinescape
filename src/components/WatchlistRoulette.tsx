import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useSpring } from 'framer-motion';
import { Star, X, Play, RotateCcw, TrendingUp } from 'lucide-react';
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

const CARD_WIDTH = 220;
const GAP = 20;
const TOTAL_CARD_WIDTH = CARD_WIDTH + GAP;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}




const WatchlistRoulette: React.FC<WatchlistRouletteProps> = ({ isOpen, onClose, items }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<Movie | null>(null);
  const [showResult, setShowResult] = useState(false);
  const navigate = useNavigate();

  const getPosterSrc = useCallback((m: Movie | null) => {
    const posterPath = m?.posterPath;
    if (!posterPath) return null;
    // TMDB expects leading slash in posterPath
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
  }, []);

  // Animation values
  const xOffset = useMotionValue(0);
  const indicatorScale = useSpring(1, { stiffness: 400, damping: 20 });
  
  // Create a long reel by repeating items
  const reelItems = useMemo(() => {
    if (items.length === 0) return [];
    
    // Shuffle helper
    const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5);
    
    const repeated: Movie[] = [];
    const repetitions = Math.max(15, Math.ceil(150 / items.length));
    
    for (let i = 0; i < repetitions; i++) {
      repeated.push(...shuffle(items));
    }
    return repeated;
  }, [items]);

  const triggerConfetti = useCallback(() => {

    const end = Date.now() + 2 * 1000;
    const colors = ['#ef4444', '#ffffff', '#dc2626'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }, []);

  const startSpin = useCallback(() => {
    // Responsive sizing to keep alignment correct on mobile
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const isMobile = vw < 640;

    const cardWidth = isMobile ? 160 : 220;
    const gap = isMobile ? 12 : 20;
    const totalCardWidth = cardWidth + gap;

    const centerOffset = vw / 2 - cardWidth / 2;

    if (items.length === 0) return;
    
    setIsSpinning(true);
    setWinner(null);
    setShowResult(false);
    
    // Initial position: start at 0
    xOffset.set(0);

    // Pick a winner and a target index in the reel
    const winnerItem = items[Math.floor(Math.random() * items.length)];
    
    // Pick an occurrence between 60% and 80% of the reel length
    const startIdx = Math.floor(reelItems.length * 0.6);
    const endIdx = Math.floor(reelItems.length * 0.8);
    
    const possibleIndices: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (reelItems[i].id === winnerItem.id) {
        possibleIndices.push(i);
      }
    }

    const targetIndex = possibleIndices.length > 0 
      ? possibleIndices[Math.floor(Math.random() * possibleIndices.length)]
      : endIdx;

    // Calculate center-aligned position
    const targetX = -(targetIndex * totalCardWidth) + centerOffset;


    // Spin animation
    const controls = animate(0, targetX, {
      duration: 6,
      ease: [0.12, 0, 0.39, 0], // Custom deceleration curve
      onUpdate: (latest) => {
        xOffset.set(latest);
        
        // "Tick" effect: pulse the indicator when a card passes the center
        // Check if we are close to the center of any card
        const relativeX = Math.abs(latest % TOTAL_CARD_WIDTH);
        if (relativeX < 15 || relativeX > TOTAL_CARD_WIDTH - 15) {
          indicatorScale.set(1.2);
          setTimeout(() => indicatorScale.set(1), 50);
        }
      },
      onComplete: () => {
        setIsSpinning(false);
        setWinner(reelItems[targetIndex]);
        
        setTimeout(() => {
          setShowResult(true);
          triggerConfetti();
        }, 500);
      }
    });

    return () => controls.stop();
  }, [items, reelItems, xOffset, indicatorScale, triggerConfetti]);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      const cleanup = startSpin();
      return cleanup;
    }
  }, [isOpen, startSpin]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
      {/* Dynamic Background */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1),transparent_70%)]" />
      </motion.div>

      {/* Header */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-12 left-1/2 -translate-x-1/2 text-center w-full px-4"
      >
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter italic uppercase flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
          Watchlist <span className="bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">Roulette</span>
        </h2>
        <p className="text-zinc-500 mt-2 font-medium tracking-[0.2em] uppercase text-[10px] md:text-xs">Deciding your next cinematic journey</p>
      </motion.div>

      {/* Close button */}
      {!isSpinning && (
        <motion.button 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onClose}
          className="absolute top-8 right-8 p-3 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all z-[100]"
        >
          <X className="w-6 h-6" />
        </motion.button>
      )}

      {/* Spin Container */}
      <div className="relative w-full h-[min(70vh,520px)] flex items-center justify-center">
        {/* Indicators */}
        <motion.div 
          style={{ scale: indicatorScale }}
          className="absolute left-1/2 -translate-x-1/2 top-2 z-50 text-red-500"
        >
          <div className="w-8 h-8 fill-current rotate-180 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
             <svg viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
          </div>
        </motion.div>
        
        <motion.div 
          style={{ scale: indicatorScale }}
          className="absolute left-1/2 -translate-x-1/2 bottom-2 z-50 text-red-500"
        >
          <div className="w-8 h-8 fill-current drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
             <svg viewBox="0 0 24 24"><path d="M12 21l-12-18h24z"/></svg>
          </div>
        </motion.div>

        {/* Highlight Frame */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[240px] h-[340px] border-2 border-red-500/50 rounded-3xl z-40 bg-red-500/5 backdrop-blur-[2px] shadow-[0_0_50px_rgba(239,68,68,0.2)] pointer-events-none ring-1 ring-white/10" />

        {/* The Reel */}
        <motion.div 
          className="flex gap-5 px-[12px]"
          style={{ x: xOffset }}
        >
          {reelItems.map((item, idx) => {
            const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
            const isMobile = vw < 640;
            const w = isMobile ? 160 : 220;
            const h = isMobile ? 260 : 320;

            return (
              <div 
                key={`${item.id}-${idx}`}
                className="relative shrink-0 overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl transition-all duration-300 rounded-2xl"
                style={{
                  width: w,
                  height: h,
                  opacity: isSpinning ? 0.7 : 1,
                  scale: isSpinning ? 0.95 : 1
                }}
              >
                <img 
                  src={getPosterSrc(item) ?? undefined}
                  alt={item.title || item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* Fallback */}
                {!getPosterSrc(item) && (
                  <div className="w-full h-full bg-zinc-800" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
              </div>
            );
          })}
        </motion.div>

      </div>

      {/* Result Card */}
      <AnimatePresence>
        {showResult && winner && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-6 z-[100]"
          >
            <div className="relative bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl text-center overflow-hidden group">

              {/* Winner poster (was missing) */}
              <div className="mx-auto mb-5 md:mb-7 w-[140px] h-[200px] sm:w-[180px] sm:h-[255px] rounded-2xl overflow-hidden bg-zinc-800 border border-white/5 shadow-2xl relative">
                {getPosterSrc(winner) ? (
                  <img
                    src={getPosterSrc(winner) ?? undefined}
                    alt={winner.title || winner.name}
                    className="w-full h-full object-cover"
                    loading="eager"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              </div>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-12 h-12 md:w-16 md:h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
              >
                <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </motion.div>

              <h4 className="text-red-500 font-bold text-[10px] tracking-[0.3em] uppercase mb-2 md:mb-3">Selection Found</h4>
              <h3 className="text-2xl md:text-4xl font-black text-white mb-6 md:mb-8 tracking-tight line-clamp-2">{winner.title || winner.name}</h3>
              
              <div className="flex items-center justify-center gap-6 mb-8 md:mb-10">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-white font-black text-xl">{winner.vote_average?.toFixed(1)}</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <span className="text-zinc-400 font-bold">
                  {winner.releaseDate || winner.first_air_date ? new Date(winner.releaseDate || winner.first_air_date || '').getFullYear() : 'N/A'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => {
                    navigate(`/${winner.mediaType}/${winner.movieId}`);
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-3 px-8 py-4 md:py-5 bg-gradient-to-r from-red-600 to-red-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-red-600/20 hover:scale-[1.03] active:scale-95 group"
                >
                  <Play className="w-5 h-5 fill-current" />
                  WATCH NOW
                </button>
                <button 
                  onClick={startSpin}
                  className="flex items-center justify-center gap-3 px-8 py-4 md:py-5 bg-white/5 border border-white/10 text-white font-black rounded-2xl hover:bg-white/10 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  RE-SPIN
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistRoulette;
