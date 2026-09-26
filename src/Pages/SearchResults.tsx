import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, ArrowUpRight, Bookmark, BookmarkMinus, Camera, Check, ChevronRight,
  Clapperboard, Film, Grid3X3, Heart, ImageOff, Info, List, ListChecks, Loader2,
  MoreHorizontal, Music, PenTool, Play, RefreshCw, RotateCcw, Search,
  SlidersHorizontal, Star, Tv, User, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, serverTimestamp,
  setDoc, updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv' | 'person' | string;
  vote_average?: number;
  overview?: string;
  genre_ids?: number[];
  known_for_department?: string;
  popularity?: number;
  known_for?: Array<{ id?: number; title?: string; name?: string; poster_path?: string | null; media_type?: string }>;
}

interface MyListFolder {
  id: string;
  name: string;
  smartList?: boolean;
}

interface ProviderInfo {
  id: number;
  name: string;
  logoPath: string;
}

interface QuickPeekDetails {
  overview: string;
  genres: string[];
  rating: number;
  year: string;
  backdropPath?: string | null;
  providers: ProviderInfo[];
  trailerKey: string | null;
}

type TabType = 'all' | 'movies' | 'tv' | 'talents';
type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'unwatched' | 'watchlist' | 'mylist' | 'favorites' | 'rated';
type ToastState = { message: string; tone: 'success' | 'info' | 'error' } | null;
type UndoState = { message: string; action: () => Promise<void> } | null;

type StoredPrefs = {
  activeTab?: TabType;
  viewMode?: ViewMode;
  statusFilter?: StatusFilter; // legacy single-select preference
  statusFilters?: StatusFilter[];
};

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const WATCH_REGION = 'IN';
const PREF_KEY = 'cinescape_search_prefs_v2';
const RECENT_KEY = 'cinescape_recent_searches_v1';

const GENRE_MAPPING: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

const EXPLORE_GENRES = [
  { id: 28, label: 'Action' },
  { id: 53, label: 'Thriller' },
  { id: 9648, label: 'Mystery' },
  { id: 878, label: 'Sci-Fi' },
  { id: 35, label: 'Comedy' },
  { id: 18, label: 'Drama' },
  { id: 27, label: 'Horror' },
  { id: 10749, label: 'Romance' },
];

const TAB_CONFIG: { key: TabType; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', shortLabel: 'All', icon: Film },
  { key: 'movies', label: 'Movies', shortLabel: 'Movies', icon: Clapperboard },
  { key: 'tv', label: 'TV Shows', shortLabel: 'TV', icon: Tv },
  { key: 'talents', label: 'Talent', shortLabel: 'Talent', icon: User },
];

const STATUS_FILTERS: { key: StatusFilter; label: string; hint: string; icon: React.ElementType; activeClass: string }[] = [
  { key: 'all', label: 'Everything', hint: 'Show every matching result', icon: Film, activeClass: 'text-amber-300' },
  { key: 'unwatched', label: 'Unwatched', hint: 'Hide titles already in history', icon: Check, activeClass: 'text-emerald-300' },
  { key: 'watchlist', label: 'Watchlist', hint: 'Only titles saved to Watchlist', icon: Bookmark, activeClass: 'text-blue-300' },
  { key: 'mylist', label: 'My List', hint: 'Only titles inside your collections', icon: ListChecks, activeClass: 'text-violet-300' },
  { key: 'favorites', label: 'Favorites', hint: 'Favorite titles and talent', icon: Heart, activeClass: 'text-rose-300' },
  { key: 'rated', label: 'Rated by you', hint: 'Only titles you have rated', icon: Star, activeClass: 'text-amber-300' },
];

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.035 } },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 330, damping: 28 } },
};

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black';

const readPrefs = (): StoredPrefs => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const readRecentSearches = () => {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string').slice(0, 6) : [];
  } catch {
    return [] as string[];
  }
};

const mediaKey = (item: SearchResult) => `${item.media_type === 'tv' ? 'tv' : 'movie'}-${item.id}`;

const storedMediaKey = (data: any, fallbackId?: string) => {
  const fallbackMatch = typeof fallbackId === 'string' ? fallbackId.match(/^(movie|tv)[-_](\d+)$/i) : null;
  const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? fallbackMatch?.[2] ?? fallbackId;
  const numericId = Number(rawId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  const rawType = data?.mediaType ?? data?.type ?? fallbackMatch?.[1];
  const mediaType = rawType === 'tv' ? 'tv' : 'movie';
  return `${mediaType}-${numericId}`;
};

const getTitle = (item: SearchResult) => item.title || item.name || 'Untitled';
const getDate = (item: SearchResult) => item.release_date || item.first_air_date || '';
const getYear = (item: SearchResult) => {
  const year = Number(getDate(item).slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? String(year) : '';
};
const getGenres = (item: SearchResult, limit = 2) => (item.genre_ids || []).map((id) => GENRE_MAPPING[id]).filter(Boolean).slice(0, limit);

const getDepartment = (item: SearchResult) => {
  const department = (item.known_for_department || '').toLowerCase();
  if (department === 'acting') return { label: 'Acting', icon: User };
  if (department === 'directing') return { label: 'Directing', icon: Camera };
  if (department === 'writing') return { label: 'Writing', icon: PenTool };
  if (department === 'sound' || department === 'music') return { label: 'Sound', icon: Music };
  if (department === 'production') return { label: 'Production', icon: SlidersHorizontal };
  return { label: item.known_for_department || 'Talent', icon: User };
};

const getRoute = (item: SearchResult) => {
  if (item.media_type === 'person') return `/talent/${item.id}`;
  if (item.media_type === 'tv') return `/tv/${item.id}`;
  return `/movie/${item.id}`;
};

const imageUrl = (item: SearchResult, size = 'w500') => {
  const path = item.media_type === 'person'
    ? item.profile_path || item.poster_path
    : item.poster_path || item.backdrop_path;
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : `/${path}`}`;
};

const backdropUrl = (path?: string | null, size = 'w1280') => {
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : `/${path}`}`;
};

const providerLogoUrl = (path: string) => `https://image.tmdb.org/t/p/w92${path.startsWith('/') ? path : `/${path}`}`;

const dedupeResults = (items: SearchResult[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.media_type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractProviders = (regionData: any): ProviderInfo[] => {
  if (!regionData) return [];
  const merged = [
    ...(regionData.flatrate || []),
    ...(regionData.free || []),
    ...(regionData.ads || []),
    ...(regionData.buy || []),
    ...(regionData.rent || []),
  ];
  const seen = new Set<number>();
  const providers: ProviderInfo[] = [];
  for (const provider of merged) {
    const id = Number(provider.provider_id);
    if (!id || seen.has(id) || !provider.logo_path) continue;
    seen.add(id);
    providers.push({ id, name: provider.provider_name || 'Provider', logoPath: provider.logo_path });
    if (providers.length >= 3) break;
  }
  return providers;
};

const levenshtein = (a: string, b: string) => {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[left.length][right.length];
};

const ResultImage = ({ item, className = '' }: { item: SearchResult; className?: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = imageUrl(item, 'w500');

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-zinc-900 ${className}`}>
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-950" />}
      {src && !failed ? (
        <img
          src={src}
          alt={getTitle(item)}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-[1.025] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-700">
          <ImageOff className="h-7 w-7 stroke-[1.5]" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em]">No image</span>
        </div>
      )}
    </div>
  );
};

const MediaTypeBadge = ({ type }: { type: string }) => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.10] bg-zinc-950/45 text-white shadow-[0_5px_16px_rgba(0,0,0,.36),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl backdrop-saturate-150 sm:border-white/[0.12] sm:bg-black/65 sm:shadow-lg sm:backdrop-blur-xl" aria-label={type === 'tv' ? 'Series' : 'Movie'}>
    {type === 'tv' ? <Tv className="h-3.5 w-3.5 text-cyan-300" /> : <Clapperboard className="h-3.5 w-3.5 text-red-400" />}
  </span>
);

const TmdbRatingBadge = ({ rating }: { rating?: number }) => {
  if (!rating || rating <= 0) return null;
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-lg border border-white/[0.10] bg-zinc-950/45 px-2 text-[9px] font-black text-white shadow-[0_5px_16px_rgba(0,0,0,.36),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl backdrop-saturate-150 sm:border-white/[0.12] sm:bg-black/65 sm:shadow-lg sm:backdrop-blur-xl" aria-label={`TMDB rating ${rating.toFixed(1)}`}>
      <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
      {rating.toFixed(1)}
    </span>
  );
};

const UserRatingBadge = ({ rating }: { rating?: number }) => {
  if (rating === undefined || !Number.isFinite(rating)) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-amber-400 to-orange-700 px-1.5 text-[9px] font-black leading-none text-white shadow-[0_2px_7px_rgba(245,158,11,0.32)]" title={`Your rating: ${rating.toFixed(1)}`} aria-label={`Your rating ${rating.toFixed(1)}`}>
      {rating.toFixed(1)}
    </span>
  );
};

const MiniStatusCluster = ({ favorite, watched, inMyList, inWatchlist }: { favorite: boolean; watched: boolean; inMyList: boolean; inWatchlist: boolean }) => {
  if (!favorite && !watched && !inMyList && !inWatchlist) return null;
  return (
    <div className="flex items-center -space-x-1.5" aria-label="Library status">
      {favorite && (
        <span className="relative z-[5] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_8px_rgba(239,68,68,0.34)]" title="Favorite" aria-label="Favorite">
          <Heart className="h-2.5 w-2.5 fill-current stroke-[2.6]" />
        </span>
      )}
      {inMyList && (
        <span className="relative z-[4] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-fuchsia-500 to-violet-700 text-white shadow-[0_2px_8px_rgba(168,85,247,0.3)]" title="In My List" aria-label="In My List">
          <ListChecks className="h-2.5 w-2.5 stroke-[2.8]" />
        </span>
      )}
      {inWatchlist && (
        <span className="relative z-[3] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]" title="In Watchlist" aria-label="In Watchlist">
          <Bookmark className="h-2.5 w-2.5 fill-current stroke-[2.5]" />
        </span>
      )}
      {watched && (
        <span className="relative z-[2] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]" title="Watched" aria-label="Watched">
          <Check className="h-2.5 w-2.5 stroke-[3.4]" />
        </span>
      )}
    </div>
  );
};

const ProviderStrip = ({ providers, compact = false }: { providers: ProviderInfo[]; compact?: boolean }) => {
  if (!providers.length) return null;
  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'} transition-opacity duration-200 lg:opacity-45 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100`} aria-label="Streaming providers">
      {providers.slice(0, 3).map((provider) => (
        <img
          key={provider.id}
          src={providerLogoUrl(provider.logoPath)}
          alt={provider.name}
          title={provider.name}
          loading="lazy"
          className={`${compact ? 'h-5 w-5 rounded-[6px]' : 'h-6 w-6 rounded-[7px]'} border border-white/[0.08] bg-zinc-900 object-cover shadow-sm`}
        />
      ))}
    </div>
  );
};

const SkeletonResults = ({ viewMode, activeTab }: { viewMode: ViewMode; activeTab: TabType }) => {
  const grid = activeTab === 'talents' || activeTab === 'all' || viewMode === 'grid';
  if (!grid) {
    return (
      <div className="space-y-2.5 sm:space-y-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="flex min-h-[116px] items-center gap-3 rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-2.5">
            <div className="h-[96px] w-16 shrink-0 animate-pulse rounded-[15px] bg-white/[0.055]" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[0.055]" />
              <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-white/[0.04]" />
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-white/[0.03]" />
            </div>
            <div className="flex gap-1">
              <div className="h-5 w-5 animate-pulse rounded-full bg-white/[0.05]" />
              <div className="h-5 w-5 animate-pulse rounded-full bg-white/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-2.5">
          <div className="relative aspect-[2/3] animate-pulse rounded-[17px] bg-white/[0.055]">
            <div className="absolute left-2 top-2 h-6 w-6 rounded-lg bg-black/25" />
            <div className="absolute right-2 top-2 h-6 w-12 rounded-lg bg-black/25" />
            <div className="absolute bottom-[-9px] right-2 flex gap-[-2px]">
              <div className="h-5 w-5 rounded-full bg-zinc-800" />
              <div className="-ml-1.5 h-5 w-5 rounded-full bg-zinc-800" />
            </div>
          </div>
          <div className="space-y-2 px-1 pb-1 pt-4">
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/[0.055]" />
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-white/[0.04]" />
              <div className="flex gap-1"><div className="h-5 w-5 rounded-md bg-white/[0.04]" /><div className="h-5 w-5 rounded-md bg-white/[0.04]" /></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SearchResults = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const genreParam = searchParams.get('genre') || '';
  const genreLabel = searchParams.get('genreLabel') || '';
  const searchContext = query || genreLabel;
  const initialPrefs = useMemo(() => readPrefs(), []);

  const [inputVal, setInputVal] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>(initialPrefs.activeTab || 'all');
  const [viewMode, setViewMode] = useState<ViewMode>(initialPrefs.viewMode || 'grid');
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>(() => {
    const stored = Array.isArray(initialPrefs.statusFilters)
      ? initialPrefs.statusFilters.filter((filter): filter is StatusFilter => STATUS_FILTERS.some((entry) => entry.key === filter) && filter !== 'all')
      : [];
    if (stored.length) return [...new Set(stored)];
    return initialPrefs.statusFilter && initialPrefs.statusFilter !== 'all' ? [initialPrefs.statusFilter] : [];
  });
  const [searchFocused, setSearchFocused] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [stickyMobile, setStickyMobile] = useState(false);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const [trendingItems, setTrendingItems] = useState<SearchResult[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [providers, setProviders] = useState<Map<string, ProviderInfo[]>>(new Map());
  const [quickPeekItem, setQuickPeekItem] = useState<SearchResult | null>(null);
  const [quickPeekDetails, setQuickPeekDetails] = useState<QuickPeekDetails | null>(null);
  const [quickPeekLoading, setQuickPeekLoading] = useState(false);
  const [showQuickPeekTrailer, setShowQuickPeekTrailer] = useState(false);

  const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());
  const [watchlistDocIds, setWatchlistDocIds] = useState<Map<string, string>>(new Map());
  const [historyKeys, setHistoryKeys] = useState<Set<string>>(new Set());
  const [historyDocIds, setHistoryDocIds] = useState<Map<string, string>>(new Map());
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [favoriteDocIds, setFavoriteDocIds] = useState<Map<string, string>>(new Map());
  const [favoriteTalentIds, setFavoriteTalentIds] = useState<Set<string>>(new Set());
  const [favoriteTalentDocIds, setFavoriteTalentDocIds] = useState<Map<string, string>>(new Map());
  const [userRatings, setUserRatings] = useState<Map<string, number>>(new Map());
  const [myListKeys, setMyListKeys] = useState<Set<string>>(new Set());
  const [myListFolders, setMyListFolders] = useState<MyListFolder[]>([]);
  const [myListFolderKeys, setMyListFolderKeys] = useState<Map<string, Set<string>>>(new Map());

  const [actionItem, setActionItem] = useState<SearchResult | null>(null);
  const [folderPickerItem, setFolderPickerItem] = useState<SearchResult | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [undo, setUndo] = useState<UndoState>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const providerFetchedRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const haptic = useCallback((duration = 8) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(duration);
  }, []);

  const flash = useCallback((message: string, tone: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const showUndo = useCallback((message: string, action: () => Promise<void>) => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndo({ message, action: async () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      await action();
      setUndo(null);
    } });
    undoTimerRef.current = window.setTimeout(() => setUndo(null), 5000);
  }, []);

  useEffect(() => () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefs: StoredPrefs = { activeTab, viewMode, statusFilters };
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [activeTab, viewMode, statusFilters]);

  const rememberSearch = useCallback((value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setRecentSearches((current) => {
      const next = [clean, ...current.filter((entry) => entry.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      if (typeof window !== 'undefined') window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') window.localStorage.removeItem(RECENT_KEY);
  }, []);

  const performSearch = useCallback((value: string) => {
    const clean = value.trim();
    if (!clean) return;
    rememberSearch(clean);
    setActiveTab('all');
    setSearchParams({ query: clean });
    setSearchFocused(false);
  }, [rememberSearch, setSearchParams]);

  const fetchPage = useCallback(async (pageNumber: number, append: boolean) => {
    if (!query.trim() && !genreParam) {
      setResults([]);
      setPage(1);
      setTotalPages(1);
      return;
    }
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError('');
    }
    try {
      let nextResults: SearchResult[] = [];
      let nextTotalPages = 1;
      if (query.trim()) {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${pageNumber}`,
        );
        if (!response.ok) throw new Error('Network failure');
        const data = await response.json();
        nextResults = Array.isArray(data.results)
          ? data.results.filter((item: SearchResult) => ['movie', 'tv', 'person'].includes(item.media_type))
          : [];
        nextTotalPages = Math.min(Number(data.total_pages) || 1, 500);
      } else {
        const genreId = Number(genreParam);
        const [movieResponse, tvResponse] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&include_adult=false&sort_by=popularity.desc&with_genres=${genreId}&page=${pageNumber}`),
          fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&with_genres=${genreId}&page=${pageNumber}`),
        ]);
        if (!movieResponse.ok || !tvResponse.ok) throw new Error('Network failure');
        const [movieData, tvData] = await Promise.all([movieResponse.json(), tvResponse.json()]);
        nextResults = [
          ...(movieData.results || []).map((item: SearchResult) => ({ ...item, media_type: 'movie' })),
          ...(tvData.results || []).map((item: SearchResult) => ({ ...item, media_type: 'tv' })),
        ];
        nextTotalPages = Math.min(Math.max(Number(movieData.total_pages) || 1, Number(tvData.total_pages) || 1), 500);
      }
      setResults((current) => dedupeResults(append ? [...current, ...nextResults] : nextResults));
      setPage(pageNumber);
      setTotalPages(nextTotalPages);
    } catch {
      if (!append) setResults([]);
      setError('Could not load search results. Check your connection and try again.');
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [genreParam, query]);

  useEffect(() => {
    setInputVal(query);
    setResults([]);
    setPage(1);
    setTotalPages(1);
    if (query || genreParam) void fetchPage(1, false);
  }, [query, genreParam, fetchPage]);

  useEffect(() => {
    if (query || genreParam) return;
    let cancelled = false;
    setTrendingLoading(true);
    fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=en-US`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (cancelled) return;
        const items = (data.results || []).filter((item: SearchResult) => ['movie', 'tv', 'person'].includes(item.media_type)).slice(0, 10);
        setTrendingItems(items);
      })
      .catch(() => { if (!cancelled) setTrendingItems([]); })
      .finally(() => { if (!cancelled) setTrendingLoading(false); });
    return () => { cancelled = true; };
  }, [query, genreParam]);

  useEffect(() => {
    const value = inputVal.trim();
    if (!searchFocused || value.length < 2 || value.toLowerCase() === query.trim().toLowerCase()) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(value)}&include_adult=false&language=en-US&page=1`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        setSuggestions((data.results || []).filter((item: SearchResult) => ['movie', 'tv', 'person'].includes(item.media_type)).slice(0, 12));
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [inputVal, query, searchFocused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth >= 640) {
        setStickyMobile(false);
        return;
      }
      const bottom = headerRef.current?.getBoundingClientRect().bottom ?? 999;
      setStickyMobile(bottom < 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || page >= totalPages || loading || loadingMore || (!query && !genreParam)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchPage(page + 1, true);
    }, { rootMargin: '500px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, totalPages, loading, loadingMore, query, genreParam, fetchPage]);

  useEffect(() => {
    if (!results.length) return;
    let cancelled = false;
    const pending = results.filter((item) => item.media_type !== 'person' && !providerFetchedRef.current.has(mediaKey(item)));
    pending.forEach((item) => providerFetchedRef.current.add(mediaKey(item)));
    const run = async () => {
      for (let index = 0; index < pending.length; index += 6) {
        const batch = pending.slice(index, index + 6);
        const resolved = await Promise.all(batch.map(async (item) => {
          const type = item.media_type === 'tv' ? 'tv' : 'movie';
          try {
            const response = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}/watch/providers?api_key=${API_KEY}`);
            if (!response.ok) return [mediaKey(item), [] as ProviderInfo[]] as const;
            const data = await response.json();
            return [mediaKey(item), extractProviders(data.results?.[WATCH_REGION])] as const;
          } catch {
            return [mediaKey(item), [] as ProviderInfo[]] as const;
          }
        }));
        if (cancelled) return;
        setProviders((current) => {
          const next = new Map(current);
          resolved.forEach(([key, value]) => next.set(key, value));
          return next;
        });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [results]);

  useEffect(() => {
    if (!user?.uid) {
      setWatchlistKeys(new Set());
      setWatchlistDocIds(new Map());
      return;
    }
    return onSnapshot(collection(db, `users/${user.uid}/watchlist`), (snapshot) => {
      const keys = new Set<string>();
      const ids = new Map<string, string>();
      snapshot.docs.forEach((entry) => {
        const key = storedMediaKey(entry.data(), entry.id);
        if (key) {
          keys.add(key);
          ids.set(key, entry.id);
        }
      });
      setWatchlistKeys(keys);
      setWatchlistDocIds(ids);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setHistoryKeys(new Set());
      setHistoryDocIds(new Map());
      return;
    }
    return onSnapshot(collection(db, `users/${user.uid}/history`), (snapshot) => {
      const keys = new Set<string>();
      const ids = new Map<string, string>();
      snapshot.docs.forEach((entry) => {
        const key = storedMediaKey(entry.data(), entry.id);
        if (key) {
          keys.add(key);
          ids.set(key, entry.id);
        }
      });
      setHistoryKeys(keys);
      setHistoryDocIds(ids);
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
      snapshot.docs.forEach((entry) => {
        const key = storedMediaKey(entry.data(), entry.id);
        if (key) {
          keys.add(key);
          ids.set(key, entry.id);
        }
      });
      setFavoriteKeys(keys);
      setFavoriteDocIds(ids);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setFavoriteTalentIds(new Set());
      setFavoriteTalentDocIds(new Map());
      return;
    }
    return onSnapshot(collection(db, `users/${user.uid}/favouriteTalents`), (snapshot) => {
      const ids = new Set<string>();
      const docIds = new Map<string, string>();
      snapshot.docs.forEach((entry) => {
        const data = entry.data();
        const rawId = data.talentId ?? data.id ?? entry.id.replace(/^talent-/, '');
        if (rawId !== undefined && rawId !== null && String(rawId)) {
          ids.add(String(rawId));
          docIds.set(String(rawId), entry.id);
        }
      });
      setFavoriteTalentIds(ids);
      setFavoriteTalentDocIds(docIds);
    }, () => {
      setFavoriteTalentIds(new Set());
      setFavoriteTalentDocIds(new Map());
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUserRatings(new Map());
      return;
    }
    return onSnapshot(collection(db, `users/${user.uid}/ratings`), (snapshot) => {
      const ratings = new Map<string, number>();
      snapshot.docs.forEach((entry) => {
        const data = entry.data();
        const key = storedMediaKey(data, entry.id);
        const rating = Number(data.rating);
        if (key && Number.isFinite(rating)) ratings.set(key, rating);
      });
      setUserRatings(ratings);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setMyListKeys(new Set());
      setMyListFolders([]);
      setMyListFolderKeys(new Map());
      return;
    }

    const legacyKeys = new Map<string, Set<string>>();
    const nestedKeys = new Map<string, Set<string>>();
    const folderMeta = new Map<string, MyListFolder>();
    const nestedUnsubs = new Map<string, () => void>();

    const emitMembership = () => {
      const allKeys = new Set<string>();
      const byFolder = new Map<string, Set<string>>();
      folderMeta.forEach((_, folderId) => {
        const combined = new Set<string>([
          ...(legacyKeys.get(folderId) || []),
          ...(nestedKeys.get(folderId) || []),
        ]);
        combined.forEach((key) => allKeys.add(key));
        byFolder.set(folderId, combined);
      });
      setMyListKeys(allKeys);
      setMyListFolderKeys(byFolder);
      setMyListFolders([...folderMeta.values()]);
    };

    const unsubscribeRoot = onSnapshot(collection(db, `users/${user.uid}/customWatchlists`), (snapshot) => {
      const liveIds = new Set<string>();
      snapshot.docs.forEach((folderDoc) => {
        const folderId = folderDoc.id;
        const data = folderDoc.data();
        liveIds.add(folderId);
        folderMeta.set(folderId, {
          id: folderId,
          name: data.name || data.title || data.listName || 'Untitled List',
          smartList: Boolean(data.smartList),
        });
        const legacy = new Set<string>();
        if (Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            const key = storedMediaKey(item);
            if (key) legacy.add(key);
          });
        }
        legacyKeys.set(folderId, legacy);
        if (!nestedUnsubs.has(folderId)) {
          const unsubscribe = onSnapshot(collection(db, `users/${user.uid}/customWatchlists/${folderId}/items`), (itemsSnapshot) => {
            const keys = new Set<string>();
            itemsSnapshot.docs.forEach((entry) => {
              const key = storedMediaKey(entry.data(), entry.id);
              if (key) keys.add(key);
            });
            nestedKeys.set(folderId, keys);
            emitMembership();
          });
          nestedUnsubs.set(folderId, unsubscribe);
        }
      });
      [...nestedUnsubs.entries()].forEach(([folderId, unsubscribe]) => {
        if (!liveIds.has(folderId)) {
          unsubscribe();
          nestedUnsubs.delete(folderId);
          nestedKeys.delete(folderId);
          legacyKeys.delete(folderId);
          folderMeta.delete(folderId);
        }
      });
      emitMembership();
    });

    return () => {
      unsubscribeRoot();
      nestedUnsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.uid]);

  const passesStatusFilter = useCallback((item: SearchResult) => {
    if (!statusFilters.length) return true;

    if (item.media_type === 'person') {
      // Talent only has one applicable library state: Favorite. In the dedicated
      // Talent tab, unrelated movie/TV filters are ignored rather than hiding people.
      if (activeTab === 'talents') {
        const talentFilters = statusFilters.filter((filter) => filter === 'favorites');
        return talentFilters.length ? favoriteTalentIds.has(String(item.id)) : true;
      }
      // In All results, a person cannot satisfy movie/TV-only filters.
      return statusFilters.every((filter) => filter === 'favorites' && favoriteTalentIds.has(String(item.id)));
    }

    const key = mediaKey(item);
    return statusFilters.every((filter) => {
      if (filter === 'all') return true;
      if (filter === 'unwatched') return !historyKeys.has(key);
      if (filter === 'watchlist') return watchlistKeys.has(key);
      if (filter === 'mylist') return myListKeys.has(key);
      if (filter === 'favorites') return favoriteKeys.has(key);
      if (filter === 'rated') return userRatings.has(key);
      return true;
    });
  }, [statusFilters, activeTab, favoriteTalentIds, historyKeys, watchlistKeys, myListKeys, favoriteKeys, userRatings]);

  const { movies, tvShows, talents } = useMemo(() => ({
    movies: results.filter((item) => item.media_type === 'movie' && passesStatusFilter(item)),
    tvShows: results.filter((item) => item.media_type === 'tv' && passesStatusFilter(item)),
    talents: results.filter((item) => item.media_type === 'person' && passesStatusFilter(item)),
  }), [results, passesStatusFilter]);

  const tabCounts = useMemo(() => ({
    all: movies.length + tvShows.length + talents.length,
    movies: movies.length,
    tv: tvShows.length,
    talents: talents.length,
  }), [movies.length, tvShows.length, talents.length]);

  const filteredResults = useMemo(() => {
    if (activeTab === 'movies') return movies;
    if (activeTab === 'tv') return tvShows;
    if (activeTab === 'talents') return talents;
    return [...movies, ...tvShows, ...talents];
  }, [activeTab, movies, tvShows, talents]);

  useEffect(() => {
    if ((activeTab === 'talents' || activeTab === 'all') && viewMode === 'list') setViewMode('grid');
  }, [activeTab, viewMode]);

  const suggestedCorrection = useMemo(() => {
    if (!query || results.length) return '';
    const candidates = [...recentSearches, ...trendingItems.map(getTitle)]
      .filter((value, index, array) => value && array.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index);
    let best = '';
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const distance = levenshtein(query, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    const threshold = Math.max(2, Math.floor(query.length * 0.35));
    return best && best.toLowerCase() !== query.toLowerCase() && bestDistance <= threshold ? best : '';
  }, [query, results.length, recentSearches, trendingItems]);

  const ensureSignedIn = () => {
    if (user?.uid) return true;
    flash('Sign in to manage your library.', 'info');
    return false;
  };

  const payloadFor = (item: SearchResult) => ({
    movieId: item.id,
    mediaId: item.id,
    mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
    title: getTitle(item),
    name: item.name || '',
    posterPath: item.poster_path || '',
    releaseDate: item.release_date || '',
    first_air_date: item.first_air_date || '',
    genres: getGenres(item, 6),
    vote_average: Number(item.vote_average) || 0,
  });

  const setMembershipOptimistic = useCallback((folderId: string, key: string, present: boolean) => {
    setMyListFolderKeys((current) => {
      const next = new Map<string, Set<string>>(current as Map<string, Set<string>>);
      const folderKeys = new Set<string>(next.get(folderId) || []);
      if (present) folderKeys.add(key); else folderKeys.delete(key);
      next.set(folderId, folderKeys);
      const combined = new Set<string>();
      next.forEach((keys: Set<string>) => keys.forEach((entry: string) => combined.add(entry)));
      setMyListKeys(combined);
      return next;
    });
  }, []);

  const toggleWatchlist = async (item: SearchResult) => {
    if (!ensureSignedIn()) return;
    const key = mediaKey(item);
    const exists = watchlistKeys.has(key);
    const existingDocId = watchlistDocIds.get(key) || key;
    setBusyAction(`watchlist:${key}`);
    setWatchlistKeys((current) => {
      const next = new Set(current);
      if (exists) next.delete(key); else next.add(key);
      return next;
    });
    haptic();
    try {
      if (exists) {
        await deleteDoc(doc(db, `users/${user!.uid}/watchlist/${existingDocId}`));
        showUndo(`Removed ${getTitle(item)} from Watchlist`, async () => {
          setWatchlistKeys((current) => new Set(current).add(key));
          await setDoc(doc(db, `users/${user!.uid}/watchlist/${existingDocId}`), { ...payloadFor(item), addedAt: serverTimestamp() }, { merge: true });
          haptic(12);
        });
      } else {
        await setDoc(doc(db, `users/${user!.uid}/watchlist/${key}`), { ...payloadFor(item), addedAt: serverTimestamp() }, { merge: true });
        flash('Added to Watchlist.');
      }
    } catch {
      setWatchlistKeys((current) => {
        const next = new Set(current);
        if (exists) next.add(key); else next.delete(key);
        return next;
      });
      flash('Could not update Watchlist.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const toggleFavorite = async (item: SearchResult) => {
    if (!ensureSignedIn()) return;
    const key = mediaKey(item);
    const exists = favoriteKeys.has(key);
    const existingDocId = favoriteDocIds.get(key) || key;
    setBusyAction(`favorite:${key}`);
    setFavoriteKeys((current) => {
      const next = new Set(current);
      if (exists) next.delete(key); else next.add(key);
      return next;
    });
    haptic();
    try {
      if (exists) {
        await deleteDoc(doc(db, `users/${user!.uid}/favouriteMedia/${existingDocId}`));
        showUndo(`Removed ${getTitle(item)} from Favorites`, async () => {
          setFavoriteKeys((current) => new Set(current).add(key));
          await setDoc(doc(db, `users/${user!.uid}/favouriteMedia/${existingDocId}`), { ...payloadFor(item), addedAt: serverTimestamp() }, { merge: true });
          haptic(12);
        });
      } else {
        await setDoc(doc(db, `users/${user!.uid}/favouriteMedia/${key}`), { ...payloadFor(item), addedAt: serverTimestamp() }, { merge: true });
        flash('Added to Favorites.');
      }
    } catch {
      setFavoriteKeys((current) => {
        const next = new Set(current);
        if (exists) next.add(key); else next.delete(key);
        return next;
      });
      flash('Could not update Favorites.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const toggleTalentFavorite = async (item: SearchResult) => {
    if (!ensureSignedIn()) return;
    const talentId = String(item.id);
    const exists = favoriteTalentIds.has(talentId);
    const existingDocId = favoriteTalentDocIds.get(talentId) || `talent-${talentId}`;
    setBusyAction(`talent-favorite:${talentId}`);
    setFavoriteTalentIds((current) => {
      const next = new Set(current);
      if (exists) next.delete(talentId); else next.add(talentId);
      return next;
    });
    haptic();
    const payload = {
      talentId: item.id,
      id: item.id,
      name: getTitle(item),
      profilePath: item.profile_path || '',
      profile_path: item.profile_path || '',
      knownForDepartment: item.known_for_department || '',
      addedAt: serverTimestamp(),
    };
    try {
      if (exists) {
        await deleteDoc(doc(db, `users/${user!.uid}/favouriteTalents/${existingDocId}`));
        showUndo(`Unfavorited ${getTitle(item)}`, async () => {
          setFavoriteTalentIds((current) => new Set(current).add(talentId));
          await setDoc(doc(db, `users/${user!.uid}/favouriteTalents/${existingDocId}`), payload, { merge: true });
          haptic(12);
        });
      } else {
        await setDoc(doc(db, `users/${user!.uid}/favouriteTalents/talent-${talentId}`), payload, { merge: true });
        flash('Added to Favorite Talents.');
      }
    } catch {
      setFavoriteTalentIds((current) => {
        const next = new Set(current);
        if (exists) next.add(talentId); else next.delete(talentId);
        return next;
      });
      flash('Could not update Favorite Talents.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const toggleHistory = async (item: SearchResult) => {
    if (!ensureSignedIn()) return;
    const key = mediaKey(item);
    const exists = historyKeys.has(key);
    const existingDocId = historyDocIds.get(key) || key;
    setBusyAction(`history:${key}`);
    setHistoryKeys((current) => {
      const next = new Set(current);
      if (exists) next.delete(key); else next.add(key);
      return next;
    });
    haptic();
    try {
      if (exists) {
        await deleteDoc(doc(db, `users/${user!.uid}/history/${existingDocId}`));
        flash('Removed from History.', 'info');
      } else {
        await setDoc(doc(db, `users/${user!.uid}/history/${key}`), {
          ...payloadFor(item),
          watchedDate: new Date().toISOString(),
          timestamp: serverTimestamp(),
        }, { merge: true });
        flash('Marked as watched.');
      }
    } catch {
      setHistoryKeys((current) => {
        const next = new Set(current);
        if (exists) next.add(key); else next.delete(key);
        return next;
      });
      flash('Could not update History.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const toggleItemInFolder = async (item: SearchResult, folder: MyListFolder) => {
    if (!ensureSignedIn() || folder.smartList) return;
    const key = mediaKey(item);
    const inFolder = myListFolderKeys.get(folder.id)?.has(key) ?? false;
    setBusyAction(`mylist:${key}:${folder.id}`);
    setMembershipOptimistic(folder.id, key, !inFolder);
    haptic();
    try {
      const folderRef = doc(db, `users/${user!.uid}/customWatchlists/${folder.id}`);
      if (inFolder) {
        const tasks: Promise<unknown>[] = [];
        const folderSnapshot = await getDoc(folderRef);
        if (folderSnapshot.exists()) {
          const data = folderSnapshot.data();
          if (Array.isArray(data.items)) {
            const nextItems = data.items.filter((stored: any) => storedMediaKey(stored) !== key);
            if (nextItems.length !== data.items.length) tasks.push(updateDoc(folderRef, { items: nextItems }));
          }
        }
        const itemsSnapshot = await getDocs(collection(db, `users/${user!.uid}/customWatchlists/${folder.id}/items`));
        itemsSnapshot.docs.forEach((entry) => {
          if (storedMediaKey(entry.data(), entry.id) === key) tasks.push(deleteDoc(entry.ref));
        });
        await Promise.all(tasks);
        showUndo(`Removed ${getTitle(item)} from ${folder.name}`, async () => {
          setMembershipOptimistic(folder.id, key, true);
          await setDoc(doc(db, `users/${user!.uid}/customWatchlists/${folder.id}/items/${key}`), {
            id: item.id,
            movieId: item.id,
            mediaId: item.id,
            type: item.media_type === 'tv' ? 'tv' : 'movie',
            mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
            title: getTitle(item),
            poster: item.poster_path || '',
            posterPath: item.poster_path || '',
            releaseYear: getYear(item),
            releaseDate: getDate(item),
            overview: item.overview || '',
            voteAverage: Number(item.vote_average) || 0,
            genres: getGenres(item, 6),
            addedAt: serverTimestamp(),
          }, { merge: true });
          haptic(12);
        });
      } else {
        await setDoc(doc(db, `users/${user!.uid}/customWatchlists/${folder.id}/items/${key}`), {
          id: item.id,
          movieId: item.id,
          mediaId: item.id,
          type: item.media_type === 'tv' ? 'tv' : 'movie',
          mediaType: item.media_type === 'tv' ? 'tv' : 'movie',
          title: getTitle(item),
          poster: item.poster_path || '',
          posterPath: item.poster_path || '',
          releaseYear: getYear(item),
          releaseDate: getDate(item),
          overview: item.overview || '',
          voteAverage: Number(item.vote_average) || 0,
          genres: getGenres(item, 6),
          addedAt: serverTimestamp(),
        }, { merge: true });
        flash(`Added to ${folder.name}.`);
      }
    } catch {
      setMembershipOptimistic(folder.id, key, inFolder);
      flash('Could not update My List.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const openMyListPicker = (item: SearchResult) => {
    if (!ensureSignedIn()) return;
    setActionItem(null);
    setFolderPickerItem(item);
    setShowFolderPicker(true);
  };

  const openQuickPeek = useCallback(async (item: SearchResult) => {
    if (item.media_type === 'person') return;
    setActionItem(null);
    setQuickPeekItem(item);
    setQuickPeekDetails(null);
    setQuickPeekLoading(true);
    setShowQuickPeekTrailer(false);
    haptic(6);
    const type = item.media_type === 'tv' ? 'tv' : 'movie';
    try {
      const response = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&language=en-US&append_to_response=videos,watch/providers`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const videos = Array.isArray(data.videos?.results) ? data.videos.results : [];
      const youtube = videos.filter((video: any) => video.site === 'YouTube' && video.key);
      const trailer = youtube.find((video: any) => video.type === 'Trailer' && video.official)
        || youtube.find((video: any) => video.type === 'Trailer')
        || youtube.find((video: any) => video.type === 'Teaser')
        || youtube[0];
      const regionData = data['watch/providers']?.results?.[WATCH_REGION];
      const nextProviders = extractProviders(regionData);
      setProviders((current) => new Map(current).set(mediaKey(item), nextProviders));
      setQuickPeekDetails({
        overview: data.overview || item.overview || 'No overview available yet.',
        genres: (data.genres || []).map((genre: any) => genre.name).filter(Boolean).slice(0, 5),
        rating: Number(data.vote_average ?? item.vote_average) || 0,
        year: String((data.release_date || data.first_air_date || getDate(item) || '').slice(0, 4)),
        backdropPath: data.backdrop_path || item.backdrop_path,
        providers: nextProviders,
        trailerKey: trailer?.key || null,
      });
    } catch {
      setQuickPeekDetails({
        overview: item.overview || 'No overview available yet.',
        genres: getGenres(item, 5),
        rating: Number(item.vote_average) || 0,
        year: getYear(item),
        backdropPath: item.backdrop_path,
        providers: providers.get(mediaKey(item)) || [],
        trailerKey: null,
      });
    } finally {
      setQuickPeekLoading(false);
    }
  }, [haptic, providers]);

  const startLongPress = useCallback((item: SearchResult, event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setActionItem(item);
      haptic(12);
    }, 430);
  }, [haptic]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const guardLongPressNavigation = useCallback((event: React.MouseEvent) => {
    if (!longPressTriggeredRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    longPressTriggeredRef.current = false;
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    performSearch(inputVal);
  };

  const renderDesktopDock = (item: SearchResult) => {
    const key = mediaKey(item);
    const favorite = favoriteKeys.has(key);
    const watched = historyKeys.has(key);
    const inMyList = myListKeys.has(key);
    const inWatchlist = watchlistKeys.has(key);
    return (
      <div className="absolute bottom-3 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-white/[0.12] bg-black/70 p-1 shadow-[0_12px_30px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.12)] opacity-0 backdrop-blur-2xl transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 lg:flex">
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggleFavorite(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10 ${favorite ? 'text-rose-400' : 'text-white/80 hover:text-rose-300'} ${FOCUS_RING}`} title={favorite ? 'Remove Favorite' : 'Favorite'} aria-label={favorite ? `Remove ${getTitle(item)} from Favorites` : `Favorite ${getTitle(item)}`}>
          <Heart className={`h-3.5 w-3.5 ${favorite ? 'fill-current' : ''}`} />
        </button>
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggleHistory(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10 ${watched ? 'text-emerald-400' : 'text-white/80 hover:text-emerald-300'} ${FOCUS_RING}`} title={watched ? 'Remove from History' : 'Mark Watched'} aria-label={watched ? `Remove ${getTitle(item)} from History` : `Mark ${getTitle(item)} watched`}>
          <Check className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openMyListPicker(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10 ${inMyList ? 'text-violet-400' : 'text-white/80 hover:text-violet-300'} ${FOCUS_RING}`} title="Manage List" aria-label={`Manage lists for ${getTitle(item)}`}>
          <ListChecks className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggleWatchlist(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-white/10 ${inWatchlist ? 'text-blue-400' : 'text-white/80 hover:text-blue-300'} ${FOCUS_RING}`} title={inWatchlist ? 'Remove Watchlist' : 'Add Watchlist'} aria-label={inWatchlist ? `Remove ${getTitle(item)} from Watchlist` : `Add ${getTitle(item)} to Watchlist`}>
          {inWatchlist ? <BookmarkMinus className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void openQuickPeek(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-cyan-300 ${FOCUS_RING}`} title="Quick Peek" aria-label={`Quick Peek ${getTitle(item)}`}>
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderGridCard = (item: SearchResult) => {
    const key = mediaKey(item);
    const favorite = favoriteKeys.has(key);
    const watched = historyKeys.has(key);
    const inMyList = myListKeys.has(key);
    const inWatchlist = watchlistKeys.has(key);
    const rating = userRatings.get(key);
    const genres = getGenres(item);
    const itemProviders = providers.get(key) || [];

    return (
      <motion.article
        key={`${item.media_type}-${item.id}`}
        variants={CARD_VARIANTS}
        onPointerDown={(event) => startLongPress(item, event)}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={(event) => { if (window.innerWidth < 1024) event.preventDefault(); }}
        className="group relative h-full min-w-0"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(18,18,20,.92),rgba(7,7,8,.98))] p-2.5 shadow-[0_16px_42px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-[0_22px_55px_rgba(0,0,0,.44),0_0_0_1px_rgba(255,255,255,.025)] sm:rounded-[26px]">
          <div className="relative aspect-[2/3] overflow-visible">
            <div className="relative h-full overflow-hidden rounded-[17px] border border-white/[0.08] bg-zinc-900 sm:rounded-[20px]">
              <ResultImage item={item} />
              <Link to={getRoute(item)} onClick={guardLongPressNavigation} aria-label={`Open ${getTitle(item)}`} className={`absolute inset-0 z-10 lg:hidden ${FOCUS_RING}`} />
              <button type="button" onClick={() => void openQuickPeek(item)} aria-label={`Quick Peek ${getTitle(item)}`} className={`absolute inset-0 z-10 hidden cursor-zoom-in lg:block ${FOCUS_RING}`} />
              <div className="pointer-events-none absolute inset-0 z-[11] bg-gradient-to-b from-black/18 via-transparent to-black/38" />
              <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-2">
                <MediaTypeBadge type={item.media_type} />
                <TmdbRatingBadge rating={item.vote_average} />
              </div>
              <button
                type="button"
                aria-label={`Actions for ${getTitle(item)}`}
                onClick={(event) => { event.stopPropagation(); setActionItem(item); }}
                className={`absolute bottom-1.5 left-1.5 z-30 flex h-11 w-11 items-center justify-center rounded-[14px] text-white/90 transition active:scale-95 lg:hidden ${FOCUS_RING}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[11px] border border-white/[0.10] bg-zinc-950/45 shadow-[0_5px_16px_rgba(0,0,0,.36),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl backdrop-saturate-150">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              </button>
              {renderDesktopDock(item)}
            </div>
            <div className="pointer-events-none absolute bottom-0 right-2 z-40 translate-y-1/2">
              <MiniStatusCluster favorite={favorite} watched={watched} inMyList={inMyList} inWatchlist={inWatchlist} />
            </div>
          </div>

          <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <Link to={getRoute(item)} onClick={guardLongPressNavigation} className={`min-w-0 flex-1 rounded-sm ${FOCUS_RING}`}>
                <h2 className="line-clamp-1 text-[12px] font-bold tracking-[-.01em] text-zinc-100 transition-colors group-hover:text-white sm:text-sm">{getTitle(item)}</h2>
              </Link>
              <UserRatingBadge rating={rating} />
            </div>
            <div className="mt-1.5 flex min-h-4 items-center gap-1.5 text-[9px] font-semibold text-zinc-500 sm:text-[10px]">
              <span>{getYear(item) || 'TBA'}</span>
              {genres.length > 0 && <span className="text-zinc-700">•</span>}
              <span className="min-w-0 truncate">{genres.join(' · ')}</span>
            </div>
            <div className={`mt-auto min-h-[31px] border-t pt-2.5 ${itemProviders.length > 0 ? 'border-white/[0.055]' : 'border-transparent'}`}>
              {itemProviders.length > 0 ? (
                <ProviderStrip providers={itemProviders} compact />
              ) : (
                <div className="h-5" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
      </motion.article>
    );
  };

  const renderListCard = (item: SearchResult) => {
    const key = mediaKey(item);
    const favorite = favoriteKeys.has(key);
    const watched = historyKeys.has(key);
    const inMyList = myListKeys.has(key);
    const inWatchlist = watchlistKeys.has(key);
    const rating = userRatings.get(key);
    const genres = getGenres(item);
    const itemProviders = providers.get(key) || [];

    return (
      <motion.article
        key={`${item.media_type}-${item.id}`}
        variants={CARD_VARIANTS}
        onPointerDown={(event) => startLongPress(item, event)}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        className="group flex min-h-[116px] items-center gap-3 rounded-[22px] border border-white/[0.075] bg-white/[0.025] p-2.5 shadow-[0_14px_35px_rgba(0,0,0,.2)] backdrop-blur-2xl transition hover:border-white/[0.14] hover:bg-white/[0.04] sm:gap-4 sm:p-3"
      >
        <button type="button" onClick={() => void openQuickPeek(item)} className={`relative h-[96px] w-16 shrink-0 overflow-hidden rounded-[15px] border border-white/[0.08] bg-zinc-900 sm:h-[112px] sm:w-[75px] ${FOCUS_RING}`} aria-label={`Quick Peek ${getTitle(item)}`}>
          <ResultImage item={item} />
          <div className="absolute left-1.5 top-1.5"><TmdbRatingBadge rating={item.vote_average} /></div>
        </button>
        <Link to={getRoute(item)} onClick={guardLongPressNavigation} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl sm:gap-4 ${FOCUS_RING}`}>
          <div className="min-w-0 flex-1 py-1">
            <div className="flex items-center gap-2">
              <MediaTypeBadge type={item.media_type} />
              <span className="text-[9px] font-semibold text-zinc-600">{getYear(item) || 'TBA'}</span>
            </div>
            <h2 className="mt-2 line-clamp-1 text-sm font-black tracking-tight text-zinc-100 sm:text-base">{getTitle(item)}</h2>
            {genres.length > 0 && <p className="mt-1 text-[10px] font-semibold text-zinc-500">{genres.join(' · ')}</p>}
            {item.overview && <p className="mt-2 hidden line-clamp-2 max-w-3xl text-[11px] leading-relaxed text-zinc-600 sm:block">{item.overview}</p>}
          </div>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2 pr-0.5">
          <div className="flex items-center gap-1.5">
            <UserRatingBadge rating={rating} />
            <MiniStatusCluster favorite={favorite} watched={watched} inMyList={inMyList} inWatchlist={inWatchlist} />
          </div>
          <div className="flex items-center gap-2">
            {itemProviders.length > 0 && <ProviderStrip providers={itemProviders} compact />}
            <button type="button" onClick={() => setActionItem(item)} className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-zinc-400 transition hover:bg-white/[0.07] hover:text-white active:scale-95 ${FOCUS_RING}`} aria-label={`More actions for ${getTitle(item)}`}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.article>
    );
  };

  const renderTalentCard = (item: SearchResult) => {
    const department = getDepartment(item);
    const Icon = department.icon;
    const isFavouriteTalent = favoriteTalentIds.has(String(item.id));
    return (
      <motion.article
        key={`talent-${item.id}`}
        variants={CARD_VARIANTS}
        onPointerDown={(event) => startLongPress(item, event)}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        className="group relative"
      >
        <div className="block overflow-hidden rounded-[24px] border border-white/[0.075] bg-[linear-gradient(145deg,rgba(18,18,20,.9),rgba(7,7,8,.98))] p-2.5 shadow-[0_16px_42px_rgba(0,0,0,.26)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.14]">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[18px] border border-white/[0.08] bg-zinc-900">
            <ResultImage item={item} />
            <Link to={getRoute(item)} onClick={guardLongPressNavigation} aria-label={`Open ${getTitle(item)}`} className={`absolute inset-0 z-10 ${FOCUS_RING}`} />
            <div className="pointer-events-none absolute inset-0 z-[11] bg-gradient-to-t from-black/70 via-transparent to-black/10" />
            <span className="pointer-events-none absolute left-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-black/60 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-xl">
              <Icon className="h-3 w-3 text-violet-300" />
              {department.label}
            </span>
            {isFavouriteTalent && (
              <span className="pointer-events-none absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-xl border border-rose-300/25 bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_6px_18px_rgba(244,63,94,.35),inset_0_1px_1px_rgba(255,255,255,.3)] backdrop-blur-xl" title="Favourite talent" aria-label="Favourite talent">
                <Heart className="h-3.5 w-3.5 fill-current stroke-[2.5]" />
              </span>
            )}
            <button type="button" onClick={(event) => { event.stopPropagation(); setActionItem(item); }} className={`absolute bottom-2 left-2 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white/85 backdrop-blur-xl active:scale-95 lg:hidden ${FOCUS_RING}`} aria-label={`Actions for ${getTitle(item)}`}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); void toggleTalentFavorite(item); }} className={`absolute bottom-2 left-2 z-30 hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/65 opacity-0 backdrop-blur-xl transition group-hover:opacity-100 group-focus-within:opacity-100 lg:flex ${isFavouriteTalent ? 'text-rose-400' : 'text-white/80 hover:text-rose-300'} ${FOCUS_RING}`} aria-label={isFavouriteTalent ? `Unfavorite ${getTitle(item)}` : `Favorite ${getTitle(item)}`} title={isFavouriteTalent ? 'Unfavorite talent' : 'Favorite talent'}>
              <Heart className={`h-4 w-4 ${isFavouriteTalent ? 'fill-current' : ''}`} />
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/60 text-white/80 backdrop-blur-xl transition group-hover:bg-white group-hover:text-black">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="px-1 pb-1 pt-3">
            <Link to={getRoute(item)} onClick={guardLongPressNavigation} className={`block rounded-sm ${FOCUS_RING}`}>
              <h2 className="line-clamp-1 text-sm font-black tracking-tight text-white">{getTitle(item)}</h2>
            </Link>
            <p className="mt-1 text-[10px] font-semibold text-zinc-600">Explore profile & credits</p>
          </div>
        </div>
      </motion.article>
    );
  };

  const renderAllSection = (title: string, tab: Exclude<TabType, 'all'>, items: SearchResult[]) => {
    if (!items.length) return null;
    const config = TAB_CONFIG.find((entry) => entry.key === tab)!;
    const Icon = config.icon;
    const iconColor = tab === 'movies' ? 'text-red-400' : tab === 'tv' ? 'text-cyan-400' : 'text-violet-400';
    return (
      <section className="mt-7 first:mt-0 sm:mt-9">
        <div className="mb-3 flex items-center justify-between px-1 sm:mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035]"><Icon className={`h-4 w-4 ${iconColor}`} /></span>
            <div><h3 className="text-sm font-black text-white sm:text-base">{title}</h3><p className="text-[9px] font-semibold text-zinc-600">{items.length} loaded matches</p></div>
          </div>
          <button type="button" onClick={() => setActiveTab(tab)} className={`flex min-h-11 items-center gap-1 rounded-xl px-3 text-[10px] font-black text-zinc-500 transition hover:bg-white/[0.04] hover:text-white ${FOCUS_RING}`}>See all <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
        <motion.div variants={CONTAINER_VARIANTS} initial="hidden" animate="visible" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {items.slice(0, 5).map((item) => tab === 'talents' ? renderTalentCard(item) : renderGridCard(item))}
        </motion.div>
      </section>
    );
  };

  const suggestionGroups = useMemo(() => ({
    movies: suggestions.filter((item) => item.media_type === 'movie').slice(0, 2),
    tv: suggestions.filter((item) => item.media_type === 'tv').slice(0, 2),
    talents: suggestions.filter((item) => item.media_type === 'person').slice(0, 2),
  }), [suggestions]);

  const activeTabConfig = TAB_CONFIG.find((entry) => entry.key === activeTab) || TAB_CONFIG[0];
  const ActiveTabIcon = activeTabConfig.icon;
  const availableStatusFilters = useMemo(
    () => activeTab === 'talents'
      ? STATUS_FILTERS.filter((filter) => filter.key === 'all' || filter.key === 'favorites')
      : STATUS_FILTERS,
    [activeTab],
  );
  const effectiveStatusFilters = useMemo(
    () => activeTab === 'talents' ? statusFilters.filter((filter) => filter === 'favorites') : statusFilters,
    [activeTab, statusFilters],
  );
  const activeFilterCount = effectiveStatusFilters.length;
  const activeFilterLabel = useMemo(() => {
    if (!activeFilterCount) return '';
    const labels = effectiveStatusFilters
      .map((key) => STATUS_FILTERS.find((entry) => entry.key === key)?.label)
      .filter(Boolean) as string[];
    return labels.length <= 2 ? labels.join(' + ') : `${labels.length} filters`;
  }, [activeFilterCount, effectiveStatusFilters]);

  const toggleStatusFilter = useCallback((key: StatusFilter) => {
    if (key === 'all') {
      setStatusFilters((current) => activeTab === 'talents' ? current.filter((filter) => filter !== 'favorites') : []);
      haptic(6);
      return;
    }
    setStatusFilters((current) => current.includes(key) ? current.filter((filter) => filter !== key) : [...current, key]);
    haptic(6);
  }, [activeTab, haptic]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050506] pb-20 text-zinc-100 selection:bg-red-500/40 selection:text-white" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-[-170px] h-[430px] w-[88vw] max-w-5xl -translate-x-1/2 rounded-full bg-white/[0.035] blur-[120px]" />
        <div className="absolute right-[-120px] top-[30%] h-80 w-80 rounded-full bg-red-500/[0.035] blur-[120px]" />
      </div>

      <AnimatePresence>
        {stickyMobile && (query || genreParam) && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed left-2 right-2 top-[max(8px,env(safe-area-inset-top))] z-[1000] sm:hidden">
            <div className="flex min-h-12 items-center gap-1.5 rounded-[18px] border border-white/[0.11] bg-zinc-950/78 p-1.5 shadow-[0_14px_45px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,255,255,.1)] backdrop-blur-[28px] saturate-150">
              <button type="button" onClick={() => { headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); window.setTimeout(() => searchInputRef.current?.focus(), 300); }} className={`flex min-w-0 flex-1 items-center gap-2 rounded-[13px] px-2.5 py-2 text-left ${FOCUS_RING}`} aria-label="Focus search">
                <Search className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span className="truncate text-[10px] font-bold text-zinc-300">{searchContext || 'Search'}</span>
              </button>
              <span className="flex h-9 shrink-0 items-center gap-1 rounded-[12px] border border-white/[0.07] bg-white/[0.035] px-2 text-[9px] font-black text-zinc-300">
                <ActiveTabIcon className={`h-3.5 w-3.5 ${activeTab === 'movies' ? 'text-red-400' : activeTab === 'tv' ? 'text-cyan-400' : activeTab === 'talents' ? 'text-violet-400' : 'text-amber-300'}`} />
                {activeTabConfig.shortLabel}
              </span>
              <button type="button" onClick={() => setShowFilterSheet(true)} className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border ${activeFilterCount > 0 ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-white/[0.07] bg-white/[0.035] text-zinc-400'} ${FOCUS_RING}`} aria-label="Search filters">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {activeFilterCount > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-300" />}
              </button>
              {activeTab === 'movies' || activeTab === 'tv' ? (
                <button type="button" onClick={() => setViewMode((current) => current === 'grid' ? 'list' : 'grid')} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.07] bg-white/[0.035] ${viewMode === 'grid' ? 'text-amber-300' : 'text-cyan-300'} ${FOCUS_RING}`} aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}>
                  {viewMode === 'grid' ? <Grid3X3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                </button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto max-w-7xl px-3 pb-[max(24px,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-8 lg:px-7">
        <section ref={headerRef} className="relative overflow-visible rounded-[26px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(19,19,21,.92),rgba(7,7,8,.97))] p-3.5 shadow-[0_24px_75px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.055)] backdrop-blur-3xl sm:rounded-[32px] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-red-400/20 bg-gradient-to-br from-red-500 to-red-700 text-white shadow-[0_8px_24px_rgba(239,68,68,.22),inset_0_1px_1px_rgba(255,255,255,.3)] sm:h-11 sm:w-11">
                <Search className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.22em] text-zinc-600">Discover Cinescape</p>
                <h1 className="mt-0.5 truncate text-lg font-black tracking-[-.025em] text-white sm:text-xl">Search</h1>
              </div>
            </div>
            {(query || genreParam) && <span className="hidden rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold text-zinc-500 sm:inline">{results.length} loaded</span>}
          </div>

          <form onSubmit={handleSearchSubmit} className="relative mt-4">
            <div className="relative flex min-h-12 items-center overflow-hidden rounded-[18px] border bg-black/35 shadow-[inset_0_1px_1px_rgba(255,255,255,.035)] transition sm:min-h-[52px] sm:rounded-[20px]" style={{ borderColor: searchFocused ? 'rgba(239,68,68,.42)' : 'rgba(255,255,255,.085)', boxShadow: searchFocused ? '0 0 0 3px rgba(239,68,68,.07), inset 0 1px 1px rgba(255,255,255,.04)' : undefined }}>
              <Search className={`ml-3.5 h-4 w-4 shrink-0 transition ${searchFocused ? 'text-red-400' : 'text-zinc-600'}`} />
              <input
                ref={searchInputRef}
                value={inputVal}
                onChange={(event) => setInputVal(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 130)}
                placeholder="Movies, series or talent"
                aria-label="Search movies, series or talent"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[13px] font-semibold text-white outline-none placeholder:text-zinc-700 sm:text-sm"
              />
              {inputVal && (
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setInputVal(''); setSuggestions([]); }} className={`mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-white/[0.05] hover:text-white ${FOCUS_RING}`} aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
              <span className="mr-1 hidden rounded-lg border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[9px] font-black text-zinc-600 md:inline">/</span>
              <button type="submit" className={`mr-1.5 flex min-h-10 shrink-0 items-center gap-1.5 rounded-[13px] bg-gradient-to-b from-red-500 to-red-700 px-3.5 text-[10px] font-black text-white shadow-[0_5px_18px_rgba(220,38,38,.24),inset_0_1px_1px_rgba(255,255,255,.28)] transition hover:brightness-110 active:scale-[.98] sm:px-4 sm:text-[11px] ${FOCUS_RING}`}>
                Search <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <AnimatePresence>
              {searchFocused && !inputVal.trim() && recentSearches.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 7, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5 }} className="absolute inset-x-0 top-[calc(100%+.5rem)] z-[80] overflow-hidden rounded-[20px] border border-white/[0.1] bg-zinc-950/94 p-3 shadow-[0_22px_65px_rgba(0,0,0,.6)] backdrop-blur-3xl">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-600">Recent searches</p>
                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearRecentSearches} className={`min-h-10 px-2 text-[9px] font-bold text-zinc-600 hover:text-white ${FOCUS_RING}`}>Clear</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentSearches.map((entry) => <button key={entry} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => performSearch(entry)} className={`min-h-10 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 text-[10px] font-bold text-zinc-300 transition hover:border-red-400/20 hover:bg-red-500/[0.06] hover:text-white ${FOCUS_RING}`}>{entry}</button>)}
                  </div>
                </motion.div>
              )}

              {searchFocused && inputVal.trim().length >= 2 && inputVal.trim().toLowerCase() !== query.trim().toLowerCase() && (
                <motion.div initial={{ opacity: 0, y: 7, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5 }} className="absolute inset-x-0 top-[calc(100%+.5rem)] z-[80] max-h-[68dvh] overflow-y-auto rounded-[20px] border border-white/[0.1] bg-zinc-950/95 p-2 shadow-[0_22px_65px_rgba(0,0,0,.65)] backdrop-blur-3xl">
                  <div className="flex items-center justify-between px-2 py-2">
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-600">Quick suggestions</p>
                    <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-600">
                      <span>{suggestionGroups.movies.length} Movies</span><span>·</span><span>{suggestionGroups.tv.length} TV</span><span>·</span><span>{suggestionGroups.talents.length} Talent</span>
                    </div>
                  </div>
                  {suggestionsLoading ? (
                    <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-red-400" /></div>
                  ) : suggestions.length ? (
                    <div className="space-y-1">
                      {[...suggestionGroups.movies, ...suggestionGroups.tv, ...suggestionGroups.talents].map((item) => {
                        const typeIcon = item.media_type === 'movie' ? Clapperboard : item.media_type === 'tv' ? Tv : User;
                        const TypeIcon = typeIcon;
                        return (
                          <button key={`${item.media_type}-${item.id}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => performSearch(getTitle(item))} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition hover:bg-white/[0.05] ${FOCUS_RING}`}>
                            <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded-lg border border-white/[0.07] bg-zinc-900"><ResultImage item={item} /></div>
                            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-zinc-200">{getTitle(item)}</p><p className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-600"><TypeIcon className={`h-3 w-3 ${item.media_type === 'movie' ? 'text-red-400' : item.media_type === 'tv' ? 'text-cyan-400' : 'text-violet-400'}`} />{item.media_type === 'person' ? getDepartment(item).label : getYear(item) || (item.media_type === 'tv' ? 'TV Series' : 'Movie')}</p></div>
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-8 text-center text-[10px] text-zinc-600">No instant suggestions yet. Press Search to try the full catalog.</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-3 space-y-2 sm:mt-4 sm:flex sm:items-center sm:gap-2 sm:space-y-0">
            <div className="grid w-full min-w-0 grid-cols-4 rounded-[16px] border border-white/[0.07] bg-black/30 p-1 backdrop-blur-2xl sm:flex-1 sm:max-w-2xl">
              {TAB_CONFIG.map((tab) => {
                const active = activeTab === tab.key;
                const Icon = tab.icon;
                const activeColor = tab.key === 'all' ? 'text-amber-300' : tab.key === 'movies' ? 'text-red-400' : tab.key === 'tv' ? 'text-cyan-400' : 'text-violet-400';
                return (
                  <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`relative flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-[12px] px-1.5 text-[10px] font-black transition sm:min-h-10 sm:gap-1.5 sm:px-2 sm:text-[11px] ${FOCUS_RING}`} aria-pressed={active}>
                    {active && <motion.span layoutId="search-tab-pill" className="absolute inset-0 rounded-[12px] border border-white/[0.11] bg-gradient-to-b from-white/[0.095] to-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_4px_16px_rgba(0,0,0,.18)]" transition={{ type: 'spring', stiffness: 340, damping: 28 }} />}
                    <Icon className={`relative z-10 hidden h-3.5 w-3.5 shrink-0 sm:block ${active ? activeColor : 'text-zinc-600'}`} />
                    <span className={`relative z-10 min-w-0 truncate ${active ? 'text-white' : 'text-zinc-500'}`}><span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.shortLabel}</span></span>
                    <span className={`relative z-10 shrink-0 rounded-md px-1.5 py-0.5 text-[8px] leading-none ${active ? 'bg-white/[0.08] text-zinc-300' : 'bg-black/25 text-zinc-700'}`}>{tabCounts[tab.key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button type="button" onClick={() => setShowFilterSheet(true)} className={`relative flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[14px] border px-3 transition sm:h-10 sm:w-auto sm:flex-none sm:gap-1.5 ${activeFilterCount > 0 ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-white/[0.07] bg-black/30 text-zinc-500 hover:text-white'} ${FOCUS_RING}`} aria-label="Filter search results" title="Filter">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold">Filter</span>
                {activeFilterCount > 0 && <span className="rounded-md bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-black text-amber-200">{activeFilterCount}</span>}
              </button>

              {(activeTab === 'movies' || activeTab === 'tv') && (
                <div className="flex flex-1 rounded-[14px] border border-white/[0.07] bg-black/30 p-1 sm:flex-none">
                  <button type="button" onClick={() => setViewMode('grid')} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[10px] font-bold transition sm:w-9 sm:flex-none sm:px-0 ${viewMode === 'grid' ? 'bg-white/[0.09] text-amber-300 shadow-inner' : 'text-zinc-600 hover:text-zinc-300'} ${FOCUS_RING}`} aria-label="Grid view"><Grid3X3 className="h-3.5 w-3.5" /><span className="sm:hidden">Grid</span></button>
                  <button type="button" onClick={() => setViewMode('list')} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[10px] font-bold transition sm:w-9 sm:flex-none sm:px-0 ${viewMode === 'list' ? 'bg-white/[0.09] text-cyan-300 shadow-inner' : 'text-zinc-600 hover:text-zinc-300'} ${FOCUS_RING}`} aria-label="List view"><List className="h-3.5 w-3.5" /><span className="sm:hidden">List</span></button>
                </div>
              )}
            </div>
          </div>
        </section>

        {(query || genreParam) && !loading && !error && (
          <div className="mb-3 mt-6 flex items-end justify-between gap-3 px-1 sm:mb-4 sm:mt-8">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-zinc-700">Results</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">{activeTab === 'all' ? 'All matches' : activeTab === 'movies' ? 'Movies' : activeTab === 'tv' ? 'TV Shows' : 'Talent'} <span className="ml-1 text-zinc-700">{tabCounts[activeTab]}</span></h2>
            </div>
            <div className="text-right">
              <p className="max-w-[48vw] truncate text-[10px] font-semibold text-zinc-600 sm:max-w-none">for “{searchContext}”</p>
              {activeFilterCount > 0 && <p className="mt-1 text-[8px] font-black uppercase tracking-[.14em] text-amber-400/70">{activeFilterLabel}</p>}
            </div>
          </div>
        )}

        <section>
          {loading && <div className="mt-6 sm:mt-8"><SkeletonResults viewMode={viewMode} activeTab={activeTab} /></div>}

          {!loading && error && (
            <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-white/[0.07] bg-white/[0.02] px-5 text-center backdrop-blur-2xl sm:mt-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/15 bg-red-500/[0.08] text-red-400"><AlertCircle className="h-5 w-5" /></div>
              <h3 className="mt-4 text-sm font-black text-white">Search unavailable</h3>
              <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-zinc-600">{error}</p>
              <button type="button" onClick={() => void fetchPage(1, false)} className={`mt-5 flex min-h-11 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.045] px-4 py-2.5 text-[11px] font-bold text-zinc-300 transition hover:bg-white/[0.07] hover:text-white ${FOCUS_RING}`}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          {!loading && !error && (query || genreParam) && activeTab === 'all' && tabCounts.all > 0 && (
            <div className="mt-1">
              {renderAllSection('Movies', 'movies', movies)}
              {renderAllSection('TV Shows', 'tv', tvShows)}
              {renderAllSection('Talent', 'talents', talents)}
            </div>
          )}

          {!loading && !error && (query || genreParam) && activeTab !== 'all' && filteredResults.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div key={`${activeTab}-${viewMode}-${statusFilters.join('-')}`} variants={CONTAINER_VARIANTS} initial="hidden" animate="visible" className={activeTab === 'talents' || viewMode === 'grid' ? 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5' : 'space-y-2.5 sm:space-y-3'}>
                {filteredResults.map((item) => activeTab === 'talents' ? renderTalentCard(item) : viewMode === 'grid' ? renderGridCard(item) : renderListCard(item))}
              </motion.div>
            </AnimatePresence>
          )}

          {!loading && !error && (query || genreParam) && tabCounts[activeTab] === 0 && (
            <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/[0.075] bg-white/[0.015] px-5 text-center sm:mt-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.035] text-zinc-600"><Search className="h-[18px] w-[18px]" /></div>
              <h3 className="mt-4 text-sm font-black text-zinc-300">No matching results here</h3>
              <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-zinc-600">Try another category, remove a library filter, or broaden the query.</p>
              <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
                {activeTab !== 'all' && results.length > 0 && <button type="button" onClick={() => setActiveTab('all')} className={`min-h-11 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-[10px] font-black text-zinc-300 hover:text-white ${FOCUS_RING}`}>Search all categories</button>}
                {activeFilterCount > 0 && <button type="button" onClick={() => setStatusFilters([])} className={`min-h-11 rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] px-4 text-[10px] font-black text-amber-300 ${FOCUS_RING}`}>Clear filters</button>}
                {suggestedCorrection && <button type="button" onClick={() => performSearch(suggestedCorrection)} className={`min-h-11 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] px-4 text-[10px] font-black text-cyan-300 ${FOCUS_RING}`}>Try “{suggestedCorrection}”</button>}
                {query.split(/\s+/).filter(Boolean).length > 1 && <button type="button" onClick={() => performSearch(query.split(/\s+/)[0])} className={`min-h-11 rounded-2xl border border-violet-400/15 bg-violet-400/[0.06] px-4 text-[10px] font-black text-violet-300 ${FOCUS_RING}`}>Browse similar titles</button>}
              </div>
            </div>
          )}

          {!query && !genreParam && !loading && (
            <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
              {recentSearches.length > 0 && (
                <section className="rounded-[26px] border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-2xl sm:p-5">
                  <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-700">Pick up where you left off</p><h3 className="mt-1 text-sm font-black text-white">Recent searches</h3></div><button type="button" onClick={clearRecentSearches} className={`min-h-11 px-2 text-[9px] font-bold text-zinc-600 hover:text-white ${FOCUS_RING}`}>Clear</button></div>
                  <div className="mt-3 flex flex-wrap gap-2">{recentSearches.map((entry) => <button key={entry} type="button" onClick={() => performSearch(entry)} className={`min-h-11 rounded-full border border-white/[0.07] bg-white/[0.035] px-3.5 text-[10px] font-bold text-zinc-300 transition hover:border-red-400/20 hover:bg-red-500/[0.06] hover:text-white ${FOCUS_RING}`}>{entry}</button>)}</div>
                </section>
              )}

              <section className="rounded-[26px] border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-2xl sm:p-5">
                <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-700">Popular right now</p><h3 className="mt-1 text-sm font-black text-white">Trending searches</h3></div>
                {trendingLoading ? <div className="mt-4 flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-red-400" /></div> : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trendingItems.slice(0, 8).map((item) => {
                      const Icon = item.media_type === 'movie' ? Clapperboard : item.media_type === 'tv' ? Tv : User;
                      return <button key={`${item.media_type}-${item.id}`} type="button" onClick={() => performSearch(getTitle(item))} className={`flex min-h-11 items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.035] px-3 text-[10px] font-bold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white ${FOCUS_RING}`}><Icon className={`h-3 w-3 ${item.media_type === 'movie' ? 'text-red-400' : item.media_type === 'tv' ? 'text-cyan-400' : 'text-violet-400'}`} />{getTitle(item)}</button>;
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-[26px] border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-2xl sm:p-5">
                <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-700">Explore</p><h3 className="mt-1 text-sm font-black text-white">Browse by genre</h3></div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EXPLORE_GENRES.map((genre, index) => <button key={genre.id} type="button" onClick={() => { setActiveTab('all'); setSearchParams({ genre: String(genre.id), genreLabel: genre.label }); }} className={`min-h-12 rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] px-3 text-left text-[11px] font-black text-zinc-300 transition hover:-translate-y-0.5 hover:border-white/[0.12] hover:text-white ${FOCUS_RING}`}><span className={`${index % 4 === 0 ? 'text-red-400' : index % 4 === 1 ? 'text-cyan-400' : index % 4 === 2 ? 'text-violet-400' : 'text-amber-300'}`}>•</span> {genre.label}</button>)}
                </div>
              </section>
            </div>
          )}

          {(query || genreParam) && page < totalPages && <div ref={loadMoreRef} className="flex min-h-28 items-center justify-center">{loadingMore && <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[9px] font-black uppercase tracking-[.15em] text-zinc-600"><Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />Loading more</div>}</div>}
        </section>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: .98 }} className="fixed inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-[10080] mx-auto flex max-w-sm items-center gap-3 rounded-[18px] border border-white/[0.1] bg-zinc-950/88 px-3.5 py-3 shadow-[0_16px_55px_rgba(0,0,0,.65),inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-3xl sm:bottom-6">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${toast.tone === 'success' ? 'bg-emerald-500/10 text-emerald-400' : toast.tone === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-300'}`}>
              {toast.tone === 'error' ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </span>
            <p className="min-w-0 flex-1 text-[11px] font-bold text-zinc-200">{toast.message}</p>
            <button type="button" onClick={() => setToast(null)} className={`flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-white/[0.05] hover:text-white ${FOCUS_RING}`} aria-label="Dismiss notification"><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {undo && (
          <motion.div initial={{ opacity: 0, y: 22, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} transition={{ type: 'spring', stiffness: 430, damping: 35 }} className="fixed bottom-[calc(.65rem+env(safe-area-inset-bottom))] left-2.5 right-2.5 z-[10090] sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-[min(430px,calc(100vw-2rem))] sm:-translate-x-1/2">
            <div className="relative overflow-hidden rounded-[20px] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(38,31,18,.94),rgba(18,16,13,.96))] px-2.5 py-2 shadow-[0_20px_60px_rgba(0,0,0,.60),0_8px_28px_rgba(245,158,11,.10),inset_0_1px_0_rgba(255,255,255,.11)] backdrop-blur-[28px] saturate-150 sm:rounded-[22px] sm:px-3 sm:py-2.5">
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/55 to-transparent" />
              <div className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-amber-400/[0.10] blur-3xl" />
              <div className="relative flex min-w-0 items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border border-amber-300/20 bg-gradient-to-br from-amber-300/20 to-orange-500/10 text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,.10),0_5px_16px_rgba(245,158,11,.12)] sm:h-10 sm:w-10 sm:rounded-[14px]"><RotateCcw className="h-3.5 w-3.5 stroke-[2.4] sm:h-4 sm:w-4" /></div>
                <div className="min-w-0 flex-1"><p className="text-[7px] font-black uppercase tracking-[.16em] text-amber-300/65 sm:text-[8px]">Recent change</p><p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-100 sm:text-[11px]">{undo.message}</p></div>
                <button type="button" onClick={() => void undo.action()} className={`shrink-0 rounded-[12px] border border-amber-300/25 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 px-2.5 py-1.5 text-[10px] font-black text-black shadow-[0_5px_15px_rgba(245,158,11,.20),inset_0_1px_1px_rgba(255,255,255,.48)] transition hover:brightness-105 active:scale-95 sm:px-3 sm:py-2 sm:text-[11px] ${FOCUS_RING}`}>Undo</button>
              </div>
              <div className="absolute inset-x-2.5 bottom-0 h-[2px] overflow-hidden rounded-full bg-amber-100/[0.07]"><motion.div key={undo.message} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 5, ease: 'linear' }} className="h-full origin-left bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500" /></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showFilterSheet && createPortal(
        <div className="fixed inset-0 z-[10035] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close filters" onClick={() => setShowFilterSheet(false)} className="absolute inset-0 bg-black/70 backdrop-blur-lg" />
          <motion.div initial={{ y: 55, opacity: 0, scale: .99 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[30px] border border-white/[0.09] bg-zinc-950/96 p-4 pb-[max(18px,env(safe-area-inset-bottom))] shadow-[0_28px_90px_rgba(0,0,0,.75)] backdrop-blur-3xl sm:rounded-[30px] sm:p-5">
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-amber-400/70">Search filters</p><h3 className="mt-1 text-base font-black text-white">{activeTab === 'talents' ? 'Talent status' : 'Library status'}</h3></div><button type="button" onClick={() => setShowFilterSheet(false)} className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-500 ${FOCUS_RING}`} aria-label="Close filters"><X className="h-4 w-4" /></button></div>
            <div className="mt-4">
              <div className="mb-3 rounded-2xl border border-white/[0.055] bg-white/[0.025] px-3 py-2.5">
                <p className="text-[9px] font-semibold leading-relaxed text-zinc-500">{activeTab === 'talents' ? 'Talent supports Favorite filtering.' : 'Select multiple statuses to combine them. Tap an active filter again to remove it.'}</p>
              </div>
              <div className="space-y-1.5">
                {availableStatusFilters.map((filter) => {
                  const Icon = filter.icon;
                  const active = filter.key === 'all' ? activeFilterCount === 0 : effectiveStatusFilters.includes(filter.key);
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => toggleStatusFilter(filter.key)}
                      aria-pressed={active}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition ${active ? 'border-white/[0.12] bg-white/[0.065]' : 'border-white/[0.055] bg-white/[0.025] hover:bg-white/[0.045]'} ${FOCUS_RING}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/25 ${active ? filter.activeClass : 'text-zinc-600'}`}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className={`block text-xs font-black ${active ? 'text-white' : 'text-zinc-300'}`}>{filter.label}</span><span className="mt-0.5 block text-[9px] text-zinc-600">{filter.hint}</span></span>
                      {active && <Check className="h-4 w-4 text-amber-300" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={!activeFilterCount} onClick={() => toggleStatusFilter('all')} className={`min-h-11 flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 text-[10px] font-black text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35 ${FOCUS_RING}`}>Clear</button>
                <button type="button" onClick={() => setShowFilterSheet(false)} className={`min-h-11 flex-1 rounded-2xl border border-amber-300/20 bg-gradient-to-b from-amber-300 to-amber-500 px-4 text-[10px] font-black text-black shadow-[0_6px_18px_rgba(245,158,11,.18)] active:scale-[.99] ${FOCUS_RING}`}>Done{activeFilterCount ? ` · ${activeFilterCount}` : ''}</button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {actionItem && createPortal(
        <div className="fixed inset-0 z-[10040] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close actions" onClick={() => setActionItem(null)} className="absolute inset-0 bg-black/72 backdrop-blur-lg" />
          <motion.div initial={{ y: 55, opacity: 0, scale: .985 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 390, damping: 34 }} className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[30px] border border-white/[0.09] bg-zinc-950/95 p-4 pb-[max(18px,env(safe-area-inset-bottom))] shadow-[0_28px_90px_rgba(0,0,0,.75)] backdrop-blur-3xl sm:rounded-[30px] sm:p-5">
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center gap-3">
              <div className={`relative h-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 ${actionItem.media_type === 'person' ? 'w-16' : 'w-14'}`}><ResultImage item={actionItem} /></div>
              <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.17em] text-zinc-600">Quick actions</p><h3 className="mt-1 truncate text-base font-black text-white">{getTitle(actionItem)}</h3><p className="mt-1 text-[10px] font-semibold text-zinc-600">{actionItem.media_type === 'person' ? getDepartment(actionItem).label : actionItem.media_type === 'tv' ? 'TV Series' : 'Movie'}{actionItem.media_type !== 'person' ? ` · ${getYear(actionItem) || 'TBA'}` : ''}</p></div>
              <button type="button" onClick={() => setActionItem(null)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-500 transition hover:text-white ${FOCUS_RING}`} aria-label="Close quick actions"><X className="h-4 w-4" /></button>
            </div>

            {actionItem.media_type === 'person' ? (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void toggleTalentFavorite(actionItem)} className={`flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-[10px] font-bold transition active:scale-[.98] ${favoriteTalentIds.has(String(actionItem.id)) ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-white/[0.08] bg-white/[0.035] text-zinc-300'} ${FOCUS_RING}`}><Heart className={`h-4 w-4 ${favoriteTalentIds.has(String(actionItem.id)) ? 'fill-current' : ''}`} /><span>{favoriteTalentIds.has(String(actionItem.id)) ? 'Unfavorite' : 'Favorite talent'}</span></button>
                <button type="button" onClick={() => { navigate(getRoute(actionItem)); setActionItem(null); }} className={`flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-2 text-[10px] font-bold text-zinc-300 transition active:scale-[.98] ${FOCUS_RING}`}><ArrowUpRight className="h-4 w-4" /><span>Open profile</span></button>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {(() => {
                    const key = mediaKey(actionItem);
                    const inWatchlist = watchlistKeys.has(key);
                    const watched = historyKeys.has(key);
                    const favorite = favoriteKeys.has(key);
                    const inMyList = myListKeys.has(key);
                    const actionBusy = busyAction?.endsWith(key);
                    return <>
                      <button disabled={actionBusy} type="button" onClick={() => void openQuickPeek(actionItem)} className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.055] px-2 text-[10px] font-bold text-cyan-300 transition active:scale-[.98] ${FOCUS_RING}`}><Info className="h-4 w-4" /><span>Quick Peek</span></button>
                      <button disabled={actionBusy} type="button" onClick={() => void toggleWatchlist(actionItem)} className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-[10px] font-bold transition active:scale-[.98] ${inWatchlist ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-white/[0.08] bg-white/[0.035] text-zinc-300'} ${FOCUS_RING}`}>{actionBusy && busyAction?.startsWith('watchlist') ? <Loader2 className="h-4 w-4 animate-spin" /> : inWatchlist ? <BookmarkMinus className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}<span>{inWatchlist ? 'Watchlisted' : 'Watchlist'}</span></button>
                      <button disabled={actionBusy} type="button" onClick={() => void toggleHistory(actionItem)} className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-[10px] font-bold transition active:scale-[.98] ${watched ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.08] bg-white/[0.035] text-zinc-300'} ${FOCUS_RING}`}><Check className="h-4 w-4" /><span>{watched ? 'Watched' : 'Mark watched'}</span></button>
                      <button disabled={actionBusy} type="button" onClick={() => openMyListPicker(actionItem)} className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-[10px] font-bold transition active:scale-[.98] ${inMyList ? 'border-violet-500/20 bg-violet-500/10 text-violet-300' : 'border-white/[0.08] bg-white/[0.035] text-zinc-300'} ${FOCUS_RING}`}><ListChecks className="h-4 w-4" /><span>Manage List</span></button>
                      <button disabled={actionBusy} type="button" onClick={() => void toggleFavorite(actionItem)} className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-[10px] font-bold transition active:scale-[.98] ${favorite ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-white/[0.08] bg-white/[0.035] text-zinc-300'} ${FOCUS_RING}`}><Heart className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} /><span>Favorite</span></button>
                      <button type="button" onClick={() => { navigate(getRoute(actionItem)); setActionItem(null); }} className={`flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-2 text-[10px] font-bold text-zinc-300 transition active:scale-[.98] ${FOCUS_RING}`}><ArrowUpRight className="h-4 w-4" /><span>Details</span></button>
                    </>;
                  })()}
                </div>
              </>
            )}
          </motion.div>
        </div>,
        document.body,
      )}

      {quickPeekItem && createPortal(
        <div className="fixed inset-0 z-[10055] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close Quick Peek" onClick={() => setQuickPeekItem(null)} className="absolute inset-0 bg-black/78 backdrop-blur-xl" />
          <motion.div initial={{ y: 60, opacity: 0, scale: .985 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] border border-white/[0.1] bg-zinc-950/96 shadow-[0_28px_90px_rgba(0,0,0,.8)] backdrop-blur-3xl sm:rounded-[30px]">
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-white/15 sm:hidden" />
            <div className="relative h-44 overflow-hidden sm:h-56">
              {backdropUrl(quickPeekDetails?.backdropPath || quickPeekItem.backdrop_path) ? <img src={backdropUrl(quickPeekDetails?.backdropPath || quickPeekItem.backdrop_path)!} alt="" className="h-full w-full object-cover opacity-55" /> : <div className="h-full w-full bg-gradient-to-br from-zinc-900 to-black" />}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/45 to-black/15" />
              <button type="button" onClick={() => setQuickPeekItem(null)} className={`absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/55 text-zinc-300 backdrop-blur-xl ${FOCUS_RING}`} aria-label="Close Quick Peek"><X className="h-4 w-4" /></button>
              <div className="absolute inset-x-4 bottom-4 flex items-end gap-3 sm:inset-x-5">
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl"><ResultImage item={quickPeekItem} /></div>
                <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-300/70">Quick Peek</p><h2 className="mt-1 line-clamp-2 text-xl font-black tracking-tight text-white sm:text-2xl">{getTitle(quickPeekItem)}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-zinc-400"><span>{quickPeekDetails?.year || getYear(quickPeekItem) || 'TBA'}</span><TmdbRatingBadge rating={quickPeekDetails?.rating || quickPeekItem.vote_average} />{userRatings.get(mediaKey(quickPeekItem)) !== undefined && <UserRatingBadge rating={userRatings.get(mediaKey(quickPeekItem))} />}</div></div>
              </div>
            </div>

            <div className="p-4 pb-[max(18px,env(safe-area-inset-bottom))] sm:p-5">
              {quickPeekLoading ? <div className="flex h-36 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div> : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <div className="flex items-center gap-2"><MiniStatusCluster favorite={favoriteKeys.has(mediaKey(quickPeekItem))} watched={historyKeys.has(mediaKey(quickPeekItem))} inMyList={myListKeys.has(mediaKey(quickPeekItem))} inWatchlist={watchlistKeys.has(mediaKey(quickPeekItem))} /><span className="text-[9px] font-black uppercase tracking-[.13em] text-zinc-600">Your library</span></div>
                    <ProviderStrip providers={quickPeekDetails?.providers || providers.get(mediaKey(quickPeekItem)) || []} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">{(quickPeekDetails?.genres || getGenres(quickPeekItem, 5)).map((genre) => <span key={genre} className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold text-zinc-400">{genre}</span>)}</div>
                  <p className="mt-4 text-[12px] leading-6 text-zinc-400 sm:text-[13px]">{quickPeekDetails?.overview || quickPeekItem.overview || 'No overview available yet.'}</p>

                  {showQuickPeekTrailer && quickPeekDetails?.trailerKey && (
                    <div className="mt-4 aspect-video overflow-hidden rounded-2xl border border-white/[0.08] bg-black"><iframe src={`https://www.youtube.com/embed/${quickPeekDetails.trailerKey}?autoplay=1&modestbranding=1&rel=0&playsinline=1`} title={`${getTitle(quickPeekItem)} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full" /></div>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {quickPeekDetails?.trailerKey && <button type="button" onClick={() => setShowQuickPeekTrailer((current) => !current)} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] px-3 text-[10px] font-black text-cyan-300 ${FOCUS_RING}`}><Play className="h-4 w-4 fill-current" />{showQuickPeekTrailer ? 'Hide trailer' : 'Trailer'}</button>}
                    <button type="button" onClick={() => void toggleFavorite(quickPeekItem)} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-[10px] font-black ${favoriteKeys.has(mediaKey(quickPeekItem)) ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-white/[0.08] bg-white/[0.035] text-zinc-300'} ${FOCUS_RING}`}><Heart className={`h-4 w-4 ${favoriteKeys.has(mediaKey(quickPeekItem)) ? 'fill-current' : ''}`} />Favorite</button>
                    <button type="button" onClick={() => openMyListPicker(quickPeekItem)} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-400/15 bg-violet-400/[0.055] px-3 text-[10px] font-black text-violet-300 ${FOCUS_RING}`}><ListChecks className="h-4 w-4" />Manage List</button>
                    <button type="button" onClick={() => { navigate(getRoute(quickPeekItem)); setQuickPeekItem(null); }} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 text-[10px] font-black text-white ${FOCUS_RING}`}><ArrowUpRight className="h-4 w-4" />Details</button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {showFolderPicker && folderPickerItem && createPortal(
        <div className="fixed inset-0 z-[10060] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" aria-label="Close My List picker" onClick={() => { setShowFolderPicker(false); setFolderPickerItem(null); }} className="absolute inset-0 bg-black/72 backdrop-blur-lg" />
          <motion.div initial={{ y: 55, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 flex max-h-[75dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] border border-white/[0.09] bg-zinc-950/96 shadow-[0_28px_90px_rgba(0,0,0,.75)] backdrop-blur-3xl sm:rounded-[30px]">
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center justify-between border-b border-white/[0.07] p-4 sm:p-5">
              <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-violet-400/80">My List</p><h3 className="mt-1 text-base font-black text-white">Manage List</h3><p className="mt-0.5 text-[10px] text-zinc-600">Add or remove this title from your collections.</p></div>
              <button type="button" onClick={() => { setShowFolderPicker(false); setFolderPickerItem(null); }} className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-500 ${FOCUS_RING}`} aria-label="Close Manage List"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {myListFolders.length ? (
                <div className="space-y-2">
                  {myListFolders.map((folder) => {
                    const key = mediaKey(folderPickerItem);
                    const inFolder = myListFolderKeys.get(folder.id)?.has(key) ?? false;
                    const updating = busyAction === `mylist:${key}:${folder.id}`;
                    return (
                      <button key={folder.id} type="button" disabled={folder.smartList || updating} onClick={() => void toggleItemInFolder(folderPickerItem, folder)} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[.99] disabled:cursor-not-allowed ${folder.smartList ? 'border-white/[0.05] bg-white/[0.02] opacity-50' : inFolder ? 'border-violet-400/20 bg-violet-500/10 hover:bg-violet-500/[0.14]' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.055]'} ${FOCUS_RING}`}>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${folder.smartList ? 'border-violet-400/10 bg-violet-500/[0.05] text-violet-500' : inFolder ? 'border-violet-400/25 bg-violet-500/15 text-violet-200' : 'border-white/[0.07] bg-zinc-900 text-zinc-500'}`}>{updating ? <Loader2 className="h-4 w-4 animate-spin" /> : folder.smartList ? <SlidersHorizontal className="h-4 w-4" /> : inFolder ? <Check className="h-4 w-4 stroke-[3]" /> : <ListChecks className="h-4 w-4" />}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-zinc-200">{folder.name}</span><span className="mt-0.5 block text-[9px] text-zinc-600">{folder.smartList ? 'Smart List · rule controlled' : inFolder ? 'In this list' : 'Not in this list'}</span></span>
                        {!folder.smartList && <span className={`text-[9px] font-black uppercase tracking-[.12em] ${inFolder ? 'text-violet-300' : 'text-zinc-600'}`}>{inFolder ? 'Remove' : 'Add'}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center"><ListChecks className="mx-auto h-6 w-6 text-zinc-700" /><p className="mt-3 text-xs font-black text-zinc-300">No collections yet</p><p className="mt-1 text-[10px] text-zinc-600">Create a list from My List first.</p></div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default SearchResults;