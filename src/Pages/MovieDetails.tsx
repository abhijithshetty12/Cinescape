import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, Clock, Play, Heart, Globe, DollarSign, Bookmark, ThumbsDown, ThumbsUp, ChevronLeft, ChevronRight, BookmarkCheck, TvMinimalPlay, ImageOff, Eye, EyeOff, Check, Plus, Loader2 } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/swiper-bundle.css';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, onSnapshot, query, orderBy, setDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import { useWatchedStatus, WatchedItemData } from './History.tsx';
import { motion } from 'framer-motion';

interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  language: string;
  director: string;
  boxOffice: string;
  release_date: string;
  genres: { id: number; name: string }[];
  runtime: number;
  vote_average: number;
  poster_path: string;
  cast: { id: number; name: string; role: string; profile_path: string }[] | null;
  reviews: { id: string; author: string; content: string; likes?: number; dislikes?: number }[];
  trailers: any;
  images: { backdrops: { file_path: string }[] };
  streamingLinks: any;
}

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';

const MovieDetails = () => {
  const { id } = useParams<{ id: string }>();
  const movieId = id;
  const { user } = useAuth();
  const [userReview, setUserReview] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [movieReviews, setMovieReviews] = useState<{ author: string; content: string; likes?: number; dislikes?: number }[]>([]);
  const [movieDetails, setMovieDetails] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState('mostHelpful');
  const [movieImages, setMovieImages] = useState<{ file_path: string }[]>([]);
  const [isInWatchlist, setIsInWatchlist] = useState<boolean>(false);
  const [isWatched, setIsWatched] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false,
  });

  const [movieParts, setMovieParts] = useState<any[]>([]);
  const [collectionName, setCollectionName] = useState<string | null>(null);

  const [crew, setCrew] = useState<any[]>([]);

  const movieTitle = movieDetails?.title ?? 'Unknown Movie';
  const movieOverview = movieDetails?.overview ?? 'No overview available.';
  const movieRating = movieDetails?.vote_average?.toFixed(1) ?? 'N/A';
  const movieRuntime = movieDetails?.runtime ?? 0;
  const movieReleaseDate = movieDetails?.release_date ?? 'Unknown';
  const movieDirector = movieDetails?.director ?? 'Unknown Director';

  const languageMap: Record<string, string> = {
    en: 'English', kn: 'Kannada', te: 'Telugu', hi: 'Hindi', ta: 'Tamil', ml: 'Malayalam',
    ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ar: 'Arabic', it: 'Italian',
    pt: 'Portuguese', sv: 'Swedish', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', vi: 'Vietnamese', id: 'Indonesian', fa: 'Persian', ur: 'Urdu',
    bg: 'Bulgarian', cs: 'Czech', da: 'Danish', el: 'Greek', et: 'Estonian', fi: 'Finnish', hu: 'Hungarian', is: 'Icelandic', lt: 'Lithuanian',
    lv: 'Latvian', mk: 'Macedonian', no: 'Norwegian', sr: 'Serbian', sk: 'Slovak', sl: 'Slovenian', th: 'Thai', uk: 'Ukrainian', he: 'Hebrew', ro: 'Romanian',
    nb: 'Norwegian Bokmål', ca: 'Catalan', hr: 'Croatian', eu: 'Basque', gl: 'Galician', af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', hy: 'Armenian', az: 'Azerbaijani',
    be: 'Belarusian', bn: 'Bengali', bs: 'Bosnian', ceb: 'Cebuano', co: 'Corsican', cy: 'Welsh', eo: 'Esperanto', fj: 'Fijian', fo: 'Faroese', fy: 'Frisian', ga: 'Irish',
    gd: 'Scots Gaelic', gu: 'Gujarati', ha: 'Hausa', haw: 'Hawaiian', hmn: 'Hmong'
  };

  const movieLanguage =
    languageMap[movieDetails?.language ?? ''] || movieDetails?.language || 'Unknown'; const movieBoxOffice = movieDetails?.boxOffice ? `$${Number(movieDetails.boxOffice).toLocaleString()}` : 'N/A';
  const posterImageUrl = `https://image.tmdb.org/t/p/original/${movieDetails?.poster_path ?? ''}`;
  const posterThumbnailUrl = `https://image.tmdb.org/t/p/w500/${movieDetails?.poster_path ?? ''}`;
  const embedUrl = `https://www.vidking.net/embed/movie/${movieId}?color=e50914&nextEpisode=true&episodeSelector=true`;

  const WatchedButtonInline = () => {
    const movieData: WatchedItemData = {
      movieId: movieDetails?.id!,
      title: movieDetails?.title,
      posterPath: movieDetails?.poster_path!,
      releaseDate: movieDetails?.release_date,
      genres: movieDetails?.genres?.map((g) => g.name) ?? [],
      mediaType: 'movie',
    };

    const { isWatched, loading: watchedLoading, toggleWatched } = useWatchedStatus(movieData.movieId, movieData.mediaType);
    const [showWatchedToast, setShowWatchedToast] = useState(false);
    const [watchedToastMessage, setWatchedToastMessage] = useState('');

    const handleClick = async () => {
      const result = await toggleWatched(movieData);

      if (result.success) {
        const message = isWatched
          ? `Removed ${movieData.title ?? movieData.name} from history`
          : `Saved ${movieData.title ?? movieData.name} to history`;
        setWatchedToastMessage(message);
        setShowWatchedToast(true);
      }
    };

    return (
      <>
        <button
          onClick={handleClick}
          disabled={watchedLoading}
          className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] shadow-lg ${isWatched
            ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-green-500/25'
            : 'bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500 text-gray-300 hover:text-white shadow-zinc-500/25'
            } ${watchedLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {watchedLoading ? (
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
          ) : isWatched ? (
            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
          <span className="hidden xs:inline sm:inline">
            {watchedLoading ? 'Loading...' : isWatched ? 'Watched' : 'Mark as Watched'}
          </span>
          <span className="xs:hidden sm:hidden">
            {watchedLoading ? '...' : isWatched ? 'Watched' : 'Mark as Watch'}
          </span>
        </button>

        <Toast
          message={watchedToastMessage}
          type="success"
          isVisible={showWatchedToast}
          onClose={() => setShowWatchedToast(false)}
        />
      </>
    );
  };

  const fetchMovieImages = async (movieId: number) => {
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}/images`, {
        params: {
          api_key: API_KEY,
        },
      });
      setMovieImages(response.data.backdrops);
    } catch (error) {
      console.error('Error fetching movie images:', error);
    }
  };

  useEffect(() => {
    if (movieDetails?.id) {
      fetchMovieImages(movieDetails.id);
    }
  }, [movieDetails?.id]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const API_URL = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&append_to_response=credits,reviews,videos,images,watch/providers`;
        const response = await axios.get(API_URL);
        const movieData = response.data;
        const director = movieData.credits?.crew?.find((member: any) => member.job === 'Director')?.name ?? 'Unknown Director';
        const streamingLinks = movieData['watch/providers']?.results?.US?.flatrate ?? [];

        // Extract crew
        setCrew(movieData.credits?.crew ?? []);

        let allReviews: any[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const reviewsRes = await axios.get(
            `https://api.themoviedb.org/3/movie/${movieId}/reviews?api_key=${API_KEY}&page=${page}`
          );
          allReviews = allReviews.concat(reviewsRes.data.results);
          totalPages = reviewsRes.data.total_pages;
          page++;
        } while (page <= totalPages);

        setMovieDetails({
          id: movieData.id,
          title: movieData.title,
          language: movieData.original_language,
          director: director,
          boxOffice: movieData.revenue,
          overview: movieData.overview,
          release_date: movieData.release_date,
          genres: movieData.genres,
          runtime: movieData.runtime,
          poster_path: movieData.poster_path,
          vote_average: movieData.vote_average,
          cast: movieData.credits?.cast?.map((member: any) => ({
            id: member.id,
            name: member.name,
            role: member.character,
            profile_path: member.profile_path,
          })) ?? null,
          reviews: allReviews.map((review: any) => ({
            id: review.id,
            author: review.author,
            content: review.content,
          })),
          trailers: movieData.videos?.results ?? [],
          images: movieData.images?.backdrops ?? [],
          streamingLinks: streamingLinks,
        });

        if (movieData.belongs_to_collection && movieData.belongs_to_collection.id) {
          setCollectionName(movieData.belongs_to_collection.name);
          const collectionRes = await axios.get(
            `https://api.themoviedb.org/3/collection/${movieData.belongs_to_collection.id}?api_key=${API_KEY}`
          );
          setMovieParts(collectionRes.data.parts.filter((part: any) => part.release_date && new Date(part.release_date) <= new Date()));
        } else {
          setCollectionName(null);
          setMovieParts([]);
        }
      } catch (err) {
        setError('Failed to fetch movie details');
      } finally {
        setLoading(false);
      }
    };
    fetchMovieDetails();
  }, [movieId]);

  useEffect(() => {
    const checkWatchlistStatus = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user && movieDetails?.id) {
        const userId = user.uid;
        const watchlistCollectionRef = collection(db, 'users', userId, 'watchlist');

        try {
          const querySnapshot = await getDocs(query(watchlistCollectionRef, where('movieId', '==', movieDetails.id)));
          setIsInWatchlist(querySnapshot.docs.length > 0);
        } catch (error) {
          console.error('Error checking watchlist status: ', error);
        }
      }
    };

    const checkWatchedStatus = async () => {
      const auth = getAuth();
      const user = auth.currentUser;

      if (user && movieDetails?.id) {
        const userId = user.uid;
        const watchedCollectionRef = collection(db, 'users', userId, 'watched');

        try {
          const querySnapshot = await getDocs(query(watchedCollectionRef, where('movieId', '==', movieDetails.id)));
          setIsWatched(querySnapshot.docs.length > 0);
        } catch (error) {
          console.error('Error checking watched status: ', error);
        }
      }
    };

    checkWatchlistStatus();
    checkWatchedStatus();
  }, [movieDetails?.id]);

  const handleUpvote = (index: number) => {
    setMovieDetails((prev) =>
      prev
        ? {
          ...prev,
          reviews: prev.reviews.map((review, idx) =>
            idx === index ? { ...review, likes: (review.likes ?? 0) + 1 } : review
          ),
        }
        : null
    );
  };

  const handleDownvote = (index: number) => {
    setMovieDetails((prev) =>
      prev
        ? {
          ...prev,
          reviews: prev.reviews.map((review, idx) =>
            idx === index ? { ...review, dislikes: (review.dislikes ?? 0) + 1 } : review
          ),
        }
        : null
    );
  };

  const handleWatchlistToggle = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      const userId = user.uid;
      const watchlistCollectionRef = collection(db, 'users', userId, 'watchlist');

      try {
        const querySnapshot = await getDocs(query(watchlistCollectionRef, where('movieId', '==', movieDetails?.id)));
        if (querySnapshot.docs.length > 0) {
          const docToDelete = querySnapshot.docs[0];
          await deleteDoc(docToDelete.ref);
          setIsInWatchlist(false);
          setToast({
            message: 'Movie removed from watchlist!',
            type: 'info',
            isVisible: true,
          });
        } else {
          await addDoc(watchlistCollectionRef, {
            movieId: movieDetails?.id,
            title: movieDetails?.title,
            releaseDate: movieDetails?.release_date,
            genres: movieDetails?.genres?.map((genre) => genre.name),
            posterPath: movieDetails?.poster_path,
          });
          setIsInWatchlist(true);
          setToast({
            message: 'Movie added to watchlist!',
            type: 'success',
            isVisible: true,
          });
        }
      } catch (error) {
        console.error('Error toggling watchlist: ', error);
        setToast({
          message: 'Failed to update watchlist',
          type: 'error',
          isVisible: true,
        });
      }
    } else {
      setToast({
        message: 'Please log in to add to watchlist',
        type: 'error',
        isVisible: true,
      });
    }
  };

  const handleRatingSubmit = async () => {
    if (!user) {
      setToast({
        message: 'Please log in to rate this movie',
        type: 'error',
        isVisible: true,
      });
      return;
    }
    if (userRating === null || userRating < 0 || userRating > 10) {
      setToast({
        message: 'Rating must be between 0 and 10',
        type: 'error',
        isVisible: true,
      });
      return;
    }

    try {
      const userId = user.uid;
      if (!movieId) {
        throw new Error('Movie ID is undefined');
      }
      const ratingDocRef = doc(db, `users/${userId}/ratings`, movieId);
      await setDoc(ratingDocRef, {
        movieId: movieDetails?.id,
        title: movieDetails?.title,
        rating: userRating,
        timestamp: new Date(),
      });
      setToast({
        message: 'Rating submitted!',
        type: 'success',
        isVisible: true,
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      setToast({
        message: 'Failed to submit rating',
        type: 'error',
        isVisible: true,
      });
    }
  };

  const handleReviewSubmit = async () => {
    if (!user) {
      setToast({
        message: 'Please log in to submit a review',
        type: 'error',
        isVisible: true,
      });
      return;
    }

    if (!userReview.trim()) {
      setToast({
        message: 'Review cannot be empty',
        type: 'error',
        isVisible: true,
      });
      return;
    }

    try {
      const userId = user.uid;
      const reviewsRef = collection(db, 'users', userId, 'reviews');
      await addDoc(reviewsRef, {
        author: user.displayName ?? 'Anonymous',
        content: userReview,
        title: movieDetails?.title,
        timestamp: new Date(),
      });

      setUserReview('');
      setToast({
        message: 'Review submitted!',
        type: 'success',
        isVisible: true,
      });
    } catch (error) {
      console.error('Error submitting review: ', error);
      setToast({
        message: 'Failed to submit review',
        type: 'error',
        isVisible: true,
      });
    }
  };

  const getRatingDescription = (rating: number) => {
    if (rating === 0.5 || rating === 1) return 'Weak sauce :(';
    if (rating === 1.5 || rating === 2) return 'Terrible';
    if (rating === 2.5 || rating === 3) return 'Bad';
    if (rating === 3.5 || rating === 4) return 'Poor';
    if (rating === 4.5 || rating === 5) return 'Meh';
    if (rating === 5.5 || rating === 6) return 'Fair';
    if (rating === 6.5 || rating === 7) return 'Good';
    if (rating === 7.5 || rating === 8) return 'Great';
    if (rating === 8.5 || rating === 9) return 'Superb';
    if (rating === 9.5) return 'Perfect';
    if (rating === 10) return 'Masterpiece!';
    return '';
  };

  if (loading) return <Loading />;
  if (error) return <p className="text-center text-red-500">{error}</p>;

  return (
    <div className="bg-black text-white min-h-screen">
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      <div className="relative h-[60vh] md:h-[75vh] flex items-end">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              window.innerWidth >= 768
                ? movieImages && movieImages.length > 0
                  ? `url(https://image.tmdb.org/t/p/original/${movieImages[Math.floor(Math.random() * movieImages.length)].file_path})`
                  : `url(${posterImageUrl})`
                : `url(${posterImageUrl})`,
            filter: window.innerWidth >= 768 ? 'blur(2px) brightness(0.7)' : 'none'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/60" />


        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 md:px-8 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-10 bg-white/10 backdrop-blur-xl rounded-3xl border-2 border-transparent bg-clip-padding shadow-2xl p-3 xs:p-4 md:p-10"
            style={{
              boxShadow: '0 8px 32px 0 rgba(0,0,0,0.45)'
            }}
          >
            <div className="hidden md:block">
              <div className="flex-shrink-0 flex items-center justify-center w-auto md:-mt-32 md:w-auto md:mr-6 mb-3 md:mb-0">
                {movieDetails?.poster_path ? (
                  <motion.img
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    src={posterThumbnailUrl}
                    alt={movieTitle}
                    className="w-20 h-28 xs:w-24 xs:h-32 sm:w-28 sm:h-40 md:w-48 md:h-72 lg:w-56 lg:h-80 object-cover rounded-2xl shadow-2xl border-4 border-white/30"
                    style={{ boxShadow: '0 6px 32px 0 rgba(0,0,0,0.55)' }}
                  />
                ) : (
                  <div className="w-20 h-28 xs:w-24 xs:h-32 sm:w-28 sm:h-40 md:w-48 md:h-72 lg:w-56 lg:h-80 bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center text-gray-400 rounded-2xl shadow-2xl border-4 border-white/30">
                    <ImageOff className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 mb-2 md:mb-3 opacity-60" />
                    <span className="text-xs sm:text-sm text-center px-2 md:px-4">No Image Available</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-end w-full">
              <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 sm:gap-3 mb-2 xs:mb-4">
                <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full border border-white/20 shadow">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-white font-bold text-sm">{movieRating}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full border border-white/20 shadow">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-300 text-sm">{movieRuntime} min</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/70 px-3 py-1.5 rounded-full border border-white/20 shadow">
                  <Calendar className="w-4 h-4 text-green-400" />
                  <span className="text-gray-200 text-sm">{movieReleaseDate}</span>
                </div>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-3 md:mb-5 leading-tight drop-shadow-lg"
              >
                {movieTitle}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-2 mb-5"
              >
                {movieDetails?.genres?.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 bg-zinc-900/80 rounded-full text-xs sm:text-sm border border-zinc-700/50 shadow"
                  >
                    {genre.name}
                  </span>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4"
              >
                <WatchedButtonInline />
                <button
                  onClick={handleWatchlistToggle}
                  className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] shadow-lg ${isInWatchlist
                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-green-500/25'
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-blue-500/25'
                    }`}
                >
                  {isInWatchlist ? (
                    <BookmarkCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span className="hidden xs:inline sm:inline">
                    {isInWatchlist ? 'Saved to Watchlist' : 'Add to Watchlist'}
                  </span>
                  <span className="xs:hidden sm:hidden">
                    {isInWatchlist ? 'Saved to Watchlist' : 'Add to Watchlist'}
                  </span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
      >
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Synopsis</h2>
        <p className="text-base md:text-lg text-gray-300 leading-relaxed">{movieOverview}</p>
      </motion.section>

      <div className="container mx-auto px-4 py-8 space-y-8 md:space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <TvMinimalPlay className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
            <h2 className="text-xl md:text-2xl font-bold">Watch Now</h2>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-2xl border-4 border-zinc-900/80">
            <div className="w-full" style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="fullscreen; picture-in-picture; autoplay; orientation-lock"
                title="Movie Embed"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                  borderRadius: "1rem",
                  background: "#000"
                }}
                ref={el => {
                  if (el && typeof window !== "undefined") {
                    const handleFs = () => {
                      const orientation: any =
                        (window.screen as any).orientation ||
                        (window.screen as any).mozOrientation ||
                        (window.screen as any).msOrientation;
                      if (
                        document.fullscreenElement &&
                        orientation &&
                        typeof orientation.lock === "function"
                      ) {
                        orientation.lock("landscape").catch(() => { });
                      }
                    };
                    document.removeEventListener("fullscreenchange", handleFs);
                    document.addEventListener("fullscreenchange", handleFs);
                  }
                }}
              ></iframe>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="lg:col-span-1"
          >
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 shadow-xl">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                Movie Info
              </h3>
              <dl className="space-y-4">
                <div className="border-b border-gray-700/30 pb-3">
                  <dt className="text-gray-400 text-sm font-medium mb-1">Language</dt>
                  <dd className="text-white font-medium">{movieLanguage}</dd>
                </div>
                <div className="border-b border-gray-700/30 pb-3">
                  <dt className="text-gray-400 text-sm font-medium mb-1">Box Office</dt>
                  <dd className="flex items-center gap-2 text-white font-medium">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    {movieBoxOffice}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-sm font-medium mb-1">Director</dt>
                  <dd className="text-white font-medium">{movieDirector}</dd>
                </div>
              </dl>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="lg:col-span-2"
          >
            <div className="hidden md:block">
              <Swiper
                spaceBetween={16}
                slidesPerView={2}
                breakpoints={{
                  768: { slidesPerView: 2 },
                  1024: { slidesPerView: 3 },
                }}
                className="rounded-2xl overflow-hidden"
              >
                {movieDetails?.trailers && movieDetails.trailers.length > 0 && (
                  <SwiperSlide>
                    <div className="aspect-video rounded-xl overflow-hidden">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${movieDetails.trailers[0].key}`}
                        title="Movie Trailer"
                        frameBorder="0"
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </SwiperSlide>
                )}
                {movieImages.map((image) => (
                  <SwiperSlide key={image.file_path}>
                    <div className="aspect-video rounded-xl overflow-hidden">
                      <img
                        src={`https://image.tmdb.org/t/p/w500${image.file_path}`}
                        alt="Movie backdrop"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </motion.div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-200">Cast</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 md:gap-6 pb-4">
              {movieDetails?.cast?.map((actor) => (
                <Link key={actor.id} to={`/actor/${actor.id}`} className="flex-shrink-0">
                  <div className="bg-gradient-to-b from-gray-700/50 to-gray-800/50 hover:from-gray-600/50 hover:to-gray-700/50 transition-all duration-300 rounded-xl shadow-lg overflow-hidden group w-32 sm:w-40 border border-gray-600/30">
                    {actor.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${actor.profile_path}`}
                        alt={actor.name}
                        className="w-full h-40 sm:h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-40 sm:h-48 bg-zinc-800 flex flex-col items-center justify-center text-gray-400">
                        <ImageOff className="w-8 h-8 sm:w-12 sm:h-12 mb-2" />
                        <span className="text-xs text-center px-2">No Image</span>
                      </div>
                    )}
                    <div className="p-3 sm:p-4 text-center">
                      <h3 className="font-bold text-xs sm:text-sm text-gray-200 group-hover:text-yellow-400 transition-colors duration-300 mb-1 line-clamp-2">
                        {actor.name}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2">{actor.role}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.02 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-200">Crew</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 md:gap-6 pb-4">
              {(() => {
                const grouped: Record<string, any> = {};
                crew.forEach((member) => {
                  if (!grouped[member.id]) {
                    grouped[member.id] = {
                      ...member,
                      jobs: [member.job],
                    };
                  } else if (!grouped[member.id].jobs.includes(member.job)) {
                    grouped[member.id].jobs.push(member.job);
                  }
                });

                const crewArr = Object.values(grouped);

                const jobPriority = (jobs: string[]) => {
                  if (jobs.includes('Director')) return 1;
                  if (jobs.some(j => ['Writer', 'Screenplay', 'Story'].includes(j))) return 2;
                  if (jobs.includes('Producer')) return 3;
                  return 4;
                };

                crewArr.sort((a: any, b: any) => {
                  const aPriority = jobPriority(a.jobs);
                  const bPriority = jobPriority(b.jobs);
                  if (aPriority !== bPriority) return aPriority - bPriority;
                  return a.name.localeCompare(b.name);
                });

                return crewArr.map((member: any) => (
                  <Link
                    key={member.credit_id}
                    to={`/actor/${member.id}`}
                    className="flex-shrink-0"
                  >
                    <div className="bg-gradient-to-b from-gray-700/50 to-gray-800/50 hover:from-gray-600/50 hover:to-gray-700/50 transition-all duration-300 rounded-xl shadow-lg overflow-hidden group w-32 sm:w-40 border border-gray-600/30">
                      {member.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500${member.profile_path}`}
                          alt={member.name}
                          className="w-full h-40 sm:h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-40 sm:h-48 bg-zinc-800 flex flex-col items-center justify-center text-gray-400">
                          <ImageOff className="w-8 h-8 sm:w-12 sm:h-12 mb-2" />
                          <span className="text-xs text-center px-2">No Image</span>
                        </div>
                      )}
                      <div className="p-3 sm:p-4 text-center">
                        <h3 className="font-bold text-xs sm:text-sm text-gray-200 group-hover:text-yellow-400 transition-colors duration-300 mb-1 line-clamp-2">
                          {member.name}
                        </h3>
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {member.jobs.join(', ')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ));
              })()}
            </div>
          </div>
        </motion.section>

        {movieParts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.05 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-2xl relative overflow-hidden"
        >
            {/* Gradient overlays for peek effect */}
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/60 to-transparent pointer-events-none z-10 md:hidden" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/60 to-transparent pointer-events-none z-10 md:hidden" />

            <div className="flex items-center gap-4 mb-8 relative z-20">
              <div className="w-3 h-10 bg-gradient-to-b from-yellow-400 to-orange-700 rounded-full shadow-lg" />
              <div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
                  {collectionName ? `Part of ${collectionName}` : 'Movie Parts'}
                </h2>
                <span className="text-sm md:text-base text-gray-400 font-medium block mt-1">
                  {movieParts.length} {movieParts.length === 1 ? 'part' : 'parts'} available
                </span>
              </div>
            </div>

            <div className="relative">
                <div className="flex gap-3 md:gap-4 pb-3 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-600/50 scrollbar-track-gray-900/50 scrollbar-thumb-rounded overflow-x-auto scroll-smooth -mr-4 md:-mr-6 pr-4 md:pr-6">
                {movieParts
                  .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
                  .map((part, index) => (
                      <Link
                      key={part.id}
                      to={`/movie/${part.id}`}
                      className="flex-shrink-0 snap-center w-32 md:w-40 lg:w-44 h-44 md:h-56 lg:h-64 group"
                      tabIndex={0}
                      aria-label={`View ${part.title}`}
                    >
                      <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 bg-gradient-to-b from-zinc-900/50 to-black/30 backdrop-blur-sm transition-all duration-500 group-hover:border-white/30 group-hover:shadow-3xl group-hover:scale-[1.02] group-focus:outline-none group-focus:ring-4 group-focus:ring-blue-500/30">
                        {/* Poster */}
                        {part.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w500${part.poster_path}`}
                            alt={part.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-800">
                            <ImageOff className="w-12 h-12 text-gray-500" />
                          </div>
                        )}

                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                          <div className="flex items-center gap-2 mb-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            <Play className="w-6 h-6 text-white/90" />
                            <span className="text-white font-bold text-xs md:text-sm">Watch Now</span>
                          </div>
                        </div>

                        {/* Year & Rating Badge */}
                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                          <span className="bg-gradient-to-r from-gray-800/90 to-black/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full border border-white/20 shadow-lg">
                            {part.release_date?.slice(0, 4) || 'TBA'}
                          </span>
                          {part.vote_average && (
                            <span className="bg-gradient-to-r from-yellow-500/90 to-yellow-400/90 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              {part.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 px-1.5 text-center">
                        <h3 className="text-white font-bold text-xs leading-tight line-clamp-2 drop-shadow-lg">
                          {part.title}
                        </h3>
                      </div>
                    </Link>
                  ))}
              </div>

              {/* Navigation Arrows - Mobile only */}
              <div className="md:hidden absolute inset-y-0 left-0 w-12 flex items-center justify-center z-20 pointer-events-none">
                <button className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-3 rounded-full shadow-xl transition-all duration-200 hover:scale-110 pointer-events-auto opacity-0 group-hover:opacity-100" aria-label="Previous part">
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>
              <div className="md:hidden absolute inset-y-0 right-0 w-12 flex items-center justify-center z-20 pointer-events-none">
                <button className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-3 rounded-full shadow-xl transition-all duration-200 hover:scale-110 pointer-events-auto opacity-0 group-hover:opacity-100" aria-label="Next part">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Swipe hint */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-sm md:hidden"
            >
              <span>Swipe to explore</span>
              <div className="w-6 h-6 border-2 border-gray-500 rounded-full flex items-center justify-center animate-pulse">
                <span className="w-3 h-3 bg-gradient-to-r from-gray-500 to-white rounded-full" />
              </div>
            </motion.div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6 border-b border-gray-600/30 pb-4">
            Your Rating
          </h2>
          {user ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-black/20 rounded-xl">
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-0 items-center justify-center">
                    {[0, 1].map((row) => (
                      <div
                        key={row}
                        className="flex items-center justify-center gap-1 sm:gap-1"
                      >
                        {[...Array(5)].map((_, col) => {
                          const index = row * 5 + col;
                          const currentRating = userRating ?? 0;
                          const starValue = index + 1;
                          const isFull = currentRating >= starValue;
                          const isHalf = currentRating === starValue - 0.5;

                          return (
                            <div key={index} className="relative inline-block w-8 h-8 sm:w-10 sm:h-10">
                              <button
                                onClick={() => setUserRating(starValue - 0.5)}
                                className="absolute left-0 top-0 w-1/2 h-full z-20 hover:scale-110 transition-transform"
                                aria-label={`Rate ${starValue - 0.5} stars`}
                              />
                              <button
                                onClick={() => setUserRating(starValue)}
                                className="absolute right-0 top-0 w-1/2 h-full z-20 hover:scale-110 transition-transform"
                                aria-label={`Rate ${starValue} stars`}
                              />
                              <div className="absolute inset-0 pointer-events-none">
                                {isFull ? (
                                  <Star className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
                                ) : isHalf ? (
                                  <>
                                    <Star className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500 fill-none" />
                                    <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                                      <Star className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400 fill-yellow-400 drop-shadow-lg" />
                                    </div>
                                  </>
                                ) : (
                                  <Star className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500 fill-none hover:text-gray-400 transition-colors" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                {userRating && (
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-white font-bold text-lg">{userRating} stars</span>
                    </div>
                    <span className="inline-block px-4 py-2 bg-yellow-500/20 text-yellow-400 font-semibold rounded-full border border-yellow-500/30">
                      {getRatingDescription(userRating)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleRatingSubmit}
                  className="bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 text-black py-3 px-8 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
                >
                  Submit Rating
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-lg">
                Log in to rate this movie.
              </p>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6 border-b border-gray-600/30 pb-4">
            Your Review
          </h2>

          {user ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <textarea
                  className="w-full bg-gray-700/50 backdrop-blur-sm text-white p-4 rounded-xl border border-gray-600/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                  rows={6}
                  placeholder="Share your thoughts about this movie..."
                  value={userReview}
                  onChange={(e) => setUserReview(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleReviewSubmit}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95"
                  >
                    Submit Review
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-lg">
                Log in to write a review.
              </p>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.3 }}
          className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl md:text-2xl font-bold">User Reviews</h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Sort by:</span>
              <div className="flex items-center gap-2">
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortOption === 'mostHelpful'
                    ? 'bg-yellow-500 text-black shadow-lg'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white'
                    }`}
                  onClick={() => setSortOption('mostHelpful')}
                >
                  Most Helpful
                </button>
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortOption === 'mostRecent'
                    ? 'bg-yellow-500 text-black shadow-lg'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white'
                    }`}
                  onClick={() => setSortOption('mostRecent')}
                >
                  Most Recent
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {movieDetails && Array.isArray(movieDetails.reviews) && movieDetails.reviews.length > 0 ? (
              movieDetails.reviews.map((review, index) => (
                <div
                  key={review.id}
                  className="bg-gradient-to-br from-gray-700/30 to-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-600/30"
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-bold text-lg text-white">{review.author}</h3>
                  </div>
                  <p className="text-gray-300 leading-relaxed mb-4 line-clamp-4">
                    {review.content}
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleUpvote(index)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-all hover:scale-105"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-sm font-medium">{review.likes ?? 0}</span>
                    </button>
                    <button
                      onClick={() => handleDownvote(index)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all hover:scale-105"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span className="text-sm font-medium">{review.dislikes ?? 0}</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No reviews yet. Be the first to review!</p>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default MovieDetails;