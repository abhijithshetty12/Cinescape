import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { Archive, ArrowLeft, BarChart3, Bookmark, BookmarkMinus, Check, CheckSquare, ChevronDown, ChevronRight, ChevronUp, Clapperboard, Clock3, Command, Copy, Dices, Download, Edit3, Eye, Film, Filter, FolderOpen, FolderPlus, Grid3X3, GripVertical, Heart, Images, List, ListChecks, ListPlus, Loader2, MoreHorizontal, Palette, Pin, PinOff, Play, Plus, PlusSquare, RotateCcw, Search, Share2, SlidersHorizontal, Sparkles, Star, Trash2, Tv, X, Layers, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { db } from "../firebase.ts";
import Loading from "../components/Loading.tsx";
import Toast from "../components/Toast.tsx";
import Roulette from "../components/Roulette.tsx";

type MediaType = "movie" | "tv";
type CoverMode = "auto" | "single" | "collage" | "rotate";
type SortMode = "default" | "added-asc" | "rating" | "runtime" | "release-desc" | "release-asc" | "az" | "custom";
type StatusFilter = "all" | "unwatched" | "watched" | "rated" | "watchlist";
type ReleaseFilter = "all" | "upcoming" | "2020s" | "2010s" | "2000s" | "older";
type RatingFilter = "all" | "8+" | "7+" | "6+";
type ViewMode = "grid" | "list";
type AccentId = "auto" | "amber" | "red" | "cyan" | "violet" | "emerald" | "blue";
interface SmartRules { mediaType?: "all" | MediaType; genre?: string; minRating?: number; maxRuntimeMinutes?: number; provider?: string; release?: ReleaseFilter; unwatchedOnly?: boolean; favoriteOnly?: boolean; recentDays?: number; }
interface ProviderInfo { id: number; name: string; logoPath: string; }
interface ListItem { id: number; title: string; type: MediaType; poster: string | null; backdrop: string | null; releaseYear: string; overview: string; voteAverage: number; runtimeMinutes?: number; genres?: string[]; order?: number; addedAt?: any; providers?: ProviderInfo[]; providersFetched?: boolean; }
interface CustomFolder { id: string; name: string; description: string; items: ListItem[]; coverImage?: string | null; coverMode?: CoverMode; pinned?: boolean; order?: number; storageVersion?: number; smartList?: boolean; smartRules?: SmartRules; accent?: AccentId; archived?: boolean; archivedAt?: any; updatedAt?: any; }
interface SearchResultItem { id: number; title?: string; name?: string; poster_path: string | null; backdrop_path?: string | null; release_date?: string; first_air_date?: string; overview: string; vote_average: number; media_type: MediaType; runtimeMinutes?: number; genres?: string[]; }
interface DetailsData { poster: string | null; backdrop: string | null; runtimeMinutes: number; genres: string[]; providers: ProviderInfo[]; voteAverage: number; releaseYear: string; }
interface StatusState { type: "success" | "error"; message: string; }
interface UndoState { message: string; action: () => Promise<void>; }

const API_KEY = "859afbb4b98e3b467da9c99ac390e950";
const WATCH_REGION = "IN";
const ACCENTS: Record<Exclude<AccentId, "auto">, { label: string; color: string }> = {
    amber: { label: "Amber", color: "#ff9500" },
    red: { label: "Red", color: "#ef062d" },
    cyan: { label: "Cyan", color: "#06b6d4" },
    violet: { label: "Violet", color: "#662bee" },
    emerald: { label: "Emerald", color: "#0ad692" },
    blue: { label: "Blue", color: "#0d66f6" },
};
const SMART_TEMPLATES: { id: string; label: string; description: string; rules: SmartRules }[] = [
    { id: "unwatched-thrillers", label: "Unwatched Thrillers", description: "Thrillers you still haven’t watched", rules: { genre: "Thriller", unwatchedOnly: true } },
    { id: "rated-movies", label: "8+ Rated Movies", description: "Movies rated 8.0 or higher", rules: { mediaType: "movie", minRating: 8 } },
    { id: "under-two-hours", label: "Under 2 Hours", description: "Quick watches under 120 minutes", rules: { maxRuntimeMinutes: 120 } },
    { id: "prime-video", label: "Available on Prime Video", description: "Titles currently listed on Prime Video", rules: { provider: "Prime Video" } },
    { id: "2020s-scifi", label: "2020s Sci-Fi", description: "Science fiction released in the 2020s", rules: { genre: "Science Fiction", release: "2020s" } },
    { id: "recently-added", label: "Recently Added", description: "Titles added in the last 30 days", rules: { recentDays: 30 } },
];

const CREATE_TEMPLATES: { id: string; label: string; description: string; smart: boolean; name?: string; folderDescription?: string; rules?: SmartRules; icon: typeof FolderPlus }[] = [
    { id: "blank", label: "Blank", description: "Start with an empty manual list", smart: false, icon: FolderPlus },
    { id: "smart", label: "Smart List", description: "Create a rule-driven collection", smart: true, icon: SlidersHorizontal },
    { id: "marathon", label: "Watch Marathon", description: "Build an ordered movie or series marathon", smart: false, name: "Watch Marathon", folderDescription: "A watch order for a full marathon.", icon: Play },
    { id: "weekend", label: "Weekend", description: "Unwatched picks under two hours", smart: true, name: "Weekend Picks", folderDescription: "Quick unwatched titles for the weekend.", rules: { maxRuntimeMinutes: 120, unwatchedOnly: true }, icon: Clock3 },
    { id: "favorites", label: "Favorites", description: "Auto-collect titles you favourite", smart: true, name: "Favorites", folderDescription: "Titles marked as favourites across your library.", rules: { favoriteOnly: true }, icon: Heart },
];

const RECENT_LISTS_KEY = "cinescape-mylist-recent-v1";

const SORT_OPTIONS: { value: SortMode; label: string; description: string }[] = [
    { value: "default", label: "Recently added", description: "Newest additions first" },
    { value: "added-asc", label: "Oldest added", description: "Oldest additions first" },
    { value: "rating", label: "Highest rating", description: "Best TMDB scores first" },
    { value: "runtime", label: "Longest runtime", description: "Longest titles first" },
    { value: "release-desc", label: "Newest release", description: "Latest releases first" },
    { value: "release-asc", label: "Oldest release", description: "Earliest releases first" },
    { value: "az", label: "A–Z", description: "Alphabetical order" },
    { value: "custom", label: "Custom order", description: "Your manual arrangement" },
];
const TMDB_BASE = "https://api.themoviedb.org/3", IMAGE_BASE = "https://image.tmdb.org/t/p";
const detailsCache = new Map<string, Promise<DetailsData>>(), recommendationCache = new Map<string, Promise<SearchResultItem[]>>();
const itemKey = (item: {
    id: number;
    type: MediaType;
}) => `${item.type}-${item.id}`;
const yearOf = (date?: string) => date?.slice(0, 4) || "—";
const formatRuntime = (minutes = 0) => minutes <= 0 ? "—" : `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : ""}${minutes % 60 ? `${minutes % 60}m` : ""}`;
const imageSource = (path: string | null | undefined, size = "original") => {
    if (!path) return null;
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    const p = path.trim().replace(/^https?:\/\/image\.tmdb\.org\/t\/p\/(?:original|w\d+)\//i, "").replace(/^\/+/, ""); return p ? `${IMAGE_BASE}/${size}/${p}` : null;
};
const posterUrl = (path: string | null | undefined, size = "w780") => imageSource(path, size);
const backdropUrl = (path: string | null | undefined, size = "w1280") => imageSource(path, size);
const storedPosterPath = (path: string | null | undefined) => {
    if (!path) return "";
    const match = path.match(/image\.tmdb\.org\/t\/p\/(?:original|w\d+)\/(.+)$/i);
    if (match?.[1]) return `/${match[1].replace(/^\/+/, "")}`;
    return path;
};
const normalizeItem = (item: any, index = 0): ListItem => ({ id: Number(item.id), title: item.title || item.name || "Untitled", type: item.type === "tv" ? "tv" : "movie", poster: item.poster || null, backdrop: item.backdrop || null, releaseYear: item.releaseYear || "", overview: item.overview || "", voteAverage: Number(item.voteAverage) || 0, runtimeMinutes: Number(item.runtimeMinutes) || 0, genres: Array.isArray(item.genres) ? item.genres : [], order: Number.isFinite(Number(item.order)) ? Number(item.order) : index, addedAt: item.addedAt ?? item.addedDate ?? item.createdAt ?? item.timestamp ?? null, providers: Array.isArray(item.providers) ? item.providers : [], providersFetched: Boolean(item.providersFetched) });
const normalizeSearch = (item: any, type?: MediaType): SearchResultItem => ({ ...item, media_type: (item.media_type || type) === "tv" ? "tv" : "movie" });

const timestampToMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};
const storedAddedAt = (data: any) => data?.addedAt ?? data?.addedDate ?? data?.dateAdded ?? data?.createdAt ?? data?.created_at ?? data?.createdOn ?? data?.addedOn ?? data?.timestamp ?? null;
const formatRelativeTime = (value: any) => {
    const time = timestampToMillis(value);
    if (!time) return "";
    const diff = Date.now() - time;
    const minute = 60000, hour = 60 * minute, day = 24 * hour;
    if (diff < minute) return "just now";
    if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
    if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`;
    if (diff < day * 2) return "yesterday";
    if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;
    return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const formatAddedAt = (value: any) => {
    const time = timestampToMillis(value);
    return time ? `Added ${new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "Added date unavailable";
};
const releaseMillis = (item: ListItem) => {
    const parsed = new Date(item.releaseYear || "").getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};
const releaseYearNumber = (item: ListItem) => {
    const year = Number(yearOf(item.releaseYear));
    return Number.isFinite(year) ? year : 0;
};
const hexToRgba = (hex: string, alpha: number) => {
    const clean = hex.replace("#", "");
    const value = Number.parseInt(clean, 16);
    const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
    return `rgba(${r},${g},${b},${alpha})`;
};
const mixHex = (hex: string, target: "#ffffff" | "#000000", amount: number) => {
    const clean = hex.replace("#", "");
    const value = Number.parseInt(clean, 16);
    const tr = target === "#ffffff" ? 255 : 0;
    const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
    const mix = (channel: number) => Math.round(channel + (tr - channel) * amount).toString(16).padStart(2, "0");
    return `#${mix(r)}${mix(g)}${mix(b)}`;
};
const releaseMatches = (item: ListItem, release?: ReleaseFilter) => {
    if (!release || release === "all") return true;
    const year = releaseYearNumber(item);
    if (release === "upcoming") return isUpcoming(item);
    if (release === "2020s") return year >= 2020;
    if (release === "2010s") return year >= 2010 && year <= 2019;
    if (release === "2000s") return year >= 2000 && year <= 2009;
    return year > 0 && year < 2000;
};
const smartRuleSummary = (rules: SmartRules = {}) => {
    const parts: string[] = [];
    if (rules.unwatchedOnly) parts.push("Unwatched");
    if (rules.favoriteOnly) parts.push("Favourites");
    if (rules.mediaType && rules.mediaType !== "all") parts.push(rules.mediaType === "movie" ? "Movies" : "Series");
    if (rules.genre) parts.push(rules.genre);
    if (rules.minRating) parts.push(`${rules.minRating}+ TMDB`);
    if (rules.maxRuntimeMinutes) parts.push(`≤ ${formatRuntime(rules.maxRuntimeMinutes)}`);
    if (rules.provider) parts.push(rules.provider);
    if (rules.release && rules.release !== "all") parts.push(rules.release === "older" ? "Before 2000" : rules.release);
    if (rules.recentDays) parts.push(`Last ${rules.recentDays}d`);
    return parts.join(" · ") || "All titles";
};
const isUpcoming = (item: ListItem) => {
    const time = releaseMillis(item);
    if (!time) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return time > today.getTime();
};
const storedMediaKey = (data: any, fallbackId?: string) => {
    const match = typeof fallbackId === "string" ? fallbackId.match(/^(movie|tv)[-_](\d+)$/i) : null;
    const rawId = data?.movieId ?? data?.mediaId ?? data?.id ?? match?.[2] ?? fallbackId;
    const numericId = Number(rawId);
    if (!Number.isFinite(numericId) || numericId <= 0) return null;
    const rawType = data?.mediaType ?? data?.type ?? match?.[1];
    return `${rawType === "tv" ? "tv" : "movie"}-${numericId}`;
};


const fetchDetails = (id: number, type: MediaType) => {
    const key = `${type}-${id}`;
    if (!detailsCache.has(key)) detailsCache.set(key, (async () => {
        try {
            const { data } = await axios.get(`${TMDB_BASE}/${type}/${id}`, { params: { api_key: API_KEY, language: "en-US", append_to_response: "watch/providers" } });
            const region = data?.["watch/providers"]?.results?.[WATCH_REGION] || {};
            const providerSource = region.flatrate || region.free || region.ads || region.rent || [];
            const seen = new Set<number>();
            const providers: ProviderInfo[] = providerSource
                .filter((provider: any) => {
                    const providerId = Number(provider.provider_id);
                    if (!providerId || seen.has(providerId)) return false;
                    seen.add(providerId);
                    return true;
                })
                .map((provider: any) => ({ id: Number(provider.provider_id), name: provider.provider_name || "", logoPath: provider.logo_path || "" }))
                .filter((provider: ProviderInfo) => provider.logoPath);
            return {
                poster: posterUrl(data.poster_path),
                backdrop: backdropUrl(data.backdrop_path),
                runtimeMinutes: type === "movie" ? Number(data.runtime) || 0 : Number(data.episode_run_time?.[0] || data.last_episode_to_air?.runtime) || 0,
                genres: Array.isArray(data.genres) ? data.genres.map((g: { name: string }) => g.name).filter(Boolean) : [],
                providers,
                voteAverage: Number(data.vote_average) || 0,
                releaseYear: type === "tv" ? data.first_air_date || "" : data.release_date || "",
            };
        } catch {
            return { poster: null, backdrop: null, runtimeMinutes: 0, genres: [], providers: [], voteAverage: 0, releaseYear: "" };
        }
    })());
    return detailsCache.get(key)!;
};
const fetchPopular = async () => {
    try {
        const [trending, movies, series] = await Promise.all([axios.get(`${TMDB_BASE}/trending/all/week`, { params: { api_key: API_KEY, language: "en-US" } }).catch(() => ({ data: { results: [] } })), axios.get(`${TMDB_BASE}/movie/popular`, { params: { api_key: API_KEY, language: "en-US", page: 1 } }).catch(() => ({ data: { results: [] } })), axios.get(`${TMDB_BASE}/tv/popular`, { params: { api_key: API_KEY, language: "en-US", page: 1 } }).catch(() => ({ data: { results: [] } }))]);
        const all = [...(trending.data.results || []).filter((x: any) => x.media_type === "movie" || x.media_type === "tv").map((x: any) => normalizeSearch(x)), ...(movies.data.results || []).map((x: any) => normalizeSearch(x, "movie")), ...(series.data.results || []).map((x: any) => normalizeSearch(x, "tv"))], seen = new Set<string>();
        return all.filter(x => {
            const k = itemKey({ id: x.id, type: x.media_type });
            if (seen.has(k) || !x.poster_path) return false;
            seen.add(k);
            return true;
        }).slice(0, 20);
    } catch {
        return [];
    }
};
const getTopGenre = (items: ListItem[]) => {
    const count = new Map<string, number>();
    items.flatMap(i => i.genres || []).forEach(g => count.set(g, (count.get(g) || 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Mixed";
};
const getStats = (items: ListItem[]) => {
    const movies = items.filter(i => i.type === "movie").length, series = items.length - movies, totalRuntime = items.reduce((s, i) => s + (i.runtimeMinutes || 0), 0), rated = items.filter(i => i.voteAverage > 0), average = rated.length ? rated.reduce((s, i) => s + i.voteAverage, 0) / rated.length : 0, years = items.map(i => Number(yearOf(i.releaseYear))).filter(y => Number.isFinite(y) && y > 1800);
    return { movies, series, totalRuntime, average, topGenre: getTopGenre(items), oldest: years.length ? Math.min(...years) : null, newest: years.length ? Math.max(...years) : null };
};
const getCoverCandidates = (folder: CustomFolder) => Array.from(new Set([imageSource(folder.coverImage), ...folder.items.map(i => imageSource(i.backdrop)), ...folder.items.map(i => imageSource(i.poster, "w1280"))].filter((v): v is string => Boolean(v))));

const SmartImage = ({ src, alt, className = "" }: {
    src: string | null;
    alt: string;
    className?: string;
}) => {
    const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false);
    useEffect(() => {
        setLoaded(false);
        setFailed(false);
    }, [src]);
    return <div className={`relative overflow-hidden bg-zinc-900 ${className}`}>
        {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900" />}{src && !failed ? <img src={src} alt={alt} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`h-full w-full object-cover transition-all duration-700 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-[1.03]"}`} /> : <div className="absolute inset-0 flex items-center justify-center">
            <Film className="h-7 w-7 text-zinc-700" />
        </div>}
    </div>;
};
const RuntimeText = ({ id, type, initial = 0, className = "" }: {
    id: number;
    type: MediaType;
    initial?: number;
    className?: string;
}) => {
    const [runtime, setRuntime] = useState(initial), [pending, setPending] = useState(!initial);
    useEffect(() => {
        let alive = true;
        if (initial) {
            setRuntime(initial);
            setPending(false);
            return;
        } setPending(true);
        fetchDetails(id, type).then(d => {
            if (alive) {
                setRuntime(d.runtimeMinutes);
                setPending(false);
            }
        });
        return () => {
            alive = false;
        };
    }, [id, type, initial]);
    return <span className={className}>
        {pending ? "…" : runtime ? formatRuntime(runtime) : "—"}
    </span>;
};

const MiniStatusCluster = ({ favorite, watched, inWatchlist }: { favorite: boolean; watched: boolean; inWatchlist: boolean }) => (
    <div className="flex items-center -space-x-1.5">
        {favorite && (
            <span className="relative z-[5] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_2px_8px_rgba(239,68,68,0.34),inset_0_1px_1px_rgba(255,255,255,0.3)]" title="Favorite">
                <Heart className="h-2.5 w-2.5 fill-current stroke-[2.6]" />
            </span>
        )}
        <span className="relative z-[4] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-fuchsia-500 to-violet-700 text-white shadow-[0_2px_8px_rgba(168,85,247,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)]" title="In My List">
            <ListChecks className="h-2.5 w-2.5 stroke-[2.8]" />
        </span>
        {inWatchlist && (
            <span className="relative z-[3] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)]" title="In Watchlist">
                <Bookmark className="h-2.5 w-2.5 fill-current stroke-[2.5]" />
            </span>
        )}
        {watched && (
            <span className="relative z-[2] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)]" title="Watched">
                <Check className="h-2.5 w-2.5 stroke-[3.4]" />
            </span>
        )}
    </div>
);

const UserRatingBadge = ({ rating }: { rating?: number }) => {
    if (rating === undefined || !Number.isFinite(rating)) return null;
    return (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-gradient-to-b from-amber-400 to-orange-700 px-1.5 text-[9px] font-black leading-none text-white shadow-[0_2px_7px_rgba(245,158,11,0.3)]" title={`Your rating: ${rating.toFixed(1)}`}>
            {rating.toFixed(1)}
        </span>
    );
};

const ProviderRow = ({ providers, compact = false, faded = false }: { providers?: ProviderInfo[]; compact?: boolean; faded?: boolean }) => {
    const items = (providers || []).slice(0, compact ? 3 : 5);
    if (!items.length) return <span className="text-[9px] text-zinc-600">No provider</span>;
    return (
        <div className={`flex items-center gap-1 transition-opacity duration-200 ${faded ? "opacity-100 [@media(hover:hover)]:opacity-55 [@media(hover:hover)]:group-hover:opacity-100" : "opacity-100"}`}>
            {items.map(provider => (
                <span key={provider.id} title={provider.name}>
                    <img
                        src={`${IMAGE_BASE}/w92${provider.logoPath.startsWith("/") ? provider.logoPath : `/${provider.logoPath}`}`}
                        alt={provider.name}
                        className={`${compact ? "h-[18px] w-[18px] rounded-[5px]" : "h-7 w-7 rounded-lg"} object-cover ring-1 ring-white/10`}
                        loading="lazy"
                    />
                </span>
            ))}
        </div>
    );
};
const EmptyCover = () => <div className="absolute inset-0 overflow-hidden bg-zinc-950">
    <motion.div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" animate={{ x: [0, 36, 0], y: [0, 18, 0], scale: [1, 1.12, 1] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
    <motion.div className="absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-orange-600/10 blur-3xl" animate={{ x: [0, -28, 0], y: [0, -20, 0], scale: [1.08, .96, 1.08] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.055),transparent_42%)]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
</div>;
const FolderPosterPreview = ({ folder }: {
    folder: CustomFolder;
}) => {
    const items = [...folder.items]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .filter((item) => item.poster)
        .slice(0, 3);

    const posterClasses = [
        "z-10 -rotate-[4deg] translate-y-2",
        "z-30 -mx-5 sm:-mx-6 -translate-y-1 scale-[1.04]",
        "z-20 rotate-[4deg] translate-y-2",
    ];

    return (
        <div className="relative h-full overflow-hidden rounded-[22px] border border-white/[0.10] bg-[radial-gradient(circle_at_50%_18%,rgba(245,158,11,0.10),transparent_30%),linear-gradient(145deg,#171717_0%,#090909_52%,#020202_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_45px_rgba(0,0,0,0.38)]">
            {items.length ? (
                <>
                    <div className="absolute inset-0 overflow-hidden">
                        {items.slice(0, 2).map((item, index) => (
                            <img
                                key={`ambient-${itemKey(item)}`}
                                src={imageSource(item.poster, "w500") || ""}
                                alt=""
                                aria-hidden="true"
                                className={`absolute top-1/2 h-[150%] w-[55%] -translate-y-1/2 object-cover opacity-[0.10] blur-3xl saturate-150 ${index === 0 ? "-left-[8%]" : "-right-[8%]"
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.025] via-transparent to-black/55" />
                    <div className="absolute left-1/2 top-3 h-16 w-44 -translate-x-1/2 rounded-full bg-amber-400/[0.07] blur-3xl" />
                    <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center px-5 pb-3 pt-4">
                        {items.map((item, index) => {
                            const single = items.length === 1;
                            const double = items.length === 2;
                            const dynamicClass = single
                                ? "z-30"
                                : double
                                    ? index === 0
                                        ? "z-20 -rotate-[3deg] translate-x-3 translate-y-1"
                                        : "z-30 -ml-7 rotate-[3deg] -translate-x-3 -translate-y-1"
                                    : posterClasses[index];

                            return (
                                <motion.div
                                    key={itemKey(item)}
                                    className={`group/poster relative h-[88%] max-h-[172px] min-h-[142px] aspect-[2/3] shrink-0 overflow-hidden rounded-[18px] border border-white/[0.14] bg-zinc-900 shadow-[0_18px_38px_rgba(0,0,0,0.60),0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.10)] ${dynamicClass}`}
                                    whileHover={{ y: -7, rotate: 0, scale: 1.055 }}
                                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                                >
                                    <SmartImage
                                        src={imageSource(item.poster, "w500")}
                                        alt={item.title}
                                        className="absolute inset-0"
                                    />
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.08] via-transparent to-black/20 opacity-70" />
                                    <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                                    <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/[0.04]" />
                                </motion.div>
                            );
                        })}
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="pointer-events-none absolute bottom-[-18px] left-1/2 h-10 w-52 -translate-x-1/2 rounded-full bg-black/80 blur-2xl" />
                </>
            ) : (
                <EmptyCover />
            )}
        </div>
    );
};

const CollectionCover = ({ folder, className = "", hero = false }: {
    folder: CustomFolder;
    className?: string;
    hero?: boolean;
}) => {
    const reduced = useReducedMotion(), mode = folder.coverMode || "auto", sources = getCoverCandidates(folder), posters = folder.items.map(i => imageSource(i.poster, "w500")).filter((v): v is string => Boolean(v)).slice(0, 3), [index, setIndex] = useState(0);
    useEffect(() => {
        setIndex(0);
    }, [folder.id, folder.coverImage, folder.items.length, mode]);
    useEffect(() => {
        if (mode !== "rotate" || sources.length < 2 || reduced) return;
        const t = window.setInterval(() => setIndex(i => (i + 1) % sources.length), 5200);
        return () => window.clearInterval(t);
    }, [mode, sources.length, reduced]);
    if (mode === "collage" && posters.length >= 2) return <div className={`overflow-hidden bg-zinc-950 ${className}`}>
        <div className="absolute inset-0 grid grid-cols-[1.45fr_.8fr] gap-1"> <SmartImage src={posters[0]} alt={folder.name} className="h-full" />
            <div className="grid grid-rows-2 gap-1">
                <SmartImage src={posters[1]} alt={folder.name} className="h-full" />
                <SmartImage src={posters[2] || sources[0] || null} alt={folder.name} className="h-full" />
            </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/15" />
    </div>;
    const src = mode === "single" ? (imageSource(folder.coverImage) || sources[0] || null) : sources[index] || null;
    return <div className={`overflow-hidden bg-zinc-950 ${className}`}>
        {src ? <motion.div className="absolute inset-0" animate={hero && !reduced ? { scale: [1, 1.04] } : { scale: 1 }} transition={hero && !reduced ? { duration: 18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" } : { duration: .4 }}>
            <SmartImage src={src} alt={folder.name} className="absolute inset-0" />
        </motion.div> : <EmptyCover />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/5" />
    </div>;
};

const SuggestionRail = ({ title, subtitle, items, existing, onAdd, eyebrow = "For this collection", large = false }: {
    title: string;
    subtitle: string;
    items: SearchResultItem[];
    existing: Set<string>;
    onAdd: (item: SearchResultItem) => Promise<void>;
    eyebrow?: string;
    large?: boolean;
}) => {
    const ref = useRef<HTMLDivElement>(null), reduced = useReducedMotion(), [paused, setPaused] = useState(false);
    useEffect(() => {
        if (reduced || paused || !items.length) return;
        let frame = 0, last = 0;
        const tick = (t: number) => {
            if (t - last > 30 && window.matchMedia("(min-width: 768px)").matches && ref.current) {
                ref.current.scrollLeft += .28;
                if (ref.current.scrollLeft + ref.current.clientWidth >= ref.current.scrollWidth - 2) ref.current.scrollLeft = 0;
                last = t;
            } frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [reduced, paused, items.length]);
    if (!items.length) return null;
    return <section>
        <div className="mb-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-amber-400">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
            </div>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">
                {title}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
                {subtitle}
            </p>
        </div>
        <div ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {items.map(item => {
                const key = itemKey({ id: item.id, type: item.media_type }), added = existing.has(key), name = item.title || item.name || "Untitled";
                return <article key={key} className={`group shrink-0 snap-start ${large ? "w-[168px] sm:w-[196px]" : "w-[144px] sm:w-[168px]"}`}>
                    <div className="relative aspect-[2/3] overflow-hidden rounded-[20px] border border-white/10 bg-zinc-900 transition group-hover:-translate-y-1 group-hover:border-amber-400/40">
                        <SmartImage src={posterUrl(item.poster_path, "w500")} alt={name} className="absolute inset-0" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-black">
                            <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                            {item.vote_average?.toFixed(1) || "—"}
                        </span>
                        <span className="absolute right-2 top-2 rounded-lg border border-white/10 bg-black/65 p-1.5">
                            {item.media_type === "tv" ? <Tv className="h-3 w-3 text-cyan-300" /> : <Clapperboard className="h-3 w-3 text-red-500" />}
                        </span>
                        <button disabled={added} onClick={() => onAdd(item)} className={`absolute bottom-2.5 right-2.5 z-10 flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-black transition ${added ? "bg-emerald-400 text-black" : "bg-gradient-to-br from-amber-300 to-orange-500 text-black hover:scale-110"}`}>
                            {added ? <>
                                <Check className="h-4 w-4" />
                                <span className="ml-1 hidden sm:inline">Added</span>
                            </> : <Plus className="h-4 w-4" />}
                        </button>
                        <div className="absolute inset-x-0 bottom-0 p-3 pr-12">
                            <p className="line-clamp-2 text-xs font-black leading-tight">
                                {name}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[9px] uppercase tracking-wider text-zinc-400">
                                <span>
                                    {yearOf(item.release_date || item.first_air_date)}
                                </span>
                                <span>·</span>
                                <RuntimeText id={item.id} type={item.media_type} initial={item.runtimeMinutes || 0} />
                            </p>
                        </div>
                    </div>
                </article>;
            })}
        </div>
    </section>;
};

const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia(query).matches : false,
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handleChange = () => setMatches(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener("change", handleChange);

        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [query]);

    return matches;
};

const PreferredBackdropPicker = ({
    folderId,
    items,
    value,
    onChange,
}: {
    folderId: string;
    items: ListItem[];
    value: string | null;
    onChange: (value: string | null) => void;
}) => {
    const backdrops = useMemo(
        () => items.filter((item) => Boolean(item.backdrop)),
        [items],
    );

    return (
        <div>
            <span className="text-xs font-bold text-zinc-400">Preferred backdrop</span>
            <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className={`relative aspect-video rounded-xl border bg-zinc-900 ${value === null
                            ? "border-amber-400 ring-2 ring-amber-400/30"
                            : "border-white/10"
                            }`}
                    >
                        <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-500">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-[8px] uppercase">Automatic</span>
                        </div>

                        {value === null && (
                            <span className="absolute right-1 top-1 rounded-full bg-amber-400 p-.5 text-black">
                                <Check className="h-3 w-3" />
                            </span>
                        )}
                    </button>

                    {backdrops.map((item) => (
                        <button
                            type="button"
                            key={itemKey(item)}
                            onClick={() => onChange(item.backdrop)}
                            className={`relative aspect-video overflow-hidden rounded-xl border ${value === item.backdrop
                                ? "border-amber-400 ring-2 ring-amber-400/30"
                                : "border-white/10"
                                }`}
                        >
                            <SmartImage
                                src={imageSource(item.backdrop)}
                                alt={item.title}
                                className="absolute inset-0"
                            />

                            {value === item.backdrop && (
                                <span className="absolute right-1 top-1 rounded-full bg-amber-400 p-.5 text-black">
                                    <Check className="h-3 w-3" />
                                </span>
                            )}

                            <span className="absolute inset-x-1 bottom-1 truncate text-left text-[8px] drop-shadow">
                                {item.title}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MyList: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [folders, setFolders] = useState<CustomFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [newFolderDesc, setNewFolderDesc] = useState("");

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [inputQuery, setInputQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedResult, setSelectedResult] = useState(0);
    const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
    const [contextSuggestions, setContextSuggestions] = useState<SearchResultItem[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);

    const [status, setStatus] = useState<StatusState | null>(null);
    const [undo, setUndo] = useState<UndoState | null>(null);
    const [filterType, setFilterType] = useState<"all" | MediaType>("all");
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>("all");
    const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
    const [sortBy, setSortBy] = useState<SortMode>("default");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [showFilters, setShowFilters] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0, width: 280, maxHeight: 420, placement: "bottom" as "top" | "bottom" });
    const [searchQuery, setSearchQuery] = useState("");
    const [isListSearchFocused, setIsListSearchFocused] = useState(false);
    const [showInsights, setShowInsights] = useState(false);
    const [watchlistKeys, setWatchlistKeys] = useState<Set<string>>(new Set());
    const [watchlistDocIds, setWatchlistDocIds] = useState<Map<string, string>>(new Map());
    const [watchHistory, setWatchHistory] = useState<Set<string>>(new Set());
    const [historyDocIds, setHistoryDocIds] = useState<Map<string, string>>(new Map());
    const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
    const [favoriteDocIds, setFavoriteDocIds] = useState<Map<string, string>>(new Map());
    const [userRatings, setUserRatings] = useState<Map<string, number>>(new Map());
    const [actionItem, setActionItem] = useState<ListItem | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [manageListItems, setManageListItems] = useState<ListItem[]>([]);
    const [quickPeekItem, setQuickPeekItem] = useState<ListItem | null>(null);
    const [quickPeekTrailerKey, setQuickPeekTrailerKey] = useState<string | null>(null);
    const [quickPeekTrailerLoading, setQuickPeekTrailerLoading] = useState(false);
    const [showRoulette, setShowRoulette] = useState(false);
    const [smartEnrichment, setSmartEnrichment] = useState<Map<string, DetailsData>>(new Map());
    const [derivedAccent, setDerivedAccent] = useState("#f59e0b");
    const [newFolderSmart, setNewFolderSmart] = useState(false);
    const [newSmartRules, setNewSmartRules] = useState<SmartRules>({});
    const [createStep, setCreateStep] = useState<"templates" | "form">("templates");
    const [landingSearchQuery, setLandingSearchQuery] = useState("");
    const [recentFolderTouches, setRecentFolderTouches] = useState<Record<string, number>>({});
    const [mobileCardActionId, setMobileCardActionId] = useState<string | null>(null);
    const [commandOpen, setCommandOpen] = useState(false);
    const [commandQuery, setCommandQuery] = useState("");
    const [commandIndex, setCommandIndex] = useState(0);
    const [crossListDragItems, setCrossListDragItems] = useState<ListItem[]>([]);
    const [watchHistoryTimes, setWatchHistoryTimes] = useState<Map<string, number>>(new Map());

    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editCover, setEditCover] = useState<string | null>(null);
    const [editCoverMode, setEditCoverMode] = useState<CoverMode>("auto");
    const [editSmartList, setEditSmartList] = useState(false);
    const [editSmartRules, setEditSmartRules] = useState<SmartRules>({});
    const [editAccent, setEditAccent] = useState<AccentId>("auto");
    const [menuId, setMenuId] = useState<string | null>(null);
    const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
    const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
    const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);

    const addInputRef = useRef<HTMLInputElement>(null);
    const sortButtonRef = useRef<HTMLButtonElement>(null);
    const isMobileControls = useMediaQuery("(max-width: 639px)");

    const updateSortMenuPosition = () => {
        if (isMobileControls || typeof window === "undefined") return;
        const rect = sortButtonRef.current?.getBoundingClientRect();
        if (!rect) return;

        const viewportPadding = 12;
        const gap = 8;
        const width = Math.min(304, window.innerWidth - viewportPadding * 2);
        const desiredHeight = 420;
        const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - gap);
        const spaceAbove = Math.max(0, rect.top - viewportPadding - gap);
        const placement: "top" | "bottom" = spaceBelow >= 300 || spaceBelow >= spaceAbove ? "bottom" : "top";
        const available = placement === "bottom" ? spaceBelow : spaceAbove;
        const maxHeight = Math.max(220, Math.min(desiredHeight, available));
        const left = Math.max(
            viewportPadding,
            Math.min(rect.right - width, window.innerWidth - width - viewportPadding),
        );
        const top = placement === "bottom"
            ? rect.bottom + gap
            : Math.max(viewportPadding, rect.top - maxHeight - gap);

        setSortMenuPosition({ top, left, width, maxHeight, placement });
    };
    const itemUnsubs = useRef(new Map<string, () => void>());
    const legacyMigrating = useRef(new Set<string>());
    const itemCreateTimesRef = useRef(new Map<string, string>());
    const longPressTimerRef = useRef<number | null>(null);
    const longPressTriggeredRef = useRef(false);
    const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
    const landingSwipeStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
    const landingSwipeTriggeredRef = useRef(false);

    useEffect(() => {
        if (!showSortMenu || isMobileControls) return;
        updateSortMenuPosition();
        const syncPosition = () => updateSortMenuPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        return () => {
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
        };
    }, [showSortMenu, isMobileControls]);

    const folderPath = (id: string) => `users/${user!.uid}/customWatchlists/${id}`;
    const itemsPath = (id: string) => `${folderPath(id)}/items`;
    const recentStorageKey = `${RECENT_LISTS_KEY}:${user?.uid || "guest"}`;

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const parsed = JSON.parse(window.localStorage.getItem(recentStorageKey) || "{}");
            setRecentFolderTouches(parsed && typeof parsed === "object" ? parsed : {});
        } catch { setRecentFolderTouches({}); }
    }, [recentStorageKey]);

    const rememberFolderInteraction = (id: string) => {
        const next = { ...recentFolderTouches, [id]: Date.now() };
        setRecentFolderTouches(next);
        try { window.localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch { }
    };

    const fetchListItemCreateTimes = async (folderId: string) => {
        if (!user?.uid) return itemCreateTimesRef.current;
        const projectId = db.app.options.projectId;
        const getIdToken = (user as any)?.getIdToken;
        if (!projectId || typeof getIdToken !== "function") return itemCreateTimesRef.current;
        try {
            const token = await getIdToken.call(user);
            let pageToken = "";
            const next = new Map(itemCreateTimesRef.current);
            do {
                const url = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(user.uid)}/customWatchlists/${encodeURIComponent(folderId)}/items`);
                url.searchParams.set("pageSize", "1000");
                if (pageToken) url.searchParams.set("pageToken", pageToken);
                const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
                if (!response.ok) break;
                const payload = await response.json();
                const documents = Array.isArray(payload.documents) ? payload.documents : [];
                documents.forEach((document: any) => {
                    const id = String(document?.name || "").split("/").pop() || "";
                    if (id && document?.createTime) next.set(`${folderId}/${id}`, document.createTime);
                });
                pageToken = String(payload.nextPageToken || "");
            } while (pageToken);
            itemCreateTimesRef.current = next;
            return next;
        } catch {
            return itemCreateTimesRef.current;
        }
    };

    const orderedFolders = useMemo(
        () =>
            [...folders].sort(
                (a, b) =>
                    Number(Boolean(b.pinned)) -
                    Number(Boolean(a.pinned)) +
                    (Number(a.order) || 0) -
                    (Number(b.order) || 0),
            ),
        [folders],
    );

    const activeFolder = folders.find((folder) => folder.id === activeFolderId);
    const editingFolder = folders.find((folder) => folder.id === editingFolderId);
    const folderToDelete = folders.find((folder) => folder.id === deleteFolderId);
    const mobileCardActionFolder = folders.find((folder) => folder.id === mobileCardActionId) || null;

    const baseSmartSourceItems = useMemo(() => {
        const unique = new Map<string, ListItem>();
        folders.filter(folder => !folder.smartList && !folder.archived).forEach(folder => {
            folder.items.forEach(item => {
                const key = itemKey(item);
                const current = unique.get(key);
                const currentScore = current ? Number(Boolean(current.poster)) + Number(Boolean(current.backdrop)) + Number(Boolean(current.genres?.length)) + Number(Boolean(current.providers?.length)) : -1;
                const nextScore = Number(Boolean(item.poster)) + Number(Boolean(item.backdrop)) + Number(Boolean(item.genres?.length)) + Number(Boolean(item.providers?.length));
                const shouldReplace = !current || nextScore > currentScore || (nextScore === currentScore && timestampToMillis(item.addedAt) > timestampToMillis(current.addedAt));
                if (shouldReplace) unique.set(key, item);
            });
        });
        return [...unique.values()];
    }, [folders]);

    const smartSourceItems = useMemo(() => baseSmartSourceItems.map(item => {
        const details = smartEnrichment.get(itemKey(item));
        if (!details) return item;
        return {
            ...item,
            poster: item.poster || details.poster,
            backdrop: item.backdrop || details.backdrop,
            runtimeMinutes: item.runtimeMinutes || details.runtimeMinutes,
            genres: item.genres?.length ? item.genres : details.genres,
            providers: item.providers?.length ? item.providers : details.providers,
            voteAverage: item.voteAverage || details.voteAverage,
            releaseYear: item.releaseYear || details.releaseYear,
            providersFetched: true,
        };
    }), [baseSmartSourceItems, smartEnrichment]);

    const getSmartFolderItems = (folder: CustomFolder) => {
        if (!folder.smartList) return folder.items;
        const rules = folder.smartRules || {};
        return smartSourceItems.filter(item => {
            const key = itemKey(item);
            if (rules.mediaType && rules.mediaType !== "all" && item.type !== rules.mediaType) return false;
            if (rules.genre && !(item.genres || []).some(genre => genre.toLowerCase() === rules.genre!.toLowerCase())) return false;
            if (rules.minRating && item.voteAverage < rules.minRating) return false;
            if (rules.maxRuntimeMinutes && (!item.runtimeMinutes || item.runtimeMinutes > rules.maxRuntimeMinutes)) return false;
            if (rules.provider && !(item.providers || []).some(provider => provider.name.toLowerCase().includes(rules.provider!.toLowerCase()))) return false;
            if (!releaseMatches(item, rules.release)) return false;
            if (rules.unwatchedOnly && watchHistory.has(key)) return false;
            if (rules.favoriteOnly && !favoriteKeys.has(key)) return false;
            if (rules.recentDays) {
                const added = timestampToMillis(item.addedAt);
                if (!added || added < Date.now() - rules.recentDays * 86400000) return false;
            }
            return true;
        });
    };

    const activeItems = useMemo(() => activeFolder ? getSmartFolderItems(activeFolder) : [], [activeFolder, smartSourceItems, watchHistory, favoriteKeys]);
    const activeDisplayFolder = activeFolder ? { ...activeFolder, items: activeItems } : null;
    const activeStats = useMemo(() => getStats(activeItems), [activeItems]);
    const watchedCount = useMemo(() => activeItems.filter(item => watchHistory.has(itemKey(item))).length, [activeItems, watchHistory]);
    const completionPct = activeItems.length ? Math.round((watchedCount / activeItems.length) * 100) : 0;

    const availableGenres = useMemo(
        () => Array.from(new Set(activeItems.flatMap((item) => item.genres || []))).sort(),
        [activeItems],
    );

    const allLibraryGenres = useMemo(() => Array.from(new Set(smartSourceItems.flatMap(item => item.genres || []))).sort(), [smartSourceItems]);

    const activeFilterCount =
        (filterType !== "all" ? 1 : 0) +
        selectedGenres.length +
        (statusFilter !== "all" ? 1 : 0) +
        (releaseFilter !== "all" ? 1 : 0) +
        (ratingFilter !== "all" ? 1 : 0) +
        (sortBy !== "default" ? 1 : 0) +
        (searchQuery.trim() ? 1 : 0);

    const canReorder =
        !activeFolder?.smartList &&
        sortBy === "custom" &&
        filterType === "all" &&
        selectedGenres.length === 0 &&
        statusFilter === "all" &&
        releaseFilter === "all" &&
        ratingFilter === "all" &&
        !searchQuery.trim();

    const filteredItems = useMemo(() => {
        const queryText = searchQuery.trim().toLowerCase();
        const ratingFloor = ratingFilter === "8+" ? 8 : ratingFilter === "7+" ? 7 : ratingFilter === "6+" ? 6 : 0;

        const items = activeItems.filter((item) => {
            const key = itemKey(item);
            const year = releaseYearNumber(item);
            const matchesType = filterType === "all" || item.type === filterType;
            const matchesSearch = !queryText || item.title.toLowerCase().includes(queryText);
            const matchesGenre = selectedGenres.length === 0 || selectedGenres.some(genre => item.genres?.includes(genre));
            const matchesStatus =
                statusFilter === "all" ||
                (statusFilter === "unwatched" && !watchHistory.has(key)) ||
                (statusFilter === "watched" && watchHistory.has(key)) ||
                (statusFilter === "rated" && userRatings.has(key)) ||
                (statusFilter === "watchlist" && watchlistKeys.has(key));
            const matchesRelease =
                releaseFilter === "all" ||
                (releaseFilter === "upcoming" && isUpcoming(item)) ||
                (releaseFilter === "2020s" && year >= 2020) ||
                (releaseFilter === "2010s" && year >= 2010 && year <= 2019) ||
                (releaseFilter === "2000s" && year >= 2000 && year <= 2009) ||
                (releaseFilter === "older" && year > 0 && year < 2000);
            const matchesRating = ratingFilter === "all" || item.voteAverage >= ratingFloor;
            return matchesType && matchesSearch && matchesGenre && matchesStatus && matchesRelease && matchesRating;
        });

        return [...items].sort((a, b) => {
            if (sortBy === "rating") return b.voteAverage - a.voteAverage;
            if (sortBy === "runtime") return (b.runtimeMinutes || 0) - (a.runtimeMinutes || 0);
            if (sortBy === "release-desc") return releaseMillis(b) - releaseMillis(a);
            if (sortBy === "release-asc") return releaseMillis(a) - releaseMillis(b);
            if (sortBy === "added-asc") return timestampToMillis(a.addedAt) - timestampToMillis(b.addedAt);
            if (sortBy === "az") return a.title.localeCompare(b.title);
            if (sortBy === "custom") return (a.order || 0) - (b.order || 0);
            return (timestampToMillis(b.addedAt) - timestampToMillis(a.addedAt)) || ((a.order || 0) - (b.order || 0));
        });
    }, [activeItems, filterType, selectedGenres, statusFilter, releaseFilter, ratingFilter, searchQuery, sortBy, watchHistory, userRatings, watchlistKeys]);

    const existingKeys = useMemo(
        () => new Set((activeFolder?.items || []).map(itemKey)),
        [activeFolder],
    );
    const selectedItems = useMemo(() => activeItems.filter(item => selectedKeys.has(itemKey(item))), [activeItems, selectedKeys]);
    const rouletteItems = useMemo(() => filteredItems.map(item => ({
        id: itemKey(item), movieId: item.id, mediaType: item.type, posterPath: item.poster || "", title: item.title, vote_average: item.voteAverage,
        releaseDate: item.releaseYear, first_air_date: item.type === "tv" ? item.releaseYear : undefined, genres: item.genres || [], runtime: item.runtimeMinutes || 0,
        overview: item.overview, isWatched: watchHistory.has(itemKey(item)),
    })), [filteredItems, watchHistory]);

    const folderActivity = useMemo(() => {
        const result = new Map<string, { activityTime: number; latestAdded: number; latestWatch: number; addedThisWeek: number; label: string; watched: number; completion: number }>();
        const weekAgo = Date.now() - 7 * 86400000;
        folders.forEach(folder => {
            const items = getSmartFolderItems(folder);
            const addedTimes = items.map(item => timestampToMillis(item.addedAt)).filter(Boolean);
            const latestAdded = addedTimes.length ? Math.max(...addedTimes) : 0;
            const latestWatch = items.reduce((latest, item) => Math.max(latest, watchHistoryTimes.get(itemKey(item)) || 0), 0);
            const addedThisWeek = items.filter(item => timestampToMillis(item.addedAt) >= weekAgo).length;
            const watched = items.filter(item => watchHistory.has(itemKey(item))).length;
            const completion = items.length ? Math.round((watched / items.length) * 100) : 0;
            const folderUpdated = timestampToMillis(folder.updatedAt);
            const touched = recentFolderTouches[folder.id] || 0;
            const activityTime = Math.max(latestAdded, latestWatch, folderUpdated, touched);
            let label = activityTime ? `Updated ${formatRelativeTime(activityTime)}` : "No recent activity";
            if (addedThisWeek > 0) label = `${addedThisWeek} ${addedThisWeek === 1 ? "title" : "titles"} added this week`;
            else if (latestWatch) label = `Last watched ${formatRelativeTime(latestWatch)}`;
            result.set(folder.id, { activityTime, latestAdded, latestWatch, addedThisWeek, label, watched, completion });
        });
        return result;
    }, [folders, watchHistory, watchHistoryTimes, recentFolderTouches, smartSourceItems, favoriteKeys]);

    const overlapInsights = useMemo(() => {
        const manual = folders.filter(folder => !folder.smartList && !folder.archived);
        const keySets = new Map<string, Set<string>>(manual.map(folder => [folder.id, new Set<string>(folder.items.map(itemKey))] as [string, Set<string>]));
        const keyUse = new Map<string, number>();
        manual.forEach(folder => folder.items.forEach(item => keyUse.set(itemKey(item), (keyUse.get(itemKey(item)) || 0) + 1)));
        const result = new Map<string, { count: number; withName: string; multiListCount: number }>();
        manual.forEach(folder => {
            const own = keySets.get(folder.id) || new Set<string>();
            let count = 0, withName = "";
            manual.forEach(other => {
                if (other.id === folder.id) return;
                const otherSet = keySets.get(other.id) || new Set<string>();
                let overlap = 0;
                own.forEach(key => { if (otherSet.has(key)) overlap += 1; });
                if (overlap > count) { count = overlap; withName = other.name; }
            });
            const multiListCount = [...own].filter(key => (keyUse.get(key) || 0) >= 3).length;
            result.set(folder.id, { count, withName, multiListCount });
        });
        return result;
    }, [folders]);

    const activeLandingFolders = useMemo(() => folders.filter(folder => !folder.archived), [folders]);
    const archivedFolders = useMemo(() => folders.filter(folder => folder.archived), [folders]);
    const pinnedFolders = useMemo(() => activeLandingFolders.filter(folder => folder.pinned), [activeLandingFolders]);
    const regularFolders = useMemo(() => activeLandingFolders, [activeLandingFolders]);
    const recentlyUpdatedFolders = useMemo(() => [...activeLandingFolders].sort((a, b) => (folderActivity.get(b.id)?.activityTime || 0) - (folderActivity.get(a.id)?.activityTime || 0)).slice(0, 4), [activeLandingFolders, folderActivity]);

    const landingSearchGroups = useMemo(() => {
        const query = landingSearchQuery.trim().toLowerCase();
        if (!query) return [];
        return folders.map(folder => {
            const items = getSmartFolderItems(folder);
            const nameMatch = folder.name.toLowerCase().includes(query) || folder.description.toLowerCase().includes(query);
            const matches = items.filter(item => item.title.toLowerCase().includes(query));
            return { folder, nameMatch, matches };
        }).filter(group => group.nameMatch || group.matches.length);
    }, [landingSearchQuery, folders, smartSourceItems, watchHistory, favoriteKeys]);

    const emptyFilterLabel = useMemo(() => {
        const parts: string[] = [];
        if (statusFilter === "unwatched") parts.push("unwatched");
        if (statusFilter === "watched") parts.push("watched");
        if (selectedGenres.length) parts.push(selectedGenres.slice(0, 2).join(" / "));
        if (filterType === "movie") parts.push("movies");
        if (filterType === "tv") parts.push("series");
        if (ratingFilter !== "all") parts.push(`rated ${ratingFilter}`);
        if (releaseFilter !== "all") parts.push(releaseFilter === "older" ? "from before 2000" : `from ${releaseFilter}`);
        return parts.length ? `No ${parts.join(" ")}` : "No titles match these filters";
    }, [statusFilter, selectedGenres, filterType, ratingFilter, releaseFilter]);

    const migrateLegacy = async (folderId: string, legacy: ListItem[]) => {
        if (!user?.uid || !legacy.length || legacyMigrating.current.has(folderId)) return;
        legacyMigrating.current.add(folderId);
        try {
            for (let start = 0;
                start < legacy.length;
                start += 400) {
                const batch = writeBatch(db);
                legacy.slice(start, start + 400).forEach((item, i) => batch.set(doc(db, itemsPath(folderId), itemKey(item)), { ...item, order: item.order ?? start + i }, { merge: true }));
                await batch.commit();
            } await updateDoc(doc(db, folderPath(folderId)), { items: deleteField(), storageVersion: 2 });
        } catch { } finally {
            legacyMigrating.current.delete(folderId);
        }
    };

    useEffect(() => {
        if (!user?.uid) {
            setFolders([]);
            setLoading(false);
            return;
        } const meta = new Map<string, Omit<CustomFolder, "items"> & {
            legacyItems: ListItem[];
        }>(), itemMap = new Map<string, ListItem[]>();
        const emit = () => setFolders([...meta.values()].map(m => {
            const { id, legacyItems, ...rest } = m;
            return { id, ...rest, items: itemMap.has(id) ? itemMap.get(id)! : legacyItems };
        }));
        const root = collection(db, `users/${user.uid}/customWatchlists`);
        const rootUnsub = onSnapshot(root, snapshot => {
            const live = new Set<string>();
            snapshot.docs.forEach((sd, index) => {
                const data = sd.data(), id = sd.id, legacy = Array.isArray(data.items) ? data.items.map((x: any, i: number) => normalizeItem(x, i)) : [];
                live.add(id);
                meta.set(id, { id, name: data.name || "Untitled List", description: data.description || "", coverImage: data.coverImage || null, coverMode: ["auto", "single", "collage", "rotate"].includes(data.coverMode) ? data.coverMode : "auto", pinned: Boolean(data.pinned), order: Number.isFinite(Number(data.order)) ? Number(data.order) : index, storageVersion: Number(data.storageVersion) || 1, smartList: Boolean(data.smartList), smartRules: data.smartRules || {}, accent: (["auto", "amber", "red", "cyan", "violet", "emerald", "blue"].includes(data.accent) ? data.accent : "auto") as AccentId, archived: Boolean(data.archived), archivedAt: data.archivedAt ?? null, updatedAt: data.updatedAt ?? data.createdAt ?? null, legacyItems: legacy });
                if (!itemUnsubs.current.has(id)) {
                    const unsub = onSnapshot(collection(db, `users/${user.uid}/customWatchlists/${id}/items`), async snap => {
                        const needsCreateTimes = snap.docs.some(d => !storedAddedAt(d.data()) && !itemCreateTimesRef.current.has(`${id}/${d.id}`));
                        const createTimes = needsCreateTimes ? await fetchListItemCreateTimes(id) : itemCreateTimesRef.current;
                        itemMap.set(id, snap.docs.map((d, i) => normalizeItem({
                            ...d.data(),
                            addedAt: storedAddedAt(d.data()) ?? createTimes.get(`${id}/${d.id}`) ?? null,
                        }, i)).sort((a, b) => (a.order || 0) - (b.order || 0)));
                        emit();
                    });
                    itemUnsubs.current.set(id, unsub);
                } if (legacy.length && data.storageVersion !== 2) migrateLegacy(id, legacy);
            });
            [...itemUnsubs.current.entries()].forEach(([id, unsub]) => {
                if (!live.has(id)) {
                    unsub();
                    itemUnsubs.current.delete(id);
                    itemMap.delete(id);
                    meta.delete(id);
                }
            });
            emit();
            setLoading(false);
        }, () => {
            setStatus({ type: "error", message: "Failed to load your lists." });
            setLoading(false);
        });
        return () => {
            rootUnsub();
            itemUnsubs.current.forEach(u => u());
            itemUnsubs.current.clear();
        };
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) {
            setWatchlistKeys(new Set());
            setWatchlistDocIds(new Map());
            return;
        }
        return onSnapshot(collection(db, `users/${user.uid}/watchlist`), snapshot => {
            const keys = new Set<string>();
            const ids = new Map<string, string>();
            snapshot.docs.forEach(entry => {
                const key = storedMediaKey(entry.data(), entry.id);
                if (key) {
                    keys.add(key);
                    ids.set(key, entry.id);
                }
            });
            setWatchlistKeys(keys);
            setWatchlistDocIds(ids);
        }, () => {
            setWatchlistKeys(new Set());
            setWatchlistDocIds(new Map());
        });
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) {
            setWatchHistory(new Set());
            setHistoryDocIds(new Map());
            setWatchHistoryTimes(new Map());
            return;
        }
        return onSnapshot(collection(db, `users/${user.uid}/history`), snapshot => {
            const keys = new Set<string>();
            const ids = new Map<string, string>();
            const times = new Map<string, number>();
            snapshot.docs.forEach(entry => {
                const data = entry.data();
                const key = storedMediaKey(data, entry.id);
                if (key) {
                    keys.add(key);
                    ids.set(key, entry.id);
                    const watchedValues = Array.isArray(data.watchedDates) ? data.watchedDates : [];
                    const candidates = [data.watchedDate, data.timestamp, data.createdAt, ...watchedValues].map(timestampToMillis).filter(Boolean);
                    const latest = candidates.length ? Math.max(...candidates) : 0;
                    if (latest) times.set(key, latest);
                }
            });
            setWatchHistory(keys);
            setHistoryDocIds(ids);
            setWatchHistoryTimes(times);
        }, () => {
            setWatchHistory(new Set());
            setHistoryDocIds(new Map());
            setWatchHistoryTimes(new Map());
        });
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) {
            setFavoriteKeys(new Set());
            setFavoriteDocIds(new Map());
            return;
        }
        return onSnapshot(collection(db, `users/${user.uid}/favouriteMedia`), snapshot => {
            const keys = new Set<string>();
            const ids = new Map<string, string>();
            snapshot.docs.forEach(entry => {
                const key = storedMediaKey(entry.data(), entry.id);
                if (key) {
                    keys.add(key);
                    ids.set(key, entry.id);
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
            setUserRatings(new Map());
            return;
        }
        return onSnapshot(collection(db, `users/${user.uid}/ratings`), snapshot => {
            const next = new Map<string, number>();
            snapshot.docs.forEach(entry => {
                const data = entry.data();
                const key = storedMediaKey(data, entry.id);
                const rating = data.rating === null || data.rating === undefined ? NaN : Number(data.rating);
                if (key && Number.isFinite(rating)) next.set(key, rating);
            });
            setUserRatings(next);
        }, () => setUserRatings(new Map()));
    }, [user?.uid]);

    useEffect(() => {
        if (!folders.some(folder => folder.smartList) || !baseSmartSourceItems.length) return;
        const missing = baseSmartSourceItems.filter(item => {
            const cached = smartEnrichment.get(itemKey(item));
            return !cached && (!item.runtimeMinutes || !item.genres?.length || !item.providersFetched);
        }).slice(0, 80);
        if (!missing.length) return;
        let cancelled = false;
        Promise.all(missing.map(async item => [itemKey(item), await fetchDetails(item.id, item.type)] as const)).then(entries => {
            if (cancelled) return;
            setSmartEnrichment(current => {
                const next = new Map(current);
                entries.forEach(([key, details]) => next.set(key, details));
                return next;
            });
        });
        return () => { cancelled = true; };
    }, [folders, baseSmartSourceItems]);

    useEffect(() => {
        if (!activeDisplayFolder) { setDerivedAccent("#f59e0b"); return; }
        if (activeDisplayFolder.accent && activeDisplayFolder.accent !== "auto") {
            setDerivedAccent(ACCENTS[activeDisplayFolder.accent].color);
            return;
        }
        const src = getCoverCandidates(activeDisplayFolder)[0];
        if (!src) { setDerivedAccent("#f59e0b"); return; }
        let cancelled = false;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => {
            if (cancelled) return;
            try {
                const canvas = document.createElement("canvas");
                canvas.width = 24; canvas.height = 24;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, 24, 24);
                const data = ctx.getImageData(0, 0, 24, 24).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 16) {
                    const rr = data[i], gg = data[i + 1], bb = data[i + 2];
                    const brightness = rr + gg + bb;
                    if (brightness < 90 || brightness > 690) continue;
                    r += rr; g += gg; b += bb; count += 1;
                }
                if (!count) return;
                const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
                setDerivedAccent(`#${toHex(r / count)}${toHex(g / count)}${toHex(b / count)}`);
            } catch { setDerivedAccent("#f59e0b"); }
        };
        img.onerror = () => !cancelled && setDerivedAccent("#f59e0b");
        return () => { cancelled = true; };
    }, [activeFolder?.id, activeFolder?.accent, activeFolder?.coverImage, activeItems.length]);

    useEffect(() => {
        setSelectedKeys(new Set());
        setSelectionMode(false);
        setQuickPeekItem(null);
        setManageListItems([]);
    }, [activeFolderId]);
    useEffect(() => {
        if (activeFolder?.smartList && sortBy === "custom") setSortBy("default");
    }, [activeFolder?.smartList, sortBy]);

    useEffect(() => {
        if (!quickPeekItem) {
            setQuickPeekTrailerKey(null);
            setQuickPeekTrailerLoading(false);
            return;
        }
        let cancelled = false;
        setQuickPeekTrailerLoading(true);
        setQuickPeekTrailerKey(null);
        axios.get(`${TMDB_BASE}/${quickPeekItem.type}/${quickPeekItem.id}/videos`, { params: { api_key: API_KEY, language: "en-US" } })
            .then(({ data }) => {
                if (cancelled) return;
                const videos = Array.isArray(data?.results) ? data.results.filter((video: any) => video.site === "YouTube" && video.key) : [];
                const trailer = videos.find((video: any) => video.type === "Trailer" && video.official) || videos.find((video: any) => video.type === "Trailer") || videos.find((video: any) => video.type === "Teaser") || videos[0];
                setQuickPeekTrailerKey(trailer?.key || null);
            })
            .catch(() => !cancelled && setQuickPeekTrailerKey(null))
            .finally(() => !cancelled && setQuickPeekTrailerLoading(false));
        return () => { cancelled = true; };
    }, [quickPeekItem?.id, quickPeekItem?.type]);

    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get("list");
        if (id && folders.some(f => f.id === id)) setActiveFolderId(id);
    }, [folders.length]);
    useEffect(() => {
        if (!undo) return;
        const t = window.setTimeout(() => setUndo(null), 5000);
        return () => clearTimeout(t);
    }, [undo]);
    useEffect(() => {
        if (isAddOpen) setTimeout(() => addInputRef.current?.focus(), 80);
    }, [isAddOpen]);
    useEffect(() => {
        if (!inputQuery.trim()) {
            setSearchResults([]);
            setSelectedResult(0);
            return;
        } const t = window.setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data } = await axios.get(`${TMDB_BASE}/search/multi`, { params: { api_key: API_KEY, query: inputQuery.trim(), language: "en-US" } });
                setSearchResults((data.results || []).filter((x: any) => x.media_type === "movie" || x.media_type === "tv").slice(0, 14).map((x: any) => normalizeSearch(x)));
                setSelectedResult(0);
            } catch {
                setStatus({ type: "error", message: "Search failed. Please try again." });
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [inputQuery]);
    useEffect(() => {
        if (!activeFolder) return;
        if (activeFolder.smartList) {
            setSuggestions([]);
            setContextSuggestions([]);
            setSuggestionsLoading(false);
            return;
        }
        if (!activeItems.length) {
            setContextSuggestions([]);
            setSuggestionsLoading(true);
            fetchPopular().then(setSuggestions).finally(() => setSuggestionsLoading(false));
            return;
        } setSuggestions([]);
        const seeds = [...activeItems].sort((a, b) => Number(b.genres?.includes(activeStats.topGenre)) - Number(a.genres?.includes(activeStats.topGenre))).slice(0, 3), cacheKey = seeds.map(itemKey).join("|");
        if (!recommendationCache.has(cacheKey)) recommendationCache.set(cacheKey, (async () => {
            const sets = await Promise.all(seeds.map(async seed => {
                try {
                    const { data } = await axios.get(`${TMDB_BASE}/${seed.type}/${seed.id}/recommendations`, { params: { api_key: API_KEY, language: "en-US", page: 1 } });
                    return (data.results || []).slice(0, 8).map((x: any) => normalizeSearch(x, seed.type));
                } catch {
                    return [];
                }
            }));
            const seen = new Set<string>();
            return sets.flat().filter(x => {
                const k = itemKey({ id: x.id, type: x.media_type });
                if (existingKeys.has(k) || seen.has(k) || !x.poster_path) return false;
                seen.add(k);
                return true;
            }).slice(0, 18);
        })());
        recommendationCache.get(cacheKey)!.then(setContextSuggestions);
    }, [activeFolder?.id, activeFolder?.smartList, activeItems.length, activeStats.topGenre]);
    useEffect(() => {
        if (!activeFolder || activeFolder.smartList || !user?.uid) return;
        const missing = activeFolder.items.filter(i => !i.runtimeMinutes || !i.poster || !i.backdrop || !i.genres?.length || !i.providersFetched).slice(0, 12);
        if (!missing.length) return;
        let cancelled = false;
        (async () => {
            const details = await Promise.all(missing.map(async item => ({ item, details: await fetchDetails(item.id, item.type) })));
            if (cancelled) return;
            await Promise.all(details.map(({ item, details }) => updateDoc(doc(db, itemsPath(activeFolder.id), itemKey(item)), {
                poster: details.poster || item.poster || null,
                backdrop: details.backdrop || item.backdrop || null,
                runtimeMinutes: details.runtimeMinutes || item.runtimeMinutes || 0,
                genres: details.genres.length ? details.genres : item.genres || [],
                providers: details.providers,
                voteAverage: item.voteAverage || details.voteAverage,
                releaseYear: item.releaseYear || details.releaseYear,
                providersFetched: true,
            }).catch(() => null)));
        })();
        return () => {
            cancelled = true;
        };
    }, [activeFolder, user?.uid]);

    const updateFolder = (id: string, values: Partial<CustomFolder> | Record<string, any>) => user?.uid ? updateDoc(doc(db, folderPath(id)), values as any) : Promise.resolve();
    const touchFolder = (id: string) => updateFolder(id, { updatedAt: serverTimestamp() }).catch(() => undefined);
    const openFolder = (id: string) => {
        rememberFolderInteraction(id);
        setActiveFolderId(id);
        setMenuId(null);
        const u = new URL(window.location.href);
        u.searchParams.set("list", id);
        window.history.pushState({}, "", u);
    };
    const closeFolder = () => {
        setActiveFolderId(null);
        setStatus(null);
        setSearchQuery("");
        setFilterType("all");
        setSelectedGenres([]);
        setStatusFilter("all");
        setReleaseFilter("all");
        setRatingFilter("all");
        setSortBy("default");
        setViewMode("grid");
        setShowFilters(false);
        setActionItem(null);
        setShowInsights(false);
        const u = new URL(window.location.href);
        u.searchParams.delete("list");
        window.history.pushState({}, "", u);
    };
    const openCreatePicker = () => {
        setNewFolderName("");
        setNewFolderDesc("");
        setNewFolderSmart(false);
        setNewSmartRules({});
        setCreateStep("templates");
        setIsCreatingFolder(true);
    };
    const chooseCreateTemplate = (template: typeof CREATE_TEMPLATES[number]) => {
        setNewFolderSmart(template.smart);
        setNewSmartRules(template.rules || {});
        setNewFolderName(template.name || "");
        setNewFolderDesc(template.folderDescription || "");
        setCreateStep("form");
    };
    const setFolderArchived = async (folder: CustomFolder, archived: boolean) => {
        try {
            await updateFolder(folder.id, { archived, archivedAt: archived ? serverTimestamp() : null, pinned: archived ? false : folder.pinned, updatedAt: serverTimestamp() });
            setStatus({ type: "success", message: archived ? `${folder.name} archived.` : `${folder.name} restored.` });
        } catch { setStatus({ type: "error", message: archived ? "Failed to archive list." : "Failed to restore list." }); }
    };
    const copyItemsToFolder = async (targetFolder: CustomFolder, items: ListItem[]) => {
        if (!user?.uid || targetFolder.smartList || targetFolder.archived || !items.length) return;
        const existing = new Set(targetFolder.items.map(itemKey));
        const missing = items.filter(item => !existing.has(itemKey(item)));
        if (!missing.length) { setStatus({ type: "success", message: `Already in ${targetFolder.name}.` }); return; }
        const baseOrder = Math.min(0, ...targetFolder.items.map(item => item.order || 0)) - 1;
        try {
            await Promise.all(missing.map((item, index) => setDoc(doc(db, itemsPath(targetFolder.id), itemKey(item)), { ...item, order: baseOrder - index, addedAt: serverTimestamp() }, { merge: true })));
            await touchFolder(targetFolder.id);
            setStatus({ type: "success", message: `Added ${missing.length} ${missing.length === 1 ? "title" : "titles"} to ${targetFolder.name}.` });
        } catch { setStatus({ type: "error", message: "Failed to add titles to that list." }); }
    };
    const beginLandingCardSwipe = (folder: CustomFolder, event: React.PointerEvent) => {
        if (event.pointerType !== "touch") return;
        landingSwipeStartRef.current = { id: folder.id, x: event.clientX, y: event.clientY };
    };
    const endLandingCardSwipe = (folder: CustomFolder, event: React.PointerEvent) => {
        const start = landingSwipeStartRef.current;
        landingSwipeStartRef.current = null;
        if (!start || start.id !== folder.id || event.pointerType !== "touch") return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (dy < -38 && Math.abs(dy) > Math.abs(dx) * 1.15) {
            event.preventDefault();
            event.stopPropagation();
            landingSwipeTriggeredRef.current = true;
            setMobileCardActionId(folder.id);
        }
    };
    const handleCreateFolder = async (e: FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim() || !user?.uid) return;
        const id = Date.now().toString();
        try {
            await setDoc(doc(db, folderPath(id)), { id, name: newFolderName.trim(), description: newFolderDesc.trim(), coverImage: null, coverMode: "auto", pinned: false, order: folders.length, storageVersion: 2, smartList: newFolderSmart, smartRules: newFolderSmart ? newSmartRules : {}, accent: "auto", archived: false, updatedAt: serverTimestamp() });
            setNewFolderName("");
            setNewFolderDesc("");
            setNewFolderSmart(false);
            setNewSmartRules({});
            setCreateStep("templates");
            setIsCreatingFolder(false);
            setStatus({ type: "success", message: "List created." });
        } catch {
            setStatus({ type: "error", message: "Failed to create list." });
        }
    };
    const addItem = async (result: SearchResultItem) => {
        if (!activeFolder || !user?.uid) return;
        if (existingKeys.has(itemKey({ id: result.id, type: result.media_type }))) return;
        const d = await fetchDetails(result.id, result.media_type), minOrder = Math.min(0, ...activeFolder.items.map(i => i.order || 0)) - 1, item: ListItem = { id: result.id, title: result.title || result.name || "Untitled", type: result.media_type, poster: d.poster || posterUrl(result.poster_path) || null, backdrop: d.backdrop || backdropUrl(result.backdrop_path) || null, releaseYear: result.release_date || result.first_air_date || "", overview: result.overview || "No description available.", voteAverage: Number((result.vote_average || 0).toFixed(1)), runtimeMinutes: d.runtimeMinutes, genres: d.genres, order: minOrder, providers: d.providers, providersFetched: true };
        try {
            await setDoc(doc(db, itemsPath(activeFolder.id), itemKey(item)), { ...item, addedAt: serverTimestamp() });
            await touchFolder(activeFolder.id);
            setStatus({ type: "success", message: "Added to list." });
        } catch {
            setStatus({ type: "error", message: "Failed to add title." });
        }
    };
    const removeListItem = async (item: ListItem) => {
        if (!activeFolder) return;
        const folderId = activeFolder.id;
        try {
            await deleteDoc(doc(db, itemsPath(folderId), itemKey(item)));
            await touchFolder(folderId);
            setActionItem(null);
            setUndo({
                message: `Removed ${item.title}`, action: async () => {
                    await setDoc(doc(db, itemsPath(folderId), itemKey(item)), item);
                    setUndo(null);
                }
            });
        } catch {
            setStatus({ type: "error", message: "Failed to remove item." });
        }
    };
    const removeItem = async (e: React.MouseEvent, item: ListItem) => {
        e.preventDefault();
        e.stopPropagation();
        await removeListItem(item);
    };
    const moveItem = async (target: ListItem) => {
        if (!activeFolder || !draggedItemKey || !canReorder) return;
        const items = [...activeFolder.items].sort((a, b) => (a.order || 0) - (b.order || 0)), from = items.findIndex(i => itemKey(i) === draggedItemKey), to = items.findIndex(i => itemKey(i) === itemKey(target));
        if (from < 0 || to < 0 || from === to) return;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        const idx = items.indexOf(moved), prev = items[idx - 1]?.order, next = items[idx + 1]?.order, newOrder = prev == null ? (next ?? 0) - 1 : next == null ? prev + 1 : (prev + next) / 2;
        setDraggedItemKey(null);
        await updateDoc(doc(db, itemsPath(activeFolder.id), itemKey(moved)), { order: newOrder });
    };
    const moveFolder = async (target: CustomFolder) => {
        if (!draggedFolderId || !user?.uid) return;
        const moved = folders.find(f => f.id === draggedFolderId);
        if (!moved || moved.id === target.id) return;
        const same = orderedFolders.filter(f => Boolean(f.pinned) === Boolean(target.pinned) && f.id !== moved.id), to = same.findIndex(f => f.id === target.id);
        same.splice(to < 0 ? same.length : to, 0, moved);
        const idx = same.indexOf(moved), prev = same[idx - 1]?.order, next = same[idx + 1]?.order, newOrder = prev == null ? (next ?? 0) - 1 : next == null ? prev + 1 : (prev + next) / 2;
        setDraggedFolderId(null);
        await updateFolder(moved.id, { order: newOrder, pinned: Boolean(target.pinned) });
    };
    const openEdit = (folder: CustomFolder) => {
        setEditingFolderId(folder.id);
        setEditName(folder.name);
        setEditDescription(folder.description);
        setEditCover(folder.coverImage || null);
        setEditCoverMode(folder.coverMode || "auto");
        setEditSmartList(Boolean(folder.smartList));
        setEditSmartRules(folder.smartRules || {});
        setEditAccent(folder.accent || "auto");
        setMenuId(null);
    };
    const saveFolderDetails = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingFolder || !editName.trim()) return;
        try {
            await updateFolder(editingFolder.id, { name: editName.trim(), description: editDescription.trim(), coverImage: editCover, coverMode: editCoverMode, smartList: editSmartList, smartRules: editSmartList ? editSmartRules : {}, accent: editAccent, updatedAt: serverTimestamp() });
            setEditingFolderId(null);
            setStatus({ type: "success", message: "List updated." });
        } catch {
            setStatus({ type: "error", message: "Failed to update list." });
        }
    };
    const togglePin = async (folder: CustomFolder) => {
        await updateFolder(folder.id, { pinned: !folder.pinned, updatedAt: serverTimestamp() });
        setMenuId(null);
    };
    const duplicateFolder = async (folder: CustomFolder) => {
        if (!user?.uid) return;
        const id = Date.now().toString();
        await setDoc(doc(db, folderPath(id)), { id, name: `${folder.name} Copy`, description: folder.description, coverImage: folder.coverImage || null, coverMode: folder.coverMode || "auto", pinned: false, order: folders.length, storageVersion: 2, smartList: Boolean(folder.smartList), smartRules: folder.smartRules || {}, accent: folder.accent || "auto", archived: false, updatedAt: serverTimestamp() });
        if (!folder.smartList) await Promise.all(folder.items.map((item, i) => setDoc(doc(db, itemsPath(id), itemKey(item)), { ...item, order: i })));
        setMenuId(null);
        setStatus({ type: "success", message: "List duplicated." });
    };
    const shareFolder = async (folder: CustomFolder) => {
        const u = new URL(window.location.href);
        u.searchParams.set("list", folder.id);
        const text = `${folder.name} — ${getSmartFolderItems(folder).length} titles`;
        try {
            if (navigator.share) await navigator.share({ title: folder.name, text, url: u.toString() });
            else await navigator.clipboard.writeText(u.toString());
        } catch { } setMenuId(null);
    };
    const copyLink = async (folder: CustomFolder) => {
        const u = new URL(window.location.href);
        u.searchParams.set("list", folder.id);
        await navigator.clipboard.writeText(u.toString());
        setMenuId(null);
        setStatus({ type: "success", message: "List link copied." });
    };
    const exportFolder = (folder: CustomFolder) => {
        const blob = new Blob([JSON.stringify(folder, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url;
        a.download = `${folder.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "list"}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMenuId(null);
    };
    const deleteFolderDeep = async (folder: CustomFolder) => {
        if (!user?.uid) return;
        const snap = await getDocs(collection(db, itemsPath(folder.id)));
        for (let start = 0;
            start < snap.docs.length;
            start += 400) {
            const batch = writeBatch(db);
            snap.docs.slice(start, start + 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
        } await deleteDoc(doc(db, folderPath(folder.id)));
    };
    const confirmDeleteFolder = async () => {
        if (!folderToDelete) return;
        const snapshot = { ...folderToDelete, items: [...folderToDelete.items] };
        try {
            await deleteFolderDeep(folderToDelete);
            if (activeFolderId === folderToDelete.id) closeFolder();
            setDeleteFolderId(null);
            setUndo({
                message: `Deleted ${snapshot.name}`, action: async () => {
                    await setDoc(doc(db, folderPath(snapshot.id)), { id: snapshot.id, name: snapshot.name, description: snapshot.description, coverImage: snapshot.coverImage || null, coverMode: snapshot.coverMode || "auto", pinned: snapshot.pinned || false, order: snapshot.order || 0, storageVersion: 2, smartList: Boolean(snapshot.smartList), smartRules: snapshot.smartRules || {}, accent: snapshot.accent || "auto", archived: Boolean(snapshot.archived), archivedAt: snapshot.archivedAt || null, updatedAt: serverTimestamp() });
                    if (!snapshot.smartList) await Promise.all(snapshot.items.map(i => setDoc(doc(db, itemsPath(snapshot.id), itemKey(i)), i)));
                    setUndo(null);
                }
            });
        } catch {
            setStatus({ type: "error", message: "Failed to delete list." });
        }
    };
    const toggleWatchlist = async (item: ListItem) => {
        if (!user?.uid) return;
        const key = itemKey(item);
        try {
            const existingId = watchlistDocIds.get(key);
            if (existingId) {
                await deleteDoc(doc(db, `users/${user.uid}/watchlist/${existingId}`));
                setStatus({ type: "success", message: "Removed from watchlist." });
            } else {
                await setDoc(doc(db, `users/${user.uid}/watchlist/${key}`), {
                    movieId: item.id,
                    mediaId: item.id,
                    title: item.title,
                    posterPath: storedPosterPath(item.poster),
                    releaseDate: item.releaseYear || "",
                    first_air_date: item.type === "tv" ? item.releaseYear || "" : "",
                    genres: item.genres || [],
                    mediaType: item.type,
                    addedAt: serverTimestamp(),
                }, { merge: true });
                setStatus({ type: "success", message: "Added to watchlist." });
            }
        } catch {
            setStatus({ type: "error", message: "Failed to update watchlist." });
        }
    };

    const toggleHistory = async (item: ListItem) => {
        if (!user?.uid) return;
        const key = itemKey(item);
        try {
            const existingId = historyDocIds.get(key);
            if (existingId) {
                await deleteDoc(doc(db, `users/${user.uid}/history/${existingId}`));
                setStatus({ type: "success", message: "Removed from history." });
            } else {
                const iso = new Date().toISOString();
                await setDoc(doc(db, `users/${user.uid}/history/${key}`), {
                    movieId: item.id,
                    mediaId: item.id,
                    title: item.title,
                    posterPath: storedPosterPath(item.poster),
                    releaseDate: item.releaseYear || "",
                    genres: item.genres || [],
                    mediaType: item.type,
                    watchedDate: iso,
                    watchedDates: [iso],
                    timestamp: serverTimestamp(),
                }, { merge: true });
                setStatus({ type: "success", message: "Marked as watched." });
            }
        } catch {
            setStatus({ type: "error", message: "Failed to update watch history." });
        }
    };

    const toggleFavorite = async (item: ListItem) => {
        if (!user?.uid) return;
        const key = itemKey(item);
        try {
            const existingId = favoriteDocIds.get(key);
            if (existingId) {
                await deleteDoc(doc(db, `users/${user.uid}/favouriteMedia/${existingId}`));
                setStatus({ type: "success", message: "Removed from favourites." });
            } else {
                await setDoc(doc(db, `users/${user.uid}/favouriteMedia/${key}`), {
                    movieId: item.id,
                    mediaId: item.id,
                    title: item.title,
                    posterPath: storedPosterPath(item.poster),
                    releaseDate: item.releaseYear || "",
                    genres: item.genres || [],
                    mediaType: item.type,
                    timestamp: serverTimestamp(),
                }, { merge: true });
                setStatus({ type: "success", message: "Added to favourites." });
            }
        } catch {
            setStatus({ type: "error", message: "Failed to update favourites." });
        }
    };

    const ensureWatchlist = async (item: ListItem) => {
        if (!user?.uid || watchlistKeys.has(itemKey(item))) return;
        const key = itemKey(item);
        await setDoc(doc(db, `users/${user.uid}/watchlist/${key}`), {
            movieId: item.id, mediaId: item.id, title: item.title, posterPath: storedPosterPath(item.poster),
            releaseDate: item.releaseYear || "", first_air_date: item.type === "tv" ? item.releaseYear || "" : "",
            genres: item.genres || [], mediaType: item.type, addedAt: serverTimestamp(),
        }, { merge: true });
    };

    const ensureHistory = async (item: ListItem) => {
        if (!user?.uid || watchHistory.has(itemKey(item))) return;
        const key = itemKey(item), iso = new Date().toISOString();
        await setDoc(doc(db, `users/${user.uid}/history/${key}`), {
            movieId: item.id, mediaId: item.id, title: item.title, posterPath: storedPosterPath(item.poster), releaseDate: item.releaseYear || "",
            genres: item.genres || [], mediaType: item.type, watchedDate: iso, watchedDates: [iso], timestamp: serverTimestamp(),
        }, { merge: true });
    };

    const ensureFavorite = async (item: ListItem) => {
        if (!user?.uid || favoriteKeys.has(itemKey(item))) return;
        const key = itemKey(item);
        await setDoc(doc(db, `users/${user.uid}/favouriteMedia/${key}`), {
            movieId: item.id, mediaId: item.id, title: item.title, posterPath: storedPosterPath(item.poster), releaseDate: item.releaseYear || "",
            genres: item.genres || [], mediaType: item.type, timestamp: serverTimestamp(),
        }, { merge: true });
    };

    const toggleSelection = (item: ListItem) => {
        const key = itemKey(item);
        setSelectionMode(true);
        setSelectedKeys(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const beginLongPress = (item: ListItem, event: React.PointerEvent) => {
        if (event.pointerType === "mouse") return;
        if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
        longPressTriggeredRef.current = false;
        longPressStartRef.current = { x: event.clientX, y: event.clientY };
        longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            toggleSelection(item);
            if (navigator.vibrate) navigator.vibrate(20);
        }, 460);
    };

    const cancelLongPress = () => {
        if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        longPressStartRef.current = null;
    };
    const moveLongPress = (event: React.PointerEvent) => {
        const start = longPressStartRef.current;
        if (!start) return;
        if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) cancelLongPress();
    };

    const handleTitleOpen = (item: ListItem) => {
        if (longPressTriggeredRef.current) { longPressTriggeredRef.current = false; return; }
        if (selectionMode) { toggleSelection(item); return; }
        navigate(`/${item.type}/${item.id}`);
    };

    const handleQuickPeek = (item: ListItem) => {
        if (longPressTriggeredRef.current) { longPressTriggeredRef.current = false; return; }
        if (selectionMode) { toggleSelection(item); return; }
        setQuickPeekItem(item);
    };

    const toggleManagedFolder = async (folder: CustomFolder) => {
        if (!user?.uid || !manageListItems.length || folder.smartList) return;
        const allInside = manageListItems.every(item => folder.items.some(existing => itemKey(existing) === itemKey(item)));
        try {
            if (allInside) {
                await Promise.all(manageListItems.map(item => deleteDoc(doc(db, itemsPath(folder.id), itemKey(item)))));
                await touchFolder(folder.id);
                setStatus({ type: "success", message: `Removed ${manageListItems.length === 1 ? manageListItems[0].title : `${manageListItems.length} titles`} from ${folder.name}.` });
            } else {
                const baseOrder = Math.min(0, ...folder.items.map(item => item.order || 0)) - 1;
                await Promise.all(manageListItems.filter(item => !folder.items.some(existing => itemKey(existing) === itemKey(item))).map((item, index) =>
                    setDoc(doc(db, itemsPath(folder.id), itemKey(item)), { ...item, order: baseOrder - index, addedAt: serverTimestamp() }, { merge: true })
                ));
                await touchFolder(folder.id);
                setStatus({ type: "success", message: `Added to ${folder.name}.` });
            }
        } catch {
            setStatus({ type: "error", message: "Failed to update list membership." });
        }
    };

    const bulkMarkWatched = async () => {
        if (!selectedItems.length) return;
        try { await Promise.all(selectedItems.map(ensureHistory)); setStatus({ type: "success", message: `Marked ${selectedItems.length} ${selectedItems.length === 1 ? "title" : "titles"} as watched.` }); }
        catch { setStatus({ type: "error", message: "Failed to update watch history." }); }
    };
    const bulkAddWatchlist = async () => {
        if (!selectedItems.length) return;
        try { await Promise.all(selectedItems.map(ensureWatchlist)); setStatus({ type: "success", message: `Added ${selectedItems.length} ${selectedItems.length === 1 ? "title" : "titles"} to watchlist.` }); }
        catch { setStatus({ type: "error", message: "Failed to update watchlist." }); }
    };
    const bulkFavorite = async () => {
        if (!selectedItems.length) return;
        try { await Promise.all(selectedItems.map(ensureFavorite)); setStatus({ type: "success", message: `Favourited ${selectedItems.length} ${selectedItems.length === 1 ? "title" : "titles"}.` }); }
        catch { setStatus({ type: "error", message: "Failed to update favourites." }); }
    };
    const bulkDelete = async () => {
        if (!activeFolder || !selectedItems.length) return;
        if (activeFolder.smartList) { setStatus({ type: "error", message: "Smart List membership is controlled by its rules. Use Manage List to change the source lists." }); return; }
        try {
            await Promise.all(selectedItems.map(item => deleteDoc(doc(db, itemsPath(activeFolder.id), itemKey(item)))));
            await touchFolder(activeFolder.id);
            setStatus({ type: "success", message: `Removed ${selectedItems.length} ${selectedItems.length === 1 ? "title" : "titles"} from this list.` });
            setSelectedKeys(new Set()); setSelectionMode(false);
        } catch { setStatus({ type: "error", message: "Failed to remove selected titles." }); }
    };

    const openAddTitles = () => {
        setInputQuery("");
        setSearchResults([]);
        setSelectedResult(0);
        setIsAddOpen(true);
    };

    const clearFilters = () => {
        setFilterType("all");
        setSelectedGenres([]);
        setStatusFilter("all");
        setReleaseFilter("all");
        setRatingFilter("all");
        setSortBy("default");
        setSearchQuery("");
    };
    const handleSearchKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            setIsAddOpen(false);
            return;
        } if (!searchResults.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedResult(i => (i + 1) % searchResults.length);
        } if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedResult(i => (i - 1 + searchResults.length) % searchResults.length);
        } if (e.key === "Enter") {
            e.preventDefault();
            const result = searchResults[selectedResult];
            if (result && !existingKeys.has(itemKey({ id: result.id, type: result.media_type }))) addItem(result);
        }
    };

    useEffect(() => {
        const handleCommandShortcut = (event: KeyboardEvent) => {
            if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "p") {
                event.preventDefault();
                setCommandOpen(open => !open);
                setCommandQuery("");
            }
            if (event.key === "Escape" && commandOpen) setCommandOpen(false);
        };
        window.addEventListener("keydown", handleCommandShortcut);
        return () => window.removeEventListener("keydown", handleCommandShortcut);
    }, [commandOpen]);

    useEffect(() => { setCommandIndex(0); }, [commandQuery, commandOpen]);

    const commandEntries = (() => {
        const entries: { id: string; label: string; subtitle: string; icon: typeof Search; action: () => void }[] = [];
        entries.push({ id: "new", label: "Create new list", subtitle: "Choose a template or start blank", icon: Plus, action: () => { setCommandOpen(false); openCreatePicker(); } });
        entries.push({ id: "smart", label: "Create Smart List", subtitle: "Build an auto-updating collection", icon: SlidersHorizontal, action: () => { setCommandOpen(false); openCreatePicker(); chooseCreateTemplate(CREATE_TEMPLATES[1]); } });
        const quick = folders.find(folder => folder.name.toLowerCase() === "quick watch" && !folder.archived);
        if (quick && !quick.smartList) entries.push({ id: "quick-add", label: "Add title to Quick Watch", subtitle: "Open title search in Quick Watch", icon: PlusSquare, action: () => { setCommandOpen(false); openFolder(quick.id); window.setTimeout(() => openAddTitles(), 80); } });
        folders.filter(folder => !folder.archived).forEach(folder => entries.push({ id: `open-${folder.id}`, label: `Open ${folder.name}`, subtitle: `${getSmartFolderItems(folder).length} titles${folder.smartList ? " · Smart List" : ""}`, icon: FolderOpen, action: () => { setCommandOpen(false); openFolder(folder.id); } }));
        const seenTitles = new Set<string>();
        folders.filter(folder => !folder.archived).forEach(folder => getSmartFolderItems(folder).forEach(item => {
            const key = item.title.toLowerCase();
            if (seenTitles.has(key) || seenTitles.size >= 50) return;
            seenTitles.add(key);
            entries.push({ id: `find-${folder.id}-${itemKey(item)}`, label: `Find ${item.title}`, subtitle: `In ${folder.name}`, icon: Search, action: () => { setCommandOpen(false); openFolder(folder.id); setSearchQuery(item.title); } });
        }));
        const query = commandQuery.trim().toLowerCase();
        return query ? entries.filter(entry => `${entry.label} ${entry.subtitle}`.toLowerCase().includes(query)).slice(0, 12) : entries.slice(0, 12);
    })();

    const runCommand = (index: number) => commandEntries[index]?.action();

    const renderLandingFolderCard = (folder: CustomFolder, index: number, compact = false) => {
        const displayItems = getSmartFolderItems(folder);
        const displayFolder = { ...folder, items: displayItems };
        const stats = getStats(displayItems);
        const cardAccent = folder.accent && folder.accent !== "auto" ? ACCENTS[folder.accent].color : "#f59e0b";
        const activity = folderActivity.get(folder.id);
        const overlap = overlapInsights.get(folder.id);
        const complete = Boolean(displayItems.length && activity?.completion === 100);
        return <motion.article
            draggable={!folder.archived && !compact}
            onDragStart={() => setDraggedFolderId(folder.id)}
            onDragOver={event => { if (!compact) event.preventDefault(); }}
            onDrop={() => { if (!compact) moveFolder(folder); }}
            onPointerDown={event => beginLandingCardSwipe(folder, event)}
            onPointerUp={event => endLandingCardSwipe(folder, event)}
            onPointerCancel={() => { landingSwipeStartRef.current = null; }}
            key={`${compact ? "recent" : "folder"}-${folder.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 6) * .035 }}
            style={{ "--card-accent": cardAccent } as React.CSSProperties}
            className={`group relative overflow-visible rounded-[26px] transition-all duration-300 ${compact ? "w-[82vw] max-w-[360px] shrink-0 sm:w-auto sm:max-w-none" : "min-h-[326px]"} ${folder.archived ? "opacity-65 hover:opacity-90" : "hover:-translate-y-1"} ${menuId === folder.id ? "z-50" : "z-0"}`}
        >
            <button
                type="button"
                onClick={() => {
                    if (landingSwipeTriggeredRef.current) { landingSwipeTriggeredRef.current = false; return; }
                    openFolder(folder.id);
                }}
                className={`relative block w-full overflow-hidden rounded-[26px] border border-white/[0.085] bg-[linear-gradient(150deg,rgba(17,17,19,.98),rgba(5,5,6,.98))] p-4 text-left shadow-[0_18px_46px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.04)] transition duration-300 hover:border-white/[0.16] hover:shadow-[0_28px_68px_rgba(0,0,0,.46)] ${compact ? "min-h-[252px]" : "min-h-[326px] sm:p-5"}`}
            >
                <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: hexToRgba(cardAccent, .11) }} />
                <div className="pointer-events-none absolute inset-x-7 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${hexToRgba(cardAccent, .82)}, transparent)` }} />
                <div className="pr-10">
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className={`${compact ? "text-lg" : "text-xl sm:text-2xl"} truncate font-black tracking-[-.02em] text-white transition-colors duration-300 group-hover:text-[var(--card-accent)]`}>
                            {folder.name}
                        </h2>
                        {folder.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                        {folder.smartList && <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-violet-300"><SlidersHorizontal className="h-2.5 w-2.5" />Smart</span>}
                        {complete && !folder.archived && <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-300"><Check className="h-2.5 w-2.5" />Complete</span>}
                        {folder.archived && <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-zinc-400"><Archive className="h-2.5 w-2.5" />Archived</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-zinc-500">
                        <span>{displayItems.length} {displayItems.length === 1 ? "title" : "titles"}</span>
                        {activity?.label && <span className="flex items-center gap-1 text-zinc-600"><Clock3 className="h-3 w-3" />{activity.label}</span>}
                    </div>
                    {folder.smartList && <p className="mt-1 truncate text-[9px] font-medium text-zinc-600">{smartRuleSummary(folder.smartRules)}</p>}
                </div>
                <div className={`mt-3 ${compact ? "h-[126px]" : "h-[190px]"}`}>
                    <FolderPosterPreview folder={displayFolder} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-white/10 bg-white/[.04] px-2 py-1 text-[9px] font-bold uppercase text-zinc-300">{stats.movies} Movies · {stats.series} Series</span>
                    <span className="rounded-full border px-2 py-1 text-[9px] font-bold" style={{ borderColor: hexToRgba(cardAccent, .24), background: hexToRgba(cardAccent, .09), color: mixHex(cardAccent, "#ffffff", .22) }}>{stats.topGenre}</span>
                    {!!overlap?.count && <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[9px] font-semibold text-zinc-500" title={`${overlap.count} shared titles`}><Layers className="h-2.5 w-2.5" />{overlap.count} also in {overlap.withName}</span>}
                    {!!overlap?.multiListCount && overlap.multiListCount >= 3 && <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.05] px-2 py-1 text-[9px] font-semibold text-amber-300/75">{overlap.multiListCount} heavily duplicated</span>}
                </div>
            </button>
            <button onClick={event => { event.stopPropagation(); setMenuId(menuId === folder.id ? null : folder.id); }} className="absolute right-3 top-3 z-30 rounded-full border border-white/10 bg-black/70 p-2.5 text-zinc-200 backdrop-blur-xl transition hover:bg-white/10" aria-label={`More actions for ${folder.name}`}>
                <MoreHorizontal className="h-4 w-4" />
            </button>
            <AnimatePresence>
                {menuId === folder.id && <motion.div initial={{ opacity: 0, scale: .96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }} onClick={event => event.stopPropagation()} className="absolute right-3 top-14 z-[80] max-h-[330px] w-48 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/98 p-1.5 text-xs shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-xl">
                    {[[Edit3, "Edit", () => openEdit(folder)], [Copy, "Duplicate", () => duplicateFolder(folder)], [Share2, "Share", () => shareFolder(folder)], [Copy, "Copy link", () => copyLink(folder)], [Download, "Export JSON", () => exportFolder(folder)], [folder.pinned ? PinOff : Pin, folder.pinned ? "Unpin" : "Pin", () => togglePin(folder)]].map(([Icon, label, fn]: any) => <button key={label} onClick={fn} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-zinc-300 hover:bg-white/10 hover:text-white"><Icon className="h-3.5 w-3.5" />{label}</button>)}
                    {(folder.archived || complete) && <button type="button" onClick={() => { setFolderArchived(folder, !folder.archived); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-zinc-300 hover:bg-white/10 hover:text-white">{folder.archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{folder.archived ? "Restore" : "Archive completed list"}</button>}
                    <div className="my-1 h-px bg-white/10" />
                    <button onClick={() => { setDeleteFolderId(folder.id); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-semibold text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                </motion.div>}
            </AnimatePresence>
        </motion.article>;
    };

    const renderRecentFolderCard = (folder: CustomFolder, index: number) => {
        const displayItems = getSmartFolderItems(folder);
        const activity = folderActivity.get(folder.id);
        const stats = getStats(displayItems);
        const cardAccent = folder.accent && folder.accent !== "auto" ? ACCENTS[folder.accent].color : "#f59e0b";
        const visualItems = displayItems.filter(item => item.poster || item.backdrop).slice(0, 3);
        const backdrop = imageSource(folder.coverImage, "w1280") || imageSource(displayItems.find(item => item.backdrop)?.backdrop, "w1280") || imageSource(displayItems.find(item => item.poster)?.poster, "w780");
        const posterPositions = [
            { right: 78, top: 24, rotate: -7, scale: .84, opacity: .52, z: 10 },
            { right: 42, top: 18, rotate: 5, scale: .92, opacity: .82, z: 20 },
            { right: 10, top: 14, rotate: -1.5, scale: 1, opacity: 1, z: 30 },
        ];

        return <motion.article
            key={`recent-premium-${folder.id}`}
            initial={{ opacity: 0, y: 12, scale: .985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: Math.min(index, 4) * .045, duration: .36 }}
            className="group w-[82vw] max-w-[342px] shrink-0 snap-start sm:w-auto sm:max-w-none"
        >
            <button
                type="button"
                onClick={() => openFolder(folder.id)}
                className="relative block h-[178px] w-full isolate overflow-hidden rounded-[24px] border border-white/[0.09] bg-zinc-950 text-left shadow-[0_18px_48px_rgba(0,0,0,.38),inset_0_1px_0_rgba(255,255,255,.05)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-[0_28px_72px_rgba(0,0,0,.52)] sm:h-[192px]"
            >
                <div className="absolute inset-0 z-0 overflow-hidden">
                    {backdrop ? <SmartImage src={backdrop} alt={folder.name} className="absolute inset-0" /> : <EmptyCover />}
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,3,4,.86)_0%,rgba(3,3,4,.57)_42%,rgba(3,3,4,.20)_72%,rgba(3,3,4,.48)_100%)]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/20" />
                    <div className="absolute -left-10 -top-14 h-40 w-40 rounded-full blur-3xl" style={{ background: hexToRgba(cardAccent, .16) }} />
                    <div className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${hexToRgba(cardAccent, .78)},transparent)` }} />
                </div>

                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[48%] overflow-hidden sm:w-[46%]">
                    <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/55 to-transparent" />
                    {visualItems.length ? visualItems.map((item, posterIndex) => {
                        const position = posterPositions[posterIndex] || posterPositions[posterPositions.length - 1];
                        return <div
                            key={`recent-poster-${itemKey(item)}`}
                            className="absolute aspect-[2/3] h-[110px] overflow-hidden rounded-[14px] border border-white/[0.15] bg-zinc-900 shadow-[0_18px_34px_rgba(0,0,0,.58),inset_0_1px_0_rgba(255,255,255,.10)] transition-transform duration-300 group-hover:-translate-y-1 sm:h-[124px]"
                            style={{ right: position.right, top: position.top, zIndex: position.z, opacity: position.opacity, transform: `rotate(${position.rotate}deg) scale(${position.scale})` }}
                        >
                            <SmartImage src={imageSource(item.poster || item.backdrop, "w342")} alt={item.title} className="absolute inset-0" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-white/[0.05]" />
                        </div>;
                    }) : <div className="absolute right-4 top-7 flex h-24 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-zinc-700 backdrop-blur-xl"><Film className="h-5 w-5" /></div>}
                </div>

                <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-4 pt-14 sm:px-5 sm:pb-5 sm:pt-16">
                    <div className="mb-2 flex min-w-0 items-center gap-1.5 pr-9">
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.10] bg-black/45 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-zinc-300 backdrop-blur-xl">
                            <Clock3 className="h-2.5 w-2.5" />{activity?.activityTime ? formatRelativeTime(activity.activityTime) : "Recent"}
                        </span>
                        {folder.pinned && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-black/45 text-amber-300 backdrop-blur-xl"><Pin className="h-2.5 w-2.5" /></span>}
                        {folder.smartList && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-300 backdrop-blur-xl"><SlidersHorizontal className="h-2.5 w-2.5" /></span>}
                    </div>
                    <div className="min-w-0 pr-9">
                        <h3 className="truncate text-[17px] font-black leading-tight tracking-[-.025em] text-white sm:text-lg">{folder.name}</h3>
                        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[9px] font-semibold text-zinc-400">
                            <span className="shrink-0">{displayItems.length} {displayItems.length === 1 ? "title" : "titles"}</span>
                            <span className="text-zinc-700">•</span>
                            <span className="truncate">{stats.topGenre}</span>
                            {activity?.label && <><span className="text-zinc-700">•</span><span className="truncate text-zinc-500">{activity.label}</span></>}
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-4 right-4 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-black/55 text-white/80 backdrop-blur-xl transition group-hover:border-white/[0.20] group-hover:bg-black/70 sm:bottom-5 sm:right-5">
                    <ChevronRight className="h-3.5 w-3.5" />
                </div>
            </button>
        </motion.article>;
    };

    if (loading) return <Loading />;
    return <div className="min-h-screen overflow-x-hidden bg-black pb-24 text-white antialiased" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        {!activeFolderId ? <main className="relative mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-9">
            <div className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[260px] w-[92vw] max-w-5xl -translate-x-1/2 rounded-full bg-white/[0.025] blur-[115px]" />
            <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, ease: "easeOut" }} className="relative z-10 mb-6 sm:mb-8">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.10] bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-[0_10px_30px_rgba(0,0,0,.38),inset_0_1px_1px_rgba(255,255,255,.08)] sm:h-14 sm:w-14">
                            <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                            <ListChecks className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-[.22em] text-zinc-600 sm:text-[10px]">Personal library</p>
                            <h1 className="truncate text-[27px] font-black tracking-[-.04em] text-white sm:text-[36px]">Your Lists</h1>
                            <p className="mt-0.5 hidden text-xs text-zinc-500 sm:block">Organise, discover and finish the collections you care about.</p>
                        </div>
                    </div>
                    <button type="button" onClick={openCreatePicker} className="group flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 px-3.5 text-xs font-black text-black shadow-[0_10px_28px_rgba(245,158,11,.20),inset_0_1px_1px_rgba(255,255,255,.55)] transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[.97] sm:h-12 sm:px-5">
                        <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /><span className="hidden sm:inline">New list</span>
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-1.5 sm:mt-5 sm:gap-2">
                    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] backdrop-blur-xl sm:rounded-2xl sm:px-3.5 sm:py-3">
                        <div className="flex items-center gap-1.5 text-zinc-600"><ListChecks className="h-3 w-3 shrink-0" /><span className="truncate text-[7px] font-black uppercase tracking-[.11em] sm:text-[9px] sm:tracking-[.14em]">Lists</span></div>
                        <p className="mt-1 truncate text-sm font-black text-zinc-100 sm:text-lg">{activeLandingFolders.length}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] backdrop-blur-xl sm:rounded-2xl sm:px-3.5 sm:py-3">
                        <div className="flex items-center gap-1.5 text-zinc-600"><Film className="h-3 w-3 shrink-0" /><span className="truncate text-[7px] font-black uppercase tracking-[.11em] sm:text-[9px] sm:tracking-[.14em]">Titles</span></div>
                        <p className="mt-1 truncate text-sm font-black text-zinc-100 sm:text-lg">{activeLandingFolders.reduce((sum, folder) => sum + getSmartFolderItems(folder).length, 0)}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] backdrop-blur-xl sm:rounded-2xl sm:px-3.5 sm:py-3">
                        <div className="flex items-center gap-1.5 text-zinc-600"><SlidersHorizontal className="h-3 w-3 shrink-0" /><span className="truncate text-[7px] font-black uppercase tracking-[.11em] sm:text-[9px] sm:tracking-[.14em]">Smart</span></div>
                        <p className="mt-1 truncate text-sm font-black text-zinc-100 sm:text-lg">{activeLandingFolders.filter(folder => folder.smartList).length}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] backdrop-blur-xl sm:rounded-2xl sm:px-3.5 sm:py-3">
                        <div className="flex items-center gap-1.5 text-zinc-600"><Check className="h-3 w-3 shrink-0 text-emerald-500" /><span className="truncate text-[7px] font-black uppercase tracking-[.11em] sm:text-[9px] sm:tracking-[.14em]">Sync</span></div>
                        <p className="mt-1 truncate text-[10px] font-black text-zinc-300 sm:text-sm">Synced</p>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2 sm:mt-5">
  <div className="group/search relative min-w-0 flex-1">
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5">
      <Search className="h-4 w-4 stroke-[2.2] text-zinc-400 transition-colors duration-200 group-focus-within/search:text-white" />
    </div>
    <input
      type="text"
      value={landingSearchQuery}
      onChange={(event) => setLandingSearchQuery(event.target.value)}
      placeholder="Search lists and titles..."
      className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] pl-10 pr-10 text-sm text-white outline-none backdrop-blur-xl transition placeholder:text-zinc-500 focus:border-white/[0.18] focus:bg-white/[0.04]"
    />
    {landingSearchQuery && (
      <button
        type="button"
        onClick={() => setLandingSearchQuery('')}
        className="absolute right-2.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
        aria-label="Clear library search"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
  <button
    type="button"
    onClick={() => {
      setCommandOpen(true);
      setCommandQuery('');
    }}
    className="hidden h-11 shrink-0 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] font-bold text-zinc-400 backdrop-blur-xl transition hover:border-white/[0.14] hover:text-zinc-200 sm:flex"
  >
    <Command className="h-3.5 w-3.5" />
    <span>Alt + P</span>
  </button>
</div>
            </motion.header>

            <AnimatePresence>
                {isCreatingFolder && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="relative z-20 mb-7 overflow-hidden rounded-[28px] border border-white/[0.09] bg-zinc-950/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-amber-400">Create collection</p><h2 className="mt-0.5 text-lg font-black text-white">{createStep === "templates" ? "Start with a template" : "Set up your list"}</h2></div>
                        <button type="button" onClick={() => { setIsCreatingFolder(false); setCreateStep("templates"); }} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
                    </div>
                    {createStep === "templates" ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {CREATE_TEMPLATES.map(template => {
                            const Icon = template.icon; return <button type="button" key={template.id} onClick={() => chooseCreateTemplate(template)} className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:-translate-y-0.5 hover:border-amber-400/20 hover:bg-amber-400/[0.045]">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900 text-zinc-400 transition group-hover:border-amber-400/20 group-hover:text-amber-300"><Icon className="h-4 w-4" /></span>
                                <span className="mt-2 block text-xs font-black text-zinc-100">{template.label}</span><span className="mt-0.5 block text-[9px] leading-relaxed text-zinc-600">{template.description}</span>
                            </button>;
                        })}
                    </div> : <form onSubmit={handleCreateFolder} className="space-y-3">
                        <button type="button" onClick={() => setCreateStep("templates")} className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Templates</button>
                        <input required autoFocus value={newFolderName} onChange={event => setNewFolderName(event.target.value)} placeholder="List name" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-400/60" />
                        <textarea value={newFolderDesc} onChange={event => setNewFolderDesc(event.target.value)} placeholder="Description (optional)" rows={2} className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-400/60" />
                        <button type="button" onClick={() => { setNewFolderSmart(value => !value); if (newFolderSmart) setNewSmartRules({}); }} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${newFolderSmart ? "border-violet-400/30 bg-violet-500/10 text-violet-200" : "border-white/10 bg-white/[0.04] text-zinc-300"}`}>
                            <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /><span><span className="block text-xs font-black">Smart List</span><span className="mt-0.5 block text-[10px] text-zinc-500">Auto-update from your active My Lists library</span></span></span>
                            <span className={`h-5 w-9 rounded-full p-0.5 transition ${newFolderSmart ? "bg-violet-500" : "bg-zinc-800"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${newFolderSmart ? "translate-x-4" : "translate-x-0"}`} /></span>
                        </button>
                        {newFolderSmart && <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">Rule presets</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{SMART_TEMPLATES.map(template => { const active = JSON.stringify(newSmartRules) === JSON.stringify(template.rules); return <button type="button" key={template.id} onClick={() => setNewSmartRules(template.rules)} className={`rounded-xl border p-2.5 text-left transition ${active ? "border-violet-400/30 bg-violet-500/12 text-violet-200" : "border-white/[0.06] bg-white/[0.025] text-zinc-400 hover:bg-white/[0.05]"}`}><span className="block text-[10px] font-black leading-tight">{template.label}</span></button>; })}</div></div>}
                        <button className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-black text-black shadow-[0_8px_24px_rgba(245,158,11,.18)]">Create {newFolderSmart ? "Smart List" : "list"}</button>
                    </form>}
                </motion.div>}
            </AnimatePresence>

            {landingSearchQuery.trim() ? <section className="space-y-3">
                <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-600">Library search</p><h2 className="mt-0.5 text-lg font-black text-white">{landingSearchGroups.length ? `${landingSearchGroups.length} matching ${landingSearchGroups.length === 1 ? "collection" : "collections"}` : "No matches"}</h2></div><span className="text-[10px] text-zinc-600">“{landingSearchQuery.trim()}”</span></div>
                {landingSearchGroups.length ? landingSearchGroups.map(group => <div key={group.folder.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                    <button type="button" onClick={() => openFolder(group.folder.id)} className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.035]"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-black text-white">{group.folder.name}</h3>{group.folder.archived && <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-black uppercase text-zinc-500">Archived</span>}</div><p className="mt-0.5 text-[10px] text-zinc-600">{group.nameMatch ? "Collection name matches" : `${group.matches.length} matching ${group.matches.length === 1 ? "title" : "titles"}`}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" /></button>
                    {!!group.matches.length && <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{group.matches.slice(0, 8).map(item => <button type="button" key={`${group.folder.id}-${itemKey(item)}`} onClick={() => { openFolder(group.folder.id); setSearchQuery(item.title); }} className="flex w-[170px] shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-black/25 p-2 text-left transition hover:bg-white/[0.045]"><div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-lg bg-zinc-900"><SmartImage src={imageSource(item.poster, "w154")} alt={item.title} className="absolute inset-0" /></div><div className="min-w-0"><p className="truncate text-[11px] font-bold text-zinc-200">{item.title}</p><p className="mt-0.5 text-[9px] text-zinc-600">{yearOf(item.releaseYear)} · {item.type === "tv" ? "Series" : "Movie"}</p></div></button>)}</div>}
                </div>) : <div className="rounded-3xl border border-dashed border-white/[0.08] bg-white/[0.015] px-5 py-14 text-center"><Search className="mx-auto h-6 w-6 text-zinc-700" /><h3 className="mt-3 text-sm font-black text-zinc-300">Nothing in your library matches</h3><p className="mt-1 text-[11px] text-zinc-600">Try a collection name, movie, or series title.</p></div>}
            </section> : !folders.length ? <div className="relative flex min-h-[320px] items-end overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-9"><EmptyCover /><div className="relative z-10 max-w-sm"><span className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-amber-300"><Sparkles className="h-3.5 w-3.5" />Start your collection</span><h2 className="mb-2 text-2xl font-black sm:text-3xl">Build a list worth watching.</h2><p className="text-sm text-zinc-300">Create your first list and fill it with the stories you never want to lose.</p></div></div> : <div className="space-y-8">
                {!!recentlyUpdatedFolders.length && <section>
                    <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-600">Continue organising</p><h2 className="mt-0.5 text-lg font-black text-white sm:text-xl">Recently updated</h2></div><span className="text-[10px] text-zinc-600">Your latest activity</span></div>
                    <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">{recentlyUpdatedFolders.map((folder, index) => renderRecentFolderCard(folder, index))}</div>
                </section>}

                {!!pinnedFolders.length && <section>
                    <div className="mb-3 flex items-center gap-2"><Pin className="h-3.5 w-3.5 text-amber-300" /><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300/80">Pinned</p><h2 className="text-lg font-black text-white">Keep close</h2></div></div>
                    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">{pinnedFolders.map((folder, index) => renderLandingFolderCard(folder, index))}</div>
                </section>}

                {!!regularFolders.length && <section>
                    <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-600">Collections</p><h2 className="mt-0.5 text-lg font-black text-white">All lists</h2></div><span className="text-[10px] text-zinc-600">{regularFolders.length} {regularFolders.length === 1 ? "list" : "lists"}</span></div>
                    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">{regularFolders.map((folder, index) => renderLandingFolderCard(folder, index))}</div>
                </section>}

                {!!archivedFolders.length && <section>
                    <div className="mb-3 flex items-center gap-2"><Archive className="h-3.5 w-3.5 text-zinc-600" /><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-700">Archived</p><h2 className="text-base font-black text-zinc-400">Completed collections</h2></div></div>
                    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">{archivedFolders.map((folder, index) => renderLandingFolderCard(folder, index))}</div>
                </section>}
            </div>}
        </main> :
            <main className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-8">
                {activeFolder && <>
                    <div className="relative -mx-3 min-h-[280px] overflow-hidden border-y border-white/10 sm:mx-0 sm:min-h-[390px] sm:rounded-3xl sm:border">
                        <CollectionCover folder={activeDisplayFolder || activeFolder} hero className="absolute inset-0" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent sm:bg-gradient-to-r sm:from-black/70 sm:via-black/15 sm:to-transparent" />
                        <div className="pointer-events-none absolute -left-20 bottom-[-90px] h-72 w-72 rounded-full blur-3xl" style={{ background: hexToRgba(derivedAccent, .18) }} />
                        <div className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between sm:left-4 sm:right-4 sm:top-4">
                            <button onClick={closeFolder} className="rounded-full border border-white/20 bg-black/40 p-2.5 backdrop-blur-xl active:scale-95 sm:p-3 sm:hover:bg-black/60">
                                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                            <button onClick={() => openEdit(activeFolder)} className="rounded-full border border-white/20 bg-black/40 p-2.5 backdrop-blur-xl active:scale-95 sm:p-3 sm:hover:bg-amber-400 sm:hover:text-black">
                                <Edit3 className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                        </div>
                        <div className="relative z-10 flex min-h-[280px] items-end p-4 sm:min-h-[390px] sm:p-8">
                            <div className="w-full max-w-3xl">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-black tracking-tight sm:text-5xl">{activeFolder.name}</h1>
                                    {activeFolder.smartList && <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[.12em]" style={{ borderColor: hexToRgba(derivedAccent, .38), background: hexToRgba(derivedAccent, .12), color: derivedAccent }}><SlidersHorizontal className="h-3 w-3" />Smart List</span>}
                                    {activeFolder.archived && <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[9px] font-black uppercase tracking-[.12em] text-zinc-300"><Archive className="h-3 w-3" />Archived</span>}
                                    <button type="button" onClick={() => filteredItems.length && setShowRoulette(true)} disabled={!filteredItems.length} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-black/45 px-2.5 text-[10px] font-black text-zinc-200 backdrop-blur-xl transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" title="What should I watch?">
                                        <Dices className="h-3.5 w-3.5" />Surprise me
                                    </button>
                                </div>
                                <p className="mt-1 line-clamp-2 max-w-xl text-xs text-zinc-300 sm:mt-2 sm:line-clamp-none sm:text-sm">
                                    {activeFolder.description || (activeFolder.smartList ? smartRuleSummary(activeFolder.smartRules) : "A personal collection of films and series.")}
                                </p>
                                {activeFolder.smartList && <p className="mt-1.5 text-[10px] font-semibold text-zinc-500">Rules · {smartRuleSummary(activeFolder.smartRules)}</p>}
                                <div className={`mt-3 max-w-md rounded-2xl transition ${completionPct === 100 && activeItems.length ? "border border-emerald-400/15 bg-emerald-500/[0.055] p-3" : ""}`}>
                                    <div className={`mb-1.5 flex items-center justify-between text-[10px] font-semibold ${completionPct === 100 && activeItems.length ? "text-emerald-200" : "text-zinc-400"}`}>
                                        <span className="flex items-center gap-1.5">{completionPct === 100 && activeItems.length ? <Check className="h-3 w-3 stroke-[3]" /> : null}{watchedCount} / {activeItems.length} watched</span><span>{completionPct}% complete</span>
                                    </div>
                                    <div className={`h-1.5 overflow-hidden rounded-full ${completionPct === 100 && activeItems.length ? "bg-emerald-950/80" : "bg-white/10"}`}>
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${completionPct}%` }} transition={{ duration: .55, ease: "easeOut" }} className="h-full rounded-full" style={{ background: completionPct === 100 && activeItems.length ? "linear-gradient(90deg,#34d399,#10b981)" : `linear-gradient(90deg, ${hexToRgba(derivedAccent, .72)}, ${derivedAccent})`, boxShadow: completionPct === 100 && activeItems.length ? "0 0 18px rgba(16,185,129,.35)" : `0 0 18px ${hexToRgba(derivedAccent, .3)}` }} />
                                    </div>
                                    {(completionPct === 100 && activeItems.length > 0 || activeFolder.archived) && <div className="mt-2.5 flex items-center justify-between gap-3">
                                        <p className="text-[9px] font-semibold text-zinc-500">{activeFolder.archived ? "This collection is archived." : "Collection complete — nice finish."}</p>
                                        <button type="button" onClick={() => setFolderArchived(activeFolder, !activeFolder.archived)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 text-[9px] font-black text-zinc-200 transition hover:bg-white/[0.08]">{activeFolder.archived ? <RotateCcw className="h-3 w-3" /> : <Archive className="h-3 w-3" />}{activeFolder.archived ? "Restore" : "Archive"}</button>
                                    </div>}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold sm:mt-4 sm:gap-2">
                                    <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 backdrop-blur-md sm:py-1.5">
                                        {activeStats.movies} Movies</span>
                                    <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 backdrop-blur-md sm:py-1.5">
                                        {activeStats.series} Series</span>
                                    <span className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 backdrop-blur-md sm:py-1.5">
                                        {formatRuntime(activeStats.totalRuntime)}
                                    </span>
                                    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-amber-300 backdrop-blur-md sm:py-1.5">
                                        <Star className="h-3 w-3 fill-amber-300" />
                                        {activeStats.average ? activeStats.average.toFixed(1) : "—"}
                                    </span>
                                    <button onClick={() => setShowInsights(v => !v)} className="flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-amber-300 active:scale-95 sm:py-1.5">
                                        <BarChart3 className="h-3 w-3" />Insights {showInsights ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </button>
                                </div>
                                <AnimatePresence>
                                    {showInsights && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mt-3 grid max-w-2xl grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/50 p-3 text-xs backdrop-blur-xl sm:mt-4 sm:grid-cols-4">
                                        <div>
                                            <p className="text-zinc-500">Top genre</p>
                                            <p className="mt-0.5 font-bold sm:mt-1">
                                                {activeStats.topGenre}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-zinc-500">Average rating</p>
                                            <p className="mt-0.5 font-bold sm:mt-1">
                                                {activeStats.average ? activeStats.average.toFixed(1) : "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-zinc-500">Release span</p>
                                            <p className="mt-0.5 font-bold sm:mt-1">
                                                {activeStats.oldest && activeStats.newest ? `${activeStats.oldest}–${activeStats.newest}` : "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-zinc-500">Total watch time</p>
                                            <p className="mt-0.5 font-bold sm:mt-1">
                                                {formatRuntime(activeStats.totalRuntime)}
                                            </p>
                                        </div>
                                    </motion.div>}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 sm:flex-row sm:gap-3">
                        {activeFolder.smartList ? (
                            <button
                                onClick={() => openEdit(activeFolder)}
                                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition hover:-translate-y-0.5 active:scale-[0.98] sm:min-h-12 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm sm:w-auto"
                                style={{ borderColor: hexToRgba(derivedAccent, .34), background: hexToRgba(derivedAccent, .12), color: mixHex(derivedAccent, "#ffffff", .20), boxShadow: `0 10px 28px ${hexToRgba(derivedAccent, .10)}` }}
                            >
                                <SlidersHorizontal className="h-4 w-4" />Edit smart rules
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={openAddTitles}
                                className="group/add flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300/35 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 px-4 py-2.5 text-xs font-black text-black shadow-[0_10px_30px_rgba(245,158,11,.22),inset_0_1px_1px_rgba(255,255,255,.48)] transition hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:min-h-12 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm sm:w-auto"
                            >
                                <Plus className="h-4 w-4 transition-transform duration-300 group-hover/add:rotate-90" />
                                Add titles
                            </button>
                        )}
                        <div
                            className="relative flex min-h-11 flex-1 items-center overflow-hidden rounded-xl border bg-white/[0.045] shadow-[inset_0_1px_1px_rgba(255,255,255,.05)] backdrop-blur-2xl transition-all duration-200 sm:min-h-12 sm:rounded-2xl"
                            style={{
                                borderColor: isListSearchFocused ? hexToRgba(derivedAccent, .55) : searchQuery ? hexToRgba(derivedAccent, .24) : "rgba(255,255,255,.10)",
                                boxShadow: isListSearchFocused ? `0 0 0 3px ${hexToRgba(derivedAccent, .09)}, inset 0 1px 1px rgba(255,255,255,.06)` : "inset 0 1px 1px rgba(255,255,255,.05)",
                            }}
                        >
                            <Search
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"
                                style={{ color: isListSearchFocused || searchQuery ? derivedAccent : "#71717a" }}
                            />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onFocus={() => setIsListSearchFocused(true)}
                                onBlur={() => setIsListSearchFocused(false)}
                                onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setSearchQuery(""); } }}
                                placeholder="Search this list..."
                                className="h-full min-w-0 flex-1 bg-transparent py-2.5 pl-10 pr-11 text-xs text-white outline-none placeholder:text-zinc-600 sm:py-3 sm:text-sm"
                            />
                            <AnimatePresence initial={false}>
                                {searchQuery && (
                                    <motion.button
                                        type="button"
                                        initial={{ opacity: 0, scale: .8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: .8 }}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.055] text-zinc-400 transition hover:bg-white/[0.10] hover:text-white active:scale-90 sm:right-2.5 sm:h-8 sm:w-8"
                                        aria-label="Clear list search"
                                        title="Clear search"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex w-full items-center justify-between gap-2.5 sm:w-auto">
                            <div className="flex flex-1 items-center rounded-xl border border-white/15 bg-white/[0.08] p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-3xl sm:flex-initial sm:rounded-2xl">
                                {([["all", "All", Layers], ["movie", "Movies", Clapperboard], ["tv", "Series", Tv]] as const).map(([value, label, Icon]) => {
                                    const active = filterType === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFilterType(value)}
                                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-all duration-300 active:scale-95 sm:flex-initial sm:gap-2 sm:px-5 sm:text-xs ${active ? "text-white" : "border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}
                                            style={active ? {
                                                borderColor: hexToRgba(derivedAccent, .44),
                                                background: `linear-gradient(180deg, ${mixHex(derivedAccent, "#ffffff", .12)} 0%, ${derivedAccent} 48%, ${mixHex(derivedAccent, "#000000", .22)} 100%)`,
                                                boxShadow: `0 4px 15px ${hexToRgba(derivedAccent, .34)}, inset 0 1px 1px rgba(255,255,255,.38)`,
                                            } : undefined}
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            <span>{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex w-full items-center gap-2 sm:min-w-0 sm:flex-1 sm:justify-end">
                            <button
                                ref={sortButtonRef}
                                type="button"
                                onClick={() => {
                                    if (!showSortMenu) updateSortMenuPosition();
                                    setShowSortMenu(value => !value);
                                }}
                                className={`flex h-9 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,.12)] backdrop-blur-2xl transition active:scale-[0.98] sm:h-10 sm:max-w-[190px] sm:flex-none sm:px-3 sm:text-xs ${showSortMenu ? "border-white/20 bg-white/[0.12] text-white" : "border-white/10 bg-white/[0.06] text-zinc-300 hover:bg-white/[0.09] hover:text-white"}`}
                                aria-haspopup="listbox"
                                aria-expanded={showSortMenu}
                            >
                                <span className="min-w-0 truncate">{SORT_OPTIONS.find(option => option.value === sortBy)?.label || "Recently added"}</span>
                                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${showSortMenu ? "rotate-180" : ""}`} />
                            </button>

                            <button type="button" onClick={() => setShowFilters(true)} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold transition sm:h-10 sm:px-3 sm:text-xs ${selectedGenres.length || statusFilter !== "all" || releaseFilter !== "all" || ratingFilter !== "all" ? "text-white" : "border-white/10 bg-zinc-900/70 text-zinc-300 hover:text-white"}`} style={(selectedGenres.length || statusFilter !== "all" || releaseFilter !== "all" || ratingFilter !== "all") ? { borderColor: hexToRgba(derivedAccent, .34), background: hexToRgba(derivedAccent, .14), boxShadow: `0 6px 18px ${hexToRgba(derivedAccent, .10)}` } : undefined}>
                                <Filter className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline">Filters</span>
                                {(selectedGenres.length || statusFilter !== "all" || releaseFilter !== "all" || ratingFilter !== "all") ? <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black text-black" style={{ background: derivedAccent }}>{selectedGenres.length + Number(statusFilter !== "all") + Number(releaseFilter !== "all") + Number(ratingFilter !== "all")}</span> : null}
                            </button>

                            <button type="button" onClick={() => setViewMode(value => value === "grid" ? "list" : "grid")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/70 text-zinc-300 transition hover:text-white sm:h-10 sm:w-10" title={viewMode === "grid" ? "List view" : "Grid view"}>
                                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => { if (selectionMode) { setSelectionMode(false); setSelectedKeys(new Set()); } else setSelectionMode(true); }} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold transition active:scale-[0.98] sm:h-10 sm:px-3 sm:text-xs ${selectionMode ? "text-white" : "border-white/10 bg-zinc-900/70 text-zinc-300 hover:text-white"}`} style={selectionMode ? { borderColor: hexToRgba(derivedAccent, .34), background: hexToRgba(derivedAccent, .14), boxShadow: `0 6px 18px ${hexToRgba(derivedAccent, .10)}` } : undefined}>
                                <CheckSquare className="h-3.5 w-3.5" /><span>{selectionMode ? "Cancel" : "Select"}</span>
                            </button>
                        </div>
                    </div>
                    <div className="mt-1 h-px w-full opacity-70" style={{ background: `linear-gradient(90deg, ${hexToRgba(derivedAccent, .7)}, transparent 72%)` }} />

                    {activeFilterCount > 0 && (
                        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {filterType !== "all" && <button onClick={() => setFilterType("all")} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">{filterType === "movie" ? "Movies" : "Series"} ×</button>}
                            {selectedGenres.map(genre => <button key={genre} onClick={() => setSelectedGenres(current => current.filter(value => value !== genre))} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">{genre} ×</button>)}
                            {statusFilter !== "all" && <button onClick={() => setStatusFilter("all")} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">{statusFilter === "watchlist" ? "In Watchlist" : statusFilter[0].toUpperCase() + statusFilter.slice(1)} ×</button>}
                            {releaseFilter !== "all" && <button onClick={() => setReleaseFilter("all")} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">{releaseFilter === "older" ? "Before 2000" : releaseFilter} ×</button>}
                            {ratingFilter !== "all" && <button onClick={() => setRatingFilter("all")} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">{ratingFilter} TMDB ×</button>}
                            {sortBy !== "default" && <button onClick={() => setSortBy("default")} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">Sort ×</button>}
                            {searchQuery && <button onClick={() => setSearchQuery("")} className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold text-zinc-300">Search ×</button>}
                            <button onClick={clearFilters} className="shrink-0 px-2 text-[10px] font-black text-amber-400">Clear all</button>
                        </div>
                    )}

                    {sortBy === "custom" && !canReorder && <p className="mt-2 text-[10px] text-zinc-500 sm:mt-3">{activeFolder.smartList ? "Smart Lists are rule-driven and cannot be manually reordered." : "Clear search and filters to drag titles into a custom order."}</p>}

                    {filteredItems.length ? (
                        viewMode === "grid" ? (
                            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:mt-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5">
                                {filteredItems.map((item, index) => {
                                    const key = itemKey(item);
                                    const watched = watchHistory.has(key);
                                    const inWatchlist = watchlistKeys.has(key);
                                    const favorite = favoriteKeys.has(key);
                                    const userRating = userRatings.get(key);
                                    const selected = selectedKeys.has(key);
                                    return (
                                        <motion.article
                                            draggable={!isMobileControls && (!selectionMode || selected)}
                                            onDragStart={() => {
                                                setCrossListDragItems(selectionMode && selected ? selectedItems : [item]);
                                                if (canReorder && !selectionMode) setDraggedItemKey(key);
                                            }}
                                            onDragEnd={() => { setCrossListDragItems([]); setDraggedItemKey(null); }}
                                            onDragOver={e => canReorder && e.preventDefault()}
                                            onDrop={() => moveItem(item)}
                                            onPointerDown={e => beginLongPress(item, e)}
                                            onPointerMove={moveLongPress}
                                            onPointerUp={cancelLongPress}
                                            onPointerCancel={cancelLongPress}
                                            onPointerLeave={cancelLongPress}
                                            key={key}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            whileHover={{ y: selectionMode ? 0 : -3 }}
                                            className={`group relative min-w-0 rounded-2xl border bg-zinc-950 shadow-md transition hover:border-zinc-800 hover:shadow-[0_14px_34px_rgba(0,0,0,0.42)] ${!isMobileControls && (!selectionMode || selected) ? "cursor-grab active:cursor-grabbing" : ""} ${selected ? "border-white/25" : "border-zinc-900"}`}
                                            style={selected ? { boxShadow: `0 0 0 1px ${hexToRgba(derivedAccent, .55)}, 0 14px 34px rgba(0,0,0,.42)` } : undefined}
                                        >
                                            <div className="relative mb-3">
                                                <div className="relative aspect-[2/3] overflow-hidden rounded-t-2xl bg-zinc-900">
                                                    <SmartImage src={imageSource(item.poster, "w780")} alt={item.title} className="absolute inset-0" />
                                                    <button type="button" onClick={() => handleQuickPeek(item)} className="absolute inset-0 z-10" aria-label={`Quick peek ${item.title}`} />
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-black/55 to-transparent" />
                                                    <div className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-center bg-black/0 transition group-hover:bg-black/15 [@media(hover:hover)]:flex">
                                                        <span className="translate-y-2 rounded-full border border-white/10 bg-black/65 p-2 text-white/80 opacity-0 backdrop-blur-xl transition-all group-hover:translate-y-0 group-hover:opacity-100"><Eye className="h-4 w-4" /></span>
                                                    </div>
                                                    {sortBy === "custom" ? (
                                                        <span className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-black text-zinc-200 backdrop-blur-md"><GripVertical className="h-3 w-3 text-zinc-400" />#{index + 1}</span>
                                                    ) : (
                                                        <span className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1 rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-black text-white backdrop-blur-md"><Star className="h-3 w-3 fill-amber-300 text-amber-300" />{item.voteAverage?.toFixed(1) || "—"}</span>
                                                    )}
                                                    {selectionMode ? (
                                                        <button type="button" onClick={e => { e.stopPropagation(); toggleSelection(item); }} className="absolute right-2 top-2 z-40 flex h-7 w-7 items-center justify-center rounded-full border-2 text-white backdrop-blur-xl" style={{ borderColor: selected ? derivedAccent : "rgba(255,255,255,.35)", background: selected ? derivedAccent : "rgba(0,0,0,.55)" }} aria-label={selected ? "Deselect" : "Select"}>
                                                            {selected && <Check className="h-4 w-4 stroke-[3] text-black" />}
                                                        </button>
                                                    ) : (
                                                        <span className="pointer-events-none absolute right-2 top-2 z-30 rounded-lg border border-white/10 bg-black/70 p-1.5 backdrop-blur-md">
                                                            {item.type === "tv" ? <Tv className="h-3 w-3 text-cyan-300" /> : <Clapperboard className="h-3 w-3 text-red-500" />}
                                                        </span>
                                                    )}

                                                    {!selectionMode && <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setActionItem(item); }} className="absolute bottom-2 left-2 z-40 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white shadow-lg backdrop-blur-md active:scale-95 [@media(hover:hover)]:hidden" aria-label="More actions">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>}

                                                    {!selectionMode && <div className="absolute inset-x-2 bottom-2 z-40 hidden translate-y-3 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/70 p-1.5 opacity-0 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:hover)]:flex">
                                                        <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setManageListItems([item]); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-violet-300" title="Manage List"><ListChecks className="h-3.5 w-3.5" /></button>
                                                        <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/10 ${favorite ? "text-rose-400" : "text-white/80"}`} title={favorite ? "Remove Favorite" : "Favorite"}><Heart className={`h-3.5 w-3.5 ${favorite ? "fill-current" : ""}`} /></button>
                                                        <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleHistory(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/10 ${watched ? "text-emerald-400" : "text-white/80 hover:text-emerald-300"}`} title={watched ? "Remove from History" : "Mark Watched"}><Check className="h-3.5 w-3.5" /></button>
                                                        <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(item); }} className={`flex h-8 w-8 items-center justify-center rounded-xl hover:bg-white/10 ${inWatchlist ? "text-blue-400" : "text-white/80 hover:text-blue-300"}`} title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}>{inWatchlist ? <BookmarkMinus className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}</button>
                                                        <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setActionItem(item); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white" title="More"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                                                    </div>}
                                                </div>

                                                <div className="pointer-events-none absolute bottom-0 right-2 z-50 translate-y-1/2">
                                                    <MiniStatusCluster favorite={favorite} watched={watched} inWatchlist={inWatchlist} />
                                                </div>
                                                {userRating !== undefined && <div className="pointer-events-none absolute bottom-0 left-2 z-50 translate-y-1/2"><UserRatingBadge rating={userRating} /></div>}
                                            </div>

                                            <div className="px-3 pb-3 pt-0.5">
                                                <button type="button" onClick={() => handleTitleOpen(item)} className="block w-full text-left">
                                                    <h2 className="line-clamp-1 text-xs font-bold tracking-tight text-zinc-200 transition group-hover:text-white sm:text-sm">{item.title}</h2>
                                                </button>
                                                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
                                                    <span>{yearOf(item.releaseYear)}</span>
                                                    {item.runtimeMinutes ? <><span>·</span><span>{formatRuntime(item.runtimeMinutes)}</span></> : null}
                                                    {isUpcoming(item) && <><span>·</span><span className="text-sky-400">Upcoming</span></>}
                                                </div>
                                                <div className="mt-2 flex min-h-[20px] flex-wrap gap-1">
                                                    {(item.genres || []).slice(0, 2).map(genre => <span key={genre} className="rounded-md border border-zinc-800/70 bg-zinc-900 px-2 py-0.5 text-[9px] font-medium text-zinc-500">{genre}</span>)}
                                                </div>
                                                <div className="mt-2 flex min-h-[22px] items-center justify-between gap-2">
                                                    <ProviderRow providers={item.providers} compact faded />
                                                    <span className="truncate text-right text-[9px] font-medium text-zinc-600">{formatAddedAt(item.addedAt)}</span>
                                                </div>
                                            </div>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-4 space-y-2.5 sm:mt-6">
                                {filteredItems.map(item => {
                                    const key = itemKey(item);
                                    const watched = watchHistory.has(key);
                                    const inWatchlist = watchlistKeys.has(key);
                                    const favorite = favoriteKeys.has(key);
                                    const userRating = userRatings.get(key);
                                    const selected = selectedKeys.has(key);
                                    return (
                                        <motion.article
                                            key={key}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: .24 }}
                                            draggable={!isMobileControls && (!selectionMode || selected)}
                                            onDragStart={() => { setCrossListDragItems(selectionMode && selected ? selectedItems : [item]); if (canReorder && !selectionMode) setDraggedItemKey(key); }}
                                            onDragEnd={() => { setCrossListDragItems([]); setDraggedItemKey(null); }}
                                            onPointerDown={e => beginLongPress(item, e)}
                                            onPointerMove={moveLongPress}
                                            onPointerUp={cancelLongPress}
                                            onPointerCancel={cancelLongPress}
                                            onPointerLeave={cancelLongPress}
                                            className={`group relative flex min-h-[96px] items-center gap-3 overflow-hidden rounded-[18px] border bg-[#08090b]/95 px-2.5 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition-all duration-300 hover:bg-[#0b0c0f] sm:min-h-[102px] sm:gap-3.5 sm:px-3 ${selected ? "border-white/20" : "border-white/[0.055] hover:border-white/[0.10]"}`}
                                            style={selected ? { boxShadow: `inset 3px 0 0 ${derivedAccent}, 0 10px 28px rgba(0,0,0,.18)` } : undefined}
                                        >
                                            {selectionMode && <button type="button" onClick={() => toggleSelection(item)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: selected ? derivedAccent : "rgba(255,255,255,.25)", background: selected ? derivedAccent : "transparent" }} aria-label={selected ? "Deselect" : "Select"}>{selected && <Check className="h-4 w-4 stroke-[3] text-black" />}</button>}
                                            <button
                                                type="button"
                                                onClick={() => handleQuickPeek(item)}
                                                className="relative h-[80px] w-[56px] shrink-0 overflow-hidden rounded-[12px] border border-white/[0.08] bg-zinc-900 shadow-[0_7px_18px_rgba(0,0,0,.30)] transition-transform duration-300 group-hover:scale-[1.02] sm:h-[82px] sm:w-[57px]"
                                                aria-label={`Quick peek ${item.title}`}
                                            >
                                                <SmartImage src={imageSource(item.poster, "w500")} alt={item.title} className="absolute inset-0" />
                                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/16 via-transparent to-white/[0.035]" />
                                                <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/25 opacity-0 transition group-hover:opacity-100 [@media(hover:hover)]:flex"><Eye className="h-4 w-4 text-white" /></span>
                                            </button>

                                            <button type="button" onClick={() => handleTitleOpen(item)} className="flex min-w-0 flex-1 flex-col justify-center text-left">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <h3 className="truncate text-[13px] font-extrabold tracking-[-0.01em] text-zinc-100 transition-colors group-hover:text-white sm:text-sm">{item.title}</h3>
                                                    {isUpcoming(item) && <span className="shrink-0 rounded-md border border-sky-400/15 bg-sky-500/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-sky-300 sm:text-[8px]">Upcoming</span>}
                                                </div>
                                                <div className="mt-1 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[9px] font-medium text-zinc-600 sm:text-[10px]">
                                                    <span>{yearOf(item.releaseYear)}</span>
                                                    {item.runtimeMinutes ? <><span className="text-zinc-700">·</span><span className="inline-flex items-center gap-1"><Clock3 className="h-2.5 w-2.5 stroke-[1.8] text-zinc-600 sm:h-3 sm:w-3" />{formatRuntime(item.runtimeMinutes)}</span></> : null}
                                                    <span className="text-zinc-700">·</span><span>{item.voteAverage?.toFixed(1) || "—"} TMDB</span>
                                                </div>
                                                <div className="mt-1.5 flex min-h-[18px] items-center gap-1 overflow-hidden">
                                                    {(item.genres || []).slice(0, 2).map(genre => <span key={genre} className="max-w-[92px] truncate rounded-md border border-white/[0.045] bg-white/[0.035] px-2 py-[3px] text-[8px] font-medium text-zinc-500 sm:max-w-[120px] sm:text-[9px]">{genre}</span>)}
                                                </div>
                                                <div className="mt-1.5 flex items-center gap-2 sm:hidden">
                                                    <ProviderRow providers={item.providers} compact faded />
                                                    <span className="truncate text-[8px] font-medium text-zinc-600">{formatAddedAt(item.addedAt)}</span>
                                                </div>
                                            </button>

                                            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
                                                <div className="hidden min-w-[86px] flex-col items-end gap-1 sm:flex lg:min-w-[100px]">
                                                    <ProviderRow providers={item.providers} compact faded />
                                                    <span className="text-[8px] font-medium text-zinc-600 sm:text-[9px]">{formatAddedAt(item.addedAt)}</span>
                                                </div>
                                                {userRating !== undefined && <div className="shrink-0"><UserRatingBadge rating={userRating} /></div>}
                                                <div className="shrink-0"><MiniStatusCluster favorite={favorite} watched={watched} inWatchlist={inWatchlist} /></div>
                                                {!selectionMode && <button
                                                    type="button"
                                                    onClick={() => setActionItem(item)}
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.055] bg-zinc-900/80 text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition-all hover:border-white/[0.10] hover:bg-zinc-800 hover:text-zinc-200 active:scale-95"
                                                    aria-label={`More actions for ${item.title}`}
                                                    title="More actions"
                                                ><MoreHorizontal className="h-4 w-4" /></button>}
                                            </div>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        )
                    ) : !activeItems.length ? (
                        activeFolder.smartList ? (
                            <div className="mt-4 rounded-2xl border border-white/[.09] bg-gradient-to-b from-zinc-950 to-black px-5 py-12 text-center sm:mt-6 sm:rounded-[28px] sm:px-8 sm:py-16">
                                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: hexToRgba(derivedAccent, .25), background: hexToRgba(derivedAccent, .10), color: derivedAccent }}><SlidersHorizontal className="h-5 w-5" /></div>
                                <h2 className="mt-4 text-sm font-black text-zinc-100 sm:text-lg">No titles match this Smart List yet</h2>
                                <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-zinc-500 sm:text-xs">{smartRuleSummary(activeFolder.smartRules)}. Smart Lists update automatically as titles and library statuses change.</p>
                                <button type="button" onClick={() => openEdit(activeFolder)} className="mt-5 inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black" style={{ borderColor: hexToRgba(derivedAccent, .30), background: hexToRgba(derivedAccent, .12), color: derivedAccent }}><SlidersHorizontal className="h-4 w-4" />Edit smart rules</button>
                            </div>
                        ) : (
                            <div className="mt-4 rounded-2xl border border-white/[.09] bg-gradient-to-b from-zinc-950 to-black p-4 sm:mt-6 sm:rounded-[28px] sm:p-7">
                                <div className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
                                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-400">Empty collection</p>
                                    <h2 className="mt-1 text-base font-black text-white sm:text-xl">Start this collection with something you might like.</h2>
                                    <p className="mt-1 text-[11px] text-zinc-500 sm:text-xs">Add a suggestion below or use Add titles to search directly.</p>
                                </div>
                                {suggestionsLoading ? (
                                    <div className="flex h-44 flex-col items-center justify-center gap-2.5 sm:h-56 sm:gap-3">
                                        <Loader2 className="h-5 w-5 animate-spin text-amber-400 sm:h-6 sm:w-6" />
                                        <span className="text-xs text-zinc-500">Finding movies and series…</span>
                                    </div>
                                ) : suggestions.length ? (
                                    <SuggestionRail eyebrow="Discover something" title="Popular movies & series" subtitle="A few bigger starting points for your new collection." items={suggestions} existing={existingKeys} onAdd={addItem} large />
                                ) : (
                                    <div className="flex h-44 flex-col items-center justify-center text-center sm:h-52">
                                        <Film className="mb-2 h-7 w-7 text-zinc-700 sm:mb-3 sm:h-8 sm:w-8" />
                                        <h3 className="text-xs font-bold text-zinc-300 sm:text-sm">Couldn’t load recommendations</h3>
                                        <p className="mt-1 text-[11px] text-zinc-600 sm:text-xs">Use Add titles above to search directly.</p>
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] px-4 py-12 text-center sm:mt-6 sm:rounded-3xl sm:px-6 sm:py-16">
                            <Search className="mx-auto mb-2 h-7 w-7 text-zinc-700 sm:mb-3 sm:h-8 sm:w-8" />
                            <h2 className="text-sm font-black text-zinc-200 sm:text-lg">{emptyFilterLabel}</h2>
                            <p className="mt-1 text-[11px] text-zinc-600 sm:text-xs">Adjust only the constraint that is blocking your results.</p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                {ratingFilter !== "all" && <button type="button" onClick={() => setRatingFilter("all")} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold text-zinc-300">Clear Rating</button>}
                                {!!selectedGenres.length && <button type="button" onClick={() => setSelectedGenres([])} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold text-zinc-300">Clear Genre</button>}
                                {statusFilter !== "all" && <button type="button" onClick={() => setStatusFilter("all")} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold text-zinc-300">Clear Status</button>}
                                <button type="button" onClick={clearFilters} className="rounded-xl px-3 py-2 text-[10px] font-black" style={{ background: hexToRgba(derivedAccent, .14), color: derivedAccent }}>Reset Filters</button>
                            </div>
                        </div>
                    )}
                    {!!activeItems.length && !activeFolder.smartList && (
                        <>
                            <div className="my-4 border-t border-white/10 sm:my-6" />
                            <SuggestionRail
                                title="You might also add"
                                subtitle={`Recommendations shaped by ${activeStats.topGenre.toLowerCase()} and titles already in this list.`}
                                items={contextSuggestions}
                                existing={existingKeys}
                                onAdd={addItem}
                            />
                        </>
                    )}
                </>
                }
            </main>
        }
        <Toast message={status?.message || ""} type={status?.type || "success"} isVisible={Boolean(status)} onClose={() => setStatus(null)} />
        <AnimatePresence>
            {undo && (
                <motion.div
                    initial={{ opacity: 0, y: 22, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 18, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 430, damping: 35 }}
                    className="fixed bottom-[calc(.65rem+env(safe-area-inset-bottom))] left-2.5 right-2.5 z-[10070] sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-[min(430px,calc(100vw-2rem))] sm:-translate-x-1/2"
                >
                    <div className="relative overflow-hidden rounded-[20px] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(38,31,18,.94),rgba(18,16,13,.96))] px-2.5 py-2 shadow-[0_20px_60px_rgba(0,0,0,.60),0_8px_28px_rgba(245,158,11,.10),inset_0_1px_0_rgba(255,255,255,.11)] backdrop-blur-[28px] saturate-150 sm:rounded-[22px] sm:px-3 sm:py-2.5">
                        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/55 to-transparent" />
                        <div className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-amber-400/[0.10] blur-3xl" />
                        <div className="relative flex min-w-0 items-center gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border border-amber-300/20 bg-gradient-to-br from-amber-300/20 to-orange-500/10 text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,.10),0_5px_16px_rgba(245,158,11,.12)] sm:h-10 sm:w-10 sm:rounded-[14px]">
                                <RotateCcw className="h-3.5 w-3.5 stroke-[2.4] sm:h-4 sm:w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[7px] font-black uppercase tracking-[.16em] text-amber-300/65 sm:text-[8px]">Recent change</p>
                                <p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-100 sm:text-[11px]">{undo.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => undo.action()}
                                className="shrink-0 rounded-[12px] border border-amber-300/25 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 px-2.5 py-1.5 text-[10px] font-black text-black shadow-[0_5px_15px_rgba(245,158,11,.20),inset_0_1px_1px_rgba(255,255,255,.48)] transition hover:brightness-105 active:scale-95 sm:px-3 sm:py-2 sm:text-[11px]"
                            >
                                Undo
                            </button>
                        </div>
                        <div className="absolute inset-x-2.5 bottom-0 h-[2px] overflow-hidden rounded-full bg-amber-100/[0.07]">
                            <motion.div
                                key={undo.message}
                                initial={{ scaleX: 1 }}
                                animate={{ scaleX: 0 }}
                                transition={{ duration: 5, ease: "linear" }}
                                className="h-full origin-left bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500"
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {mobileCardActionFolder && createPortal(
            <div className="fixed inset-0 z-[10035] flex items-end justify-center sm:hidden">
                <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setMobileCardActionId(null)} aria-label="Close collection actions" />
                <motion.div initial={{ y: 70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 70, opacity: 0 }} className="relative z-10 w-full rounded-t-[30px] border border-white/10 bg-zinc-950/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-20px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl">
                    <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
                    <div className="mb-4 flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-white">{mobileCardActionFolder.name}</p><p className="mt-0.5 text-[10px] text-zinc-600">Quick collection actions</p></div><button type="button" onClick={() => setMobileCardActionId(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-500"><X className="h-4 w-4" /></button></div>
                    <div className="grid grid-cols-4 gap-2">
                        <button type="button" onClick={() => { const id = mobileCardActionFolder.id; setMobileCardActionId(null); openFolder(id); }} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-[9px] font-bold text-zinc-200"><FolderOpen className="h-4 w-4" />Open</button>
                        <button type="button" onClick={() => { const folder = mobileCardActionFolder; setMobileCardActionId(null); openEdit(folder); }} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-[9px] font-bold text-zinc-200"><Edit3 className="h-4 w-4" />Edit</button>
                        <button type="button" onClick={() => { const folder = mobileCardActionFolder; setMobileCardActionId(null); togglePin(folder); }} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-[9px] font-bold text-zinc-200">{mobileCardActionFolder.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}{mobileCardActionFolder.pinned ? "Unpin" : "Pin"}</button>
                        <button type="button" onClick={() => { const folder = mobileCardActionFolder; setMobileCardActionId(null); shareFolder(folder); }} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2 py-3 text-[9px] font-bold text-zinc-200"><Share2 className="h-4 w-4" />Share</button>
                    </div>
                </motion.div>
            </div>, document.body
        )}

        {!isMobileControls && activeFolder && (crossListDragItems.length > 0 || (selectionMode && selectedItems.length > 0)) && createPortal(
            <motion.aside initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="fixed right-4 top-1/2 z-[10020] w-56 -translate-y-1/2 overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950/90 shadow-[0_24px_80px_rgba(0,0,0,.62)] backdrop-blur-2xl">
                <div className="border-b border-white/[0.07] p-3"><p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-300">Add to another list</p><p className="mt-0.5 truncate text-xs font-black text-white">{(crossListDragItems.length ? crossListDragItems : selectedItems).length === 1 ? (crossListDragItems.length ? crossListDragItems : selectedItems)[0]?.title : `${(crossListDragItems.length ? crossListDragItems : selectedItems).length} selected titles`}</p><p className="mt-1 text-[9px] text-zinc-600">Drag the selection onto a collection to copy.</p></div>
                <div className="max-h-[56vh] space-y-1 overflow-y-auto p-2">
                    {folders.filter(folder => !folder.smartList && !folder.archived && folder.id !== activeFolder.id).map(folder => <div key={`drop-${folder.id}`} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={event => { event.preventDefault(); const transferItems = crossListDragItems.length ? crossListDragItems : selectedItems; copyItemsToFolder(folder, transferItems); setCrossListDragItems([]); setDraggedItemKey(null); }} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 transition hover:border-violet-400/30 hover:bg-violet-500/[0.08]"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-[11px] font-black text-zinc-200">{folder.name}</p><p className="mt-0.5 text-[9px] text-zinc-600">{folder.items.length} titles</p></div><ListPlus className="h-4 w-4 shrink-0 text-violet-300" /></div></div>)}
                    {!folders.some(folder => !folder.smartList && !folder.archived && folder.id !== activeFolder.id) && <p className="px-2 py-5 text-center text-[10px] text-zinc-600">No other manual list available.</p>}
                </div>
            </motion.aside>, document.body
        )}

        {commandOpen && createPortal(
            <div className="fixed inset-0 z-[10060] flex items-start justify-center px-3 pt-[10vh] sm:pt-[14vh]">
                <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setCommandOpen(false)} aria-label="Close command palette" />
                <motion.div initial={{ opacity: 0, y: -10, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative z-10 w-full max-w-xl overflow-hidden rounded-[26px] border border-white/10 bg-zinc-950/95 shadow-[0_30px_100px_rgba(0,0,0,.72)] backdrop-blur-3xl">
                    <div className="relative border-b border-white/[0.07] p-3.5"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input autoFocus value={commandQuery} onChange={event => setCommandQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setCommandIndex(index => (index + 1) % Math.max(1, commandEntries.length)); } else if (event.key === "ArrowUp") { event.preventDefault(); setCommandIndex(index => (index - 1 + Math.max(1, commandEntries.length)) % Math.max(1, commandEntries.length)); } else if (event.key === "Enter") { event.preventDefault(); runCommand(commandIndex); } else if (event.key === "Escape") setCommandOpen(false); }} placeholder="Search commands, lists or titles..." className="h-10 w-full bg-transparent pl-8 pr-12 text-sm text-white outline-none placeholder:text-zinc-600" /><span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[8px] font-bold text-zinc-600">ESC</span></div>
                    <div className="max-h-[55vh] overflow-y-auto p-2">
                        {commandEntries.length ? commandEntries.map((entry, index) => { const Icon = entry.icon; return <button type="button" key={entry.id} onMouseEnter={() => setCommandIndex(index)} onClick={() => runCommand(index)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${commandIndex === index ? "bg-white/[0.08]" : "hover:bg-white/[0.045]"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${commandIndex === index ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-300" : "border-white/[0.06] bg-white/[0.025] text-zinc-500"}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-zinc-100">{entry.label}</span><span className="mt-0.5 block truncate text-[9px] text-zinc-600">{entry.subtitle}</span></span></button>; }) : <div className="py-10 text-center"><Search className="mx-auto h-5 w-5 text-zinc-700" /><p className="mt-2 text-xs font-bold text-zinc-500">No command found</p></div>}
                    </div>
                    <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-2 text-[8px] font-semibold text-zinc-700"><span>↑↓ Navigate</span><span>↵ Run</span><span className="ml-auto">Alt + P</span></div>
                </motion.div>
            </div>, document.body
        )}

        {showFilters && createPortal(
            <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center sm:p-5">
                <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowFilters(false)} aria-label="Close filters" />
                <motion.div initial={{ y: 70, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="relative z-10 max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[32px] sm:p-5">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-amber-400"><Filter className="h-3.5 w-3.5" />Advanced filters</div>
                            <h2 className="mt-1 text-lg font-black text-white">Refine this list</h2>
                            <p className="mt-1 text-[10px] text-zinc-500">Combine genres, library status, release era and rating.</p>
                        </div>
                        <button type="button" onClick={() => setShowFilters(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
                    </div>

                    <div className="space-y-5">
                        <section>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Genres</p>
                            <div className="flex flex-wrap gap-1.5">
                                <button type="button" onClick={() => setSelectedGenres([])} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${selectedGenres.length === 0 ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-white/[0.06] bg-white/[0.03] text-zinc-400"}`}>All</button>
                                {availableGenres.map(genre => {
                                    const active = selectedGenres.includes(genre);
                                    return <button type="button" key={genre} onClick={() => setSelectedGenres(current => active ? current.filter(value => value !== genre) : [...current, genre])} className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition ${active ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}>{genre}</button>;
                                })}
                            </div>
                        </section>

                        <section>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Library status</p>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                                {(["all", "unwatched", "watched", "rated", "watchlist"] as StatusFilter[]).map(value => (
                                    <button type="button" key={value} onClick={() => setStatusFilter(value)} className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold ${statusFilter === value ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-white/[0.06] bg-white/[0.03] text-zinc-400"}`}>
                                        {value === "watchlist" ? "Watchlist" : value[0].toUpperCase() + value.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Release</p>
                            <div className="flex flex-wrap gap-1.5">
                                {(["all", "upcoming", "2020s", "2010s", "2000s", "older"] as ReleaseFilter[]).map(value => (
                                    <button type="button" key={value} onClick={() => setReleaseFilter(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${releaseFilter === value ? "border-sky-500/25 bg-sky-500/10 text-sky-300" : "border-white/[0.06] bg-white/[0.03] text-zinc-400"}`}>
                                        {value === "all" ? "All" : value === "upcoming" ? "Upcoming" : value === "older" ? "Before 2000" : value}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">TMDB rating</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {(["all", "8+", "7+", "6+"] as RatingFilter[]).map(value => (
                                    <button type="button" key={value} onClick={() => setRatingFilter(value)} className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold ${ratingFilter === value ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-white/[0.06] bg-white/[0.03] text-zinc-400"}`}>{value === "all" ? "All" : value}</button>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-zinc-950 pt-4">
                        <button type="button" onClick={clearFilters} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-zinc-300">Reset</button>
                        <button type="button" onClick={() => setShowFilters(false)} className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-xs font-black text-black">Apply</button>
                    </div>
                </motion.div>
            </div>,
            document.body,
        )}

        {showSortMenu && createPortal(
            <div className="fixed inset-0 z-[10025]">
                <button type="button" className={`absolute inset-0 ${isMobileControls ? "bg-black/45 backdrop-blur-[2px]" : "bg-transparent"}`} onClick={() => setShowSortMenu(false)} aria-label="Close sort menu" />
                <motion.div
                    initial={isMobileControls
                        ? { opacity: 0, y: 32, scale: .99 }
                        : { opacity: 0, y: sortMenuPosition.placement === "top" ? 7 : -7, scale: .975 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: isMobileControls ? 24 : sortMenuPosition.placement === "top" ? 5 : -5, scale: .985 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] overflow-hidden rounded-[28px] border border-white/15 bg-zinc-950/72 p-2 shadow-[0_24px_90px_rgba(0,0,0,.66),inset_0_1px_1px_rgba(255,255,255,.12)] backdrop-blur-3xl saturate-150 sm:inset-x-auto sm:bottom-auto sm:rounded-[22px] sm:overflow-y-auto sm:overscroll-contain sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
                    style={isMobileControls ? undefined : {
                        top: sortMenuPosition.top,
                        left: sortMenuPosition.left,
                        width: sortMenuPosition.width,
                        maxHeight: sortMenuPosition.maxHeight,
                        transformOrigin: sortMenuPosition.placement === "top" ? "bottom right" : "top right",
                    }}
                    role="listbox"
                    aria-label="Sort titles"
                >
                    <div className="mb-1 flex items-center justify-between px-2.5 pb-1 pt-1 sm:hidden">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[.14em] text-zinc-500">Sort by</p>
                            <p className="mt-0.5 text-sm font-bold text-white">Choose an order</p>
                        </div>
                        <button type="button" onClick={() => setShowSortMenu(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-400"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="space-y-1">
                        {SORT_OPTIONS.map(option => {
                            const selected = sortBy === option.value;
                            const disabled = option.value === "custom" && Boolean(activeFolder?.smartList);
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    disabled={disabled}
                                    onClick={() => { setSortBy(option.value); setShowSortMenu(false); }}
                                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] sm:py-2 ${disabled ? "cursor-not-allowed opacity-35" : "hover:bg-white/[0.07]"}`}
                                    style={selected ? { background: hexToRgba(derivedAccent, .13), boxShadow: `inset 0 0 0 1px ${hexToRgba(derivedAccent, .24)}` } : undefined}
                                >
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className={`text-xs font-bold ${selected ? "text-white" : "text-zinc-200"}`}>{option.label}</span>
                                        <span className="mt-0.5 text-[9px] text-zinc-600">{disabled ? "Unavailable for Smart Lists" : option.description}</span>
                                    </span>
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: selected ? hexToRgba(derivedAccent, .5) : "rgba(255,255,255,.10)", background: selected ? derivedAccent : "rgba(255,255,255,.03)" }}>
                                        {selected && <Check className="h-3 w-3 stroke-[3] text-black" />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            </div>,
            document.body,
        )}

        {actionItem && createPortal(
            <div className="fixed inset-0 z-[10020] flex items-end justify-center sm:items-center sm:p-5">
                <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setActionItem(null)} aria-label="Close actions" />
                <motion.div initial={{ y: 70, opacity: 0, scale: 0.985 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[32px] sm:p-5">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                            <SmartImage src={imageSource(actionItem.poster, "w500")} alt={actionItem.title} className="absolute inset-0" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-black text-white">{actionItem.title}</h3>
                            <p className="mt-1 text-[10px] text-zinc-500">{actionItem.type === "tv" ? "Series" : "Movie"} · {yearOf(actionItem.releaseYear)} · {formatAddedAt(actionItem.addedAt)}</p>
                        </div>
                        <button type="button" onClick={() => setActionItem(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
                    </div>

                    <div className="space-y-5">
                        <section>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Library status</p>
                            <div className="grid grid-cols-3 gap-1.5">
                                <button type="button" onClick={() => toggleWatchlist(actionItem)} className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[10px] font-bold active:scale-[0.98] ${watchlistKeys.has(itemKey(actionItem)) ? "border-blue-500/20 bg-blue-500/10 text-blue-300" : "border-white/10 bg-white/[0.04] text-zinc-300"}`}>
                                    {watchlistKeys.has(itemKey(actionItem)) ? <BookmarkMinus className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                                    <span>{watchlistKeys.has(itemKey(actionItem)) ? "Remove Watchlist" : "Add Watchlist"}</span>
                                </button>
                                <button type="button" onClick={() => toggleHistory(actionItem)} className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[10px] font-bold active:scale-[0.98] ${watchHistory.has(itemKey(actionItem)) ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-zinc-300"}`}>
                                    <Check className="h-4 w-4" />
                                    <span>{watchHistory.has(itemKey(actionItem)) ? "Remove History" : "Mark Watched"}</span>
                                </button>
                                <button type="button" onClick={() => { setManageListItems([actionItem]); setActionItem(null); }} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-violet-500/15 bg-violet-500/[0.07] px-2 py-3 text-[10px] font-bold text-violet-300 active:scale-[0.98]">
                                    <ListChecks className="h-4 w-4" />
                                    <span>Manage List</span>
                                </button>
                            </div>
                        </section>

                        <section>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Streaming in {WATCH_REGION}</p>
                            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"><ProviderRow providers={actionItem.providers} /></div>
                        </section>

                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => toggleFavorite(actionItem)} className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-bold ${favoriteKeys.has(itemKey(actionItem)) ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/[0.05] text-white"}`}>
                                <Heart className={`h-4 w-4 ${favoriteKeys.has(itemKey(actionItem)) ? "fill-current" : ""}`} />
                                {favoriteKeys.has(itemKey(actionItem)) ? "Unfavorite" : "Favorite"}
                            </button>
                            <button type="button" onClick={() => { navigate(`/${actionItem.type}/${actionItem.id}`); setActionItem(null); }} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-xs font-bold text-white">
                                <Info className="h-4 w-4" />Open Details
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>,
            document.body,
        )}

        {selectionMode && createPortal(
            <div className="fixed inset-x-0 bottom-0 z-[10015] px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-5">
                <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-auto flex max-w-3xl items-center gap-1.5 overflow-x-auto rounded-[24px] border border-white/10 bg-zinc-950/95 p-2 shadow-[0_20px_70px_rgba(0,0,0,.68)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex min-w-[58px] shrink-0 flex-col px-2">
                        <span className="text-xs font-black text-white">{selectedItems.length}</span><span className="text-[8px] font-bold uppercase tracking-wide text-zinc-600">Selected</span>
                    </div>
                    {[
                        [ListChecks, "Manage list", () => selectedItems.length && setManageListItems(selectedItems), "text-violet-300"],
                        [Check, "Watched", bulkMarkWatched, "text-emerald-300"],
                        [Bookmark, "Watchlist", bulkAddWatchlist, "text-blue-300"],
                        [Heart, "Favourite", bulkFavorite, "text-rose-300"],
                        [Trash2, "Delete", bulkDelete, activeFolder?.smartList ? "text-zinc-600" : "text-red-300"],
                    ].map(([Icon, label, action, color]: any) => <button type="button" key={label} onClick={action} disabled={!selectedItems.length || (label === "Delete" && activeFolder?.smartList)} className={`flex min-w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-2 py-2.5 text-[9px] font-bold transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-35 ${color}`}><Icon className="h-4 w-4" /><span>{label}</span></button>)}
                    <button type="button" onClick={() => { setSelectionMode(false); setSelectedKeys(new Set()); }} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
                </motion.div>
            </div>,
            document.body,
        )}

        {!!manageListItems.length && createPortal(
            <div className="fixed inset-0 z-[10030] flex items-end justify-center sm:items-center sm:p-5">
                <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setManageListItems([])} aria-label="Close manage list" />
                <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 max-h-[86dvh] w-full max-w-md overflow-hidden rounded-t-[30px] border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-[30px]">
                    <div className="flex items-center justify-between border-b border-white/[0.07] p-4">
                        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-300">Manage list</p><h3 className="mt-0.5 text-base font-black text-white">{manageListItems.length === 1 ? manageListItems[0].title : `${manageListItems.length} selected titles`}</h3><p className="mt-0.5 text-[10px] text-zinc-500">Tap a list to add or remove {manageListItems.length === 1 ? "this title" : "the selection"}.</p></div>
                        <button type="button" onClick={() => setManageListItems([])} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="max-h-[62dvh] space-y-1.5 overflow-y-auto p-3">
                        {orderedFolders.map(folder => {
                            const membershipCount = manageListItems.filter(item => folder.items.some(existing => itemKey(existing) === itemKey(item))).length;
                            const allInside = membershipCount === manageListItems.length;
                            const partial = membershipCount > 0 && !allInside;
                            return <button type="button" key={folder.id} disabled={folder.smartList} onClick={() => toggleManagedFolder(folder)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${folder.smartList ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] opacity-55" : allInside ? "border-violet-400/20 bg-violet-500/10" : "border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.05]"}`}>
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${folder.smartList ? "border-violet-400/15 bg-violet-500/8 text-violet-300" : allInside ? "border-violet-400/20 bg-violet-500/15 text-violet-200" : "border-white/[0.07] bg-zinc-900 text-zinc-500"}`}>{folder.smartList ? <SlidersHorizontal className="h-4 w-4" /> : allInside ? <Check className="h-4 w-4 stroke-[3]" /> : partial ? <span className="h-2 w-2 rounded-full bg-violet-400" /> : <Plus className="h-4 w-4" />}</span>
                                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-zinc-100">{folder.name}</span><span className="mt-0.5 block truncate text-[9px] text-zinc-600">{folder.smartList ? `Smart · ${smartRuleSummary(folder.smartRules)}` : allInside ? "In this list" : partial ? `${membershipCount}/${manageListItems.length} already here` : `${folder.items.length} titles`}</span></span>
                                {!folder.smartList && <span className="text-[9px] font-black uppercase tracking-wide text-zinc-600">{allInside ? "Remove" : "Add"}</span>}
                            </button>;
                        })}
                    </div>
                    <div className="border-t border-white/[0.07] p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:pb-3"><p className="text-center text-[9px] leading-relaxed text-zinc-600">Smart Lists are rule-controlled, so direct membership changes are disabled for them.</p></div>
                </motion.div>
            </div>,
            document.body,
        )}

        {quickPeekItem && createPortal(
            <div className="fixed inset-0 z-[10025] flex items-end justify-center sm:items-center sm:p-5">
                <button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={() => setQuickPeekItem(null)} aria-label="Close quick peek" />
                <motion.div initial={{ y: 70, opacity: 0, scale: .985 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[32px] border border-white/10 bg-zinc-950 shadow-[0_28px_90px_rgba(0,0,0,.75)] sm:rounded-[32px]">
                    <div className="relative h-44 overflow-hidden sm:h-56">
                        <SmartImage src={imageSource(quickPeekItem.backdrop || quickPeekItem.poster, "w1280")} alt={quickPeekItem.title} className="absolute inset-0" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-black/35 to-black/10" />
                        <button type="button" onClick={() => setQuickPeekItem(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-zinc-300 backdrop-blur-xl hover:text-white"><X className="h-4 w-4" /></button>
                        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-zinc-900 shadow-xl"><SmartImage src={imageSource(quickPeekItem.poster, "w500")} alt={quickPeekItem.title} className="absolute inset-0" /></div>
                            <div className="min-w-0 flex-1"><button type="button" onClick={() => { navigate(`/${quickPeekItem.type}/${quickPeekItem.id}`); setQuickPeekItem(null); }} className="text-left"><h2 className="line-clamp-2 text-lg font-black leading-tight text-white hover:underline sm:text-2xl">{quickPeekItem.title}</h2></button><p className="mt-1 text-[10px] font-medium text-zinc-400">{yearOf(quickPeekItem.releaseYear)} · {formatRuntime(quickPeekItem.runtimeMinutes || 0)} · {quickPeekItem.voteAverage?.toFixed(1) || "—"} TMDB</p></div>
                        </div>
                    </div>
                    <div className="space-y-5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
                        <div className="flex flex-wrap gap-1.5">{(quickPeekItem.genres || []).slice(0, 4).map(genre => <span key={genre} className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold text-zinc-400">{genre}</span>)}</div>
                        <p className="text-xs leading-relaxed text-zinc-400 sm:text-sm">{quickPeekItem.overview || "No overview available."}</p>
                        <section><p className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-zinc-600">Streaming in {WATCH_REGION}</p><div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3"><ProviderRow providers={quickPeekItem.providers} /></div></section>
                        <section>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-zinc-600">Trailer</p>
                            <div className="aspect-video overflow-hidden rounded-2xl border border-white/[0.07] bg-black">
                                {quickPeekTrailerLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-red-400" /></div> : quickPeekTrailerKey ? <iframe className="h-full w-full border-0" src={`https://www.youtube.com/embed/${quickPeekTrailerKey}?rel=0&modestbranding=1&playsinline=1`} title={`${quickPeekItem.title} trailer`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="flex h-full flex-col items-center justify-center text-zinc-600"><Play className="mb-2 h-7 w-7" /><span className="text-[10px] font-semibold">No trailer available</span></div>}
                            </div>
                        </section>
                        <div className="grid grid-cols-4 gap-1.5">
                            <button type="button" onClick={() => toggleHistory(quickPeekItem)} className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[9px] font-bold ${watchHistory.has(itemKey(quickPeekItem)) ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-white/[0.07] bg-white/[0.03] text-zinc-400"}`}><Check className="h-4 w-4" />Watched</button>
                            <button type="button" onClick={() => toggleWatchlist(quickPeekItem)} className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[9px] font-bold ${watchlistKeys.has(itemKey(quickPeekItem)) ? "border-blue-500/20 bg-blue-500/10 text-blue-300" : "border-white/[0.07] bg-white/[0.03] text-zinc-400"}`}><Bookmark className="h-4 w-4" />Watchlist</button>
                            <button type="button" onClick={() => toggleFavorite(quickPeekItem)} className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[9px] font-bold ${favoriteKeys.has(itemKey(quickPeekItem)) ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : "border-white/[0.07] bg-white/[0.03] text-zinc-400"}`}><Heart className={`h-4 w-4 ${favoriteKeys.has(itemKey(quickPeekItem)) ? "fill-current" : ""}`} />Favourite</button>
                            <button type="button" onClick={() => { setManageListItems([quickPeekItem]); setQuickPeekItem(null); }} className="flex flex-col items-center gap-1 rounded-2xl border border-violet-500/15 bg-violet-500/[0.07] py-2.5 text-[9px] font-bold text-violet-300"><ListChecks className="h-4 w-4" />Lists</button>
                        </div>
                    </div>
                </motion.div>
            </div>,
            document.body,
        )}

        {showRoulette && <Roulette source="my-list" isOpen={showRoulette} onClose={() => setShowRoulette(false)} items={rouletteItems} />}

        <AnimatePresence>
            {isAddOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[300] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-start sm:p-4 sm:pt-[8vh]"
                    onMouseDown={() => setIsAddOpen(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, y: "100%", scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex h-[85vh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-white/15 bg-zinc-950 shadow-2xl sm:h-auto sm:max-h-[75vh] sm:max-w-2xl sm:rounded-3xl sm:border"
                    >
                        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3.5 backdrop-blur-xl">
                            <div className="flex w-full items-center justify-between sm:w-auto">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,.10)] backdrop-blur-md">
                                        <PlusSquare className="h-4 w-4 stroke-[2.2] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                                    </div>
                                    <span className="text-sm font-semibold tracking-tight text-white">
                                        Add Title
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsAddOpen(false)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition-all hover:bg-white/20 hover:text-white active:scale-90 active:bg-white/30 sm:hidden"
                                    aria-label="Close modal"
                                >
                                    <X className="h-4 w-4 stroke-[2.5]" />
                                </button>
                            </div>

                            <div className="absolute left-1/2 top-2.5 -translate-x-1/2 sm:hidden">
                                <div className="h-1 w-9 rounded-full bg-white/25" />
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsAddOpen(false)}
                                className="hidden h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-300 transition-all hover:bg-white/20 hover:text-white active:scale-90 active:bg-white/30 sm:flex"
                                aria-label="Close modal"
                            >
                                <X className="h-4 w-4 stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 p-3.5 sm:gap-3 sm:p-4">
                            <Search className="h-5 w-5 shrink-0 text-zinc-500" />
                            <input
                                ref={addInputRef}
                                value={inputQuery}
                                onKeyDown={handleSearchKeys}
                                onChange={(e) => setInputQuery(e.target.value)}
                                placeholder="Search movies or series..."
                                className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-600 sm:text-sm"
                            />
                            {isSearching ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                            ) : (
                                inputQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setInputQuery("")}
                                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.10] hover:text-white active:scale-90"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3">
                            {searchResults.map((r, index) => {
                                const name = r.title || r.name || "Untitled";
                                const itemType = r.media_type;
                                const added = existingKeys.has(itemKey({ id: r.id, type: itemType }));

                                return (
                                    <div
                                        key={itemKey({ id: r.id, type: itemType })}
                                        onMouseEnter={() => setSelectedResult(index)}
                                        onClick={() => {
                                            setIsAddOpen(false);
                                            navigate(`/${itemType}/${r.id}`);
                                        }}
                                        className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-left transition active:bg-white/10 ${selectedResult === index ? "bg-white/10" : "hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="relative aspect-[2/3] h-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                                            <SmartImage
                                                src={posterUrl(r.poster_path, "w154")}
                                                alt={name}
                                                className="h-full w-full object-cover"
                                            />
                                            <span className="absolute right-1 top-1 rounded-md border border-white/10 bg-black/65 p-1 backdrop-blur-md">
                                                {itemType === "tv" ? (
                                                    <Tv className="h-2.5 w-2.5 text-cyan-300" />
                                                ) : (
                                                    <Clapperboard className="h-2.5 w-2.5 text-red-500" />
                                                )}
                                            </span>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h4 className="truncate text-sm font-bold text-white transition-colors duration-200 group-hover:text-amber-300">
                                                {name}
                                            </h4>
                                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[10px] text-zinc-400">
                                                <span>{yearOf(r.release_date || r.first_air_date)}</span>
                                                <span>·</span>
                                                <span className="flex items-center">
                                                    <Clock3 className="mr-1 inline h-3 w-3 text-blue-500" />
                                                    <RuntimeText
                                                        id={r.id}
                                                        type={itemType}
                                                        initial={r.runtimeMinutes || 0}
                                                    />
                                                </span>
                                                <span>·</span>
                                                <span className="flex items-center gap-0.5 font-semibold text-amber-300">
                                                    <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                                                    {r.vote_average?.toFixed(1) || "—"}
                                                </span>
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={added}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!added) addItem(r);
                                            }}
                                            className={`flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-xs font-black transition active:scale-95 ${added ? "border-emerald-400/20 bg-emerald-400/15 text-emerald-300" : "border-amber-300/35 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-black shadow-[0_6px_18px_rgba(245,158,11,.18)] hover:brightness-105"}`}
                                        >
                                            {added ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    <span>Added</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="h-3.5 w-3.5" />
                                                    <span>Add</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}

                            {!isSearching && inputQuery && searchResults.length === 0 && (
                                <div className="py-14 text-center text-sm text-zinc-500">
                                    No titles found.
                                </div>
                            )}

                            {!inputQuery && (
                                <div className="py-14 text-center">
                                    <Search className="mx-auto mb-3 h-7 w-7 text-amber-400" />
                                    <p className="text-sm font-bold text-white">Add something great</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        Use ↑ ↓ Enter on desktop for faster adding.
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
            {editingFolder && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[250] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center sm:p-4"
                    onMouseDown={() => setEditingFolderId(null)}
                >
                    <motion.form
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onSubmit={saveFolderDetails}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex max-h-[85vh] w-full flex-col rounded-t-[2rem] border-t border-white/20 bg-zinc-950/95 p-4 shadow-2xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-h-[85vh] sm:max-w-xl sm:rounded-3xl sm:border sm:p-7 sm:pb-7"
                    >
                        <div className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-white/20 sm:hidden" />

                        <div className="mb-3 flex items-center justify-between shrink-0 sm:mb-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-400">
                                    Collection settings
                                </p>
                                <h2 className="mt-0.5 text-lg font-black text-white sm:text-xl">Edit list</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingFolderId(null)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition active:scale-95 hover:bg-white/10 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto pr-1 sm:space-y-5">
                            <label className="block">
                                <span className="text-xs font-bold text-zinc-400">List name</span>
                                <input
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-amber-400/60 focus:bg-white/10 sm:mt-2 sm:py-3"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-bold text-zinc-400">Description</span>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    rows={2}
                                    className="mt-1.5 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-amber-400/60 focus:bg-white/10 sm:mt-2 sm:rows-3 sm:py-3"
                                />
                            </label>

                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                                <button type="button" onClick={() => setEditSmartList(value => !value)} className="flex w-full items-center justify-between text-left">
                                    <span className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10 text-violet-300"><SlidersHorizontal className="h-4 w-4" /></span><span><span className="block text-xs font-black text-white">Smart List</span><span className="mt-0.5 block text-[10px] text-zinc-500">Automatically derives titles from your other My Lists.</span></span></span>
                                    <span className={`h-5 w-9 rounded-full p-0.5 transition ${editSmartList ? "bg-violet-500" : "bg-zinc-800"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${editSmartList ? "translate-x-4" : "translate-x-0"}`} /></span>
                                </button>
                                {editSmartList && <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                                    <div>
                                        <p className="mb-2 text-[9px] font-black uppercase tracking-[.16em] text-zinc-600">Quick templates</p>
                                        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                            {SMART_TEMPLATES.map(template => <button type="button" key={template.id} onClick={() => setEditSmartRules(template.rules)} className="shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[9px] font-bold text-zinc-400 transition hover:border-violet-400/20 hover:text-violet-300">{template.label}</button>)}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label><span className="text-[9px] font-bold text-zinc-600">Media</span><select value={editSmartRules.mediaType || "all"} onChange={e => setEditSmartRules(rules => ({ ...rules, mediaType: e.target.value as any }))} className="mt-1 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-300 outline-none"><option value="all">Movies + Series</option><option value="movie">Movies</option><option value="tv">Series</option></select></label>
                                        <label><span className="text-[9px] font-bold text-zinc-600">Genre</span><select value={editSmartRules.genre || ""} onChange={e => setEditSmartRules(rules => ({ ...rules, genre: e.target.value || undefined }))} className="mt-1 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-300 outline-none"><option value="">Any genre</option>{allLibraryGenres.map(genre => <option key={genre} value={genre}>{genre}</option>)}</select></label>
                                        <label><span className="text-[9px] font-bold text-zinc-600">Minimum TMDB</span><select value={editSmartRules.minRating || 0} onChange={e => setEditSmartRules(rules => ({ ...rules, minRating: Number(e.target.value) || undefined }))} className="mt-1 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-300 outline-none"><option value={0}>Any rating</option><option value={6}>6+</option><option value={7}>7+</option><option value={8}>8+</option></select></label>
                                        <label><span className="text-[9px] font-bold text-zinc-600">Max runtime</span><select value={editSmartRules.maxRuntimeMinutes || 0} onChange={e => setEditSmartRules(rules => ({ ...rules, maxRuntimeMinutes: Number(e.target.value) || undefined }))} className="mt-1 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-300 outline-none"><option value={0}>Any runtime</option><option value={30}>30 min</option><option value={60}>1 hour</option><option value={90}>90 min</option><option value={120}>2 hours</option><option value={180}>3 hours</option></select></label>
                                        <label><span className="text-[9px] font-bold text-zinc-600">Release</span><select value={editSmartRules.release || "all"} onChange={e => setEditSmartRules(rules => ({ ...rules, release: e.target.value as ReleaseFilter }))} className="mt-1 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-300 outline-none"><option value="all">Any era</option><option value="upcoming">Upcoming</option><option value="2020s">2020s</option><option value="2010s">2010s</option><option value="2000s">2000s</option><option value="older">Before 2000</option></select></label>
                                        <label><span className="text-[9px] font-bold text-zinc-600">Recently added</span><select value={editSmartRules.recentDays || 0} onChange={e => setEditSmartRules(rules => ({ ...rules, recentDays: Number(e.target.value) || undefined }))} className="mt-1 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-300 outline-none"><option value={0}>Any time</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
                                    </div>
                                    <label className="block"><span className="text-[9px] font-bold text-zinc-600">Streaming provider</span><input value={editSmartRules.provider || ""} onChange={e => setEditSmartRules(rules => ({ ...rules, provider: e.target.value || undefined }))} placeholder="e.g. Prime Video, Netflix" className="mt-1 w-full rounded-xl border border-white/[0.07] bg-zinc-950 px-3 py-2 text-[10px] text-zinc-300 outline-none placeholder:text-zinc-700" /></label>
                                    <label className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5"><span><span className="block text-[10px] font-black text-zinc-300">Unwatched only</span><span className="text-[9px] text-zinc-600">Remove titles automatically after you mark them watched</span></span><input type="checkbox" checked={Boolean(editSmartRules.unwatchedOnly)} onChange={e => setEditSmartRules(rules => ({ ...rules, unwatchedOnly: e.target.checked || undefined }))} className="h-4 w-4 accent-violet-500" /></label>
                                    <label className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5"><span><span className="block text-[10px] font-black text-zinc-300">Favourites only</span><span className="text-[9px] text-zinc-600">Include only titles you have marked as favourite</span></span><input type="checkbox" checked={Boolean(editSmartRules.favoriteOnly)} onChange={e => setEditSmartRules(rules => ({ ...rules, favoriteOnly: e.target.checked || undefined }))} className="h-4 w-4 accent-violet-500" /></label>
                                    <div className="rounded-xl border border-violet-400/10 bg-violet-500/[0.04] px-3 py-2 text-[9px] leading-relaxed text-violet-200/70">Rules: {smartRuleSummary(editSmartRules)}</div>
                                </div>}
                            </div>

                            <div>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-400"><Palette className="h-3.5 w-3.5" />Folder accent</span>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setEditAccent("auto")} className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold ${editAccent === "auto" ? "border-white/25 bg-white/10 text-white" : "border-white/[0.07] bg-white/[0.025] text-zinc-500"}`}><Palette className="h-3.5 w-3.5" />From cover</button>
                                    {(Object.entries(ACCENTS) as [Exclude<AccentId, "auto">, { label: string; color: string }][]).map(([id, accent]) => <button type="button" key={id} onClick={() => setEditAccent(id)} className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold ${editAccent === id ? "border-white/25 bg-white/10 text-white" : "border-white/[0.07] bg-white/[0.025] text-zinc-500"}`}><span className="h-3 w-3 rounded-full" style={{ background: accent.color, boxShadow: `0 0 10px ${hexToRgba(accent.color, .35)}` }} />{accent.label}</button>)}
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-bold text-zinc-400">Cover mode</span>
                                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:mt-2 sm:grid-cols-4">
                                    {[
                                        ["auto", Sparkles, "Auto"],
                                        ["single", Film, "Single"],
                                        ["collage", Images, "Collage"],
                                        ["rotate", ChevronRight, "Rotate"],
                                    ].map(([value, Icon, label]: any) => (
                                        <button
                                            type="button"
                                            key={value}
                                            onClick={() => setEditCoverMode(value)}
                                            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-bold transition active:scale-95 sm:py-3 ${editCoverMode === value
                                                ? "border-amber-400 bg-amber-400 text-black shadow-lg shadow-amber-400/20"
                                                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                                                }`}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            <span>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <PreferredBackdropPicker
                                folderId={editingFolder.id}
                                items={getSmartFolderItems(editingFolder)}
                                value={editCover}
                                onChange={setEditCover}
                            />
                        </div>

                        <div className="mt-3 shrink-0 border-t border-white/10 pt-3 sm:mt-5 sm:pt-3">
                            <button
                                type="submit"
                                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-black text-black shadow-lg shadow-amber-500/20 transition active:scale-[0.98] hover:brightness-110 sm:py-4"
                            >
                                Save list changes
                            </button>
                        </div>
                    </motion.form>
                </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence>
            {folderToDelete && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                <motion.div initial={{ scale: .96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                        <Trash2 className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-black">Delete “{folderToDelete.name}”?</h2>
                    <p className="mt-2 text-sm text-zinc-500">This removes the list and its titles. You’ll have 5 seconds to undo.</p>
                    <div className="mt-6 flex gap-2">
                        <button onClick={() => setDeleteFolderId(null)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold">Cancel</button>
                        <button onClick={confirmDeleteFolder} className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-black text-white">Delete</button>
                    </div>
                </motion.div>
            </motion.div>}
        </AnimatePresence>
    </div>;
};
export default MyList;