import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Clapperboard, Loader2 } from 'lucide-react';
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
      staggerChildren: 0.06,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' },
  },
};

const TalentsProfiles = () => {
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

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

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4 mb-10"
        >
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/20">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow">
              Popular Talents
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Discover trending performers from around the world
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-7"
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
                <Link
                  to={`/talent/${talent.id}`}
                  className="group relative block bg-gradient-to-br from-zinc-900/90 to-zinc-800/70 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-zinc-700/60 hover:border-orange-500/70"
                >
                  <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/[0.08] to-transparent skew-x-[-18deg]" />
                  </div>
                  <div className="absolute top-3 left-3 z-20">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-md">
                      <span className="text-xs font-bold text-white">#{rank}</span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden">
                    <img
                      src={
                        talent.profile_path
                          ? `https://image.tmdb.org/t/p/w780${talent.profile_path}`
                          : '/user-icon.jpg'
                      }
                      alt={talent.name}
                      loading="lazy"
                      className="w-full aspect-[2/3] object-cover object-center transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 z-10">
                    <h2 className="font-bold text-base sm:text-lg text-white truncate drop-shadow-md">
                      {talent.name}
                    </h2>

                    {knownForItems.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-orange-400">
                          <Clapperboard className="w-3 h-3" />
                          <span className="text-[10px] uppercase tracking-wider font-semibold">
                            Known For
                          </span>
                        </div>
                        <ul className="space-y-0.5">
                          {knownForItems.map((item, idx) => (
                            <li
                              key={`${item.id}-${idx}`}
                              className="text-xs text-zinc-300 truncate"
                            >
                              {item.title || item.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ring-1 ring-inset ring-white/[0.05]" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <div ref={sentinelRef} className="flex justify-center mt-10 min-h-[60px] items-center">
          {fetchingMore && hasMore && (
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-zinc-800/60 border border-zinc-700/50 backdrop-blur-md">
              <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-sm text-zinc-300 font-medium">Loading more talents...</span>
            </div>
          )}
          {!hasMore && talents.length > 0 && (
            <p className="text-sm text-zinc-500">You've reached the end</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TalentsProfiles;