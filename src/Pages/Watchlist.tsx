import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc, } from 'firebase/firestore';
import { AlertCircle, ArrowDown, ArrowUpDown, Bookmark, BookmarkMinus, CalendarClock, Check, CheckSquare, ChevronDown, Clapperboard, Clock3, Filter, Flag, Flame, Grid3X3, Heart, ImageOff, List, ListChecks, MoreHorizontal, Play, Search, Sparkles, Star, Trash2, TrendingUp, Tv, X, } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Loading from '../components/Loading.tsx';
import axios from 'axios';
import Roulette from '../components/Roulette.tsx';
import { IoDiceOutline } from 'react-icons/io5';

type Priority = 'high' | 'medium' | 'low';
type AddedReason = 'Trailer' | 'Friend' | 'Actor' | 'Director' | 'Trending' | 'Recommendation';
type SortMode = 'added-desc' | 'added-asc' | 'priority' | 'release-desc' | 'release-asc' | 'rating-desc' | 'az';
type StatusFilter = 'all' | 'unwatched' | 'watched' | 'rated' | 'mylist';
type ReleaseFilter = 'all' | 'upcoming' | '2020s' | '2010s' | '2000s' | 'older';
type RatingFilter = 'all' | '8+' | '7+' | '6+';
type PriorityFilter = 'all' | Priority;
type ViewMode = 'grid' | 'list';

interface ProviderInfo {
  id: number;
  name: string;
  logoPath: string;
}

interface MediaItem {
  id: string;
  movieId: number;
  title?: string;
  name?: string;
  posterPath: string;
  releaseDate?: string;
  first_air_date?: string;
  genres: string[];
  mediaType: 'movie' | 'tv';
  vote_average?: number;
  addedAt?: any;
  priority?: Priority;
  addedReason?: AddedReason;
  runtimeMinutes?: number;
  providers?: ProviderInfo[];
}

interface MyListFolder {
  id: string;
  name: string;
}

interface StoredPrefs {
  mediaType?: 'movie' | 'tv';
  sortMode?: SortMode;
  selectedGenres?: string[];
  selectedGenre?: string;
  statusFilter?: StatusFilter;
  releaseFilter?: ReleaseFilter;
  ratingFilter?: RatingFilter;
  priorityFilter?: PriorityFilter;
  viewMode?: ViewMode;
}

interface MediaEnrichment {
  voteAverage: number;
  runtimeMinutes: number;
  providers: ProviderInfo[];
  releaseDate: string;
  posterPath: string;
}

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const WATCH_REGION = 'IN';
const PREF_KEY = 'cinescape-watchlist-prefs-v2';
const mediaDetailsCache = new Map<string, MediaEnrichment>();

const priorityMeta: Record<Priority, { label: string; text: string; surface: string; rank: number; icon: typeof Flag }> = {
  high: { label: 'High', text: 'text-rose-300', surface: 'border-rose-400/25 bg-rose-500/15 text-rose-300', rank: 3, icon: Flame },
  medium: { label: 'Medium', text: 'text-amber-300', surface: 'border-amber-400/25 bg-amber-500/15 text-amber-300', rank: 2, icon: Flag },
  low: { label: 'Low', text: 'text-sky-300', surface: 'border-sky-400/25 bg-sky-500/15 text-sky-300', rank: 1, icon: ArrowDown },
};

const PriorityBadge = ({ priority, showLabel = false, compact = false }: { priority: Priority; showLabel?: boolean; compact?: boolean }) => {
  const meta = priorityMeta[priority];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center justify-center gap-1 rounded-lg border backdrop-blur-md ${meta.surface} ${compact ? 'h-5 min-w-5 px-1' : 'px-2 py-1'}`} title={`${meta.label} priority`}>
      <Icon className={compact ? 'h-2.5 w-2.5 stroke-[2.6]' : 'h-3.5 w-3.5 stroke-[2.4]'} />
      {showLabel && <span className={compact ? 'text-[9px] font-black' : 'text-[10px] font-bold'}>{meta.label}</span>}
    </span>
  );
};

const sortOptions: { id: SortMode; label: string }[] = [
  { id: 'added-desc', label: 'Recently Added' },
  { id: 'added-asc', label: 'Oldest Added' },
  { id: 'priority', label: 'Priority' },
  { id: 'release-desc', label: 'Newest Release' },
  { id: 'release-asc', label: 'Oldest Release' },
  { id: 'rating-desc', label: 'Highest Rated' },
  { id: 'az', label: 'A–Z' },
];

const addedReasons: AddedReason[] = ['Trailer', 'Friend', 'Actor', 'Director', 'Trending', 'Recommendation'];

const storedMediaKey = (data: any, fallbackId?: string) => {
  const fallbackMatch = typeof fallbackId === 'string' ? fallbackId.match(/^(movie|tv)[-_](\d+)$/i) : null;
  const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? fallbackMatch?.[2] ?? fallbackId;
  const numericId = Number(rawId);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  const rawType = data?.mediaType ?? data?.type ?? fallbackMatch?.[1];
  const mediaType = rawType === 'tv' ? 'tv' : 'movie';
  return `${mediaType}-${numericId}`;
};

const mediaKey = (item: MediaItem) => `${item.mediaType}-${item.movieId}`;

const getMediaLabel = (type: 'movie' | 'tv') => type === 'tv' ? 'Series' : 'Movie';

const timestampToMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const releaseMillis = (item: MediaItem) => {
  const value = item.releaseDate || item.first_air_date || '';
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const releaseYear = (item: MediaItem) => {
  const value = item.releaseDate || item.first_air_date || '';
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? year : 0;
};

const isUpcoming = (item: MediaItem) => {
  const time = releaseMillis(item);
  if (!time) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return time > today.getTime();
};

const formatReleaseDate = (item: MediaItem) => {
  const value = item.releaseDate || item.first_air_date || '';
  if (!value) return 'TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBA';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatAddedAt = (value: any) => {
  const time = timestampToMillis(value);
  if (!time) return 'Added date unavailable';
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const storedAddedAt = (data: any) =>
  data?.addedAt ??
  data?.addedDate ??
  data?.dateAdded ??
  data?.createdAt ??
  data?.created_at ??
  data?.createdOn ??
  data?.addedOn ??
  data?.timestamp ??
  null;

const formatRuntime = (minutes?: number) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (!total) return '';
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h${mins}m`;
};

const readPrefs = (): StoredPrefs => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREF_KEY) || '{}') as StoredPrefs;
  } catch {
    return {};
  }
};

const PosterImage = ({ item }: { item: MediaItem }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const path = item.posterPath?.startsWith('/') ? item.posterPath : `/${item.posterPath || ''}`;

  return (
    <div className="absolute inset-0 bg-zinc-900">
      {!loaded && !failed && (
        <div className="absolute inset-0 overflow-hidden bg-zinc-900">
          <div className="absolute inset-0 -translate-x-full animate-[watchlistShimmer_1.7s_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
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

const MiniStatusCluster = ({ favorite, watched, inMyList }: { favorite: boolean; watched: boolean; inMyList: boolean }) => (
  <div className="flex items-center justify-end -space-x-1.5 sm:justify-start sm:-space-x-1">
    {favorite && (
      <span className="relative z-[4] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_7px_rgba(239,68,68,0.32),inset_0_1px_1px_rgba(255,255,255,0.32)] sm:h-5 sm:min-w-5 sm:border-2" title="Favorite">
        <Heart className="h-2 w-2 fill-current stroke-[2.6] sm:h-2.5 sm:w-2.5" />
      </span>
    )}
    {inMyList && (
      <span className="relative z-[3] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-b from-fuchsia-500 to-purple-700 text-white shadow-[0_2px_7px_rgba(168,85,247,0.28),inset_0_1px_1px_rgba(255,255,255,0.32)] sm:h-5 sm:min-w-5 sm:border-2" title="In My List">
        <ListChecks className="h-2 w-2 stroke-[2.8] sm:h-2.5 sm:w-2.5" />
      </span>
    )}
    <span className="relative z-[2] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_2px_7px_rgba(59,130,246,0.28),inset_0_1px_1px_rgba(255,255,255,0.32)] sm:h-5 sm:min-w-5 sm:border-2" title="In Watchlist">
      <Bookmark className="h-2 w-2 fill-current stroke-[2.6] sm:h-2.5 sm:w-2.5" />
    </span>
    {watched && (
      <span className="relative z-[1] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[1.5px] border-black/90 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_2px_7px_rgba(16,185,129,0.28),inset_0_1px_1px_rgba(255,255,255,0.32)] sm:h-5 sm:min-w-5 sm:border-2" title="Watched">
        <Check className="h-2 w-2 stroke-[3.5] sm:h-2.5 sm:w-2.5" />
      </span>
    )}
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

const ProviderRow = ({ providers, compact = false }: { providers?: ProviderInfo[]; compact?: boolean }) => {
  const items = (providers || []).slice(0, compact ? 3 : 5);
  if (!items.length) return <span className="text-[10px] text-zinc-600">No streaming provider listed</span>;
  return (
    <div className="flex items-center gap-1.5">
      {items.map((provider) => (
        <span key={provider.id} className="group/provider relative" title={provider.name}>
          <img
            src={`https://image.tmdb.org/t/p/w92${provider.logoPath.startsWith('/') ? provider.logoPath : `/${provider.logoPath}`}`}
            alt={provider.name}
            className={`${compact ? 'h-5 w-5 rounded-md' : 'h-7 w-7 rounded-lg'} object-cover ring-1 ring-white/10`}
            loading="lazy"
          />
        </span>
      ))}
    </div>
  );
};

const WatchlistPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialPrefs = useRef(readPrefs()).current;
  const lastScrollY = useRef(0);

  const [fullWatchlist, setFullWatchlist] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(initialPrefs.mediaType || 'movie');
  const [sortMode, setSortMode] = useState<SortMode>(initialPrefs.sortMode || 'added-desc');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => Array.isArray(initialPrefs.selectedGenres) ? initialPrefs.selectedGenres : initialPrefs.selectedGenre && initialPrefs.selectedGenre !== 'All' ? [initialPrefs.selectedGenre] : []);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialPrefs.statusFilter || 'all');
  const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>(initialPrefs.releaseFilter || 'all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>(initialPrefs.ratingFilter || 'all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(initialPrefs.priorityFilter || 'all');
  const [viewMode, setViewMode] = useState<ViewMode>(initialPrefs.viewMode || 'grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [watchHistory, setWatchHistory] = useState<Set<string>>(new Set());
  const [historyDocIds, setHistoryDocIds] = useState<Map<string, string>>(new Map());
  const [userRatings, setUserRatings] = useState<Map<string, number>>(new Map());
  const [myListKeys, setMyListKeys] = useState<Set<string>>(new Set());
  const [myListFolders, setMyListFolders] = useState<MyListFolder[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [favoriteDocIds, setFavoriteDocIds] = useState<Map<string, string>>(new Map());
  const [actionItem, setActionItem] = useState<MediaItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderPickerItem, setFolderPickerItem] = useState<MediaItem | null>(null);
  const watchlistCreateTimesRef = useRef<Map<string, string>>(new Map());

  const fetchWatchlistCreateTimes = async () => {
    if (!user?.uid) return watchlistCreateTimesRef.current;
    const projectId = db.app.options.projectId;
    const getIdToken = (user as any)?.getIdToken;
    if (!projectId || typeof getIdToken !== 'function') return watchlistCreateTimesRef.current;

    try {
      const token = await getIdToken.call(user);
      let pageToken = '';
      const next = new Map(watchlistCreateTimesRef.current);

      do {
        const url = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(user.uid)}/watchlist`);
        url.searchParams.set('pageSize', '1000');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) break;

        const payload = await response.json();
        const documents = Array.isArray(payload.documents) ? payload.documents : [];
        documents.forEach((document: any) => {
          const rawName = String(document?.name || '');
          const id = rawName.split('/').pop() || '';
          if (id && document?.createTime) next.set(id, document.createTime);
        });
        pageToken = String(payload.nextPageToken || '');
      } while (pageToken);

      watchlistCreateTimesRef.current = next;
      return next;
    } catch {
      return watchlistCreateTimesRef.current;
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefs: StoredPrefs = {
      mediaType,
      sortMode,
      selectedGenres,
      statusFilter,
      releaseFilter,
      ratingFilter,
      priorityFilter,
      viewMode,
    };
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [mediaType, sortMode, selectedGenres, statusFilter, releaseFilter, ratingFilter, priorityFilter, viewMode]);

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
        params: { api_key: API_KEY, language: 'en-US', append_to_response: 'watch/providers' },
      });
      const data = response.data || {};
      const region = data?.['watch/providers']?.results?.[WATCH_REGION] || {};
      const providerSource = region.flatrate || region.free || region.ads || region.rent || [];
      const seen = new Set<number>();
      const providers: ProviderInfo[] = providerSource
        .filter((provider: any) => {
          const id = Number(provider.provider_id);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((provider: any) => ({ id: Number(provider.provider_id), name: provider.provider_name || '', logoPath: provider.logo_path || '' }))
        .filter((provider: ProviderInfo) => provider.logoPath);
      const details: MediaEnrichment = {
        voteAverage: Number(data.vote_average) || 0,
        runtimeMinutes: type === 'movie' ? Number(data.runtime) || 0 : Number(data.episode_run_time?.[0] || data.last_episode_to_air?.runtime) || 0,
        providers,
        releaseDate: type === 'tv' ? data.first_air_date || '' : data.release_date || '',
        posterPath: data.poster_path || '',
      };
      mediaDetailsCache.set(key, details);
      return details;
    } catch {
      const fallback: MediaEnrichment = { voteAverage: 0, runtimeMinutes: 0, providers: [], releaseDate: '', posterPath: '' };
      return fallback;
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setWatchHistory(new Set());
      setHistoryDocIds(new Map());
      return;
    }
    const historyRef = collection(db, `users/${user.uid}/history`);
    return onSnapshot(historyRef, (snapshot) => {
      const keys = new Set<string>();
      const docIds = new Map<string, string>();
      snapshot.docs.forEach((historyDoc) => {
        const key = storedMediaKey(historyDoc.data(), historyDoc.id);
        if (key) {
          keys.add(key);
          docIds.set(key, historyDoc.id);
        }
      });
      setWatchHistory(keys);
      setHistoryDocIds(docIds);
    }, () => {
      setWatchHistory(new Set());
      setHistoryDocIds(new Map());
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUserRatings(new Map());
      return;
    }
    const ratingsRef = collection(db, `users/${user.uid}/ratings`);
    return onSnapshot(ratingsRef, (snapshot) => {
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
      setFavoriteKeys(new Set());
      setFavoriteDocIds(new Map());
      return;
    }
    const favoritesRef = collection(db, `users/${user.uid}/favouriteMedia`);
    return onSnapshot(favoritesRef, (snapshot) => {
      const keys = new Set<string>();
      const docIds = new Map<string, string>();
      snapshot.docs.forEach((favoriteDoc) => {
        const key = storedMediaKey(favoriteDoc.data(), favoriteDoc.id);
        if (key) {
          keys.add(key);
          docIds.set(key, favoriteDoc.id);
        }
      });
      setFavoriteKeys(keys);
      setFavoriteDocIds(docIds);
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

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You are offline. Watchlist may be limited to previously loaded data.');
      setLoading(false);
      return;
    }
    const watchlistRef = collection(db, `users/${user.uid}/watchlist`);
    return onSnapshot(watchlistRef, async (snapshot) => {
      try {
        const needsCreateTime = snapshot.docs.some((watchDoc) => !storedAddedAt(watchDoc.data()) && !watchlistCreateTimesRef.current.has(watchDoc.id));
        const createTimes = needsCreateTime ? await fetchWatchlistCreateTimes() : watchlistCreateTimesRef.current;
        const fetchedWatchlist = await Promise.all(snapshot.docs.map(async (watchDoc) => {
          const data = watchDoc.data();
          const type: 'movie' | 'tv' = data.mediaType === 'tv' ? 'tv' : 'movie';
          const movieId = Number(data.movieId ?? data.mediaId ?? 0);
          const details = movieId > 0 ? await fetchMediaDetails(movieId, type) : { voteAverage: 0, runtimeMinutes: 0, providers: [], releaseDate: '', posterPath: '' };
          return {
            id: watchDoc.id,
            movieId,
            title: data.title || '',
            name: data.name || '',
            posterPath: data.posterPath || details.posterPath || '',
            releaseDate: data.releaseDate || (type === 'movie' ? details.releaseDate : '') || '',
            first_air_date: data.first_air_date || (type === 'tv' ? details.releaseDate : '') || '',
            genres: Array.isArray(data.genres) ? data.genres : [],
            mediaType: type,
            vote_average: details.voteAverage || Number(data.vote_average) || 0,
            addedAt: storedAddedAt(data) ?? createTimes.get(watchDoc.id) ?? null,
            priority: ['high', 'medium', 'low'].includes(data.priority) ? data.priority : undefined,
            addedReason: addedReasons.includes(data.addedReason) ? data.addedReason : undefined,
            runtimeMinutes: details.runtimeMinutes,
            providers: details.providers,
          } as MediaItem;
        }));
        setFullWatchlist(fetchedWatchlist);
        setLoading(false);
      } catch {
        setError('Failed to load watchlist. Please try again.');
        setLoading(false);
      }
    }, () => {
      setError('Failed to load watchlist. Please try again.');
      setLoading(false);
    });
  }, [user?.uid]);

  const watchlist = useMemo(() => fullWatchlist.filter((item) => item.mediaType === mediaType), [fullWatchlist, mediaType]);
  const availableGenres = useMemo(() => [...new Set(watchlist.flatMap((item) => item.genres))].sort((a, b) => a.localeCompare(b)), [watchlist]);

  const filteredAndSortedWatchlist = useMemo(() => {
    const threshold = ratingFilter === '8+' ? 8 : ratingFilter === '7+' ? 7 : ratingFilter === '6+' ? 6 : 0;
    return watchlist
      .filter((item) => {
        const key = mediaKey(item);
        const title = (item.title || item.name || '').toLowerCase();
        const matchesGenre = selectedGenres.length === 0 || selectedGenres.some((genre) => item.genres.includes(genre));
        const matchesSearch = !searchTerm.trim() || title.includes(searchTerm.trim().toLowerCase());
        const matchesStatus = statusFilter === 'all' ||
          (statusFilter === 'unwatched' && !watchHistory.has(key)) ||
          (statusFilter === 'watched' && watchHistory.has(key)) ||
          (statusFilter === 'rated' && userRatings.has(key)) ||
          (statusFilter === 'mylist' && myListKeys.has(key));
        const year = releaseYear(item);
        const matchesRelease = releaseFilter === 'all' ||
          (releaseFilter === 'upcoming' && isUpcoming(item)) ||
          (releaseFilter === '2020s' && year >= 2020) ||
          (releaseFilter === '2010s' && year >= 2010 && year < 2020) ||
          (releaseFilter === '2000s' && year >= 2000 && year < 2010) ||
          (releaseFilter === 'older' && year > 0 && year < 2000);
        const matchesRating = !threshold || (item.vote_average || 0) >= threshold;
        const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
        return matchesGenre && matchesSearch && matchesStatus && matchesRelease && matchesRating && matchesPriority;
      })
      .sort((a, b) => {
        if (sortMode === 'added-desc') return timestampToMillis(b.addedAt) - timestampToMillis(a.addedAt);
        if (sortMode === 'added-asc') return timestampToMillis(a.addedAt) - timestampToMillis(b.addedAt);
        if (sortMode === 'priority') return (b.priority ? priorityMeta[b.priority].rank : 0) - (a.priority ? priorityMeta[a.priority].rank : 0) || timestampToMillis(b.addedAt) - timestampToMillis(a.addedAt);
        if (sortMode === 'release-desc') return releaseMillis(b) - releaseMillis(a);
        if (sortMode === 'release-asc') return releaseMillis(a) - releaseMillis(b);
        if (sortMode === 'rating-desc') return (b.vote_average || 0) - (a.vote_average || 0);
        return (a.title || a.name || '').localeCompare(b.title || b.name || '');
      });
  }, [watchlist, selectedGenres, searchTerm, statusFilter, releaseFilter, ratingFilter, priorityFilter, sortMode, watchHistory, userRatings, myListKeys]);

  const smartCollections = useMemo(() => {
    const byAdded = [...watchlist].sort((a, b) => timestampToMillis(b.addedAt) - timestampToMillis(a.addedAt));
    const byPriority = [...watchlist].sort((a, b) => (b.priority ? priorityMeta[b.priority].rank : 0) - (a.priority ? priorityMeta[a.priority].rank : 0));
    return [
      { id: 'watch-soon', title: 'Watch Soon', icon: Flag, items: byPriority.filter((item) => item.priority === 'high' || item.priority === 'medium').slice(0, 10) },
      { id: 'highly-rated', title: 'Highly Rated', icon: Star, items: [...watchlist].filter((item) => (item.vote_average || 0) >= 8).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 10) },
      { id: 'recently-added', title: 'Recently Added', icon: CalendarClock, items: byAdded.filter((item) => timestampToMillis(item.addedAt) > 0).slice(0, 10) },
      { id: 'upcoming', title: 'Upcoming', icon: Sparkles, items: [...watchlist].filter(isUpcoming).sort((a, b) => releaseMillis(a) - releaseMillis(b)).slice(0, 10) },
      { id: 'short', title: '90 Minutes or Less', icon: Clock3, items: watchlist.filter((item) => item.mediaType === 'movie' && (item.runtimeMinutes || 0) > 0 && (item.runtimeMinutes || 0) <= 90).slice(0, 10) },
      { id: 'weekend', title: 'Weekend Picks', icon: Play, items: watchlist.filter((item) => !watchHistory.has(mediaKey(item)) && !isUpcoming(item) && (item.vote_average || 0) >= 7.2 && ((item.runtimeMinutes || 0) <= 165 || item.mediaType === 'tv')).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 10) },
    ].filter((section) => section.items.length > 0);
  }, [watchlist, watchHistory]);

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; clear: () => void }[] = [];
    selectedGenres.forEach((genre) => chips.push({ id: `genre-${genre}`, label: genre, clear: () => setSelectedGenres((current) => current.filter((value) => value !== genre)) }));
    if (statusFilter !== 'all') chips.push({ id: 'status', label: statusFilter === 'mylist' ? 'My List' : statusFilter[0].toUpperCase() + statusFilter.slice(1), clear: () => setStatusFilter('all') });
    if (releaseFilter !== 'all') chips.push({ id: 'release', label: releaseFilter === 'upcoming' ? 'Upcoming' : releaseFilter, clear: () => setReleaseFilter('all') });
    if (ratingFilter !== 'all') chips.push({ id: 'rating', label: ratingFilter, clear: () => setRatingFilter('all') });
    if (priorityFilter !== 'all') chips.push({ id: 'priority', label: `${priorityMeta[priorityFilter].label} priority`, clear: () => setPriorityFilter('all') });
    return chips;
  }, [selectedGenres, statusFilter, releaseFilter, ratingFilter, priorityFilter]);

  const clearFilters = () => {
    setSelectedGenres([]);
    setStatusFilter('all');
    setReleaseFilter('all');
    setRatingFilter('all');
    setPriorityFilter('all');
    setSearchTerm('');
  };

  const updateWatchlistItem = async (item: MediaItem, patch: Record<string, any>) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, `users/${user.uid}/watchlist/${item.id}`), patch);
    setActionItem((current) => current?.id === item.id ? { ...current, ...patch } : current);
  };

  const removeItem = async (item: MediaItem, confirm = true) => {
    if (!user?.uid) return;
    if (confirm && typeof window !== 'undefined' && !window.confirm(`Remove ${item.title || item.name || 'this title'} from your watchlist?`)) return;
    await deleteDoc(doc(db, `users/${user.uid}/watchlist/${item.id}`));
    setActionItem(null);
  };

  const toggleFavorite = async (item: MediaItem) => {
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

  const markWatched = async (item: MediaItem) => {
    if (!user?.uid) return;
    const key = mediaKey(item);
    if (watchHistory.has(key)) return;
    await setDoc(doc(db, `users/${user.uid}/history/${key}`), {
      movieId: item.movieId,
      mediaId: item.movieId,
      mediaType: item.mediaType,
      title: item.title || item.name || '',
      posterPath: item.posterPath,
      watchedDate: new Date().toISOString(),
      timestamp: serverTimestamp(),
    }, { merge: true });
  };

  const toggleHistory = async (item: MediaItem) => {
    if (!user?.uid) return;
    const key = mediaKey(item);
    if (watchHistory.has(key)) {
      const historyDocId = historyDocIds.get(key) || key;
      await deleteDoc(doc(db, `users/${user.uid}/history/${historyDocId}`));
      return;
    }
    await markWatched(item);
  };

  const toggleWatchlist = async (item: MediaItem) => {
    if (!user?.uid) return;
    const existing = fullWatchlist.find((entry) => mediaKey(entry) === mediaKey(item));
    if (existing) {
      await deleteDoc(doc(db, `users/${user.uid}/watchlist/${existing.id}`));
      return;
    }
    const key = mediaKey(item);
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
      priority: item.priority || null,
      addedReason: item.addedReason || null,
    }, { merge: true });
  };

  const addItemToFolder = async (item: MediaItem, folderId: string) => {
    if (!user?.uid || !folderId) return;
    await setDoc(
      doc(db, `users/${user.uid}/customWatchlists/${folderId}/items/${mediaKey(item)}`),
      {
        id: item.movieId,
        movieId: item.movieId,
        mediaId: item.movieId,
        type: item.mediaType,
        mediaType: item.mediaType,
        title: item.title || item.name || '',
        poster: item.posterPath,
        posterPath: item.posterPath,
        releaseYear: releaseYear(item) ? String(releaseYear(item)) : '',
        voteAverage: item.vote_average || 0,
        runtimeMinutes: item.runtimeMinutes || 0,
        genres: item.genres,
        addedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const removeFromMyList = async (item: MediaItem) => {
    if (!user?.uid) return;
    const key = mediaKey(item);
    const foldersSnapshot = await getDocs(collection(db, `users/${user.uid}/customWatchlists`));
    await Promise.all(foldersSnapshot.docs.map(async (folderDoc) => {
      const folderData = folderDoc.data();
      const tasks: Promise<unknown>[] = [];
      if (Array.isArray(folderData.items)) {
        const filteredItems = folderData.items.filter((storedItem: any) => storedMediaKey(storedItem) !== key);
        if (filteredItems.length !== folderData.items.length) {
          tasks.push(updateDoc(doc(db, `users/${user.uid}/customWatchlists/${folderDoc.id}`), { items: filteredItems }));
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

  const openMyListPicker = (item: MediaItem) => {
    setFolderPickerItem(item);
    setShowFolderPicker(true);
  };

  const openActions = (item: MediaItem) => {
    setActionItem(item);
  };

  const toggleSelection = (item: MediaItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const selectedItems = useMemo(() => fullWatchlist.filter((item) => selectedIds.has(item.id)), [fullWatchlist, selectedIds]);

  const bulkRemove = async () => {
    if (!user?.uid || !selectedItems.length) return;
    if (typeof window !== 'undefined' && !window.confirm(`Remove ${selectedItems.length} selected title${selectedItems.length === 1 ? '' : 's'}?`)) return;
    await Promise.all(selectedItems.map((item) => deleteDoc(doc(db, `users/${user.uid}/watchlist/${item.id}`))));
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const bulkMarkWatched = async () => {
    await Promise.all(selectedItems.map((item) => markWatched(item)));
    setSelectedIds(new Set());
  };

  const bulkSetPriority = async (priority: Priority | null) => {
    await Promise.all(selectedItems.map((item) => updateWatchlistItem(item, { priority })));
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

  const handleCardOpen = (item: MediaItem) => {
    if (selectionMode) {
      toggleSelection(item);
      return;
    }
    navigate(`/${item.mediaType}/${item.movieId}`);
  };

  const totalMovies = fullWatchlist.filter((item) => item.mediaType === 'movie').length;
  const totalSeries = fullWatchlist.filter((item) => item.mediaType === 'tv').length;
  const noResultsBecauseFilters = Boolean(searchTerm.trim() || activeFilterChips.length);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#09090b] px-4">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-red-500/20 bg-zinc-900/40 p-8 text-center shadow-2xl shadow-red-950/20 backdrop-blur-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="mb-2 text-xl font-bold tracking-tight text-white">Error Loading Watchlist</h3>
          <p className="mb-6 text-sm leading-relaxed text-zinc-400">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-500 active:scale-[0.98]">Retry Connection</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#09090b] px-4">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-800/50"><Bookmark className="h-7 w-7 text-zinc-400" /></div>
          <h3 className="mb-2 text-xl font-bold tracking-tight text-white">Sign In Required</h3>
          <p className="mb-6 text-sm leading-relaxed text-zinc-400">Please authenticate to gain access to your curated cinematic space.</p>
          <button onClick={() => navigate('/login')} className="w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-600 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-red-600/10 transition-all hover:from-red-500 hover:to-orange-500 active:scale-[0.98]">Sign In Account</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#09090b] pb-28 text-zinc-100 selection:bg-red-500/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[500px] bg-gradient-to-b from-red-950/10 via-transparent to-transparent" />
      <div className="pointer-events-none absolute right-[-5%] top-[-10%] h-[600px] w-[600px] rounded-full bg-red-600/[0.02] blur-[160px]" />
      <div className="pointer-events-none absolute left-[-5%] top-[10%] h-[500px] w-[500px] rounded-full bg-orange-500/[0.01] blur-[140px]" />

      <div className="relative z-10 border-b border-zinc-900 bg-zinc-950/20 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-3 text-white shadow-md shadow-blue-500/30"><Bookmark className="h-6 w-6 fill-current" /></div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Watchlist</h1>
                <p className="text-xs font-medium text-zinc-400 sm:text-sm">Your dynamic workspace for tracking films and series.</p>
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
              <div className="relative flex flex-1 items-center overflow-hidden rounded-xl border border-white/[0.05] bg-zinc-900/60 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] sm:flex-initial">
                {(['movie', 'tv'] as const).map((type) => {
                  const active = mediaType === type;
                  const Icon = type === 'movie' ? Clapperboard : Tv;
                  return (
                    <button type="button" key={type} onClick={() => { setMediaType(type); setSelectedGenres([]); setSearchTerm(''); }} className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold tracking-wide transition-all sm:flex-initial sm:px-5 ${active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
                      <Icon className={`h-3.5 w-3.5 ${active ? (type === 'movie' ? 'text-red-400' : 'text-cyan-400') : ''}`} />
                      <span>{type === 'movie' ? 'Movies' : 'Series'}</span>
                      {active && <motion.div layoutId="watchlist-media-pill" className="absolute inset-0 -z-10 rounded-lg border border-white/[0.12] bg-gradient-to-b from-white/[0.08] to-white/[0.01] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" transition={{ type: 'spring', stiffness: 320, damping: 26 }} />}
                    </button>
                  );
                })}
              </div>

              <button type="button" onClick={() => filteredAndSortedWatchlist.length && setShowRoulette(true)} disabled={!filteredAndSortedWatchlist.length} aria-label="Surprise Me" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 sm:w-auto sm:gap-1.5 sm:px-3.5 ${filteredAndSortedWatchlist.length ? 'border-red-500/30 bg-zinc-950/80 text-zinc-100 hover:text-red-400' : 'cursor-not-allowed border-zinc-900/60 bg-zinc-900/20 text-zinc-600'}`} title="Surprise Me">
                <IoDiceOutline className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-xs font-bold">Surprise Me</span>
              </button>
            </div>

            <div className="flex w-full items-center gap-2 lg:max-w-3xl lg:flex-1 lg:justify-end">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Search ${mediaType === 'movie' ? 'movies' : 'series'}...`} className="w-full rounded-xl border border-white/[0.05] bg-zinc-900/60 py-2.5 pl-10 pr-9 text-xs text-white outline-none backdrop-blur-md placeholder:text-zinc-500 focus:border-red-500/30" />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"><X className="h-3 w-3" /></button>}
              </div>

              <div className="relative shrink-0">
                <button type="button" onClick={() => setShowSortMenu((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white sm:w-auto sm:gap-2 sm:px-3.5" title={sortOptions.find((option) => option.id === sortMode)?.label}>
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs font-semibold">{sortOptions.find((option) => option.id === sortMode)?.label}</span>
                  <ChevronDown className={`hidden h-3.5 w-3.5 text-zinc-500 transition-transform sm:block ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-white/10 bg-zinc-950 p-1.5 shadow-2xl">
                      {sortOptions.map((option) => <button key={option.id} onClick={() => { setSortMode(option.id); setShowSortMenu(false); }} className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold ${sortMode === option.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{option.label}</button>)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button type="button" onClick={() => setShowFilters(true)} className={`flex h-10 w-10 items-center justify-center rounded-xl border sm:w-auto sm:gap-2 sm:px-3.5 ${activeFilterChips.length ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white'}`} title="Filters">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline text-xs font-semibold">Filters</span>
              </button>

              <button type="button" onClick={() => setViewMode((value) => value === 'grid' ? 'list' : 'grid')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white" title={viewMode === 'grid' ? 'Compact list' : 'Poster grid'}>
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </button>

              <button type="button" onClick={() => { setSelectionMode((value) => !value); setSelectedIds(new Set()); }} className={`flex h-10 w-10 items-center justify-center rounded-xl border sm:w-auto sm:gap-2 sm:px-3.5 ${selectionMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.05] bg-zinc-900/60 text-zinc-300 hover:text-white'}`} title="Select titles">
                <CheckSquare className="h-4 w-4" />
                <span className="hidden md:inline text-xs font-semibold">{selectionMode ? 'Done' : 'Select'}</span>
              </button>
            </div>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {activeFilterChips.map((chip) => (
                <button key={chip.id} onClick={chip.clear} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 hover:text-white">
                  {chip.label}<X className="h-3 w-3 text-zinc-500" />
                </button>
              ))}
              <button onClick={clearFilters} className="shrink-0 px-2 text-[10px] font-bold text-red-400 hover:text-red-300">Clear all</button>
            </div>
          )}
        </motion.div>

        {selectionMode && (
          <div className="mb-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.045] p-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <div>
                  <p className="text-xs font-black text-white">{selectedItems.length} selected</p>
                  <p className="text-[9px] font-medium text-zinc-500">Select titles, then apply a bulk action.</p>
                </div>
                {selectedItems.length > 0 && <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-bold text-zinc-400 hover:text-white">Clear</button>}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button type="button" disabled={!selectedItems.length} onClick={() => { setFolderPickerItem(null); setShowFolderPicker(true); }} className="shrink-0 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-[10px] font-bold text-violet-300 disabled:cursor-not-allowed disabled:opacity-35">Move to My List</button>
                <button type="button" disabled={!selectedItems.length} onClick={bulkMarkWatched} className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-300 disabled:cursor-not-allowed disabled:opacity-35">Mark Watched</button>
                {(['high', 'medium', 'low'] as Priority[]).map((priority) => {
                  const PriorityIcon = priorityMeta[priority].icon;
                  return <button type="button" key={priority} disabled={!selectedItems.length} onClick={() => bulkSetPriority(priority)} className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-35 ${priorityMeta[priority].surface}`}><PriorityIcon className="h-3.5 w-3.5 stroke-[2.5]" />{priorityMeta[priority].label}</button>;
                })}
                <button type="button" disabled={!selectedItems.length} onClick={() => bulkSetPriority(null)} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"><X className="h-3.5 w-3.5" />Clear Priority</button>
                <button type="button" disabled={!selectedItems.length} onClick={bulkRemove} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-bold text-rose-300 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" />Remove</button>
              </div>
            </div>
          </div>
        )}

        {filteredAndSortedWatchlist.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-900 bg-zinc-950/20 py-20 text-center backdrop-blur-sm">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-600"><Bookmark className="h-6 w-6" /></div>
            <h3 className="mb-1.5 text-lg font-bold tracking-tight text-white">{noResultsBecauseFilters ? 'No matches found' : 'No tracking assets found'}</h3>
            <p className="mb-6 max-w-xs text-xs leading-relaxed text-zinc-500">{noResultsBecauseFilters ? 'Your active filters or search are hiding everything in this watchlist.' : `Your active ${mediaType === 'movie' ? 'movie' : 'series'} watchlist is empty.`}</p>
            {noResultsBecauseFilters ? <button onClick={clearFilters} className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-white"><X className="h-3.5 w-3.5" />Clear filters</button> : <button onClick={() => navigate('/trending')} className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-2.5 text-xs font-bold text-zinc-950 transition hover:bg-white"><TrendingUp className="h-3.5 w-3.5" />Discover Media</button>}
          </motion.div>
        )}

        {viewMode === 'grid' && filteredAndSortedWatchlist.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredAndSortedWatchlist.map((item) => {
              const key = mediaKey(item);
              const watched = watchHistory.has(key);
              const inMyList = myListKeys.has(key);
              const userRating = userRatings.get(key);
              const favorite = favoriteKeys.has(key);
              const selected = selectedIds.has(item.id);
              return (
                <motion.article key={item.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }} className={`group relative min-w-0 rounded-2xl border bg-zinc-950 shadow-md transition-all duration-300 hover:shadow-[0_14px_34px_rgba(0,0,0,0.42)] ${selected ? 'border-emerald-400/55 ring-2 ring-emerald-400/15' : 'border-zinc-900 hover:border-zinc-800'}`}>
                  <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl bg-zinc-900">
                    <PosterImage item={item} />
                    <button type="button" onClick={() => handleCardOpen(item)} className="absolute inset-0 z-10" aria-label={`Open ${item.title || item.name || getMediaLabel(item.mediaType)}`} />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-black/50 to-transparent" />

                    <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md border border-zinc-800/80 bg-zinc-950/80 px-1.5 py-0.5 shadow-md backdrop-blur-md"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /><span className="text-[10px] font-bold text-zinc-200">{item.vote_average ? item.vote_average.toFixed(1) : '—'}</span></div>

                    <div className="pointer-events-none absolute right-2 top-2 z-40 flex items-center gap-1.5">
                      {item.priority && <PriorityBadge priority={item.priority} compact />}
                      <span className="rounded-lg border border-white/10 bg-black/65 px-2 py-1 text-[9px] font-black tabular-nums text-white/85 shadow-lg backdrop-blur-md">{releaseYear(item) || 'TBA'}</span>
                    </div>
                    {!selectionMode && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openActions(item); }} className="absolute bottom-2 left-2 z-50 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/65 text-white/90 shadow-[0_5px_16px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:bg-black/80 active:scale-95 lg:hidden" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></button>}

                    {isUpcoming(item) && <div className="pointer-events-none absolute left-2 top-9 rounded-lg border border-sky-400/20 bg-sky-500/15 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-sky-300 backdrop-blur-md">Upcoming · {formatReleaseDate(item)}</div>}

                    {userRating !== undefined && <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 -translate-x-1/2"><UserRatingBadge rating={userRating} /></div>}
                    <div className="pointer-events-none absolute bottom-2 right-2 z-20"><MiniStatusCluster favorite={favorite} watched={watched} inMyList={inMyList} /></div>

                    {selectionMode && <button type="button" onClick={(event) => { event.stopPropagation(); toggleSelection(item); }} className={`absolute left-2 bottom-2 z-50 flex h-7 w-7 items-center justify-center rounded-lg border ${selected ? 'border-emerald-300/40 bg-emerald-400 text-black' : 'border-white/15 bg-black/60 text-white/60'}`}><Check className="h-4 w-4 stroke-[3]" /></button>}

                    {!selectionMode && (
                      <div className="absolute inset-x-2 bottom-2 z-40 hidden translate-y-3 items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-black/65 p-1.5 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleFavorite(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/10 ${favorite ? 'text-rose-400' : 'text-white/80'}`} title={favorite ? 'Remove Favorite' : 'Favorite'}><Heart className={`h-3.5 w-3.5 ${favorite ? 'fill-current' : ''}`} /></button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleHistory(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl ${watched ? 'text-emerald-400' : 'text-white/80 hover:bg-white/10 hover:text-emerald-300'}`} title={watched ? 'Remove from History' : 'Mark Watched'}><Check className="h-3.5 w-3.5" /></button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); inMyList ? removeFromMyList(item) : openMyListPicker(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/10 ${inMyList ? 'text-violet-400' : 'text-white/80 hover:text-violet-300'}`} title={inMyList ? 'Remove from My List' : 'Add to My List'}><ListChecks className="h-3.5 w-3.5" /></button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); removeItem(item); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-rose-500/15 hover:text-rose-300" title="Remove from Watchlist"><BookmarkMinus className="h-3.5 w-3.5" /></button>
                        <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openActions(item); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white active:scale-95" title="More"><MoreHorizontal className="h-3.5 w-3.5" /></button>

                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="line-clamp-1 text-xs font-bold tracking-tight text-zinc-200 transition-colors group-hover:text-white">
                          {item.title || item.name}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-zinc-500">
                          {item.mediaType === 'movie' && item.runtimeMinutes ? (
                            <span className="inline-flex items-center gap-1">
                              {formatRuntime(item.runtimeMinutes)}
                            </span>
                          ) : null}
                          {isUpcoming(item) && <span className="text-sky-400">{formatReleaseDate(item)}</span>}
                          {((item.mediaType === 'movie' && item.runtimeMinutes) || isUpcoming(item)) && item.priority && (
                            <span className="text-zinc-600">•</span>
                          )}
                          {item.priority && <PriorityBadge priority={item.priority} showLabel compact />}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.genres.slice(0, 2).map((genre) => (
                        <span key={genre} className="rounded-md border border-zinc-800/60 bg-zinc-900 px-2 py-0.5 text-[9px] font-medium text-zinc-400">
                          {genre}
                        </span>
                      ))}
                      {item.addedReason && (
                        <span className="rounded-md border border-white/[0.05] bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium text-zinc-500">
                          {item.addedReason}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 hidden items-center justify-between opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
                      <ProviderRow providers={item.providers} compact />
                      <span className="text-[9px] text-zinc-600">{formatAddedAt(item.addedAt)}</span>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {viewMode === 'list' && filteredAndSortedWatchlist.length > 0 && (
          <div className="space-y-2.5">
            {filteredAndSortedWatchlist.map((item) => {
              const key = mediaKey(item);
              const watched = watchHistory.has(key);
              const inMyList = myListKeys.has(key);
              const userRating = userRatings.get(key);
              const favorite = favoriteKeys.has(key);
              const selected = selectedIds.has(item.id);
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} className={`flex items-center gap-3 rounded-2xl border bg-zinc-950/60 p-2.5 backdrop-blur-xl transition ${selected ? 'border-emerald-400/50' : 'border-white/[0.05] hover:border-white/10'}`}>
                  {selectionMode && <button onClick={() => toggleSelection(item)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${selected ? 'border-emerald-300/40 bg-emerald-400 text-black' : 'border-white/10 bg-white/5 text-white/50'}`}><Check className="h-4 w-4 stroke-[3]" /></button>}
                  <button onClick={() => handleCardOpen(item)} className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900"><PosterImage item={item} /></button>
                  <button onClick={() => handleCardOpen(item)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-bold text-white">{item.title || item.name}</h3>{isUpcoming(item) && <span className="rounded-md border border-sky-400/20 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-sky-300">Upcoming</span>}</div><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500"><span>{isUpcoming(item) ? formatReleaseDate(item) : releaseYear(item) || 'N/A'}</span>{item.runtimeMinutes ? <><span>·</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatRuntime(item.runtimeMinutes)}</span></> : null}<span>·</span><span>{item.vote_average?.toFixed(1) || '—'} TMDB</span>{item.priority && <><span>·</span><span className={priorityMeta[item.priority].text}>{priorityMeta[item.priority].label} priority</span></>}</div><div className="mt-1.5 flex flex-wrap gap-1">{item.genres.slice(0, 3).map((genre) => <span key={genre} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-zinc-500">{genre}</span>)}{item.addedReason && <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-zinc-500">Why: {item.addedReason}</span>}</div></button>
                  <div className="hidden min-w-[120px] flex-col items-end gap-1.5 sm:flex"><ProviderRow providers={item.providers} compact /><span className="text-[9px] text-zinc-600">{formatAddedAt(item.addedAt)}</span></div>
                  <div className="flex shrink-0 items-center gap-1 sm:gap-2">{userRating !== undefined && <UserRatingBadge rating={userRating} />}<MiniStatusCluster favorite={favorite} watched={watched} inMyList={inMyList} /><button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openActions(item); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white active:scale-95"><MoreHorizontal className="h-4 w-4" /></button></div>
                </motion.div>
              );
            })}
          </div>
        )}

        {filteredAndSortedWatchlist.length > 0 && <div className="mt-12 text-center"><div className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-900/20 px-4 py-1.5"><span className="text-xs text-zinc-500">Rendered <span className="font-semibold text-zinc-400">{filteredAndSortedWatchlist.length}</span> results</span></div></div>}
      </div>

      {showFilters && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={() => setShowFilters(false)} aria-label="Close filters" />
          <motion.div initial={{ y: 70, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="relative z-10 max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:rounded-[32px] sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Filters</h3>
                <p className="text-[10px] text-zinc-500">Refine your watchlist without losing your place.</p>
              </div>
              <button type="button" onClick={() => setShowFilters(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:text-white active:scale-95"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Genre</p>
                  <span className="text-[9px] font-medium text-zinc-600">Select multiple</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setSelectedGenres([])} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${selectedGenres.length === 0 ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>All</button>
                  {availableGenres.map((genre) => {
                    const active = selectedGenres.includes(genre);
                    return <button type="button" key={genre} onClick={() => setSelectedGenres((current) => active ? current.filter((value) => value !== genre) : [...current, genre])} className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition ${active ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>{genre}</button>;
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Status</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">{(['all', 'unwatched', 'watched', 'rated', 'mylist'] as StatusFilter[]).map((value) => <button type="button" key={value} onClick={() => setStatusFilter(value)} className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold ${statusFilter === value ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{value === 'mylist' ? 'My List' : value[0].toUpperCase() + value.slice(1)}</button>)}</div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Release Year</p>
                <div className="flex flex-wrap gap-1.5">{(['all', 'upcoming', '2020s', '2010s', '2000s', 'older'] as ReleaseFilter[]).map((value) => <button type="button" key={value} onClick={() => setReleaseFilter(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${releaseFilter === value ? 'border-sky-500/25 bg-sky-500/10 text-sky-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{value === 'all' ? 'All' : value === 'upcoming' ? 'Upcoming' : value === 'older' ? 'Older' : value}</button>)}</div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">TMDB Rating</p>
                <div className="flex gap-1.5">{(['all', '8+', '7+', '6+'] as RatingFilter[]).map((value) => <button type="button" key={value} onClick={() => setRatingFilter(value)} className={`flex-1 rounded-xl border px-3 py-2.5 text-[11px] font-bold ${ratingFilter === value ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{value === 'all' ? 'All' : value}</button>)}</div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Priority</p>
                <div className="grid grid-cols-4 gap-1.5">{(['all', 'high', 'medium', 'low'] as PriorityFilter[]).map((value) => {
                  if (value === 'all') return <button type="button" key={value} onClick={() => setPriorityFilter(value)} className={`rounded-xl border px-2 py-2.5 text-[11px] font-bold ${priorityFilter === value ? 'border-white/20 bg-white/10 text-white' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>All</button>;
                  const PriorityIcon = priorityMeta[value].icon;
                  return <button type="button" key={value} onClick={() => setPriorityFilter(value)} className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-bold ${priorityFilter === value ? priorityMeta[value].surface : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}><PriorityIcon className="h-3.5 w-3.5 stroke-[2.5]" />{priorityMeta[value].label}</button>;
                })}</div>
              </div>
            </div>
            <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-zinc-950 pt-4">
              <button type="button" onClick={clearFilters} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-zinc-300">Reset</button>
              <button type="button" onClick={() => setShowFilters(false)} className="flex-1 rounded-2xl bg-white py-3 text-xs font-black text-black">Apply</button>
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {actionItem && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={() => setActionItem(null)} aria-label="Close actions" />
          <motion.div initial={{ y: 70, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:rounded-[32px] sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10"><PosterImage item={actionItem} /></div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-black text-white">{actionItem.title || actionItem.name}</h3>
                <p className="mt-1 text-[10px] text-zinc-500">{getMediaLabel(actionItem.mediaType)} · {isUpcoming(actionItem) ? formatReleaseDate(actionItem) : releaseYear(actionItem) || 'N/A'}</p>
              </div>
              <button type="button" onClick={() => setActionItem(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:text-white active:scale-95"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-5">
              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Library status</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={() => toggleWatchlist(actionItem)} className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[10px] font-bold active:scale-[0.98] ${fullWatchlist.some((entry) => mediaKey(entry) === mediaKey(actionItem)) ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}>{fullWatchlist.some((entry) => mediaKey(entry) === mediaKey(actionItem)) ? <BookmarkMinus className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}<span>{fullWatchlist.some((entry) => mediaKey(entry) === mediaKey(actionItem)) ? 'Remove Watchlist' : 'Add Watchlist'}</span></button>
                  <button type="button" onClick={() => toggleHistory(actionItem)} className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[10px] font-bold active:scale-[0.98] ${watchHistory.has(mediaKey(actionItem)) ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}><Check className="h-4 w-4" /><span>{watchHistory.has(mediaKey(actionItem)) ? 'Remove History' : 'Add History'}</span></button>
                  <button type="button" onClick={() => myListKeys.has(mediaKey(actionItem)) ? removeFromMyList(actionItem) : openMyListPicker(actionItem)} className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[10px] font-bold active:scale-[0.98] ${myListKeys.has(mediaKey(actionItem)) ? 'border-violet-500/20 bg-violet-500/10 text-violet-300' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}><ListChecks className="h-4 w-4" /><span>{myListKeys.has(mediaKey(actionItem)) ? 'Remove My List' : 'Add My List'}</span></button>
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Priority</p>
                  {actionItem.priority && <button type="button" onClick={() => updateWatchlistItem(actionItem, { priority: null })} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"><X className="h-3 w-3" />Clear</button>}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button type="button" onClick={() => updateWatchlistItem(actionItem, { priority: null })} className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-bold ${!actionItem.priority ? 'border-white/20 bg-white/10 text-white' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}><X className="h-3.5 w-3.5" />None</button>
                  {(['high', 'medium', 'low'] as Priority[]).map((priority) => {
                    const PriorityIcon = priorityMeta[priority].icon;
                    return <button type="button" key={priority} onClick={() => updateWatchlistItem(actionItem, { priority: actionItem.priority === priority ? null : priority })} className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-bold ${actionItem.priority === priority ? priorityMeta[priority].surface : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}><PriorityIcon className="h-3.5 w-3.5 stroke-[2.5]" />{priorityMeta[priority].label}</button>;
                  })}
                </div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Why did I add this?</p>
                <div className="flex flex-wrap gap-1.5">{addedReasons.map((reason) => <button type="button" key={reason} onClick={() => updateWatchlistItem(actionItem, { addedReason: reason })} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${actionItem.addedReason === reason ? 'border-violet-500/25 bg-violet-500/10 text-violet-300' : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'}`}>{reason}</button>)}</div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Streaming in {WATCH_REGION}</p>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"><ProviderRow providers={actionItem.providers} /></div>
              </section>

              <button type="button" onClick={() => toggleFavorite(actionItem)} className={`flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-bold ${favoriteKeys.has(mediaKey(actionItem)) ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-white/10 bg-white/[0.05] text-white'}`}><Heart className={`h-4 w-4 ${favoriteKeys.has(mediaKey(actionItem)) ? 'fill-current' : ''}`} />{favoriteKeys.has(mediaKey(actionItem)) ? 'Remove Favorite' : 'Favorite'}</button>
            </div>
          </motion.div>
        </div>,
        document.body,
      )}

      {smartCollections.length > 0 && (
        <>
          <div className="mx-auto mt-10 mb-7 max-w-7xl px-4 sm:mt-12 sm:mb-8 sm:px-6 lg:px-8">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
          </div>
          <section className="mx-auto mb-8 max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-black tracking-tight text-white">Smart Collections</h2><p className="text-[11px] font-medium text-zinc-500">Automatic picks from your current {mediaType === 'movie' ? 'movie' : 'series'} watchlist.</p></div></div>
            <div className="space-y-5">
              {smartCollections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.id}>
                    <div className="mb-2.5 flex items-center gap-2"><Icon className="h-4 w-4 text-amber-400" /><h3 className="text-xs font-bold text-zinc-200">{section.title}</h3><span className="text-[10px] text-zinc-600">{section.items.length}</span></div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                      {section.items.map((item) => (
                        <button type="button" key={`${section.id}-${item.id}`} onClick={() => handleCardOpen(item)} className="group w-[104px] shrink-0 text-left sm:w-[116px]">
                          <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900 shadow-md transition group-hover:border-white/15"><PosterImage item={item} />{isUpcoming(item) && <span className="absolute left-1.5 top-1.5 rounded-md border border-sky-400/20 bg-sky-500/15 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-sky-300 backdrop-blur-md">Upcoming</span>}</div>
                          <p className="mt-1.5 line-clamp-1 text-[10px] font-bold text-zinc-300 group-hover:text-white">{item.title || item.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {showFolderPicker && createPortal(
        <div className="fixed inset-0 z-[10030] flex items-end justify-center sm:items-center sm:p-5">
          <button type="button" className="absolute inset-0 bg-black/72 backdrop-blur-md" onClick={() => { setShowFolderPicker(false); setFolderPickerItem(null); }} aria-label="Close My List chooser" />
          <motion.div initial={{ y: 50, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="relative z-10 w-full max-w-md rounded-t-[30px] border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:rounded-[30px]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">Add to My List</h3>
                <p className="text-[10px] text-zinc-500">{folderPickerItem ? `Choose a custom list for ${folderPickerItem.title || folderPickerItem.name || 'this title'}.` : `Choose a custom list for ${selectedItems.length} selected title${selectedItems.length === 1 ? '' : 's'}.`}</p>
              </div>
              <button type="button" onClick={() => { setShowFolderPicker(false); setFolderPickerItem(null); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            {myListFolders.length ? (
              <div className="space-y-1.5">
                {myListFolders.map((folder) => <button type="button" key={folder.id} onClick={() => moveSelectedToFolder(folder.id)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-left text-xs font-semibold text-zinc-200 hover:bg-white/[0.06] active:scale-[0.99]"><span className="truncate">{folder.name}</span><ListChecks className="h-4 w-4 text-violet-400" /></button>)}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-center text-xs text-zinc-500">Create a My List folder first.</div>
            )}
          </motion.div>
        </div>,
        document.body,
      )}

      <AnimatePresence>{showRoulette && <Roulette source="watchlist" isOpen={showRoulette} onClose={() => setShowRoulette(false)} items={filteredAndSortedWatchlist as any} />}</AnimatePresence>
      <style>{`@keyframes watchlistShimmer{100%{transform:translateX(200%)}}`}</style>
    </div>
  );
};

export default WatchlistPage;