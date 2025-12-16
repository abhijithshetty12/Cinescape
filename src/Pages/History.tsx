import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { History as HistoryIcon, Calendar, Search, SortAsc, SortDesc, Filter, ImageOff, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import Loading from '../components/Loading.tsx';

export interface WatchedItemData {
  movieId: number;
  title?: string;
  name?: string;
  posterPath: string;
  releaseDate?: string;
  first_air_date?: string;
  genres: string[];
  mediaType: 'movie' | 'tv';
  rating?: number;
}

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

export const addToHistory = async (userId: string, itemData: WatchedItemData) => {
  try {
    const historyRef = collection(db, `users/${userId}/history`);

    const existingQuery = query(
      historyRef,
      where('movieId', '==', itemData.movieId),
      where('mediaType', '==', itemData.mediaType)
    );
    const existingDocs = await getDocs(existingQuery);

    if (!existingDocs.empty) {
      await deleteDoc(existingDocs.docs[0].ref);
    }

    await addDoc(historyRef, {
      ...itemData,
      watchedDate: new Date().toISOString(),
    });

    const watchlistRef = collection(db, `users/${userId}/watchlist`);
    const watchlistQuery = query(watchlistRef, where('movieId', '==', itemData.movieId));
    const watchlistDocs = await getDocs(watchlistQuery);
    if (!watchlistDocs.empty) {
      await deleteDoc(watchlistDocs.docs[0].ref);
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding to history:', error);
    return { success: false, error };
  }
};

export const removeFromHistory = async (userId: string, movieId: number, mediaType: 'movie' | 'tv') => {
  try {
    const historyRef = collection(db, `users/${userId}/history`);
    const q = query(
      historyRef,
      where('movieId', '==', movieId),
      where('mediaType', '==', mediaType)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      await deleteDoc(querySnapshot.docs[0].ref);
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing from history:', error);
    return { success: false, error };
  }
};

export const checkIfWatched = async (userId: string, movieId: number, mediaType: 'movie' | 'tv') => {
  try {
    const historyRef = collection(db, `users/${userId}/history`);
    const q = query(
      historyRef,
      where('movieId', '==', movieId),
      where('mediaType', '==', mediaType)
    );
    const querySnapshot = await getDocs(q);

    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking watched status:', error);
    return false;
  }
};

export const useWatchedStatus = (movieId: number, mediaType: 'movie' | 'tv') => {
  const { user } = useAuth();
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (user?.uid) {
        const watched = await checkIfWatched(user.uid, movieId, mediaType);
        setIsWatched(watched);
      }
    };

    checkStatus();
  }, [user?.uid, movieId, mediaType]);

  const toggleWatched = async (movieData: WatchedItemData) => {
    if (!user?.uid) return { success: false, error: 'User not authenticated' };

    setLoading(true);
    try {
      let result;
      if (isWatched) {
        result = await removeFromHistory(user.uid, movieId, mediaType);
        if (result.success) {
          setIsWatched(false);
        }
      } else {
        result = await addToHistory(user.uid, movieData);
        if (result.success) {
          setIsWatched(true);
        }
      }
      return result;
    } catch (error) {
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  return { isWatched, loading, toggleWatched };
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

  const history = fullHistory.filter(item => item.mediaType === mediaType);

  const [ratingsCache, setRatingsCache] = useState<{ [key: string]: number }>({});

  const fetchAndCacheRating = async (item: WatchedItem) => {
    const cacheKey = `${item.mediaType}_${item.movieId}`;
    if (ratingsCache[cacheKey] !== undefined) return ratingsCache[cacheKey];
    try {
      const endpoint =
        item.mediaType === 'movie'
          ? `https://api.themoviedb.org/3/movie/${item.movieId}?api_key=859afbb4b98e3b467da9c99ac390e950`
          : `https://api.themoviedb.org/3/tv/${item.movieId}?api_key=859afbb4b98e3b467da9c99ac390e950`;
      const res = await axios.get(endpoint);
      const rating = res.data.vote_average;
      setRatingsCache((prev) => ({ ...prev, [cacheKey]: rating }));
      return rating;
    } catch {
      setRatingsCache((prev) => ({ ...prev, [cacheKey]: NaN }));
      return NaN;
    }
  };
  const availableGenres = ['All', ...new Set(history.flatMap(item => item.genres))];

  const filteredAndSortedHistory = history
    .filter(item => {
      const matchesGenre = selectedGenre === 'All' || item.genres.includes(selectedGenre);
      const matchesSearch = searchTerm === '' ||
        (item.title || item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
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

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  };

  const formatWatchDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Unknown date';
    }
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

    try {
      const historyRef = collection(db, `users/${user.uid}/history`);
      const ratingsRef = collection(db, `users/${user.uid}/ratings`);
      const q = query(historyRef, orderBy("watchedDate", "desc"));

      const unsubscribe = onSnapshot(q, async (snapshot) => {
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

        const ratingsSnapshot = await getDocs(ratingsRef);
        const ratingsMap = new Map();
        ratingsSnapshot.forEach((doc) => {
          const data = doc.data();
          ratingsMap.set(`${data.movieId}_movie`, data.rating);
          ratingsMap.set(`${data.movieId}_tv`, data.rating);
        });

        const mergedHistory = fetchedHistory.map((item) => {
          let { rating } = item;
          if (rating === undefined) {
            const key = `${item.movieId}_${item.mediaType}`;
            rating = ratingsMap.get(key);
          }
          return { ...item, rating };
        });

        setFullHistory(mergedHistory);
        setLoading(false);
      },
        (error) => {
          console.error('Error fetching history:', error);
          setError('Failed to load watch history. Please try again.');
          setLoading(false);
        });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up history listener:', error);
      setError('Failed to connect to database. Please check your connection.');
      setLoading(false);
    }
  }, [user?.uid]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="container mx-auto mt-8 px-4">
        <div className="text-center py-12">
          <HistoryIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-400 mb-2">Error Loading History</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto mt-8 px-4">
        <div className="text-center py-12">
          <HistoryIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">Sign In Required</h3>
          <p className="text-gray-500">Please sign in to view your watch history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto mt-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <HistoryIcon className="w-8 h-8 text-green-500" />
        <h1 className="text-3xl font-bold">History</h1>
        <span className="text-gray-400 text-lg">
          ({filteredAndSortedHistory.length} {mediaType === 'movie' ? 'movies' : 'series'})
        </span>
      </div>

      <div className="flex items-center p-1 bg-zinc-900 rounded-full w-fit mb-6">
        <div className="relative flex items-center rounded-full">
          <button
            onClick={() => handleMediaTypeChange('movie')}
            className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${mediaType === 'movie' ? 'text-white' : 'text-gray-400'
              }`}
          >
            Movies
          </button>
          <button
            onClick={() => handleMediaTypeChange('tv')}
            className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${mediaType === 'tv' ? 'text-white' : 'text-gray-400'
              }`}
          >
            Series
          </button>
          <motion.div
            className="absolute inset-0 bg-red-600 rounded-full"
            animate={{
              width: mediaType === 'movie' ? '85px' : '80px',
              x: mediaType === 'movie' ? 0 : 85,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'series'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
        </div>

        <button
          onClick={toggleSortOrder}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors"
        >
          {sortOrder === 'newest' ? <SortDesc className="w-5 h-5" /> : <SortAsc className="w-5 h-5" />}
          {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
        </button>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition-colors"
        >
          <Filter className="w-5 h-5" />
          Filters
        </button>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-zinc-800 rounded-lg p-4 mb-6"
        >
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Genre</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                {availableGenres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {filteredAndSortedHistory.length === 0 && !loading && (
        <div className="text-center py-12">
          <HistoryIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            No {mediaType === 'movie' ? 'movies' : 'series'} watched yet
          </h3>
          <p className="text-gray-500 mb-4">
            Start watching some {mediaType === 'movie' ? 'movies' : 'series'} to build your history!
          </p>
          <Link
            to="/trending"
            className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Discover {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {filteredAndSortedHistory.map((item) => (
          <Link to={`/${item.mediaType}/${item.movieId}`} key={item.id}>
            <div className="bg-gray-500 bg-opacity-30 rounded-lg overflow-hidden shadow-md transition-transform transform hover:scale-105 cursor-pointer movie-card-hover">
              <div className="relative aspect-[2/3]">
                <img
                  src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
                  alt={item.title || item.name}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
                <div className="hidden w-full h-full bg-zinc-800 flex flex-col items-center justify-center text-gray-400">
                  <ImageOff className="w-12 h-12 mb-2" />
                  <span className="text-sm text-center px-2">No Image Available</span>
                </div>
                <div className="absolute top-3 right-3 bg-black/70 rounded-full px-3 py-1 flex items-center gap-1 shadow">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-white text-sm font-bold">
                    {typeof item.rating === 'number' && !isNaN(item.rating)
                      ? item.rating.toFixed(1)
                      : ratingsCache[`${item.mediaType}_${item.movieId}`] !== undefined
                        ? !isNaN(ratingsCache[`${item.mediaType}_${item.movieId}`])
                          ? ratingsCache[`${item.mediaType}_${item.movieId}`].toFixed(1)
                          : 'N/A'
                        : (() => {
                          fetchAndCacheRating(item);
                          return '...';
                        })()
                    }
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h2 className="text-sm font-semibold mb-1 line-clamp-2">{item.title || item.name}</h2>
                <div className="flex items-center gap-1 mb-2">
                  <Calendar className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-gray-400">
                    Watched {formatWatchDate(item.watchedDate)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.genres.slice(0, 2).map((genre) => (
                    <span
                      key={genre}
                      className="text-xs px-2 py-1 bg-zinc-800 rounded-full text-zinc-300"
                    >
                      {genre}
                    </span>
                  ))}
                  {item.genres.length > 2 && (
                    <span className="text-xs px-2 py-1 bg-zinc-700 rounded-full text-zinc-400">
                      +{item.genres.length - 2}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredAndSortedHistory.length > 0 && (
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">
            Showing {filteredAndSortedHistory.length} {mediaType === 'movie' ? 'movies' : 'series'}
          </p>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;