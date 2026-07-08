import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Star,
  Play,
  ChevronUp,
  Film,
  Tv,
  Sparkles,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

const genreMap: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

const featuredVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

const UpcomingMovies = () => {
  const [upcomingMovies, setUpcomingMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const headerOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0.95]);

  useEffect(() => {
    const fetchUpcomingMovies = async () => {
      setLoading(true);
      try {
        const API_URL =
          mediaType === 'movie'
            ? `https://api.themoviedb.org/3/movie/upcoming?api_key=${API_KEY}&page=${page}`
            : `https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}&page=${page}`;

        const response = await axios.get(API_URL);
        setUpcomingMovies((prevMovies) =>
          page === 1 ? response.data.results : [...prevMovies, ...response.data.results]
        );
      } catch (error) {
        console.error('Error fetching upcoming:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingMovies();
  }, [page, mediaType]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMediaTypeChange = (type: 'movie' | 'tv') => {
    if (type !== mediaType) {
      setMediaType(type);
      setUpcomingMovies([]);
      setPage(1);
    }
  };

  const loadMoreMovies = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getGenreNames = (genreIds: number[]) => {
    if (!Array.isArray(genreIds)) return [];
    return genreIds
      .map((id) => genreMap[id])
      .filter(Boolean)
      .slice(0, 2);
  };

  const getReleaseCountdown = (dateStr: string) => {
    if (!dateStr) return null;
    const release = new Date(dateStr);
    const now = new Date();
    const diffTime = release.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Released';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays} days`;
    return null;
  };

  const featured = upcomingMovies.slice(0, 3);
  const rest = upcomingMovies.slice(3);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <motion.div
          ref={containerRef}
          style={{ opacity: headerOpacity }}
          className="relative pt-12 pb-8 px-4"
        >
          <div className="container mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="mb-10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
                    <CalendarDays className="relative w-10 h-10 text-blue-400" />
                  </div>
                  <div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Coming Soon</span>
                    </motion.div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
                      <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                        {mediaType === 'movie' ? 'Upcoming Movies' : 'Upcoming Series'}
                      </span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1 font-medium">
                      Discover what's next in cinema and television
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div
                    className="relative flex items-center bg-white/5 border border-white/10 backdrop-blur-xl rounded-full p-1 shadow-lg"
                    style={{
                      WebkitBackdropFilter: 'blur(16px)',
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    <button
                      onClick={() => handleMediaTypeChange('movie')}
                      className={`relative z-10 flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-colors duration-300 rounded-full ${mediaType === 'movie'
                          ? 'text-white'
                          : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                      <Film className="w-4 h-4" />
                      Movies
                    </button>
                    <button
                      onClick={() => handleMediaTypeChange('tv')}
                      className={`relative z-10 flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-colors duration-300 rounded-full ${mediaType === 'tv'
                          ? 'text-white'
                          : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                      <Tv className="w-4 h-4" />
                      Series
                    </button>
                    <motion.div
                      className="absolute inset-y-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full shadow-lg shadow-blue-500/25"
                      animate={{
                        width: mediaType === 'movie' ? '108px' : '104px',
                        x: mediaType === 'movie' ? 4 : 116,
                      }}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="container mx-auto px-4 max-w-7xl pb-20">
          <AnimatePresence mode="wait">
            {loading && page === 1 ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="aspect-[16/9] bg-zinc-900/80 rounded-2xl animate-pulse border border-white/5"
                    />
                  ))}
                </div>
                {/* Grid skeleton */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <div className="aspect-[2/3] bg-zinc-900/80 rounded-xl animate-pulse border border-white/5" />
                      <div className="h-4 bg-zinc-900/80 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-zinc-900/80 rounded animate-pulse w-1/2" />
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
              >
                {featured.length > 0 && (
                  <div className="mb-10">
                    <h2 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
                      Most Anticipated
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {featured.map((item, index) => {
                        const title = item.title || item.name || 'Untitled';
                        const backdrop = item.backdrop_path
                          ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                          : item.poster_path
                            ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
                            : '/path/to/default-image.jpg';
                        const dateStr =
                          item.release_date || item.first_air_date || '';
                        const year = dateStr
                          ? new Date(dateStr).getFullYear()
                          : 'N/A';
                        const to =
                          mediaType === 'movie'
                            ? `/movie/${item.id}`
                            : `/tv/${item.id}`;
                        const genres = getGenreNames(item.genre_ids);
                        const countdown = getReleaseCountdown(dateStr);
                        const formattedDate = dateStr
                          ? new Date(dateStr).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                          : 'N/A';

                        return (
                          <motion.div
                            key={`featured-${item.id}`}
                            variants={featuredVariants}
                            custom={index}
                          >
                            <Link to={to} className="block group">
                              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/30 transition-all duration-500">
                                <img
                                  src={backdrop}
                                  alt={title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                                <div className="absolute top-3 left-3">
                                  <span className="text-5xl font-black text-white/20 drop-shadow-lg">
                                    #{index + 1}
                                  </span>
                                </div>

                                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                  <span className="text-white font-bold text-xs">
                                    {countdown || formattedDate}
                                  </span>
                                </div>

                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                    <Play className="w-6 h-6 text-white fill-white ml-1" />
                                  </div>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                  <h3 className="text-lg font-bold text-white truncate mb-1 drop-shadow-lg">
                                    {title}
                                  </h3>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-300 flex items-center gap-1">
                                      <CalendarDays className="w-3 h-3" />
                                      {year}
                                    </span>
                                    <div className="flex gap-1.5">
                                      {genres.map((g) => (
                                        <span
                                          key={g}
                                          className="text-[10px] px-2 py-0.5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-gray-300"
                                        >
                                          {g}
                                        </span>
                                      ))}
                                    </div>
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
                    <h2 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-gradient-to-b from-cyan-500 to-violet-500 rounded-full" />
                      Coming Up
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
                      {rest.map((item) => {
                        const title = item.title || item.name || 'Untitled';
                        const poster = item.poster_path
                          ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
                          : item.backdrop_path
                            ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                            : '/path/to/default-image.jpg';
                        const dateStr =
                          item.release_date || item.first_air_date || '';
                        const year = dateStr
                          ? new Date(dateStr).getFullYear()
                          : 'N/A';
                        const to =
                          mediaType === 'movie'
                            ? `/movie/${item.id}`
                            : `/tv/${item.id}`;
                        const genres = getGenreNames(item.genre_ids);
                        const countdown = getReleaseCountdown(dateStr);

                        return (
                          <motion.div
                            key={`grid-${item.id}`}
                            variants={itemVariants}
                          >
                            <Link to={to} className="block group">
                              <div className="relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-1.5">
                                <div className="relative aspect-[2/3] overflow-hidden">
                                  <img
                                    src={poster}
                                    alt={title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                  {countdown && (
                                    <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-2 py-0.5">
                                      <span className="text-xs font-bold text-cyan-300">
                                        {countdown}
                                      </span>
                                    </div>
                                  )}

                                  <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2 py-0.5 flex items-center gap-1">
                                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                    <span className="text-white font-bold text-[10px]">
                                      {item.vote_average?.toFixed(1) ?? 'N/A'}
                                    </span>
                                  </div>

                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                    </div>
                                  </div>
                                </div>

                                <div className="p-3.5">
                                  <h3 className="text-sm font-bold text-white truncate mb-1.5 group-hover:text-cyan-400 transition-colors duration-300">
                                    {title}
                                  </h3>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">
                                      {year}
                                    </span>
                                    <div className="flex gap-1">
                                      {genres.map((g) => (
                                        <span
                                          key={g}
                                          className="text-[9px] px-1.5 py-0.5 bg-zinc-800/80 border border-zinc-700/40 rounded-full text-zinc-400"
                                        >
                                          {g}
                                        </span>
                                      ))}
                                    </div>
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

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="flex justify-center mt-12"
                >
                  <button
                    onClick={loadMoreMovies}
                    disabled={loading}
                    className="group relative px-8 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm tracking-wide rounded-2xl shadow-2xl shadow-blue-500/20 border border-blue-400/30 backdrop-blur-xl transition-all duration-300 hover:from-blue-500 hover:to-cyan-400 hover:scale-105 hover:shadow-blue-500/30 disabled:opacity-60 disabled:hover:scale-100 overflow-hidden"
                    style={{
                      WebkitBackdropFilter: 'blur(20px)',
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <CalendarDays className="w-4 h-4" />
                          Load More
                        </>
                      )}
                    </span>
                    <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 p-3 bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl hover:bg-zinc-800/80 transition-all duration-300 hover:scale-110 group"
          >
            <ChevronUp className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UpcomingMovies;