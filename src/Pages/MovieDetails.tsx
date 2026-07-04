import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, Clock, Play, Sparkles, Globe, DollarSign, Bookmark, ThumbsDown, ThumbsUp, CheckCircle, BookmarkCheck, TvMinimalPlay, ImageOff, Image, Clapperboard, Check, Plus, Loader2, Users, Award, MessageCircle, MoreHorizontal } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
// @ts-ignore
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
  const [localHoveredIndex, setLocalHoveredIndex] = useState<number | null>(null);


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

    const syncWatchlistButton = async () => {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !movieDetails?.id) return;

      const watchlistCollectionRef = collection(db, 'users', currentUser.uid, 'watchlist');
      try {
        const querySnapshot = await getDocs(query(watchlistCollectionRef, where('movieId', '==', movieDetails.id)));
        setIsInWatchlist(querySnapshot.docs.length > 0);
      } catch (e) {
        // no-op; button will update on next mount
        console.error('Error syncing watchlist button after watched toggle:', e);
      }
    };

    const handleClick = async () => {
      const result = await toggleWatched(movieData);

      if (result.success) {
        if (!isWatched) {
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

        await syncWatchlistButton();

        const message = isWatched
          ? `Removed ${movieData.title ?? ''} from history`
          : `Saved ${movieData.title ?? ''} to history`;
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

            <div className="flex-1 flex flex-col justify-end w-full text-center md:text-left order-2 md:order-none">
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

                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-white/80 font-medium text-sm">{movieRuntime} min</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span className="text-white/80 font-medium text-sm">
                    {movieReleaseDate}
                  </span>
                </div>
              </motion.div>

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
      {/* Unified Descriptive Context Bento Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <motion.section
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
  className="group relative col-span-1 w-full bg-black rounded-[2rem] p-7 shadow-2xl border border-zinc-900 overflow-hidden flex flex-col justify-between"
>
  {(() => {
    const fallbackData = [
      { name: 'Thriller', value: 45, strokeColor: '#0052CC', shadowClass: 'drop-shadow-[0_12px_24px_rgba(0,82,204,0.65)]' },
      { name: 'Mystery', value: 35, strokeColor: '#591BC5', shadowClass: 'drop-shadow-[0_12px_24px_rgba(89,27,197,0.65)]' },
      { name: 'Drama', value: 20, strokeColor: '#724E3B', shadowClass: 'drop-shadow-[0_12px_24px_rgba(114,78,59,0.45)]' },
    ];

    const getHash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h;
    };

    const genreNames = (movieDetails?.genres ?? []).map((g) => g.name).filter(Boolean);
    const RADIUS = 38;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    let data = fallbackData;

    if (genreNames.length > 0) {
      const seed = `${movieDetails?.id ?? movieId ?? ''}-${genreNames.join('|')}`;
      const palette = [
        { strokeColor: '#0052CC', shadowClass: 'drop-shadow-[0_12px_24px_rgba(0,82,204,0.65)]' },
        { strokeColor: '#591BC5', shadowClass: 'drop-shadow-[0_12px_24px_rgba(89,27,197,0.65)]' },
        { strokeColor: '#724E3B', shadowClass: 'drop-shadow-[0_12px_24px_rgba(114,78,59,0.45)]' },
        { strokeColor: '#EAB308', shadowClass: 'drop-shadow-[0_12px_24px_rgba(234,179,8,0.65)]' },
        { strokeColor: '#F43F5E', shadowClass: 'drop-shadow-[0_12px_24px_rgba(244,63,94,0.65)]' },
        { strokeColor: '#34D399', shadowClass: 'drop-shadow-[0_12px_24px_rgba(52,211,153,0.65)]' },
      ];

      const weights = genreNames.map((g, idx) => {
        const h = getHash(`${seed}:${g}:${idx}`);
        return 0.35 + ((h % 1000) / 1000);
      });

      const sum = weights.reduce((a, b) => a + b, 0) || 1;
      const raw = weights.map((w) => (w / sum) * 100);
      const rounded = raw.map((v) => Math.max(1, Math.round(v)));

      let delta = 100 - rounded.reduce((a, b) => a + b, 0);
      let k = 0;
      while (delta !== 0 && k < 1000) {
        const i = k % rounded.length;
        const dir = delta > 0 ? 1 : -1;
        if (rounded[i] + dir >= 1) {
          rounded[i] += dir;
          delta -= dir;
        }
        k++;
      }

      data = genreNames.slice(0, Math.min(8, genreNames.length)).map((name, i) => {
        const color = palette[i % palette.length];
        return {
          name,
          value: rounded[i] ?? 0,
          strokeColor: color.strokeColor,
          shadowClass: color.shadowClass,
        };
      });
    }

    const primaryVibe = [...data].sort((a, b) => b.value - a.value)[0] ?? data[0];
    const activeVibe = localHoveredIndex !== null ? data[localHoveredIndex] : primaryVibe;

    const GAP_DEG = 3.5;
    const totalGapsLength = data.length * (GAP_DEG / 360) * CIRCUMFERENCE;
    const availableCircumference = CIRCUMFERENCE - totalGapsLength;

    let currentOffset = 0;

    return (
      <>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Vibe Chart</h2>

          <div className="relative flex items-center justify-center h-52 my-3 group/chart">
            <svg className="w-44 h-44 transform -rotate-90 transition-transform duration-500" viewBox="0 0 100 100">
              {data.map((segment, index) => {
                const segmentLength = (segment.value / 100) * availableCircumference;
                const strokeOffset = currentOffset;

                currentOffset -= (segmentLength + (GAP_DEG / 360) * CIRCUMFERENCE);
                const isSelected = localHoveredIndex === index;

                return (
                  <circle
                    key={`${segment.name}-${segment.value}`}
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="transparent"
                    stroke={segment.strokeColor}
                    strokeWidth={isSelected ? 14 : 11}
                    strokeDasharray={`${segmentLength} ${CIRCUMFERENCE}`}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="butt"
                    onMouseEnter={() => setLocalHoveredIndex(index)}
                    onMouseLeave={() => setLocalHoveredIndex(null)}
                    style={{
                      transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                    }}
                    className={`transition-all duration-300 origin-center cursor-pointer ${
                      isSelected ? segment.shadowClass : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                );
              })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-base font-medium text-zinc-400 tracking-wide transition-all duration-300 mix-blend-screen">
                {activeVibe?.name}
              </span>
              <span className="text-3xl font-bold tracking-tight text-white mt-0.5 transition-all duration-300 font-mono">
                {activeVibe?.value ?? 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 pt-4">
          {data.map((vibe, index) => {
            const isSelected = localHoveredIndex === index;
            const paletteMap: Record<string, string> = {
              '#0052CC': 'bg-[#0052CC]',
              '#591BC5': 'bg-[#591BC5]',
              '#724E3B': 'bg-[#724E3B]',
              '#EAB308': 'bg-yellow-500',
              '#F43F5E': 'bg-rose-500',
              '#34D399': 'bg-emerald-500',
            };
            const bgClass = paletteMap[vibe.strokeColor] ?? 'bg-zinc-500';

            return (
              <div
                key={vibe.name}
                className={`flex items-center justify-between text-base py-1.5 px-2 rounded-xl transition-all duration-200 cursor-pointer ${
                  isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                }`}
                onMouseEnter={() => setLocalHoveredIndex(index)}
                onMouseLeave={() => setLocalHoveredIndex(null)}
              >
                <div className="flex items-center gap-3.5">
                  <span className={`w-3.5 h-3.5 rounded-full ${bgClass} flex-shrink-0 transition-transform duration-200 ${isSelected ? 'scale-125' : ''}`} />
                  <span className={`font-medium transition-colors duration-200 ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                    {vibe.name}
                  </span>
                </div>
                <span className={`font-semibold tracking-wide transition-colors duration-200 font-mono ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {vibe.value}%
                </span>
              </div>
            );
          })}
        </div>
      </>
    );
  })()}
</motion.section>

        {/* Combined Story & Specifications Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:col-span-2 bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden group flex flex-col justify-between gap-8"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent blur-sm pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-gradient-to-br from-red-600/5 via-orange-600/5 to-transparent rounded-full blur-3xl opacity-60 group-hover:opacity-80 transition-opacity duration-700 pointer-events-none" />

          {/* Top Half: Synopsis */}
          <div className="relative z-10">
            <h2 className="text-xl md:text-2xl font-black mb-4 text-white tracking-tight">
              Synopsis
            </h2>
            {movieOverview ? (
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal tracking-wide">
                {movieOverview}
              </p>
            ) : (
              <p className="text-sm sm:text-base text-zinc-600 italic font-medium">
                An official synopsis has not yet been recorded for this film.
              </p>
            )}
          </div>

          {/* Bottom Half: Inline Metadata Grid */}
          <div className="relative z-10 pt-6 border-t border-white/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-300 hover:bg-white/[0.04]">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Language</dt>
                <dd className="text-zinc-200 font-semibold text-sm">{movieLanguage}</dd>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-300 hover:bg-white/[0.04]">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Box Office</dt>
                <dd className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                  <span>{movieBoxOffice || 'N/A'}</span>
                </dd>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors duration-300 hover:bg-white/[0.04]">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Director</dt>
                <dd className="text-zinc-200 font-semibold text-sm">{movieDirector}</dd>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8 md:space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-4 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden group mb-8"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="flex items-center gap-3 mb-5 sm:mb-6 relative z-10">
            <div className="p-2.5 bg-gradient-to-b from-red-500/10 to-red-500/20 border border-red-500/20 rounded-xl shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
              <TvMinimalPlay className="w-5 h-5 md:w-5.5 md:h-5.5 text-red-500 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Watch Now</h2>
              <span className="text-[10px] sm:text-xs text-zinc-500 font-medium tracking-wide uppercase mt-0.5">Adaptive Player Stream</span>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_0_50px_-12px_rgba(239,68,68,0.15)] transition-all duration-500 group-hover:shadow-[0_0_60px_-10px_rgba(239,68,68,0.25)] group-hover:border-white/[0.12]">
            <div className="w-full aspect-video bg-zinc-950">
              <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                allowFullScreen
                allow="fullscreen; picture-in-picture; autoplay; orientation-lock"
                title="Movie Embed"
                className="w-full h-full border-0 relative z-10"
                ref={el => {
                  if (el && typeof window !== "undefined") {
                    const handleFs = () => {
                      const orientation =
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
              />
            </div>
          </div>
        </motion.section>

        <div className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <div className="relative bg-zinc-950/20 backdrop-blur-3xl rounded-3xl p-6 border border-white/[0.03] shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 px-1">
                Production Media & Trailers
              </h3>

              {(!movieDetails?.trailers || movieDetails.trailers.length === 0) && movieImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                  <Image className="w-10 h-10 mb-2 stroke-[1.25]" />
                  <span className="text-xs font-medium">No production media captured</span>
                </div>
              ) : (
                <div
                  className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent snap-x snap-mandatory scroll-smooth"
                  style={{ willChange: 'scroll-position' }}
                >

                  {movieDetails?.trailers && movieDetails.trailers.length > 0 && (
                    <div className="flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[32%] snap-start">
                      <div className="aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-black shadow-lg shadow-black/40 relative">
                        <iframe
                          className="w-full h-full relative z-10"
                          src={`https://www.youtube.com/embed/${movieDetails.trailers[0].key}`}
                          title="Movie Trailer"
                          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}

                  {movieImages.map((image) => (
                    <div key={image.file_path} className="flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[32%] snap-start">
                      <div className="aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-900 shadow-lg shadow-black/40 relative group/slide cursor-zoom-in">
                        <img
                          src={`https://image.tmdb.org/t/p/w780${image.file_path}`}
                          alt="Movie production still"
                          className="w-full h-full object-cover opacity-85 transition-opacity duration-300 ease-out group-hover/slide:opacity-100"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none z-20" />
                      </div>
                    </div>
                  ))}

                </div>
              )}
            </div>
          </motion.div>
        </div>
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="flex items-center justify-between mb-6 sm:mb-8 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Users className="w-5 h-5 text-blue-500 stroke-[1.5]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Top Cast</h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-medium tracking-wide uppercase mt-0.5">Performers</span>
              </div>
            </div>
          </div>

          <div
            ref={castContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-4 sm:gap-6 px-1">
              {movieDetails?.cast?.map((actor, idx) => (
                <Link
                  key={actor.id}
                  to={`/actor/${actor.id}`}
                  className="flex-shrink-0 snap-start group/card"
                >
                  <SpatialMediaCard containerRef={castContainerRef} index={idx}>
                    <div className="relative bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_12px_32px_rgba(0,0,0,0.4)] overflow-hidden w-[135px] xs:w-[155px] sm:w-[175px] md:w-[185px] transition-all duration-500 ease-[0.22,1,0.36,1] group-hover/card:-translate-y-1.5 group-hover/card:bg-white/[0.05] group-hover/card:border-white/[0.12] group-hover/card:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)]">

                      <div className="absolute -top-12 -left-12 w-32 h-32 bg-gradient-to-br from-blue-500/0 to-indigo-500/0 rounded-full blur-2xl opacity-0 group-hover/card:opacity-40 group-hover/card:from-blue-500/20 group-hover/card:to-cyan-400/20 transition-all duration-700 pointer-events-none" />

                      <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950">
                        {actor.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w780${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover transition-all duration-700 ease-[0.25,1,0.5,1] scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                            <ImageOff className="w-7 h-7 mb-1.5 stroke-[1.25] opacity-30" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">No Frame</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                      </div>

                      <div className="px-3.5 pb-4 pt-2 flex flex-col justify-center text-center">
                        <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-blue-500 transition-colors duration-300">
                          {actor.name}
                        </h3>

                        <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.01)] inline-block mx-auto max-w-full">
                          <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                            {actor.role || 'Character'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SpatialMediaCard>
                </Link>
              ))}
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest"
          >
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.02, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

          <div className="flex items-center justify-between mb-6 sm:mb-8 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Award className="w-5 h-5 text-amber-400 stroke-[1.5]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Crew</h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-bold tracking-wider uppercase mt-0.5">Production Team</span>
              </div>
            </div>
          </div>

          <div
            ref={crewContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-4 sm:gap-6 px-1">
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
                    className="flex-shrink-0 snap-start group/card"
                  >
                    <SpatialMediaCard containerRef={crewContainerRef} index={idx}>
                      <div className="relative bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_12px_32px_rgba(0,0,0,0.4)] overflow-hidden w-[135px] xs:w-[155px] sm:w-[175px] md:w-[185px] transition-all duration-500 ease-[0.22,1,0.36,1] group-hover/card:-translate-y-1.5 group-hover/card:bg-white/[0.05] group-hover/card:border-white/[0.12] group-hover/card:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)]">

                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-gradient-to-br from-amber-500/0 to-orange-500/0 rounded-full blur-2xl opacity-0 group-hover/card:opacity-30 group-hover/card:from-amber-500/10 group-hover/card:to-orange-400/10 transition-all duration-700 pointer-events-none" />
                        <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950">
                          {member.profile_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w780${member.profile_path}`}
                              alt={member.name}
                              className="w-full h-full object-cover transition-all duration-700 ease-[0.25,1,0.5,1] scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                              <ImageOff className="w-7 h-7 mb-1.5 stroke-[1.25] opacity-30" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">No Frame</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                        </div>

                        <div className="px-3.5 pb-4 pt-2 flex flex-col justify-center text-center">
                          <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-amber-300 transition-colors duration-300">
                            {member.name}
                          </h3>

                          <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] shadow-[inset_0_0.5px_0_rgba(255,255,255,0.01)] inline-block mx-auto max-w-full">
                            <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                              {member.jobs.slice(0, 2).join(', ')}
                              {member.jobs.length > 2 && ` +${member.jobs.length - 2}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </SpatialMediaCard>
                  </Link>
                ));
              })()}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest"
          >
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </motion.div>
        </motion.section>

        {movieParts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3.5 mb-6 sm:mb-8 relative z-20">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Clapperboard className="w-5 h-5 text-blue-400 stroke-[1.5]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {collectionName ? `Part of ${collectionName}` : 'Movie Parts'}
                </h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-bold tracking-wider uppercase mt-0.5">
                  {movieParts.length} {movieParts.length === 1 ? 'Sequel Block' : 'Chapters Available'}
                </span>
              </div>
            </div>

            <div className="relative z-20">
              <div
                ref={moviePartsContainerRef}
                className="flex gap-4 pb-3 snap-x snap-mandatory custom-scrollbar overflow-x-auto scroll-smooth -mx-5 px-5 sm:mx-0 sm:px-1"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {movieParts
                  .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
                  .map((part, index) => (
                    <Link
                      key={part.id}
                      to={`/movie/${part.id}`}
                      className="flex-shrink-0 snap-start group/card"
                      tabIndex={0}
                      aria-label={`View ${part.title}`}
                    >
                      <SpatialMediaCard containerRef={moviePartsContainerRef} index={index}>
                        <div className="w-[115px] xs:w-[130px] sm:w-[145px] md:w-[155px] lg:w-[165px]">
                          <div className="relative bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_12px_24px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-500 ease-[0.22,1,0.36,1] group-hover/card:-translate-y-1 group-hover/card:bg-white/[0.05] group-hover/card:border-white/[0.12] group-hover/card:shadow-black/60">

                            <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
                              {part.poster_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w780${part.poster_path}`}
                                  alt={part.title}
                                  loading="lazy"
                                  className="w-full h-full object-cover transition-transform duration-700 ease-[0.25,1,0.5,1] group-hover/card:scale-105 group-hover/card:brightness-[1.05]"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                                  <ImageOff className="w-6 h-6 text-zinc-700 stroke-[1.5]" />
                                </div>
                              )}

                              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center z-20">
                                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center transform scale-90 group-hover/card:scale-100 transition-transform duration-300 shadow-xl backdrop-blur-md">
                                  <Play className="w-4 h-4 text-white fill-white/20 translate-x-[1px]" />
                                </div>
                              </div>

                              <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none z-30">
                                <span className="bg-zinc-950/80 backdrop-blur-md text-zinc-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-white/[0.05]">
                                  {part.release_date?.slice(0, 4) || 'TBA'}
                                </span>

                                {part.vote_average > 0 && (
                                  <span className="bg-amber-400/90 backdrop-blur-md text-zinc-950 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-current stroke-[2]" />
                                    {part.vote_average.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 px-1 text-center">
                            <h3 className="text-zinc-200 font-bold text-xs leading-tight line-clamp-1 group-hover/card:text-blue-400 transition-colors duration-300">
                              {part.title}
                            </h3>
                          </div>
                        </div>
                      </SpatialMediaCard>
                    </Link>
                  ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="flex items-center justify-center gap-2 mt-3 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest relative z-20"
            >
              <span>Swipe Collection</span>
              <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
              </div>
            </motion.div>
          </motion.section>
        )}

        {movieParts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

            <div className="absolute inset-0 opacity-40 pointer-events-none">
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tl from-yellow-500/5 to-transparent rounded-full blur-2xl" />
            </div>

            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-white/[0.04] relative z-10">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400/20 stroke-[1.5]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Your Rating</h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-bold tracking-wider uppercase mt-0.5">User Assessment</span>
              </div>
            </div>

            {user ? (
              <div className="relative space-y-6 z-10">
                <div className="space-y-5">
                  <div className="p-4 sm:p-6 bg-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.03] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 items-center justify-center">
                      {[0, 1].map((row) => (
                        <motion.div
                          key={row}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.1 + row * 0.1 }}
                          className="flex items-center justify-center gap-1.5"
                        >
                          {[...Array(5)].map((_, col) => {
                            const index = row * 5 + col;
                            const currentRating = userRating ?? 0;
                            const starValue = index + 1;
                            const isFull = currentRating >= starValue;
                            const isHalf = currentRating === starValue - 0.5;

                            const interactiveMaskId = `canvas-star-split-${index}`;

                            return (
                              <motion.div
                                key={index}
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.92 }}
                                className="relative inline-block w-9 h-9 sm:w-11 sm:h-11 cursor-pointer group"
                              >
                                <svg className="w-0 h-0 absolute" aria-hidden="true" focusable="false">
                                  <defs>
                                    <linearGradient id={interactiveMaskId} x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="50%" stopColor="#fbbf24" />
                                      <stop offset="50%" stopColor="#27272a" />
                                    </linearGradient>
                                  </defs>
                                </svg>

                                <button
                                  onClick={() => handleRateMovie(starValue - 0.5)}
                                  className="absolute left-0 top-0 w-1/2 h-full z-20 bg-transparent border-none outline-none cursor-pointer"
                                  aria-label={`Rate ${starValue - 0.5} stars`}
                                />

                                <button
                                  onClick={() => handleRateMovie(starValue)}
                                  className="absolute right-0 top-0 w-1/2 h-full z-20 bg-transparent border-none outline-none cursor-pointer"
                                  aria-label={`Rate ${starValue} stars`}
                                />

                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center transition-all duration-300">
                                  {isFull ? (
                                    <motion.div
                                      initial={{ scale: 0.8 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                    >
                                      <Star className="w-8 h-8 sm:w-9 sm:h-9 text-amber-400 fill-amber-400 filter drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] stroke-[1.2]" />
                                    </motion.div>
                                  ) : isHalf ? (
                                    <Star
                                      className="w-8 h-8 sm:w-9 sm:h-9 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.2)] stroke-[1.2]"
                                      style={{
                                        fill: `url(#${interactiveMaskId})`,
                                        stroke: '#fbbf24'
                                      }}
                                    />
                                  ) : (
                                    <Star className="w-8 h-8 sm:w-9 sm:h-9 text-zinc-600 fill-zinc-900/40 transition-all duration-300 group-hover:text-amber-400/40 group-hover:fill-amber-400/5 stroke-[1.2]" />
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {userRating && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="text-center space-y-3"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <motion.span
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="text-white font-black text-3xl md:text-4xl tracking-tighter"
                        >
                          {userRating}
                        </motion.span>
                        <span className="text-zinc-500 font-bold text-sm tracking-widest uppercase mt-2">/ 10 Stars</span>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 }}
                        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider backdrop-blur-md ${userRating >= 8
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_8px_24px_rgba(16,185,129,0.05)]'
                          : userRating >= 6
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_8px_24px_rgba(59,130,246,0.05)]'
                            : userRating >= 4
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_8px_24px_rgba(245,158,11,0.05)]'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_8px_24px_rgba(244,63,94,0.05)]'
                          }`}
                      >
                        {userRating >= 8.5 && <Sparkles className="w-3.5 h-3.5" />}
                        <span>{getRatingDescription(userRating)}</span>
                        {userRating >= 8.5 && <Sparkles className="w-3.5 h-3.5" />}
                      </motion.div>
                    </motion.div>
                  )}
                </div>

                <div className="flex justify-center pt-2">
                  <motion.button
                    onClick={handleRatingSubmit}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative group overflow-hidden bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-zinc-950 py-3 px-10 rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-xl transition-all duration-300 hover:shadow-amber-500/10 hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    {/* Internal Specular Light Beam Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                    <CheckCircle className="w-4 h-4 relative z-10 stroke-[2]" />
                    <span className="relative z-10">Submit Rating</span>
                  </motion.button>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-4 shadow-inner">
                  <Star className="w-6 h-6 text-zinc-600 stroke-[1.5]" />
                </div>
                <p className="text-zinc-300 text-base font-bold tracking-tight mb-1">
                  Log in to rate this movie
                </p>
                <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                  Share your rating score and help improve personalized community charts.
                </p>
              </motion.div>
            )}
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tl from-zinc-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-white/[0.04]">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <svg className="w-5 h-5 text-blue-400 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Your Review</h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-bold tracking-wider uppercase mt-0.5">Share Assessment</span>
              </div>
            </div>

            {user ? (
              <div className="space-y-5">
                <div className="relative group">
                  <div className="absolute -inset-px bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition duration-500 pointer-events-none" />
                  <div className="relative bg-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.04] group-focus-within:border-white/[0.1] group-focus-within:bg-white/[0.02] transition-all duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                    <textarea
                      className="w-full bg-transparent text-zinc-100 placeholder-zinc-600 p-5 rounded-2xl resize-none focus:outline-none min-h-[160px] md:min-h-[200px] text-sm md:text-base leading-relaxed tracking-wide"
                      rows={6}
                      placeholder={`Share your thoughts about this movie...\n\n• What stood out to you?\n• How did it make you feel?\n• Who should watch it?`}
                      value={userReview}
                      onChange={(e) => setUserReview(e.target.value)}
                    />
                    <div className="absolute bottom-4 right-4 bg-zinc-950/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/[0.03]">
                      <span className={`text-[10px] font-mono font-bold ${userReview.length > 1000 ? 'text-rose-400' : 'text-zinc-500'}`}>
                        {userReview.length}<span className="text-zinc-700">/</span>1000
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${userReview.length > 0 ? 'text-blue-400' : 'text-zinc-500'}`}>
                      <svg className="w-3.5 h-3.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      {userReview.length > 0 ? `${userReview.length} characters` : 'Draft empty'}
                    </span>
                    {userReview.length >= 50 && userReview.length <= 1000 && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider"
                      >
                        Ready
                      </motion.span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-bold tracking-wide uppercase">Markdown supported</span>
                </div>

                <div className="flex justify-center pt-2">
                  <motion.button
                    onClick={handleReviewSubmit}
                    disabled={userReview.length === 0 || userReview.length > 1000}
                    whileHover={userReview.length > 0 && userReview.length <= 1000 ? { scale: 1.03 } : {}}
                    whileTap={{ scale: 0.98 }}
                    className={`relative group overflow-hidden py-3 px-10 rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-xl transition-all duration-300 flex items-center gap-2
              ${userReview.length === 0 || userReview.length > 1000
                        ? 'bg-zinc-900/40 text-zinc-600 border border-white/[0.02] cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white border border-white/10 hover:shadow-blue-500/10'
                      }
            `}
                  >
                    {userReview.length > 0 && userReview.length <= 1000 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                    )}

                    <div className="relative z-10 flex items-center gap-2">
                      <span>
                        {userReview.length === 0
                          ? 'Compose Review'
                          : userReview.length > 1000
                            ? 'Character Limit Exceeded'
                            : 'Publish Review'}
                      </span>
                      <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </div>
                  </motion.button>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-4 shadow-inner">
                  <svg className="w-6 h-6 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <p className="text-zinc-300 text-base font-bold tracking-tight mb-1">
                  Log in to share your review
                </p>
                <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                  Write custom reviews, save logs, and help optimize community calculation metrics.
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tl from-purple-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <MessageCircle className="w-5 h-5 text-blue-400 stroke-[1.5]" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">User Reviews</h2>
                <span className="text-[10px] sm:text-xs text-zinc-500 font-bold tracking-wider uppercase mt-0.5">Community Discussion</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-zinc-950/40 p-1 rounded-xl border border-white/[0.03] self-stretch sm:self-auto justify-between sm:justify-start">
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase pl-2">Sort by</span>
              <div className="flex items-center gap-1">
                {['mostHelpful', 'mostRecent'].map((option) => {
                  const isActive = sortOption === option;
                  return (
                    <motion.button
                      key={option}
                      whileTap={{ scale: 0.97 }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-all duration-300 ${isActive
                        ? 'bg-white/[0.05] text-white border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                        }`}
                      onClick={() => setSortOption(option)}
                    >
                      {option === 'mostHelpful' ? 'Helpful' : 'Recent'}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative space-y-4 z-10">
            {movieDetails && Array.isArray(movieDetails.reviews) && movieDetails.reviews.length > 0 ? (
              movieDetails.reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative bg-white/[0.01] backdrop-blur-xl rounded-2xl p-5 border border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.01)]"
                >
                  <div className="absolute left-0 top-6 bottom-6 w-[2px] bg-gradient-to-b from-blue-500/40 to-purple-500/40 rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="flex items-start justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center shadow-inner">
                        <span className="text-white font-black text-sm">
                          {review.author.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-bold text-sm text-zinc-200 group-hover:text-blue-400 transition-colors duration-300">
                          {review.author}
                        </h3>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-white/5 transition-all"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="w-4 h-4 stroke-[1.5]" />
                    </motion.button>
                  </div>

                  <p className="text-zinc-300 text-xs md:text-sm leading-relaxed mb-4 font-normal tracking-wide line-clamp-4 group-hover:line-clamp-none transition-all duration-500">
                    {review.content}
                  </p>

                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleUpvote(index)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08] text-emerald-400 rounded-lg border border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 stroke-[1.5]" />
                      <span className="text-[11px] font-mono font-bold">{review.likes ?? 0}</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDownvote(index)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/[0.03] hover:bg-rose-500/[0.08] text-rose-400 rounded-lg border border-rose-500/10 hover:border-rose-500/30 transition-all duration-300"
                    >
                      <ThumbsDown className="w-3.5 h-3.5 stroke-[1.5]" />
                      <span className="text-[11px] font-mono font-bold">{review.dislikes ?? 0}</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 border border-dashed border-white/[0.03] rounded-2xl bg-white/[0.005]"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-3.5 shadow-inner">
                  <MessageCircle className="w-5 h-5 text-zinc-600 stroke-[1.5]" />
                </div>
                <h4 className="text-zinc-300 text-sm font-bold tracking-tight mb-0.5">No critiques indexed yet</h4>
                <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                  Be the first to share your analysis regarding this feature layout.
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default MovieDetails;