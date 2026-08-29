import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { collection, deleteDoc, deleteField, doc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { ArrowLeft, BarChart3, Check, ChevronDown, ChevronRight, ChevronUp, Clapperboard, Clock3, Copy, Download, Edit3, Film, FolderPlus, GripVertical, Images, ListPlus, Loader2, MoreHorizontal, Pin, PinOff, Plus, Search, Share2, Sparkles, Star, Trash2, Tv, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { db } from "../firebase.ts";
import Loading from "../components/Loading.tsx";
import Toast from "../components/Toast.tsx";

type MediaType = "movie" | "tv";
type CoverMode = "auto" | "single" | "collage" | "rotate";
type SortMode = "default" | "rating" | "runtime" | "custom";
interface ListItem { id: number; title: string; type: MediaType; poster: string | null; backdrop: string | null; releaseYear: string; overview: string; voteAverage: number; runtimeMinutes?: number; genres?: string[]; order?: number; }
interface CustomFolder { id: string; name: string; description: string; items: ListItem[]; coverImage?: string | null; coverMode?: CoverMode; pinned?: boolean; order?: number; storageVersion?: number; }
interface SearchResultItem { id: number; title?: string; name?: string; poster_path: string | null; backdrop_path?: string | null; release_date?: string; first_air_date?: string; overview: string; vote_average: number; media_type: MediaType; runtimeMinutes?: number; genres?: string[]; }
interface DetailsData { poster: string | null; backdrop: string | null; runtimeMinutes: number; genres: string[]; }
interface StatusState { type: "success" | "error"; message: string; }
interface UndoState { message: string; action: () => Promise<void>; }

const API_KEY = "859afbb4b98e3b467da9c99ac390e950";
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
const normalizeItem = (item: any, index = 0): ListItem => ({ id: Number(item.id), title: item.title || item.name || "Untitled", type: item.type === "tv" ? "tv" : "movie", poster: item.poster || null, backdrop: item.backdrop || null, releaseYear: item.releaseYear || "", overview: item.overview || "", voteAverage: Number(item.voteAverage) || 0, runtimeMinutes: Number(item.runtimeMinutes) || 0, genres: Array.isArray(item.genres) ? item.genres : [], order: Number.isFinite(Number(item.order)) ? Number(item.order) : index });
const normalizeSearch = (item: any, type?: MediaType): SearchResultItem => ({ ...item, media_type: (item.media_type || type) === "tv" ? "tv" : "movie" });

const fetchDetails = (id: number, type: MediaType) => {
    const key = `${type}-${id}`;
    if (!detailsCache.has(key)) detailsCache.set(key, (async () => {
        try {
            const { data } = await axios.get(`${TMDB_BASE}/${type}/${id}`, { params: { api_key: API_KEY, language: "en-US" } });
            return {
                poster: posterUrl(data.poster_path), backdrop: backdropUrl(data.backdrop_path), runtimeMinutes: type === "movie" ? Number(data.runtime) || 0 : Number(data.episode_run_time?.[0]) || 0, genres: Array.isArray(data.genres) ? data.genres.map((g: {
                    name: string;
                }) => g.name).filter(Boolean) : []
            };
        } catch {
            return { poster: null, backdrop: null, runtimeMinutes: 0, genres: [] };
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

const SuggestionRail = ({ title, subtitle, items, existing, onAdd, eyebrow = "For this collection" }: {
    title: string;
    subtitle: string;
    items: SearchResultItem[];
    existing: Set<string>;
    onAdd: (item: SearchResultItem) => Promise<void>;
    eyebrow?: string;
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
                return <article key={key} className="group w-[144px] shrink-0 snap-start sm:w-[168px]">
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
    const [genreFilter, setGenreFilter] = useState("all");
    const [sortBy, setSortBy] = useState<SortMode>("default");
    const [searchQuery, setSearchQuery] = useState("");
    const [showInsights, setShowInsights] = useState(false);

    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editCover, setEditCover] = useState<string | null>(null);
    const [editCoverMode, setEditCoverMode] = useState<CoverMode>("auto");
    const [menuId, setMenuId] = useState<string | null>(null);
    const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
    const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);
    const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);

    const addInputRef = useRef<HTMLInputElement>(null);
    const itemUnsubs = useRef(new Map<string, () => void>());
    const legacyMigrating = useRef(new Set<string>());

    const folderPath = (id: string) => `users/${user!.uid}/customWatchlists/${id}`;
    const itemsPath = (id: string) => `${folderPath(id)}/items`;

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

    const activeStats = useMemo(() => getStats(activeFolder?.items || []), [activeFolder]);

    const availableGenres = useMemo(
        () =>
            Array.from(
                new Set(activeFolder?.items.flatMap((item) => item.genres || []) || []),
            ).sort(),
        [activeFolder],
    );

    const activeFilterCount =
        (filterType !== "all" ? 1 : 0) +
        (genreFilter !== "all" ? 1 : 0) +
        (sortBy !== "default" ? 1 : 0) +
        (searchQuery.trim() ? 1 : 0);

    const canReorder =
        sortBy === "custom" &&
        filterType === "all" &&
        genreFilter === "all" &&
        !searchQuery.trim();

    const filteredItems = useMemo(() => {
        const items = (activeFolder?.items || []).filter(
            (item) =>
                (filterType === "all" || item.type === filterType) &&
                (!searchQuery.trim() ||
                    item.title.toLowerCase().includes(searchQuery.toLowerCase())) &&
                (genreFilter === "all" || item.genres?.includes(genreFilter)),
        );

        return [...items].sort((a, b) =>
            sortBy === "rating"
                ? b.voteAverage - a.voteAverage
                : sortBy === "runtime"
                    ? (b.runtimeMinutes || 0) - (a.runtimeMinutes || 0)
                    : sortBy === "custom"
                        ? (a.order || 0) - (b.order || 0)
                        : 0,
        );
    }, [activeFolder, filterType, genreFilter, searchQuery, sortBy]);

    const existingKeys = useMemo(
        () => new Set((activeFolder?.items || []).map(itemKey)),
        [activeFolder],
    );

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
                meta.set(id, { id, name: data.name || "Untitled List", description: data.description || "", coverImage: data.coverImage || null, coverMode: ["auto", "single", "collage", "rotate"].includes(data.coverMode) ? data.coverMode : "auto", pinned: Boolean(data.pinned), order: Number.isFinite(Number(data.order)) ? Number(data.order) : index, storageVersion: Number(data.storageVersion) || 1, legacyItems: legacy });
                if (!itemUnsubs.current.has(id)) {
                    const unsub = onSnapshot(collection(db, `users/${user.uid}/customWatchlists/${id}/items`), snap => {
                        itemMap.set(id, snap.docs.map((d, i) => normalizeItem(d.data(), i)).sort((a, b) => (a.order || 0) - (b.order || 0)));
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
        if (!activeFolder.items.length) {
            setContextSuggestions([]);
            setSuggestionsLoading(true);
            fetchPopular().then(setSuggestions).finally(() => setSuggestionsLoading(false));
            return;
        } setSuggestions([]);
        const seeds = [...activeFolder.items].sort((a, b) => Number(b.genres?.includes(activeStats.topGenre)) - Number(a.genres?.includes(activeStats.topGenre))).slice(0, 3), cacheKey = seeds.map(itemKey).join("|");
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
    }, [activeFolder?.id, activeFolder?.items.length, activeStats.topGenre]);
    useEffect(() => {
        if (!activeFolder || !user?.uid) return;
        const missing = activeFolder.items.filter(i => !i.runtimeMinutes || !i.poster || !i.backdrop || !i.genres?.length).slice(0, 12);
        if (!missing.length) return;
        let cancelled = false;
        (async () => {
            const details = await Promise.all(missing.map(async item => ({ item, details: await fetchDetails(item.id, item.type) })));
            if (cancelled) return;
            await Promise.all(details.map(({ item, details }) => updateDoc(doc(db, itemsPath(activeFolder.id), itemKey(item)), { poster: details.poster || item.poster || null, backdrop: details.backdrop || item.backdrop || null, runtimeMinutes: details.runtimeMinutes || item.runtimeMinutes || 0, genres: details.genres.length ? details.genres : item.genres || [] }).catch(() => null)));
        })();
        return () => {
            cancelled = true;
        };
    }, [activeFolder?.id, activeFolder?.items.length, user?.uid]);

    const updateFolder = (id: string, values: Partial<CustomFolder>) => user?.uid ? updateDoc(doc(db, folderPath(id)), values as any) : Promise.resolve();
    const openFolder = (id: string) => {
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
        setGenreFilter("all");
        setSortBy("default");
        setShowInsights(false);
        const u = new URL(window.location.href);
        u.searchParams.delete("list");
        window.history.pushState({}, "", u);
    };
    const handleCreateFolder = async (e: FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim() || !user?.uid) return;
        const id = Date.now().toString();
        try {
            await setDoc(doc(db, folderPath(id)), { id, name: newFolderName.trim(), description: newFolderDesc.trim(), coverImage: null, coverMode: "auto", pinned: false, order: folders.length, storageVersion: 2 });
            setNewFolderName("");
            setNewFolderDesc("");
            setIsCreatingFolder(false);
            setStatus({ type: "success", message: "List created." });
        } catch {
            setStatus({ type: "error", message: "Failed to create list." });
        }
    };
    const addItem = async (result: SearchResultItem) => {
        if (!activeFolder || !user?.uid) return;
        if (existingKeys.has(itemKey({ id: result.id, type: result.media_type }))) return;
        const d = await fetchDetails(result.id, result.media_type), minOrder = Math.min(0, ...activeFolder.items.map(i => i.order || 0)) - 1, item: ListItem = { id: result.id, title: result.title || result.name || "Untitled", type: result.media_type, poster: d.poster || posterUrl(result.poster_path) || null, backdrop: d.backdrop || backdropUrl(result.backdrop_path) || null, releaseYear: result.release_date || result.first_air_date || "", overview: result.overview || "No description available.", voteAverage: Number((result.vote_average || 0).toFixed(1)), runtimeMinutes: d.runtimeMinutes, genres: d.genres, order: minOrder };
        try {
            await setDoc(doc(db, itemsPath(activeFolder.id), itemKey(item)), item);
            setStatus({ type: "success", message: "Added to list." });
        } catch {
            setStatus({ type: "error", message: "Failed to add title." });
        }
    };
    const removeItem = async (e: React.MouseEvent, item: ListItem) => {
        e.stopPropagation();
        if (!activeFolder) return;
        const folderId = activeFolder.id;
        try {
            await deleteDoc(doc(db, itemsPath(folderId), itemKey(item)));
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
        setMenuId(null);
    };
    const saveFolderDetails = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingFolder || !editName.trim()) return;
        try {
            await updateFolder(editingFolder.id, { name: editName.trim(), description: editDescription.trim(), coverImage: editCover, coverMode: editCoverMode });
            setEditingFolderId(null);
            setStatus({ type: "success", message: "List updated." });
        } catch {
            setStatus({ type: "error", message: "Failed to update list." });
        }
    };
    const togglePin = async (folder: CustomFolder) => {
        await updateFolder(folder.id, { pinned: !folder.pinned });
        setMenuId(null);
    };
    const duplicateFolder = async (folder: CustomFolder) => {
        if (!user?.uid) return;
        const id = Date.now().toString();
        await setDoc(doc(db, folderPath(id)), { id, name: `${folder.name} Copy`, description: folder.description, coverImage: folder.coverImage || null, coverMode: folder.coverMode || "auto", pinned: false, order: folders.length, storageVersion: 2 });
        await Promise.all(folder.items.map((item, i) => setDoc(doc(db, itemsPath(id), itemKey(item)), { ...item, order: i })));
        setMenuId(null);
        setStatus({ type: "success", message: "List duplicated." });
    };
    const shareFolder = async (folder: CustomFolder) => {
        const u = new URL(window.location.href);
        u.searchParams.set("list", folder.id);
        const text = `${folder.name} — ${folder.items.length} titles`;
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
                    await setDoc(doc(db, folderPath(snapshot.id)), { id: snapshot.id, name: snapshot.name, description: snapshot.description, coverImage: snapshot.coverImage || null, coverMode: snapshot.coverMode || "auto", pinned: snapshot.pinned || false, order: snapshot.order || 0, storageVersion: 2 });
                    await Promise.all(snapshot.items.map(i => setDoc(doc(db, itemsPath(snapshot.id), itemKey(i)), i)));
                    setUndo(null);
                }
            });
        } catch {
            setStatus({ type: "error", message: "Failed to delete list." });
        }
    };
    const clearFilters = () => {
        setFilterType("all");
        setGenreFilter("all");
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

    if (loading) return <Loading />;
    return <div className="min-h-screen overflow-x-hidden bg-black pb-16 font-sans text-white">
        {!activeFolderId ? <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
            <div className="mb-7 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-full border border-white/10 bg-zinc-800/60 p-2.5 text-amber-400">
                        <ListPlus className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Your lists</h1>
                        <p className="mt-1 text-xs text-zinc-500">Your personal cinema library</p>
                    </div>
                </div>
                <button onClick={() => setIsCreatingFolder(true)} className="rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-3 text-black shadow-[0_0_22px_rgba(245,158,11,.25)] transition hover:brightness-110 active:scale-95">
                    <Plus className="h-5 w-5" />
                </button>
            </div>
            <div className="mb-5 flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-[.2em] text-zinc-500">
                    {folders.length} {folders.length === 1 ? "list" : "lists"}
                </span>
                <span className="flex items-center gap-1.5 text-zinc-600">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />Cloud synced</span>
            </div>
            <AnimatePresence>
                {isCreatingFolder && <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleCreateFolder} className="mb-7 rounded-3xl border border-amber-400/20 bg-zinc-950/80 p-5 shadow-2xl backdrop-blur-2xl">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-bold text-amber-300">
                            <FolderPlus className="h-4 w-4" />New list</h2>
                        <button type="button" onClick={() => setIsCreatingFolder(false)} className="p-1 text-zinc-500 hover:text-white">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        <input required value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="List name" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-400/60" />
                        <textarea value={newFolderDesc} onChange={e => setNewFolderDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-400/60" />
                        <button className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-black text-black">Create list</button>
                    </div>
                </motion.form>}
            </AnimatePresence>
            {!folders.length ? <div className="relative flex min-h-[320px] items-end overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-9">
                <EmptyCover />
                <div className="relative z-10 max-w-sm">
                    <span className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">
                        <Sparkles className="h-3.5 w-3.5" />Start your collection</span>
                    <h2 className="mb-2 text-2xl font-black sm:text-3xl">Build a list worth watching.</h2>
                    <p className="text-sm text-zinc-300">Create your first list and fill it with the stories you never want to lose.</p>
                </div>
            </div> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {orderedFolders.map((folder, index) => {
                    const s = getStats(folder.items);
                    return <motion.article draggable onDragStart={() => setDraggedFolderId(folder.id)} onDragOver={e => e.preventDefault()} onDrop={() => moveFolder(folder)} key={folder.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className={`group relative min-h-[320px] overflow-visible rounded-3xl ${menuId === folder.id ? "z-50" : "z-0"}`}>
                        <button onClick={() => openFolder(folder.id)} className="absolute inset-0 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 p-5 text-left shadow-xl transition hover:border-white/20">
                            <div className="pr-10">
                                <div className="flex items-center gap-2">
                                    <h2 className="truncate text-xl font-black transition group-hover:text-amber-300 sm:text-2xl">
                                        {folder.name}
                                    </h2>
                                    {folder.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                                </div>
                                <p className="mt-1 text-xs font-semibold text-zinc-500">
                                    {folder.items.length} {folder.items.length === 1 ? "title" : "titles"}
                                </p>
                            </div>
                            <div className="mt-4 h-[190px]">
                                <FolderPosterPreview folder={folder} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="rounded-full border border-white/10 bg-white/[.04] px-2 py-1 text-[9px] font-bold uppercase text-zinc-300">
                                    {s.movies} Movies · {s.series} Series</span>
                                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[9px] font-bold text-amber-300">
                                    {s.topGenre}
                                </span>
                            </div>
                        </button>
                        <button onClick={e => {
                            e.stopPropagation();
                            setMenuId(menuId === folder.id ? null : folder.id);
                        }} className="absolute right-4 top-4 z-30 rounded-full border border-white/10 bg-black/70 p-2.5 text-zinc-200 backdrop-blur-xl hover:bg-white/10">
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <AnimatePresence>
                            {menuId === folder.id && <motion.div initial={{ opacity: 0, scale: .96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }} onClick={e => e.stopPropagation()} className="absolute right-4 top-14 z-[80] max-h-[310px] w-48 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/98 p-1.5 text-xs shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-xl">
                                {[[Edit3, "Edit", () => openEdit(folder)], [Copy, "Duplicate", () => duplicateFolder(folder)], [Share2, "Share", () => shareFolder(folder)], [Copy, "Copy link", () => copyLink(folder)], [Download, "Export JSON", () => exportFolder(folder)], [folder.pinned ? PinOff : Pin, folder.pinned ? "Unpin" : "Pin", () => togglePin(folder)]].map(([Icon, label, fn]: any) => <button key={label} onClick={fn} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-zinc-300 hover:bg-white/10 hover:text-white">
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </button>)}
                                <div className="my-1 h-px bg-white/10" />
                                <button onClick={() => {
                                    setDeleteFolderId(folder.id);
                                    setMenuId(null);
                                }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-semibold text-red-400 hover:bg-red-500/10">
                                    <Trash2 className="h-3.5 w-3.5" />Delete</button>
                            </motion.div>}
                        </AnimatePresence>
                    </motion.article>;
                })}
            </div>}
        </main> :
            <main className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-8">
                {activeFolder && <>
                    <div className="relative -mx-3 min-h-[280px] overflow-hidden border-y border-white/10 sm:mx-0 sm:min-h-[390px] sm:rounded-3xl sm:border">
                        <CollectionCover folder={activeFolder} hero className="absolute inset-0" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent sm:bg-gradient-to-r sm:from-black/70 sm:via-black/15 sm:to-transparent" />
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
                                <h1 className="text-2xl font-black tracking-tight sm:text-5xl">
                                    {activeFolder.name}
                                </h1>
                                <p className="mt-1 line-clamp-2 max-w-xl text-xs text-zinc-300 sm:mt-2 sm:line-clamp-none sm:text-sm">
                                    {activeFolder.description || "A personal collection of films and series."}
                                </p>
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
                        <button onClick={() => setIsAddOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-black text-black shadow-[0_8px_30px_rgba(245,158,11,.18)] active:scale-[0.98] sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm sm:w-auto">
                            <Plus className="h-4 w-4" />Add titles</button>
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search this list..." className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-xs outline-none placeholder:text-zinc-600 focus:border-amber-400/60 sm:rounded-2xl sm:py-3 sm:text-sm" />
                        </div>
                    </div>
                    <div className="-mx-3 mt-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
                        <div className="flex shrink-0 rounded-xl border border-white/10 bg-white/5 p-1 sm:rounded-2xl">
                            {[["all", "All"], ["movie", "Movies"], ["tv", "Series"]].map(([v, l]) => <button key={v} onClick={() => setFilterType(v as any)} className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition sm:rounded-xl sm:px-4 sm:py-2 sm:text-xs ${filterType === v ? "bg-amber-400 text-black" : "text-zinc-400 hover:text-white"}`}>
                                {l}
                            </button>)}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                            {["all", ...availableGenres.slice(0, 8)].map(g => <button key={g} onClick={() => setGenreFilter(g)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold whitespace-nowrap sm:py-2 sm:text-[11px] ${genreFilter === g ? "border-amber-400 bg-amber-400 text-black" : "border-white/10 bg-white/5 text-zinc-400"}`}>
                                {g === "all" ? "All genres" : g}
                            </button>)}
                        </div>
                        {availableGenres.length > 8 && <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)} className="shrink-0 rounded-xl border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-300 sm:px-3 sm:py-2 sm:text-xs">
                            <option value="all">More genres</option>
                            {availableGenres.map(g => <option key={g}>
                                {g}
                            </option>)}
                        </select>}
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortMode)} className="ml-auto shrink-0 rounded-xl border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 sm:px-3 sm:py-2 sm:text-xs">
                            <option value="default">Recently added</option>
                            <option value="rating">Highest rating</option>
                            <option value="runtime">Longest runtime</option>
                            <option value="custom">Custom order</option>
                        </select>
                    </div>
                    {activeFilterCount > 0 && <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
                        {filterType !== "all" && <button onClick={() => setFilterType("all")} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300 sm:px-3 sm:py-1.5">
                            {filterType === "movie" ? "Movies" : "Series"} ×</button>}{genreFilter !== "all" && <button onClick={() => setGenreFilter("all")} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300 sm:px-3 sm:py-1.5">
                                {genreFilter} ×</button>}{sortBy !== "default" && <button onClick={() => setSortBy("default")} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300 sm:px-3 sm:py-1.5">
                                    {sortBy === "rating" ? "Highest rated" : sortBy === "runtime" ? "Longest runtime" : "Custom order"} ×</button>}{searchQuery && <button onClick={() => setSearchQuery("")} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300 sm:px-3 sm:py-1.5">Search ×</button>}
                        <button onClick={clearFilters} className="text-[10px] font-black text-amber-400">Clear all</button>
                    </div>}
                    {sortBy === "custom" && !canReorder && <p className="mt-2 text-[10px] text-zinc-500 sm:mt-3">Clear search and filters to drag titles into a custom order.</p>}
                    {filteredItems.length ? <div className="mt-4 grid grid-cols-2 gap-x-2.5 gap-y-4 sm:mt-6 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5">
                        {filteredItems.map((item, index) => <motion.article draggable={canReorder} onDragStart={() => setDraggedItemKey(itemKey(item))} onDragOver={e => canReorder && e.preventDefault()} onDrop={() => moveItem(item)} key={itemKey(item)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} className={`group min-w-0 ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}>
                            <div onClick={() => navigate(`/${item.type}/${item.id}`)} className="relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-md transition group-hover:border-amber-400/50 sm:rounded-2xl sm:shadow-lg">
                                <SmartImage src={imageSource(item.poster, "w780")} alt={item.title} className="absolute inset-0" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-70" />
                                {sortBy === "custom" && <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-md border border-white/10 bg-black/65 px-1.5 py-0.5 text-[9px] font-black sm:left-2 sm:top-2 sm:gap-1 sm:rounded-lg sm:px-2 sm:py-1 sm:text-[10px]">
                                    <GripVertical className="h-2.5 w-2.5 text-zinc-400 sm:h-3 sm:w-3" />#{index + 1}
                                </span>}{sortBy !== "custom" && <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-md border border-white/10 bg-black/65 px-1.5 py-0.5 text-[9px] font-black text-amber-300 sm:left-2 sm:top-2 sm:gap-1 sm:rounded-lg sm:px-2 sm:py-1 sm:text-[10px]">
                                    <Star className="h-2.5 w-2.5 fill-amber-300 sm:h-3 sm:w-3" />
                                    {item.voteAverage?.toFixed(1) || "—"}
                                </span>}
                                <span className="absolute right-1.5 top-1.5 rounded-md border border-white/10 bg-black/65 p-1 sm:right-2 sm:top-2 sm:rounded-lg sm:p-1.5">
                                    {item.type === "tv" ? <Tv className="h-2.5 w-2.5 text-cyan-300 sm:h-3 sm:w-3" /> : <Clapperboard className="h-2.5 w-2.5 text-red-500 sm:h-3 sm:w-3" />}
                                </span>
                                <button onClick={e => removeItem(e, item)} className="absolute bottom-1.5 right-1.5 rounded-full border border-white/15 bg-black/70 p-1.5 text-white active:bg-red-500 sm:bottom-2 sm:right-2 sm:p-2 sm:opacity-0 sm:group-hover:opacity-100">
                                    <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                </button>
                            </div>
                            <h2 className="mt-1.5 line-clamp-1 text-xs font-bold text-zinc-200 transition group-hover:text-amber-300 sm:mt-2 sm:line-clamp-2 sm:text-sm">
                                {item.title}
                            </h2>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500 sm:mt-1 sm:gap-2">
                                <span>
                                    {yearOf(item.releaseYear)}
                                </span>
                                {item.runtimeMinutes ? <>
                                    <span>·</span>
                                    <span>
                                        {formatRuntime(item.runtimeMinutes)}
                                    </span>
                                </> : null}
                            </div>
                        </motion.article>)}
                    </div> : !activeFolder.items.length ? <div className="mt-4 rounded-2xl border border-white/[.09] bg-gradient-to-b from-zinc-950 to-black p-4 sm:mt-6 sm:rounded-[28px] sm:p-7">
                        {suggestionsLoading ? (
                            <div className="flex h-44 flex-col items-center justify-center gap-2.5 sm:h-56 sm:gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-amber-400 sm:h-6 sm:w-6" />
                                <span className="text-xs text-zinc-500">Finding movies and series…</span>
                            </div>
                        ) : suggestions.length ? (
                            <>
                                <div className="my-4 border-t border-white/10 sm:my-6" />
                                <SuggestionRail
                                    eyebrow="Discover something"
                                    title="Popular movies & series"
                                    subtitle="Scroll through fresh picks and add any title in one tap."
                                    items={suggestions}
                                    existing={existingKeys}
                                    onAdd={addItem}
                                />
                            </>
                        ) : (
                            <div className="flex h-44 flex-col items-center justify-center text-center sm:h-52">
                                <Film className="mb-2 h-7 w-7 text-zinc-700 sm:mb-3 sm:h-8 sm:w-8" />
                                <h3 className="text-xs font-bold text-zinc-300 sm:text-sm">Couldn’t load recommendations</h3>
                                <p className="mt-1 text-[11px] text-zinc-600 sm:text-xs">Use Add titles above to search directly.</p>
                            </div>
                        )}
                    </div> : (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.025] px-4 py-12 text-center sm:mt-6 sm:rounded-3xl sm:px-6 sm:py-16">
                            <Search className="mx-auto mb-2 h-7 w-7 text-zinc-700 sm:mb-3 sm:h-8 sm:w-8" />
                            <h2 className="text-xs font-bold text-zinc-300 sm:text-base">No matches found</h2>
                            <p className="mt-1 text-[11px] text-zinc-600 sm:text-xs">Try changing your search or filters.</p>
                        </div>
                    )}
                    {!!activeFolder.items.length && (
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
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.95 }}
                    className="fixed bottom-5 left-1/2 z-[350] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between gap-4 overflow-hidden rounded-2xl border border-white/20 bg-zinc-900/75 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-3xl"
                >
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                    <span className="relative z-10 truncate text-xs font-semibold text-zinc-100">
                        {undo.message}
                    </span>
                    <button
                        onClick={() => undo.action()}
                        className="relative z-10 shrink-0 rounded-lg bg-amber-400/10 px-2.5 py-1 text-xs font-black text-amber-300 border border-amber-400/20 backdrop-blur-md transition active:scale-95 hover:bg-amber-400/20"
                    >
                        Undo
                    </button>
                </motion.div>
            )}
        </AnimatePresence>

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
                        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-white/15 bg-zinc-950 shadow-2xl sm:max-h-[75vh] sm:max-w-2xl sm:rounded-3xl sm:border"
                    >
                        <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-white/20 sm:hidden" />

                        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 p-3.5 sm:gap-3 sm:p-4">
                            <Search className="h-5 w-5 shrink-0 text-zinc-500" />
                            <input
                                ref={addInputRef}
                                value={inputQuery}
                                onKeyDown={handleSearchKeys}
                                onChange={(e) => setInputQuery(e.target.value)}
                                placeholder="Search movies or series..."
                                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                            />
                            {isSearching ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                            ) : (
                                inputQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setInputQuery("")}
                                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-400 transition hover:bg-white/20 hover:text-white active:scale-95"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )
                            )}
                            <button
                                type="button"
                                onClick={() => setIsAddOpen(false)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white active:scale-95"
                                aria-label="Close modal"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
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
                                        className={`group flex w-full cursor-pointer items-center gap-3 rounded-2xl p-2 sm:p-2.5 text-left transition ${selectedResult === index ? "bg-white/10" : "hover:bg-white/5"
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
                                            <h4 className="truncate text-sm font-bold text-white transition group-hover:text-amber-400">
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
                                                <span className="flex items-center gap-0.5 text-amber-300 font-semibold">
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
                                            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black transition active:scale-95 ${added
                                                ? "bg-emerald-400/15 text-emerald-300"
                                                : "bg-amber-400 text-black hover:bg-amber-300"
                                                }`}
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
                                    <Sparkles className="mx-auto mb-3 h-7 w-7 text-amber-400" />
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
                                items={editingFolder.items}
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