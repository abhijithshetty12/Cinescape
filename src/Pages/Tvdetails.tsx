import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Star, Calendar, TvMinimalPlay, Clock, ImageOff, Image,
  Bookmark, BookmarkCheck, Check, Plus, Loader2, Play,
  Globe, Users, MessageCircle, Award, Sparkles, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, getDocs, query, deleteDoc, setDoc, doc } from 'firebase/firestore';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAutoLandscapeFullscreen } from '../hooks/useAutoLandscapeFullscreen.ts';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import { useWatchedStatus, WatchedItemData } from './History.tsx';
import confetti from 'canvas-confetti';
import { getTvEmbedUrls, PlayerSource } from '../utils/playerSources.ts';
import PlayerControl from '../components/PlayerControl.tsx';

interface TvShow {
  id: number;
  name: string;
  overview: string;
  language: string;
  creators: { id: number; name: string }[];
  first_air_date: string;
  genres: { id: number; name: string }[];
  seasons: { season_number: number; episode_count: number }[];
  vote_average: number;
  poster_path: string;
  cast: { id: number; name: string; role: string; profile_path: string }[] | null;
  reviews: { id: string; author: string; content: string }[];
  trailers: any[];
  images: { backdrops: { file_path: string }[] };
  country: string[];
  age_rating: string;
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

const SpatialCard = ({
  children,
  containerRef,
  index,
}: {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>;
  index: number;
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const { scrollXProgress } = useScroll({
    container: containerRef,
    target: itemRef,
    axis: 'x',
    offset: ['start end', 'end start'],
  });
  const x = useTransform(scrollXProgress, [0, 1], [16, -16]);

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.08 + index * 0.04 }}
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

const WatchedButton = ({
  show,
  onToast,
}: {
  show: TvShow;
  onToast: (msg: string) => void;
}) => {
  const movieData: WatchedItemData = {
    movieId: show.id,
    title: show.name,
    posterPath: show.poster_path ?? '',
    releaseDate: show.first_air_date,
    genres: show.genres.map((g) => g.name),
    mediaType: 'tv',
  };
  const { isWatched, loading: watchedLoading, toggleWatched } = useWatchedStatus(
    movieData.movieId,
    movieData.mediaType,
  );

  const handleClick = async () => {
    const result = await toggleWatched(movieData);
    if (result.success) {
      onToast(
        isWatched
          ? `Removed ${show.name} from watch history`
          : `Added ${show.name} to watch history`,
      );
    }
  };

  return (
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
      <span>{watchedLoading ? 'Loading...' : isWatched ? 'Watched' : 'Mark as Watched'}</span>
    </button>
  );
};

const TvDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  useAutoLandscapeFullscreen();

  const [show, setShow] = useState<TvShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [crew, setCrew] = useState<any[]>([]);
  const [activeGenreId, setActiveGenreId] = useState<number | null>(null);
  const [heroBackdropPath, setHeroBackdropPath] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({ message: '', type: 'success', isVisible: false });

  const [playerSource, setPlayerSource] = useState<PlayerSource>('vidsrc');
  const [userRating, setUserRating] = useState<number | null>(null);

  useEffect(() => {
    const fetchUserRating = async () => {
      if (!user || !id) return;
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const ratingDoc = await getDoc(doc(db, `users/${user.uid}/ratings`, id));
        if (ratingDoc.exists()) {
          setUserRating(ratingDoc.data().rating);
        }
      } catch {
        // Silently fail - rating will remain null
      }
    };
    fetchUserRating();
  }, [user, id]);

  const playerRef = useRef<HTMLDivElement>(null);
  const castContainerRef = useRef<HTMLDivElement>(null);
  const crewContainerRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isVisible: true });
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

  const handleRateShow = (rating: number) => {
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

  const handleRatingSubmit = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) { showToast('Please log in to rate this show', 'error'); return; }
    if (userRating === null || userRating < 0 || userRating > 10) {
      showToast('Rating must be between 0 and 10', 'error'); return;
    }
    try {
      if (!id) throw new Error('Missing TV show ID');
      await setDoc(doc(db, `users/${user.uid}/ratings`, id), {
        movieId: show?.id,
        title: show?.name,
        posterPath: show?.poster_path,
        rating: userRating,
        mediaType: "tv",
        timestamp: new Date(),
      });
      showToast('Rating submitted!', 'success');
    } catch {
      showToast('Failed to submit rating', 'error');
    }
  };

  useEffect(() => {
    const fetchShow = async () => {
      try {
        const [mainResp, creditsResp, extResp] = await Promise.all([
          axios.get(
            `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&append_to_response=credits,reviews,videos,images,content_ratings`,
          ),
          axios.get(`https://api.themoviedb.org/3/tv/${id}/credits?api_key=${TMDB_KEY}`),
          axios.get(`https://api.themoviedb.org/3/tv/${id}/external_ids?api_key=${TMDB_KEY}`),
        ]);

        const data = mainResp.data;
        const fullCast = creditsResp.data?.cast ?? [];
        const fullCrew = creditsResp.data?.crew ?? [];

        setCrew(fullCrew);

        const backdrops: { file_path: string }[] = data.images?.backdrops ?? [];

        if (backdrops.length > 0) {
          setHeroBackdropPath(
            `https://image.tmdb.org/t/p/original/${backdrops[Math.floor(Math.random() * backdrops.length)].file_path}`,
          );
        }

        setShow({
          id: data.id,
          name: data.name,
          language: data.original_language,
          creators: (data.created_by ?? []).map((c: any) => ({ id: c.id, name: c.name })),
          overview: data.overview,
          first_air_date: data.first_air_date,
          genres: data.genres ?? [],
          seasons: (data.seasons ?? []).map((s: any) => ({
            season_number: s.season_number,
            episode_count: s.episode_count,
          })),
          vote_average: data.vote_average,
          poster_path: data.poster_path,
          cast: fullCast.map((m: any) => ({
            id: m.id,
            name: m.name,
            role: m.character,
            profile_path: m.profile_path,
          })),
          reviews: (data.reviews?.results ?? [])
            .filter((r: any) => r.content.length < 300)
            .map((r: any) => ({ id: r.id, author: r.author, content: r.content })),
          trailers: data.videos?.results ?? [],
          images: { backdrops },
          country: Array.isArray(data.origin_country) ? data.origin_country : [],
          age_rating:
            data.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US')?.rating ||
            data.content_ratings?.results?.[0]?.rating ||
            'NR',
          imdb_id: extResp.data?.imdb_id ?? '',
        });

        if (data.seasons?.length > 0) {
          const latest = data.seasons.reduce((max: any, s: any) =>
            s.season_number > max.season_number ? s : max,
            data.seasons[0],
          );
          setSelectedSeason(latest.season_number);
          setSelectedEpisode(latest.episode_count);
        }
      } catch {
        setError('Failed to fetch TV show details.');
      } finally {
        setLoading(false);
      }
    };

    fetchShow();
  }, [id]);

  useEffect(() => {
    if (selectedSeason === null) {
      setEpisodes([]);
      setSelectedEpisode(null);
      return;
    }
    const fetchEpisodes = async () => {
      setEpisodesLoading(true);
      setEpisodesError(null);
      try {
        const resp = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${selectedSeason}?api_key=${TMDB_KEY}`,
        );
        setEpisodes(
          (resp.data.episodes ?? []).map((ep: any) => ({
            ...ep,
            still_url: ep.still_path
              ? `https://image.tmdb.org/t/p/w780${ep.still_path}`
              : null,
          })),
        );
      } catch {
        setEpisodesError('Failed to fetch episodes.');
      } finally {
        setEpisodesLoading(false);
      }
    };
    fetchEpisodes();
  }, [selectedSeason, id]);

  useEffect(() => {
    const checkWatchlist = async () => {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !show?.id) return;
      const ref = collection(db, 'users', currentUser.uid, 'watchlist');
      const snap = await getDocs(query(ref, where('movieId', '==', show.id)));
      setIsInWatchlist(snap.docs.length > 0);
    };
    checkWatchlist();
  }, [show?.id]);

  useEffect(() => {
    if (selectedEpisode !== null && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedEpisode]);

  const handleWatchlistToggle = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showToast('Please log in to add to watchlist', 'error');
      return;
    }
    const ref = collection(db, 'users', currentUser.uid, 'watchlist');
    try {
      const snap = await getDocs(query(ref, where('movieId', '==', show?.id)));
      if (snap.docs.length > 0) {
        await deleteDoc(snap.docs[0].ref);
        setIsInWatchlist(false);
        showToast('Removed from watchlist', 'info');
      } else {
        await addDoc(ref, {
          movieId: show?.id,
          title: show?.name,
          releaseDate: show?.first_air_date,
          genres: show?.genres.map((g) => g.name),
          posterPath: show?.poster_path,
          mediaType: 'tv',
        });
        setIsInWatchlist(true);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.8 },
          colors: ['#2563eb', '#3b82f6', '#60a5fa', '#1d4ed8'],
          ticks: 200,
          gravity: 1.2,
          scalar: 1.2,
        });
        showToast('Added to watchlist!', 'success');
      }
    } catch {
      showToast('Failed to update watchlist', 'error');
    }
  };

  const latestSeason = show?.seasons?.at(-1);
  const currentSeason = selectedSeason ?? latestSeason?.season_number;
  const currentEpisode = selectedEpisode ?? latestSeason?.episode_count;

  const embedUrls = useMemo(() => {
    const parsedId = id ?? '';
    const season = currentSeason ?? 0;
    const episode = currentEpisode ?? 0;
    return getTvEmbedUrls(parsedId, season, episode, show?.imdb_id ?? '');
  }, [id, currentSeason, currentEpisode, show?.imdb_id]);

  if (loading) return <Loading />;
  if (error || !show) return <p className="text-center text-red-500 py-20">{error}</p>;

  const language = LANGUAGE_MAP[show.language] ?? show.language ?? 'Unknown';
  const rating = show.vote_average?.toFixed(1) ?? 'N/A';
  const posterUrl = `https://image.tmdb.org/t/p/w780/${show.poster_path}`;

  const heroBackdrop = heroBackdropPath ?? posterUrl;

  const genres = show.genres ?? [];
  const segmentCount = genres.length;
  const segments = genres.map((g) => ({
    id: g.id,
    name: g.name,
    value: segmentCount ? 100 / segmentCount : 0,
  }));

  const CHART_COLORS = [
    '#8400ff', '#FF5500', '#00F0FF', '#ffcc00', '#ff0080',
    '#F4C2C2', '#995a2d', '#F97316', '#14B8A6', '#EF4444',
  ];

  const chartSize = 220;
  const strokeW = 26;
  const r = chartSize / 2 - strokeW;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const circumference = 2 * Math.PI * r;
  const gapPx = 4;

  const active = segments.find((s) => s.id === activeGenreId) ?? null;
  const fallback = segments[0] ?? null;
  const centerLabel = active?.name ?? fallback?.name ?? 'Genre Mix';
  const centerPct = active?.value ?? fallback?.value ?? 0;

  const playerSrc = embedUrls[playerSource];

  const groupedCrew: Record<string, any> = {};
  crew.forEach((m) => {
    if (!groupedCrew[m.id]) {
      groupedCrew[m.id] = { ...m, jobs: [m.job] };
    } else if (!groupedCrew[m.id].jobs.includes(m.job)) {
      groupedCrew[m.id].jobs.push(m.job);
    }
  });

  const jobTier = (jobs: string[]) => {
    if (jobs.includes('Director')) return { rank: 1, label: 'Directors' };
    if (jobs.some((j) => ['Writer', 'Screenplay', 'Story'].includes(j)))
      return { rank: 2, label: 'Writers' };
    if (jobs.includes('Producer')) return { rank: 3, label: 'Producers' };
    return { rank: 4, label: 'Crew' };
  };

  const crewArr = Object.values(groupedCrew).sort((a: any, b: any) => {
    const diff = jobTier(a.jobs).rank - jobTier(b.jobs).rank;
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
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
                  {show.poster_path ? (
                    <img
                      src={posterUrl}
                      alt={show.name}
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
                  <span className="text-white font-semibold text-sm">{rating}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                  <Calendar className="w-4 h-4 text-green-500" />
                  <span className="text-white/80 font-medium text-sm">{show.first_air_date}</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                  <span className="text-white/80 font-semibold text-xs uppercase tracking-wider">
                    {show.age_rating}
                  </span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 leading-tight tracking-tight"
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  {show.name}
                </span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap justify-center md:justify-start gap-2 mb-6"
              >
                {show.genres.map((g) => (
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
                <WatchedButton show={show} onToast={(m) => showToast(m, 'success')} />

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

      <div className="container mx-auto px-4 py-10 space-y-10">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="lg:col-span-5 relative overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-950/40 p-6 sm:p-8 backdrop-blur-xl hover:border-white/[0.12] hover:bg-zinc-950/50 transition-all duration-300"
          >
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">Vibe Chart</h2>
              <p className="text-xs text-zinc-500 font-medium">Hover a segment</p>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row md:justify-start">
              <div
                className="relative flex flex-shrink-0 items-center justify-center w-full max-w-[220px]"
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
                      const dashArray = `${adjusted} ${circumference - adjusted}`;
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
                          strokeDasharray={dashArray}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-6">
                  <span className="w-full text-[11px] font-medium tracking-wider text-zinc-400 uppercase max-w-[140px] truncate transition-all duration-300">
                    {centerLabel}
                  </span>
                  <span className="text-3xl font-bold tracking-tight text-white mt-0.5 tabular-nums">
                    {centerPct.toFixed(0)}%
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
                      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${isActive
                        ? 'border-white/[0.08] bg-white/[0.04]'
                        : 'border-transparent hover:bg-white/[0.01]'
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

          <div className="lg:col-span-7 space-y-6">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/[0.06] p-6 md:p-8"
            >
              <h2 className="text-xl font-bold tracking-tight text-white mb-3">Synopsis</h2>
              <p className="text-zinc-400 text-sm md:text-base leading-relaxed">{show.overview}</p>

              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 mb-5">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Show Info</h3>
                </div>

                <div className="bg-zinc-900/40 backdrop-blur-xl rounded-2xl p-6 border border-zinc-800/80 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-zinc-700/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Language</span>
                      <span className="text-zinc-200 font-bold text-sm tracking-wide">{language}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">First Air Date</span>
                      <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
                        <Calendar className="w-4 h-4 text-emerald-500/80" />
                        <span>{show.first_air_date}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Age Rating</span>
                      <span className="inline-block bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 rounded-md px-2 py-0.5 text-xs font-bold mt-0.5">
                        {show.age_rating}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Country</span>
                      <span className="text-zinc-200 font-bold text-sm truncate tracking-wide">
                        {show.country.length ? show.country.join(', ') : 'Unknown'}
                      </span>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Created By</span>
                      <span className="text-zinc-200 font-bold text-sm truncate tracking-wide">
                        {show.creators.length ? show.creators.map((c) => c.name).join(', ') : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative bg-zinc-950/20 backdrop-blur-3xl rounded-3xl p-6 border border-white/[0.03] shadow-[0_16px_48px_rgba(0,0,0,0.4)] overflow-hidden">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 px-1">
              Production Media & Trailers
            </h3>

            {show.trailers.length === 0 && show.images.backdrops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                <Image className="w-10 h-10 mb-2 stroke-[1.25]" />
                <span className="text-xs font-medium">No production media available</span>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent snap-x snap-mandatory scroll-smooth">
                {show.trailers.slice(0, 3).map((trailer) => (
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

                {show.images.backdrops.map((image) => (
                  <div key={image.file_path} className="flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[32%] snap-start">
                    <div className="aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-900 shadow-lg shadow-black/40 group/slide cursor-zoom-in">
                      <img
                        src={`https://image.tmdb.org/t/p/w780/${image.file_path}`}
                        alt="Series still"
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
          ref={playerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-zinc-900/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/[0.06] shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <TvMinimalPlay className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {selectedEpisode !== null
                  ? `Watch S${selectedSeason} E${selectedEpisode}`
                  : 'Watch Series'}
              </h2>
            </div>
            <PlayerControl source={playerSource} onChange={setPlayerSource} />
          </div>

          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/10 mb-4 shadow-[inset_0_1px_1px_rgba(59,130,246,0.1)]">
            <div className="flex items-center justify-center w-5 h-5 rounded-full border border-blue-400/40 bg-blue-500/10 flex-shrink-0 text-[11px] font-extrabold text-blue-400 select-none mt-0.5">
              i
            </div>
            <p className="text-zinc-400 text-[12px] leading-relaxed font-medium">
              Watch series in <span className="text-blue-400 font-semibold">full screen mode</span> to avoid irritating ads and unexpected popups.
            </p>
          </div>

          <div className="rounded-xl overflow-hidden bg-zinc-950 aspect-video relative w-full border border-white/[0.04] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.7)]">
            {playerSrc ? (
              <iframe
                src={playerSrc}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="fullscreen; picture-in-picture; autoplay; orientation-lock"
                title="TV Show Player"
                className="absolute inset-0 w-full h-full"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                <TvMinimalPlay className="w-10 h-10 mb-2 opacity-30" />
                <span className="text-xs font-medium">No episodes available</span>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-zinc-900/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/[0.06] shadow-2xl shadow-black/40"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <TvMinimalPlay className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Seasons</h2>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  {selectedSeason !== null
                    ? `Season ${selectedSeason} · ${show.seasons.find((s) => s.season_number === selectedSeason)?.episode_count ?? 0} Episodes`
                    : 'Select a season'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none snap-x">
            {show.seasons.map((season) => {
              const sel = selectedSeason === season.season_number;
              return (
                <button
                  key={season.season_number}
                  onClick={() => {
                    setSelectedSeason(season.season_number);
                    setSelectedEpisode(null);
                  }}
                  className={`snap-start px-4 py-2 rounded-xl font-bold flex-shrink-0 flex items-center gap-2.5 transition-all duration-300 text-xs uppercase tracking-wider border ${sel
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/15'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800/60 border-white/[0.04]'
                    }`}
                >
                  <span>Season {season.season_number}</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${sel ? 'bg-black/20 text-blue-100' : 'bg-white/[0.04] text-zinc-500'}`}>
                    {season.episode_count}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedSeason !== null && (
            <div className="min-h-[100px]">
              {episodesLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              )}
              {episodesError && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-red-400 text-center text-xs font-semibold">
                  {episodesError}
                </div>
              )}
              {!episodesLoading && !episodesError && episodes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {episodes.map((ep) => {
                    const sel = selectedEpisode === ep.episode_number;
                    return (
                      <div
                        key={ep.id}
                        onClick={() => setSelectedEpisode(ep.episode_number)}
                        className={`group flex items-start gap-3.5 p-3 rounded-xl cursor-pointer border transition-all duration-300 ${sel
                          ? 'border-blue-500 bg-blue-500/[0.04] shadow-md shadow-blue-500/5'
                          : 'bg-zinc-900/20 border-white/[0.04] hover:border-white/[0.08] hover:bg-zinc-800/30'
                          }`}
                      >
                        <div className="relative w-24 sm:w-28 md:w-32 flex-shrink-0 aspect-video rounded-lg overflow-hidden bg-zinc-950 border border-white/[0.04]">
                          {ep.still_url ? (
                            <img
                              src={ep.still_url}
                              alt={ep.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700">
                              <ImageOff className="w-5 h-5 stroke-[1.5]" />
                            </div>
                          )}
                          <div className={`absolute inset-0 bg-zinc-950/60 backdrop-blur-[1px] transition-opacity duration-300 flex items-center justify-center ${sel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-300 ${sel ? 'bg-blue-500 text-white' : 'bg-white/10 text-white'}`}>
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 bg-zinc-950/40 backdrop-blur-md rounded-md px-2 py-0.5 border border-white/[0.08] z-10 flex items-center gap-1">
                            <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase">EP</span>
                            <span className="text-[10px] font-mono font-black text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                              {ep.episode_number}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <h4 className={`font-bold text-xs sm:text-sm truncate transition-colors ${sel ? 'text-blue-400' : 'text-zinc-200 group-hover:text-white'}`}>
                            {ep.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-500 font-mono mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-green-600" />
                              {ep.air_date
                                ? new Date(ep.air_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                                : 'TBA'}
                            </span>
                            {ep.runtime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-600" />
                                {ep.runtime}m
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-normal line-clamp-2 mt-1.5">
                            {ep.overview || 'No synopsis available.'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
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
            <div className="flex gap-4 sm:gap-5 px-1 items-stretch">
              {show.cast?.map((actor, idx) => (
                <Link key={actor.id} to={`/actor/${actor.id}`} className="flex-shrink-0 snap-start group/card h-full">
                  <SpatialCard containerRef={castContainerRef} index={idx}>
                    <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] h-full flex flex-col justify-between transition-all duration-500 group-hover/card:bg-white/[0.04] group-hover/card:border-blue-500/30 group-hover/card:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                      <div className="absolute -top-10 -left-10 w-28 h-28 bg-blue-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-blue-500 transition-all duration-500 pointer-events-none" />

                      <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl bg-zinc-950 border border-white/[0.04] group-hover/card:border-blue-500/30 transition-colors duration-500">

                        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/15 to-transparent -translate-x-full -translate-y-full group-hover/card:translate-x-full group-hover/card:translate-y-full transition-transform duration-1000 ease-in-out z-10 pointer-events-none" />

                        {actor.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w780${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full h-full object-cover grayscale-[30%] opacity-80 group-hover/card:grayscale-0 group-hover/card:opacity-100 transition-all duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                            <ImageOff className="w-7 h-7 mb-1.5 opacity-30" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">No Photo</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 via-transparent to-transparent pointer-events-none" />
                      </div>

                      <div className="px-3 pb-3 pt-1 flex flex-col items-center text-center min-h-[70px]">
                        <h3 className="font-extrabold text-xs sm:text-sm text-zinc-300 tracking-tight line-clamp-1 group-hover/card:text-white transition-colors duration-300 w-full">
                          {actor.name}
                        </h3>
                        <div className="mt-1 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] group-hover/card:border-blue-500/20 group-hover/card:bg-blue-500/[0.06] transition-all duration-300 inline-flex items-center max-w-full">
                          <p className="text-[10px] text-zinc-500 group-hover/card:text-blue-400 font-semibold tracking-wide line-clamp-1 transition-colors duration-300">
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
          transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-10 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_32px_64px_rgba(0,0,0,0.7)] overflow-hidden"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />

          <div className="relative z-10 mb-7">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                  <Award className="w-5 h-5 text-amber-400 stroke-[1.5]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-amber-500/70 tracking-[0.3em] uppercase block mb-1">Production Team</span>
                  <h2 className="text-2xl font-black text-white tracking-tight">Crew</h2>
                </div>
              </div>
              <span className="hidden sm:block text-[11px] font-mono text-zinc-600 tabular-nums pb-0.5">
                {crewArr.length.toString().padStart(2, '0')} credited
              </span>
            </div>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-10 z-20 bg-gradient-to-r from-zinc-950/70 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 z-20 bg-gradient-to-l from-zinc-950/70 to-transparent" />

            <div
              ref={crewContainerRef}
              className="overflow-x-auto pb-4 snap-x snap-proximity scroll-smooth relative z-10"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="flex gap-0 items-start">
                {(() => {
                  let lastRank = 0;
                  const nodes: React.ReactNode[] = [];

                  crewArr.forEach((member: any, idx: number) => {
                    const tier = jobTier(member.jobs);

                    if (tier.rank !== lastRank) {
                      lastRank = tier.rank;
                      nodes.push(
                        <div
                          key={`divider-${tier.label}`}
                          className="flex-shrink-0 snap-start flex items-center h-[240px] sm:h-[280px] mr-4 sm:mr-6"
                        >
                          <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                          <div className="flex items-center pl-2.5 pr-1">
                            <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-amber-500/60 -rotate-90 whitespace-nowrap">
                              {tier.label}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    nodes.push(
                      <Link
                        key={member.credit_id}
                        to={`/actor/${member.id}`}
                        className="flex-shrink-0 snap-start group/card block w-[135px] sm:w-[165px] mr-4 sm:mr-5"
                        aria-label={`${member.name}, ${member.jobs.join(', ')}`}
                      >
                        <SpatialCard containerRef={crewContainerRef} index={idx}>
                          <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] p-2 overflow-hidden flex flex-col justify-between transition-all duration-500 group-hover/card:-translate-y-1.5 group-hover/card:bg-white/[0.05] group-hover/card:border-amber-500/30 group-hover/card:shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
                            <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-amber-500/10 transition-all duration-700 pointer-events-none" />

                            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-amber-500/30 transition-colors duration-500">
                              {member.profile_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w780${member.profile_path}`}
                                  alt={member.name}
                                  className="w-full h-full object-cover object-top grayscale-[35%] opacity-80 group-hover/card:grayscale-0 group-hover/card:opacity-100 group-hover/card:scale-105 transition-all duration-700"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                                  <ImageOff className="w-6 h-6 mb-1.5 opacity-30" />
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">No Photo</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent pointer-events-none" />
                            </div>

                            <div className="px-1 pt-2.5 pb-1 flex flex-col items-center text-center gap-1.5">
                              <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight line-clamp-1 group-hover/card:text-amber-300 transition-colors duration-300 w-full">
                                {member.name}
                              </h3>
                              <div className="w-full px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] group-hover/card:border-amber-500/20 group-hover/card:bg-amber-500/10 transition-all duration-300 inline-flex items-center justify-center">
                                <p className="text-[10px] font-mono text-zinc-400 group-hover/card:text-amber-300 font-semibold tracking-wide line-clamp-1 transition-colors duration-300">
                                  {member.jobs.slice(0, 2).join(' · ')}
                                  {member.jobs.length > 2 && ` +${member.jobs.length - 2}`}
                                </p>
                              </div>
                              <div className="h-px w-0 bg-amber-500/60 group-hover/card:w-full transition-all duration-500 mt-0.5" />
                            </div>
                          </div>
                        </SpatialCard>
                      </Link>
                    );
                  });

                  return nodes;
                })()}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-5 text-zinc-500 text-[10px] md:hidden font-mono uppercase tracking-[0.2em]">
            <span>Scroll for full credits</span>
            <div className="w-4 h-4 border border-zinc-800 rounded-full flex items-center justify-center bg-zinc-950/40">
              <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.section>

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
                            onClick={() => handleRateShow(starValue - 0.5)}
                            className="absolute left-0 top-0 w-1/2 h-full z-20 bg-transparent border-none outline-none cursor-pointer"
                            aria-label={`Rate ${starValue - 0.5} stars`}
                          />
                          <button
                            onClick={() => handleRateShow(starValue)}
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
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">User Reviews</h2>
          </div>
          <div className="space-y-4">
            {show.reviews.length > 0 ? (
              show.reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {review.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white">{review.author}</h3>
                  </div>
                  <p className="text-white/70 leading-relaxed text-sm">{review.content}</p>
                </div>
              ))
            ) : (
              <p className="text-white/50 text-center py-8">No reviews available yet.</p>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default TvDetails;