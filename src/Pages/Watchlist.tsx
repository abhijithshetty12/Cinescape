import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  AlertCircle,
  Bookmark,
  Clapperboard,
  Filter,
  ImageOff,
  Search,
  SortAsc,
  SortDesc,
  Star,
  TrendingUp,
  Tv,
  X,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Loading from '../components/Loading.tsx';
import axios from 'axios';
import WatchlistRoulette from '../components/WatchlistRoulette.tsx';

interface MediaItem {
  id: string;
  movieId: number;
  title?: string;
  name?: string;
  posterPath: string;
  releaseDate?: string;
  first_air_date?: string;
  genres: string[];
  mediaType: 'movie' | 'tv';
  vote_average?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
};

const WatchlistPage = () => {
  const { user } = useAuth();
  const [fullWatchlist, setFullWatchlist] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRoulette, setShowRoulette] = useState(false);

  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const API_KEY = '859afbb4b98e3b467da9c99ac390e950';

  const watchlist = fullWatchlist.filter((item) => item.mediaType === mediaType);
  const availableGenres = ['All', ...new Set(watchlist.flatMap((item) => item.genres))];

  const filteredAndSortedWatchlist = watchlist
    .filter((item) => {
      const matchesGenre = selectedGenre === 'All' || item.genres.includes(selectedGenre);
      const matchesSearch =
        searchTerm === '' ||
        (item.title || item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesGenre && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.releaseDate || a.first_air_date || '').getTime();
      const dateB = new Date(b.releaseDate || b.first_air_date || '').getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const handleMediaTypeChange = (type: 'movie' | 'tv') => {
    setMediaType(type);
    setSelectedGenre('All');
    setSearchTerm('');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none';
    e.currentTarget.nextElementSibling?.classList.remove('hidden');
  };

  const fetchMediaRatings = async (movieId: number, mediaType: 'movie' | 'tv') => {
    try {
      const url =
        mediaType === 'movie'
          ? `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}`
          : `https://api.themoviedb.org/3/tv/${movieId}?api_key=${API_KEY}`;
      const response = await axios.get(url);
      return response.data.vote_average;
    } catch (error) {
      console.error('Error fetching media rating:', error);
      return 0;
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You are offline. Watchlist may be limited to previously loaded data.');
      setLoading(false);
      return;
    }

    try {
      const watchlistRef = collection(db, `users/${user.uid}/watchlist`);
      const q = query(watchlistRef, orderBy('releaseDate', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const fetchedWatchlist = await Promise.all(
            snapshot.docs.map(async (doc) => {
              const data = doc.data();
              const vote_average = await fetchMediaRatings(data.movieId, data.mediaType || 'movie');
              return {
                id: doc.id,
                movieId: data.movieId || 0,
                title: data.title || '',
                name: data.name || '',
                posterPath: data.posterPath || '',
                releaseDate: data.releaseDate || '',
                first_air_date: data.first_air_date || '',
                genres: Array.isArray(data.genres) ? data.genres : [],
                mediaType: data.mediaType || 'movie',
                vote_average: vote_average || 0,
              };
            })
          );

          setFullWatchlist(fetchedWatchlist);
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching watchlist:', error);
          setError('Failed to load watchlist. Please try again.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up watchlist listener:', error);
      setError('Failed to connect to database. Please check your connection.');
      setLoading(false);
    }
  }, [user?.uid]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-[#09090b]">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900/40 border border-red-500/20 p-8 max-w-md w-full text-center backdrop-blur-2xl shadow-2xl shadow-red-950/20">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Error Loading Watchlist</h3>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm tracking-wide rounded-xl shadow-lg shadow-red-600/20 transition-all duration-300 active:scale-[0.98]"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-[#09090b]">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900/40 border border-zinc-800 backdrop-blur-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mb-5">
            <Bookmark className="w-7 h-7 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Sign In Required</h3>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">Please authenticate to gain access to your curated cinematic space.</p>
          <Link
            to="/login"
            className="block w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-semibold text-sm tracking-wide rounded-xl transition-all duration-300 shadow-lg shadow-red-600/10 active:scale-[0.98]"
          >
            Sign In Account
          </Link>
        </div>
      </div>
    );
  }

  const totalMovies = fullWatchlist.filter((i) => i.mediaType === 'movie').length;
  const totalSeries = fullWatchlist.filter((i) => i.mediaType === 'tv').length;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 pb-20 selection:bg-red-500/30 overflow-x-clip relative">
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-red-950/10 via-transparent to-transparent pointer-events-none z-0" />
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-red-600/[0.02] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[10%] left-[-5%] w-[500px] h-[500px] bg-orange-500/[0.01] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 border-b border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30">
                  <Bookmark className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight bg-clip-text">
                    Watchlist
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                    Your dynamic workspace for tracking films and series.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:self-end">
              <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-4 py-2 shadow-inner">
                <Clapperboard className="w-4 h-4 text-orange-400/90" />
                <span className="text-xs font-semibold text-zinc-300">{totalMovies} Movies</span>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-4 py-2 shadow-inner">
                <Tv className="w-4 h-4 text-cyan-400/90" />
                <span className="text-xs font-semibold text-zinc-300">{totalSeries} Series</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 relative z-10">

        <div className="bg-zinc-900/30 border border-white/[0.04] backdrop-blur-xl rounded-2xl p-3 sm:p-4 mb-8 shadow-2xl flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">

            <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full lg:w-auto">
              <div className="relative flex items-center p-1 bg-zinc-950/40 backdrop-blur-xl border border-white/[0.04] rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden flex-1 sm:flex-initial">
                <button
                  onClick={() => handleMediaTypeChange('movie')}
                  className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-xs tracking-wide transition-all duration-300 rounded-lg ${mediaType === 'movie'
                    ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                  <Clapperboard className={`w-3.5 h-3.5 transition-transform duration-300 ${mediaType === 'movie' ? 'scale-110 text-red-400' : ''}`} />
                  <span>Movies</span>

                  {mediaType === 'movie' && (
                    <motion.div
                      layoutId="liquid-pill"
                      className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    />
                  )}
                </button>

                <button
                  onClick={() => handleMediaTypeChange('tv')}
                  className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-xs tracking-wide transition-all duration-300 rounded-lg ${mediaType === 'tv'
                    ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                  <Tv className={`w-3.5 h-3.5 transition-transform duration-300 ${mediaType === 'tv' ? 'scale-110 text-cyan-400' : ''}`} />
                  <span>Series</span>

                  {mediaType === 'tv' && (
                    <motion.div
                      layoutId="liquid-pill"
                      className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    />
                  )}
                </button>

                <div className="absolute inset-y-1 left-1 right-1 pointer-events-none overflow-hidden rounded-lg hidden sm:block">
                  <motion.div
                    className="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-red-500/10 via-red-500/20 to-orange-500/10 blur-md opacity-80"
                    animate={{ x: mediaType === 'movie' ? 0 : 84 }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28 }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => filteredAndSortedWatchlist.length && setShowRoulette(true)}
                disabled={filteredAndSortedWatchlist.length === 0}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all duration-300 active:scale-95 shrink-0 ${filteredAndSortedWatchlist.length === 0
                  ? 'bg-zinc-900/20 border-zinc-900/60 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-950/60 border-white/[0.04] hover:border-red-500/30 text-zinc-100 hover:text-red-400'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                <span className="hidden sm:inline">Surprise Me</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full lg:flex-1 lg:max-w-2xl lg:justify-end">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 z-10 w-3.5 h-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'series'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 bg-zinc-950/60 border border-white/[0.04] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/30 transition-all duration-300 text-xs backdrop-blur-md"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 z-10 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={toggleSortOrder}
                  className="flex items-center justify-center gap-2 p-2.5 bg-zinc-950/60 border border-white/[0.04] rounded-xl text-zinc-300 hover:text-white transition-all duration-200 text-xs font-semibold aspect-square md:aspect-auto md:px-4 md:py-2"
                  title={sortOrder === 'newest' ? 'Sort Oldest First' : 'Sort Newest First'}
                >
                  {sortOrder === 'newest' ? <SortDesc className="w-4 h-4 text-zinc-400" /> : <SortAsc className="w-4 h-4 text-zinc-400" />}
                  <span className="hidden md:inline">{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
                </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center gap-2 p-2.5 border rounded-xl text-xs font-semibold transition-all duration-200 aspect-square md:aspect-auto md:px-4 md:py-2 ${showFilters
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-zinc-950/60 border-white/[0.04] text-zinc-300 hover:text-white'
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden md:inline">Filters</span>
                </button>
              </div>
            </div>

          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden border-t border-white/[0.04] pt-3 mt-0.5"
              >
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                  {availableGenres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 border snap-center ${selectedGenre === genre
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-zinc-950/40 border-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.08]'
                        }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {filteredAndSortedWatchlist.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 border border-dashed border-zinc-900 rounded-3xl bg-zinc-950/20 backdrop-blur-sm"
          >
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5 text-zinc-600">
              <Bookmark className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5 tracking-tight">
              No tracking assets found
            </h3>
            <p className="text-zinc-500 text-xs mb-6 max-w-xs text-center leading-relaxed">
              Your active {mediaType === 'movie' ? 'movie' : 'series'} watchlist workspace has no matching parameters.
            </p>
            <Link
              to="/trending"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs rounded-xl transition-all duration-200 shadow-lg shadow-white/5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Discover Media
            </Link>
          </motion.div>
        )}

        <motion.div
          key={`${mediaType}-${selectedGenre}-${searchTerm}-${sortOrder}`}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-7 w-full"
        >
          <AnimatePresence mode="popLayout">
            {filteredAndSortedWatchlist.map((item) => (
              <motion.div
                key={item.id}
                variants={cardVariants}
                layout
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              >
                <Link to={`/${item.mediaType}/${item.movieId}`} className="group block">
                  <div className="relative rounded-2xl overflow-hidden shadow-md bg-zinc-950 border border-zinc-900 transition-all duration-300 group-hover:border-zinc-800 group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.5)]">

                    <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
                      <img
                        src={`https://image.tmdb.org/t/p/w780${item.posterPath}`}
                        alt={item.title || item.name}
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                        onError={handleImageError}
                        loading="lazy"
                      />
                      <div className="hidden w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-600">
                        <ImageOff className="w-8 h-8 mb-1.5 stroke-[1.5]" />
                        <span className="text-[10px] font-medium tracking-wide">Missing Poster</span>
                      </div>

                      <div className="absolute top-2 left-2 flex items-center justify-between pointer-events-none">
                        <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 rounded-md px-1.5 py-0.5 flex items-center gap-1 shadow-md">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                          <span className="text-zinc-200 text-[10px] font-bold">
                            {item.vote_average ? item.vote_average.toFixed(1) : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />
                    </div>

                    <div className="p-3">
                      <h2 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-white transition-colors duration-200 tracking-tight mb-0.5">
                        {item.title || item.name}
                      </h2>

                      <p className="text-[10px] font-medium text-zinc-500 mb-2">
                        {item.releaseDate || item.first_air_date
                          ? new Date(item.releaseDate || item.first_air_date || '').getFullYear()
                          : 'N/A'}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {item.genres.slice(0, 2).map((genre) => (
                          <span
                            key={genre}
                            className="text-[9px] font-medium px-2 py-0.5 bg-zinc-900 border border-zinc-800/60 rounded-md text-zinc-400"
                          >
                            {genre}
                          </span>
                        ))}
                        {item.genres.length > 2 && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 bg-zinc-900/40 text-zinc-600 rounded-md">
                            +{item.genres.length - 2}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredAndSortedWatchlist.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-14 text-center"
          >
            <div className="inline-flex items-center gap-2 bg-zinc-900/20 border border-zinc-900 rounded-full px-4 py-1.5">
              <span className="text-zinc-500 text-xs">
                Rendered <span className="text-zinc-400 font-semibold">{filteredAndSortedWatchlist.length}</span> results
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showRoulette && (
          <WatchlistRoulette
            isOpen={showRoulette}
            onClose={() => setShowRoulette(false)}
            items={filteredAndSortedWatchlist as any}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WatchlistPage;