import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Star, Calendar, Clock, Play, Sparkles, DollarSign, Bookmark,
  ThumbsDown, ThumbsUp, CheckCircle, BookmarkCheck, TvMinimalPlay,
  ImageOff, Image, Clapperboard, Check, Plus, Loader2,
  Users, Award, MessageCircle, MoreHorizontal,
  Edit2, Trash2, Quote,
  PenTool,
  Lock,
  MessageSquareText,
  Send,
  SquarePen,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, query, setDoc, doc, getDocs, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAutoLandscapeFullscreen } from '../hooks/useAutoLandscapeFullscreen.ts';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import { useWatchedStatus, WatchedItemData } from './History.tsx';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { enqueueWatchlistOp, registerWatchlistSync } from '../utils/watchlistQueue.ts';
import { getMovieEmbedUrls, PlayerSource } from '../utils/playerSources.ts';
import PlayerControl from '../components/PlayerControl.tsx';

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
  cast: { id: number; name: string; role: string; profile_path: string; category?: string }[] | null;
  reviews: { id: string; author: string; content: string; likes?: number; dislikes?: number }[];
  trailers: { key: string; name: string }[];
  images: { backdrops: { file_path: string }[] };
  streamingLinks: any;
  imdb_id: string;
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

  useAutoLandscapeFullscreen();

  const [userReview, setUserReview] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hasSavedRating, setHasSavedRating] = useState(false);
  const [editingRating, setEditingRating] = useState(false);
  const [activeGenreId, setActiveGenreId] = useState<number | null>(null);
  const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userExistingReview, setUserExistingReview] = useState<{
    id: string;
    content: string;
    author: string;
    timestamp: any;
    title?: string;
    rating?: number;
    posterPath?: string;
    mediaType?: string;
  } | null>(null);
  const [isLoadingUserReview, setIsLoadingUserReview] = useState<boolean>(false);
  const [isEditingUserReview, setIsEditingUserReview] = useState(false);
  const [editReviewContent, setEditReviewContent] = useState('');
  const [isUpdatingUserReview, setIsUpdatingUserReview] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
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
  const [playerSource, setPlayerSource] = useState<PlayerSource>('vidsrc');

  useEffect(() => {
    const fetchUserRating = async () => {
      if (!user || !id) return;
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const ratingDoc = await getDoc(doc(db, `users/${user.uid}/ratings`, id));
        if (ratingDoc.exists()) {
          setUserRating(ratingDoc.data().rating);
          setHasSavedRating(true);
        }
      } catch {
        // Silently fail - rating will remain null
      }
    };
    fetchUserRating();
  }, [user, id]);

  useEffect(() => {
    setIsLoadingUserReview(true);
    setIsEditingUserReview(false);
    setEditReviewContent('');

    if (!user?.uid || !movieDetails?.id) {
      setUserExistingReview(null);
      setIsLoadingUserReview(false);
      return;
    }

    const reviewsRef = collection(db, 'users', user.uid, 'reviews');
    const reviewQuery = query(reviewsRef, where('movieId', '==', movieDetails.id));
    const unsubscribe = onSnapshot(
      reviewQuery,
      (snapshot) => {
        const reviewDoc = snapshot.docs[0];

        if (!reviewDoc) {
          setUserExistingReview(null);
          setIsLoadingUserReview(false);
          return;
        }

        const data = reviewDoc.data();
        setUserExistingReview({
          id: reviewDoc.id,
          content: data.content ?? '',
          author: data.author ?? 'Anonymous',
          timestamp: data.timestamp ?? null,
          title: data.title ?? '',
          rating: data.rating ?? undefined,
          posterPath: data.posterPath ?? movieDetails.poster_path,
          mediaType: data.mediaType ?? 'movie',
        });
        setIsLoadingUserReview(false);
      },
      (snapshotError) => {
        console.error('Error listening for user review:', snapshotError);
        setUserExistingReview(null);
        setIsLoadingUserReview(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, movieDetails?.id, movieDetails?.poster_path]);

  const [userPhoto, setUserPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setUserPhoto(snap.data().photoDataUrl ?? null);
      }
    });
    return () => unsubscribe();
  }, [user]);

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
          imdb_id: data.imdb_id ?? '',
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
        mediaType: "movie",
        timestamp: new Date(),
      });
      setHasSavedRating(true);
      setEditingRating(false);
      showToast(hasSavedRating ? 'Rating updated!' : 'Rating submitted!', 'success');
    } catch {
      showToast('Failed to submit rating', 'error');
    }
  };

  const handleEditRating = () => {
    setEditingRating(true);
  };

  const handleCancelEditRating = () => {
    setEditingRating(false);
  };

  const handleReviewSubmit = async () => {
    if (!user) { showToast('Please log in to submit a review', 'error'); return; }
    if (!userReview.trim()) { showToast('Review cannot be empty', 'error'); return; }
    try {
      const reviewRef = await addDoc(collection(db, 'users', user.uid, 'reviews'), {
        author: user.displayName ?? 'Anonymous',
        content: userReview.trim(),
        title: movieDetails?.title,
        movieId: movieDetails?.id,
        posterPath: movieDetails?.poster_path,
        mediaType: 'movie',
        timestamp: new Date(),
      });
      setUserExistingReview({
        id: reviewRef.id,
        content: userReview.trim(),
        author: user.displayName ?? 'Anonymous',
        timestamp: new Date(),
        title: movieDetails?.title ?? '',
        posterPath: movieDetails?.poster_path,
        mediaType: 'movie',
      });
      setUserReview('');
      showToast('Review submitted!', 'success');
    } catch {
      showToast('Failed to submit review', 'error');
    }
  };

  const handleEditUserReview = () => {
    if (userExistingReview) {
      setEditReviewContent(userExistingReview.content);
      setIsEditingUserReview(true);
    }
  };

  const handleCancelEditUserReview = () => {
    setIsEditingUserReview(false);
    setEditReviewContent('');
  };

  const handleUpdateUserReview = async () => {
    const nextContent = editReviewContent.trim();
    if (!user || !userExistingReview) return;
    if (!nextContent) {
      showToast('Review cannot be empty', 'error');
      return;
    }

    setIsUpdatingUserReview(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'reviews', userExistingReview.id), {
        content: nextContent,
      });
      setUserExistingReview({ ...userExistingReview, content: nextContent });
      setIsEditingUserReview(false);
      setEditReviewContent('');
      showToast('Review updated!', 'success');
    } catch {
      showToast('Failed to update review', 'error');
    } finally {
      setIsUpdatingUserReview(false);
    }
  };

  const handleDeleteUserReview = async () => {
    if (!user || !userExistingReview) return;
    setIsDeletingReview(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'reviews', userExistingReview.id));
      setUserExistingReview(null);
      setIsEditingUserReview(false);
      setEditReviewContent('');
      showToast('Review deleted', 'success');
    } catch {
      showToast('Failed to delete review', 'error');
    } finally {
      setIsDeletingReview(false);
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

  const embedUrls = useMemo(() => {
    const tmdbId = id ?? '';
    const imdbId = movieDetails?.imdb_id ?? '';
    return getMovieEmbedUrls(tmdbId, imdbId);
  }, [id, movieDetails?.imdb_id]);

  const currentSrc = embedUrls[playerSource];

  const VideoPlayer = useMemo(() => {
    if (!currentSrc) return null;
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_0_50px_-12px_rgba(239,68,68,0.15)] group-hover:shadow-[0_0_60px_-10px_rgba(239,68,68,0.25)] group-hover:border-white/[0.12] transition-all duration-500">
        <div className="w-full aspect-video bg-zinc-950">
          <iframe
            key={`${playerSource}-${id}`}
            src={currentSrc!}
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
    );
  }, [currentSrc, id]);


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
                      <p className="text-xs text-center px-3">No Image</p>
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
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">Watch Now</h2>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Adaptive Player Stream</span>
            </div>
            <PlayerControl source={playerSource} onChange={setPlayerSource} />
          </div>

          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10 mb-5 shadow-[inset_0_1px_1px_rgba(239,68,68,0.1)] relative z-10">
            <div className="flex items-center justify-center w-5 h-5 rounded-full border border-red-500/40 bg-red-500/10 flex-shrink-0 text-[11px] font-extrabold text-red-400 select-none mt-0.5">
              i
            </div>
            <p className="text-zinc-400 text-[12px] leading-relaxed font-medium">
              Watch movie in <span className="text-red-400 font-semibold">full screen mode</span> to avoid irritating ads and unexpected popups.
            </p>
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
            <div className="flex items-center gap-4 sm:gap-5 px-1">
              {movieDetails.cast?.map((actor: any, idx: number) => {
                const category = actor.category || (idx < 3 ? 'Lead' : 'Supporting');
                const prevCategory =
                  idx > 0
                    ? (movieDetails.cast as any)[idx - 1].category || (idx - 1 < 3 ? 'Lead' : 'Supporting')
                    : null;
                const isFirstOfCategory = idx === 0 || category !== prevCategory;

                return (
                  <React.Fragment key={actor.id}>
                    {isFirstOfCategory && (
                      <div
                        key={`divider-${category}`}
                        className="flex-shrink-0 snap-start flex items-center h-[240px] sm:h-[280px] mr-1 sm:mr-2"
                      >
                        <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                        <div className="flex items-center pl-1 pr-0.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-blue-500/80 -rotate-90 whitespace-nowrap">
                            {category}
                          </span>
                        </div>
                      </div>
                    )}

                    <Link to={`/actor/${actor.id}`} className="flex-shrink-0 snap-start group/card">
                      <SpatialCard containerRef={castContainerRef} index={idx}>
                        <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:bg-white/[0.05] group-hover/card:border-blue-500/30 group-hover/card:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                          <div className="absolute -top-10 -left-10 w-28 h-28 bg-blue-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-blue-500 transition-all duration-500 pointer-events-none" />

                          <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-blue-500/20 transition-colors duration-500">
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
                                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                  No Photo
                                </span>
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
                  </React.Fragment>
                );
              })}
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
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center gap-4 sm:gap-5 px-1">
              {(() => {
                // Helper to determine category label
                const getCategoryLabel = (item: any) => {
                  if (!item) return 'CREW';
                  const dept = (item.category || item.department || item.known_for_department || '').toUpperCase();

                  if (dept.includes('DIRECT')) return 'DIRECTING';
                  if (dept.includes('PRODUC')) return 'PRODUCERS';

                  return 'CREW';
                };

                const getPriority = (item: any) => {
                  const label = getCategoryLabel(item);
                  if (label === 'DIRECTING') return 1;
                  if (label === 'PRODUCERS') return 2;
                  return 3;
                };

                const sortedCrew = [...groupedCrew].sort((a, b) => getPriority(a) - getPriority(b));

                return sortedCrew.map((member: any, idx: number) => {
                  const category = getCategoryLabel(member);
                  const prevCategory = idx > 0 ? getCategoryLabel(sortedCrew[idx - 1]) : null;
                  const isFirstOfCategory = idx === 0 || category !== prevCategory;

                  return (
                    <React.Fragment key={member.credit_id || idx}>
                      {isFirstOfCategory && (
                        <div
                          key={`divider-${category}`}
                          className="flex-shrink-0 snap-start flex items-center h-[240px] sm:h-[280px] mr-1 sm:mr-2"
                        >
                          <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                          <div className="flex items-center pl-1 pr-0.5">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-amber-500/80 -rotate-90 whitespace-nowrap">
                              {category}
                            </span>
                          </div>
                        </div>
                      )}

                      <Link to={`/actor/${member.id}`} className="flex-shrink-0 snap-start group/card">
                        <SpatialCard containerRef={crewContainerRef} index={idx}>
                          <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:bg-white/[0.05] group-hover/card:border-amber-500/30 group-hover/card:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                            <div className="absolute -top-10 -left-10 w-28 h-28 bg-amber-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-amber-500 transition-all duration-500 pointer-events-none" />
                            <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-amber-500/20 transition-colors duration-500">
                              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/15 to-transparent -translate-x-full -translate-y-full group-hover/card:translate-x-full group-hover/card:translate-y-full transition-transform duration-1000 ease-in-out z-10 pointer-events-none" />

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
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                    No Photo
                                  </span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-transparent pointer-events-none" />
                            </div>

                            <div className="px-3.5 pb-4 pt-2 flex flex-col items-center text-center">
                              <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-amber-400 transition-colors duration-300">
                                {member.name}
                              </h3>
                              <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] inline-block max-w-full">
                                <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                                  {Array.isArray(member.jobs)
                                    ? `${member.jobs.slice(0, 2).join(', ')}${member.jobs.length > 2 ? ` +${member.jobs.length - 2}` : ''}`
                                    : member.job || 'Crew'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </SpatialCard>
                      </Link>
                    </React.Fragment>
                  );
                });
              })()}
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
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-[32px] border border-white/[0.18] bg-zinc-900/40 p-5 sm:p-6 md:p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-3xl backdrop-saturate-200 overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Segoe_UI',Roboto,sans-serif] antialiased select-none"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />

            <div className="relative z-20 flex items-center justify-between mb-6">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md">
                  <Clapperboard className="w-5 h-5 stroke-[1.75]" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold text-white/95 tracking-tight">
                    {collectionName ? `Part of ${collectionName}` : 'Movie Collection'}
                  </h2>
                  <span className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase">
                    {movieParts.length} {movieParts.length === 1 ? 'Chapter' : 'Chapters Available'}
                  </span>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[11px] font-medium text-zinc-300 backdrop-blur-md shadow-sm">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Collection
              </span>
            </div>

            <div
              ref={moviePartsContainerRef}
              className="relative z-20 flex gap-4 pb-2 snap-x snap-mandatory overflow-x-auto scroll-smooth -mx-5 px-5 sm:mx-0 sm:px-1 no-scrollbar"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {[...movieParts]
                .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
                .map((part, index) => (
                  <Link
                    key={part.id}
                    to={`/movie/${part.id}`}
                    className="flex-shrink-0 snap-start group/card focus:outline-none"
                    aria-label={`View ${part.title}`}
                  >
                    <SpatialCard containerRef={moviePartsContainerRef} index={index}>
                      <div className="w-[125px] sm:w-[155px] md:w-[175px]">
                        <div className="relative rounded-2xl border border-white/15 bg-black/40 overflow-hidden shadow-2xl backdrop-blur-md transition-all duration-500 ease-out group-hover/card:border-blue-400/50 group-hover/card:shadow-[0_0_30px_rgba(59,130,246,0.25)]">
                          <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
                            {part.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w780${part.poster_path}`}
                                alt={part.title}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white/[0.02] text-zinc-500">
                                <ImageOff className="w-6 h-6 stroke-[1.5]" />
                                <span className="text-[10px] font-medium tracking-wider uppercase">No Poster</span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
                              <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 shadow-[0_8px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-xl flex items-center justify-center scale-85 group-hover/card:scale-100 transition-transform duration-300 ease-out">
                                <Play className="w-4 h-4 text-white fill-white translate-x-[1px]" />
                              </div>
                            </div>

                            <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-center pointer-events-none z-30">
                              <span className="bg-black/40 backdrop-blur-md border border-white/15 text-zinc-200 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm">
                                {part.release_date?.slice(0, 4) || 'TBA'}
                              </span>
                              {part.vote_average > 0 && (
                                <span className="bg-amber-400/90 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md backdrop-blur-md">
                                  <Star className="w-2.5 h-2.5 fill-current stroke-none" />
                                  {part.vote_average.toFixed(1)}
                                </span>
                              )}
                            </div>

                            <div className="absolute inset-0 ring-1 ring-inset ring-white/15 group-hover/card:ring-blue-400/40 rounded-2xl pointer-events-none transition-all duration-500" />
                          </div>
                        </div>

                        <div className="mt-2.5 px-1 text-center">
                          <h3 className="text-zinc-200 font-semibold text-xs sm:text-sm leading-tight line-clamp-1 group-hover/card:text-blue-400 transition-colors duration-300">
                            {part.title}
                          </h3>
                        </div>
                      </div>
                    </SpatialCard>
                  </Link>
                ))}
            </div>

            <div className="flex items-center justify-center gap-2 mt-4 text-zinc-400 text-[10px] md:hidden font-medium uppercase tracking-widest relative z-20">
              <span>Swipe Collection</span>
              <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-md">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              </div>
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-full mx-auto overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-black p-5 sm:p-7 md:p-9 shadow-2xl backdrop-blur-2xl"
        >
          <div className={`absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-br ${userRating! >= 8 ? 'from-emerald-500/15 via-amber-500/10' : userRating! >= 6 ? 'from-sky-500/15 via-blue-500/10' : userRating! >= 4 ? 'from-amber-500/15 via-orange-500/10' : 'from-rose-500/15 via-red-500/10'} to-transparent blur-3xl pointer-events-none transition-all duration-700`} />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-4 pb-6 mb-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-3.5">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-400/20 to-amber-500/5 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400/30 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Your Rating</h2>
                <p className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">User Assessment</p>
              </div>
            </div>

            {user && hasSavedRating && !editingRating && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Saved
              </span>
            )}
          </div>

          <div className="relative z-10">
            {user ? (
              <div className="space-y-6">
                {hasSavedRating && !editingRating ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4 px-2 sm:px-4"
                  >
                    <div className="relative flex-shrink-0 flex items-center justify-center w-40 h-40 sm:w-44 sm:h-44">
                      <div
                        className={`absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-700 ${userRating! >= 8
                          ? "bg-emerald-500"
                          : userRating! >= 6
                            ? "bg-sky-500"
                            : userRating! >= 4
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                      />

                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          className="stroke-zinc-800/80"
                          strokeWidth="6"
                          fill="transparent"
                        />
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="currentColor"
                          strokeWidth="6"
                          strokeLinecap="round"
                          fill="transparent"
                          strokeDasharray="263.89"
                          initial={{ strokeDashoffset: 263.89 }}
                          animate={{
                            strokeDashoffset: 263.89 - (263.89 * (userRating ?? 0)) / 10,
                          }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className={`transition-colors duration-500 ${userRating! >= 8
                            ? "text-emerald-400"
                            : userRating! >= 6
                              ? "text-sky-400"
                              : userRating! >= 4
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                        />
                      </svg>

                      <div className="absolute inset-3 rounded-full bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-white/10 flex flex-col items-center justify-center p-2 shadow-inner backdrop-blur-xl">
                        <motion.span
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 20 }}
                          className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400 tracking-tighter"
                        >
                          {userRating}
                        </motion.span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                          / 10 Stars
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center sm:items-start text-center sm:text-left space-y-4 w-full">
                      <div className="space-y-1.5 w-full">
                        <p className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                          Your Submitted Rating
                        </p>

                        {userRating !== null && (
                          <div>
                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 }}
                              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-md transition-all duration-300 ${userRating! >= 8
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10"
                                : userRating! >= 6
                                  ? "bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-sky-500/10"
                                  : userRating! >= 4
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/10"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-rose-500/10"
                                }`}
                            >
                              {userRating! >= 8.5 && (
                                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                              )}
                              <span>{getRatingDescription(userRating!)}</span>
                              {userRating! >= 8.5 && (
                                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                              )}
                            </motion.div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-2.5 w-full max-w-md pt-1">
                        <motion.button
                          onClick={handleRatingSubmit}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-zinc-950 font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
                        >
                          <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
                          <span className="truncate">Re-Submit</span>
                        </motion.button>

                        <motion.button
                          onClick={handleEditRating}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 shadow-md backdrop-blur-xl"
                        >
                          <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400/20 shrink-0" />
                          <span className="truncate">Edit Rating</span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-6"
                  >
                    <div className="p-4 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl flex justify-center">
                      <div className="grid grid-cols-5 sm:flex sm:flex-nowrap items-center justify-center gap-1.5 sm:gap-1.5 max-w-fit">
                        {[...Array(10)].map((_, index) => {
                          const starValue = index + 1;
                          const current = userRating ?? 0;
                          const isFull = current >= starValue;
                          const isHalf = current === starValue - 0.5;
                          const maskId = `star-gradient-${index}`;

                          return (
                            <div key={index} className="relative flex items-center justify-center">
                              <svg className="w-0 h-0 absolute" aria-hidden="true" focusable="false">
                                <defs>
                                  <linearGradient id={maskId} x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="50%" stopColor="#f59e0b" />
                                    <stop offset="50%" stopColor="#27272a" />
                                  </linearGradient>
                                </defs>
                              </svg>

                              <button
                                type="button"
                                onClick={() => handleRateMovie(starValue - 0.5)}
                                className="absolute left-0 top-0 w-1/2 h-full z-20 cursor-pointer outline-none"
                                aria-label={`Rate ${starValue - 0.5} stars`}
                              />
                              <button
                                type="button"
                                onClick={() => handleRateMovie(starValue)}
                                className="absolute right-0 top-0 w-1/2 h-full z-20 cursor-pointer outline-none"
                                aria-label={`Rate ${starValue} stars`}
                              />

                              <motion.div
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                className="relative p-1 cursor-pointer touch-none"
                              >
                                <Star
                                  className={`w-7 h-7 sm:w-7 sm:h-7 transition-all duration-200 ${isFull
                                    ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)] stroke-[1.5]"
                                    : isHalf
                                      ? "stroke-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] stroke-[1.5]"
                                      : "text-zinc-700 fill-zinc-900/50 stroke-[1.5]"
                                    }`}
                                  style={isHalf ? { fill: `url(#${maskId})` } : undefined}
                                />
                              </motion.div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col items-center space-y-2 min-h-[64px] justify-center">
                      {userRating !== null ? (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col items-center space-y-2"
                        >
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{userRating}</span>
                            <span className="text-zinc-500 font-bold text-xs uppercase tracking-wider">/ 10 Stars</span>
                          </div>
                          <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider backdrop-blur-md transition-all duration-300 ${userRating >= 8
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : userRating >= 6
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                              : userRating >= 4
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}>
                            {userRating >= 8.5 && <Sparkles className="w-3 h-3 animate-pulse text-amber-400" />}
                            <span>{getRatingDescription(userRating)}</span>
                            {userRating >= 8.5 && <Sparkles className="w-3 h-3 animate-pulse text-amber-400" />}
                          </div>
                        </motion.div>
                      ) : (
                        <span className="text-xs font-semibold text-zinc-500 tracking-wide uppercase">Select your rating from 1 to 10 stars</span>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2 sm:gap-3 pt-2 w-full max-w-xs sm:max-w-md mx-auto">
                      <motion.button
                        onClick={handleRatingSubmit}
                        disabled={userRating === null}
                        whileHover={{ scale: userRating !== null ? 1.02 : 1 }}
                        whileTap={{ scale: userRating !== null ? 0.98 : 1 }}
                        className={`flex-1 min-w-0 py-2.5 sm:py-3 px-3 sm:px-6 rounded-xl font-extrabold text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg ${userRating !== null
                          ? "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-zinc-950 shadow-amber-500/20 hover:shadow-amber-500/30 cursor-pointer"
                          : "bg-zinc-800/50 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-60"
                          }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] shrink-0" />
                        <span className="truncate">Submit</span>
                      </motion.button>

                      {hasSavedRating && (
                        <motion.button
                          onClick={handleCancelEditRating}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center shrink-0"
                        >
                          <span>Cancel</span>
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-8 text-center space-y-4"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800/80 shadow-inner">
                  <Star className="w-6 h-6 text-zinc-500 stroke-[1.75]" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-white text-base font-bold tracking-tight">Log in to rate this movie</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Share your rating and help improve personalized community charts.
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl bg-zinc-950 p-6 sm:p-8 text-zinc-100 border border-zinc-800/60 shadow-2xl font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Segoe_UI',Roboto,sans-serif] antialiased"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-zinc-800/40">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600 border border-emerald-400/30 text-white shrink-0 shadow-md">
                <SquarePen className="w-5 h-5 stroke-[1.75]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                  Your Review
                </h2>
                <p className="text-xs text-zinc-400 font-normal mt-0.5">
                  Write your thoughts or update your entry for this title
                </p>
              </div>
            </div>

            {userExistingReview && !isEditingUserReview && !isLoadingUserReview && (
              <div className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium tracking-wide">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                </span>
                <span>Review On File</span>
              </div>
            )}
          </div>

          {!user ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-zinc-800/40 bg-zinc-900/30">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 mb-3">
                <Lock className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">
                Sign In to Share Your Thoughts
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                Log in to write critiques, save entries, and join the conversation.
              </p>
            </div>
          ) : isLoadingUserReview ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-xs font-medium text-zinc-500 tracking-wide">
                Fetching review data...
              </span>
            </div>
          ) : userExistingReview && !isEditingUserReview ? (
            <div className="relative rounded-2xl bg-zinc-900/40 border border-zinc-800/50 p-5 overflow-hidden backdrop-blur-md">
              {userExistingReview.posterPath && (
                <div className="absolute top-0 right-0 bottom-0 w-1/3 opacity-10 pointer-events-none">
                  <img
                    src={`https://image.tmdb.org/t/p/w500${userExistingReview.posterPath}`}
                    alt=""
                    className="w-full h-full object-cover grayscale"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent to-zinc-950" />
                </div>
              )}

              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={userPhoto || '/user-icon.jpg'}
                      alt={userExistingReview.author}
                      className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                    />
                    <div>
                      <h4 className="text-xs font-medium text-zinc-200">
                        {userExistingReview.author}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-0.5">
                        <Calendar className="w-3 h-3 text-green-600 stroke-[1.75]" />
                        <span>
                          {userExistingReview.timestamp?.seconds
                            ? new Date(userExistingReview.timestamp.seconds * 1000).toLocaleDateString(
                              undefined,
                              { month: 'short', day: 'numeric', year: 'numeric' }
                            )
                            : 'Recently'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={handleEditUserReview}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
                      title="Edit review"
                    >
                      <Edit2 className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingReview}
                      onClick={handleDeleteUserReview}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all disabled:opacity-50"
                      title="Delete review"
                    >
                      {isDeletingReview ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 my-2">
                  <Quote className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5 scale-x-[-1] scale-y-[-1] stroke-[1.75]" />
                  <blockquote className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal italic">
                    {userExistingReview.content}
                  </blockquote>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40">
                  <span className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase bg-zinc-800/40 px-2.5 py-1 rounded-full border border-zinc-700/30">
                    {userExistingReview.mediaType === 'tv' ? 'TV Series' : 'Feature Film'}
                  </span>

                  {userExistingReview.rating && (
                    <div className="flex items-center gap-1 text-amber-400 font-semibold text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 stroke-none" />
                      <span>{userExistingReview.rating.toFixed(1)}</span>
                      <span className="text-zinc-600 font-normal">/ 10</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : isEditingUserReview ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl bg-zinc-900/60 border border-emerald-500/30 p-3.5 focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
                <textarea
                  className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none min-h-[110px] font-normal leading-relaxed"
                  rows={4}
                  value={editReviewContent}
                  onChange={(e) => setEditReviewContent(e.target.value)}
                  maxLength={1000}
                  placeholder="Edit your review content..."
                />
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                  <span>{editReviewContent.length} / 1000</span>
                  <span className="text-emerald-400 font-medium">Editing</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEditUserReview}
                  disabled={isUpdatingUserReview}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateUserReview}
                  disabled={editReviewContent.trim().length === 0 || isUpdatingUserReview}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 transition-all disabled:opacity-50"
                >
                  {isUpdatingUserReview ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                  <span>Save Update</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-3.5 focus-within:border-zinc-700 focus-within:bg-zinc-900/90 transition-all">
                <textarea
                  className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none min-h-[110px] font-normal leading-relaxed"
                  rows={4}
                  placeholder="What were your thoughts on the cinematography, pacing, or story structure?"
                  value={userReview}
                  onChange={(e) => setUserReview(e.target.value)}
                  maxLength={1000}
                />
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                  <span>{userReview.length} / 1000</span>
                  {userReview.length > 0 && (
                    <span className="text-emerald-400 font-medium">Ready</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-zinc-500 hidden sm:block font-normal">
                  Your review will be visible publicly to other users.
                </p>
                <button
                  type="button"
                  onClick={handleReviewSubmit}
                  disabled={userReview.trim().length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                >
                  <span>Post Review</span>
                  <Send className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              </div>
            </div>
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