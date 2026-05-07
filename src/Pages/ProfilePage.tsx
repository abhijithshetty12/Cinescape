import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.tsx';
import { getAuth, signOut } from 'firebase/auth';
import { db, storage } from '../firebase.ts';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import ReviewList from '../components/ReviewList.tsx';
import { User, ChevronRight, LogOut, Star, Heart, Settings, Film, Bookmark, History, SquarePen, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

const BASE_POSTER_URL = 'https://image.tmdb.org/t/p/original/';
const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";

const ProfilePage = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const [username, setUsername] = useState(user?.username ?? '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(user?.preferences?.split(',') ?? []);

  const [ratedMovies, setRatedMovies] = useState<{ id: string; title: string; posterPath: string; rating: number }[]>([]);
  const navigate = useNavigate();
  const [isFileTooLarge, setIsFileTooLarge] = useState(false);
  const [watchlist, setWatchlist] = useState<{ id: string; title: string; posterPath: string; mediaType: string }[]>([]);
  const [history, setHistory] = useState<{ id: string; title: string; posterPath: string; mediaType: string }[]>([]);
  const [favouriteActors, setFavouriteActors] = useState<{ id: string; name: string; profilePath: string }[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'movie' | 'tv'>('movie');
  const [watchlistFilter, setWatchlistFilter] = useState<'movie' | 'tv'>('movie');
  const [isLoading, setIsLoading] = useState(false);

  const filteredHistory = history.filter(item => item.mediaType === historyFilter);
  const filteredWatchlist = watchlist.filter(item => item.mediaType === watchlistFilter);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false,
  });

  useEffect(() => {
    if (user?.uid) {
      const fetchUserData = async () => {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUsername(userData.username);
          setSelectedGenres(userData.preferences?.split(',') ?? []);
        }
      };

      const watchlistRef = collection(db, `users/${user.uid}/watchlist`);
      const unsubscribeWatchlist = onSnapshot(watchlistRef, (snapshot) => {
        const updatedWatchlist = snapshot.docs.map((doc) => ({
          id: doc.data().movieId,
          title: doc.data().title,
          posterPath: `${BASE_POSTER_URL}${doc.data().posterPath}`,
          mediaType: doc.data().mediaType || 'movie',
        }));
        setWatchlist(updatedWatchlist);
      });

      const ratingsRef = collection(db, `users/${user.uid}/ratings`);
      const unsubscribeRatings = onSnapshot(ratingsRef, (snapshot) => {
        const moviesMap = new Map();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (!moviesMap.has(data.title)) {
            moviesMap.set(data.title, {
              id: doc.id,
              title: data.title,
              posterPath: `${BASE_POSTER_URL}${data.posterPath}`,
              rating: data.rating,
            });
          }
        });
        setRatedMovies(Array.from(moviesMap.values()));
      });

      const historyRef = collection(db, `users/${user.uid}/history`);
      const historyQuery = query(historyRef, orderBy("watchedDate", "desc"));
      const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
        const updatedHistory = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: data.movieId.toString(),
            title: data.title || data.name || '',
            posterPath: `${BASE_POSTER_URL}${data.posterPath}`,
            mediaType: data.mediaType || 'movie',
          };
        });
        setHistory(updatedHistory);
      });

      const favouriteActorsRef = collection(db, `users/${user.uid}/favouriteActors`);
      const unsubscribeFavouriteActors = onSnapshot(favouriteActorsRef, (snapshot) => {
        const actorMap = new Map();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const id = data.actorId || data.id;
          if (id && data.name && !actorMap.has(id)) {
            actorMap.set(id, {
              id,
              name: data.name,
              profilePath: data.profile_path
                ? `${BASE_POSTER_URL}${data.profile_path}`
                : (data.profilePath ? `${BASE_POSTER_URL}${data.profilePath}` : ''),
            });
          }
        });
        setFavouriteActors(Array.from(actorMap.values()));
      });

      fetchUserData();
      return () => {
        unsubscribeWatchlist();
        unsubscribeRatings();
        unsubscribeHistory();
        unsubscribeFavouriteActors();
      };
    }
  }, [user?.uid]);

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          username,
          preferences: selectedGenres.join(','),
        },
        { merge: true }
      );

      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setUsername(userData.username);
        setSelectedGenres(userData.preferences?.split(',') ?? []);
      }

      setToast({
        message: 'Profile updated successfully!',
        type: 'success',
        isVisible: true,
      });
      setTimeout(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
      }, 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setToast({
        message: 'Error updating profile, please try again.',
        type: 'error',
        isVisible: true,
      });
      setTimeout(() => {
        setToast((prev) => ({ ...prev, isVisible: false }));
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };


  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        navigate('/login');
      })
      .catch((error) => {
        console.error('Error logging out:', error);
      });
  };

  const handleMediaClick = (id: string, mediaType: string): void => {
    navigate(`/${mediaType}/${id}`);
  };


  const RecommendationSection = ({
    watchlist,
    history,
    favouriteActors,
    selectedGenres,
    ratedMovies,
    onMediaClick,
  }: {
    watchlist: { id: string; title: string; posterPath: string; mediaType: string }[];
    history: { id: string; title: string; posterPath: string; mediaType: string }[];
    favouriteActors: { id: string; name: string; profilePath: string }[];
    selectedGenres: string[];
    ratedMovies: { id: string; title: string; posterPath: string; rating: number }[];
    onMediaClick: (id: string, mediaType: string) => void;
  }) => {
    const [trendingMovies, setTrendingMovies] = useState<
      { id: string; title: string; posterPath: string; mediaType: string; overview?: string; voteAverage?: number }[]
    >([]);
    const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const handleMediaTypeChange = (type: 'movie' | 'tv') => {
      if (type === mediaType) return;
      setMediaType(type);
      setTrendingMovies([]);
      setPage(1);
      setLoading(true);
    };

    // Refresh recommendations when page becomes visible or gains focus
    useEffect(() => {
      let isMounted = true;

      const fetchRecommendations = async () => {
        setLoading(true);

        let movieIds: string[] = [];
        let actorIds: string[] = [];
        let watchedOrWatchlistIds = new Set<string>();

        // Build exclude set from history and watchlist (already watched or in watchlist)
        history.forEach(h => {
          if (h.mediaType === mediaType) {
            watchedOrWatchlistIds.add(h.id);
          }
        });
        watchlist.forEach(w => {
          if (w.mediaType === mediaType) {
            watchedOrWatchlistIds.add(w.id);
          }
        });

        // Add highly-rated movies (7+ stars) as priority sources
        const highlyRatedMovies = ratedMovies
          .filter(m => m.rating >= 7)
          .map(m => m.id);

        // Get movie IDs from different sources with priority
        const watchlistIds = watchlist
          .filter(m => m.mediaType === mediaType)
          .map(m => m.id);

        const historyIds = history
          .filter(h => h.mediaType === mediaType)
          .map(h => h.id);

        // Deduplicate while preserving priority order (highly rated first)
        const priorityMovieIds = [...highlyRatedMovies];
        watchlistIds.forEach(id => {
          if (!priorityMovieIds.includes(id)) priorityMovieIds.push(id);
        });
        historyIds.forEach(id => {
          if (!priorityMovieIds.includes(id)) priorityMovieIds.push(id);
        });

        movieIds = priorityMovieIds;
        actorIds = favouriteActors.map((a) => a.id);

        let recommended: any[] = [];
        try {
          const genreMap: { [key: string]: number } = {
            'Action': 28,
            'Adventure': 12,
            'Animation': 16,
            'Comedy': 35,
            'Crime': 80,
            'Documentary': 99,
            'Drama': 18,
            'Family': 10751,
            'Fantasy': 14,
            'History': 36,
            'Horror': 27,
            'Music': 10402,
            'Mystery': 9648,
            'Romance': 10749,
            'Sci-Fi': 878,
            'TV Movie': 10770,
            'Thriller': 53,
            'War': 10752,
            'Western': 37,
          };

          // Also collect genres from watched/rated content for better recommendations
          const genreIdsSet = new Set<number>(
            selectedGenres
              .map(g => genreMap[g.trim()])
              .filter(id => id !== undefined)
          );

          // Fetch genres from rated movies
          if (highlyRatedMovies.length > 0) {
            const genreFetchPromises = highlyRatedMovies.slice(0, 3).map(async (movieId) => {
              try {
                const endpoint = mediaType === 'movie'
                  ? `https://api.themoviedb.org/3/movie/${movieId}`
                  : `https://api.themoviedb.org/3/tv/${movieId}`;
                const res = await axios.get(`${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
                const genres = res.data.genres || [];
                genres.forEach((g: any) => genreIdsSet.add(g.id));
                return genres;
              } catch (err) {
                return [];
              }
            });
            await Promise.all(genreFetchPromises);
          }

          const genreIds = Array.from(genreIdsSet);

          // Fetch recommendations from highly-rated movies first (highest priority)
          if (highlyRatedMovies.length > 0) {
            const MAX_MOVIE_SOURCES = Math.min(highlyRatedMovies.length, 5);
            const moviePromises = highlyRatedMovies.slice(0, MAX_MOVIE_SOURCES).map(async (movieId) => {
              try {
                const endpoint = mediaType === 'movie'
                  ? `https://api.themoviedb.org/3/movie/${movieId}/recommendations`
                  : `https://api.themoviedb.org/3/tv/${movieId}/recommendations`;
                const res = await axios.get(`${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
                return res.data.results || [];
              } catch (err) {
                console.error(`Error fetching recommendations for ${movieId}:`, err);
                return [];
              }
            });

            const results = await Promise.all(moviePromises);
            results.forEach(r => recommended.push(...r.slice(0, 12)));
          }

          // Fetch from watchlist
          if (watchlistIds.length > 0 && recommended.length < 20) {
            const watchlistPromises = watchlistIds.slice(0, 5).map(async (movieId) => {
              try {
                const endpoint = mediaType === 'movie'
                  ? `https://api.themoviedb.org/3/movie/${movieId}/recommendations`
                  : `https://api.themoviedb.org/3/tv/${movieId}/recommendations`;
                const res = await axios.get(`${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
                return res.data.results || [];
              } catch (err) {
                console.error(`Error fetching recommendations for ${movieId}:`, err);
                return [];
              }
            });

            const results = await Promise.all(watchlistPromises);
            results.forEach(r => recommended.push(...r.slice(0, 10)));
          }

          // Fetch from history
          if (historyIds.length > 0 && recommended.length < 20) {
            const historyPromises = historyIds.slice(0, 5).map(async (movieId) => {
              try {
                const endpoint = mediaType === 'movie'
                  ? `https://api.themoviedb.org/3/movie/${movieId}/recommendations`
                  : `https://api.themoviedb.org/3/tv/${movieId}/recommendations`;
                const res = await axios.get(`${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
                return res.data.results || [];
              } catch (err) {
                console.error(`Error fetching recommendations for ${movieId}:`, err);
                return [];
              }
            });

            const results = await Promise.all(historyPromises);
            results.forEach(r => recommended.push(...r.slice(0, 8)));
          }

          // Fetch from favorite actors
          if (actorIds.length > 0 && recommended.length < 20) {
            const actorPromises = actorIds.slice(0, 10).map(async (actorId) => {
              try {
                const endpoint = mediaType === 'movie'
                  ? `https://api.themoviedb.org/3/person/${actorId}/movie_credits`
                  : `https://api.themoviedb.org/3/person/${actorId}/tv_credits`;
                const res = await axios.get(`${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
                return mediaType === 'movie' ? (res.data.cast || []) : (res.data.cast || []);
              } catch (err) {
                console.error(`Error fetching credits for actor ${actorId}:`, err);
                return [];
              }
            });

            const actorResults = await Promise.all(actorPromises);
            actorResults.forEach(r => recommended.push(...r.slice(0, 10)));
          }

          // Fallback to genre-based discovery
          if (genreIds.length > 0 && recommended.length < 20) {
            const genrePromises = genreIds.slice(0, 3).map(async (genreId) => {
              try {
                const url = mediaType === 'movie'
                  ? `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&with_genres=${genreId}&sort_by=popularity.desc&page=1`
                  : `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=en-US&with_genres=${genreId}&sort_by=popularity.desc&page=1`;
                const res = await axios.get(url);
                return res.data.results || [];
              } catch (err) {
                console.error(`Error fetching genre ${genreId}:`, err);
                return [];
              }
            });

            const genreResults = await Promise.all(genrePromises);
            genreResults.forEach(r => recommended.push(...r.slice(0, 8)));
          }

          // Blend Trending + Popular to keep recommendations fresh (and avoid empty lists)
          // Trending (week)
          try {
            const trendingUrl = mediaType === 'movie'
              ? `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`
              : `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`;
            const trendingRes = await axios.get(trendingUrl);
            if (trendingRes.data?.results) {
              recommended.push(...trendingRes.data.results.slice(0, 15));
            }
          } catch (err) {
            console.error('Error fetching trending content:', err);
          }

          // Popular
          try {
            const popularUrl = mediaType === 'movie'
              ? `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`
              : `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
            const popularRes = await axios.get(popularUrl);
            if (popularRes.data?.results) {
              recommended.push(...popularRes.data.results.slice(0, 15));
            }
          } catch (err) {
            console.error('Error fetching popular content:', err);
          }

          // If still empty, final fallback to Popular (extra safety)
          if (recommended.length === 0) {
            const fallbackUrl = mediaType === 'movie'
              ? `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`
              : `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`;

            const fallbackRes = await axios.get(fallbackUrl);
            if (fallbackRes.data?.results) {
              recommended.push(...fallbackRes.data.results.slice(0, 20));
            }
          }
        } catch (err) {
          console.error('Error fetching recommendations:', err);
        }


        const unique = new Map();
        recommended.forEach((m: any) => {
          if (m.id && !unique.has(m.id)) {
            // Filter out already watched or in watchlist
            if (!watchedOrWatchlistIds.has(m.id.toString())) {
              unique.set(m.id, {
                id: m.id.toString(),
                title: m.title || m.name || "",
                posterPath: m.poster_path
                  ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
                  : "",
                mediaType: m.media_type || mediaType,
                overview: m.overview || "",
                voteAverage: m.vote_average || 0,
              });
            }
          }
        });

        const filtered = Array.from(unique.values()).filter(item => item.mediaType === mediaType);
        const sorted = filtered.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));

        if (isMounted) {
          setTrendingMovies(sorted.slice(0, 50));
          setLoading(false);
        }
      }; 


      fetchRecommendations();

      return () => {
        isMounted = false;
      };
    }, [watchlist, history, favouriteActors, selectedGenres, mediaType, page, ratedMovies]);

    // Handle visibility change to refresh recommendations when user returns to page
    // Also refresh periodically so recommendations keep updating.
    useEffect(() => {
      let intervalId: number | undefined;

      const refreshNow = () => {
        setTrendingMovies([]);
        setPage(1);
        setLoading(true);
      };

      const handleVisibilityChange = () => {
        if (!document.hidden) {
          refreshNow();
        }
      };

      const handleFocus = () => {
        refreshNow();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);

      intervalId = window.setInterval(() => {
        refreshNow();
      }, 60 * 1000);

      return () => {
        if (intervalId) window.clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      };
    }, []);



    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-zinc-700/50 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <img src="/recommendation-icon.png" alt="Recommendations" className="w-9 h-10 shadow-lg" />
            Recommendations
          </h2>
        </div>


        <div className="flex items-center justify-center mb-6">
          <div
            className="relative flex items-center bg-white/10 border border-white/20 backdrop-blur-xl rounded-full p-0.5 sm:p-1 shadow-lg min-w-[180px] w-fit mx-auto"
            style={{
              WebkitBackdropFilter: 'blur(20px)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <button
              onClick={() => handleMediaTypeChange('movie')}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 font-semibold text-xs sm:text-sm transition-all duration-300 rounded-full ${mediaType === 'movie' ? 'text-white shadow-md shadow-red-500/30' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Film className="w-3.5 h-3.5 flex-shrink-0" />
              Movies
            </button>
            <button
              onClick={() => handleMediaTypeChange('tv')}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 font-semibold text-xs sm:text-sm transition-all duration-300 rounded-full ${mediaType === 'tv' ? 'text-white shadow-md shadow-cyan-500/30' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              <Tv className="w-3.5 h-3.5 flex-shrink-0" />
              Series
            </button>
            <motion.div
              className="absolute inset-y-0.5 sm:inset-y-1 bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-lg shadow-red-500/40"
              layoutId="media-toggle"
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-zinc-600/30 border-t-zinc-400 rounded-full animate-spin mb-4" />
            <p className="text-zinc-500">Loading {mediaType === 'movie' ? 'movies' : 'series'}...</p>
          </div>
        ) : trendingMovies.length === 0 ? (
          <div className="text-center py-12">
            <Film className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-400 mb-2">No recommendations</h3>
            <p className="text-zinc-500 text-sm">Watch more to get personalized recommendations</p>
          </div>
        ) : (
          <div className="w-full">
            <div className="overflow-x-auto no-scrollbar pb-4">
              <div className="flex gap-4">
                {trendingMovies.map((movie) => (
                  <motion.div
                    key={movie.id}
                    layout
                    className="group flex-shrink-0 w-32 hover:w-36 transition-all duration-300 bg-zinc-800/50 backdrop-blur-sm border border-zinc-600/30 rounded-2xl overflow-hidden shadow-lg hover:shadow-zinc-500/20 hover:-translate-y-1 cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    onClick={() => onMediaClick(movie.id, movie.mediaType)}
                  >
                    <div className="relative aspect-[2/3]">
                      {movie.posterPath ? (
                        <img
                          src={movie.posterPath}
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-zinc-700">
                          <Film className="w-8 h-8 text-zinc-600" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1 flex items-center gap-1">
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${movie.mediaType === 'tv' ? 'text-cyan-400' : 'text-zinc-200'
                          }`}>
                          {movie.mediaType === 'tv' ? 'TV' : 'MOVIE'}
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-xs leading-tight line-clamp-2 text-white group-hover:text-zinc-200 transition-colors">
                        {movie.title}
                      </h3>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="text-center pt-4">
              <p className="text-zinc-500 text-sm">
                Showing {trendingMovies.length} {mediaType === 'movie' ? 'movies' : 'series'}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    );
  };


  return (
    <div className="profile-page bg-black text-white min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl shadow-lg">
              <Settings className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Profile</h1>
              <p className="text-gray-400 text-sm md:text-base">Manage your account and preferences</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-500/25 flex items-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            <span className=" sm:inline">Logout</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <User className="w-6 h-6 text-yellow-500" />
                Profile Information
              </h2>

              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-yellow-400 flex justify-center items-center bg-gray-700 shadow-2xl select-none overflow-hidden">
                      <span className="text-5xl md:text-6xl font-bold text-white">
                        {username ? username.charAt(0).toUpperCase() : 'U'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <span className="block text-lg md:text-xl font-semibold text-white">{username || 'Anonymous User'}</span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full bg-gray-800/60 border border-yellow-400/30 text-white p-3 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-300 shadow"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className={`w-full md:w-auto px-8 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${isLoading
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black shadow-lg shadow-yellow-500/25'
                      }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </div>
                    ) : (
                      'Update Profile'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-gradient-to-br from-zinc-900/80 via-black/80 to-black/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 md:p-8 border border-white/5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-3 text-white drop-shadow-lg tracking-tight">
                  <SquarePen className="w-6 h-6 text-violet-500" />
                  Your Reviews
                </h2>
              </div>
              <div className="w-full">

                <ReviewList userId={user?.uid} />
              </div>
            </motion.div>
            <RecommendationSection
              watchlist={watchlist}
              history={history}
              favouriteActors={favouriteActors}
              selectedGenres={selectedGenres}
              ratedMovies={ratedMovies}
              onMediaClick={handleMediaClick}
            />
          </div>
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-cyan-400 fill-current" />
                  Watchlist
                </h2>
                <Link to="/watchlist" className="text-cyan-400 hover:text-cyan-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
              {/* Movies/Series Toggle */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative flex items-center bg-zinc-800/60 backdrop-blur-sm border border-white/10 rounded-full p-0.5 shadow-lg">
                  <button
                    onClick={() => setWatchlistFilter('movie')}
                    className={`relative z-10 px-3 py-1.5 font-semibold text-xs transition-all duration-300 rounded-full ${watchlistFilter === 'movie' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setWatchlistFilter('tv')}
                    className={`relative z-10 px-3 py-1.5 font-semibold text-xs transition-all duration-300 rounded-full ${watchlistFilter === 'tv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Series
                  </button>
                  <motion.div
                    className="absolute inset-y-1 bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-full shadow-lg shadow-cyan-500/40"
                    layoutId="watchlist-toggle"
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    style={{
                      left: watchlistFilter === 'movie' ? '4px' : '50%',
                      right: watchlistFilter === 'tv' ? '4px' : '50%',
                    }}
                  />
                </div>
              </div>

              {filteredWatchlist.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">No {watchlistFilter === 'movie' ? 'movies' : 'series'} in watchlist yet</p>
              ) : (
                <div className="w-full">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-4 pb-2">
                      {[...filteredWatchlist]
                        .slice()
                        .reverse()
                        .map((movie) => (
                          <Link
                            key={movie.id}
                            to={movie.mediaType === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`}
                            className="group relative bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/5 hover:border-cyan-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-500/10 min-w-[120px] max-w-[120px]"
                          >
                            {/* Media Type Badge */}
                            <div className="absolute top-2 right-2 z-20 bg-cyan-500/80 text-white text-xs px-2 py-1 rounded-full shadow">
                              {movie.mediaType === 'tv' ? 'TV' : 'Movie'}
                            </div>

                            <div className="relative aspect-[2/3]">
                              <img
                                src={movie.posterPath}
                                alt={movie.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
                            </div>
                            <div className="p-2">
                              <h3 className="font-semibold text-xs truncate group-hover:text-cyan-400 transition-colors">
                                {movie.title}
                              </h3>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-500" />
                  History
                </h2>
                <Link to="/history" className="text-emerald-400 hover:text-emerald-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              {/* Movies/Series Toggle */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative flex items-center bg-zinc-800/60 backdrop-blur-sm border border-white/10 rounded-full p-0.5 shadow-lg">
                  <button
                    onClick={() => setHistoryFilter('movie')}
                    className={`relative z-10 px-3 py-1.5 font-semibold text-xs transition-all duration-300 rounded-full ${historyFilter === 'movie' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setHistoryFilter('tv')}
                    className={`relative z-10 px-3 py-1.5 font-semibold text-xs transition-all duration-300 rounded-full ${historyFilter === 'tv' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Series
                  </button>
                  <motion.div
                    className="absolute inset-y-1 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full shadow-lg shadow-emerald-500/40"
                    layoutId="history-toggle"
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    style={{
                      left: historyFilter === 'movie' ? '4px' : '50%',
                      right: historyFilter === 'tv' ? '4px' : '50%',
                    }}
                  />
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">No history yet</p>
              ) : (
                <div className="w-full">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-4 pb-2">
                      {filteredHistory
                        .slice(0, 10)
                        .map((movie) => (
                          <Link
                            key={movie.id}
                            to={`/${movie.mediaType || 'movie'}/${movie.id}`}
                            className="group bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/5 hover:border-emerald-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/10 min-w-[120px] max-w-[120px]"
                          >
                            <div className="relative aspect-[2/3]">
                              <img
                                src={movie.posterPath}
                                alt={movie.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
                            </div>
                            <div className="p-2">
                              <h3 className="font-semibold text-xs truncate group-hover:text-emerald-400 transition-colors">
                                {movie.title}
                              </h3>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/20 shadow-xl shadow-yellow-500/5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  Rated Movies
                </h2>
                <Link to="/top-rated" className="text-yellow-500 hover:text-yellow-400 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              {ratedMovies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-4">
                    <Star className="w-8 h-8 text-yellow-600" />
                  </div>
                  <p className="text-zinc-500 text-center">No rated movies yet</p>
                  <p className="text-zinc-600 text-xs text-center mt-1">Rate movies to see them here</p>
                </div>
              ) : (
                <div className="w-full">
                  <div className="overflow-y-auto no-scrollbar max-h-[400px]">
                    <div className="flex flex-col gap-3">
                      {ratedMovies.map((movie, index) => (
                        <div
                          key={movie.id}
                          onClick={() => handleMediaClick(movie.id, 'movie')}
                          className="group flex items-center justify-between bg-gradient-to-br from-zinc-900/80 to-black/80 backdrop-blur-xl rounded-xl p-3 border border-yellow-500/20 hover:border-yellow-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-yellow-500/20 cursor-pointer"
                        >
                          {/* Rank Badge */}
                          <div className="bg-black/70 backdrop-blur-md border border-yellow-500/30 rounded-lg px-2 py-1">
                            <span className="text-xs font-bold text-yellow-400">
                              #{index + 1}
                            </span>
                          </div>

                          <div className="flex-1 px-3">
                            <h3 className="font-semibold text-sm truncate group-hover:text-yellow-400 transition-colors">
                              {movie.title}
                            </h3>
                          </div>

                          {/* Rating Badge */}
                          <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            {movie.rating}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-white/5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3 text-white drop-shadow-lg">
                  <Heart className="w-6 h-6 text-red-500 fill-current" />
                  Favourite Actors
                </h2>
                <Link
                  to="/fav-actors"
                  className="text-red-400 hover:text-red-500 transition-colors flex items-center"
                  aria-label="Go to Favourite Actors page"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
              {favouriteActors.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">No favourite actors yet</p>
              ) : (
                <div className="w-full">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-4 pb-2">
                      {favouriteActors.map((actor, index) => (
                        <Link
                          key={actor.id}
                          to={`/actor/${actor.id}`}
                          className="group relative bg-gradient-to-br from-zinc-900/60 to-black/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-red-500/10 min-w-[100px] max-w-[100px]"
                        >
                          {/* Rank Badge */}
                          <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-1.5 py-0.5">
                            <span className="text-[10px] font-bold text-zinc-300">
                              #{index + 1}
                            </span>
                          </div>

                          {/* Heart Badge */}
                          <div className="absolute top-2 right-2 z-20 bg-gradient-to-br from-red-500 to-red-600 p-1 rounded-full shadow-lg shadow-red-500/30">
                            <Heart className="w-2.5 h-2.5 text-white fill-current" />
                          </div>

                          <div className="relative aspect-[3/4]">
                            {actor.profilePath ? (
                              <img
                                src={actor.profilePath}
                                alt={actor.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                <User className="w-8 h-8 text-zinc-500" />
                              </div>
                            )}
                            {/* Hover gradient overlay */}
                            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
                          </div>
                          <div className="p-2">
                            <h3 className="font-semibold text-xs truncate transition-colors group-hover:text-red-400">
                              {actor.name}
                            </h3>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      {toast.isVisible && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-xl shadow-lg text-white font-semibold transition-all duration-300
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}
        `}
          onAnimationEnd={() => setToast((prev) => ({ ...prev, isVisible: false }))}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;