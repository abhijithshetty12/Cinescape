import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Star, Calendar, Bookmark, ThumbsDown, ThumbsUp, BookmarkCheck, TvMinimalPlay, ImageOff, Check, Plus, Loader2, Play, Users, Award, MessageCircle, MoreHorizontal, Edit2, Trash2, Quote, Lock, Send, SquarePen, Share2, Heart, ListChecks, RotateCcw, CalendarDays, ChevronLeft, ChevronRight, X, CheckCheck, Info, ExternalLink, Pencil, Bell, EyeOff, } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { getAuth } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { collection, addDoc, query, setDoc, doc, getDocs, deleteDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAutoLandscapeFullscreen } from '../hooks/useAutoLandscapeFullscreen.ts';
import Toast from '../components/Toast.tsx';
import Loading from '../components/Loading.tsx';
import ShareSheet from '../components/ShareSheet.tsx';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { enqueueWatchlistOp, registerWatchlistSync } from '../utils/watchlistQueue.ts';
import { getTvEmbedUrls, PlayerSource } from '../utils/playerSources.ts';
import PlayerControl from '../components/PlayerControl.tsx';
import SimilarTitles from '../components/SimilarTitles.tsx';
import ProductionMediaTrailers from '../components/ProductionMediaTrailers.tsx';
import MediaRating from '../components/MediaRating.tsx';

interface TvShow {
  id: number;
  name: string;
  original_name?: string;
  overview: string;
  language: string;
  creators: { id: number; name: string }[];
  first_air_date: string;
  last_air_date?: string;
  next_episode_to_air?: { air_date?: string; episode_number?: number; season_number?: number; name?: string } | null;
  genres: { id: number; name: string }[];
  seasons: { id?: number; name?: string; season_number: number; episode_count: number; poster_path?: string | null; air_date?: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  vote_average: number;
  poster_path: string;
  cast: { id: number; name: string; role: string; profile_path: string; category?: string }[] | null;
  reviews: { id: string; author: string; content: string; likes?: number; dislikes?: number }[];
  trailers: { key: string; name: string }[];
  images: { backdrops: { file_path: string }[]; posters: { file_path: string }[] };
  country: string[];
  age_rating: string;
  imdb_id: string;
  status?: string;
  homepage?: string;
  productionCompanies?: { id: number; name: string; logo_path?: string | null; origin_country?: string }[];
  productionCountries?: { iso_3166_1: string; name: string }[];
  networks?: { id: number; name: string; logo_path?: string | null; origin_country?: string }[];
  watchProviders?: Record<string, any>;
}

interface MyListFolder {
  id: string;
  name: string;
  posterPaths?: string[];
}

const TMDB_KEY = '859afbb4b98e3b467da9c99ac390e950';
const LAST_EPISODE_KEY_PREFIX = 'cinescape_tv_last_episode_v1';

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

const ProgressiveImage = ({
  src,
  lowSrc,
  alt,
  className = '',
  wrapperClassName = '',
  eager = false,
}: {
  src: string;
  lowSrc?: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  eager?: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {lowSrc && <img src={lowSrc} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full scale-105 object-cover blur-xl transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-70'}`} />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};

type WatchActionMode = 'mark' | 'change' | 'rewatch';
type WatchMenuStep = 'root' | 'date-options' | 'calendar';

const valueToDate = (value: any) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const watchedMillis = (value: any) => valueToDate(value)?.getTime() || 0;

const normalizeWatchedDates = (values: any[], fallback?: any) => {
  const dates = (Array.isArray(values) ? values : [])
    .map((value) => valueToDate(value))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.toISOString());
  const fallbackDate = valueToDate(fallback);
  if (fallbackDate) {
    const iso = fallbackDate.toISOString();
    if (!dates.includes(iso)) dates.push(iso);
  }
  return [...new Set(dates)].sort((a, b) => watchedMillis(a) - watchedMillis(b));
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const keyToDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const formatWatchDate = (value: any) => {
  const date = valueToDate(value);
  if (!date) return 'Unknown date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const countryFlag = (code?: string) => code && code.length === 2
  ? String.fromCodePoint(...code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0)))
  : '🌐';

const buildCalendarDays = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const WatchedButton = ({
  show,
  onSync,
  onToast,
}: {
  show: TvShow;
  onSync: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const { user } = useAuth();
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [watchedDates, setWatchedDates] = useState<string[]>([]);
  const [watchedLoading, setWatchedLoading] = useState(false);
  const [showWatchMenu, setShowWatchMenu] = useState(false);
  const [watchMenuStep, setWatchMenuStep] = useState<WatchMenuStep>('root');
  const [watchActionMode, setWatchActionMode] = useState<WatchActionMode>('mark');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(new Date()));

  const isWatched = Boolean(historyDocId);
  const watchCount = watchedDates.length;
  const latestWatchDate = watchCount ? watchedDates[watchCount - 1] : null;

  useEffect(() => {
    if (!user?.uid || !show.id) {
      setHistoryDocId(null);
      setWatchedDates([]);
      return;
    }
    const historyRef = collection(db, `users/${user.uid}/history`);
    const historyQuery = query(historyRef, where('movieId', '==', show.id));
    return onSnapshot(historyQuery, (snapshot) => {
      const match = snapshot.docs.find((historyDoc) => historyDoc.data().mediaType === 'tv');
      if (!match) {
        setHistoryDocId(null);
        setWatchedDates([]);
        return;
      }
      const data = match.data();
      const dates = normalizeWatchedDates(data.watchedDates || [], data.watchedDate ?? data.timestamp ?? data.createdAt);
      setHistoryDocId(match.id);
      setWatchedDates(dates);
    }, () => {
      setHistoryDocId(null);
      setWatchedDates([]);
    });
  }, [user?.uid, show.id]);

  const closeWatchMenu = () => {
    setShowWatchMenu(false);
    setWatchMenuStep('root');
    setWatchActionMode(isWatched ? 'change' : 'mark');
  };

  const openDateOptions = (mode: WatchActionMode) => {
    setWatchActionMode(mode);
    setWatchMenuStep('date-options');
  };

  const openCalendar = () => {
    const initial = watchActionMode === 'change' && latestWatchDate ? valueToDate(latestWatchDate) || new Date() : new Date();
    setSelectedDateKey(dateKey(initial));
    setCalendarMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setWatchMenuStep('calendar');
  };

  const removeFromWatchlist = async () => {
    if (!user?.uid) return;
    const watchlistRef = collection(db, `users/${user.uid}/watchlist`);
    const snapshot = await getDocs(query(watchlistRef, where('movieId', '==', show.id)));
    const tvDocs = snapshot.docs.filter((watchDoc) => watchDoc.data().mediaType === 'tv');
    if (tvDocs.length) await Promise.all(tvDocs.map((watchDoc) => deleteDoc(watchDoc.ref)));
  };

  const saveWatchEvent = async (date: Date, mode: WatchActionMode) => {
    if (!user?.uid) {
      onToast('Please log in to update watch history', 'error');
      return;
    }
    setWatchedLoading(true);
    try {
      const iso = date.toISOString();
      const nextDates = [...watchedDates];
      if (mode === 'rewatch') {
        nextDates.push(iso);
      } else if (mode === 'change' && nextDates.length) {
        nextDates[nextDates.length - 1] = iso;
      } else if (!nextDates.length) {
        nextDates.push(iso);
      }
      const normalized = normalizeWatchedDates(nextDates);
      const latest = normalized[normalized.length - 1] || iso;
      const payload = {
        movieId: show.id,
        mediaId: show.id,
        title: show.name,
        posterPath: show.poster_path ?? '',
        releaseDate: show.first_air_date,
        genres: show.genres?.map((genre) => genre.name) ?? [],
        mediaType: 'tv' as const,
        watchedDate: latest,
        watchedDates: normalized,
        timestamp: serverTimestamp(),
      };
      if (historyDocId) {
        await updateDoc(doc(db, `users/${user.uid}/history/${historyDocId}`), payload);
      } else {
        const historyRef = collection(db, `users/${user.uid}/history`);
        await addDoc(historyRef, payload);
      }
      if (mode === 'mark' || mode === 'rewatch') await removeFromWatchlist();
      if (mode !== 'change') {
        confetti({
          particleCount: mode === 'rewatch' ? 90 : 130,
          spread: 68,
          origin: { y: 0.82 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#059669'],
          ticks: 170,
          gravity: 1.15,
          scalar: 1.05,
        });
      }
      onSync();
      onToast(
        mode === 'rewatch'
          ? `Rewatch added for ${show.name} · update your rating if it changed`
          : mode === 'change'
            ? `Watch date updated for ${show.name}`
            : `Added ${show.name} to history`,
        'success',
      );
      closeWatchMenu();
    } catch {
      onToast('Failed to update watch history', 'error');
    } finally {
      setWatchedLoading(false);
    }
  };

  const removeFromHistory = async () => {
    if (!user?.uid || !historyDocId) return;
    setWatchedLoading(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/history/${historyDocId}`));
      onSync();
      onToast(`Removed ${show.name} from history`, 'info');
      closeWatchMenu();
    } catch {
      onToast('Failed to remove from history', 'error');
    } finally {
      setWatchedLoading(false);
    }
  };

  const releaseDate = show.first_air_date ? new Date(`${show.first_air_date}T12:00:00`) : null;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const validReleaseDate = releaseDate && !Number.isNaN(releaseDate.getTime()) && releaseDate <= todayEnd ? releaseDate : null;
  const calendarDays = buildCalendarDays(calendarMonth);
  const currentMonth = new Date();
  const canGoNextMonth = calendarMonth.getFullYear() < currentMonth.getFullYear() || (calendarMonth.getFullYear() === currentMonth.getFullYear() && calendarMonth.getMonth() < currentMonth.getMonth());

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowWatchMenu(true);
          if (isWatched) {
            setWatchMenuStep('root');
            setWatchActionMode('change');
          } else {
            openDateOptions('mark');
          }
        }}
        disabled={watchedLoading}
        className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${isWatched
          ? 'border border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30 hover:from-emerald-600 hover:to-teal-600'
          : 'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-black/40 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white'
          } ${watchedLoading ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
        {watchedLoading ? (
          <Loader2 className="relative z-10 h-5 w-5 animate-spin md:h-4 md:w-4" />
        ) : isWatched ? (
          <CheckCheck className="relative z-10 h-5 w-5 stroke-[3] text-emerald-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.8)] md:h-4 md:w-4" />
        ) : (
          <Check className="relative z-10 h-5 w-5 text-zinc-400 transition-colors duration-300 group-hover:text-emerald-500 md:h-4 md:w-4" />
        )}
        <span className="relative z-10 hidden md:inline">
          {watchedLoading ? 'Updating…' : isWatched ? `Watched · ${latestWatchDate ? formatWatchDate(latestWatchDate).replace(/, \d{4}/, '') : ''}` : 'Mark as Watched'}
        </span>
        {isWatched && watchCount > 1 && (
          <span className="absolute -right-1 -top-1 rounded-full border border-white/15 bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black leading-none text-white shadow-md shadow-emerald-500/20 md:static md:rounded-md md:bg-black/15 md:text-[9px] md:text-emerald-100">
            ×{watchCount}
          </span>
        )}
      </button>

      {showWatchMenu && createPortal(
        <div className="fixed inset-0 z-[10040] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close watch options" onClick={closeWatchMenu} className="absolute inset-0 bg-black/70 backdrop-blur-xl sm:bg-black/55" />
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.72)] sm:rounded-[30px]"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {show.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${show.poster_path}`} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-4 w-4 text-zinc-600" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{show.name}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">TV Show{show.first_air_date ? ` · ${show.first_air_date.slice(0, 4)}` : ''}</p>
                {isWatched && latestWatchDate && <p className="mt-1 text-[10px] text-zinc-400">Latest watch · {formatWatchDate(latestWatchDate)}{watchCount > 1 ? ` · ${watchCount} watches` : ''}</p>}
              </div>
              <button type="button" onClick={closeWatchMenu} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {watchMenuStep === 'root' && (
                <div className="space-y-2">
                  <button type="button" onClick={() => openDateOptions('change')} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5 text-left transition hover:bg-white/[0.06]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10 text-amber-300"><CalendarDays className="h-4 w-4" /></span>
                    <span><span className="block text-xs font-black text-white">Change watch date</span><span className="mt-0.5 block text-[10px] text-zinc-500">Update your latest watch event</span></span>
                  </button>
                  <button type="button" onClick={() => openDateOptions('rewatch')} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5 text-left transition hover:bg-white/[0.06]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/10 text-cyan-300"><RotateCcw className="h-4 w-4" /></span>
                    <span><span className="block text-xs font-black text-white">Add rewatch</span><span className="mt-0.5 block text-[10px] text-zinc-500">Keep the previous watch dates too</span></span>
                  </button>
                  <button type="button" onClick={removeFromHistory} className="flex w-full items-center gap-3 rounded-2xl border border-red-500/10 bg-red-500/[0.045] p-3.5 text-left transition hover:bg-red-500/[0.08]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/15 bg-red-500/10 text-red-400"><Trash2 className="h-4 w-4" /></span>
                    <span><span className="block text-xs font-black text-red-300">Remove from History</span><span className="mt-0.5 block text-[10px] text-zinc-500">Delete all watch dates for this TV show</span></span>
                  </button>
                </div>
              )}

              {watchMenuStep === 'date-options' && (
                <div>
                  {isWatched && <button type="button" onClick={() => setWatchMenuStep('root')} className="mb-3 flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" />Back</button>}
                  <div className="mb-3 px-1">
                    <h3 className="text-sm font-black text-white">{watchActionMode === 'rewatch' ? 'When did you rewatch it?' : watchActionMode === 'change' ? 'Change watch date' : 'When did you watch it?'}</h3>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Choose a quick date or open the calendar.</p>
                  </div>
                  <div className="space-y-2">
                    <button type="button" onClick={() => saveWatchEvent(new Date(), watchActionMode)} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5 text-left hover:bg-white/[0.065]">
                      <span className="text-xs font-black text-white">Just Now</span><span className="text-[10px] text-zinc-500">Today</span>
                    </button>
                    <button type="button" disabled={!validReleaseDate} onClick={() => validReleaseDate && saveWatchEvent(validReleaseDate, watchActionMode)} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3.5 text-left hover:bg-white/[0.065] disabled:cursor-not-allowed disabled:opacity-35">
                      <span className="text-xs font-black text-white">First Air Date</span><span className="text-[10px] text-zinc-500">{validReleaseDate ? formatWatchDate(validReleaseDate) : 'Unavailable'}</span>
                    </button>
                    <button type="button" onClick={openCalendar} className="flex w-full items-center justify-between rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] px-4 py-3.5 text-left hover:bg-emerald-400/[0.09]">
                      <span className="flex items-center gap-2 text-xs font-black text-emerald-300"><CalendarDays className="h-4 w-4" />Choose Date</span><ChevronRight className="h-4 w-4 text-zinc-600" />
                    </button>
                  </div>
                </div>
              )}

              {watchMenuStep === 'calendar' && (
                <div>
                  <button type="button" onClick={() => setWatchMenuStep('date-options')} className="mb-3 flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" />Back</button>
                  <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2">
                    <button type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-xs font-black text-white">{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                    <button type="button" disabled={!canGoNextMonth} onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-25"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[9px] font-black text-zinc-600">{day}</span>)}
                    {calendarDays.map((date) => {
                      const key = dateKey(date);
                      const outsideMonth = date.getMonth() !== calendarMonth.getMonth();
                      const future = date > todayEnd;
                      const selected = selectedDateKey === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          disabled={future}
                          onClick={() => setSelectedDateKey(key)}
                          className={`aspect-square rounded-xl text-[10px] font-bold transition ${selected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : outsideMonth ? 'text-zinc-700 hover:bg-white/[0.04]' : 'text-zinc-300 hover:bg-white/[0.06]'} disabled:cursor-not-allowed disabled:opacity-20`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-center text-[10px] font-semibold text-zinc-400">Selected · {formatWatchDate(keyToDate(selectedDateKey))}</div>
                  <button type="button" onClick={() => saveWatchEvent(keyToDate(selectedDateKey), watchActionMode)} className="mt-3 w-full rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-3.5 text-xs font-black text-white shadow-lg shadow-emerald-500/20 active:scale-[0.99]">{watchActionMode === 'rewatch' ? 'Add Rewatch' : watchActionMode === 'change' ? 'Update Watch Date' : 'Mark as Watched'}</button>
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}
    </>
  );
};


const WatchHistoryPill = ({
  show,
  onToast,
}: {
  show: TvShow;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const { user } = useAuth();
  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editMonth, setEditMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(new Date()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid || !show.id) {
      setHistoryDocId(null);
      setDates([]);
      return;
    }
    const ref = collection(db, `users/${user.uid}/history`);
    return onSnapshot(query(ref, where('movieId', '==', show.id)), (snapshot) => {
      const match = snapshot.docs.find((entry) => entry.data().mediaType === 'tv');
      if (!match) {
        setHistoryDocId(null);
        setDates([]);
        return;
      }
      const data = match.data();
      setHistoryDocId(match.id);
      setDates(normalizeWatchedDates(data.watchedDates || [], data.watchedDate ?? data.timestamp ?? data.createdAt));
    });
  }, [user?.uid, show.id]);

  if (!historyDocId || !dates.length) return null;

  const latest = dates[dates.length - 1];
  const calendarDays = buildCalendarDays(editMonth);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const canGoNextMonth = editMonth.getFullYear() < todayEnd.getFullYear() || (editMonth.getFullYear() === todayEnd.getFullYear() && editMonth.getMonth() < todayEnd.getMonth());

  const startEdit = (index: number) => {
    const current = valueToDate(dates[index]) || new Date();
    setEditingIndex(index);
    setSelectedDateKey(dateKey(current));
    setEditMonth(new Date(current.getFullYear(), current.getMonth(), 1));
  };

  const persistDates = async (nextDates: string[]) => {
    if (!user?.uid || !historyDocId) return;
    setSaving(true);
    try {
      const normalized = normalizeWatchedDates(nextDates);
      if (!normalized.length) {
        await deleteDoc(doc(db, `users/${user.uid}/history/${historyDocId}`));
        setOpen(false);
        onToast(`Removed ${show.name} from history`, 'info');
      } else {
        await updateDoc(doc(db, `users/${user.uid}/history/${historyDocId}`), {
          watchedDates: normalized,
          watchedDate: normalized[normalized.length - 1],
          timestamp: serverTimestamp(),
        });
        onToast('Watch history updated', 'success');
      }
      setEditingIndex(null);
    } catch {
      onToast('Failed to update watch history', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const next = [...dates];
    next[editingIndex] = keyToDate(selectedDateKey).toISOString();
    void persistDates(next);
  };

  const deleteEvent = (index: number) => {
    void persistDates(dates.filter((_, dateIndex) => dateIndex !== index));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.16] bg-black/45 px-3.5 py-2 text-[11px] font-bold text-zinc-300 shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl transition hover:border-emerald-400/25 hover:bg-black/60 hover:text-white"
      >
        <CalendarDays className="h-3.5 w-3.5 text-emerald-400" />
        <span>{dates.length > 1 ? 'Latest ' : 'Watched '}{formatWatchDate(latest)}</span>
        {dates.length > 1 && <span className="text-zinc-500">• {dates.length}×</span>}
        <ChevronRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close watch history" onClick={() => { setOpen(false); setEditingIndex(null); }} className="absolute inset-0 bg-black/72 backdrop-blur-xl" />
          <motion.div initial={{ opacity: 0, y: 34, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border border-white/10 bg-zinc-950/95 shadow-[0_28px_90px_rgba(0,0,0,0.78)] backdrop-blur-3xl sm:rounded-[32px]">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                {show.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${show.poster_path}`} alt="" className="h-full w-full object-cover" /> : <ImageOff className="m-auto h-full w-4 text-zinc-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">Watch History</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-400">{show.name}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-400/80">{dates.length} {dates.length === 1 ? 'watch' : 'watches'}</p>
              </div>
              <button type="button" onClick={() => { setOpen(false); setEditingIndex(null); }} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400"><X className="h-4 w-4" /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {editingIndex === null ? (
                <div className="relative space-y-1">
                  <div className="absolute bottom-5 left-[19px] top-5 w-px bg-gradient-to-b from-emerald-400/60 via-white/10 to-emerald-400/60" />
                  {dates.map((watchDate, index) => {
                    const isFirst = index === 0;
                    const isLatest = index === dates.length - 1;
                    return (
                      <div key={`${watchDate}-${index}`} className="relative flex gap-3 py-2.5">
                        <span className={`relative z-10 mt-2 h-3 w-3 shrink-0 rounded-full border-2 border-zinc-950 ${isLatest ? 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.65)]' : 'bg-zinc-600'}`} />
                        <div className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3.5 py-3 ${isLatest ? 'border-emerald-400/15 bg-emerald-400/[0.055]' : 'border-white/[0.06] bg-white/[0.025]'}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">{isLatest ? 'Latest Watch' : isFirst ? 'First Watch' : `Rewatch #${index}`}</p>
                            <p className="mt-1 text-xs font-bold text-zinc-100">{formatWatchDate(watchDate)}</p>
                          </div>
                          <button type="button" onClick={() => startEdit(index)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-zinc-500 transition hover:text-amber-300"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" disabled={saving} onClick={() => deleteEvent(index)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/10 bg-red-500/[0.04] text-zinc-600 transition hover:text-red-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <button type="button" onClick={() => setEditingIndex(null)} className="mb-3 flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" />Watch History</button>
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-white">Edit watch date</h3>
                    <p className="mt-1 text-[10px] text-zinc-500">Update only this watch event.</p>
                  </div>
                  <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2">
                    <button type="button" onClick={() => setEditMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.06]"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-xs font-black text-white">{editMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                    <button type="button" disabled={!canGoNextMonth} onClick={() => setEditMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/[0.06] disabled:opacity-25"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[9px] font-black text-zinc-600">{day}</span>)}
                    {calendarDays.map((date) => {
                      const key = dateKey(date);
                      const selected = selectedDateKey === key;
                      const outside = date.getMonth() !== editMonth.getMonth();
                      const future = date > todayEnd;
                      return <button type="button" key={key} disabled={future} onClick={() => setSelectedDateKey(key)} className={`aspect-square rounded-xl text-[10px] font-bold transition ${selected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : outside ? 'text-zinc-700' : 'text-zinc-300 hover:bg-white/[0.06]'} disabled:opacity-20`}>{date.getDate()}</button>;
                    })}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-center text-[10px] font-semibold text-zinc-400">Selected · {formatWatchDate(keyToDate(selectedDateKey))}</div>
                  <button type="button" disabled={saving} onClick={saveEdit} className="mt-3 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-xs font-black text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50">{saving ? 'Updating…' : 'Update Watch Date'}</button>
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}
    </>
  );
};

const TvDetails = () => {
  const castContainerRef = useRef<HTMLDivElement>(null);
  const crewContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  useAutoLandscapeFullscreen();

  const [userReview, setUserReview] = useState('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hasSavedRating, setHasSavedRating] = useState(false);
  const [editingRating, setEditingRating] = useState(false);
  const [activeGenreId, setActiveGenreId] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState<TvShow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [showMobileEpisodeBrowser, setShowMobileEpisodeBrowser] = useState(false);

  const [userExistingReview, setUserExistingReview] = useState<{
    id: string;
    content: string;
    author: string;
    timestamp: any;
    title?: string;
    rating?: number;
    posterPath?: string;
    mediaType?: string;
    spoiler?: boolean;
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
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({ message: '', type: 'success', isVisible: false });
  const [playerSource, setPlayerSource] = useState<PlayerSource>('vidsrc');
  const [shareOpen, setShareOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [myListFolders, setMyListFolders] = useState<MyListFolder[]>([]);
  const [myListFolderIds, setMyListFolderIds] = useState<Set<string>>(new Set());
  const [showMyListPicker, setShowMyListPicker] = useState(false);
  const [isUpdatingLibrary, setIsUpdatingLibrary] = useState(false);
  const [showTvInfo, setShowTvInfo] = useState(false);
  const [providerRegion, setProviderRegion] = useState('IN');
  const [showTrailerPreview, setShowTrailerPreview] = useState(false);
  const [reviewSpoiler, setReviewSpoiler] = useState(false);
  const [revealOwnSpoiler, setRevealOwnSpoiler] = useState(false);
  const [ratingHistory, setRatingHistory] = useState<{ rating: number; at: any }[]>([]);
  const [releaseReminder, setReleaseReminder] = useState(false);
  useEffect(() => {
    if (!user?.uid || !showDetails?.id) {
      setIsFavorite(false);
      setFavoriteDocId(null);
      return;
    }
    const favoritesRef = collection(db, `users/${user.uid}/favouriteMedia`);
    return onSnapshot(favoritesRef, (snapshot) => {
      const match = snapshot.docs.find((favoriteDoc) => {
        const data = favoriteDoc.data();
        const mediaId = Number(data.mediaId ?? data.movieId ?? favoriteDoc.id.replace(/^(movie|tv)-/, ''));
        const mediaType = data.mediaType === 'tv' ? 'tv' : 'movie';
        return mediaType === 'tv' && mediaId === showDetails.id;
      });
      setIsFavorite(Boolean(match));
      setFavoriteDocId(match?.id ?? null);
    }, () => {
      setIsFavorite(false);
      setFavoriteDocId(null);
    });
  }, [user?.uid, showDetails?.id]);

  useEffect(() => {
    if (!user?.uid || !showDetails?.id) {
      setMyListFolders([]);
      setMyListFolderIds(new Set());
      return;
    }

    const nestedMembership = new Map<string, boolean>();
    const legacyMembership = new Map<string, boolean>();
    const folderNames = new Map<string, string>();
    const legacyPosters = new Map<string, string[]>();
    const nestedPosters = new Map<string, string[]>();
    const itemUnsubscribes = new Map<string, () => void>();

    const matchesShow = (data: any, fallbackId?: string) => {
      const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? fallbackId?.replace(/^(movie|tv)-/, '');
      const mediaId = Number(rawId);
      const mediaType = data?.mediaType ?? data?.type ?? (fallbackId?.startsWith('tv-') ? 'tv' : 'movie');
      return mediaType === 'tv' && mediaId === showDetails.id;
    };

    const getPosterPath = (data: any) => data?.posterPath || data?.poster || data?.poster_path || '';

    const emitMembership = () => {
      const next = new Set<string>();
      legacyMembership.forEach((value, folderId) => { if (value) next.add(folderId); });
      nestedMembership.forEach((value, folderId) => { if (value) next.add(folderId); });
      setMyListFolderIds(next);
    };

    const emitFolders = () => {
      const folders = [...folderNames.entries()].map(([folderId, name]) => ({
        id: folderId,
        name,
        posterPaths: [...new Set([...(nestedPosters.get(folderId) || []), ...(legacyPosters.get(folderId) || [])])].filter(Boolean).slice(0, 3),
      }));
      setMyListFolders(folders);
    };

    const rootRef = collection(db, `users/${user.uid}/customWatchlists`);
    const rootUnsubscribe = onSnapshot(rootRef, (snapshot) => {
      const liveFolderIds = new Set<string>();

      snapshot.docs.forEach((folderDoc) => {
        const folderId = folderDoc.id;
        const data = folderDoc.data();
        const legacyItems = Array.isArray(data.items) ? data.items : [];
        folderNames.set(folderId, data.name || data.title || data.listName || 'Untitled List');
        legacyPosters.set(folderId, legacyItems.map((item: any) => getPosterPath(item)).filter(Boolean));
        liveFolderIds.add(folderId);
        legacyMembership.set(folderId, legacyItems.some((item: any) => matchesShow(item)));

        if (!itemUnsubscribes.has(folderId)) {
          const itemsRef = collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`);
          const unsubscribeItems = onSnapshot(itemsRef, (itemsSnapshot) => {
            nestedMembership.set(folderId, itemsSnapshot.docs.some((itemDoc) => matchesShow(itemDoc.data(), itemDoc.id)));
            nestedPosters.set(folderId, itemsSnapshot.docs.map((itemDoc) => getPosterPath(itemDoc.data())).filter(Boolean));
            emitMembership();
            emitFolders();
          }, () => {
            nestedMembership.set(folderId, false);
            nestedPosters.set(folderId, []);
            emitMembership();
            emitFolders();
          });
          itemUnsubscribes.set(folderId, unsubscribeItems);
        }
      });

      [...itemUnsubscribes.entries()].forEach(([folderId, unsubscribeItems]) => {
        if (!liveFolderIds.has(folderId)) {
          unsubscribeItems();
          itemUnsubscribes.delete(folderId);
          nestedMembership.delete(folderId);
          legacyMembership.delete(folderId);
          nestedPosters.delete(folderId);
          legacyPosters.delete(folderId);
          folderNames.delete(folderId);
        }
      });

      emitFolders();
      emitMembership();
    }, () => {
      setMyListFolders([]);
      setMyListFolderIds(new Set());
    });

    return () => {
      rootUnsubscribe();
      itemUnsubscribes.forEach((unsubscribeItems) => unsubscribeItems());
    };
  }, [user?.uid, showDetails?.id]);

  useEffect(() => {
    const fetchUserRating = async () => {
      if (!user || !id) return;
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const ratingDoc = await getDoc(doc(db, `users/${user.uid}/ratings`, id));
        if (ratingDoc.exists()) {
          setUserRating(ratingDoc.data().rating);
          setRatingHistory(Array.isArray(ratingDoc.data().ratingHistory) ? ratingDoc.data().ratingHistory : []);
          setHasSavedRating(true);
        }
      } catch {
      }
    };
    fetchUserRating();
  }, [user, id]);

  useEffect(() => {
    setIsLoadingUserReview(true);
    setIsEditingUserReview(false);
    setEditReviewContent('');

    if (!user?.uid || !showDetails?.id) {
      setUserExistingReview(null);
      setIsLoadingUserReview(false);
      return;
    }

    const reviewsRef = collection(db, 'users', user.uid, 'reviews');
    const reviewQuery = query(reviewsRef, where('movieId', '==', showDetails.id));
    const unsubscribe = onSnapshot(
      reviewQuery,
      (snapshot) => {
        const reviewDoc = snapshot.docs.find((entry) => entry.data().mediaType === 'tv');

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
          posterPath: data.posterPath ?? showDetails.poster_path,
          mediaType: data.mediaType ?? 'tv',
          spoiler: Boolean(data.spoiler),
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
  }, [user?.uid, showDetails?.id, showDetails?.poster_path]);

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
    if (!currentUser || !showDetails?.id) return;
    const ref = collection(db, 'users', currentUser.uid, 'watchlist');
    const snap = await getDocs(query(ref, where('movieId', '==', showDetails.id)));
    setIsInWatchlist(snap.docs.some((watchDoc) => watchDoc.data().mediaType === 'tv'));
  };

  useEffect(() => {
    const fetchAll = async () => {
      setHeroBackdropUrl(null);
      setLoading(true);
      setError(null);
      try {
        const resp = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&append_to_response=credits,reviews,videos,images,watch/providers,content_ratings,external_ids`,
        );
        const data = resp.data;
        const providerResults = data['watch/providers']?.results ?? {};
        const ratings = data.content_ratings?.results ?? [];
        const ageRating = ratings.find((entry: any) => entry.iso_3166_1 === 'IN')?.rating
          || ratings.find((entry: any) => entry.iso_3166_1 === 'US')?.rating
          || ratings.find((entry: any) => entry.rating)?.rating
          || 'NR';
        const backdrops: { file_path: string }[] = data.images?.backdrops ?? [];

        if (backdrops.length > 0) {
          setHeroBackdropUrl(
            `https://image.tmdb.org/t/p/original/${backdrops[Math.floor(Math.random() * backdrops.length)].file_path}`,
          );
        }

        setCrew(data.credits?.crew ?? []);

        const firstPageReviews: any[] = data.reviews?.results ?? [];
        const totalReviewPages: number = data.reviews?.total_pages ?? 1;
        const extraReviewFetches = [];
        for (let page = 2; page <= totalReviewPages; page++) {
          extraReviewFetches.push(
            axios.get(`https://api.themoviedb.org/3/tv/${id}/reviews?api_key=${TMDB_KEY}&page=${page}`),
          );
        }
        const extraReviewResponses = await Promise.all(extraReviewFetches);
        const allRawReviews = [
          ...firstPageReviews,
          ...extraReviewResponses.flatMap((reviewResponse) => reviewResponse.data.results ?? []),
        ];
        const reviews = allRawReviews.map((review: any) => ({
          id: review.id,
          author: review.author,
          content: review.content,
        }));

        const seasons = (data.seasons ?? []).map((season: any) => ({
          id: season.id,
          name: season.name,
          season_number: season.season_number,
          episode_count: season.episode_count,
          poster_path: season.poster_path,
          air_date: season.air_date,
        }));

        setShowDetails({
          id: data.id,
          name: data.name,
          original_name: data.original_name ?? data.name,
          language: data.original_language,
          creators: (data.created_by ?? []).map((creator: any) => ({ id: creator.id, name: creator.name })),
          overview: data.overview,
          first_air_date: data.first_air_date,
          last_air_date: data.last_air_date,
          next_episode_to_air: data.next_episode_to_air ?? null,
          genres: data.genres ?? [],
          seasons,
          number_of_seasons: data.number_of_seasons ?? seasons.filter((season: any) => season.season_number > 0).length,
          number_of_episodes: data.number_of_episodes ?? seasons.reduce((sum: number, season: any) => sum + (season.episode_count || 0), 0),
          episode_run_time: data.episode_run_time ?? [],
          poster_path: data.poster_path,
          vote_average: data.vote_average,
          cast: data.credits?.cast?.map((member: any) => ({
            id: member.id,
            name: member.name,
            role: member.character,
            profile_path: member.profile_path,
          })) ?? null,
          reviews,
          trailers: data.videos?.results ?? [],
          images: { backdrops, posters: data.images?.posters ?? [] },
          country: Array.isArray(data.origin_country) ? data.origin_country : [],
          age_rating: ageRating,
          imdb_id: data.external_ids?.imdb_id ?? '',
          status: data.status ?? '',
          homepage: data.homepage ?? '',
          productionCompanies: data.production_companies ?? [],
          productionCountries: data.production_countries ?? [],
          networks: data.networks ?? [],
          watchProviders: providerResults,
        });

        const regularSeasons = seasons.filter((season: any) => season.season_number > 0 && season.episode_count > 0);
        const latestSeason = regularSeasons.length ? regularSeasons[regularSeasons.length - 1] : seasons.find((season: any) => season.episode_count > 0);
        let restoredSelection: { season: number; episode: number } | null = null;
        if (typeof window !== 'undefined') {
          try {
            const stored = JSON.parse(window.localStorage.getItem(`${LAST_EPISODE_KEY_PREFIX}:${data.id}`) || 'null');
            const storedSeason = Number(stored?.season);
            const storedEpisode = Number(stored?.episode);
            const seasonMeta = seasons.find((season: any) => season.season_number === storedSeason && season.episode_count > 0);
            if (seasonMeta && Number.isFinite(storedEpisode) && storedEpisode >= 1 && storedEpisode <= seasonMeta.episode_count) {
              restoredSelection = { season: storedSeason, episode: storedEpisode };
            }
          } catch { }
        }
        if (restoredSelection) {
          setSelectedSeason(restoredSelection.season);
          setSelectedEpisode(restoredSelection.episode);
        } else if (latestSeason) {
          setSelectedSeason(latestSeason.season_number);
          setSelectedEpisode(Math.max(1, latestSeason.episode_count || 1));
        } else {
          setSelectedSeason(null);
          setSelectedEpisode(null);
        }
      } catch {
        setError('Failed to fetch TV show details.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  useEffect(() => {
    if (selectedSeason === null) {
      setEpisodes([]);
      return;
    }
    const fetchEpisodes = async () => {
      setEpisodesLoading(true);
      setEpisodesError(null);
      setEpisodes([]);
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${id}/season/${selectedSeason}?api_key=${TMDB_KEY}`,
        );
        setEpisodes((response.data.episodes ?? []).map((episode: any) => ({
          ...episode,
          still_url: episode.still_path ? `https://image.tmdb.org/t/p/w780${episode.still_path}` : null,
        })));
      } catch {
        setEpisodes([]);
        setEpisodesError('Failed to fetch episodes.');
      } finally {
        setEpisodesLoading(false);
      }
    };
    fetchEpisodes();
  }, [id, selectedSeason]);

  useEffect(() => {
    if (!id || selectedSeason === null || selectedEpisode === null || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        `${LAST_EPISODE_KEY_PREFIX}:${id}`,
        JSON.stringify({ season: selectedSeason, episode: selectedEpisode, updatedAt: Date.now() }),
      );
    } catch { }
  }, [id, selectedSeason, selectedEpisode]);

  useEffect(() => {
    if (!showMobileEpisodeBrowser || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showMobileEpisodeBrowser]);

  useEffect(() => {
    if (selectedEpisode !== null && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedEpisode]);

  useEffect(() => {
    const check = async () => {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !showDetails?.id) return;
      const ref = collection(db, 'users', currentUser.uid, 'watchlist');
      const snap = await getDocs(query(ref, where('movieId', '==', showDetails.id)));
      setIsInWatchlist(snap.docs.some((watchDoc) => watchDoc.data().mediaType === 'tv'));
    };
    check();
  }, [showDetails?.id]);

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

  const handleUpvote = (index: number) => {
    setShowDetails((prev) =>
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
    setShowDetails((prev) =>
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

  const handleFavoriteToggle = async () => {
    if (!user?.uid || !showDetails) {
      showToast('Please log in to update favorites', 'error');
      return;
    }
    setIsUpdatingLibrary(true);
    try {
      if (isFavorite && favoriteDocId) {
        await deleteDoc(doc(db, `users/${user.uid}/favouriteMedia/${favoriteDocId}`));
        showToast('Removed from favourites', 'info');
      } else {
        const key = `tv-${showDetails.id}`;
        await setDoc(doc(db, `users/${user.uid}/favouriteMedia/${key}`), {
          movieId: showDetails.id,
          mediaId: showDetails.id,
          mediaType: 'tv',
          title: showDetails.name,
          posterPath: showDetails.poster_path,
          releaseDate: showDetails.first_air_date,
          addedAt: serverTimestamp(),
        }, { merge: true });
        showToast('Added to favourites', 'success');
      }
    } catch {
      showToast('Failed to update favourites', 'error');
    } finally {
      setIsUpdatingLibrary(false);
    }
  };

  const handleMyListFolderToggle = async (folderId: string) => {
    if (!user?.uid || !showDetails || !folderId) return;
    setIsUpdatingLibrary(true);
    const isAlreadyInFolder = myListFolderIds.has(folderId);
    try {
      const folderRef = doc(db, `users/${user.uid}/customWatchlists/${folderId}`);
      const rootSnapshot = await getDocs(collection(db, `users/${user.uid}/customWatchlists`));
      const folderSnapshot = rootSnapshot.docs.find((folderDoc) => folderDoc.id === folderId);
      const itemsRef = collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`);

      if (isAlreadyInFolder) {
        const tasks: Promise<unknown>[] = [];
        if (folderSnapshot) {
          const data = folderSnapshot.data();
          if (Array.isArray(data.items)) {
            const nextItems = data.items.filter((item: any) => {
              const rawId = Number(item?.movieId ?? item?.mediaId ?? item?.id);
              const type = item?.mediaType ?? item?.type ?? 'movie';
              return !(type === 'tv' && rawId === showDetails.id);
            });
            if (nextItems.length !== data.items.length) tasks.push(updateDoc(folderRef, { items: nextItems }));
          }
        }
        const nestedSnapshot = await getDocs(itemsRef);
        nestedSnapshot.docs.forEach((itemDoc) => {
          const data = itemDoc.data();
          const rawId = Number(data.movieId ?? data.mediaId ?? data.id ?? itemDoc.id.replace(/^(movie|tv)-/, ''));
          const type = data.mediaType ?? data.type ?? (itemDoc.id.startsWith('tv-') ? 'tv' : 'movie');
          if (type === 'tv' && rawId === showDetails.id) tasks.push(deleteDoc(itemDoc.ref));
        });
        await Promise.all(tasks);
        showToast('Removed from My List', 'info');
      } else {
        await setDoc(doc(db, `users/${user.uid}/customWatchlists/${folderId}/items/tv-${showDetails.id}`), {
          id: showDetails.id,
          movieId: showDetails.id,
          mediaId: showDetails.id,
          type: 'tv',
          mediaType: 'tv',
          title: showDetails.name,
          poster: showDetails.poster_path,
          posterPath: showDetails.poster_path,
          releaseYear: showDetails.first_air_date?.slice(0, 4) || '',
          releaseDate: showDetails.first_air_date,
          voteAverage: showDetails.vote_average || 0,
          runtimeMinutes: (showDetails.episode_run_time?.[0] || 0) || 0,
          genres: showDetails.genres?.map((genre) => genre.name) ?? [],
          addedAt: serverTimestamp(),
        }, { merge: true });
        showToast('Added to My List', 'success');
      }
    } catch {
      showToast('Failed to update My List', 'error');
    } finally {
      setIsUpdatingLibrary(false);
    }
  };

  const handleWatchlistToggle = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !showDetails) {
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
          movieId: showDetails.id,
          title: showDetails.name,
          releaseDate: showDetails.first_air_date,
          genres: showDetails.genres?.map((g) => g.name),
          posterPath: showDetails.poster_path,
          mediaType: 'tv',
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
      const snap = await getDocs(query(ref, where('movieId', '==', showDetails.id)));
      const existingTvDoc = snap.docs.find((watchDoc) => watchDoc.data().mediaType === 'tv');
      if (existingTvDoc) {
        await deleteDoc(existingTvDoc.ref);
        setIsInWatchlist(false);
        showToast('Removed from watchlist', 'info');
      } else {
        await addDoc(ref, {
          movieId: showDetails.id,
          title: showDetails.name,
          releaseDate: showDetails.first_air_date,
          genres: showDetails.genres?.map((g) => g.name),
          posterPath: showDetails.poster_path,
          mediaType: 'tv',
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
    if (!user) { showToast('Please log in to rate this TV show', 'error'); return; }
    if (userRating === null || userRating < 0 || userRating > 10) {
      showToast('Rating must be between 0 and 10', 'error'); return;
    }
    try {
      if (!id) throw new Error('Missing TV show ID');
      const nextRatingHistory = [...ratingHistory];
      const previous = nextRatingHistory[nextRatingHistory.length - 1]?.rating;
      if (previous !== userRating) nextRatingHistory.push({ rating: userRating, at: new Date() });
      await setDoc(doc(db, `users/${user.uid}/ratings`, id), {
        movieId: showDetails?.id,
        title: showDetails?.name,
        posterPath: showDetails?.poster_path,
        rating: userRating,
        ratingHistory: nextRatingHistory.slice(-12),
        mediaType: "tv",
        timestamp: new Date(),
      }, { merge: true });
      setRatingHistory(nextRatingHistory.slice(-12));
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

  const handleDeleteRating = async () => {
    if (!user) { showToast('Please log in to delete rating', 'error'); return; }
    if (!id) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/ratings`, id));
      setUserRating(null);
      setHasSavedRating(false);
      setEditingRating(false);
      showToast('Rating deleted', 'success');
    } catch {
      showToast('Failed to delete rating', 'error');
    }
  };

  const handleReviewSubmit = async () => {
    if (!user) { showToast('Please log in to submit a review', 'error'); return; }
    if (!userReview.trim()) { showToast('Review cannot be empty', 'error'); return; }
    try {
      const reviewRef = await addDoc(collection(db, 'users', user.uid, 'reviews'), {
        author: user.displayName ?? 'Anonymous',
        content: userReview.trim(),
        title: showDetails?.name,
        movieId: showDetails?.id,
        posterPath: showDetails?.poster_path,
        mediaType: 'tv',
        spoiler: reviewSpoiler,
        timestamp: new Date(),
      });
      setUserExistingReview({
        id: reviewRef.id,
        content: userReview.trim(),
        author: user.displayName ?? 'Anonymous',
        timestamp: new Date(),
        title: showDetails?.name ?? '',
        posterPath: showDetails?.poster_path,
        mediaType: 'tv',
        spoiler: reviewSpoiler,
      });
      setUserReview('');
      setReviewSpoiler(false);
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

  const currentSeason = selectedSeason ?? showDetails?.seasons?.filter((season) => season.season_number > 0).at(-1)?.season_number ?? 1;
  const currentEpisode = selectedEpisode ?? 1;
  const selectedEpisodeData = episodes.find((episode) => episode.episode_number === selectedEpisode) ?? null;
  const playableSeasons = (showDetails?.seasons || [])
    .filter((season) => season.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const currentSeasonIndex = playableSeasons.findIndex((season) => season.season_number === currentSeason);
  const currentSeasonMeta = currentSeasonIndex >= 0 ? playableSeasons[currentSeasonIndex] : null;
  const previousSeasonMeta = currentSeasonIndex > 0 ? playableSeasons[currentSeasonIndex - 1] : null;
  const nextSeasonMeta = currentSeasonIndex >= 0 && currentSeasonIndex < playableSeasons.length - 1 ? playableSeasons[currentSeasonIndex + 1] : null;
  const previousEpisodeTarget = currentEpisode > 1
    ? { season: currentSeason, episode: currentEpisode - 1 }
    : previousSeasonMeta
      ? { season: previousSeasonMeta.season_number, episode: Math.max(1, previousSeasonMeta.episode_count) }
      : null;
  const nextEpisodeTarget = currentSeasonMeta && currentEpisode < currentSeasonMeta.episode_count
    ? { season: currentSeason, episode: currentEpisode + 1 }
    : nextSeasonMeta
      ? { season: nextSeasonMeta.season_number, episode: 1 }
      : null;

  const selectEpisodeTarget = (target: { season: number; episode: number } | null) => {
    if (!target) return;
    setSelectedSeason(target.season);
    setSelectedEpisode(target.episode);
    setShowMobileEpisodeBrowser(false);
  };

  const openMobileEpisodeBrowser = () => setShowMobileEpisodeBrowser(true);

  const embedUrls = useMemo(() => {
    const tmdbId = id ?? '';
    const imdbId = showDetails?.imdb_id ?? '';
    return getTvEmbedUrls(tmdbId, currentSeason, currentEpisode, imdbId);
  }, [id, currentSeason, currentEpisode, showDetails?.imdb_id]);

  const currentSrc = embedUrls[playerSource];

  const VideoPlayer = useMemo(() => {
    if (!currentSrc) return null;
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-black shadow-[0_0_50px_-12px_rgba(239,68,68,0.15)] group-hover:shadow-[0_0_60px_-10px_rgba(239,68,68,0.25)] group-hover:border-white/[0.12] transition-all duration-500">
        <div className="w-full aspect-video bg-zinc-950">
          <iframe
            key={`${playerSource}-${id}-${currentSeason}-${currentEpisode}`}
            src={currentSrc!}
            width="100%"
            height="100%"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; orientation-lock"
            title="TV Show Player"
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    );
  }, [currentSrc, currentEpisode, currentSeason, id, playerSource]);


  if (loading) return <Loading />;
  if (error || !showDetails) return <p className="text-center text-red-500 py-20">{error}</p>;

  const language = LANGUAGE_MAP[showDetails.language] ?? showDetails.language ?? 'Unknown';
  const episodeCountLabel = showDetails.number_of_episodes ? `${showDetails.number_of_episodes.toLocaleString()} episodes` : 'N/A';
  const posterUrl = `https://image.tmdb.org/t/p/w780/${showDetails.poster_path}`;
  const heroBackdrop = heroBackdropUrl ?? posterUrl;

  const genres = showDetails.genres ?? [];
  const segments = genres.map((genre) => ({
    id: genre.id,
    name: genre.name,
    value: genres.length ? 100 / genres.length : 0,
  }));
  const activeSegment = activeGenreId === null ? null : segments.find((s) => s.id === activeGenreId) ?? null;
  const featuredListFolders = myListFolders.filter((folder) => myListFolderIds.has(folder.id));

  const chartSize = 220;
  const strokeW = 26;
  const r = chartSize / 2 - strokeW;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const circumference = 2 * Math.PI * r;
  const gapPx = 4;

  const providerRegions = Object.keys(showDetails.watchProviders || {}).filter((code) => {
    const region = showDetails.watchProviders?.[code];
    return region?.flatrate?.length || region?.rent?.length || region?.buy?.length;
  }).sort((a, b) => (a === 'IN' ? -1 : b === 'IN' ? 1 : a.localeCompare(b)));
  const effectiveProviderRegion = providerRegions.includes(providerRegion) ? providerRegion : (providerRegions[0] || providerRegion);
  const selectedProviders = showDetails.watchProviders?.[effectiveProviderRegion] || {};
  const reminderDate = showDetails.next_episode_to_air?.air_date || showDetails.first_air_date;
  const releaseAt = reminderDate ? new Date(`${reminderDate}T12:00:00`) : null;
  const isUpcoming = Boolean(releaseAt && !Number.isNaN(releaseAt.getTime()) && releaseAt.getTime() > Date.now());
  const daysUntilRelease = isUpcoming && releaseAt ? Math.max(1, Math.ceil((releaseAt.getTime() - Date.now()) / 86400000)) : 0;
  const reminderLabel = showDetails.next_episode_to_air?.air_date ? 'Next episode' : 'Premieres';
  const normalizedStatus = (showDetails.status || 'Unknown').toLowerCase();
  const statusPresentation = normalizedStatus.includes('returning')
    ? { label: showDetails.status || 'Returning Series', classes: 'border-emerald-400/20 bg-emerald-400/[0.10] text-emerald-200', dot: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]' }
    : normalizedStatus.includes('production')
      ? { label: showDetails.status || 'In Production', classes: 'border-cyan-400/20 bg-cyan-400/[0.10] text-cyan-200', dot: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.75)]' }
      : normalizedStatus.includes('planned') || normalizedStatus.includes('pilot')
        ? { label: showDetails.status || 'Planned', classes: 'border-blue-400/20 bg-blue-400/[0.10] text-blue-200', dot: 'bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.65)]' }
        : normalizedStatus.includes('cancel')
          ? { label: showDetails.status || 'Canceled', classes: 'border-red-400/20 bg-red-400/[0.10] text-red-200', dot: 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.65)]' }
          : normalizedStatus.includes('ended')
            ? { label: showDetails.status || 'Ended', classes: 'border-zinc-400/15 bg-white/[0.055] text-zinc-300', dot: 'bg-zinc-400' }
            : { label: showDetails.status || 'Unknown', classes: 'border-amber-400/15 bg-amber-400/[0.08] text-amber-200', dot: 'bg-amber-400' };
  const nextEpisodeMeta = showDetails.next_episode_to_air;
  const nextEpisodeDateLabel = nextEpisodeMeta?.air_date
    ? new Date(`${nextEpisodeMeta.air_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
  const statusContext = nextEpisodeMeta?.air_date
    ? `${nextEpisodeMeta.season_number ? `S${nextEpisodeMeta.season_number} ` : ''}${nextEpisodeMeta.episode_number ? `E${nextEpisodeMeta.episode_number}` : 'Next'} · ${nextEpisodeDateLabel}${daysUntilRelease ? ` · in ${daysUntilRelease}d` : ''}`
    : normalizedStatus.includes('ended') && showDetails.last_air_date
      ? `Final episode · ${new Date(`${showDetails.last_air_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
      : null;
  const keyCreators = [
    ...showDetails.creators.map((creator) => ({ ...creator, profile_path: null, jobs: ['Creator'] })),
    ...groupedCrew.filter((member: any) => member.jobs?.some((job: string) => ['Director', 'Writer', 'Screenplay', 'Story', 'Original Music Composer', 'Director of Photography', 'Executive Producer'].includes(job))),
  ].filter((creator, index, array) => array.findIndex((item) => item.id === creator.id) === index).slice(0, 8);

  const sortedReviews = [...showDetails.reviews].sort((a, b) => {
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

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={showDetails.name}
        backdropUrl={heroBackdrop}
        posterUrl={posterUrl}
        rating={showDetails.vote_average}
        genres={genres.map((g) => g.name)}
        releaseDate={showDetails.first_air_date}
        overview={showDetails.overview}
        shareUrl={`${window.location.origin}/tv/${showDetails.id}`}
        medium="TV Show"
        onToast={(m, t) => showToast(m, t)}
      />

      {showMyListPicker && createPortal(
        <div className="fixed inset-0 z-[10035] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close My List picker" onClick={() => setShowMyListPicker(false)} className="absolute inset-0 bg-black/70 backdrop-blur-xl sm:bg-black/55" />
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,0.72)] sm:rounded-[30px]"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {showDetails.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${showDetails.poster_path}`} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-4 w-4 text-zinc-600" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{showDetails.name}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Choose My List</p>
              </div>
              <button type="button" onClick={() => setShowMyListPicker(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {myListFolders.length ? (
                <div className="space-y-2">
                  {myListFolders.map((folder) => {
                    const selected = myListFolderIds.has(folder.id);
                    return (
                      <button
                        type="button"
                        key={folder.id}
                        disabled={isUpdatingLibrary}
                        onClick={() => handleMyListFolderToggle(folder.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-50 ${selected ? 'border-violet-400/20 bg-violet-500/10' : 'border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06]'}`}
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${selected ? 'border-violet-400/20 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-white/[0.04] text-zinc-500'}`}>
                          {selected ? <Check className="h-4 w-4 stroke-[3]" /> : <Plus className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-black text-white">{folder.name}</span>
                          <span className="mt-0.5 block text-[10px] text-zinc-500">{selected ? 'Added · tap to remove' : 'Tap to add'}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center px-5 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-500"><ListChecks className="h-5 w-5" /></span>
                  <p className="mt-3 text-sm font-black text-white">No My List folders yet</p>
                  <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-zinc-500">Create a custom list first, then add this TV show to it.</p>
                  <Link to="/mylist" onClick={() => setShowMyListPicker(false)} className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-[10px] font-black text-violet-300">Open My List</Link>
                </div>
              )}
            </div>
            <div className="border-t border-white/[0.07] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
              <button type="button" onClick={() => setShowMyListPicker(false)} className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 text-xs font-bold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">Done</button>
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {showTvInfo && createPortal(
        <div className="fixed inset-0 z-[10045] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close TV information" onClick={() => setShowTvInfo(false)} className="absolute inset-0 bg-black/72 backdrop-blur-xl" />
          <motion.div initial={{ opacity: 0, y: 38, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-10 flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[34px] border border-white/10 bg-zinc-950/95 shadow-[0_30px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl sm:rounded-[34px]">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">TV Information</p><h2 className="mt-1 truncate text-lg font-black text-white">{showDetails.name}</h2></div>
              <button type="button" onClick={() => setShowTvInfo(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <section>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">General</p>
                <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                  <div><p className="text-[10px] font-semibold text-zinc-600">First Air Date</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.first_air_date ? formatWatchDate(`${showDetails.first_air_date}T12:00:00`) : 'Unknown'}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Status</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.status || 'Unknown'}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Original Language</p><p className="mt-1 text-sm font-bold text-zinc-200">{language}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Certification</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.age_rating || 'NR'}</p></div>
                  <div className="col-span-2"><p className="text-[10px] font-semibold text-zinc-600">Original Name</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.original_name || showDetails.name}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">{genres.map((genre) => <span key={genre.id} className="rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300">{genre.name}</span>)}</div>
              </section>
              <div className="my-6 h-px bg-white/[0.07]" />
              <section>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Production</p>
                <div className="space-y-4">
                  <div><p className="text-[10px] font-semibold text-zinc-600">Creator</p>{showDetails.creators?.[0]?.id ? <Link to={`/talent/${showDetails.creators?.[0]?.id}`} onClick={() => setShowTvInfo(false)} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-zinc-200 transition hover:text-amber-300">{showDetails.creators?.[0]?.name || 'Unknown Creator'}<ChevronRight className="h-3.5 w-3.5" /></Link> : <p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.creators?.[0]?.name || 'Unknown Creator'}</p>}</div>
                  {!!showDetails.productionCountries?.length && <div><p className="text-[10px] font-semibold text-zinc-600">Countries</p><div className="mt-2 flex flex-wrap gap-2">{showDetails.productionCountries.map((country) => <span key={country.iso_3166_1} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300"><span className="text-base leading-none" role="img" aria-label={`${country.name} flag`}>{countryFlag(country.iso_3166_1)}</span><span>{country.name}</span></span>)}</div></div>}
                  {!!showDetails.productionCompanies?.length && <div><p className="text-[10px] font-semibold text-zinc-600">Companies</p><div className="mt-2 flex flex-wrap gap-2">{showDetails.productionCompanies.map((company) => <span key={company.id} className="rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300">{company.name}</span>)}</div></div>}
                </div>
              </section>
              <div className="my-6 h-px bg-white/[0.07]" />
              <section>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Series</p>
                <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                  <div><p className="text-[10px] font-semibold text-zinc-600">Seasons</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.number_of_seasons || '—'}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Episodes</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.number_of_episodes || '—'}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Last Air Date</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.last_air_date ? formatWatchDate(`${showDetails.last_air_date}T12:00:00`) : 'Unknown'}</p></div>
                  <div><p className="text-[10px] font-semibold text-zinc-600">Origin</p><p className="mt-1 text-sm font-bold text-zinc-200">{showDetails.country?.length ? showDetails.country.map((code) => `${countryFlag(code)} ${code}`).join(' · ') : 'Unknown'}</p></div>
                </div>
                {!!showDetails.networks?.length && <div className="mt-5"><p className="text-[10px] font-semibold text-zinc-600">Networks</p><div className="mt-2 flex flex-wrap gap-2">{showDetails.networks.map((network) => <span key={network.id} className="rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300">{network.name}</span>)}</div></div>}
              </section>
              {(showDetails.imdb_id || showDetails.homepage) && <><div className="my-6 h-px bg-white/[0.07]" /><section><p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Links</p><div className="flex flex-wrap gap-2">{showDetails.imdb_id && <a href={`https://www.imdb.com/title/${showDetails.imdb_id}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white">IMDb<ExternalLink className="h-3.5 w-3.5" /></a>}{showDetails.homepage && <a href={showDetails.homepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-300 hover:text-white">Official Site<ExternalLink className="h-3.5 w-3.5" /></a>}</div></section></>}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {showTrailerPreview && showDetails.trailers?.[0] && createPortal(
        <div className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/90 p-3 backdrop-blur-2xl">
          <button type="button" aria-label="Close trailer" onClick={() => setShowTrailerPreview(false)} className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-xl"><X className="h-5 w-5" /></button>
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"><iframe className="h-full w-full" src={`https://www.youtube.com/embed/${showDetails.trailers[0].key}?autoplay=1`} title={`${showDetails.name} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
        </div>, document.body
      )}

      <div id="overview" className="relative min-h-[70vh] md:min-h-[85vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute -inset-8 scale-110 bg-cover bg-center opacity-90 blur-[24px] saturate-[1.12] transition-all duration-1000 sm:blur-[20px] md:blur-[14px] lg:blur-[10px]"
            style={{ backgroundImage: `url(${heroBackdrop})` }}
          />
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/62 to-black/10" />
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
                <div className="relative ring-1 ring-white/10 bg-white/5 rounded-2xl p-1.5 sm:p-2 shadow-2xl shadow-black/50">
                  {showDetails.poster_path ? (
                    <ProgressiveImage
                      src={posterUrl}
                      lowSrc={`https://image.tmdb.org/t/p/w92${showDetails.poster_path}`}
                      alt={showDetails.name}
                      eager
                      wrapperClassName="w-40 h-56 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 rounded-lg"
                      className="h-full w-full object-cover rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="w-40 h-56 sm:w-52 sm:h-72 md:w-56 md:h-80 lg:w-64 lg:h-96 bg-zinc-900/80 flex flex-col items-center justify-center text-gray-500 rounded-lg">
                      <ImageOff className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-xs text-center px-3">No Image</p>
                    </div>
                  )}
                  {showDetails.trailers?.[0] && (
                    <button
                      type="button"
                      onClick={() => setShowTrailerPreview(true)}
                      className="absolute bottom-3 right-3 z-30 flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/60 shadow-lg backdrop-blur-xl transition duration-300 hover:scale-105 hover:border-red-500/40 hover:bg-black/80 hover:shadow-[0_0_15px_rgba(239,68,68,0.35)] active:scale-95 sm:bottom-4 sm:right-4 sm:h-9 sm:w-9"
                      aria-label="Play trailer"
                    >
                      <svg
                        className="h-4 w-4 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)] sm:h-[18px] sm:w-[18px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 1.96A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.37z"
                          fill="#FF0000"
                        />
                        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#FFFFFF" />
                      </svg>
                    </button>
                  )}                </div>
              </motion.div>
            </div>

            <div className="flex-1 flex flex-col justify-end w-full text-center md:text-left order-2 md:order-none">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-3 leading-tight tracking-tight"
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  {showDetails.name}
                </span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.45 }}
                className="mb-4"
              >
                <div className="flex items-center justify-center gap-2 text-[15px] font-semibold text-zinc-300 md:hidden">
                  <span>{showDetails.first_air_date?.slice(0, 4) || '—'}</span>
                  <span className="text-zinc-600">•</span>
                  <span>{language}</span>
                  {showDetails.age_rating && <><span className="text-zinc-600">•</span><span>{showDetails.age_rating}</span></>}
                  <button
                    type="button"
                    onClick={() => setShowTvInfo(true)}
                    className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/[0.07] hover:text-white active:scale-95"
                    title="TV information"
                    aria-label="TV information"
                  >
                    <Info className="h-[19px] w-[19px] stroke-[2.2]" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-center md:hidden">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 backdrop-blur-md">
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-bold text-white">{showDetails.vote_average.toFixed(1)}</span>
                      <span className="text-[10px] font-semibold text-zinc-500">TMDB</span>
                    </span>
                    <span className="h-3 w-px bg-white/10" />
                    <span
                      className="inline-flex min-w-0 items-center gap-1.5"
                      title={statusContext ? `${statusPresentation.label} · ${statusContext}` : statusPresentation.label}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusPresentation.dot}`} />
                      <span className="max-w-[112px] truncate text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-400">{statusPresentation.label}</span>
                    </span>
                  </div>
                </div>

                <div className="hidden flex-wrap items-center gap-2 md:flex">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-white font-semibold text-sm">{showDetails.vote_average.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span className="text-white/80 font-medium text-sm">{showDetails.first_air_date}</span>
                  </div>
                  <div
                    className={`inline-flex max-w-[360px] items-center gap-2 rounded-full border px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${statusPresentation.classes}`}
                    title={statusContext ? `${statusPresentation.label} · ${statusContext}` : statusPresentation.label}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusPresentation.dot}`} />
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em]">{statusPresentation.label}</span>
                    {statusContext && <><span className="h-3 w-px shrink-0 bg-current opacity-20" /><span className="truncate text-[9px] font-bold opacity-75">{statusContext}</span></>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTvInfo(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 backdrop-blur-md transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                    title="TV information"
                    aria-label="TV information"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>

              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap justify-center md:justify-start gap-2 mb-6"
              >
                {showDetails.genres.map((g) => (
                  <span
                    key={g.id}
                    className="px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300"
                  >
                    {g.name}
                  </span>
                ))}
              </motion.div>

              {isUpcoming && (
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black text-amber-300">{reminderLabel} in {daysUntilRelease} days</span>
                  <button type="button" onClick={() => { setReleaseReminder((value) => !value); showToast(releaseReminder ? 'Reminder removed' : 'Reminder saved on this device', 'info'); }} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black transition ${releaseReminder ? 'border-amber-400/30 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-black/35 text-zinc-400'}`}><Bell className="h-3.5 w-3.5" />{releaseReminder ? 'Reminder On' : 'Notify Me'}</button>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex w-full justify-center md:flex-nowrap md:items-center md:justify-start md:gap-2 lg:gap-2.5"
              >
                <div className="relative flex max-w-full items-center gap-1.5 overflow-hidden rounded-[30px] border border-white/[0.12] bg-black/60 p-2 shadow-[0_18px_46px_rgba(0,0,0,0.50),inset_0_1px_1px_rgba(255,255,255,0.09)] backdrop-blur-2xl md:contents md:overflow-visible">
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent md:hidden" />

                  <WatchedButton
                    show={showDetails}
                    onSync={syncWatchlistState}
                    onToast={showToast}
                  />

                  <button
                    type="button"
                    onClick={handleWatchlistToggle}
                    className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${isInWatchlist
                      ? 'border border-blue-400/40 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700'
                      : 'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-black/40 hover:border-blue-500/30 hover:text-white'
                      }`}
                    title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    {isInWatchlist ? (
                      <BookmarkCheck className="relative z-10 h-5 w-5 text-blue-50 drop-shadow-[0_0_6px_rgba(255,255,255,0.75)] md:h-4 md:w-4" />
                    ) : (
                      <Bookmark className="relative z-10 h-5 w-5 text-zinc-400 transition-colors duration-300 group-hover:text-blue-500 md:h-4 md:w-4" />
                    )}
                    <span className="relative z-10 hidden md:inline">{isInWatchlist ? 'Saved to Watchlist' : 'Add to Watchlist'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFavoriteToggle}
                    disabled={isUpdatingLibrary}
                    className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${isFavorite
                      ? 'border border-red-400/40 bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/30 hover:from-red-600 hover:to-rose-700'
                      : 'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-black/40 hover:border-red-500/30 hover:text-white'
                      }`}
                    title={isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    <Heart className={`relative z-10 h-5 w-5 transition-colors duration-300 md:h-4 md:w-4 ${isFavorite ? 'fill-current text-red-50 drop-shadow-[0_0_6px_rgba(255,255,255,0.75)]' : 'text-zinc-400 group-hover:text-red-500'}`} />
                    <span className="relative z-10 hidden md:inline">{isFavorite ? 'Favourite' : 'Add Favourite'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!user?.uid) {
                        showToast('Please log in to use My List', 'error');
                        return;
                      }
                      setShowMyListPicker(true);
                    }}
                    disabled={isUpdatingLibrary}
                    className={`relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:px-4 md:py-3 md:text-xs md:whitespace-nowrap lg:px-5 lg:text-sm ${myListFolderIds.size
                      ? 'border border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-600 to-violet-600 shadow-fuchsia-500/30 hover:from-fuchsia-700 hover:to-violet-700'
                      : 'border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-200 shadow-black/40 hover:border-fuchsia-500/30 hover:text-white'
                      }`}
                    title="Manage Lists"
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    <ListChecks className={`relative z-10 h-5 w-5 transition-colors duration-300 md:h-4 md:w-4 ${myListFolderIds.size ? 'text-fuchsia-50 drop-shadow-[0_0_6px_rgba(255,255,255,0.75)]' : 'text-zinc-400 group-hover:text-fuchsia-500'}`} />
                    {myListFolderIds.size > 0 && (
                      <span className="absolute -right-1 -top-1 rounded-full border border-white/15 bg-fuchsia-500 px-1.5 py-0.5 text-[8px] font-black leading-none text-white shadow-md shadow-fuchsia-500/20 md:static md:rounded-md md:bg-black/15 md:text-[9px] md:text-fuchsia-100">
                        {myListFolderIds.size}
                      </span>
                    )}
                    <span className="relative z-10 hidden md:inline">Manage Lists</span>
                  </button>

                  <div className="mx-0.5 h-7 w-px bg-white/10 md:hidden" />

                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="relative group flex h-12 w-12 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 font-bold text-white shadow-xl shadow-black/40 transition-all duration-300 hover:scale-105 hover:border-amber-400/25 active:scale-95 md:h-auto md:w-auto md:min-h-[46px] md:rounded-2xl md:bg-gradient-to-r md:from-zinc-700 md:to-zinc-600 md:px-4 md:py-3 md:text-xs md:whitespace-nowrap md:shadow-zinc-500/25 lg:px-5 lg:text-sm md:hover:from-zinc-600 md:hover:to-zinc-500"
                    title="Share"
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                    <Share2 className="relative z-10 h-5 w-5 text-amber-400 transition-colors duration-300 group-hover:text-amber-300 md:h-4 md:w-4 md:text-amber-300" />
                    <span className="relative z-10 hidden md:inline">Share</span>
                  </button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="flex justify-center md:justify-start"
              >
                <WatchHistoryPill show={showDetails} onToast={showToast} />
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
          className="relative col-span-1 flex w-full flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.055] to-white/[0.018] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.10),0_18px_52px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-5 md:p-6"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Vibe Chart</h2>
              <p className="mt-0.5 text-[10px] font-medium text-zinc-500 sm:text-xs">Genre distribution</p>
            </div>
            <span className="rounded-full border border-white/[0.07] bg-black/25 px-2.5 py-1 text-[9px] font-semibold text-zinc-500 backdrop-blur-xl sm:text-[10px]">Tap or hover</span>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="relative flex aspect-square w-full max-w-[184px] items-center justify-center sm:max-w-[204px] lg:max-w-[214px]">
              <div className="absolute inset-[18%] rounded-full border border-white/[0.07] bg-black/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_26px_rgba(0,0,0,0.30)] backdrop-blur-xl" />
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${chartSize} ${chartSize}`}
                role="img"
                aria-label="TV genre distribution"
                className="relative z-10 drop-shadow-[0_8px_24px_rgba(0,0,0,0.38)]"
              >
                <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="rgba(255,255,255,0.035)" strokeWidth={strokeW} />
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
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isActive ? strokeW + 5 : strokeW}
                        strokeLinecap="butt"
                        strokeDasharray={`${adjusted} ${circumference - adjusted}`}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{
                          filter: isActive ? `drop-shadow(0 0 14px ${color}80)` : `drop-shadow(0 2px 4px ${color}20)`,
                          opacity: !anyActive || isActive ? 1 : 0.28,
                          transition: 'all 320ms cubic-bezier(0.16, 1, 0.3, 1)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={() => setActiveGenreId(seg.id)}
                        onMouseLeave={() => setActiveGenreId(null)}
                        onFocus={() => setActiveGenreId(seg.id)}
                        onBlur={() => setActiveGenreId(null)}
                        onClick={() => setActiveGenreId((current) => current === seg.id ? null : seg.id)}
                        tabIndex={0}
                        aria-label={`${seg.name}: ${seg.value.toFixed(0)}%`}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center">
                <span className="max-w-[110px] truncate text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:text-[10px]">
                  {activeSegment?.name ?? 'Genres'}
                </span>
                <span className="mt-1 text-2xl font-black tracking-tight text-white tabular-nums sm:text-3xl">
                  {activeSegment ? `${activeSegment.value.toFixed(0)}%` : `${segments.length}`}
                </span>
                {!activeSegment && <span className="mt-0.5 text-[9px] font-semibold text-zinc-600">signals</span>}
              </div>
            </div>

            <ul className="grid w-full grid-cols-2 gap-2 lg:grid-cols-1">
              {segments.map((segment, idx) => {
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                const isActive = segment.id === activeGenreId;
                const anyActive = activeGenreId !== null;
                return (
                  <li key={segment.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveGenreId(segment.id)}
                      onMouseLeave={() => setActiveGenreId(null)}
                      onFocus={() => setActiveGenreId(segment.id)}
                      onBlur={() => setActiveGenreId(null)}
                      onClick={() => setActiveGenreId((current) => current === segment.id ? null : segment.id)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all duration-300 active:scale-[0.99] ${isActive ? 'border-white/[0.12] bg-white/[0.07] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]' : 'border-white/[0.045] bg-black/20 hover:border-white/[0.09] hover:bg-white/[0.035]'}`}
                      style={{ opacity: !anyActive || isActive ? 1 : 0.48 }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color, boxShadow: isActive ? `0 0 12px ${color}` : `0 0 6px ${color}35` }}
                      />
                      <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold sm:text-xs ${isActive ? 'text-white' : 'text-zinc-400'}`}>{segment.name}</span>
                      <span className={`text-[10px] font-bold tabular-nums sm:text-[11px] ${isActive ? 'text-zinc-200' : 'text-zinc-600'}`}>{segment.value.toFixed(0)}%</span>
                    </button>
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
            {showDetails.overview ? (
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed tracking-wide">
                {showDetails.overview}
              </p>
            ) : (
              <p className="text-sm text-zinc-600 italic font-medium">
                An official synopsis has not yet been recorded for this TV show.
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
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Episodes</dt>
                <dd className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                  <TvMinimalPlay className="w-4 h-4 stroke-[2.5]" />
                  <span>{episodeCountLabel}</span>
                </dd>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/[0.02] rounded-2xl hover:bg-white/[0.04] transition-colors duration-300">
                <dt className="text-zinc-500 text-[11px] font-bold tracking-wider uppercase mb-1">Creator</dt>
                <dd className="text-sm font-semibold">
                  {showDetails.creators?.[0]?.id ? (
                    <Link to={`/talent/${showDetails.creators?.[0]?.id}`} className="inline-flex items-center gap-1.5 text-zinc-200 transition-colors hover:text-amber-300">
                      <span>{showDetails.creators?.[0]?.name || 'Unknown Creator'}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                    </Link>
                  ) : (
                    <span className="text-zinc-200">{showDetails.creators?.[0]?.name || 'Unknown Creator'}</span>
                  )}
                </dd>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {providerRegions.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8" id="watch">
          <div className="rounded-[28px] border border-white/[0.07] bg-zinc-950/55 p-5 shadow-2xl backdrop-blur-3xl sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white sm:text-2xl">Where to Watch</h2><p className="mt-1 text-xs text-zinc-500">Availability varies by region</p></div><select value={effectiveProviderRegion} onChange={(e) => setProviderRegion(e.target.value)} className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-bold text-zinc-200 outline-none">{providerRegions.map((code) => <option key={code} value={code}>{code === 'IN' ? '🇮🇳 India' : `${countryFlag(code)} ${code}`}</option>)}</select></div>
            <div className="grid gap-3 md:grid-cols-3">{[['Stream', 'flatrate'], ['Rent', 'rent'], ['Buy', 'buy']].map(([label, key]) => { const providers = selectedProviders?.[key] || []; return <div key={key} className="rounded-2xl border border-white/[0.06] bg-black/25 p-4"><p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>{providers.length ? <div className="flex flex-wrap gap-2">{providers.map((provider: any) => <div key={`${key}-${provider.provider_id}`} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] p-2 pr-3"><img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" className="h-8 w-8 rounded-lg" /><span className="text-[10px] font-bold text-zinc-300">{provider.provider_name}</span></div>)}</div> : <p className="text-xs text-zinc-600">Not listed</p>}</div>; })}</div>
          </div>
        </section>
      )}

      {keyCreators.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 md:px-8"><div className="mb-4"><h2 className="text-xl font-black text-white sm:text-2xl">Key Creators</h2><p className="mt-1 text-xs text-zinc-500">The core creative team behind the TV show</p></div><div className="flex gap-3 overflow-x-auto pb-2">{keyCreators.map((creator: any) => <Link key={creator.id} to={`/talent/${creator.id}`} className="flex min-w-[210px] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"><div className="h-12 w-12 overflow-hidden rounded-xl bg-zinc-900">{creator.profile_path ? <img src={`https://image.tmdb.org/t/p/w185${creator.profile_path}`} alt="" className="h-full w-full object-cover" /> : <Users className="m-3 h-6 w-6 text-zinc-700" />}</div><div className="min-w-0"><p className="truncate text-xs font-black text-white">{creator.name}</p><p className="mt-1 line-clamp-1 text-[9px] font-bold uppercase tracking-wide text-amber-400/75">{creator.jobs.filter((job: string) => ['Creator', 'Director', 'Writer', 'Screenplay', 'Story', 'Original Music Composer', 'Director of Photography', 'Executive Producer'].includes(job)).join(' · ')}</p></div></Link>)}</div></section>
      )}

      <ProductionMediaTrailers
        trailers={showDetails.trailers}
        backdrops={showDetails.images.backdrops}
        posters={showDetails.images.posters}
        title={showDetails.name}
        mediaType="tv"
      />

      {user && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 md:px-8 md:pt-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Lists</h2>
              <p className="mt-1 text-xs font-medium text-zinc-500">Your collections featuring this title</p>
            </div>
            <button
              type="button"
              onClick={() => setShowMyListPicker(true)}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-zinc-400 backdrop-blur-xl transition hover:bg-white/[0.08] hover:text-white"
            >
              Manage
            </button>
          </div>

          {featuredListFolders.length ? (
            <div className="-mx-4 flex snap-x snap-proximity gap-4 overflow-x-auto px-4 pb-3 no-scrollbar sm:mx-0 sm:px-0">
              {featuredListFolders.map((folder) => {
                const previewPaths = [...new Set([...(folder.posterPaths || []), showDetails.poster_path])].filter(Boolean).slice(0, 3);
                return (
                  <Link
                    key={folder.id}
                    to="/mylist"
                    className="group block w-[82vw] max-w-[430px] shrink-0 snap-start sm:w-[360px]"
                  >
                    <div className="relative h-44 overflow-hidden rounded-[30px] border border-white/[0.12] bg-white/[0.035] shadow-[0_24px_60px_rgba(0,0,0,0.46),inset_0_1px_1px_rgba(255,255,255,0.16)] sm:h-52">
                      {previewPaths[0] && (
                        <img
                          src={`https://image.tmdb.org/t/p/w780${previewPaths[0].startsWith('/') ? previewPaths[0] : `/${previewPaths[0]}`}`}
                          alt=""
                          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-2xl"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-black/20 to-black/65" />
                      <div className="absolute inset-2 rounded-[26px] border border-white/[0.11] bg-black/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl" />
                      <div className="pointer-events-none absolute inset-x-12 top-2 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />

                      <div className="absolute inset-0 flex items-center justify-center pt-1">
                        {[0, 1, 2].map((index) => {
                          const path = previewPaths[index] || previewPaths[0];
                          const transforms = [
                            '-translate-x-[58%] -rotate-[8deg] scale-[0.90]',
                            'z-30 scale-100',
                            'translate-x-[58%] rotate-[8deg] scale-[0.90]',
                          ];
                          return path ? (
                            <div
                              key={`${folder.id}-${index}`}
                              className={`absolute h-[78%] w-[31%] overflow-hidden rounded-[18px] border border-white/20 bg-zinc-900 shadow-[0_18px_36px_rgba(0,0,0,0.48),inset_0_1px_1px_rgba(255,255,255,0.18)] transition-all duration-500 group-hover:-translate-y-1 ${transforms[index]}`}
                            >
                              <img
                                src={`https://image.tmdb.org/t/p/w500${path.startsWith('/') ? path : `/${path}`}`}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.16] via-transparent to-transparent" />
                              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
                            </div>
                          ) : null;
                        })}
                      </div>

                      <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 rounded-[18px] border border-white/[0.10] bg-black/38 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.28),inset_0_1px_1px_rgba(255,255,255,0.10)] backdrop-blur-2xl">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/85">My List</p>
                          <p className="mt-0.5 truncate text-[9px] font-semibold text-white/45">{Math.max(folder.posterPaths?.length || 0, 1)} items · In this list</p>
                        </div>
                        <div className="flex items-center gap-1.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 via-violet-500 to-purple-700 text-white shadow-[0_5px_16px_rgba(168,85,247,0.35),inset_0_1px_1px_rgba(255,255,255,0.30)]"><Check className="h-3.5 w-3.5 stroke-[3]" /></span><span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/65"><MoreHorizontal className="h-4 w-4" /></span></div>
                      </div>
                    </div>
                    <div className="px-1 pt-3">
                      <h3 className="truncate text-base font-bold text-white transition-colors group-hover:text-violet-200">{folder.name}</h3>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                        {userPhoto ? (
                          <img src={userPhoto} alt="" className="h-5 w-5 rounded-full border border-white/10 object-cover" />
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[8px] font-black text-zinc-400">
                            {(user.displayName || 'U').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{user.displayName || 'Your list'}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMyListPicker(true)}
              className="group relative flex w-full max-w-xl items-center gap-4 overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.035] p-3 text-left shadow-[0_16px_44px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition hover:bg-white/[0.055]"
            >
              <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900">
                <img src={posterUrl} alt="" className="h-full w-full object-cover opacity-75 blur-[1px] transition group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/25" />
                <div className="absolute inset-0 flex items-center justify-center"><ListChecks className="h-6 w-6 text-violet-300" /></div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Add to one of your lists</p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Create a curated collection around this TV show or add it to an existing list.</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
            </button>
          )}
        </section>
      )}

      <div className="container mx-auto px-4 py-8 space-y-8 md:space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-zinc-950/45 p-4 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8"
        >
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/35 to-transparent" />
          <div className="mb-5 flex items-center justify-between gap-3 md:mb-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5"><TvMinimalPlay className="h-5 w-5 text-blue-400" /></div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black tracking-tight text-white sm:text-2xl">Seasons & Episodes</h2>
                <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500 sm:text-xs">
                  {selectedSeason !== null
                    ? `Season ${selectedSeason} · ${showDetails.seasons.find((season) => season.season_number === selectedSeason)?.episode_count ?? 0} episodes`
                    : 'Select a season to browse episodes'}
                </p>
              </div>
            </div>
            <div className="hidden rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 sm:block">
              {showDetails.number_of_seasons || showDetails.seasons.filter((season) => season.season_number > 0).length} seasons · {showDetails.number_of_episodes || '—'} episodes
            </div>
          </div>

          <div className="md:hidden">
            <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.02] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              <div className="relative aspect-[16/8.6] overflow-hidden bg-zinc-950">
                {selectedEpisodeData?.still_url ? (
                  <ProgressiveImage
                    src={selectedEpisodeData.still_url}
                    lowSrc={selectedEpisodeData.still_path ? `https://image.tmdb.org/t/p/w185${selectedEpisodeData.still_path}` : undefined}
                    alt={selectedEpisodeData.name || `Episode ${selectedEpisodeData.episode_number}`}
                    wrapperClassName="absolute inset-0"
                    className="h-full w-full object-cover"
                    eager
                  />
                ) : showDetails.poster_path ? (
                  <img src={`https://image.tmdb.org/t/p/w780${showDetails.poster_path}`} alt="" className="h-full w-full object-cover opacity-45 blur-[1px]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-7 w-7 text-zinc-700" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-lg border border-blue-400/20 bg-blue-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-300 backdrop-blur-xl">S{currentSeason} · E{currentEpisode}</span>
                    {Number.isFinite(selectedEpisodeData?.vote_average) && selectedEpisodeData?.vote_average > 0 ? <span className="text-[9px] font-bold text-amber-300">★ {Number(selectedEpisodeData.vote_average).toFixed(1)}</span> : null}
                  </div>
                  <h3 className="line-clamp-2 text-[15px] font-black leading-tight text-white">{selectedEpisodeData?.name || `Episode ${currentEpisode}`}</h3>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-400">{selectedEpisodeData?.overview || 'Browse every episode in this season from one compact sheet.'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3">
                <button type="button" onClick={openMobileEpisodeBrowser} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-blue-400/25 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-xs font-black text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                  <TvMinimalPlay className="h-4 w-4" />Browse Episodes
                </button>
                <button type="button" onClick={() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-300 shadow-lg shadow-black/30 active:scale-95" aria-label="Jump to player">
                  <Play className="h-4 w-4 fill-current" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
              <span>{showDetails.number_of_seasons || showDetails.seasons.filter((season) => season.season_number > 0).length} seasons</span>
              <span>{showDetails.number_of_episodes || '—'} episodes total</span>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="-mx-4 mb-6 flex snap-x gap-2 overflow-x-auto px-4 pb-3 no-scrollbar sm:mx-0 sm:px-0">
              {showDetails.seasons.filter((season) => season.episode_count > 0).map((season) => {
                const selected = selectedSeason === season.season_number;
                return (
                  <button type="button" key={season.season_number} onClick={() => { setSelectedSeason(season.season_number); setSelectedEpisode(1); }} className={`snap-start shrink-0 rounded-xl border px-4 py-2.5 text-xs font-black transition ${selected ? 'border-blue-400/35 bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white'}`}>
                    <span>{season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`}</span>
                    <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[9px] ${selected ? 'bg-black/20 text-blue-50' : 'bg-black/25 text-zinc-600'}`}>{season.episode_count}</span>
                  </button>
                );
              })}
            </div>
            {selectedSeason !== null && (
              <div className="min-h-[110px]">
                {episodesLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>}
                {episodesError && <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.05] p-4 text-center text-xs font-bold text-red-400">{episodesError}</div>}
                {!episodesLoading && !episodesError && episodes.length === 0 && <div className="rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.015] px-4 py-10 text-center text-xs font-medium text-zinc-600">No episodes available for this season.</div>}
                {!episodesLoading && !episodesError && episodes.length > 0 && (
                  <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                    {episodes.map((episode) => {
                      const selected = selectedEpisode === episode.episode_number;
                      return (
                        <button type="button" key={episode.id} onClick={() => setSelectedEpisode(episode.episode_number)} className={`group flex items-start gap-3.5 rounded-2xl border p-3 text-left transition ${selected ? 'border-blue-400/35 bg-blue-500/[0.08] shadow-lg shadow-blue-500/5' : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.045]'}`}>
                          <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-xl border border-white/[0.05] bg-zinc-950 sm:w-32">
                            {episode.still_url ? <ProgressiveImage src={episode.still_url} lowSrc={episode.still_path ? `https://image.tmdb.org/t/p/w185${episode.still_path}` : undefined} alt={episode.name || `Episode ${episode.episode_number}`} wrapperClassName="h-full w-full" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-5 w-5 text-zinc-700" /></div>}
                            <div className={`absolute inset-0 flex items-center justify-center bg-black/55 transition ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-blue-500' : 'bg-white/10'}`}><Play className="h-3.5 w-3.5 fill-current" /></span></div>
                            <span className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/55 px-1.5 py-0.5 text-[9px] font-black text-amber-300 backdrop-blur-md">EP {episode.episode_number}</span>
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className={`truncate text-xs font-black sm:text-sm ${selected ? 'text-blue-300' : 'text-zinc-200 group-hover:text-white'}`}>{episode.name || `Episode ${episode.episode_number}`}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-semibold text-zinc-600">
                              <span>{episode.air_date ? formatWatchDate(`${episode.air_date}T12:00:00`) : 'TBA'}</span>
                              {Number.isFinite(episode.vote_average) && episode.vote_average > 0 ? <><span>•</span><span className="text-amber-400/80">★ {Number(episode.vote_average).toFixed(1)}</span></> : null}
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">{episode.overview || 'No synopsis available.'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>

        {showMobileEpisodeBrowser && createPortal(
          <div className="fixed inset-0 z-[10060] flex items-end justify-center md:hidden">
            <button type="button" aria-label="Close episode browser" onClick={() => setShowMobileEpisodeBrowser(false)} className="absolute inset-0 bg-black/75 backdrop-blur-xl" />
            <motion.div initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950/95 shadow-[0_-24px_80px_rgba(0,0,0,0.72)] backdrop-blur-3xl">
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
              <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 pb-3 pt-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-400/15 bg-blue-500/10 text-blue-300"><TvMinimalPlay className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-black text-white">Episode Browser</p><p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-500">{showDetails.name} · Season {currentSeason}</p></div>
                <button type="button" onClick={() => setShowMobileEpisodeBrowser(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 active:scale-90"><X className="h-4 w-4" /></button>
              </div>
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Season</p>
                <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
                  {showDetails.seasons.filter((season) => season.episode_count > 0).map((season) => {
                    const selected = selectedSeason === season.season_number;
                    return <button type="button" key={season.season_number} onClick={() => { setSelectedSeason(season.season_number); setSelectedEpisode(1); }} className={`snap-start shrink-0 rounded-xl border px-3.5 py-2.5 text-[10px] font-black transition active:scale-95 ${selected ? 'border-blue-400/30 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15' : 'border-white/[0.07] bg-white/[0.035] text-zinc-400'}`}>{season.season_number === 0 ? 'Specials' : `S${season.season_number}`}<span className={`ml-1.5 text-[8px] ${selected ? 'text-white/65' : 'text-zinc-600'}`}>{season.episode_count}</span></button>;
                  })}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {episodesLoading ? <div className="flex h-64 flex-col items-center justify-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /><span className="text-[10px] font-semibold text-zinc-600">Loading episodes…</span></div> : episodesError ? <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.05] p-4 text-center text-xs font-bold text-red-400">{episodesError}</div> : !episodes.length ? <div className="rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.02] px-4 py-12 text-center text-xs font-semibold text-zinc-600">No episodes available for this season.</div> : <>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div><p className="text-xs font-black text-white">Season {currentSeason}</p><p className="mt-0.5 text-[9px] font-semibold text-zinc-600">All {episodes.length} episodes</p></div>
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[9px] font-black text-zinc-500">One page</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {episodes.map((episode) => {
                      const selected = selectedEpisode === episode.episode_number;
                      return <button
                        type="button"
                        key={episode.id}
                        onClick={() => { setSelectedEpisode(episode.episode_number); setShowMobileEpisodeBrowser(false); }}
                        className={`group min-w-0 overflow-hidden rounded-[18px] border text-left transition active:scale-[0.98] ${selected ? 'border-blue-400/35 bg-blue-500/[0.10] shadow-[0_12px_28px_rgba(59,130,246,0.12)]' : 'border-white/[0.07] bg-white/[0.025]'}`}
                      >
                        <div className="relative aspect-video overflow-hidden bg-zinc-900">
                          {episode.still_url ? (
                            <ProgressiveImage
                              src={episode.still_url}
                              lowSrc={episode.still_path ? `https://image.tmdb.org/t/p/w185${episode.still_path}` : undefined}
                              alt={episode.name || `Episode ${episode.episode_number}`}
                              wrapperClassName="absolute inset-0"
                              className="h-full w-full object-cover transition-transform duration-500 group-active:scale-[1.02]"
                            />
                          ) : showDetails.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w500${showDetails.poster_path}`}
                              alt={episode.name || `Episode ${episode.episode_number}`}
                              className="h-full w-full object-cover opacity-55"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-5 w-5 text-zinc-700" /></div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/10" />
                          <span className={`absolute left-2 top-2 rounded-lg border px-1.5 py-1 text-[8px] font-black backdrop-blur-xl ${selected ? 'border-blue-300/25 bg-blue-500/85 text-white' : 'border-white/10 bg-black/55 text-white/85'}`}>E{episode.episode_number}</span>
                          {Number.isFinite(episode.vote_average) && episode.vote_average > 0 ? <span className="absolute right-2 top-2 rounded-lg border border-amber-300/15 bg-black/55 px-1.5 py-1 text-[8px] font-black text-amber-300 backdrop-blur-xl">★ {Number(episode.vote_average).toFixed(1)}</span> : null}
                          {selected && <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30"><Play className="h-3 w-3 fill-current" /></span>}
                        </div>
                        <div className="p-2.5">
                          <p className={`line-clamp-2 min-h-[29px] text-[10px] font-black leading-[1.35] ${selected ? 'text-blue-200' : 'text-zinc-100'}`}>{episode.name || `Episode ${episode.episode_number}`}</p>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[8px] font-semibold text-zinc-600">
                            {episode.air_date ? <span className="truncate">{new Date(`${episode.air_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> : <span>TBA</span>}
                          </div>
                        </div>
                      </button>;
                    })}
                  </div>
                </>}
              </div>
              <div className="border-t border-white/[0.06] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3"><button type="button" onClick={() => setShowMobileEpisodeBrowser(false)} className="w-full rounded-2xl border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 py-3 text-[11px] font-black text-zinc-300 active:scale-[0.99]">Done</button></div>
            </motion.div>
          </div>, document.body,
        )}

        <motion.section
          ref={playerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[24px] border border-white/[0.05] bg-zinc-950/45 p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_24px_64px_rgba(0,0,0,0.7)] backdrop-blur-3xl sm:rounded-3xl sm:p-6 md:p-8 group"
        >
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm pointer-events-none" />
          <div className="relative z-10 mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/10 to-red-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-auto sm:w-auto sm:p-2.5 sm:rounded-xl">
                <TvMinimalPlay className="h-5 w-5 text-red-500 sm:animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[21px] font-extrabold tracking-tight text-white md:text-2xl">Watch Now</h2>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600 sm:text-[10px]">
                  Season {currentSeason} · Episode {currentEpisode}<span className="hidden sm:inline"> · Adaptive Player Stream</span>
                </p>
              </div>
            </div>
            <div id="media" className="min-w-0 w-full [&>*]:w-full [&>*]:max-w-full sm:ml-auto sm:w-auto sm:shrink-0 sm:[&>*]:w-auto">
              <PlayerControl source={playerSource} onChange={setPlayerSource} />
            </div>
          </div>

          <div className="relative z-10 mb-3 flex items-start gap-2.5 rounded-2xl border border-red-500/10 bg-red-500/[0.045] px-3 py-2.5 shadow-[inset_0_1px_1px_rgba(239,68,68,0.08)] sm:mb-5 sm:px-4 sm:py-3">
            <div className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 text-[10px] font-extrabold text-red-400 select-none sm:mt-0.5 sm:h-5 sm:w-5 sm:text-[11px]">i</div>
            <p className="text-[10px] font-medium leading-[1.55] text-zinc-500 sm:text-[12px] sm:leading-relaxed sm:text-zinc-400">
              For a cleaner experience, watch in <span className="font-semibold text-red-400">full screen</span> to reduce popups and intrusive ads.
            </p>
          </div>

          {VideoPlayer}

          <div className="mt-3 grid grid-cols-3 items-stretch gap-1.5 rounded-2xl border border-white/[0.07] bg-black/30 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl sm:mt-4 sm:gap-3 sm:p-2">
            <button
              type="button"
              disabled={!previousEpisodeTarget}
              onClick={() => selectEpisodeTarget(previousEpisodeTarget)}
              className="group flex min-h-[50px] min-w-0 items-center justify-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.035] px-1.5 text-center text-zinc-300 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-25 sm:min-h-11 sm:justify-start sm:gap-2 sm:px-3 sm:text-left"
            >
              <ChevronLeft className="hidden h-4 w-4 shrink-0 text-zinc-500 transition group-hover:text-white sm:block" />
              <span className="min-w-0"><span className="block text-[7px] font-black uppercase tracking-[0.1em] text-zinc-600 sm:text-[8px] sm:tracking-[0.12em]">Previous</span><span className="mt-0.5 block truncate text-[10px] font-black sm:text-xs">{previousEpisodeTarget ? `S${previousEpisodeTarget.season} E${previousEpisodeTarget.episode}` : 'Start'}</span></span>
            </button>

            <div className="flex min-h-[50px] min-w-0 flex-col items-center justify-center rounded-xl border border-blue-400/20 bg-gradient-to-b from-blue-500/[0.12] to-blue-500/[0.06] px-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-11 sm:px-3">
              <span className="text-[7px] font-black uppercase tracking-[0.1em] text-blue-300/65 sm:text-[8px] sm:tracking-[0.13em]">Now Playing</span>
              <span className="mt-0.5 truncate text-[10px] font-black text-blue-200 sm:text-xs">S{currentSeason} E{currentEpisode}</span>
            </div>

            <button
              type="button"
              disabled={!nextEpisodeTarget}
              onClick={() => selectEpisodeTarget(nextEpisodeTarget)}
              className="group flex min-h-[50px] min-w-0 items-center justify-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.035] px-1.5 text-center text-zinc-300 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-25 sm:min-h-11 sm:justify-end sm:gap-2 sm:px-3 sm:text-right"
            >
              <span className="min-w-0"><span className="block text-[7px] font-black uppercase tracking-[0.1em] text-zinc-600 sm:text-[8px] sm:tracking-[0.12em]">Next</span><span className="mt-0.5 block truncate text-[10px] font-black sm:text-xs">{nextEpisodeTarget ? `S${nextEpisodeTarget.season} E${nextEpisodeTarget.episode}` : 'Finale'}</span></span>
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-zinc-500 transition group-hover:text-white sm:block" />
            </button>
          </div>
        </motion.section>

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
              <h2 id="cast" className="text-xl md:text-2xl font-black text-white tracking-tight">Top Cast</h2>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Performers</span>
            </div>
          </div>

          <div
            ref={castContainerRef}
            className="overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory scroll-smooth relative z-10"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center gap-4 sm:gap-5 px-1">
              {showDetails.cast?.map((talent: any, idx: number) => {
                const category = talent.category || (idx < 3 ? 'Lead' : 'Supporting');
                const prevCategory =
                  idx > 0
                    ? (showDetails.cast as any)[idx - 1].category || (idx - 1 < 3 ? 'Lead' : 'Supporting')
                    : null;
                const isFirstOfCategory = idx === 0 || category !== prevCategory;

                return (
                  <React.Fragment key={talent.id}>
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

                    <Link to={`/talent/${talent.id}`} className="flex-shrink-0 snap-start group/card">
                      <SpatialCard containerRef={castContainerRef} index={idx}>
                        <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:bg-white/[0.05] group-hover/card:border-blue-500/30 group-hover/card:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                          <div className="absolute -top-10 -left-10 w-28 h-28 bg-blue-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-blue-500 transition-all duration-500 pointer-events-none" />

                          <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-blue-500/20 transition-colors duration-500">
                            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/15 to-transparent -translate-x-full -translate-y-full group-hover/card:translate-x-full group-hover/card:translate-y-full transition-transform duration-1000 ease-in-out z-10 pointer-events-none" />

                            {talent.profile_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w780${talent.profile_path}`}
                                alt={talent.name}
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
                              {talent.name}
                            </h3>
                            <div className="mt-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.03] inline-block max-w-full">
                              <p className="text-[10px] text-zinc-400 font-semibold tracking-wide line-clamp-1">
                                {talent.role || 'Character'}
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

                      <Link to={`/talent/${member.id}`} className="flex-shrink-0 snap-start group/card">
                        <SpatialCard containerRef={crewContainerRef} index={idx}>
                          <div className="relative bg-white/[0.02] rounded-2xl border border-white/[0.05] overflow-hidden w-[135px] sm:w-[175px] md:w-[185px] transition-all duration-500 group-hover/card:bg-white/[0.05] group-hover/card:border-amber-500/30 group-hover/card:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                            <div className="absolute -top-10 -left-10 w-28 h-28 bg-amber-500/0 rounded-full blur-xl opacity-0 group-hover/card:opacity-30 group-hover/card:bg-amber-500 transition-all duration-500 pointer-events-none" />
                            <div className="relative aspect-[10/11] overflow-hidden m-2 rounded-xl border border-white/[0.03] bg-zinc-950 group-hover/card:border-amber-500/20 transition-colors duration-500">
                              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/15 to-transparent -translate-x-full -translate-y-full group-hover/card:translate-x-full group-hover/card:translate-y-full transition-transform duration-1000 ease-in-out z-10 pointer-events-none" />

                              {member.profile_path ? (
                                <ProgressiveImage
                                  src={`https://image.tmdb.org/t/p/w780${member.profile_path}`}
                                  lowSrc={`https://image.tmdb.org/t/p/w92${member.profile_path}`}
                                  alt={member.name}
                                  wrapperClassName="w-full h-full"
                                  className="w-full h-full object-cover scale-[1.01] group-hover/card:scale-105 group-hover/card:brightness-[1.05] transition-all duration-700"
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



        <div id="similar">
          <SimilarTitles
            mediaType="tv"
            currentId={showDetails.id}
            genreIds={genres.map((g) => g.id)}
          />
        </div>

        {ratingHistory.length > 1 && (
          <section className="rounded-3xl border border-white/[0.07] bg-zinc-950/55 p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-600">Rating Evolution</p><p className="mt-1 text-sm font-black text-white">{ratingHistory[ratingHistory.length - 2].rating.toFixed(1)} → {ratingHistory[ratingHistory.length - 1].rating.toFixed(1)}</p></div><div className="flex h-16 items-end gap-1">{ratingHistory.slice(-8).map((entry, index) => <div key={index} className="w-2 rounded-t-sm bg-gradient-to-t from-amber-600 to-amber-300" style={{ height: `${Math.max(10, entry.rating * 6)}px` }} title={`${entry.rating}/10`} />)}</div></div></section>
        )}

        <MediaRating
          userRating={userRating}
          hasSavedRating={hasSavedRating}
          editingRating={editingRating}
          onRate={handleRateShow}
          onSubmit={handleRatingSubmit}
          onEdit={handleEditRating}
          onCancelEdit={handleCancelEditRating}
          onDeleteRating={handleDeleteRating}
          mediaType="tv"
        />



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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Saved
              </span>
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
                  <div className="relative flex-1">
                    <blockquote className={`text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal italic transition ${userExistingReview.spoiler && !revealOwnSpoiler ? 'select-none blur-[7px]' : ''}`}>{userExistingReview.content}</blockquote>
                    {userExistingReview.spoiler && !revealOwnSpoiler && <button type="button" onClick={() => setRevealOwnSpoiler(true)} className="absolute inset-0 m-auto h-9 w-fit rounded-full border border-amber-400/20 bg-black/75 px-4 text-[10px] font-black text-amber-300 backdrop-blur-xl">Reveal spoiler</button>}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40">
                  <span className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase bg-zinc-800/40 px-2.5 py-1 rounded-full border border-zinc-700/30">
                    TV Series
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
                <button type="button" onClick={() => setReviewSpoiler((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold transition ${reviewSpoiler ? 'border-amber-400/25 bg-amber-400/10 text-amber-300' : 'border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-300'}`}><EyeOff className="h-3.5 w-3.5" />{reviewSpoiler ? 'Marked as spoiler' : 'Mark as spoiler'}</button>
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
                <h2 id="reviews" className="text-xl md:text-2xl font-black text-white tracking-tight">User Reviews</h2>
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
                  Be the first to share your thoughts on this TV show.
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default TvDetails;