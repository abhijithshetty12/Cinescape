import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clapperboard, Loader2, ChevronUp, Flame } from 'lucide-react';
import Loading from '../components/Loading.tsx';

interface KnownFor {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
}

interface Talent {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number;
  known_for: KnownFor[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

const TalentsProfiles = () => {
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const API_KEY = '734a09c1281680980a71703eb69d9571';

  const fetchTalents = useCallback(async (targetPage: number, append: boolean) => {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/person/popular?api_key=${API_KEY}&page=${targetPage}`
      );
      const results: Talent[] = response.data.results || [];

      if (append) {
        setTalents((prev) => [...prev, ...results]);
      } else {
        setTalents(results);
      }

      if (results.length === 0 || targetPage >= (response.data.total_pages ?? 1)) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching popular talents:', error);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  }, [API_KEY]);

  useEffect(() => {
    setLoading(true);
    fetchTalents(1, false);
  }, [fetchTalents]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (loading || !hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !fetchingMore && hasMore) {
          setFetchingMore(true);
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchTalents(nextPage, true);
            return nextPage;
          });
        }
      },
      {
        root: null,
        rootMargin: '400px',
        threshold: 0,
      }
    );

    observerRef.current.observe(sentinel);

    return () => {
      if (observerRef.current && sentinel) {
        observerRef.current.unobserve(sentinel);
      }
    };
  }, [loading, hasMore, fetchingMore, fetchTalents]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Segoe_UI',Roboto,sans-serif] tracking-tight selection:bg-orange-500/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[350px] sm:w-[750px] h-[350px] bg-orange-500/10 blur-[130px] rounded-full opacity-60" />
        <div className="absolute top-1/3 -left-32 w-64 sm:w-80 h-64 sm:h-80 bg-red-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-64 sm:w-80 h-64 sm:h-80 bg-orange-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-3.5 sm:px-6 lg:px-8 max-w-7xl pt-4 sm:pt-10 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3.5 sm:gap-5 border-b border-white/10 pb-5 sm:pb-8 mb-6 sm:mb-10"
        >
          <div className="relative flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/25 border border-white/20 shrink-0">
            <Users className="w-5.5 h-5.5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Popular{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-orange-400 to-red-500">
                Talents
              </span>
            </h1>
            <p className="text-xs sm:text-base text-zinc-400 mt-0.5 sm:mt-1 font-normal">
              Discover trending performers from around the world
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-6"
        >
          {talents.map((talent, index) => {
            const rank = index + 1;
            const knownForItems = talent.known_for
              ? talent.known_for
                  .filter((item) => item.title || item.name)
                  .slice(0, 3)
              : [];

            return (
              <motion.div key={`${talent.id}-${rank}`} variants={cardVariants}>
                <Link to={`/talent/${talent.id}`} className="block group">
                  <div className="relative bg-zinc-900/60 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/10 hover:border-orange-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1.5 flex flex-col h-full">
                    
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl z-30">
                      <div className="absolute top-0 -left-[120%] w-[70%] h-full transform -skew-x-12 bg-gradient-to-r from-transparent via-white/10 via-white/25 to-transparent opacity-0 group-hover:opacity-100 group-hover:left-[220%] transition-[left,opacity] duration-[1600ms] ease-[cubic-bezier(0.25,1,0.5,1)] backdrop-blur-[2px]" />
                      <div className="absolute inset-0 rounded-3xl border border-orange-400/0 group-hover:border-orange-300/30 transition-colors duration-700 pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]" />
                    </div>

                    <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-20">
                      <div className="flex items-center justify-center min-w-[26px] h-6 sm:w-7 sm:h-7 px-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-md">
                        <span className="text-[10px] sm:text-xs font-bold text-orange-300">
                          #{rank}
                        </span>
                      </div>
                    </div>

                    <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20">
                      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15">
                        <Flame className="w-3 h-3 text-orange-400 fill-orange-400" />
                        <span className="text-white font-semibold text-[10px] sm:text-xs">
                          {Math.round(talent.popularity)}
                        </span>
                      </div>
                    </div>

                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img
                        src={
                          talent.profile_path
                            ? `https://image.tmdb.org/t/p/w780${talent.profile_path}`
                            : '/user-icon.jpg'
                        }
                        alt={talent.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent opacity-90 transition-opacity duration-500" />
                    </div>

                    <div className="p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 flex-1 flex flex-col justify-between z-20 -mt-8 sm:-mt-10 relative">
                      <div>
                        <h2 className="font-bold text-sm sm:text-base text-white truncate group-hover:text-orange-300 transition-colors duration-300">
                          {talent.name}
                        </h2>

                        {knownForItems.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-1 text-orange-400">
                              <Clapperboard className="w-3 h-3" />
                              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold opacity-90">
                                Known For
                              </span>
                            </div>
                            
                            <ul className="space-y-1">
                              {knownForItems.map((item, idx) => (
                                <li
                                  key={`${item.id}-${idx}`}
                                  className="text-[11px] sm:text-xs text-zinc-300 truncate flex items-center gap-1.5 font-normal leading-tight"
                                >
                                  <span className="w-1 h-1 rounded-full bg-orange-400/80 shrink-0" />
                                  <span className="truncate">{item.title || item.name}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <div ref={sentinelRef} className="flex justify-center mt-8 sm:mt-14 min-h-[50px] items-center">
          {fetchingMore && hasMore && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/80 border border-white/15 backdrop-blur-2xl shadow-xl"
            >
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
              <span className="text-xs text-zinc-300 font-medium">Loading details...</span>
            </motion.div>
          )}
          {!hasMore && talents.length > 0 && (
            <p className="text-xs text-zinc-500 font-medium">You've reached the end of rankings</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 p-2.5 sm:p-3 bg-black/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl hover:border-orange-400/50 active:scale-95 transition-all duration-300 group"
          >
            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300 group-hover:text-orange-300 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TalentsProfiles;