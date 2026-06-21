import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  History as HistoryIcon,
  Search,
  SortAsc,
  SortDesc,
  Filter,
  ImageOff,
  Star,
  Clapperboard,
  Tv,
  X,
  AlertCircle,
  Check,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Loading from '../components/Loading.tsx';

interface WatchedItem {
  id: string;
  movieId: number;
  title?: string;
  name?: string;
  posterPath: string;
  releaseDate?: string;
  first_air_date?: string;
  genres: string[];
  mediaType: 'movie' | 'tv';
  watchedDate: string;
  rating?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
};

const HistoryPage = () => {
  const { user } = useAuth();
  const [fullHistory, setFullHistory] = useState<WatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [ratingsCache, setRatingsCache] = useState<{ [key: string]: number }>({});

  const API_KEY = '859afbb4b98e3b467da9c99ac390e950';

  const history = fullHistory.filter((item) => item.mediaType === mediaType);
  const availableGenres = ['All', ...new Set(history.flatMap((item) => item.genres))];

  const filteredAndSortedHistory = history
    .filter((item) => {
      const matchesGenre = selectedGenre === 'All' || item.genres.includes(selectedGenre);
      const matchesSearch =
        searchTerm === '' || (item.title || item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesGenre && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.watchedDate).getTime();
      const dateB = new Date(b.watchedDate).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const handleMediaTypeChange = (type: 'movie' | 'tv') => {
    setMediaType(type);
    setSelectedGenre('All');
    setSearchTerm('');
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.style.display = 'none';
    e.currentTarget.nextElementSibling?.classList.remove('hidden');
  };

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const historyRef = collection(db, `users/${user.uid}/history`);
    const q = query(historyRef, orderBy('watchedDate', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const fetchedHistory = snapshot.docs.map((doc) => {
          const data = doc.data();
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
            watchedDate: data.watchedDate || new Date().toISOString(),
            rating: data.rating || undefined,
          };
        });

        setFullHistory(fetchedHistory);
        setLoading(false);

        const uniqueItemsToFetch = fetchedHistory.filter(
          item => ratingsCache[`${item.mediaType}_${item.movieId}`] === undefined
        );

        if (uniqueItemsToFetch.length > 0) {
          const updates: { [key: string]: number } = {};
          await Promise.all(
            uniqueItemsToFetch.map(async (item) => {
              try {
                const endpoint = `https://api.themoviedb.org/3/${item.mediaType}/${item.movieId}?api_key=${API_KEY}`;
                const res = await axios.get(endpoint);
                updates[`${item.mediaType}_${item.movieId}`] = res.data.vote_average || 0;
              } catch (err) {
                updates[`${item.mediaType}_${item.movieId}`] = 0;
              }
            })
          );
          setRatingsCache((prev) => ({ ...prev, ...updates }));
        }
      },
      (error) => {
        console.error('Error fetching history:', error);
        setError('Failed to load watch history. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 bg-zinc-950">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900/30 border border-red-500/10 p-8 max-w-sm w-full text-center backdrop-blur-2xl shadow-2xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Error Loading History</h3>
          <p className="text-zinc-400 mb-6 text-xs leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-red-600/10"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 bg-zinc-950">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900/20 border border-white/[0.05] p-8 max-w-sm w-full text-center backdrop-blur-2xl shadow-2xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-5">
            <HistoryIcon className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Sign In Required</h3>
          <p className="text-zinc-400 mb-6 text-xs leading-relaxed">Access your personalized timeline analytics and cloud history data.</p>
          <Link
            to="/login"
            className="block w-full py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold text-xs rounded-xl transition-all text-center shadow-lg shadow-red-600/10"
          >
            Sign In Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16 antialiased selection:bg-red-500/30">
      <div className="relative border-b border-white/[0.04] bg-gradient-to-b from-zinc-900/30 to-transparent backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl shadow-inner">
                  <HistoryIcon className="w-5 h-5 text-red-500" />
                </div>
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
                  Watch History
                </h1>
              </div>
              <p className="text-zinc-400 text-xs md:text-sm font-medium">
                Your architectural cinematic footprint, curated dynamically.
              </p>
            </div>

            <div className="flex items-center gap-2.5 bg-zinc-900/40 border border-white/[0.04] p-1.5 rounded-2xl w-fit backdrop-blur-md">
              <div className="text-[11px] font-medium bg-white/[0.02] border border-white/[0.04] rounded-xl px-3.5 py-2 text-zinc-400 flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-orange-400/90" />
                <span className="text-white font-bold text-xs">{fullHistory.filter(i => i.mediaType === 'movie').length}</span> Movies
              </div>
              <div className="text-[11px] font-medium bg-white/[0.02] border border-white/[0.04] rounded-xl px-3.5 py-2 text-zinc-400 flex items-center gap-2">
                <Tv className="w-4 h-4 text-cyan-400/90" />
                <span className="text-white font-bold text-xs">{fullHistory.filter(i => i.mediaType === 'tv').length}</span> Series
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex items-center p-1.5 bg-gradient-to-b from-white/[0.07] to-white/[0.01] border border-t-white/[0.15] border-x-white/[0.08] border-b-white/[0.03] rounded-2xl w-full md:w-fit backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.15)] overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-tr before:from-white/[0.02] before:via-transparent before:to-white/[0.05] before:pointer-events-none">
            <button
              onClick={() => handleMediaTypeChange('movie')}
              className={`relative flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-xl overflow-hidden group ${mediaType === 'movie'
                ? 'text-white shadow-[0_4px_20px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
            >
              {mediaType === 'movie' && (
                <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
              )}

              {mediaType === 'movie' && (
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              )}
              <Clapperboard className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 ${mediaType === 'movie' ? 'scale-105' : 'group-hover:scale-105'}`} />
              <span className="relative z-10">Movies</span>
            </button>
            <button
              onClick={() => handleMediaTypeChange('tv')}
              className={`relative flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-xs tracking-wide transition-all duration-500 ease-[0.25,1,0.5,1] rounded-xl overflow-hidden group ${mediaType === 'tv'
                ? 'text-white shadow-[0_4px_20px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.3)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                }`}
            >
              {mediaType === 'tv' && (
                <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-red-600 to-red-700 before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.15)_100%)]" />
              )}

              {mediaType === 'tv' && (
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              )}
              <Tv className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 ${mediaType === 'tv' ? 'scale-105' : 'group-hover:scale-105'}`} />
              <span className="relative z-10">Series</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10 w-3.5 h-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder={mediaType === "movie" ? "Search movies..." : "Search series..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-9 py-2 bg-zinc-900/40 border border-white/[0.04] rounded-xl text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-amber-500/30 focus:bg-zinc-900/80 transition-all backdrop-blur-md"
              />

              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-zinc-500 hover:text-white transition-colors p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
              className="p-2 bg-zinc-900/40 border border-white/[0.04] rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900/80 transition-all backdrop-blur-md aspect-square flex items-center justify-center"
              title={sortOrder === 'newest' ? "Sort Oldest First" : "Sort Newest First"}
            >
              {sortOrder === 'newest' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border rounded-xl transition-all backdrop-blur-md aspect-square flex items-center justify-center ${showFilters ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zinc-900/40 border-white/[0.04] text-zinc-400 hover:text-white hover:bg-zinc-900/80'}`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden mb-6"
            >
              <div className="p-3 bg-zinc-900/20 border border-white/[0.03] rounded-xl flex flex-wrap gap-2 max-h-40 overflow-y-auto backdrop-blur-md">
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedGenre === genre ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-white/[0.02] border-white/[0.04] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredAndSortedHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl border border-dashed border-white/[0.04] bg-zinc-900/10 backdrop-blur-sm">
            <HistoryIcon className="w-7 h-7 text-zinc-600 mb-3 stroke-[1.5]" />
            <p className="text-zinc-400 text-xs font-semibold tracking-wide">Timeline Index Clean</p>
            <Link to="/" className="text-xs text-red-500 font-medium mt-1.5 hover:text-red-400 transition-colors underline underline-offset-4">
              Explore Trending Catalogs
            </Link>
          </div>
        )}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-5"
        >
          {filteredAndSortedHistory.map((item) => {
            const cacheKey = `${item.mediaType}_${item.movieId}`;
            const displayRating = ratingsCache[cacheKey] ?? item.rating;

            return (
              <motion.div key={item.id} variants={cardVariants} layout className="w-full">
                <Link to={`/${item.mediaType}/${item.movieId}`} className="group flex flex-col h-full">
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-zinc-900 border border-white/[0.05] shadow-lg group-hover:border-red-500/30 transition-all duration-500 group-hover:shadow-red-950/20">
                    <img
                      src={`https://image.tmdb.org/t/p/w780${item.posterPath}`}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[0.25,1,0.5,1]"
                      onError={handleImageError}
                      loading="lazy"
                    />
                    <div className="hidden absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center text-zinc-600">
                      <ImageOff className="w-5 h-5 mb-1.5 stroke-[1.5]" />
                      <span className="text-[10px] tracking-wide">Image Unavailable</span>
                    </div>

                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-black/60 text-[9px] uppercase tracking-widest text-zinc-300 font-bold rounded-md backdrop-blur-md border border-white/[0.04]">
                      {item.mediaType}
                    </div>

                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-black/60 text-[10px] font-extrabold text-white flex items-center gap-1 rounded-md backdrop-blur-md border border-white/[0.04]">
                      <Star className="w-2.5 h-2.5 text-yellow-500 fill-current" />
                      {displayRating ? displayRating.toFixed(1) : '—'}
                    </div>

                    <div className="absolute bottom-2.5 right-2.5 w-5 h-5 rounded-md bg-emerald-500/90 flex items-center justify-center shadow-md backdrop-blur-sm border border-emerald-400/20 transition-transform duration-300 group-hover:scale-110">
                      <Check className="w-3 h-3 text-zinc-950 stroke-[3.5]" />
                    </div>
                  </div>

                  <div className="mt-3 px-1 flex-1 flex flex-col justify-between">
                    <div>
                      <h2 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-red-400 transition-colors duration-300 tracking-tight">
                        {item.title || item.name}
                      </h2>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium mt-1">
                        <Calendar className="w-2.5 h-2.5 opacity-60" />
                        <span>
                          {new Date(item.watchedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 mt-2.5 overflow-hidden">
                      {item.genres.slice(0, 2).map(g => (
                        <span key={g} className="text-[9px] font-semibold px-2 py-0.5 bg-white/[0.02] border border-white/[0.04] rounded text-zinc-400 truncate max-w-[80px]">
                          {g}
                        </span>
                      ))}
                      {item.genres.length > 2 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-900/60 border border-white/[0.02] rounded text-zinc-500 shrink-0">
                          +{item.genres.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default HistoryPage;

export type WatchedItemData = {
  movieId: number;
  title?: string;
  posterPath: string;
  releaseDate?: string;
  genres: string[];
  mediaType: 'movie' | 'tv';
};

export const useWatchedStatus = (movieId: number, mediaType: 'movie' | 'tv') => {
  const { user } = useAuth();
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      if (user?.uid) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const historyRef = collection(db, `users/${user.uid}/history`);
        const q = query(historyRef, where('movieId', '==', movieId), where('mediaType', '==', mediaType));
        const querySnapshot = await getDocs(q);
        if (active) {
          setIsWatched(!querySnapshot.empty);
        }
      }
    };
    checkStatus();
    return () => { active = false; };
  }, [user?.uid, movieId, mediaType]);

  const toggleWatched = async (movieData: any) => {
    if (!user?.uid) return { success: false, error: 'User not authenticated' };
    setLoading(true);
    try {
      const {
        collection,
        query,
        where,
        getDocs,
        addDoc,
        deleteDoc,
      } = await import('firebase/firestore');

      const userId = user.uid;

      const historyRef = collection(db, `users/${userId}/history`);
      const historyQ = query(historyRef, where('movieId', '==', movieId), where('mediaType', '==', mediaType));
      const historySnapshot = await getDocs(historyQ);

      // Watchlist is stored without mediaType in MovieDetails.tsx (movieId only),
      // so when marking as watched we remove by movieId.
      const watchlistRef = collection(db, `users/${userId}/watchlist`);
      const watchlistQ = query(watchlistRef, where('movieId', '==', movieId));

      if (isWatched) {
        // Unwatch: remove from history only. Do not re-add to watchlist.
        if (!historySnapshot.empty) await deleteDoc(historySnapshot.docs[0].ref);
        setIsWatched(false);
      } else {
        // Mark watched: upsert history, and remove from watchlist.
        if (!historySnapshot.empty) await deleteDoc(historySnapshot.docs[0].ref);
        await addDoc(historyRef, { ...movieData, watchedDate: new Date().toISOString() });
        setIsWatched(true);

        // Remove from watchlist (online)
        const watchlistSnapshot = await getDocs(watchlistQ);
        if (!watchlistSnapshot.empty) {
          await Promise.all(watchlistSnapshot.docs.map((d) => deleteDoc(d.ref)));
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  return { isWatched, loading, toggleWatched };
};