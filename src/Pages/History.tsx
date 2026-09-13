import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertCircle, ArrowUpDown, Bookmark, BookmarkMinus, CalendarCheck, CalendarDays, Check, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Clock3, Filter, Grid3X3, Heart, History, ImageOff, List, ListChecks, MoreHorizontal, RotateCcw, Search, Star, Trash2, Tv, X, } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Loading from '../components/Loading.tsx';

type SortMode = 'watched-desc' | 'watched-asc' | 'release-desc' | 'release-asc' | 'tmdb-desc' | 'user-rating-desc' | 'az';
type ViewMode = 'grid' | 'list' | 'timeline';
type DateEditorMode = 'edit' | 'add' | 'bulk';
type StatusFilter = 'all' | 'watchlist' | 'mylist' | 'rated';
type WatchedPeriodFilter = 'all' | 'today' | 'week' | 'month' | 'year';
type ReleaseFilter = 'all' | '2020s' | '2010s' | '2000s' | 'older';
type RatingFilter = 'all' | '8+' | '7+' | '6+';

interface MyListFolder {
  id: string;
  name: string;
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
  watchedDate: any;
  watchedDates?: any[];
  rating?: number;
  voteAverage?: number;
  runtimeMinutes?: number;
  backdropPath?: string;
}

interface MediaEnrichment {
  voteAverage: number;
  runtimeMinutes: number;
  releaseDate: string;
  posterPath: string;
  backdropPath: string;
  genres: string[];
}

interface StoredPrefs {
  mediaType?: 'movie' | 'tv';
  sortMode?: SortMode;
  selectedGenres?: string[];
  statusFilter?: StatusFilter;
  watchedPeriodFilter?: WatchedPeriodFilter;
  releaseFilter?: ReleaseFilter;
  ratingFilter?: RatingFilter;
  viewMode?: ViewMode;
}

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const PREF_KEY = 'cinescape-history-prefs-v2';
const mediaDetailsCache = new Map<string, MediaEnrichment>();


const sortOptions: { id: SortMode; label: string }[] = [
  { id: 'watched-desc', label: 'Recently Watched' },
  { id: 'watched-asc', label: 'Oldest Watched' },
  { id: 'release-desc', label: 'Newest Release' },
  { id: 'release-asc', label: 'Oldest Release' },
  { id: 'tmdb-desc', label: 'Highest TMDB Rating' },
  { id: 'user-rating-desc', label: 'Highest Your Rating' },
  { id: 'az', label: 'A–Z' },
];

const storedMediaKey = (data: any, fallbackId?: string) => {
  const fallbackMatch = typeof fallbackId === 'string' ? fallbackId.match(/^(movie|tv)[-_](\d+)$/i) : null;
  const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? fallbackMatch?.[2] ?? fallbackId;
  const numericId = Number(rawId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  const rawType = data?.mediaType ?? data?.type ?? fallbackMatch?.[1];
  const mediaType = rawType === 'tv' ? 'tv' : 'movie';
  return `${mediaType}-${numericId}`;
};

const mediaKey = (item: WatchedItem) => `${item.mediaType}-${item.movieId}`;

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

const releaseMillis = (item: WatchedItem) => {
  const value = item.releaseDate || item.first_air_date || '';
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const releaseYear = (item: WatchedItem) => {
  const value = item.releaseDate || item.first_air_date || '';
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? year : 0;
};

const formatWatchedDate = (value: any) => {
  const date = valueToDate(value);
  if (!date) return 'Watch date unavailable';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRuntime = (minutes?: number) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (!total) return '';
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h${mins}m`;
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

const watchedDateToKey = (value: any) => {
  const date = valueToDate(value);
  return date ? dateKey(date) : dateKey(new Date());
};

const normalizeWatchedDates = (values: any[], fallback?: any) => {
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => valueToDate(value))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.toISOString());
  const fallbackDate = valueToDate(fallback);
  if (fallbackDate) {
    const fallbackIso = fallbackDate.toISOString();
    if (!normalized.includes(fallbackIso)) normalized.push(fallbackIso);
  }
  return normalized.sort((a, b) => watchedMillis(a) - watchedMillis(b));
};

const getWatchedDates = (item: WatchedItem) => normalizeWatchedDates(item.watchedDates || [], item.watchedDate);

const latestWatchedDate = (item: WatchedItem) => {
  const dates = getWatchedDates(item);
  return dates.length ? dates[dates.length - 1] : item.watchedDate;
};

const latestWatchedMillis = (item: WatchedItem) => watchedMillis(latestWatchedDate(item));

const watchCount = (item: WatchedItem) => Math.max(1, getWatchedDates(item).length);

const timelineGroupMeta = (value: any) => {
  const date = valueToDate(value) || new Date();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const metadata = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (sameDay(current, today)) return { key: 'today', label: 'Today', metadata, order: Number.MAX_SAFE_INTEGER };
  if (sameDay(current, yesterday)) return { key: 'yesterday', label: 'Yesterday', metadata, order: Number.MAX_SAFE_INTEGER - 1 };
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  if (current >= weekStart && current < yesterday) return { key: 'this-week', label: 'This Week', metadata: '', order: today.getTime() - 2 };
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    metadata: '',
    order: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
  };
};

const formatDateText = (key: string) => {
  if (!key) return '';
  const [year, month, day] = key.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const parseDateText = (value: string) => {
  const text = value.trim();
  if (!text) return null;
  let year = 0;
  let month = 0;
  let day = 0;
  let match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (match) {
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else {
    match = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  }
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (date > endOfToday) return null;
  return dateKey(date);
};

const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);

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

const isWithinWatchedPeriod = (value: any, filter: WatchedPeriodFilter) => {
  if (filter === 'all') return true;
  const date = valueToDate(value);
  if (!date) return false;
  const now = new Date();
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'today') return sameDay(current, today);
  if (filter === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return current >= weekStart && current <= today;
  }
  if (filter === 'month') return current.getFullYear() === today.getFullYear() && current.getMonth() === today.getMonth();
  return current.getFullYear() === today.getFullYear();
};

const readPrefs = (): StoredPrefs => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREF_KEY) || '{}') as StoredPrefs;
  } catch {
    return {};
  }
};

const PosterImage = ({ item }: { item: WatchedItem }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const path = item.posterPath?.startsWith('/') ? item.posterPath : `/${item.posterPath || ''}`;

  return (
    <div className="absolute inset-0 bg-zinc-900">
      {!loaded && !failed && (
        <div className="absolute inset-0 overflow-hidden bg-zinc-900">
          <div className="absolute inset-0 -translate-x-full animate-[historyShimmer_1.7s_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
        </div>
      )}
      {!failed && item.posterPath ? (
        <img
          src={`https://image.tmdb.org/t/p/w342${path}`}
          srcSet={`https://image.tmdb.org/t/p/w342${path} 342w, https://image.tmdb.org/t/p/w500${path} 500w, https://image.tmdb.org/t/p/w780${path} 780w`}
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 24vw, 16vw"
          alt={item.title || item.name || ''}
          className={`h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-[1.02] ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-950 text-zinc-600">
          <ImageOff className="mb-1.5 h-8 w-8 stroke-[1.5]" />
          <span className="text-[10px] font-medium tracking-wide">Missing Poster</span>
        </div>
      )}
    </div>
  );
};

const MiniStatusCluster = ({ favorite, inMyList, inWatchlist }: { favorite: boolean; inMyList: boolean; inWatchlist: boolean }) => (
  <div className="flex items-center -space-x-1">
    {favorite && (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_6px_rgba(239,68,68,0.28),inset_0_1px_1px_rgba(255,255,255,0.32)]" title="Favorite">
        <Heart className="h-2.5 w-2.5 fill-current stroke-[2.6]" />
      </span>
    )}
    {inMyList && (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-fuchsia-500 to-purple-700 text-white shadow-[0_2px_6px_rgba(168,85,247,0.22),inset_0_1px_1px_rgba(255,255,255,0.32)]" title="In My List">
        <ListChecks className="h-2.5 w-2.5 stroke-[2.8]" />
      </span>
    )}
    {inWatchlist && (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_2px_6px_rgba(59,130,246,0.22),inset_0_1px_1px_rgba(255,255,255,0.32)]" title="In Watchlist">
        <Bookmark className="h-2.5 w-2.5 fill-current stroke-[2.6]" />
      </span>
    )}
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_2px_6px_rgba(16,185,129,0.22),inset_0_1px_1px_rgba(255,255,255,0.32)]" title="Watched">
      <Check className="h-2.5 w-2.5 stroke-[3.5]" />
    </span>
  </div>
);

const UserRatingBadge = ({ rating }: { rating?: number }) => {
  if (rating === undefined || !Number.isFinite(rating)) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-amber-400 to-orange-700 px-1.5 text-[9px] font-black leading-none text-white shadow-[0_2px_6px_rgba(245,158,11,0.28),inset_0_1px_1px_rgba(255,255,255,0.25)]" title={`Your rating: ${rating.toFixed(1)}`}>
      {rating.toFixed(1)}
    </span>
  );
};

const HistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialPrefs = useRef(readPrefs()).current;
  const lastScrollY = useRef(0);
  const [fullHistory, setFullHistory] = useState<WatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(initialPrefs.mediaType || 'movie');
  const [sortMode, setSortMode] = useState<SortMode>(initialPrefs.sortMode || 'watched-desc');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialPrefs.selectedGenres || []);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialPrefs.statusFilter || 'all');
  const [watchedPeriodFilter, setWatchedPeriodFilter] = useState<WatchedPeriodFilter>(initialPrefs.watchedPeriodFilter || 'all');
  const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>(initialPrefs.releaseFilter || 'all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(initialPrefs.ratingFilter || 'all');
  const [viewMode, setViewMode] = useState<ViewMode>(initialPrefs.viewMode === 'list' || initialPrefs.viewMode === 'timeline' ? initialPrefs.viewMode : 'grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [userRatings, setUserRatings] = useState<Map<string, number>>(new Map());
  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());
  const [watchlistDocs, setWatchlistDocs] = useState<Map<string, { id: string }>>(new Map());
  const [myListKeys, setMyListKeys] = useState<Set<string>>(new Set());
  const [myListFolders, setMyListFolders] = useState<MyListFolder[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [favoriteDocIds, setFavoriteDocIds] = useState<Map<string, string>>(new Map());
  const [editingWatchDateItem, setEditingWatchDateItem] = useState<WatchedItem | null>(null);
  const [dateEditorMode, setDateEditorMode] = useState<DateEditorMode>('edit');
  const [editingWatchDateIndex, setEditingWatchDateIndex] = useState<number | null>(null);
  const [editWatchDate, setEditWatchDate] = useState('');
  const [editWatchDateText, setEditWatchDateText] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [isSavingWatchDate, setIsSavingWatchDate] = useState(false);
  const [actionItem, setActionItem] = useState<WatchedItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerItem, setFolderPickerItem] = useState<WatchedItem | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefs: StoredPrefs = { mediaType, sortMode, selectedGenres, statusFilter, watchedPeriodFilter, releaseFilter, ratingFilter, viewMode };
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [mediaType, sortMode, selectedGenres, statusFilter, watchedPeriodFilter, releaseFilter, ratingFilter, viewMode]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 260 && y > lastScrollY.current + 8) setControlsCollapsed(true);
      if (y < lastScrollY.current - 8 || y < 180) setControlsCollapsed(false);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchMediaDetails = async (movieId: number, type: 'movie' | 'tv'): Promise<MediaEnrichment> => {
    const key = `${type}-${movieId}`;
    const cached = mediaDetailsCache.get(key);
    if (cached) return cached;
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/${type}/${movieId}`, {
        params: { api_key: API_KEY, language: 'en-US' },
      });
      const data = response.data || {};
      const details: MediaEnrichment = {
        voteAverage: Number(data.vote_average) || 0,
        runtimeMinutes: type === 'movie' ? Number(data.runtime) || 0 : Number(data.episode_run_time?.[0] || data.last_episode_to_air?.runtime) || 0,
        releaseDate: type === 'tv' ? data.first_air_date || '' : data.release_date || '',
        posterPath: data.poster_path || '',
        backdropPath: data.backdrop_path || '',
        genres: Array.isArray(data.genres) ? data.genres.map((genre: any) => genre.name).filter(Boolean) : [],
      };
      mediaDetailsCache.set(key, details);
      return details;
    } catch {
      return { voteAverage: 0, runtimeMinutes: 0, releaseDate: '', posterPath: '', backdropPath: '', genres: [] };
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const historyRef = collection(db, `users/${user.uid}/history`);
    return onSnapshot(historyRef, async (snapshot) => {
      try {
        const fetched = await Promise.all(snapshot.docs.map(async (historyDoc) => {
          const data = historyDoc.data();
          const type: 'movie' | 'tv' = data.mediaType === 'tv' ? 'tv' : 'movie';
          const movieId = Number(data.movieId ?? data.mediaId ?? 0);
          const details = movieId > 0 ? await fetchMediaDetails(movieId, type) : { voteAverage: 0, runtimeMinutes: 0, releaseDate: '', posterPath: '', backdropPath: '', genres: [] };
          const fallbackWatchedDate = data.watchedDate ?? data.timestamp ?? data.createdAt ?? new Date().toISOString();
          const watchedDates = normalizeWatchedDates(data.watchedDates || [], fallbackWatchedDate);
          const latest = watchedDates.length ? watchedDates[watchedDates.length - 1] : fallbackWatchedDate;
          return {
            id: historyDoc.id,
            movieId,
            title: data.title || '',
            name: data.name || '',
            posterPath: data.posterPath || details.posterPath || '',
            backdropPath: data.backdropPath || data.backdrop_path || details.backdropPath || '',
            releaseDate: data.releaseDate || (type === 'movie' ? details.releaseDate : '') || '',
            first_air_date: data.first_air_date || (type === 'tv' ? details.releaseDate : '') || '',
            genres: Array.isArray(data.genres) && data.genres.length ? data.genres : details.genres,
            mediaType: type,
            watchedDate: latest,
            watchedDates,
            rating: data.rating === undefined ? undefined : Number(data.rating),
            voteAverage: details.voteAverage || Number(data.vote_average) || 0,
            runtimeMinutes: details.runtimeMinutes || Number(data.runtimeMinutes) || 0,
          } as WatchedItem;
        }));
        setFullHistory(fetched);
        setLoading(false);
      } catch {
        setError('Failed to load watch history. Please try again.');
        setLoading(false);
      }
    }, () => {
      setError('Failed to load watch history. Please try again.');
      setLoading(false);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUserRatings(new Map());
      return;
    }
    return onSnapshot(collection(db, `users/${user.uid}/ratings`), (snapshot) => {
      const next = new Map<string, number>();
      snapshot.docs.forEach((ratingDoc) => {
        const data = ratingDoc.data();
        const key = storedMediaKey(data, ratingDoc.id);
        const rating = data.rating === null || data.rating === undefined ? NaN : Number(data.rating);
        if (key && Number.isFinite(rating)) next.set(key, rating);
      });
      setUserRatings(next);
    }, () => setUserRatings(new Map()));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setWatchlistKeys(new Set());
      setWatchlistDocs(new Map());
      return;
    }
    return onSnapshot(collection(db, `users/${user.uid}/watchlist`), (snapshot) => {
      const next = new Set<string>();
      const docs = new Map<string, { id: string }>();
      snapshot.docs.forEach((watchDoc) => {
        const data = watchDoc.data();
        const key = storedMediaKey(data, watchDoc.id);
        if (key) {
          next.add(key);
          docs.set(key, { id: watchDoc.id });
        }
      });
      setWatchlistKeys(next);
      setWatchlistDocs(docs);
    }, () => {
      setWatchlistKeys(new Set());
      setWatchlistDocs(new Map());
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setFavoriteKeys(new Set());
      setFavoriteDocIds(new Map());
      return;
    }
    return onSnapshot(collection(db, `users/${user.uid}/favouriteMedia`), (snapshot) => {
      const keys = new Set<string>();
      const ids = new Map<string, string>();
      snapshot.docs.forEach((favoriteDoc) => {
        const key = storedMediaKey(favoriteDoc.data(), favoriteDoc.id);
        if (key) {
          keys.add(key);
          ids.set(key, favoriteDoc.id);
        }
      });
      setFavoriteKeys(keys);
      setFavoriteDocIds(ids);
    }, () => {
      setFavoriteKeys(new Set());
      setFavoriteDocIds(new Map());
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setMyListKeys(new Set());
      setMyListFolders([]);
      return;
    }
    const legacyKeysByFolder = new Map<string, Set<string>>();
    const itemKeysByFolder = new Map<string, Set<string>>();
    const itemUnsubscribes = new Map<string, () => void>();
    const emit = () => {
      const keys = new Set<string>();
      legacyKeysByFolder.forEach((folderKeys) => folderKeys.forEach((key) => keys.add(key)));
      itemKeysByFolder.forEach((folderKeys) => folderKeys.forEach((key) => keys.add(key)));
      setMyListKeys(keys);
    };
    const rootRef = collection(db, `users/${user.uid}/customWatchlists`);
    const rootUnsubscribe = onSnapshot(rootRef, (snapshot) => {
      const liveFolderIds = new Set<string>();
      const folders: MyListFolder[] = [];
      snapshot.docs.forEach((folderDoc) => {
        const folderId = folderDoc.id;
        const folderData = folderDoc.data();
        folders.push({ id: folderId, name: folderData.name || folderData.title || folderData.listName || 'Untitled List' });
        const legacyKeys = new Set<string>();
        if (Array.isArray(folderData.items)) {
          folderData.items.forEach((item: any) => {
            const key = storedMediaKey(item);
            if (key) legacyKeys.add(key);
          });
        }
        legacyKeysByFolder.set(folderId, legacyKeys);
        liveFolderIds.add(folderId);
        if (!itemUnsubscribes.has(folderId)) {
          const itemsRef = collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`);
          const unsubscribeItems = onSnapshot(itemsRef, (itemsSnapshot) => {
            const keys = new Set<string>();
            itemsSnapshot.docs.forEach((itemDoc) => {
              const key = storedMediaKey(itemDoc.data(), itemDoc.id);
              if (key) keys.add(key);
            });
            itemKeysByFolder.set(folderId, keys);
            emit();
          }, () => {
            itemKeysByFolder.set(folderId, new Set());
            emit();
          });
          itemUnsubscribes.set(folderId, unsubscribeItems);
        }
      });
      [...itemUnsubscribes.entries()].forEach(([folderId, unsubscribeItems]) => {
        if (!liveFolderIds.has(folderId)) {
          unsubscribeItems();
          itemUnsubscribes.delete(folderId);
          itemKeysByFolder.delete(folderId);
          legacyKeysByFolder.delete(folderId);
        }
      });
      setMyListFolders(folders);
      emit();
    }, () => {
      setMyListKeys(new Set());
      setMyListFolders([]);
    });
    return () => {
      rootUnsubscribe();
      itemUnsubscribes.forEach((unsubscribeItems) => unsubscribeItems());
    };
  }, [user?.uid]);

  const history = useMemo(() => fullHistory.filter((item) => item.mediaType === mediaType), [fullHistory, mediaType]);
  const availableGenres = useMemo(() => [...new Set<string>(history.flatMap((item) => item.genres))].sort((a, b) => a.localeCompare(b)), [history]);

  const filteredAndSortedHistory = useMemo(() => {
    const threshold = ratingFilter === '8+' ? 8 : ratingFilter === '7+' ? 7 : ratingFilter === '6+' ? 6 : 0;
    return [...history]
      .filter((item) => {
        const key = mediaKey(item);
        const title = (item.title || item.name || '').toLowerCase();
        const matchesSearch = !searchTerm.trim() || title.includes(searchTerm.trim().toLowerCase());
        const matchesGenre = selectedGenres.length === 0 || selectedGenres.some((genre) => item.genres.includes(genre));
        const matchesStatus = statusFilter === 'all' ||
          (statusFilter === 'watchlist' && watchlistKeys.has(key)) ||
          (statusFilter === 'mylist' && myListKeys.has(key)) ||
          (statusFilter === 'rated' && userRatings.has(key));
        const matchesWatchedPeriod = watchedPeriodFilter === 'all' || getWatchedDates(item).some((value) => isWithinWatchedPeriod(value, watchedPeriodFilter));
        const year = releaseYear(item);
        const matchesRelease = releaseFilter === 'all' ||
          (releaseFilter === '2020s' && year >= 2020) ||
          (releaseFilter === '2010s' && year >= 2010 && year < 2020) ||
          (releaseFilter === '2000s' && year >= 2000 && year < 2010) ||
          (releaseFilter === 'older' && year > 0 && year < 2000);
        const matchesRating = !threshold || (item.voteAverage || 0) >= threshold;
        return matchesSearch && matchesGenre && matchesStatus && matchesWatchedPeriod && matchesRelease && matchesRating;
      })
      .sort((a, b) => {
        if (sortMode === 'watched-desc') return latestWatchedMillis(b) - latestWatchedMillis(a);
        if (sortMode === 'watched-asc') return latestWatchedMillis(a) - latestWatchedMillis(b);
        if (sortMode === 'release-desc') return releaseMillis(b) - releaseMillis(a);
        if (sortMode === 'release-asc') return releaseMillis(a) - releaseMillis(b);
        if (sortMode === 'tmdb-desc') return (b.voteAverage || 0) - (a.voteAverage || 0);
        if (sortMode === 'user-rating-desc') return (userRatings.get(mediaKey(b)) || -1) - (userRatings.get(mediaKey(a)) || -1);
        return (a.title || a.name || '').localeCompare(b.title || b.name || '');
      });
  }, [history, searchTerm, selectedGenres, statusFilter, watchedPeriodFilter, releaseFilter, ratingFilter, sortMode, watchlistKeys, myListKeys, userRatings]);

  const timelineGroups = useMemo(() => {
    const events = filteredAndSortedHistory
      .flatMap((item) => getWatchedDates(item).map((value, index) => ({
        id: `${item.id}-${watchedMillis(value)}-${index}`,
        item,
        date: valueToDate(value) || new Date(),
      })))
      .filter((event) => watchedPeriodFilter === 'all' || isWithinWatchedPeriod(event.date, watchedPeriodFilter))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const groups = new Map<string, { key: string; label: string; metadata: string; order: number; events: typeof events }>();
    events.forEach((event) => {
      const meta = timelineGroupMeta(event.date);
      const existing = groups.get(meta.key);
      if (existing) existing.events.push(event);
      else groups.set(meta.key, { ...meta, events: [event] });
    });
    return [...groups.values()].sort((a, b) => b.order - a.order);
  }, [filteredAndSortedHistory, watchedPeriodFilter]);

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; clear: () => void }[] = [];
    selectedGenres.forEach((genre) => chips.push({ id: `genre-${genre}`, label: genre, clear: () => setSelectedGenres((current) => current.filter((value) => value !== genre)) }));
    if (statusFilter !== 'all') chips.push({ id: 'status', label: statusFilter === 'mylist' ? 'My List' : statusFilter === 'watchlist' ? 'Watchlist' : 'Rated', clear: () => setStatusFilter('all') });
    if (watchedPeriodFilter !== 'all') chips.push({ id: 'watched-period', label: watchedPeriodFilter === 'today' ? 'Watched Today' : watchedPeriodFilter === 'week' ? 'This Week' : watchedPeriodFilter === 'month' ? 'This Month' : 'This Year', clear: () => setWatchedPeriodFilter('all') });
    if (releaseFilter !== 'all') chips.push({ id: 'release', label: releaseFilter === 'older' ? 'Older releases' : releaseFilter, clear: () => setReleaseFilter('all') });
    if (ratingFilter !== 'all') chips.push({ id: 'rating', label: `TMDB ${ratingFilter}`, clear: () => setRatingFilter('all') });
    return chips;
  }, [selectedGenres, statusFilter, watchedPeriodFilter, releaseFilter, ratingFilter]);

  const clearFilters = () => {
    setSelectedGenres([]);
    setStatusFilter('all');
    setWatchedPeriodFilter('all');
    setReleaseFilter('all');
    setRatingFilter('all');
    setSearchTerm('');
  };

  const setWatchDateSelection = (key: string) => {
    const date = keyToDate(key);
    setEditWatchDate(key);
    setEditWatchDateText(formatDateText(key));
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const openWatchDateEditor = (item: WatchedItem, watchDateIndex?: number) => {
    const dates = getWatchedDates(item);
    const index = watchDateIndex ?? Math.max(0, dates.length - 1);
    const targetDate = dates[index] ?? latestWatchedDate(item);
    const key = watchedDateToKey(targetDate);
    const date = keyToDate(key);
    setDateEditorMode('edit');
    setEditingWatchDateIndex(index);
    setEditingWatchDateItem(item);
    setEditWatchDate(key);
    setEditWatchDateText(formatDateText(key));
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const openRewatchEditor = (item: WatchedItem) => {
    const now = new Date();
    const key = dateKey(now);
    setDateEditorMode('add');
    setEditingWatchDateIndex(null);
    setEditingWatchDateItem(item);
    setEditWatchDate(key);
    setEditWatchDateText(formatDateText(key));
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const openBulkWatchDateEditor = () => {
    if (!selectedIds.size) return;
    const now = new Date();
    const key = dateKey(now);
    setDateEditorMode('bulk');
    setEditingWatchDateIndex(null);
    setEditingWatchDateItem(null);
    setEditWatchDate(key);
    setEditWatchDateText(formatDateText(key));
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const persistWatchedDates = async (item: WatchedItem, dates: any[]) => {
    if (!user?.uid) return;
    const normalized = normalizeWatchedDates(dates);
    if (!normalized.length) return;
    const latest = normalized[normalized.length - 1];
    await updateDoc(doc(db, `users/${user.uid}/history/${item.id}`), {
      watchedDates: normalized,
      watchedDate: latest,
    });
    setActionItem((current) => current?.id === item.id ? { ...current, watchedDates: normalized, watchedDate: latest } : current);
  };

  const deleteWatchDate = async (item: WatchedItem, watchDateIndex: number) => {
    if (!user?.uid) return;
    const dates = getWatchedDates(item);
    if (watchDateIndex < 0 || watchDateIndex >= dates.length) return;
    const isLastDate = dates.length === 1;
    const confirmed = typeof window === 'undefined' || window.confirm(
      isLastDate
        ? `Delete the only watch date for ${item.title || item.name || 'this title'}? This will remove it from history.`
        : `Delete this watch date for ${item.title || item.name || 'this title'}?`,
    );
    if (!confirmed) return;
    dates.splice(watchDateIndex, 1);
    if (!dates.length) {
      await deleteDoc(doc(db, `users/${user.uid}/history/${item.id}`));
      setActionItem(null);
      return;
    }
    await persistWatchedDates(item, dates);
  };

  const saveWatchDate = async () => {
    if (!user?.uid || !editWatchDate) return;
    if (dateEditorMode !== 'bulk' && !editingWatchDateItem) return;
    setIsSavingWatchDate(true);
    try {
      const nextIso = keyToDate(editWatchDate).toISOString();
      if (dateEditorMode === 'bulk') {
        const bulkTargets = fullHistory.filter((item) => selectedIds.has(item.id));
        await Promise.all(bulkTargets.map((item) => {
          const dates = getWatchedDates(item);
          if (dates.length) dates[dates.length - 1] = nextIso;
          else dates.push(nextIso);
          return persistWatchedDates(item, dates);
        }));
        setSelectedIds(new Set());
        setSelectionMode(false);
      } else if (editingWatchDateItem) {
        const dates = getWatchedDates(editingWatchDateItem);
        if (dateEditorMode === 'add') {
          dates.push(nextIso);
        } else if (dates.length) {
          const targetIndex = editingWatchDateIndex !== null && editingWatchDateIndex >= 0 && editingWatchDateIndex < dates.length
            ? editingWatchDateIndex
            : dates.length - 1;
          dates[targetIndex] = nextIso;
        } else {
          dates.push(nextIso);
        }
        await persistWatchedDates(editingWatchDateItem, dates);
      }
      setEditingWatchDateItem(null);
      setEditingWatchDateIndex(null);
      setEditWatchDate('');
      setEditWatchDateText('');
      setDateEditorMode('edit');
    } finally {
      setIsSavingWatchDate(false);
    }
  };

  const removeHistoryItem = async (item: WatchedItem) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, `users/${user.uid}/history/${item.id}`));
    setActionItem(null);
  };

  const addToWatchlist = async (item: WatchedItem) => {
    if (!user?.uid) return;
    const key = mediaKey(item);
    if (watchlistDocs.has(key)) return;
    await setDoc(doc(db, `users/${user.uid}/watchlist/${key}`), {
      movieId: item.movieId,
      mediaId: item.movieId,
      mediaType: item.mediaType,
      title: item.title || item.name || '',
      name: item.name || '',
      posterPath: item.posterPath,
      releaseDate: item.releaseDate || '',
      first_air_date: item.first_air_date || '',
      genres: item.genres,
      addedAt: serverTimestamp(),
      priority: null,
    }, { merge: true });
  };

  const toggleWatchlist = async (item: WatchedItem) => {
    if (!user?.uid) return;
    const key = mediaKey(item);
    const existing = watchlistDocs.get(key);
    if (existing) {
      await deleteDoc(doc(db, `users/${user.uid}/watchlist/${existing.id}`));
      return;
    }
    await addToWatchlist(item);
  };

  const toggleFavorite = async (item: WatchedItem) => {
    if (!user?.uid) return;
    const key = mediaKey(item);
    const existing = favoriteDocIds.get(key);
    if (existing) {
      await deleteDoc(doc(db, `users/${user.uid}/favouriteMedia/${existing}`));
      return;
    }
    await setDoc(doc(db, `users/${user.uid}/favouriteMedia/${key}`), {
      movieId: item.movieId,
      mediaId: item.movieId,
      mediaType: item.mediaType,
      title: item.title || item.name || '',
      posterPath: item.posterPath,
      addedAt: serverTimestamp(),
    }, { merge: true });
  };

  const addItemToFolder = async (item: WatchedItem, folderId: string) => {
    if (!user?.uid || !folderId) return;
    await setDoc(doc(db, `users/${user.uid}/customWatchlists/${folderId}/items/${mediaKey(item)}`), {
      id: item.movieId,
      movieId: item.movieId,
      mediaId: item.movieId,
      type: item.mediaType,
      mediaType: item.mediaType,
      title: item.title || item.name || '',
      poster: item.posterPath,
      posterPath: item.posterPath,
      releaseYear: releaseYear(item) ? String(releaseYear(item)) : '',
      voteAverage: item.voteAverage || 0,
      runtimeMinutes: item.runtimeMinutes || 0,
      genres: item.genres,
      addedAt: serverTimestamp(),
    }, { merge: true });
  };

  const removeFromMyList = async (item: WatchedItem) => {
    if (!user?.uid) return;
    const key = mediaKey(item);
    const foldersSnapshot = await getDocs(collection(db, `users/${user.uid}/customWatchlists`));
    await Promise.all(foldersSnapshot.docs.map(async (folderDoc) => {
      const folderData = folderDoc.data();
      const tasks: Promise<unknown>[] = [];
      if (Array.isArray(folderData.items)) {
        const nextItems = folderData.items.filter((storedItem: any) => storedMediaKey(storedItem) !== key);
        if (nextItems.length !== folderData.items.length) {
          tasks.push(updateDoc(doc(db, `users/${user.uid}/customWatchlists/${folderDoc.id}`), { items: nextItems }));
        }
      }
      const itemsSnapshot = await getDocs(collection(db, `users/${user.uid}/customWatchlists/${folderDoc.id}/items`));
      itemsSnapshot.docs.forEach((itemDoc) => {
        if (storedMediaKey(itemDoc.data(), itemDoc.id) === key) {
          tasks.push(deleteDoc(doc(db, `users/${user.uid}/customWatchlists/${folderDoc.id}/items/${itemDoc.id}`)));
        }
      });
      await Promise.all(tasks);
    }));
  };

  const selectedItems = useMemo(() => fullHistory.filter((item) => selectedIds.has(item.id)), [fullHistory, selectedIds]);

  const toggleSelection = (item: WatchedItem) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const handleCardOpen = (item: WatchedItem) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectionMode) {
      toggleSelection(item);
      return;
    }
    navigate(`/${item.mediaType}/${item.movieId}`);
  };

  const startLongPress = (item: WatchedItem) => {
    if (selectionMode) return;
    longPressTriggered.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setSelectionMode(true);
      setSelectedIds(new Set([item.id]));
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const bulkRemove = async () => {
    if (!user?.uid || !selectedItems.length) return;
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${selectedItems.length} selected title${selectedItems.length === 1 ? '' : 's'} from history?`)) return;
    await Promise.all(selectedItems.map((item) => deleteDoc(doc(db, `users/${user.uid}/history/${item.id}`))));
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const bulkAddToWatchlist = async () => {
    if (!user?.uid || !selectedItems.length) return;
    await Promise.all(selectedItems.map((item) => addToWatchlist(item)));
    setSelectedIds(new Set());
  };

  const moveSelectedToFolder = async (folderId: string) => {
    if (!folderId) return;
    const targets = folderPickerItem ? [folderPickerItem] : selectedItems;
    if (!targets.length) return;
    await Promise.all(targets.map((item) => addItemToFolder(item, folderId)));
    setShowFolderPicker(false);
    setFolderPickerItem(null);
    if (!folderPickerItem) setSelectedIds(new Set());
  };

  const totalMovies = fullHistory.filter((item) => item.mediaType === 'movie').length;
  const totalSeries = fullHistory.filter((item) => item.mediaType === 'tv').length;
  const noResultsBecauseFilters = Boolean(searchTerm.trim() || activeFilterChips.length);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#09090b] px-4">
        <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-zinc-900/40 p-8 text-center shadow-2xl shadow-red-950/20 backdrop-blur-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10"><AlertCircle className="h-8 w-8 text-red-500" /></div>
          <h3 className="mb-2 text-xl font-bold tracking-tight text-white">Error Loading History</h3>
          <p className="mb-6 text-sm text-zinc-400">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-500">Retry Connection</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#09090b] px-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-800/50"><History className="h-7 w-7 text-zinc-400" /></div>
          <h3 className="mb-2 text-xl font-bold tracking-tight text-white">Sign In Required</h3>
          <p className="mb-6 text-sm text-zinc-400">Sign in to access your watch history.</p>
          <button onClick={() => navigate('/login')} className="w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-600 py-3 text-sm font-semibold text-white">Sign In Account</button>
        </div>
      </div>
    );
  }

  const calendarDays = buildCalendarDays(calendarMonth);
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const calendarMonthKey = `${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`;
  const canGoNextMonth = calendarMonthKey !== currentMonthKey;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#09090b] pb-28 text-zinc-100 selection:bg-emerald-500/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[500px] bg-gradient-to-b from-emerald-950/10 via-transparent to-transparent" />
      <div className="pointer-events-none absolute right-[-5%] top-[-10%] h-[560px] w-[560px] rounded-full bg-emerald-600/[0.018] blur-[150px]" />

      <div className="relative z-10 border-b border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-3 text-white shadow-md shadow-emerald-500/20"><History className="h-6 w-6" /></div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Watch History</h1>
                <p className="text-xs font-medium text-zinc-400 sm:text-sm">A clean timeline of everything you have watched.</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 sm:self-end">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-2 shadow-inner"><Clapperboard className="h-4 w-4 text-orange-400/90" /><span className="text-xs font-semibold text-zinc-300">{totalMovies} Movies</span></div>
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-2 shadow-inner"><Tv className="h-4 w-4 text-cyan-400/90" /><span className="text-xs font-semibold text-zinc-300">{totalSeries} Series</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-30 mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <motion.div layout className={`sticky top-[72px] z-40 mb-6 flex flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-zinc-950/88 shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all sm:top-[80px] lg:top-[84px] ${controlsCollapsed ? 'p-2 sm:p-2.5' : 'p-3 sm:p-4'}`}>
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full items-center justify-between gap-2.5 lg:w-auto">
              <div className="flex flex-1 items-center rounded-xl border border-white/15 bg-white/[0.08] p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-3xl sm:flex-initial">
                <button
                  type="button"
                  onClick={() => { setMediaType('movie'); setSelectedGenres([]); setSearchTerm(''); setSelectedIds(new Set()); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold transition-all duration-300 active:scale-95 sm:flex-initial sm:px-6 ${mediaType === 'movie' ? 'border border-red-400/30 bg-gradient-to-b from-red-500 via-red-600 to-red-700 text-white shadow-[0_4px_15px_rgba(220,38,38,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}
                >
                  <Clapperboard className="h-3.5 w-3.5" />
                  <span>Movies</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMediaType('tv'); setSelectedGenres([]); setSearchTerm(''); setSelectedIds(new Set()); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2 text-xs font-semibold transition-all duration-300 active:scale-95 sm:flex-initial sm:px-6 ${mediaType === 'tv' ? 'border border-red-400/30 bg-gradient-to-b from-red-500 via-red-600 to-red-700 text-white shadow-[0_4px_15px_rgba(220,38,38,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}
                >
                  <Tv className="h-3.5 w-3.5" />
                  <span>Series</span>
                </button>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 lg:max-w-3xl lg:flex-1 lg:justify-end">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'series'}...`} className="w-full rounded-xl border border-white/[0.05] bg-zinc-900/60 py-2.5 pl-10 pr-9 text-xs text-white outline-none backdrop-blur-md placeholder:text-zinc-500 focus:border-emerald-500/30" />
                {searchTerm && <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"><X className="h-3 w-3" /></button>}
              </div>

              <div className="relative shrink-0">
                <button type="button" onClick={() => setShowSortMenu((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white sm:w-auto sm:gap-2 sm:px-3.5" title={sortOptions.find((option) => option.id === sortMode)?.label}>
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs font-semibold">{sortOptions.find((option) => option.id === sortMode)?.label}</span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 text-zinc-500 transition-transform sm:block ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-white/10 bg-zinc-950 p-1.5 shadow-2xl">
                      {sortOptions.map((option) => <button type="button" key={option.id} onClick={() => { setSortMode(option.id); setShowSortMenu(false); }} className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold ${sortMode === option.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{option.label}</button>)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button type="button" onClick={() => setShowFilters(true)} className={`flex h-10 w-10 items-center justify-center rounded-xl border sm:w-auto sm:gap-2 sm:px-3.5 ${activeFilterChips.length ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white'}`} title="Filters">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">Filters</span>
              </button>

              <div className="relative shrink-0">
                <button type="button" onClick={() => setShowViewMenu((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white sm:w-auto sm:gap-2 sm:px-3.5" title="Change view">
                  {viewMode === 'grid' ? <Grid3X3 className="h-4 w-4" /> : viewMode === 'list' ? <List className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  <span className="hidden sm:inline text-xs font-semibold">{viewMode === 'grid' ? 'Grid' : viewMode === 'list' ? 'List' : 'Timeline'}</span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 text-zinc-500 transition-transform sm:block ${showViewMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showViewMenu && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-full z-50 mt-2 w-44 rounded-2xl border border-white/10 bg-zinc-950 p-1.5 shadow-2xl">
                      {([
                        ['grid', 'Grid', Grid3X3],
                        ['list', 'List', List],
                        ['timeline', 'Timeline', History],
                      ] as const).map(([mode, label, Icon]) => (
                        <button type="button" key={mode} onClick={() => { setViewMode(mode); setShowViewMenu(false); }} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ${viewMode === mode ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                          <Icon className="h-4 w-4" />{label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>


              <button type="button" onClick={() => { setSelectionMode((value) => !value); setSelectedIds(new Set()); }} className={`flex h-10 w-10 items-center justify-center rounded-xl border sm:w-auto sm:gap-2 sm:px-3.5 ${selectionMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white'}`} title="Select titles">
                <CheckSquare className="h-4 w-4" />
                <span className="hidden md:inline text-xs font-semibold">{selectionMode ? 'Done' : 'Select'}</span>
              </button>
            </div>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {activeFilterChips.map((chip) => (
                <button type="button" key={chip.id} onClick={chip.clear} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 hover:text-white">
                  {chip.label}<X className="h-3 w-3 text-zinc-500" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="shrink-0 px-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300">Clear all</button>
            </div>
          )}
        </motion.div>

        {selectionMode && (
          <div className="mb-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.045] p-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <div>
                  <p className="text-xs font-black text-white">{selectedItems.length} selected</p>
                  <p className="text-[9px] font-medium text-zinc-500">Long press a card or tap cards while selection mode is active.</p>
                </div>
                {selectedItems.length > 0 && <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-bold text-zinc-400 hover:text-white">Clear</button>}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button type="button" disabled={!selectedItems.length} onClick={bulkAddToWatchlist} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[10px] font-bold text-blue-300 disabled:cursor-not-allowed disabled:opacity-35"><Bookmark className="h-3.5 w-3.5" />Add to Watchlist</button>
                <button type="button" disabled={!selectedItems.length} onClick={() => { setFolderPickerItem(null); setShowFolderPicker(true); }} className="shrink-0 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-[10px] font-bold text-violet-300 disabled:cursor-not-allowed disabled:opacity-35">Move to My List</button>
                <button type="button" disabled={!selectedItems.length} onClick={openBulkWatchDateEditor} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-35"><CalendarDays className="h-3.5 w-3.5" />Change Watch Date</button>
                <button type="button" disabled={!selectedItems.length} onClick={bulkRemove} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-bold text-rose-300 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" />Remove from History</button>
              </div>
            </div>
          </div>
        )}

        {filteredAndSortedHistory.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-900 bg-zinc-950/20 py-20 text-center backdrop-blur-sm">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-600"><History className="h-6 w-6" /></div>
            <h3 className="mb-1.5 text-lg font-bold tracking-tight text-white">{noResultsBecauseFilters ? 'No matches found' : 'No watch history yet'}</h3>
            <p className="mb-6 max-w-xs text-xs leading-relaxed text-zinc-500">{noResultsBecauseFilters ? 'Your active filters or search are hiding everything in this history.' : `Your ${mediaType === 'movie' ? 'movie' : 'series'} history is empty.`}</p>
            {noResultsBecauseFilters ? <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-2.5 text-xs font-bold text-zinc-950"><X className="h-3.5 w-3.5" />Clear filters</button> : <button type="button" onClick={() => navigate('/trending')} className="rounded-xl bg-zinc-100 px-5 py-2.5 text-xs font-bold text-zinc-950">Discover Media</button>}
          </motion.div>
        )}

        {viewMode === 'grid' && filteredAndSortedHistory.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredAndSortedHistory.map((item) => {
              const key = mediaKey(item);
              const userRating = userRatings.get(key);
              const inWatchlist = watchlistKeys.has(key);
              const inMyList = myListKeys.has(key);
              const favorite = favoriteKeys.has(key);
              const selected = selectedIds.has(item.id);
              return (
                <motion.article key={item.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }} onPointerDown={() => startLongPress(item)} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerLeave={cancelLongPress} onPointerMove={cancelLongPress} className={`group relative min-w-0 rounded-2xl border bg-zinc-950 shadow-md transition-all duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.42)] ${selected ? 'border-emerald-400/55 ring-2 ring-emerald-400/15' : 'border-zinc-900 hover:border-zinc-800'}`}>
                  <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl bg-zinc-900">
                    <PosterImage item={item} />
                    <button
                      type="button"
                      onClick={() => handleCardOpen(item)}
                      onPointerDown={() => startLongPress(item)}
                      onPointerUp={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerMove={cancelLongPress}
                      className="absolute inset-0 z-10"
                      aria-label={`${selectionMode ? 'Select' : 'Open'} ${item.title || item.name || 'title'}`}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-black/45 to-transparent" />
                    <div className="pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-950/80 px-1.5 py-0.5 shadow-md backdrop-blur-md"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /><span className="text-[10px] font-bold text-zinc-200">{item.voteAverage ? item.voteAverage.toFixed(1) : '—'}</span></div>
                    {releaseYear(item) > 0 && <div className="pointer-events-none absolute right-2 top-2 z-20 rounded-lg border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-bold text-zinc-200 backdrop-blur-md">{releaseYear(item)}</div>}

                    {!selectionMode && (
                      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setActionItem(item); }} className="absolute bottom-2 left-2 z-40 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/55 text-white/80 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-black/75 active:scale-90 lg:hidden" aria-label="More actions" title="More actions"><MoreHorizontal className="h-4 w-4" /></button>
                    )}

                    {selectionMode && (
                      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleSelection(item); }} className={`absolute bottom-2 left-2 z-40 flex h-8 w-8 items-center justify-center rounded-xl border ${selected ? 'border-emerald-300/40 bg-emerald-400 text-black' : 'border-white/15 bg-black/60 text-white/60'}`} aria-label={selected ? 'Deselect title' : 'Select title'}><Check className="h-4 w-4 stroke-[3]" /></button>
                    )}

                    {userRating !== undefined && <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 -translate-x-1/2"><UserRatingBadge rating={userRating} /></div>}
                    <div className="pointer-events-none absolute bottom-2 right-2 z-30"><MiniStatusCluster favorite={favorite} inMyList={inMyList} inWatchlist={inWatchlist} /></div>

                    {!selectionMode && (
                      <div className="absolute inset-x-2 bottom-2 z-40 hidden translate-y-3 items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/65 p-1.5 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleWatchlist(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10 ${inWatchlist ? 'text-blue-400' : 'text-white/80 hover:text-blue-300'}`} title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}>{inWatchlist ? <BookmarkMinus className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}</button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openRewatchEditor(item); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-400 transition hover:bg-white/10 hover:text-emerald-300" title="Add rewatch"><RotateCcw className="h-3.5 w-3.5" /></button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleFavorite(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10 ${favorite ? 'text-rose-400' : 'text-white/80 hover:text-rose-300'}`} title={favorite ? 'Remove Favorite' : 'Favorite'}><Heart className={`h-3.5 w-3.5 ${favorite ? 'fill-current' : ''}`} /></button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (inMyList) removeFromMyList(item); else { setFolderPickerItem(item); setShowFolderPicker(true); } }} className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10 ${inMyList ? 'text-fuchsia-400' : 'text-white/80 hover:text-fuchsia-300'}`} title={inMyList ? 'Remove from My List' : 'Add to My List'}><ListChecks className="h-3.5 w-3.5" /></button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openWatchDateEditor(item); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-emerald-300" title="Change watch date"><CalendarDays className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <button type="button" onClick={() => handleCardOpen(item)} className="block min-w-0 flex-1 text-left">
                        <h2 className="line-clamp-1 text-xs font-bold tracking-tight text-zinc-200 transition-colors group-hover:text-white">{item.title || item.name}</h2>
                      </button>
                      {!selectionMode && (
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => { event.stopPropagation(); setActionItem(item); }}
                          className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-95 lg:flex"
                          aria-label={`Open quick actions for ${item.title || item.name || 'title'}`}
                          title="Quick actions"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-zinc-500">
                      {item.mediaType === 'movie' && item.runtimeMinutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3 text-zinc-600" />
                          {formatRuntime(item.runtimeMinutes)}
                        </span>
                      ) : null}
                      {item.mediaType === 'movie' && item.runtimeMinutes ? <span className="text-zinc-700">•</span> : null}
                      <span className="inline-flex items-center gap-1 text-[9px] font-medium text-zinc-400">
                        <CalendarCheck className="h-3 w-3 text-emerald-400/90" />
                        {formatWatchedDate(latestWatchedDate(item))}
                      </span>
                      {watchCount(item) > 1 && (
                        <>
                          <span className="text-zinc-700">•</span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-zinc-400">
                            <RotateCcw className="h-2.5 w-2.5 text-zinc-500" />
                            {watchCount(item)}×
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">{item.genres.slice(0, 2).map((genre) => <span key={genre} className="rounded-md border border-zinc-800/60 bg-zinc-900 px-2 py-0.5 text-[9px] font-medium text-zinc-400">{genre}</span>)}</div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {viewMode === 'list' && filteredAndSortedHistory.length > 0 && (
          <div className="space-y-2.5">
            {filteredAndSortedHistory.map((item) => {
              const key = mediaKey(item);
              const userRating = userRatings.get(key);
              const inWatchlist = watchlistKeys.has(key);
              const inMyList = myListKeys.has(key);
              const favorite = favoriteKeys.has(key);
              const selected = selectedIds.has(item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  onPointerDown={() => startLongPress(item)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onPointerMove={cancelLongPress}
                  onClick={() => handleCardOpen(item)}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-zinc-950/60 p-2.5 backdrop-blur-xl transition ${selected ? 'border-emerald-400/45 ring-2 ring-emerald-400/10' : 'border-white/[0.05] hover:border-white/10'}`}
                >
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900"><PosterImage item={item} /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-white">{item.title || item.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500">
                      {watchCount(item) > 1 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-zinc-400">
                          <RotateCcw className="h-2.5 w-2.5 text-zinc-500" />
                          Watched {watchCount(item)}×
                        </span>
                      )}
                      {releaseYear(item) > 0 && (
                        <>
                          {watchCount(item) > 1 && <span className="text-zinc-700">•</span>}
                          <span>{releaseYear(item)}</span>
                        </>
                      )}
                      {item.mediaType === 'movie' && item.runtimeMinutes ? (
                        <>
                          <span className="text-zinc-700">•</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3 text-zinc-600" />
                            {formatRuntime(item.runtimeMinutes)}
                          </span>
                        </>
                      ) : null}
                      <span className="text-zinc-700">•</span>
                      <span>{item.voteAverage?.toFixed(1) || '—'} TMDB</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">{item.genres.slice(0, 3).map((genre) => <span key={genre} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-zinc-500">{genre}</span>)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.08] bg-white/[0.045] px-2.5 py-1.5 text-[9px] font-semibold text-zinc-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
                      <CalendarCheck className="h-3 w-3 text-emerald-400/90" />
                      {formatWatchedDate(latestWatchedDate(item))}
                    </span>
                    <div className="flex items-center gap-2">
                      {userRating !== undefined && <UserRatingBadge rating={userRating} />}
                      <MiniStatusCluster favorite={favorite} inMyList={inMyList} inWatchlist={inWatchlist} />
                      {selectionMode ? (
                        <button type="button" onClick={() => toggleSelection(item)} className={`flex h-9 w-9 items-center justify-center rounded-xl border ${selected ? 'border-emerald-300/40 bg-emerald-400 text-black' : 'border-white/10 bg-white/[0.03] text-zinc-500'}`}><Check className="h-4 w-4 stroke-[3]" /></button>
                      ) : (
                        <button type="button" onClick={() => setActionItem(item)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white active:scale-95" title="More actions"><MoreHorizontal className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {viewMode === 'timeline' && filteredAndSortedHistory.length > 0 && (
          <div className="space-y-8">
            {timelineGroups.map((group) => (
              <section key={group.key} className="relative">
                <div className="absolute bottom-0 left-[7px] top-5 w-px bg-gradient-to-b from-emerald-500/30 via-white/10 to-transparent" />
                <div className="relative mb-3 flex items-start gap-3">
                  <span className="relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-zinc-950 shadow-[0_0_0_4px_rgba(9,9,11,1)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-black tracking-tight text-white sm:text-base">{group.label}</h3>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-bold text-zinc-500">{group.events.length}</span>
                    </div>
                    {group.metadata && <p className="mt-0.5 text-[10px] font-medium text-zinc-600">{group.metadata}</p>}
                  </div>
                </div>
                <div className="ml-7 space-y-2.5">
                  {group.events.map((event) => {
                    const item = event.item;
                    const key = mediaKey(item);
                    const selected = selectedIds.has(item.id);
                    const inWatchlist = watchlistKeys.has(key);
                    const inMyList = myListKeys.has(key);
                    const favorite = favoriteKeys.has(key);
                    const userRating = userRatings.get(key);
                    return (
                      <motion.div key={`${group.key}-${event.id}`} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} className={`group flex items-center gap-3 rounded-2xl border bg-zinc-950/65 p-2.5 backdrop-blur-xl transition ${selected ? 'border-emerald-400/45 ring-2 ring-emerald-400/10' : 'border-white/[0.05] hover:border-white/10'}`}>
                        <button type="button" onClick={() => handleCardOpen(item)} onPointerDown={() => startLongPress(item)} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerLeave={cancelLongPress} className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900">
                          <PosterImage item={item} />
                        </button>
                        <button type="button" onClick={() => handleCardOpen(item)} className="min-w-0 flex-1 text-left">
                          <h4 className="truncate text-sm font-bold text-white">{item.title || item.name}</h4>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-500/[0.075] px-2 py-1 text-[9px] font-bold text-emerald-300"><CalendarCheck className="h-3 w-3" />{formatWatchedDate(event.date)}</span>
                            {watchCount(item) > 1 && <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-zinc-300"><RotateCcw className="h-2.5 w-2.5" />Watched {watchCount(item)}×</span>}
                            {item.mediaType === 'movie' && item.runtimeMinutes ? <span>{formatRuntime(item.runtimeMinutes)}</span> : null}
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          {userRating !== undefined && <UserRatingBadge rating={userRating} />}
                          <MiniStatusCluster favorite={favorite} inMyList={inMyList} inWatchlist={inWatchlist} />
                          {selectionMode ? (
                            <button type="button" onClick={() => toggleSelection(item)} className={`flex h-9 w-9 items-center justify-center rounded-xl border ${selected ? 'border-emerald-300/40 bg-emerald-400 text-black' : 'border-white/10 bg-white/[0.03] text-zinc-500'}`}><Check className="h-4 w-4 stroke-[3]" /></button>
                          ) : (
                            <button type="button" onClick={() => setActionItem(item)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white"><MoreHorizontal className="h-4 w-4" /></button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {filteredAndSortedHistory.length > 0 && <div className="mt-12 text-center"><div className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-900/20 px-4 py-1.5"><span className="text-xs text-zinc-500">Showing <span className="font-semibold text-zinc-400">{filteredAndSortedHistory.length}</span> history entries</span></div></div>}
      </div>

      {typeof document !== 'undefined' && actionItem && createPortal(
        <AnimatePresence>
          <motion.div className="fixed inset-0 z-[10010] flex items-end justify-center sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={() => setActionItem(null)} aria-label="Close actions" />
            <motion.div initial={{ y: 60, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0, scale: 0.985 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="relative z-10 w-full rounded-t-[30px] border border-white/10 bg-zinc-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_70px_rgba(0,0,0,0.72)] sm:max-w-md sm:rounded-[30px] sm:p-5">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" />
              <div className="mb-4 flex items-center gap-3">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900"><PosterImage item={actionItem} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Quick actions</p>
                  <h3 className="mt-1 truncate text-base font-black tracking-tight text-white">{actionItem.title || actionItem.name}</h3>
                  <p className="mt-1 text-[10px] font-medium text-zinc-500">{actionItem.mediaType === 'tv' ? 'Series' : 'Movie'} · {releaseYear(actionItem) || 'N/A'} · Watched {watchCount(actionItem)}×</p>
                </div>
                <button type="button" onClick={() => setActionItem(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={async () => { await toggleWatchlist(actionItem); setActionItem(null); }} className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-bold transition active:scale-[0.98] ${watchlistKeys.has(mediaKey(actionItem)) ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-white/[0.07] bg-white/[0.035] text-zinc-300 hover:bg-white/[0.06]'}`}>{watchlistKeys.has(mediaKey(actionItem)) ? <BookmarkMinus className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}<span>{watchlistKeys.has(mediaKey(actionItem)) ? 'Remove Watchlist' : 'Add Watchlist'}</span></button>
                <button type="button" onClick={() => { const item = actionItem; setActionItem(null); openRewatchEditor(item); }} className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-left text-xs font-bold text-emerald-300 transition active:scale-[0.98]"><RotateCcw className="h-4 w-4" /><span>Add Rewatch</span></button>
                <button type="button" onClick={async () => { await toggleFavorite(actionItem); setActionItem(null); }} className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-bold transition active:scale-[0.98] ${favoriteKeys.has(mediaKey(actionItem)) ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-white/[0.07] bg-white/[0.035] text-zinc-300 hover:bg-white/[0.06]'}`}><Heart className={`h-4 w-4 ${favoriteKeys.has(mediaKey(actionItem)) ? 'fill-current' : ''}`} /><span>{favoriteKeys.has(mediaKey(actionItem)) ? 'Unfavorite' : 'Favorite'}</span></button>
                <button type="button" onClick={async () => { if (myListKeys.has(mediaKey(actionItem))) { await removeFromMyList(actionItem); setActionItem(null); } else { setFolderPickerItem(actionItem); setShowFolderPicker(true); setActionItem(null); } }} className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-bold transition active:scale-[0.98] ${myListKeys.has(mediaKey(actionItem)) ? 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/[0.07] bg-white/[0.035] text-zinc-300 hover:bg-white/[0.06]'}`}><ListChecks className="h-4 w-4" /><span>{myListKeys.has(mediaKey(actionItem)) ? 'Remove My List' : 'Add to My List'}</span></button>
              </div>

              <button type="button" onClick={() => { const item = actionItem; setActionItem(null); openWatchDateEditor(item); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] py-3 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/10 active:scale-[0.985]"><CalendarDays className="h-4 w-4" />Change Watch Date</button>
              <div className="mt-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Watch history</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400"><RotateCcw className="h-2.5 w-2.5" />{watchCount(actionItem)} {watchCount(actionItem) === 1 ? 'watch' : 'watches'}</span>
                </div>
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {getWatchedDates(actionItem).map((date, index, dates) => ({ date, index, latest: index === dates.length - 1 })).reverse().map(({ date, index, latest }) => (
                    <div key={`${String(date)}-${index}`} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[10px] font-bold text-zinc-300">{formatWatchedDate(date)}</span>
                          {latest && <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-400">Latest</span>}
                        </div>
                        <span className="mt-0.5 block text-[8px] font-medium text-zinc-600">{index === 0 ? 'First watch' : `Rewatch ${index}`}</span>
                      </div>
                      <button type="button" onClick={() => { const item = actionItem; setActionItem(null); openWatchDateEditor(item, index); }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-zinc-400 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.08] hover:text-emerald-300" title="Edit this watch date" aria-label="Edit this watch date"><CalendarDays className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => deleteWatchDate(actionItem, index)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-rose-500/10 bg-rose-500/[0.04] text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/[0.08] hover:text-rose-300" title="Delete this watch date" aria-label="Delete this watch date"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={async () => { if (window.confirm(`Remove ${actionItem.title || actionItem.name || 'this title'} from history?`)) await removeHistoryItem(actionItem); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/15 bg-rose-500/[0.06] py-3 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10 active:scale-[0.985]"><Trash2 className="h-4 w-4" />Remove from History</button>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}

      {typeof document !== 'undefined' && showFolderPicker && createPortal(
        <AnimatePresence>
          <motion.div className="fixed inset-0 z-[10015] flex items-end justify-center sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={() => { setShowFolderPicker(false); setFolderPickerItem(null); }} aria-label="Close My List picker" />
            <motion.div initial={{ y: 60, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 60, opacity: 0, scale: 0.985 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="relative z-10 max-h-[80dvh] w-full overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950 shadow-[0_-20px_70px_rgba(0,0,0,0.72)] sm:max-w-md sm:rounded-[30px]">
              <div className="border-b border-white/[0.06] px-4 pb-4 pt-3 sm:p-5"><div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" /><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-400">My List</p><h3 className="mt-1 text-lg font-black text-white">Choose a list</h3><p className="mt-1 text-[10px] text-zinc-500">{folderPickerItem ? 'Add this title to a custom list.' : `Add ${selectedItems.length} selected title${selectedItems.length === 1 ? '' : 's'}.`}</p></div><button type="button" onClick={() => { setShowFolderPicker(false); setFolderPickerItem(null); }} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button></div></div>
              <div className="max-h-[55dvh] overflow-y-auto p-3 sm:p-4">
                {myListFolders.length ? <div className="space-y-2">{myListFolders.map((folder) => <button type="button" key={folder.id} onClick={() => moveSelectedToFolder(folder.id)} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-left transition hover:border-fuchsia-500/20 hover:bg-fuchsia-500/[0.06]"><span className="truncate text-sm font-bold text-zinc-200">{folder.name}</span><ListChecks className="h-4 w-4 shrink-0 text-fuchsia-400" /></button>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-zinc-500">No custom My List folders found.</div>}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}

      {typeof document !== 'undefined' && showFilters && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end justify-center overflow-hidden sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={() => setShowFilters(false)} aria-label="Close filters" />
          <motion.div initial={{ y: 70, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="relative z-10 max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[32px] sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="text-base font-black text-white">Filters</h3><p className="text-[10px] text-zinc-500">Refine your history without losing your place.</p></div>
              <button type="button" onClick={() => setShowFilters(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Genre</p><span className="text-[9px] text-zinc-600">Select multiple</span></div>
                <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setSelectedGenres([])} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${selectedGenres.length === 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>All</button>{availableGenres.map((genre) => { const active = selectedGenres.includes(genre); return <button type="button" key={genre} onClick={() => setSelectedGenres((current) => active ? current.filter((value) => value !== genre) : [...current, genre])} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{genre}</button>; })}</div>
              </div>
              <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Watched</p><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">{(['all', 'today', 'week', 'month', 'year'] as WatchedPeriodFilter[]).map((value) => <button type="button" key={value} onClick={() => setWatchedPeriodFilter(value)} className={`rounded-xl border px-2 py-2.5 text-[11px] font-bold ${watchedPeriodFilter === value ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{value === 'all' ? 'All' : value === 'today' ? 'Today' : value === 'week' ? 'This Week' : value === 'month' ? 'This Month' : 'This Year'}</button>)}</div></div>
              <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Status</p><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">{(['all', 'watchlist', 'mylist', 'rated'] as StatusFilter[]).map((value) => <button type="button" key={value} onClick={() => setStatusFilter(value)} className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold ${statusFilter === value ? 'border-violet-500/25 bg-violet-500/10 text-violet-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{value === 'all' ? 'All' : value === 'watchlist' ? 'Watchlist' : value === 'mylist' ? 'My List' : 'Rated'}</button>)}</div></div>
              <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Release Year</p><div className="flex flex-wrap gap-1.5">{(['all', '2020s', '2010s', '2000s', 'older'] as ReleaseFilter[]).map((value) => <button type="button" key={value} onClick={() => setReleaseFilter(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${releaseFilter === value ? 'border-sky-500/25 bg-sky-500/10 text-sky-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{value === 'all' ? 'All' : value === 'older' ? 'Older' : value}</button>)}</div></div>
              <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">TMDB Rating</p><div className="flex gap-1.5">{(['all', '8+', '7+', '6+'] as RatingFilter[]).map((value) => <button type="button" key={value} onClick={() => setRatingFilter(value)} className={`flex-1 rounded-xl border px-3 py-2.5 text-[11px] font-bold ${ratingFilter === value ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{value === 'all' ? 'All' : value}</button>)}</div></div>
            </div>
            <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-zinc-950 pt-4"><button type="button" onClick={clearFilters} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-zinc-300">Reset</button><button type="button" onClick={() => setShowFilters(false)} className="flex-1 rounded-2xl bg-white py-3 text-xs font-black text-black">Apply</button></div>
          </motion.div>
        </div>,
        document.body,
      )}

      {typeof document !== 'undefined' && (editingWatchDateItem || dateEditorMode === 'bulk') && createPortal(
        <AnimatePresence>
          <motion.div className="fixed inset-0 z-[10020] flex items-end justify-center overflow-hidden p-2 sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close watch date editor" className="absolute inset-0 bg-black/78 backdrop-blur-md" onClick={() => { if (!isSavingWatchDate) { setEditingWatchDateItem(null); setEditingWatchDateIndex(null); setEditWatchDate(''); setEditWatchDateText(''); setDateEditorMode('edit'); } }} />
            <motion.div initial={{ y: 50, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 50, opacity: 0, scale: 0.985 }} transition={{ type: 'spring', stiffness: 360, damping: 32 }} className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950 shadow-[0_30px_90px_rgba(0,0,0,0.75)] sm:max-h-[90dvh]">
              <div className="shrink-0 border-b border-white/[0.06] px-4 pb-4 pt-3 sm:px-5 sm:pt-5">
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" />
                <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">{dateEditorMode === 'add' ? 'Add rewatch' : dateEditorMode === 'bulk' ? 'Change watch dates' : editingWatchDateIndex !== null && editingWatchDateIndex > 0 ? 'Edit rewatch date' : 'Edit watch date'}</p><h3 className="mt-1 truncate text-lg font-black tracking-tight text-white">{dateEditorMode === 'bulk' ? `${selectedIds.size} selected titles` : (editingWatchDateItem?.title || editingWatchDateItem?.name || 'Watch history')}</h3></div><button type="button" onClick={() => { if (!isSavingWatchDate) { setEditingWatchDateItem(null); setEditingWatchDateIndex(null); setEditWatchDate(''); setEditWatchDateText(''); setDateEditorMode('edit'); } }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button></div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
                <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-3 sm:p-4">
                  <div className="mb-3 grid grid-cols-[36px_minmax(0,1fr)_92px_36px] items-center gap-2">
                    <button type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-zinc-400 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
                    <div className="relative min-w-0">
                      <select value={calendarMonth.getMonth()} onChange={(event) => { const month = Number(event.target.value); const year = calendarMonth.getFullYear(); const safeMonth = year === today.getFullYear() ? Math.min(month, today.getMonth()) : month; setCalendarMonth(new Date(year, safeMonth, 1)); }} className="h-9 w-full appearance-none rounded-xl border border-white/[0.07] bg-zinc-900/90 px-3 pr-8 text-xs font-bold text-white outline-none focus:border-emerald-400/30">
                        {Array.from({ length: 12 }, (_, month) => <option key={month} value={month} disabled={calendarMonth.getFullYear() === today.getFullYear() && month > today.getMonth()}>{new Date(2000, month, 1).toLocaleDateString(undefined, { month: 'long' })}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    </div>
                    <div className="relative">
                      <select value={calendarMonth.getFullYear()} onChange={(event) => { const year = Number(event.target.value); const month = year === today.getFullYear() ? Math.min(calendarMonth.getMonth(), today.getMonth()) : calendarMonth.getMonth(); setCalendarMonth(new Date(year, month, 1)); }} className="h-9 w-full appearance-none rounded-xl border border-white/[0.07] bg-zinc-900/90 px-3 pr-7 text-xs font-bold tabular-nums text-white outline-none focus:border-emerald-400/30">
                        {Array.from({ length: today.getFullYear() - 1900 + 1 }, (_, index) => today.getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    </div>
                    <button type="button" disabled={!canGoNextMonth} onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                  <div className="mb-3 rounded-2xl border border-white/[0.07] bg-black/25 p-2.5">
                    <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Type watch date</label>
                    <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3">
                      <CalendarDays className="h-4 w-4 shrink-0 text-emerald-400/80" />
                      <input type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/YYYY" value={editWatchDateText} onChange={(event) => { const text = event.target.value.replace(/[^0-9/.-]/g, '').slice(0, 10); setEditWatchDateText(text); const parsed = parseDateText(text); if (parsed) { const date = keyToDate(parsed); setEditWatchDate(parsed); setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1)); } else { setEditWatchDate(''); } }} className="h-10 min-w-0 flex-1 bg-transparent text-sm font-bold tabular-nums text-white outline-none placeholder:text-zinc-700" />
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => <div key={`${label}-${index}`} className="flex h-7 items-center justify-center text-[9px] font-black text-zinc-600">{label}</div>)}</div>
                  <div className="grid grid-cols-7 gap-1">{calendarDays.map((day) => { const key = dateKey(day); const selected = editWatchDate === key; const isToday = sameDay(day, today); const inMonth = day.getMonth() === calendarMonth.getMonth(); const future = day.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime(); return <button type="button" key={key} disabled={future} onClick={() => setWatchDateSelection(key)} className={`relative flex aspect-square min-h-9 items-center justify-center rounded-xl text-[11px] font-bold transition active:scale-90 ${selected ? 'bg-emerald-500 text-white shadow-[0_6px_18px_rgba(16,185,129,0.3)]' : future ? 'cursor-not-allowed text-zinc-800' : inMonth ? 'text-zinc-300 hover:bg-white/[0.06]' : 'text-zinc-700 hover:bg-white/[0.03]'}`}>{day.getDate()}{isToday && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400" />}</button>; })}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { const now = new Date(); setWatchDateSelection(dateKey(now)); }} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] py-2.5 text-xs font-bold text-zinc-300 hover:bg-white/[0.06] hover:text-white">Today</button><button type="button" onClick={() => { const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); setWatchDateSelection(dateKey(yesterday)); }} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] py-2.5 text-xs font-bold text-zinc-300 hover:bg-white/[0.06] hover:text-white">Yesterday</button></div>
                <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.035] px-3 py-2.5 text-xs font-semibold text-emerald-300"><CalendarCheck className="h-4 w-4" />{editWatchDate ? keyToDate(editWatchDate).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : 'Choose a date'}</div>
              </div>

              <div className="shrink-0 border-t border-white/[0.06] bg-zinc-950 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-5"><button type="button" onClick={saveWatchDate} disabled={!editWatchDate || isSavingWatchDate} className="w-full rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-3.5 text-sm font-black text-white shadow-[0_10px_28px_rgba(16,185,129,0.2),inset_0_1px_1px_rgba(255,255,255,0.25)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40">{isSavingWatchDate ? 'Saving…' : dateEditorMode === 'add' ? 'Add Rewatch' : dateEditorMode === 'bulk' ? 'Update Selected Dates' : 'Save Watch Date'}</button></div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}

      <style>{`@keyframes historyShimmer { 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
};

export default HistoryPage;

export type WatchedItemData = {
  movieId: number;
  title?: string;
  posterPath: string;
  releaseDate?: string;
  genres: string[];
  mediaType: 'movie' | 'tv';
};

export const useWatchedStatus = (movieId: number, mediaType: 'movie' | 'tv') => {
  const { user } = useAuth();
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      if (user?.uid) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const historyRef = collection(db, `users/${user.uid}/history`);
        const q = query(historyRef, where('movieId', '==', movieId), where('mediaType', '==', mediaType));
        const querySnapshot = await getDocs(q);
        if (active) setIsWatched(!querySnapshot.empty);
      }
    };
    checkStatus();
    return () => { active = false; };
  }, [user?.uid, movieId, mediaType]);

  const toggleWatched = async (movieData: any) => {
    if (!user?.uid) return { success: false, error: 'User not authenticated' };
    setLoading(true);
    try {
      const { collection, query, where, getDocs, addDoc, deleteDoc } = await import('firebase/firestore');
      const userId = user.uid;
      const historyRef = collection(db, `users/${userId}/history`);
      const historyQ = query(historyRef, where('movieId', '==', movieId), where('mediaType', '==', mediaType));
      const historySnapshot = await getDocs(historyQ);
      const watchlistRef = collection(db, `users/${userId}/watchlist`);
      const watchlistQ = query(watchlistRef, where('movieId', '==', movieId));
      if (isWatched) {
        if (!historySnapshot.empty) await deleteDoc(historySnapshot.docs[0].ref);
        setIsWatched(false);
      } else {
        if (!historySnapshot.empty) await deleteDoc(historySnapshot.docs[0].ref);
        const watchedDate = new Date().toISOString();
        await addDoc(historyRef, { ...movieData, watchedDate, watchedDates: [watchedDate] });
        setIsWatched(true);
        const watchlistSnapshot = await getDocs(watchlistQ);
        if (!watchlistSnapshot.empty) await Promise.all(watchlistSnapshot.docs.map((historyDoc) => deleteDoc(historyDoc.ref)));
      }
      return { success: true };
    } catch (error) {
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  return { isWatched, loading, toggleWatched };
};