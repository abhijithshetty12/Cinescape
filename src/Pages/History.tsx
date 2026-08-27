import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { History, Search, SortAsc, SortDesc, Filter, ImageOff, Star, Clapperboard, Tv, X, AlertCircle, Check, CalendarCheck, } from 'lucide-react';
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
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
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
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-black font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',sans-serif]">
        <div className="relative rounded-[32px] bg-gradient-to-b from-white/[0.12] to-white/[0.03] border border-white/20 p-8 max-w-sm w-full text-center backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.4)]">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-b from-red-500/30 to-red-600/10 border border-red-500/30 flex items-center justify-center mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">Error Loading History</h3>
          <p className="text-zinc-400 mb-6 text-xs leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-medium text-xs rounded-full transition-all active:scale-[0.97] shadow-[0_10px_25px_rgba(220,38,38,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)]"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-black font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',sans-serif]">
        <div className="relative rounded-[32px] bg-gradient-to-b from-white/[0.12] to-white/[0.03] border border-white/20 p-8 max-w-sm w-full text-center backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.4)]">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-b from-white/20 to-white/5 border border-white/30 flex items-center justify-center mb-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
            <History className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">Sign In Required</h3>
          <p className="text-zinc-400 mb-6 text-xs leading-relaxed">Access your personalized timeline analytics and cloud history data.</p>
          <Link
            to="/login"
            className="block w-full py-3.5 bg-gradient-to-b from-red-500 via-red-600 to-red-700 hover:from-red-400 hover:to-red-600 text-white font-medium text-xs rounded-full transition-all text-center active:scale-[0.97] shadow-[0_10px_25px_rgba(220,38,38,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]"
          >
            Sign In Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',sans-serif] antialiased selection:bg-red-500/30">
      <div className="sticky top-0 z-40 bg-black/40 backdrop-blur-3xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 md:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="p-2.5 rounded-xl bg-gradient-to-b from-white/20 to-white/5 border border-white/20 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
                  <History className="w-5 h-5 text-emerald-500" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                  Watch History
                </h1>
              </div>
              <p className="text-zinc-400 text-xs font-normal">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center p-1 bg-white/[0.08] border border-white/15 rounded-full w-full sm:w-fit backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
            <button
              onClick={() => handleMediaTypeChange('movie')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2 rounded-full font-semibold text-xs transition-all duration-300 active:scale-95 ${mediaType === 'movie'
                ? 'bg-gradient-to-b from-red-500 via-red-600 to-red-700 text-white shadow-[0_4px_15px_rgba(220,38,38,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-red-400/30'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span>Movies</span>
            </button>
            <button
              onClick={() => handleMediaTypeChange('tv')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2 rounded-full font-semibold text-xs transition-all duration-300 active:scale-95 ${mediaType === 'tv'
                ? 'bg-gradient-to-b from-red-500 via-red-600 to-red-700 text-white shadow-[0_4px_15px_rgba(220,38,38,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-red-400/30'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Series</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 z-10 w-3.5 h-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder={mediaType === "movie" ? "Search movies..." : "Search series..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white/[0.06] border border-white/15 rounded-full text-white placeholder-zinc-400 text-xs focus:outline-none focus:border-white/30 focus:bg-white/[0.1] transition-all backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
              />

              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-zinc-400 hover:text-white transition-colors p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
              className="p-2.5 bg-white/[0.06] border border-white/15 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.12] transition-all backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-95 flex items-center justify-center shrink-0"
              title={sortOrder === 'newest' ? "Sort Oldest First" : "Sort Newest First"}
            >
              {sortOrder === 'newest' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-full transition-all backdrop-blur-3xl active:scale-95 flex items-center justify-center shrink-0 ${showFilters ? 'bg-gradient-to-b from-red-500 to-red-600 border border-red-400/40 text-white shadow-[0_4px_15px_rgba(220,38,38,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)]' : 'bg-white/[0.06] border border-white/15 text-zinc-300 hover:text-white hover:bg-white/[0.12] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'}`}
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
              <div className="p-3 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/15 rounded-[24px] flex flex-wrap gap-2 max-h-40 overflow-y-auto backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${selectedGenre === genre ? 'bg-gradient-to-b from-red-500 to-red-600 border border-red-400/40 text-white shadow-[0_4px_12px_rgba(220,38,38,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)]' : 'bg-white/[0.06] border border-white/10 text-zinc-300 hover:bg-white/[0.12] hover:text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'}`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filteredAndSortedHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-3xl text-center px-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center mb-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <History className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-zinc-300 text-sm font-medium tracking-tight">Timeline Index Clean</p>
            <Link to="/" className="text-xs text-red-400 font-semibold mt-2 hover:text-red-300 transition-colors">
              Explore Trending Catalogs &rarr;
            </Link>
          </div>
        )}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
        >
          {filteredAndSortedHistory.map((item) => {
            const cacheKey = `${item.mediaType}_${item.movieId}`;
            const displayRating = ratingsCache[cacheKey] ?? item.rating;

            return (
              <motion.div key={item.id} variants={cardVariants} layout className="w-full">
                <Link to={`/${item.mediaType}/${item.movieId}`} className="group flex flex-col h-full">
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[24px] bg-zinc-900 border border-white/15 shadow-[0_10px_25px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] group-hover:border-white/30 transition-all duration-300 active:scale-[0.97]">
                    <img
                      src={`https://image.tmdb.org/t/p/w780${item.posterPath}`}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      onError={handleImageError}
                      loading="lazy"
                    />
                    <div className="hidden absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center text-zinc-500">
                      <ImageOff className="w-5 h-5 mb-1.5" />
                      <span className="text-[10px]">Unavailable</span>
                    </div>

                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/40 text-[9px] uppercase tracking-wider text-zinc-200 font-semibold rounded-full backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                      {item.mediaType}
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/40 text-[10px] font-bold text-white flex items-center gap-1 rounded-full backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                      <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                      {displayRating ? displayRating.toFixed(1) : '—'}
                    </div>

                    <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_4px_10px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-emerald-300/40">
                      <Check className="w-3 h-3 text-white stroke-[3]" />
                    </div>
                  </div>

                  <div className="mt-2.5 px-1 flex-1 flex flex-col justify-between">
                    <div>
                      <h2 className="text-xs font-semibold text-zinc-100 line-clamp-1 group-hover:text-red-400 transition-colors tracking-tight">
                        {item.title || item.name}
                      </h2>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-normal mt-0.5">
                        <CalendarCheck className="w-3 h-3 opacity-70 text-green-500" />
                        <span>
                          {new Date(item.watchedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 mt-2 overflow-hidden">
                      {item.genres.slice(0, 2).map(g => (
                        <span key={g} className="text-[9px] font-medium px-2 py-0.5 bg-white/[0.08] border border-white/10 rounded-full text-zinc-300 truncate max-w-[75px] backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                          {g}
                        </span>
                      ))}
                      {item.genres.length > 2 && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-white/[0.08] border border-white/10 rounded-full text-zinc-400 shrink-0 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
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

      const watchlistRef = collection(db, `users/${userId}/watchlist`);
      const watchlistQ = query(watchlistRef, where('movieId', '==', movieId));

      if (isWatched) {
        if (!historySnapshot.empty) await deleteDoc(historySnapshot.docs[0].ref);
        setIsWatched(false);
      } else {
        if (!historySnapshot.empty) await deleteDoc(historySnapshot.docs[0].ref);
        await addDoc(historyRef, { ...movieData, watchedDate: new Date().toISOString() });
        setIsWatched(true);

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