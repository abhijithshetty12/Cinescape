import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Star, Calendar, Clock, Play, Sparkles, DollarSign, Bookmark,
  ThumbsDown, ThumbsUp, CheckCircle, BookmarkCheck, TvMinimalPlay,
  ImageOff, Image, Clapperboard, Check, Plus, Loader2,
  Users, Award, MessageCircle, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, query, setDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import { useWatchedStatus, WatchedItemData } from './History.tsx';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { enqueueWatchlistOp, registerWatchlistSync } from '../utils/watchlistQueue.ts';

interface Movie {
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
  trailers: { key: string; name: string }[];
  images: { backdrops: { file_path: string }[] };
  streamingLinks: any;
}

const TMDB_KEY = '859afbb4b98e3b467da9c99ac390e950';

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', kn: 'Kannada', te: 'Telugu', hi: 'Hindi', ta: 'Tamil',
  ml: 'Malayalam', ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish',
  ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ar: 'Arabic', it: 'Italian',
  pt: 'Portuguese', sv: 'Swedish', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  vi: 'Vietnamese', id: 'Indonesian', fa: 'Persian', ur: 'Urdu', bg: 'Bulgarian',
  cs: 'Czech', da: 'Danish', el: 'Greek', et: 'Estonian', fi: 'Finnish',
  hu: 'Hungarian', is: 'Icelandic', lt: 'Lithuanian', lv: 'Latvian',
  mk: 'Macedonian', no: 'Norwegian', sr: 'Serbian', sk: 'Slovak', sl: 'Slovenian',
  th: 'Thai', uk: 'Ukrainian', he: 'Hebrew', ro: 'Romanian', nb: 'Norwegian Bokmål',
  ca: 'Catalan', hr: 'Croatian', eu: 'Basque', gl: 'Galician',
};

const CHART_COLORS = [
  '#8400ff', '#FF5500', '#00F0FF', '#ffcc00', '#ff0080',
  '#F4C2C2', '#995a2d', '#F97316', '#14B8A6', '#EF4444',
];

const SpatialCard = ({
  children,
  index,
}: {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, x: 16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.35, delay: 0.08 + index * 0.04 }}
    className="flex-shrink-0"
  >
    {children}
  </motion.div>
);

const WatchedButton = ({
  movie,
  onSync,
  onToast,
}: {
  movie: Movie;
  onSync: () => void;
  onToast: (msg: string) => void;
}) => {
  const movieData: WatchedItemData = {
    movieId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path ?? '',
    releaseDate: movie.release_date,
    genres: movie.genres?.map((g) => g.name) ?? [],
    mediaType: 'movie',
  };
  const { isWatched, loading: watchedLoading, toggleWatched } = useWatchedStatus(
    movieData.movieId,
    movieData.mediaType,
  );

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
      onSync();
      onToast(
        isWatched
          ? `Removed ${movie.title} from history`
          : `Added ${movie.title} to history`,
      );
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={watchedLoading}
      className={`flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 active:scale-95 min-h-[44px] shadow-lg ${isWatched
          ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-green-500/25'
          : 'bg-gradient-to-r from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500 text-gray-300 hover:text-white shadow-zinc-500/25'
        } ${watchedLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {watchedLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isWatched ? (
        <Check className="w-4 h-4" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      <span>{watchedLoading ? 'Loading...' : isWatched ? 'Watched' : 'Mark as Watched'}</span>
    </button>
  );
};

const getRatingDescription = (rating: number) => {
  if (rating <= 1) return 'Weak sauce :(';
  if (rating <= 2) return 'Terrible';
  if (rating <= 3) return 'Bad';
  if (rating <= 4) return 'Poor';
  if (rating <= 5) return 'Meh';
  if (rating <= 6) return 'Fair';
  if (rating <= 7) return 'Good';
  if (rating <= 8) return 'Great';
  if (rating <= 9) return 'Superb';
  if (rating <= 9.5) return 'Perfect';
  return 'Masterpiece!';
};

const MovieDetails = () => {
  const castContainerRef = useRef<HTMLDivElement>(null);
  const crewContainerRef = useRef<HTMLDivElement>(null);
  const moviePartsContainerRef = useRef<HTMLDivElement>(null);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [userReview, setUserReview] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [activeGenreId, setActiveGenreId] = useState<number | null>(null);
  const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState('mostHelpful');
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [heroBackdropUrl, setHeroBackdropUrl] = useState<string | null>(null);
  const [crew, setCrew] = useState<any[]>([]);
  const [movieParts, setMovieParts] = useState<any[]>([]);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({ message: '', type: 'success', isVisible: false });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isVisible: true });
  };

  const syncWatchlistState = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !movieDetails?.id) return;
    const ref = collection(db, 'users', currentUser.uid, 'watchlist');
    const snap = await getDocs(query(ref, where('movieId', '==', movieDetails.id)));
    setIsInWatchlist(snap.docs.length > 0);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setHeroBackdropUrl(null);
      setLoading(true);
      setError(null);
      try {
        const resp = await axios.get(
          `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits,reviews,videos,images,watch/providers`,
        );
        const data = resp.data;

        const director =
          data.credits?.crew?.find((m: any) => m.job === 'Director')?.name ?? 'Unknown Director';
        const streamingLinks = data['watch/providers']?.results?.US?.flatrate ?? [];
        const backdrops: { file_path: string }[] = data.images?.backdrops ?? [];

        if (backdrops.length > 0) {
          setHeroBackdropUrl(
            `https://image.tmdb.org/t/p/original/${backdrops[Math.floor(Math.random() * backdrops.length)].file_path
            }`,
          );
        }

        setCrew(data.credits?.crew ?? []);

        const firstPageReviews: any[] = data.reviews?.results ?? [];
        const totalReviewPages: number = data.reviews?.total_pages ?? 1;
        const extraReviewFetches = [];
        for (let page = 2; page <= totalReviewPages; page++) {
          extraReviewFetches.push(
            axios.get(
              `https://api.themoviedb.org/3/movie/${id}/reviews?api_key=${TMDB_KEY}&page=${page}`,
            ),
          );
        }
        const extraReviewResponses = await Promise.all(extraReviewFetches);
        const allRawReviews = [
          ...firstPageReviews,
          ...extraReviewResponses.flatMap((r) => r.data.results ?? []),
        ];
        const reviews = allRawReviews.map((r: any) => ({
          id: r.id,
          author: r.author,
          content: r.content,
        }));

        setMovieDetails({
          id: data.id,
          title: data.title,
          language: data.original_language,
          director,
          boxOffice: data.revenue,
          overview: data.overview,
          release_date: data.release_date,
          genres: data.genres ?? [],
          runtime: data.runtime,
          poster_path: data.poster_path,
          vote_average: data.vote_average,
          cast:
            data.credits?.cast?.map((m: any) => ({
              id: m.id,
              name: m.name,
              role: m.character,
              profile_path: m.profile_path,
            })) ?? null,
          reviews,
          trailers: data.videos?.results ?? [],
          images: { backdrops },
          streamingLinks,
        });

        if (data.belongs_to_collection?.id) {
          setCollectionName(data.belongs_to_collection.name);
          const colResp = await axios.get(
            `https://api.themoviedb.org/3/collection/${data.belongs_to_collection.id}?api_key=${TMDB_KEY}`,
          );
          const now = new Date();
          setMovieParts(
            colResp.data.parts.filter(
              (p: any) => p.release_date && new Date(p.release_date) <= now,
            ),
          );
        } else {
          setCollectionName(null);
          setMovieParts([]);
        }
      } catch {
        setError('Failed to fetch movie details.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  useEffect(() => {
    const check = async () => {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !movieDetails?.id) return;
      const ref = collection(db, 'users', currentUser.uid, 'watchlist');
      const snap = await getDocs(query(ref, where('movieId', '==', movieDetails.id)));
      setIsInWatchlist(snap.docs.length > 0);
    };
    check();
  }, [movieDetails?.id]);

  const handleRateMovie = (rating: number) => {
    setUserRating(rating);
    if (rating >= 4) {
      const defaults = {
        origin: { y: 0.7 },
        colors: ['#facc15', '#eab308', '#ca8a04', '#ffffff'],
        ticks: 150,
      };
      const fire = (ratio: number, opts: object) =>
        confetti({ ...defaults, ...opts, particleCount: Math.floor(100 * ratio), shapes: ['circle'] });
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    }
  };

  const handleUpvote = (index: number) => {
    setMovieDetails((prev) =>
      prev
        ? {
          ...prev,
          reviews: prev.reviews.map((r, i) =>
            i === index ? { ...r, likes: (r.likes ?? 0) + 1 } : r,
          ),
        }
        : null,
    );
  };

  const handleDownvote = (index: number) => {
    setMovieDetails((prev) =>
      prev
        ? {
          ...prev,
          reviews: prev.reviews.map((r, i) =>
            i === index ? { ...r, dislikes: (r.dislikes ?? 0) + 1 } : r,
          ),
        }
        : null,
    );
  };

  const handleWatchlistToggle = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !movieDetails) {
      if (!currentUser) showToast('Please log in to add to watchlist', 'error');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const willSave = !isInWatchlist;
      setIsInWatchlist(willSave);
      try {
        await enqueueWatchlistOp({
          type: willSave ? 'watchlist_add' : 'watchlist_remove',
          userId: currentUser.uid,
          movieId: movieDetails.id,
          title: movieDetails.title,
          releaseDate: movieDetails.release_date,
          genres: movieDetails.genres?.map((g) => g.name),
          posterPath: movieDetails.poster_path,
          mediaType: 'movie',
        });
        await registerWatchlistSync();
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.active?.postMessage({ type: 'WATCHLIST_FLUSH' });
          }
        } catch { }
        if (willSave) {
          confetti({
            particleCount: 150, spread: 70, origin: { y: 0.8 },
            colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
            ticks: 200, gravity: 1.2, scalar: 1.2,
          });
        }
        showToast(
          willSave ? 'Saved offline. Will sync when online.' : 'Removed offline. Will sync when online.',
          'info',
        );
      } catch {
        showToast('Failed to save offline', 'error');
      }
      return;
    }

    const ref = collection(db, 'users', currentUser.uid, 'watchlist');
    try {
      const snap = await getDocs(query(ref, where('movieId', '==', movieDetails.id)));
      if (snap.docs.length > 0) {
        await deleteDoc(snap.docs[0].ref);
        setIsInWatchlist(false);
        showToast('Removed from watchlist', 'info');
      } else {
        await addDoc(ref, {
          movieId: movieDetails.id,
          title: movieDetails.title,
          releaseDate: movieDetails.release_date,
          genres: movieDetails.genres?.map((g) => g.name),
          posterPath: movieDetails.poster_path,
          mediaType: 'movie',
        });
        setIsInWatchlist(true);
        confetti({
          particleCount: 150, spread: 70, origin: { y: 0.8 },
          colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
          ticks: 200, gravity: 1.2, scalar: 1.2,
        });
        showToast('Added to watchlist!', 'success');
      }
    } catch {
      showToast('Failed to update watchlist', 'error');
    }
  };

  const handleRatingSubmit = async () => {
    if (!user) { showToast('Please log in to rate this movie', 'error'); return; }
    if (userRating === null || userRating < 0 || userRating > 10) {
      showToast('Rating must be between 0 and 10', 'error'); return;
    }
    try {
      if (!id) throw new Error('Missing movie ID');
      await setDoc(doc(db, `users/${user.uid}/ratings`, id), {
        movieId: movieDetails?.id,
        title: movieDetails?.title,
        posterPath: movieDetails?.poster_path,
        rating: userRating,
        timestamp: new Date(),
      });
      showToast('Rating submitted!', 'success');
    } catch {
      showToast('Failed to submit rating', 'error');
    }
  };

  const handleReviewSubmit = async () => {
    if (!user) { showToast('Please log in to submit a review', 'error'); return; }
    if (!userReview.trim()) { showToast('Review cannot be empty', 'error'); return; }
    try {
      await addDoc(collection(db, 'users', user.uid, 'reviews'), {
        author: user.displayName ?? 'Anonymous',
        content: userReview,
        title: movieDetails?.title,
        timestamp: new Date(),
      });
      setUserReview('');
      showToast('Review submitted!', 'success');
    } catch {
      showToast('Failed to submit review', 'error');
    }
  };

  const groupedCrew = useMemo(() => {
    const grouped: Record<string, any> = {};
    crew.forEach((m) => {
      if (!grouped[m.id]) {
        grouped[m.id] = { ...m, jobs: [m.job] };
      } else if (!grouped[m.id].jobs.includes(m.job)) {
        grouped[m.id].jobs.push(m.job);
      }
    });
    const jobPriority = (jobs: string[]) => {
      if (jobs.includes('Director')) return 1;
      if (jobs.some((j) => ['Writer', 'Screenplay', 'Story'].includes(j))) return 2;
      if (jobs.includes('Producer')) return 3;
      return 4;
    };
    return Object.values(grouped).sort((a: any, b: any) => {
      const diff = jobPriority(a.jobs) - jobPriority(b.jobs);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [crew]);

  const embedUrl = useMemo(() =>
    `https://www.vidking.net/embed/movie/${id}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`,
    [id]
  );

  // Memoize player to prevent re-renders (and pausing) when typing reviews/ratings
  const VideoPlayer = useMemo(() => (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_0_50px_-12px_rgba(239,68,68,0.15)] group-hover:shadow-[0_0_60px_-10px_rgba(239,68,68,0.25)] group-hover:border-white/[0.12] transition-all duration-500">
      <div className="w-full aspect-video bg-zinc-950">
        <iframe
          key={id}
          src={embedUrl}
          width="100%"
          height="100%"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; orientation-lock"
          title="Movie Player"
          className="w-full h-full border-0"
          loading="lazy"
        />
      </div>
    </div>
  ), [embedUrl, id]);

  if (loading) return <Loading />;
  if (error || !movieDetails) return <p className="text-center text-red-500 py-20">{error}</p>;

  const language = LANGUAGE_MAP[movieDetails.language] ?? movieDetails.language ?? 'Unknown';
  const boxOffice = movieDetails.boxOffice
    ? `$${Number(movieDetails.boxOffice).toLocaleString()}`
    : 'N/A';
  const posterUrl = `https://image.tmdb.org/t/p/w780/${movieDetails.poster_path}`;
  const heroBackdrop = heroBackdropUrl ?? posterUrl;

  const genres = movieDetails.genres ?? [];
  const segments = genres.map((g) => ({
    id: g.id,
    name: g.name,
    value: genres.length ? 100 / genres.length : 0,
  }));
  const activeSegment = segments.find((s) => s.id === activeGenreId) ?? segments[0] ?? null;

  const chartSize = 220;
  const strokeW = 26;
  const r = chartSize / 2 - strokeW;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const circumference = 2 * Math.PI * r;
  const gapPx = 4;

  const sortedReviews = [...movieDetails.reviews].sort((a, b) => {
    if (sortOption === 'mostHelpful') return (b.likes ?? 0) - (a.likes ?? 0);
    return 0;
  });

  return (
    <div className="bg-black text-white min-h-screen">
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((t) => ({ ...t, isVisible: false }))}
      />

      <div className="relative min-h-[70vh] md:min-h-[85vh] flex items-end">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
            style={{ backgroundImage: `url(${heroBackdrop})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-transparent to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
          <div
            className="absolute inset-0 opacity-20 mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-12">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
            className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-12"
          >
            <div className="w-full md:w-auto flex-shrink-0 flex justify-center md:justify-start md:-mt-20 order-1 md:order-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="ring-1 ring-white/10 bg-white/5 rounded-2xl p-1.5 sm:p-2 shadow-2xl shadow-black/50">
                  {movieDetails.poster_path ? (
                    <img
                      src={posterUrl}
                      alt={movieDetails.title}
                      className="w-40 h-56 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-40 h-56 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 bg-zinc-900/80 flex flex-col items-center justify-center text-gray-500 rounded-lg">
                      <ImageOff className="w-10 h-10 mb-2 opacity-50" />
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
                className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-4"
              >
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-white font-semibold text-sm">
                    {movieDetails.vote_average.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-white/80 font-medium text-sm">{movieDetails.runtime} min</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                  <Calendar className="w-4 h-4 text-green-500" />
                  <span className="text-white/80 font-medium text-sm">{movieDetails.release_date}</span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 leading-tight tracking-tight"
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  {movieDetails.title}
                </span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap justify-center md:justify-start gap-2 mb-6"
              >
                {movieDetails.genres.map((g) => (
                  <span
                    key={g.id}
                    className="px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300"
                  >
                    {g.name}
                  </span>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start"
              >
                <WatchedButton
                  movie={movieDetails}
                  onSync={syncWatchlistState}
                  onToast={(m) => showToast(m, 'success')}
                />
                <button
                  onClick={handleWatchlistToggle}
                  className={`relative group flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-xl overflow-hidden ${isInWatchlist
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/30'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30'
                    }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  {isInWatchlist ? (
                    <BookmarkCheck className="w-5 h-5 relative z-10" />
                  ) : (
                    <Bookmark className="w-5 h-5 relative z-10" />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto mt-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="col-span-1 w-full bg-black rounded-3xl p-5 md:p-6 shadow-2xl border border-zinc-900 overflow-hidden flex flex-col"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">Vibe Chart</h2>
            <p className="text-xs text-zinc-500 font-medium">Hover a segment</p>
          </div>

          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-start">
            <div
              className="relative flex flex-shrink-0 items-center justify-center w-full max-w-[170px] md:max-w-[220px]"
              style={{ aspectRatio: '1/1' }}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${chartSize} ${chartSize}`}
                role="img"
                aria-label="Genre distribution"
                className="drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
              >
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="transparent"
                  stroke="rgba(255,255,255,0.02)"
                  strokeWidth={strokeW}
                />
                {(() => {
                  let offset = 0;
                  return segments.map((seg, idx) => {
                    const baseDash = (circumference * seg.value) / 100;
                    const adjusted = Math.max(0, baseDash - gapPx);
                    const dashOffset = -offset;
                    offset += baseDash;
                    const isActive = seg.id === activeGenreId;
                    const anyActive = activeGenreId !== null;
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <circle
                        key={seg.id}
                        cx={cx} cy={cy} r={r}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isActive ? strokeW + 4 : strokeW}
                        strokeLinecap="butt"
                        strokeDasharray={`${adjusted} ${circumference - adjusted}`}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{
                          filter: isActive ? `drop-shadow(0 0 16px ${color}50)` : 'none',
                          opacity: !anyActive || isActive ? 1 : 0.25,
                          transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setActiveGenreId(seg.id)}
                        onMouseLeave={() => setActiveGenreId(null)}
                        tabIndex={0}
                        aria-label={`${seg.name}: ${seg.value.toFixed(0)}%`}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4 md:p-6">
                <span className="w-full text-[10px] md:text-[11px] font-medium tracking-wider text-zinc-400 uppercase max-w-[120px] truncate transition-all duration-300">
                  {activeSegment?.name ?? 'Genre Mix'}
                </span>
                <span className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-0.5 tabular-nums">
                  {(activeSegment?.value ?? 0).toFixed(0)}%
                </span>
              </div>
            </div>

            <ul className="w-full flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2">
              {segments.map((s, idx) => {
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                const isActive = s.id === activeGenreId;
                const anyActive = activeGenreId !== null;
                return (
                  <li
                    key={s.id}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${isActive ? 'border-white/[0.08] bg-white/[0.04]' : 'border-transparent hover:bg-white/[0.01]'
                      }`}
                    style={{ opacity: !anyActive || isActive ? 1 : 0.4 }}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0 transition-transform duration-300 group-hover:scale-125"
                      style={{
                        backgroundColor: color,
                        boxShadow: isActive ? `0 0 10px ${color}` : 'none',
                      }}
                    />
                    <button
                      type="button"
                      onMouseEnter={() => setActiveGenreId(s.id)}
                      onMouseLeave={() => setActiveGenreId(null)}
                      className={`text-xs font-semibold tracking-wide text-left outline-none flex-1 transition-colors duration-200 ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}
                    >
                      {s.name}
                    </button>
                    <span className={`text-xs font-semibold font-mono tabular-nums transition-colors duration-200 ${isActive ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-400'
                      }`}>
                      {s.value.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:col-span-2 w-full bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden group flex flex-col justify-between gap-8"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent blur-sm pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-gradient-to-br from-red-600/5 via-orange-600/5 to-transparent rounded-full blur-3xl opacity-60 group-hover:opacity-80 transition-opacity duration-700 pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-xl md:text-2xl font-black mb-4 text-white tracking-tight">Synopsis</h2>
            {movieDetails.overview ? (
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed tracking-wide">
                {movieDetails.overview}
              </p>
            ) : (
              <p className="text-sm text-zinc-600 italic font-medium">
                An official synopsis has not yet been recorded for this film.
              </p>
            )}
          </div>

          <div className="relative z-10 pt-6 border-t border-white/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors duration-300">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Language</dt>
                <dd className="text-zinc-200 font-semibold text-sm">{language}</dd>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors duration-300">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Box Office</dt>
                <dd className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                  <span>{boxOffice}</span>
                </dd>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors duration-300">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Director</dt>
                <dd className="text-zinc-200 font-semibold text-sm">{movieDetails.director}</dd>
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
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-4 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="flex items-center gap-3 mb-5 relative z-10">
            <div className="p-2.5 bg-gradient-to-b from-red-500/10 to-red-500/20 border border-red-500/20 rounded-xl">
              <TvMinimalPlay className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Watch Now</h2>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Adaptive Player Stream</span>
            </div>
          </div>

          {VideoPlayer}
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative bg-zinc-950/20 backdrop-blur-3xl rounded-3xl p-6 border border-white/[0.03] shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 px-1">
              Production Media & Trailers
            </h3>

            {movieDetails.trailers.length === 0 && movieDetails.images.backdrops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                <Image className="w-10 h-10 mb-2 stroke-[1.25]" />
                <span className="text-xs font-medium">No production media available</span>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent snap-x snap-mandatory scroll-smooth">
                {movieDetails.trailers.slice(0, 3).map((trailer) => (
                  <div key={trailer.key} className="flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[32%] snap-start">
                    <div className="aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-black shadow-lg shadow-black/40">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${trailer.key}`}
                        title={trailer.name ?? 'Trailer'}
                        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-xs text-zinc-500 font-medium mt-2 truncate px-1">{trailer.name}</p>
                  </div>
                ))}

                {movieDetails.images.backdrops.map((img) => (
                  <div key={img.file_path} className="flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[32%] snap-start">
                    <div className="aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-900 shadow-lg shadow-black/40 group/slide cursor-zoom-in">
                      <img
                        src={`https://image.tmdb.org/t/p/w780/${img.file_path}`}
                        alt="Movie still"
                        className="w-full h-full object-cover opacity-85 group-hover/slide:opacity-100 transition-opacity duration-300"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="flex items-center gap-3.5 mb-6 relative z-10">
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <Users className="w-5 h-5 text-blue-500 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Top Cast</h2>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Performers</span>
            </div>
          </div>

          <div
            ref={castContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-4 sm:gap-5 px-1">
              {movieDetails.cast?.map((actor, idx) => (
                <Link key={actor.id} to={`/actor/${actor.id}`} className="flex-shrink-0 snap-start group/card">
                  <SpatialCard containerRef={castContainerRef} index={idx}>
                    <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:bg-white/[0.05] group-hover/card:border-blue-500/30 group-hover/card:shadow-[0_0_20px_rgba(59,130,246,0.15)]">

                      {/* Blue Corner Glow Blur Effect */}
                      <div className="absolute -top-10 -left-10 w-28 h-28 bg-blue-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-blue-500 transition-all duration-500 pointer-events-none" />

                      <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-blue-500/20 transition-colors duration-500">
                        {/* Diagonal Glass Sheen Sweep Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/15 to-transparent -translate-x-full -translate-y-full group-hover/card:translate-x-full group-hover/card:translate-y-full transition-transform duration-1000 ease-in-out z-10 pointer-events-none" />

                        {actor.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w780${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05] transition-all duration-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                            <ImageOff className="w-7 h-7 mb-1.5 opacity-30" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">No Photo</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                      </div>

                      <div className="px-3.5 pb-4 pt-2 flex flex-col items-center text-center">
                        <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-blue-400 transition-colors duration-300">
                          {actor.name}
                        </h3>
                        <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] inline-block max-w-full">
                          <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                            {actor.role || 'Character'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SpatialCard>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest">
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.02, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="flex items-center gap-3.5 mb-6 relative z-10">
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <Award className="w-5 h-5 text-amber-400 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Crew</h2>
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Production Team</span>
            </div>
          </div>

          <div
            ref={crewContainerRef}
            className="overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex gap-4 sm:gap-5 px-1">
              {groupedCrew.map((member: any, idx: number) => (
                <Link key={member.credit_id} to={`/actor/${member.id}`} className="flex-shrink-0 snap-start group/card">
                  <SpatialCard containerRef={crewContainerRef} index={idx}>
                    <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:-translate-y-1.5 group-hover/card:bg-white/[0.05] group-hover/card:border-amber-500/30 group-hover/card:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                      <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-amber-500/20 transition-all duration-700 pointer-events-none" />
                      <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-amber-500/20 transition-colors duration-500">
                        {member.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w780${member.profile_path}`}
                            alt={member.name}
                            className="w-full h-full object-cover scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05] transition-all duration-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                            <ImageOff className="w-7 h-7 mb-1.5 opacity-30" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">No Photo</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                      </div>
                      <div className="px-3.5 pb-4 pt-2 flex flex-col items-center text-center">
                        <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-amber-300 transition-colors duration-300">
                          {member.name}
                        </h3>
                        <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] inline-block max-w-full">
                          <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                            {member.jobs.slice(0, 2).join(', ')}
                            {member.jobs.length > 2 && ` +${member.jobs.length - 2}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </SpatialCard>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest">
            <span>Swipe to explore</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.section>

        {movieParts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
          >
            <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3.5 mb-6 relative z-20">
              <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <Clapperboard className="w-5 h-5 text-blue-400 stroke-[1.5]" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {collectionName ? `Part of ${collectionName}` : 'Movie Collection'}
                </h2>
                <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">
                  {movieParts.length} {movieParts.length === 1 ? 'Chapter' : 'Chapters Available'}
                </span>
              </div>
            </div>

            <div
              ref={moviePartsContainerRef}
              className="flex gap-4 pb-3 snap-x snap-mandatory overflow-x-auto scroll-smooth relative z-20 -mx-5 px-5 sm:mx-0 sm:px-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {[...movieParts]
                .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
                .map((part, index) => (
                  <Link
                    key={part.id}
                    to={`/movie/${part.id}`}
                    className="flex-shrink-0 snap-start group/card"
                    aria-label={`View ${part.title}`}
                  >
                    <SpatialCard containerRef={moviePartsContainerRef} index={index}>
                      <div className="w-[115px] sm:w-[145px] md:w-[165px]">
                        <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden transition-all duration-500 group-hover/card:-translate-y-1 group-hover/card:bg-white/[0.05] group-hover/card:border-white/[0.12] group-hover/card:shadow-black/60">
                          <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
                            {part.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w780${part.poster_path}`}
                                alt={part.title}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover/card:scale-105 group-hover/card:brightness-[1.05] transition-all duration-700"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                                <ImageOff className="w-6 h-6 text-zinc-700" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
                              <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center scale-90 group-hover/card:scale-100 transition-transform duration-300">
                                <Play className="w-4 h-4 text-white fill-white/20 translate-x-[1px]" />
                              </div>
                            </div>
                            <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none z-30">
                              <span className="bg-zinc-950/80 backdrop-blur-md text-zinc-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-white/[0.05]">
                                {part.release_date?.slice(0, 4) || 'TBA'}
                              </span>
                              {part.vote_average > 0 && (
                                <span className="bg-amber-400/90 text-zinc-950 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-current" />
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
                    </SpatialCard>
                  </Link>
                ))}
            </div>

            <div className="flex items-center justify-center gap-2 mt-3 text-zinc-500 text-[10px] md:hidden font-bold uppercase tracking-widest relative z-20">
              <span>Swipe Collection</span>
              <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
              </div>
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tl from-yellow-500/5 to-transparent rounded-full blur-2xl" />
          </div>

          <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-white/[0.04] relative z-10">
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400/20 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Your Rating</h2>
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">User Assessment</span>
            </div>
          </div>

          {user ? (
            <div className="relative space-y-6 z-10">
              <div className="p-4 sm:p-6 bg-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.03]">
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
                        const starIndex = row * 5 + col;
                        const starValue = starIndex + 1;
                        const current = userRating ?? 0;
                        const isFull = current >= starValue;
                        const isHalf = current === starValue - 0.5;
                        const maskId = `star-mask-${starIndex}`;

                        return (
                          <motion.div
                            key={starIndex}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.92 }}
                            className="relative inline-block w-9 h-9 sm:w-11 sm:h-11 cursor-pointer group"
                          >
                            <svg className="w-0 h-0 absolute" aria-hidden="true" focusable="false">
                              <defs>
                                <linearGradient id={maskId} x1="0%" y1="0%" x2="100%" y2="0%">
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
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                              {isFull ? (
                                <motion.div
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                >
                                  <Star className="w-8 h-8 sm:w-9 sm:h-9 text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] stroke-[1.2]" />
                                </motion.div>
                              ) : isHalf ? (
                                <Star
                                  className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-[0_0_8px_rgba(251,191,36,0.2)] stroke-[1.2]"
                                  style={{ fill: `url(#${maskId})`, stroke: '#fbbf24' }}
                                />
                              ) : (
                                <Star className="w-8 h-8 sm:w-9 sm:h-9 text-zinc-600 fill-zinc-900/40 group-hover:text-amber-400/40 group-hover:fill-amber-400/5 transition-all duration-300 stroke-[1.2]" />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  ))}
                </div>
              </div>

              {userRating !== null && (
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
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : userRating >= 6
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : userRating >= 4
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                  >
                    {userRating >= 8.5 && <Sparkles className="w-3.5 h-3.5" />}
                    <span>{getRatingDescription(userRating)}</span>
                    {userRating >= 8.5 && <Sparkles className="w-3.5 h-3.5" />}
                  </motion.div>
                </motion.div>
              )}

              <div className="flex justify-center pt-2">
                <motion.button
                  onClick={handleRatingSubmit}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative group overflow-hidden bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-zinc-950 py-3 px-10 rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                  <CheckCircle className="w-4 h-4 relative z-10 stroke-[2]" />
                  <span className="relative z-10">Submit Rating</span>
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-4">
                <Star className="w-6 h-6 text-zinc-600 stroke-[1.5]" />
              </div>
              <p className="text-zinc-300 text-base font-bold tracking-tight mb-1">Log in to rate this movie</p>
              <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                Share your rating and help improve personalized community charts.
              </p>
            </motion.div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3.5 mb-6 pb-4 border-b border-white/[0.04]">
            <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
              <svg className="w-5 h-5 text-blue-400 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Your Review</h2>
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Share Assessment</span>
            </div>
          </div>

          {user ? (
            <div className="relative space-y-5 z-10">
              <div className="relative group">
                <div className="absolute -inset-px bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition duration-500 pointer-events-none" />
                <div className="relative bg-white/[0.01] rounded-2xl border border-white/[0.04] group-focus-within:border-white/[0.1] group-focus-within:bg-white/[0.02] transition-all duration-500">
                  <textarea
                    className="w-full bg-transparent text-zinc-100 placeholder-zinc-600 p-5 rounded-2xl resize-none focus:outline-none min-h-[160px] md:min-h-[200px] text-sm leading-relaxed"
                    rows={6}
                    placeholder={`Share your thoughts about this movie...\n\n• What stood out to you?\n• How did it make you feel?\n• Who should watch it?`}
                    value={userReview}
                    onChange={(e) => setUserReview(e.target.value)}
                    maxLength={1000}
                  />
                  <div className="absolute bottom-4 right-4 bg-zinc-950/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/[0.03]">
                    <span className={`text-[10px] font-mono font-bold ${userReview.length > 900 ? 'text-rose-400' : 'text-zinc-500'}`}>
                      {userReview.length}<span className="text-zinc-700">/</span>1000
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase tracking-wider ${userReview.length > 0 ? 'text-blue-400' : 'text-zinc-500'}`}>
                    {userReview.length > 0 ? `${userReview.length} characters` : 'Draft empty'}
                  </span>
                  {userReview.length >= 50 && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider"
                    >
                      Ready
                    </motion.span>
                  )}
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <motion.button
                  onClick={handleReviewSubmit}
                  disabled={userReview.length === 0}
                  whileHover={userReview.length > 0 ? { scale: 1.03 } : {}}
                  whileTap={{ scale: 0.98 }}
                  className={`relative group overflow-hidden py-3 px-10 rounded-xl font-extrabold text-xs uppercase tracking-widest shadow-xl transition-all duration-300 flex items-center gap-2 ${userReview.length === 0
                      ? 'bg-zinc-900/40 text-zinc-600 border border-white/[0.02] cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 text-white border border-white/10 hover:shadow-blue-500/10'
                    }`}
                >
                  {userReview.length > 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                  )}
                  <div className="relative z-10 flex items-center gap-2">
                    <span>{userReview.length === 0 ? 'Compose Review' : 'Publish Review'}</span>
                    <svg className="w-4 h-4 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </div>
                </motion.button>
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] mb-4">
                <svg className="w-6 h-6 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p className="text-zinc-300 text-base font-bold tracking-tight mb-1">Log in to share your review</p>
              <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                Write reviews, save logs, and help optimize community metrics.
              </p>
            </motion.div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tl from-purple-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <MessageCircle className="w-5 h-5 text-blue-400 stroke-[1.5]" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">User Reviews</h2>
                <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Community Discussion</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-zinc-950/40 p-1 rounded-xl border border-white/[0.03]">
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase pl-2">Sort by</span>
              <div className="flex items-center gap-1">
                {(['mostHelpful', 'mostRecent'] as const).map((option) => (
                  <motion.button
                    key={option}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSortOption(option)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-all duration-300 ${sortOption === option
                        ? 'bg-white/[0.05] text-white border border-white/[0.08]'
                        : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                      }`}
                  >
                    {option === 'mostHelpful' ? 'Helpful' : 'Recent'}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative space-y-4 z-10">
            {sortedReviews.length > 0 ? (
              sortedReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative bg-white/[0.01] rounded-2xl p-5 border border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-500"
                >
                  <div className="absolute left-0 top-6 bottom-6 w-[2px] bg-gradient-to-b from-blue-500/40 to-purple-500/40 rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="flex items-start justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-sm">
                          {review.author.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-zinc-200 group-hover:text-blue-400 transition-colors duration-300">
                        {review.author}
                      </h3>
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
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-3.5">
                  <MessageCircle className="w-5 h-5 text-zinc-600 stroke-[1.5]" />
                </div>
                <h4 className="text-zinc-300 text-sm font-bold tracking-tight mb-0.5">No reviews yet</h4>
                <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                  Be the first to share your thoughts on this film.
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