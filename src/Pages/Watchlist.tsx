import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  Bookmark,
  Search,
  SortAsc,
  SortDesc,
  Filter,
  ImageOff,
  Star,
  Clapperboard,
  Tv,
  TrendingUp,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Loading from '../components/Loading.tsx';
import axios from 'axios';

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
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const WatchlistPage = () => {
  const { user } = useAuth();
  const [fullWatchlist, setFullWatchlist] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        searchTerm === '' || (item.title || item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
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
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900/90 to-black/90 border border-red-500/20 p-10 max-w-md w-full text-center backdrop-blur-2xl shadow-2xl shadow-red-900/10">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />
          <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Error Loading Watchlist</h3>
          <p className="text-zinc-400 mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="group relative px-8 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm tracking-wide rounded-2xl shadow-xl shadow-red-500/20 border border-red-400/30 backdrop-blur-xl transition-all duration-300 hover:from-red-500 hover:to-red-400 hover:scale-105 hover:shadow-red-500/30 overflow-hidden"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900/90 to-black/90 border border-white/10 p-10 max-w-md w-full text-center backdrop-blur-2xl shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500" />
          <div className="mx-auto w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
            <Bookmark className="w-10 h-10 text-zinc-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Sign In Required</h3>
          <p className="text-zinc-400 mb-8 leading-relaxed">Please sign in to view and manage your personal watchlist.</p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm tracking-wide rounded-2xl shadow-xl shadow-red-500/20 border border-red-400/30 backdrop-blur-xl transition-all duration-300 hover:from-red-500 hover:to-red-400 hover:scale-105 hover:shadow-red-500/30"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const totalMovies = fullWatchlist.filter((i) => i.mediaType === 'movie').length;
  const totalSeries = fullWatchlist.filter((i) => i.mediaType === 'tv').length;

  return (
    <div className="min-h-screen pb-12">
      {/* Header Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative container mx-auto px-4 pt-10 pb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 backdrop-blur-xl">
                  <Bookmark className="w-6 h-6 text-red-500" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Watchlist</h1>
              </div>
              <p className="text-zinc-400 text-sm md:text-base ml-[3.25rem]">
                Your saved movies and series, all in one place.
              </p>
            </div>

            {/* Stats Pills */}
            <div className="flex items-center gap-3 ml-[3.25rem] md:ml-0">
              <div className="flex items-center gap-2 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-full px-4 py-2">
                <Clapperboard className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-zinc-200">{totalMovies} Movies</span>
              </div>
              <div className="flex items-center gap-2 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-full px-4 py-2">
                <Tv className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-zinc-200">{totalSeries} Series</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Tab Switcher */}
        <div className="flex items-center justify-center md:justify-start mb-8">
          <div className="relative flex items-center p-1 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-full shadow-lg shadow-black/20">
            <button
              onClick={() => handleMediaTypeChange('movie')}
              className={`relative z-10 flex items-center gap-2 px-6 py-2.5 font-semibold text-sm transition-colors duration-300 rounded-full ${
                mediaType === 'movie' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clapperboard className="w-4 h-4" />
              Movies
            </button>
            <button
              onClick={() => handleMediaTypeChange('tv')}
              className={`relative z-10 flex items-center gap-2 px-6 py-2.5 font-semibold text-sm transition-colors duration-300 rounded-full ${
                mediaType === 'tv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tv className="w-4 h-4" />
              Series
            </button>
            <motion.div
              className="absolute inset-y-1 bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-lg shadow-red-500/20"
              layoutId="watchlist-tab"
              initial={false}
              animate={{
                width: mediaType === 'movie' ? '118px' : '113px',
                x: mediaType === 'movie' ? 4 : 122,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4 transition-colors" />
            <input
              type="text"
              placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'series'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-2.5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 transition-all duration-300 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleSortOrder}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300 text-sm font-medium"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={sortOrder}
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {sortOrder === 'newest' ? (
                    <SortDesc className="w-4 h-4" />
                  ) : (
                    <SortAsc className="w-4 h-4" />
                  )}
                </motion.div>
              </AnimatePresence>
              {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 backdrop-blur-xl border rounded-2xl text-sm font-medium transition-all duration-300 ${
                showFilters
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15]'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Genre Chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {availableGenres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${
                        selectedGenre === genre
                          ? 'bg-red-500/15 border-red-500/30 text-red-400'
                          : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] hover:border-white/[0.15]'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {filteredAndSortedWatchlist.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-24 h-24 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6">
              <Bookmark className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              No {mediaType === 'movie' ? 'movies' : 'series'} yet
            </h3>
            <p className="text-zinc-500 text-sm mb-8 max-w-xs text-center">
              Your {mediaType === 'movie' ? 'movie' : 'series'} watchlist is empty. Start exploring and add your favorites!
            </p>
            <Link
              to="/trending"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-red-500/20 border border-red-400/30 backdrop-blur-xl transition-all duration-300 hover:from-red-500 hover:to-red-400 hover:scale-105 hover:shadow-red-500/30"
            >
              <TrendingUp className="w-4 h-4" />
              Discover {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
            </Link>
          </motion.div>
        )}

        {/* Grid */}
        <motion.div
          key={`${mediaType}-${selectedGenre}-${searchTerm}-${sortOrder}`}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {filteredAndSortedWatchlist.map((item) => (
              <motion.div key={item.id} variants={cardVariants} layout>
                <Link to={`/${item.mediaType}/${item.movieId}`} className="group block">
                  <div className="relative bg-gradient-to-b from-white/[0.07] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-red-500/10 hover:border-red-500/30 transition-all duration-500 hover:-translate-y-2">
                    {/* Poster */}
                    <div className="relative aspect-[2/3] overflow-hidden">
                      <img
                        src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
                        alt={item.title || item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={handleImageError}
                        loading="lazy"
                      />
                      <div className="hidden w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500">
                        <ImageOff className="w-10 h-10 mb-2" />
                        <span className="text-xs text-center px-2">No Image</span>
                      </div>

                      {/* Media Type Badge */}
                      <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-2 py-0.5">
                        <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                          {item.mediaType === 'movie' ? 'Movie' : 'Series'}
                        </span>
                      </div>

                      {/* Rating Badge */}
                      <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-current" />
                        <span className="text-white text-xs font-bold">{item.vote_average?.toFixed(1) || 'N/A'}</span>
                      </div>

                      {/* Bottom Gradient */}
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                    </div>

                    {/* Info */}
                    <div className="p-3.5">
                      <h2 className="text-sm font-bold text-white mb-1 line-clamp-2 group-hover:text-red-400 transition-colors duration-300">
                        {item.title || item.name}
                      </h2>
                      <p className="text-xs text-zinc-500 mb-3">
                        {item.releaseDate || item.first_air_date
                          ? new Date(item.releaseDate || item.first_air_date || '').getFullYear()
                          : 'N/A'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.genres.slice(0, 2).map((genre) => (
                          <span
                            key={genre}
                            className="text-[10px] px-2 py-0.5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-zinc-300 font-medium"
                          >
                            {genre}
                          </span>
                        ))}
                        {item.genres.length > 2 && (
                          <span className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/5 rounded-full text-zinc-500">
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

        {/* Footer Count */}
        {filteredAndSortedWatchlist.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-10 text-center"
          >
            <div className="inline-flex items-center gap-2 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-full px-5 py-2">
              <span className="text-zinc-500 text-sm">
                Showing <span className="text-zinc-300 font-semibold">{filteredAndSortedWatchlist.length}</span>{' '}
                {mediaType === 'movie' ? 'movies' : 'series'}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WatchlistPage;
