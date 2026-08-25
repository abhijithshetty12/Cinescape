import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Star, Play, Calendar, Film, Tv, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const BASE_URL = 'https://api.themoviedb.org/3';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

const TrendingMovies = () => {
  const [trendingMovies, setTrendingMovies] = useState<any[]>([]);
  const [genreMap, setGenreMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const [movieRes, tvRes] = await Promise.all([
          axios.get(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`),
          axios.get(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}`),
        ]);

        const combined: Record<number, string> = {};
        [...movieRes.data.genres, ...tvRes.data.genres].forEach((genre) => {
          combined[genre.id] = genre.name;
        });

        setGenreMap(combined);
      } catch (error) {
        console.error('Error fetching genres:', error);
      }
    };

    fetchGenres();
  }, []);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        if (page === 1) setLoading(true);
        else setFetchingMore(true);

        const url = `${BASE_URL}/trending/${mediaType}/week?api_key=${API_KEY}&page=${page}`;
        const response = await axios.get(url);
        const { data } = response;

        setTrendingMovies((prevMovies) =>
          page === 1 ? data.results : [...prevMovies, ...data.results]
        );
        setHasMore(data.page < data.total_pages);
      } catch (error) {
        console.error('Error fetching trending content:', error);
      } finally {
        setLoading(false);
        setFetchingMore(false);
      }
    };

    fetchTrending();
  }, [page, mediaType]);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || fetchingMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            setPage((prevPage) => prevPage + 1);
          }
        },
        { threshold: 0.5 }
      );

      if (node) observer.current.observe(node);
    },
    [loading, fetchingMore, hasMore]
  );

  const handleMediaTypeChange = (type: 'movie' | 'tv') => {
    if (type === mediaType) return;
    setMediaType(type);
    setTrendingMovies([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
  };

  const featured = trendingMovies.slice(0, 3);
  const rest = trendingMovies.slice(3);

  const getGenreNames = (genreIds: number[]) => {
    if (!Array.isArray(genreIds)) return [];
    return genreIds
      .map((id) => genreMap[id])
      .filter(Boolean)
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-black text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif] selection:bg-white/20 antialiased relative overflow-x-hidden">
      <svg width="0" height="0">
        <defs>
          <linearGradient id="trending-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="45%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>

          <filter id="trending-icon-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feFlood floodColor="#f97316" floodOpacity="0.8" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[400px] bg-gradient-to-br from-pink-500/20 via-red-500/15 to-purple-600/10 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="fixed top-[40%] -right-[150px] w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none z-0" />

      <div className="relative z-10 container mx-auto px-3 sm:px-6 py-4 sm:py-10 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2">
            <div className="flex items-center gap-3">
              <TrendingUp
                className="w-7 h-7 sm:w-10 sm:h-10 shrink-0"
                style={{
                  stroke: "url(#trending-icon-gradient)",
                  filter: "url(#trending-icon-glow)",
                }}
              />
              <div>
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white">
                  {mediaType === 'movie' ? 'Trending Movies' : 'Trending Series'}
                </h1>
                <p className="text-white/60 text-xs sm:text-sm mt-0.5 font-normal">
                  Most popular releases this week
                </p>
              </div>
            </div>

            <div className="flex items-center self-start sm:self-auto bg-white/10 dark:bg-white/[0.06] backdrop-blur-2xl p-1 rounded-full border border-white/15 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <button
                onClick={() => handleMediaTypeChange('movie')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-all duration-300 ${mediaType === 'movie'
                  ? 'bg-gradient-to-b from-[#FF3B30] to-[#E02B20] text-white shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                  : 'text-white/60 hover:text-white'
                  }`}
              >
                <Film className="w-3.5 h-3.5" />
                Movies
              </button>
              <button
                onClick={() => handleMediaTypeChange('tv')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full font-medium text-xs sm:text-sm transition-all duration-300 ${mediaType === 'tv'
                  ? 'bg-gradient-to-b from-[#FF3B30] to-[#E02B20] text-white shadow-[0_4px_15px_rgba(255,59,48,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                  : 'text-white/60 hover:text-white'
                  }`}
              >
                <Tv className="w-3.5 h-3.5" />
                Series
              </button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading && page === 1 ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 sm:space-y-8"
            >
              <div className="flex gap-3 sm:gap-4 overflow-hidden">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="min-w-[240px] xs:min-w-[280px] sm:min-w-[340px] h-40 sm:h-52 bg-white/[0.04] rounded-2xl sm:rounded-3xl animate-pulse border border-white/10 shrink-0" />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="space-y-2 sm:space-y-3">
                    <div className="aspect-[2/3] bg-white/[0.04] rounded-2xl sm:rounded-3xl animate-pulse border border-white/10" />
                    <div className="h-3.5 sm:h-4 bg-white/[0.04] rounded-md w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={mediaType}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-6 sm:space-y-8"
            >
              {featured.length > 0 && (
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-white/80 mb-3 sm:mb-4 flex items-center gap-2 tracking-tight">
                    <span className="w-1.5 h-4 bg-gradient-to-b from-[#FF3B30] to-[#FF2D55] rounded-full" />
                    Featured Hits
                  </h2>

                  <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                    {featured.map((item, index) => {
                      const title = item.title || item.name || 'Untitled';
                      const backdrop = item.backdrop_path
                        ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                        : item.poster_path
                          ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
                          : '';
                      const dateStr = item.release_date || item.first_air_date || '';
                      const year = dateStr ? new Date(dateStr).getFullYear() : 'N/A';
                      const to = mediaType === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;
                      const genres = getGenreNames(item.genre_ids);

                      return (
                        <motion.div
                          key={`featured-${item.id}`}
                          variants={itemVariants}
                          className="min-w-[240px] xs:min-w-[280px] sm:min-w-[340px] max-w-[360px] flex-shrink-0 snap-start"
                        >
                          <Link to={to} className="group block relative h-40 xs:h-48 sm:h-52 rounded-2xl sm:rounded-3xl overflow-hidden bg-white/5 border border-white/15 dark:border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-white/40 active:scale-[0.98] transition-all duration-300">
                            {backdrop ? (
                              <img
                                src={backdrop}
                                alt={title}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No Image</div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                            <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-black/60 backdrop-blur-md border border-white/15 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full z-10">
                              <span className="text-[10px] sm:text-xs font-bold text-white/90 tracking-wider">
                                #{index + 1}
                              </span>
                            </div>

                            <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-black/60 backdrop-blur-md border border-white/15 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 z-10">
                              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 fill-amber-300" />
                              <span className="text-white font-semibold text-[10px] sm:text-xs">
                                {item.vote_average?.toFixed(1) ?? 'N/A'}
                              </span>
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20 backdrop-blur-[2px] z-10">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white ml-0.5" />
                              </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 z-10 flex flex-col justify-end">
                              <h3 className="font-bold text-base sm:text-lg text-white truncate tracking-tight group-hover:text-red-400 transition-colors">
                                {title}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                                <span className="text-[10px] sm:text-xs text-white/70 flex items-center gap-1 shrink-0">
                                  <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  {year}
                                </span>
                                <div className="flex gap-1 overflow-hidden">
                                  {genres.map((g) => (
                                    <span
                                      key={g}
                                      className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-white/15 backdrop-blur-md border border-white/10 rounded-full text-white/90 truncate"
                                    >
                                      {g}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {rest.length > 0 && (
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-white/80 mb-3 sm:mb-4 flex items-center gap-2 tracking-tight">
                    <span className="w-1.5 h-4 bg-white/40 rounded-full" />
                    Explore Trending
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
                    {rest.map((item, index) => {
                      const title = item.title || item.name || 'Untitled';
                      const poster = item.poster_path
                        ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
                        : item.backdrop_path
                          ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                          : '';
                      const dateStr = item.release_date || item.first_air_date || '';
                      const year = dateStr ? new Date(dateStr).getFullYear() : 'N/A';
                      const to = mediaType === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;
                      const genres = getGenreNames(item.genre_ids);
                      const isLastItem = index === rest.length - 1;

                      return (
                        <motion.div
                          key={`grid-${item.id}`}
                          variants={itemVariants}
                          ref={isLastItem ? lastElementRef : null}
                        >
                          <Link to={to} className="group block space-y-1.5 sm:space-y-2">
                            <div className="relative aspect-[2/3] w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-white/5 border border-white/15 dark:border-white/10 shadow-[0_8px_25px_rgba(0,0,0,0.3)] hover:border-white/40 active:scale-[0.98] transition-all duration-300">
                              {poster ? (
                                <img
                                  src={poster}
                                  alt={title}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No Image</div>
                              )}

                              <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 bg-black/60 backdrop-blur-md border border-white/15 px-1.5 py-0.5 sm:px-2 rounded-full flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                                <span className="text-white font-semibold text-[9px] sm:text-[11px]">
                                  {item.vote_average?.toFixed(1) ?? 'N/A'}
                                </span>
                              </div>

                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30 backdrop-blur-[2px]">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white ml-0.5" />
                                </div>
                              </div>
                            </div>

                            <div className="px-0.5">
                              <h3 className="font-semibold text-xs sm:text-sm text-white truncate tracking-tight group-hover:text-red-400 transition-colors">
                                {title}
                              </h3>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[10px] sm:text-[11px] text-white/50">{year}</span>
                                {genres.length > 0 && (
                                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-white/70 truncate max-w-[55px] sm:max-w-[80px]">
                                    {genres[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {fetchingMore && (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-red-500 rounded-full animate-spin" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TrendingMovies;