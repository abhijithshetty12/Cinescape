import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.tsx';
import { getAuth, signOut } from 'firebase/auth';
import { db, storage } from '../firebase.ts';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import ReviewList from '../components/ReviewList.tsx';
import { User, ChevronRight, LogOut, Star, Heart, Settings, Film, Bookmark, History, SquarePen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

const BASE_POSTER_URL = 'https://image.tmdb.org/t/p/original/';
const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";

const ProfilePage = () => {
  const { user } = useContext(AuthContext);
  const [username, setUsername] = useState(user?.username ?? '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(user?.preferences?.split(',') ?? []);
  const [ratedMovies, setRatedMovies] = useState<{ id: string; title: string; posterPath: string; rating: number }[]>([]);
  const navigate = useNavigate();
  const [isFileTooLarge, setIsFileTooLarge] = useState(false);
  const [watchlist, setWatchlist] = useState<{ id: string; title: string; posterPath: string; mediaType: string }[]>([]);
  const [history, setHistory] = useState<{ id: string; title: string; posterPath: string; mediaType: string }[]>([]);
  const [favouriteActors, setFavouriteActors] = useState<{ id: string; name: string; profilePath: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleMovieClick = (id: string): void => {
    navigate(`/movie/${id}`);
  };

  const RecommendationSection = ({
    watchlist,
    history,
    favouriteActors,
    onMovieClick,
  }: {
    watchlist: { id: string; title: string; posterPath: string; mediaType: string }[];
    history: { id: string; title: string; posterPath: string; mediaType: string }[];
    favouriteActors: { id: string; name: string; profilePath: string }[];
    onMovieClick: (id: string) => void;
  }) => {
    const [recommendations, setRecommendations] = useState<
      { id: string; title: string; posterPath: string; mediaType: string }[]
    >([]);

    useEffect(() => {
      const fetchRecommendations = async () => {
        let movieIds: string[] = [];
        let actorIds: string[] = [];

        movieIds = [
          ...watchlist.map((m) => m.id),
          ...history.map((m) => m.id),
        ].filter((v, i, arr) => arr.indexOf(v) === i);

        actorIds = favouriteActors.map((a) => a.id);

        let recommended: any[] = [];
        try {
          for (const movieId of movieIds.slice(0, 1)) {
            const res = await axios.get(
              `https://api.themoviedb.org/3/movie/${movieId}/recommendations?api_key=${TMDB_API_KEY}`
            );
            if (res.data.results) {
              recommended.push(...res.data.results.slice(0, 10));
            }
          }
          for (const actorId of actorIds.slice(0, 10)) {
            const res = await axios.get(
              `https://api.themoviedb.org/3/person/${actorId}/movie_credits?api_key=${TMDB_API_KEY}`
            );
            if (res.data.cast) {
              recommended.push(...res.data.cast.slice(0, 10));
            }
          }
        } catch (err) {
          console.error('Error fetching recommendations:', err);
        }
        for (let i = recommended.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [recommended[i], recommended[j]] = [recommended[j], recommended[i]];
        }
        const unique = new Map();
        recommended.forEach((m) => {
          if (m.id && !unique.has(m.id)) {
            unique.set(m.id, {
              id: m.id.toString(),
              title: m.title || m.name || "",
              posterPath: m.poster_path
                ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
                : "",
              mediaType: "movie",
            });
          }
        });
        setRecommendations(Array.from(unique.values()));
      };

      fetchRecommendations();
    }, [watchlist, history, favouriteActors]);

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="bg-gradient-to-br from-orange-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-orange-700/50 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Film className="w-5 h-5 text-orange-500" />
            Recommendations
          </h2>
        </div>
        {recommendations.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recommendations yet</p>
        ) : (
          <div className="w-full">
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex gap-6 pb-2">
                {recommendations.map((movie) => (
                  <div
                    key={movie.id}
                    className="group bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-orange-500/20 min-w-[140px] max-w-[140px] cursor-pointer"
                    onClick={() => onMovieClick(movie.id)}
                  >
                    <div className="relative">
                      {movie.posterPath ? (
                        <img
                          src={movie.posterPath}
                          alt={movie.title}
                          className="w-full h-44 object-cover rounded-t-2xl"
                        />
                      ) : (
                        <div className="w-full h-44 flex items-center justify-center text-gray-400 bg-zinc-800">
                          <Film className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm truncate group-hover:text-yellow-400 transition-colors">
                        {movie.title}
                      </h3>
                    </div>
                  </div>
                ))}
              </div>
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
              className="bg-gradient-to-br from-blue-900/30 via-gray-900/60 to-gray-900/80 backdrop-blur-lg rounded-2xl p-4 sm:p-6 md:p-8 border border-blue-500/30 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-extrabold flex items-center gap-3 text-blue-400 drop-shadow-lg tracking-tight">
                  <SquarePen className="w-6 h-6 text-blue-500" />
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
              onMovieClick={handleMovieClick}
            />
          </div>
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl"
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
              {watchlist.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No movies in watchlist yet</p>
              ) : (
                <div className="w-full">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-6 pb-2">
                      {[...watchlist]
                        .slice()
                        .reverse()
                        .map((movie) => (
                          <Link
                            key={movie.id}
                            to={movie.mediaType === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`}
                            className="group bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-green-500/20 min-w-[140px] max-w-[140px]"
                          >
                            <div className="relative">
                              <img
                                src={movie.posterPath}
                                alt={movie.title}
                                className="w-full h-44 object-cover rounded-t-2xl"
                              />
                              <div className="absolute top-2 right-2 bg-cyan-500/80 text-white text-xs px-2 py-1 rounded-full shadow">
                                {movie.mediaType === 'tv' ? 'TV' : 'Movie'}
                              </div>
                            </div>
                            <div className="p-3">
                              <h3 className="font-semibold text-sm truncate group-hover:text-yellow-400 transition-colors">
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
              className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-green-500" />
                  History
                </h2>
                <Link to="/history" className="text-green-500 hover:text-green-400 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No history yet</p>
              ) : (
                <div className="w-full">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-6 pb-2">
                      {[...history]
                        .slice()
                        .map((movie) => (
                          <Link
                            key={movie.id}
                            to={`/${movie.mediaType || 'movie'}/${movie.id}`}
                            className="group bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-yellow-500/20 min-w-[140px] max-w-[140px]"
                          >
                            <div className="relative">
                              <img
                                src={movie.posterPath}
                                alt={movie.title}
                                className="w-full h-44 object-cover rounded-t-2xl"
                              />
                              <div className="absolute top-2 right-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded-full shadow">
                                {movie.mediaType === 'tv' ? 'TV' : 'Movie'}
                              </div>
                            </div>
                            <div className="p-3">
                              <h3 className="font-semibold text-sm truncate group-hover:text-yellow-400 transition-colors">
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
              className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Rated Movies
                </h2>
                <Link to="/top-rated" className="text-yellow-500 hover:text-yellow-400 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {ratedMovies.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No rated movies yet</p>
                ) : (
                  ratedMovies.slice(0, 5).map((movie) => (
                    <div
                      key={movie.id}
                      className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-xl hover:bg-gray-600/30 cursor-pointer transition-colors"
                      onClick={() => handleMovieClick(movie.id)}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{movie.title}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span className="text-yellow-400 text-xs">{movie.rating}/10</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3 text-white drop-shadow-lg">
                  <Heart className="w-6 h-6 text-pink-500" />
                  Favourite Actors
                </h2>
                <Link
                  to="/fav-actors"
                  className="text-pink-400 hover:text-pink-500 transition-colors flex items-center"
                  aria-label="Go to Favourite Actors page"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
              {favouriteActors.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No favourite actors yet</p>
              ) : (
                <div className="w-full">
                  <div className="overflow-x-auto no-scrollbar">
                    <div className="flex gap-6 pb-2">
                      {favouriteActors.map((actor) => (
                        <Link
                          key={actor.id}
                          to={`/actor/${actor.id}`}
                          className="group bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-pink-500/20 min-w-[120px] max-w-[120px]"
                        >
                          <div className="relative">
                            {actor.profilePath ? (
                              <img
                                src={actor.profilePath}
                                alt={actor.name}
                                className="w-full h-32 object-cover rounded-t-2xl"
                              />
                            ) : (
                              <div className="w-full h-32 flex items-center justify-center text-gray-400 bg-zinc-800">
                                <User className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-semibold text-sm truncate transition-colors">
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