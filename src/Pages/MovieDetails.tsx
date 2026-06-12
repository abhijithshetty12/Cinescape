import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, Clock, Play, Heart, Globe, DollarSign, Bookmark, ThumbsDown, ThumbsUp, ChevronLeft, ChevronRight, BookmarkCheck, TvMinimalPlay, ImageOff, Eye, EyeOff, Check, Plus, Loader2, Users, Award, MessageCircle, MoreHorizontal } from 'lucide-react';
import { FaFilm } from 'react-icons/fa';
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
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import confetti from 'canvas-confetti';
import { enqueueWatchlistOp, registerWatchlistSync } from '../utils/watchlistQueue.ts';


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

const SpatialMediaCard = ({ children, containerRef, index }: { children: React.ReactNode, containerRef: React.RefObject<HTMLDivElement>, index: number }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const { scrollXProgress } = useScroll({
    container: containerRef,
    target: itemRef,
    axis: "x",
    offset: ["start end", "end start"]
  });

  const x = useTransform(scrollXProgress, [0, 1], [20, -20]);

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
      className="flex-shrink-0"
    >
      <div className="relative overflow-hidden rounded-2xl group">
        <motion.div style={{ x }} className="w-full h-full">
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
};

const MovieDetails = () => {
  const castContainerRef = useRef<HTMLDivElement>(null);
  const crewContainerRef = useRef<HTMLDivElement>(null);
  const moviePartsContainerRef = useRef<HTMLDivElement>(null);
  const { id } = useParams<{ id: string }>();
  const movieId = id;
  const { user } = useAuth();
  const [userReview, setUserReview] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);

  const handleRateMovie = (rating: number) => {
    setUserRating(rating);
    if (rating >= 4) {
      // Star/Gold confetti for high ratings
      const count = 100;
      const defaults = {
        origin: { y: 0.7 },
        colors: ['#facc15', '#eab308', '#ca8a04', '#ffffff'],
        ticks: 150,
      };

      const fire = (particleRatio: number, opts: any) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
          shapes: ['circle'],
        });
      };

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    }
  };

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
  const posterThumbnailUrl = `https://image.tmdb.org/t/p/w780/${movieDetails?.poster_path ?? ''}`;
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
        if (!isWatched) {
          // Green celebratory burst for marking as watched
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.8 },
            colors: ['#10b981', '#34d399', '#6ee7b7', '#059669'],
            ticks: 200,
            gravity: 1.2,
            scalar: 1.2,
          });
        }
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

    if (!user) {
      setToast({
        message: 'Please log in to add to watchlist',
        type: 'error',
        isVisible: true,
      });
      return;
    }

    // Offline-first behavior: enqueue and optimistic UI.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const userId = user.uid;
        const movieId = movieDetails?.id;
        if (!movieId) return;

        const willBeSaved = !isInWatchlist;
        setIsInWatchlist(willBeSaved);

        await enqueueWatchlistOp({
          type: willBeSaved ? 'watchlist_add' : 'watchlist_remove',
          userId,
          movieId,
          title: movieDetails?.title,
          releaseDate: movieDetails?.release_date,
          genres: movieDetails?.genres?.map((genre) => genre.name),
          posterPath: movieDetails?.poster_path,
          mediaType: 'movie',
        });

        // Request a background sync when supported; otherwise we rely on 'online' flush.
        await registerWatchlistSync();

        // Notify SW/client to attempt flushing when possible.
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.active?.postMessage({ type: 'WATCHLIST_FLUSH' });
          }
        } catch {
          // ignore
        }

        setToast({
          message: willBeSaved ? 'Saved offline. Will sync when online.' : 'Removed offline. Will sync when online.',
          type: 'info',
          isVisible: true,
        });

        if (willBeSaved) {
          // Easter Egg: Blue Confetti Burst for Watchlist
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.8 },
            colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
            ticks: 200,
            gravity: 1.2,
            scalar: 1.2,
          });
        }
      } catch (error) {
        console.error('Offline enqueue failed:', error);
        setToast({
          message: 'Failed to save offline',
          type: 'error',
          isVisible: true,
        });
      }
      return;
    }

    // Online behavior: existing Firestore writes.
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

        // Easter Egg: Blue Confetti Burst for Watchlist
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.8 },
          colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
          ticks: 200,
          gravity: 1.2,
          scalar: 1.2,
        });

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
        posterPath: movieDetails?.poster_path,
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

      <div className="relative min-h-[70vh] md:min-h-[85vh] flex items-end">
        {/* Dynamic Background with gradient overlays */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{
              backgroundImage:
                window.innerWidth >= 768
                  ? movieImages && movieImages.length > 0
                    ? `url(https://image.tmdb.org/t/p/original/${movieImages[Math.floor(Math.random() * movieImages.length)].file_path})`
                    : `url(${posterImageUrl})`
                  : `url(${posterImageUrl})`,
            }}
          />
          {/* Multi-layered gradient overlays for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-transparent to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
          {/* Animated noise texture overlay for modern feel */}
          <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-12"
          >
            {/* Professional poster frame */}
            <div className="w-full md:w-auto flex-shrink-0 flex justify-center md:justify-start md:-mt-20 md:mr-8 order-1 md:order-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative"
              >
                {/* Refined elegant frame */}
                <div className="relative ring-1 ring-white/10 bg-white/5 rounded-2xl p-1.5 sm:p-2 shadow-2xl shadow-black/50">
                  {movieDetails?.poster_path ? (
                    <img
                      src={posterThumbnailUrl}
                      alt={movieTitle}
                      className="w-40 h-56 xs:w-48 xs:h-64 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-40 h-56 xs:w-48 xs:h-64 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 bg-zinc-900/80 flex flex-col items-center justify-center text-gray-500 rounded-lg">
                      <ImageOff className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-50" />
                      <span className="text-xs text-center px-3">No Image</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Content section */}
            <div className="flex-1 flex flex-col justify-end w-full text-center md:text-left order-2 md:order-none">
              {/* Minimal glassmorphic badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="flex flex-wrap justify-center md:justify-start items-center gap-2 md:gap-3 mb-4 md:mb-6"
              >
                {/* Rating badge - Glassmorphic */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-white font-semibold text-sm sm:text-base">{movieRating}</span>
                </div>

                {/* Runtime badge - Glassmorphic */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-white/80 font-medium text-sm">{movieRuntime} min</span>
                </div>

                {/* Release date badge - Glassmorphic */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span className="text-white/80 font-medium text-sm">
                    {movieReleaseDate}
                  </span>
                </div>
              </motion.div>

              {/* Title with enhanced typography */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 md:mb-6 leading-tight tracking-tight text-white"
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  {movieTitle}
                </span>
              </motion.h1>

              {/* Genre chips - minimal glassmorphic */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap justify-center md:justify-start gap-2 md:gap-2.5 mb-6 md:mb-8"
              >
                {movieDetails?.genres?.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs sm:text-sm font-medium text-white/80 transition-all duration-300 hover:bg-white/10 hover:text-white hover:border-white/20"
                  >
                    {genre.name}
                  </span>
                ))}
              </motion.div>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
              >
                <WatchedButtonInline />
                <button
                  onClick={handleWatchlistToggle}
                  className={`relative group flex items-center gap-3 px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[52px] shadow-xl overflow-hidden ${isInWatchlist
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30'
                    }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {isInWatchlist ? (
                    <BookmarkCheck className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                  ) : (
                    <Bookmark className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                  )}
                  <span className="relative z-10">
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
        className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10"
      >
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-white">Synopsis</h2>
        <p className="text-base md:text-lg text-white/70 leading-relaxed">{movieOverview}</p>
      </motion.section>

      <div className="container mx-auto px-4 py-8 space-y-8 md:space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TvMinimalPlay className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Watch Now</h2>
          </div>
          <div className="rounded-xl overflow-hidden ring-1 ring-white/10">
            <div className="w-full" style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="fullscreen; picture-in-picture; autoplay; orientation-lock"
                title="Movie Embed"
                className="absolute top-0 left-0 w-full h-full"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="lg:col-span-1"
          >
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 h-full">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <Globe className="w-5 h-5 text-blue-400" />
                Movie Info
              </h3>
              <dl className="space-y-5">
                <div className="pb-4 border-b border-white/10">
                  <dt className="text-white/50 text-sm font-medium mb-2">Language</dt>
                  <dd className="text-white font-semibold">{movieLanguage}</dd>
                </div>
                <div className="pb-4 border-b border-white/10">
                  <dt className="text-white/50 text-sm font-medium mb-2">Box Office</dt>
                  <dd className="flex items-center gap-2 text-white font-semibold">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    {movieBoxOffice}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/50 text-sm font-medium mb-2">Director</dt>
                  <dd className="text-white font-semibold">{movieDirector}</dd>
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
                className="rounded-xl overflow-hidden"
              >
                {movieDetails?.trailers && movieDetails.trailers.length > 0 && (
                  <SwiperSlide>
                    <div className="aspect-video rounded-xl overflow-hidden ring-1 ring-white/10">
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
                    <div className="aspect-video rounded-xl overflow-hidden ring-1 ring-white/10">
                      <img
                        src={`https://image.tmdb.org/t/p/w780${image.file_path}`}
                        alt="Movie backdrop"
                        className="w-full h-full object-cover"
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
          className="relative bg-gradient-to-br from-gray-900/60 to-black/80 backdrop-blur-md rounded-3xl p-6 md:p-10 border border-white/5 shadow-2xl overflow-hidden"
        >
          {/* Gradient accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-pink-500/5 to-rose-500/5 rounded-full blur-3xl" />

          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center border border-white/10">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Top Cast</h2>
          </div>

          <div ref={castContainerRef} className="overflow-x-auto pb-2 custom-scrollbar">
            <div className="flex gap-4 md:gap-5 px-1">
              {movieDetails?.cast?.map((actor, idx) => (
                <Link key={actor.id} to={`/actor/${actor.id}`} className="flex-shrink-0">
                  <SpatialMediaCard containerRef={castContainerRef} index={idx}>
                    <div className="relative bg-gradient-to-b from-gray-800/40 to-gray-900/60 hover:from-gray-700/50 hover:to-gray-800/70 transition-all duration-300 rounded-2xl border border-white/5 hover:border-white/10 shadow-xl hover:shadow-2xl overflow-hidden w-36 sm:w-44 h-full">
                      {/* Image container with aspect ratio */}
                      <div className="relative aspect-[3/4] overflow-hidden">
                        {actor.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w780${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-black flex flex-col items-center justify-center text-gray-500">
                            <ImageOff className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-50" />
                            <span className="text-xs text-center px-2">No Photo</span>
                          </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                      </div>

                      {/* Info */}
                      <div className="relative p-4 bg-gradient-to-b from-transparent to-black/80">
                        <h3 className="font-bold text-sm sm:text-base text-white mb-1 line-clamp-2 group-hover:text-blue-300 transition-colors duration-300">
                          {actor.name}
                        </h3>
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                          {actor.role || 'Unknown Role'}
                        </p>
                      </div>

                      {/* Hover border glow */}
                      <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/20 rounded-2xl transition-all duration-300 pointer-events-none" />
                    </div>
                  </SpatialMediaCard>
                </Link>
              ))}
            </div>
          </div>

          {/* Swipe hint for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="flex items-center justify-center gap-2 mt-4 text-gray-500 text-xs md:hidden"
          >
            <span>Swipe to explore</span>
            <div className="w-5 h-5 border-2 border-gray-600 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.02 }}
          className="relative bg-gradient-to-br from-gray-900/60 to-black/80 backdrop-blur-md rounded-3xl p-6 md:p-10 border border-white/5 shadow-2xl overflow-hidden"
        >
          {/* Gradient accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl" />

          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 to-yellow-500/20 flex items-center justify-center border border-white/10">
              <Award className="w-5 h-5 text-black" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Crew</h2>
          </div>

          <div ref={crewContainerRef} className="overflow-x-auto pb-2 custom-scrollbar">
            <div className="flex gap-4 md:gap-5 px-1">
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

                return crewArr.map((member: any, idx) => (
                  <Link
                    key={member.credit_id}
                    to={`/actor/${member.id}`}
                    className="flex-shrink-0"
                  >
                    <SpatialMediaCard containerRef={crewContainerRef} index={idx}>
                      <div className="relative bg-gradient-to-b from-gray-800/40 to-gray-900/60 hover:from-gray-700/50 hover:to-gray-800/70 transition-all duration-300 rounded-2xl border border-white/5 hover:border-white/10 shadow-xl hover:shadow-2xl overflow-hidden group w-36 sm:w-44 h-full">
                        {/* Image container */}
                        <div className="relative aspect-[3/4] overflow-hidden">
                          {member.profile_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w780${member.profile_path}`}
                              alt={member.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-black flex flex-col items-center justify-center text-gray-500">
                              <ImageOff className="w-10 h-10 sm:w-12 sm:h-12 mb-2 opacity-50" />
                              <span className="text-xs text-center px-2">No Photo</span>
                            </div>
                          )}

                          {/* Gradient overlay on hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        {/* Info */}
                        <div className="relative p-4 bg-gradient-to-b from-transparent to-black/80">
                          <h3 className="font-bold text-sm sm:text-base text-white mb-1 line-clamp-2 group-hover:text-blue-300 transition-colors duration-300">
                            {member.name}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {member.jobs.slice(0, 2).join(', ')}
                            {member.jobs.length > 2 && ` +${member.jobs.length - 2} more`}
                          </p>
                        </div>

                        {/* Hover glow effect */}
                        <div className="absolute inset-0 border-2 border-blue-500/0 group-hover:border-blue-500/20 rounded-2xl transition-all duration-300 pointer-events-none" />
                      </div>
                    </SpatialMediaCard>
                  </Link>
                ));
              })()}
            </div>
          </div>

          {/* Swipe hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="flex items-center justify-center gap-2 mt-4 text-gray-500 text-xs md:hidden"
          >
            <span>Swipe to explore</span>
            <div className="w-5 h-5 border-2 border-gray-600 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
            </div>
          </motion.div>
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
              <div className="w-3 h-10">
                <FaFilm className="text-yellow-500" />
              </div>
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
              <div ref={moviePartsContainerRef} className="flex gap-3 md:gap-4 pb-3 snap-x snap-mandatory custom-scrollbar overflow-x-auto scroll-smooth -mr-2 md:-mr-6 pr-2 md:pr-6 px-1">
                {movieParts
                  .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
                  .map((part, index) => (
                    <Link
                      key={part.id}
                      to={`/movie/${part.id}`}
                      className="flex-shrink-0 snap-center"
                      tabIndex={0}
                      aria-label={`View ${part.title}`}
                    >
                      <SpatialMediaCard containerRef={moviePartsContainerRef} index={index}>
                        <div className="w-24 sm:w-32 md:w-36 lg:w-40 h-full group">
                          <div className="w-full bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-xl overflow-hidden shadow-xl border border-gray-700/50 bg-gradient-to-b from-zinc-900/50 to-black/30 transition-all duration-300 group-hover:border-gray-600/50 group-hover:shadow-2xl group-hover:scale-[1.02]">
                            {/* Poster */}
                            {part.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w780${part.poster_path}`}
                                alt={part.title}
                                loading="lazy"
                                className="w-full aspect-[2/3] object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className="w-full aspect-[2/3] flex items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-800">
                                <ImageOff className="w-8 h-8 text-gray-500" />
                              </div>
                            )}

                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2">
                              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
                                <Play className="w-4 h-4 text-white/90" />
                                <span className="text-white text-xs font-semibold">View</span>
                              </div>
                            </div>

                            {/* Year & Rating Badge */}
                            <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-start pointer-events-none">
                              <span className="bg-gradient-to-r from-gray-900/90 to-black/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white/20 shadow-lg">
                                {part.release_date?.slice(0, 4) || 'TBA'}
                              </span>
                              {part.vote_average && (
                                <span className="bg-gradient-to-r from-yellow-500/90 to-yellow-400/90 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  {part.vote_average.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-1.5 px-0.5">
                            <h3 className="text-white font-bold text-[10px] leading-tight line-clamp-2 text-center group-hover:text-blue-300 transition-colors">
                              {part.title}
                            </h3>
                          </div>
                        </div>
                      </SpatialMediaCard>
                    </Link>
                  ))}
              </div>
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="relative overflow-hidden bg-gradient-to-br from-gray-800/40 via-gray-900/40 to-black/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl"
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-500/20 to-transparent rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tl from-amber-500/10 to-transparent rounded-full blur-2xl" />
          </div>

          <h2 className="relative text-xl md:text-2xl font-bold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-3">
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            Your Rating
          </h2>
          {user ? (
            <div className="relative space-y-6">
              {/* Rating Stars Container */}
              <div className="space-y-4">
                <div className="p-5 sm:p-6 bg-black/30 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 items-center justify-center">
                    {[0, 1].map((row) => (
                      <motion.div
                        key={row}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 + row * 0.1 }}
                        className="flex items-center justify-center gap-1 sm:gap-1"
                      >
                        {[...Array(5)].map((_, col) => {
                          const index = row * 5 + col;
                          const currentRating = userRating ?? 0;
                          const starValue = index + 1;
                          const isFull = currentRating >= starValue;
                          const isHalf = currentRating === starValue - 0.5;
                          const isHovered = false;

                          return (
                            <motion.div
                              key={index}
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              className="relative inline-block w-10 h-10 sm:w-12 sm:h-12 cursor-pointer"
                            >
                              {/* Left half button (half star) */}
                              <button
                                onClick={() => handleRateMovie(starValue - 0.5)}
                                className="absolute left-0 top-0 w-1/2 h-full z-20 hover:scale-110 transition-transform rounded-l-lg"
                                aria-label={`Rate ${starValue - 0.5} stars`}
                              />
                              {/* Right half button (full star) */}
                              <button
                                onClick={() => handleRateMovie(starValue)}
                                className="absolute right-0 top-0 w-1/2 h-full z-20 hover:scale-110 transition-transform rounded-r-lg"
                                aria-label={`Rate ${starValue} stars`}
                              />
                              {/* Star display */}
                              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                {isFull ? (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                  >
                                    <Star className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-400 fill-yellow-400 drop-shadow-lg filter drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                                  </motion.div>
                                ) : isHalf ? (
                                  <>
                                    <Star className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 fill-none" />
                                    <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                      >
                                        <Star className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-400 fill-yellow-400 drop-shadow-lg filter drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                                      </motion.div>
                                    </div>
                                  </>
                                ) : (
                                  <motion.div whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }} transition={{ duration: 0.3 }}>
                                    <Star className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 fill-none group-hover:text-yellow-300 transition-colors" />
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Rating Display & Description */}
                {userRating && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-center space-y-3"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <motion.span
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className="text-white font-bold text-2xl md:text-3xl"
                      >
                        {userRating}
                      </motion.span>
                      <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                      <span className="text-gray-400 text-lg">stars</span>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border font-semibold text-sm md:text-base ${userRating >= 8
                        ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-lg shadow-green-500/10'
                        : userRating >= 6
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/10'
                          : userRating >= 4
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                            : 'bg-red-500/20 text-red-400 border-red-500/30 shadow-lg shadow-red-500/10'
                        }`}
                    >
                      {userRating >= 8.5 && <Star className="w-4 h-4 fill-current" />}
                      {getRatingDescription(userRating)}
                      {userRating >= 8.5 && <Star className="w-4 h-4 fill-current" />}
                    </motion.div>
                  </motion.div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <motion.button
                  onClick={handleRatingSubmit}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative group overflow-hidden bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-400 hover:from-yellow-600 hover:via-yellow-500 hover:to-amber-500 text-black py-3 px-10 rounded-xl font-bold shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <Star className="w-5 h-5 relative z-10 group-hover:rotate-12 transition-transform" />
                  <span className="relative z-10">Submit Rating</span>
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                <Star className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 text-lg mb-2">
                Log in to rate this movie
              </p>
              <p className="text-gray-500 text-sm">
                Share your rating and help others decide
              </p>
            </motion.div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="relative bg-gradient-to-br from-gray-900/60 via-gray-800/40 to-black/60 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-white/5 shadow-2xl"
        >
          {/* Ambient background glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tl from-amber-500/10 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/25">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent tracking-tight">
                Your Review
              </h2>
            </div>

            {user ? (
              <div className="space-y-6">
                {/* Review textarea with modern styling */}
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/30 via-purple-500/20 to-blue-600/30 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300" />
                  <div className="relative bg-black/40 backdrop-blur-sm rounded-2xl border border-white/5 group-hover:border-white/10 transition-all duration-300">
                    <textarea
                      className="w-full bg-transparent text-white placeholder-gray-500 p-5 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[160px] md:min-h-[200px] text-base md:text-lg leading-relaxed"
                      rows={6}
                      placeholder="Share your thoughts about this movie...\n\nWhat stood out to you?\nHow did it make you feel?\nWho should watch it?"
                      value={userReview}
                      onChange={(e) => setUserReview(e.target.value)}
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {userReview.length}/1000
                      </span>
                    </div>
                  </div>
                </div>

                {/* Character count and tips */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                  <div className="flex items-center gap-4">
                    <span className={`flex items-center gap-1.5 text-sm ${userReview.length > 0 ? 'text-blue-400' : 'text-gray-500'}`}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      {userReview.length > 0 ? `${userReview.length} characters` : 'Start typing...'}
                    </span>
                    {userReview.length > 50 && (
                      <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Great start!
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">Press Enter to add new line</span>
                </div>

                {/* Submit button with enhanced micro-interactions */}
                <div className="flex justify-center pt-2">
                  <motion.button
                    onClick={handleReviewSubmit}
                    disabled={userReview.length === 0 || userReview.length > 1000}
                    whileHover={userReview.length > 0 && userReview.length <= 1000 ? { scale: 1.03, y: -2 } : {}}
                    whileTap={{ scale: 0.97 }}
                    className={`relative group overflow-hidden px-10 py-4 rounded-2xl font-semibold text-lg transition-all duration-300
                      ${userReview.length === 0 || userReview.length > 1000
                        ? 'bg-gray-600/30 text-gray-500 cursor-not-allowed border border-gray-700/50'
                        : 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/35 border border-white/10'}
                    `}
                  >
                    {/* Animated background */}
                    {userReview.length > 0 && userReview.length <= 1000 && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgdmlld0JveD0iMCAwIDMwIDMwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLW9wYWNpdHk6IDAuMDsiPjwvc3RvcD4KICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3Atb3BhY2l0eTogMC4xOyI+PC9zdG9wPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPgo8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyYWQpIiBvcGFjaXR5PSIwLjA1Ii8+CjwvcGF0dGVybj4K')] bg-blend-overlay" />
                        </div>
                      </>
                    )}

                    <div className="relative z-10 flex items-center gap-2">
                      <span className="transition-transform duration-300 group-hover:translate-x-1">
                        {userReview.length === 0
                          ? 'Write something first...'
                          : userReview.length > 1000
                            ? 'Too long!'
                            : 'Submit Review'}
                      </span>
                      <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </div>
                  </motion.button>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-center py-12 md:py-16"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-white/5 mb-6 shadow-lg shadow-black/25">
                  <svg className="w-10 h-10 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-3">
                  Share Your Thoughts
                </h3>
                <p className="text-gray-400 text-base md:text-lg max-w-md mx-auto leading-relaxed">
                  Log in to write a review and join the conversation about this movie. Your perspective matters to the community.
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.3 }}
          className="relative overflow-hidden bg-gradient-to-br from-gray-800/40 via-gray-900/40 to-black/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl"
        >
          {/* Animated gradient accents */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl" />
          </div>

          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-blue-400" />
              User Reviews
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Sort by:</span>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortOption === 'mostHelpful'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white border border-white/5'
                    }`}
                  onClick={() => setSortOption('mostHelpful')}
                >
                  Most Helpful
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortOption === 'mostRecent'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white border border-white/5'
                    }`}
                  onClick={() => setSortOption('mostRecent')}
                >
                  Most Recent
                </motion.button>
              </div>
            </div>
          </div>

          <div className="relative space-y-4">
            {movieDetails && Array.isArray(movieDetails.reviews) && movieDetails.reviews.length > 0 ? (
              movieDetails.reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}
                  className="group relative bg-gradient-to-br from-gray-700/30 to-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300"
                >
                  {/* Accent line */}
                  <div className="absolute left-0 top-4 bottom-4 w-1 bg-gradient-to-b from-blue-500/50 to-purple-500/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {review.author.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">
                        {review.author}
                      </h3>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="text-gray-500 hover:text-white transition-colors"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </motion.button>
                  </div>
                  <p className="text-gray-300 leading-relaxed mb-4 line-clamp-4 group-hover:line-clamp-none transition-all">
                    {review.content}
                  </p>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleUpvote(index)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-all border border-green-500/20 hover:border-green-500/40"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-sm font-medium">{review.likes ?? 0}</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDownvote(index)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all border border-red-500/20 hover:border-red-500/40"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span className="text-sm font-medium">{review.dislikes ?? 0}</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                  <MessageCircle className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 text-lg mb-2">No reviews yet. Be the first to review!</p>
                <p className="text-gray-500 text-sm">Share your thoughts about this movie</p>
              </motion.div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default MovieDetails;