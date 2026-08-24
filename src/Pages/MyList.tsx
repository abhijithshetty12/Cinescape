import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import { db } from "../firebase.ts";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import {
  ArrowLeft, Calendar, Check, ChevronRight, Clock3, Edit3,
  Film, FolderPlus, Loader2, ListPlus,
  Plus, Search, Sparkles, Star, Trash2, Tv, X,
  Clapperboard,
} from "lucide-react";
import Loading from "../components/Loading.tsx";
import Toast from "../components/Toast.tsx";

interface ListItem {
  id: number;
  title: string;
  type: "movie" | "tv";
  poster: string | null;
  backdrop: string | null;
  releaseYear: string;
  overview: string;
  voteAverage: number;
  runtimeMinutes?: number;
  genres?: string[];
}

interface CustomFolder {
  id: string;
  name: string;
  description: string;
  items: ListItem[];
  coverImage?: string | null;
}

interface SearchResultItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
  media_type: "movie" | "tv";
  runtimeMinutes?: number;
  genres?: string[];
}

interface StatusState {
  type: "success" | "error";
  message: string;
}

const API_KEY = "859afbb4b98e3b467da9c99ac390e950";
const IMAGE_BASE = "https://image.tmdb.org/t/p/";
const TMDB_BASE = "https://api.themoviedb.org/3";
const GENRE_NAMES: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  37: "Western",
  53: "Thriller",
  80: "Crime",
  99: "Documentary",
  878: "Science Fiction",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  10770: "TV Movie",
};

const yearOf = (date?: string) => date ? date.slice(0, 4) : "—";
const formatRuntime = (minutes?: number) => {
  if (!minutes || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h${mins ? `${mins}m` : ""}` : `${mins}m`;
};

const runtimeFromDetails = (data: any, type: "movie" | "tv") => {
  if (type === "movie") return Number(data.runtime) || 0;
  return Number(data.episode_run_time?.[0]) || 0;
};

const posterUrl = (path: string | null | undefined, size = "w780") =>
  path ? `${IMAGE_BASE}${size}${path}` : null;

const backdropUrl = (path: string | null | undefined, size = "original") =>
  path ? `${IMAGE_BASE}${size}${path}` : null;

const imageSource = (path: string | null | undefined) => {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const normalizedPath = path.replace(/^\/?(?:original|w\d+)\//, "/");
  return backdropUrl(normalizedPath);
};

const fetchDetails = async (id: number, type: "movie" | "tv") => {
  try {
    const response = await axios.get(`${TMDB_BASE}/${type}/${id}`, {
      params: { api_key: API_KEY, language: "en-US" },
    });
    return {
      runtimeMinutes: runtimeFromDetails(response.data, type),
      backdrop: backdropUrl(response.data.backdrop_path),
      genres: Array.isArray(response.data.genres)
        ? response.data.genres.map((genre: { name: string }) => genre.name)
        : [],
    };
  } catch {
    return { runtimeMinutes: 0, backdrop: null };
  }
};

const MetaLine = ({ item, compact = false }: { item: { releaseYear?: string; voteAverage?: number; runtimeMinutes?: number }; compact?: boolean }) => (
  <div className={`flex items-center gap-2.5 text-[10px] ${compact ? "text-zinc-300" : "text-zinc-400"}`}>
    {item.releaseYear && item.releaseYear !== "—" && (
      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-emerald-500" />{item.releaseYear}</span>
    )}
    {!!item.voteAverage && (
      <span className="flex items-center gap-1 text-amber-300 font-semibold">
        <Star className="w-3 h-3 fill-amber-300" />{item.voteAverage.toFixed(1)}
      </span>
    )}
    {!!item.runtimeMinutes && (
      <span className="flex items-center gap-1"><Clock3 className="w-3 h-3 text-indigo-400" />{formatRuntime(item.runtimeMinutes)}</span>
    )}
  </div>
);

const FallbackCover = () => {
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let mounted = true;
    axios
      .get("https://api.themoviedb.org/3/movie/popular", {
        params: { api_key: API_KEY, language: "en-US", page: 1 },
      })
      .then((response) => {
        if (mounted)
          setBackdrops(
            (response.data.results ?? [])
              .slice(0, 8)
              .map((item: any) => backdropUrl(item.backdrop_path))
              .filter(Boolean)
          );
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (backdrops.length < 2) return;
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % backdrops.length),
      4200
    );
    return () => window.clearInterval(timer);
  }, [backdrops.length]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-amber-950 via-zinc-950 to-red-950">
      <AnimatePresence mode="sync">
        {backdrops.length ? (
          <motion.img
            key={backdrops[active]}
            src={backdrops[active]}
            alt=""
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{ opacity: 0.58, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <motion.div
            className="absolute inset-0 opacity-30"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            style={{
              backgroundImage:
                "linear-gradient(120deg,#7c2d12,#111827,#991b1b,#422006)",
              backgroundSize: "300% 300%",
            }}
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
    </div>
  );
};

const CoverImage = ({ folder, className = "" }: { folder: CustomFolder; className?: string }) => {
  const [hasError, setHasError] = useState(false);
  const rawSource = folder.coverImage || folder.items.find((item) => item.backdrop)?.backdrop;

  const source = imageSource(rawSource);

  return (
    <div className={`relative overflow-hidden bg-zinc-900 ${className}`}>
      {source && !hasError ? (
        <motion.img
          src={source}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setHasError(true)}
          initial={{ scale: 1.04 }}
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.8 }}
        />
      ) : (
        <FallbackCover />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
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
  const [inputQuery, setInputQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"default" | "rating" | "runtime">("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCover, setEditCover] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.uid) {
      setFolders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const reference = collection(db, `users/${user.uid}/customWatchlists`);
    return onSnapshot(reference, (snapshot) => {
      setFolders(snapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          name: data.name || "Untitled List",
          description: data.description || "",
          coverImage: data.coverImage || null,
          items: Array.isArray(data.items) ? data.items.map((item: any) => ({
            ...item,
            id: Number(item.id),
            type: item.type === "tv" ? "tv" : "movie",
            poster: item.poster || null,
            backdrop: item.backdrop || null,
            releaseYear: item.releaseYear || "",
            voteAverage: Number(item.voteAverage) || 0,
            runtimeMinutes: Number(item.runtimeMinutes) || 0,
            genres: Array.isArray(item.genres) ? item.genres : [],
          })) : [],
        };
      }));
      setLoading(false);
    }, () => {
      setStatus({ type: "error", message: "Failed to load your lists." });
      setLoading(false);
    });
  }, [user?.uid]);

  useEffect(() => {
    const closeSearch = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) setSearchResults([]);
    };
    document.addEventListener("mousedown", closeSearch);
    return () => document.removeEventListener("mousedown", closeSearch);
  }, []);

  useEffect(() => {
    if (!inputQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await axios.get("https://api.themoviedb.org/3/search/multi", {
          params: { api_key: API_KEY, query: inputQuery.trim(), language: "en-US" },
        });
        const baseResults = (response.data.results || []).filter((item: any) => item.media_type === "movie" || item.media_type === "tv").slice(0, 12);
        const enriched = await Promise.all(baseResults.map(async (item: SearchResultItem) => ({
          ...item,
          ...(await fetchDetails(item.id, item.media_type)),
        })));
        setSearchResults(enriched);
      } catch {
        setStatus({ type: "error", message: "Search failed. Please try again." });
      } finally {
        setIsSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [inputQuery]);

  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const availableGenres = useMemo(() => Array.from(new Set(
    activeFolder?.items.flatMap((item) => item.genres || []) ?? []
  )).sort(), [activeFolder]);

  const filteredItems = useMemo(() => {
    const items = activeFolder?.items.filter((item) => {
      const matchesType = filterType === "all" || item.type === filterType;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = genreFilter === "all" || item.genres?.includes(genreFilter);
      return matchesType && matchesSearch && matchesGenre;
    }) ?? [];

    return [...items].sort((a, b) => {
      if (sortBy === "rating") return b.voteAverage - a.voteAverage;
      if (sortBy === "runtime") return (b.runtimeMinutes || 0) - (a.runtimeMinutes || 0);
      return 0;
    });
  }, [activeFolder, filterType, genreFilter, searchQuery, sortBy]);

  useEffect(() => {
    if (!activeFolder || !user?.uid) return;
    const itemsWithoutDetails = activeFolder.items.filter((item) => !item.runtimeMinutes || !item.backdrop || !item.genres?.length);
    if (!itemsWithoutDetails.length) return;
    let cancelled = false;
    const enrichItems = async () => {
      const detailEntries = await Promise.all(itemsWithoutDetails.map(async (item) => ({
        key: `${item.type}-${item.id}`,
        ...(await fetchDetails(item.id, item.type)),
      })));
      if (cancelled) return;
      const detailMap = new Map(detailEntries.map((entry) => [entry.key, entry]));
      const enrichedItems = activeFolder.items.map((item) => ({
        ...item,
        runtimeMinutes: detailMap.get(`${item.type}-${item.id}`)?.runtimeMinutes || item.runtimeMinutes || 0,
        backdrop: detailMap.get(`${item.type}-${item.id}`)?.backdrop || item.backdrop || null,
        genres: detailMap.get(`${item.type}-${item.id}`)?.genres?.length
          ? detailMap.get(`${item.type}-${item.id}`)?.genres
          : item.genres || [],
      }));
      if (enrichedItems.some((item, index) =>
        item.runtimeMinutes !== activeFolder.items[index].runtimeMinutes ||
        item.backdrop !== activeFolder.items[index].backdrop
      )) {
        try {
          await updateFolder(activeFolder.id, { items: enrichedItems });
        } catch {
          setStatus({ type: "error", message: "Could not refresh title details." });
        }
      }
    };
    enrichItems();
    return () => { cancelled = true; };
  }, [activeFolder, user?.uid]);

  const updateFolder = async (folderId: string, values: Partial<CustomFolder>) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, `users/${user.uid}/customWatchlists`, folderId), values);
  };

  const handleCreateFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!newFolderName.trim() || !user?.uid) return;
    const id = Date.now().toString();
    try {
      await setDoc(doc(db, `users/${user.uid}/customWatchlists`, id), {
        id,
        name: newFolderName.trim(),
        description: newFolderDesc.trim(),
        coverImage: null,
        items: [],
      });
      setNewFolderName("");
      setNewFolderDesc("");
      setIsCreatingFolder(false);
      setStatus({ type: "success", message: "List created." });
    } catch {
      setStatus({ type: "error", message: "Failed to create list." });
    }
  };

  const addItemToActiveFolder = async (item: ListItem) => {
    if (!activeFolder || !user?.uid) return;
    if (activeFolder.items.some((existing) => existing.id === item.id && existing.type === item.type)) {
      setStatus({ type: "error", message: "This title is already in the list." });
      return;
    }
    try {
      await updateFolder(activeFolder.id, { items: [item, ...activeFolder.items] });
      setInputQuery("");
      setSearchResults([]);
      setStatus({ type: "success", message: "Added to list." });
    } catch {
      setStatus({ type: "error", message: "Failed to update list." });
    }
  };

  const handleSelectSearchResult = async (event: React.MouseEvent, result: SearchResultItem) => {
    event.stopPropagation();
    await addItemToActiveFolder({
      id: result.id,
      title: result.title || result.name || "Untitled",
      type: result.media_type,
      poster: posterUrl(result.poster_path),
      backdrop: result.backdrop_path ? backdropUrl(result.backdrop_path) : null,
      releaseYear: result.release_date || result.first_air_date || "",
      overview: result.overview || "No description available.",
      voteAverage: Number((result.vote_average || 0).toFixed(1)),
      runtimeMinutes: result.runtimeMinutes || 0,
      genres: result.genres || [],
    });
  };

  const handleDeleteItem = async (event: React.MouseEvent, item: ListItem) => {
    event.stopPropagation();
    if (!activeFolder) return;
    try {
      await updateFolder(activeFolder.id, { items: activeFolder.items.filter((existing) => !(existing.id === item.id && existing.type === item.type)) });
    } catch {
      setStatus({ type: "error", message: "Failed to remove item." });
    }
  };

  const handleDeleteFolder = async (event: React.MouseEvent, folderId: string) => {
    event.stopPropagation();
    if (!user?.uid) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/customWatchlists`, folderId));
      if (activeFolderId === folderId) setActiveFolderId(null);
    } catch {
      setStatus({ type: "error", message: "Failed to delete list." });
    }
  };

  const openEditFolder = () => {
    if (!activeFolder) return;
    setEditName(activeFolder.name);
    setEditDescription(activeFolder.description);
    setEditCover(activeFolder.coverImage || activeFolder.items.find((item) => item.backdrop)?.backdrop || null);
    setIsEditingFolder(true);
  };

  const saveFolderDetails = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeFolder || !editName.trim()) return;
    try {
      await updateFolder(activeFolder.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        coverImage: editCover,
      });
      setIsEditingFolder(false);
      setStatus({ type: "success", message: "List details updated." });
    } catch {
      setStatus({ type: "error", message: "Failed to update list details." });
    }
  };

  const renderSearchResult = (result: SearchResultItem) => {
    const title = result.title || result.name || "Untitled";
    const listItem = {
      releaseYear: yearOf(result.release_date || result.first_air_date),
      voteAverage: result.vote_average,
      runtimeMinutes: result.runtimeMinutes,
    };
    return (
      <div key={`${result.media_type}-${result.id}`} onClick={(event) => event.stopPropagation()} className="flex items-center gap-3 p-3 hover:bg-white/10 transition-colors">
        <div className="w-11 h-16 shrink-0 rounded-xl overflow-hidden bg-zinc-900 border border-white/10">
          {result.poster_path ? <img src={posterUrl(result.poster_path, "w92") || ""} alt={title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4 text-zinc-600" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{title}</h4>
          <MetaLine item={listItem} />
        </div>
        <button onClick={(event) => handleSelectSearchResult(event, result)} className="p-2 rounded-full bg-amber-400 text-black hover:bg-amber-300 active:scale-95 transition-all shrink-0" aria-label={`Add ${title}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-12 overflow-x-hidden">
      {!activeFolderId ? (
        <main className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-zinc-800/60 border border-white/10 text-amber-400"><ListPlus className="w-5 h-5" /></div>
              <div><h1 className="text-2xl sm:text-3xl font-black tracking-tight">Your lists</h1><p className="text-xs text-zinc-500 mt-1">Your personal cinema library</p></div>
            </div>
            <button onClick={() => setIsCreatingFolder(true)} className="p-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-black hover:brightness-110 active:scale-95 transition-all shadow-[0_0_22px_rgba(245,158,11,0.25)]" aria-label="Create new list"><Plus className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center justify-between mb-5 text-xs">
            <span className="uppercase tracking-[0.2em] font-bold text-zinc-500">{folders.length} {folders.length === 1 ? "list" : "lists"}</span>
            <span className="flex items-center gap-1.5 text-zinc-600"><Sparkles className="w-3.5 h-3.5 text-amber-500" />Cloud synced</span>
          </div>

          <AnimatePresence>
            {isCreatingFolder && (
              <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} onSubmit={handleCreateFolder} className="mb-7 p-5 rounded-3xl bg-zinc-950/80 border border-amber-400/20 backdrop-blur-2xl shadow-2xl">
                <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-amber-300 flex items-center gap-2"><FolderPlus className="w-4 h-4" />New list</h2><button type="button" onClick={() => setIsCreatingFolder(false)} className="p-1 text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button></div>
                <div className="space-y-3">
                  <input required value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="List name" className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-400/60 placeholder:text-zinc-600" />
                  <textarea value={newFolderDesc} onChange={(event) => setNewFolderDesc(event.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm resize-none focus:outline-none focus:border-amber-400/60 placeholder:text-zinc-600" />
                  <button type="submit" className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-black text-sm font-black active:scale-[0.99] transition-transform">Create list</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {folders.length === 0 ? (
            <div className="relative overflow-hidden rounded-3xl border border-white/10 min-h-[320px] flex items-end p-6 sm:p-9">
              <FallbackCover />
              <div className="relative z-10 max-w-sm"><span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-3"><Sparkles className="w-3.5 h-3.5" />Start your collection</span><h2 className="text-2xl sm:text-3xl font-black mb-2">Build a list worth watching.</h2><p className="text-sm text-zinc-300">Create your first list and fill it with the stories you never want to lose.</p></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {folders.map((folder, index) => (
                <motion.article key={folder.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70 min-h-[250px] shadow-xl">
                  <button onClick={() => setActiveFolderId(folder.id)} className="absolute inset-0 text-left">
                    <CoverImage folder={folder} className="absolute inset-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0"><h2 className="text-xl sm:text-2xl font-black truncate group-hover:text-amber-300 transition-colors">{folder.name}</h2><p className="text-xs text-zinc-300 mt-1 line-clamp-2">{folder.description || "A personal collection of films and series."}</p><p className="text-[10px] text-zinc-400 mt-3 uppercase tracking-widest">{folder.items.length} {folder.items.length === 1 ? "title" : "titles"}</p></div>
                        <ChevronRight className="w-6 h-6 shrink-0 text-amber-300 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </button>
                  <button onClick={(event) => handleDeleteFolder(event, folder.id)} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/45 border border-white/10 text-zinc-300 hover:bg-red-500 hover:text-white transition-colors" aria-label={`Delete ${folder.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </motion.article>
              ))}
            </div>
          )}
        </main>
      ) : (
        <main className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
          <div className="relative min-h-[290px] sm:min-h-[350px] -mx-4 sm:mx-0 rounded-none sm:rounded-3xl overflow-hidden border-y sm:border border-white/10 flex items-end">
            <CoverImage folder={activeFolder || { id: "", name: "", description: "", items: [] }} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <button onClick={() => { setActiveFolderId(null); setStatus(null); setInputQuery(""); setSearchResults([]); }} className="p-3 rounded-full bg-black/35 border border-white/20 backdrop-blur-xl hover:bg-black/60 active:scale-95 transition-all" aria-label="Back to lists"><ArrowLeft className="w-5 h-5" /></button>
              <button onClick={openEditFolder} className="p-3 rounded-full bg-black/35 border border-white/20 backdrop-blur-xl hover:bg-amber-400 hover:text-black active:scale-95 transition-all" aria-label="Edit list"><Edit3 className="w-5 h-5" /></button>
            </div>
            <div className="relative z-10 p-5 sm:p-8 w-full">
              <div className="flex items-center gap-2 text-amber-300 text-[10px] uppercase tracking-[0.2em] font-bold mb-2"><Sparkles className="w-3.5 h-3.5" />Personal collection</div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{activeFolder?.name}</h1>
              <p className="text-sm text-zinc-300 mt-2 max-w-xl">{activeFolder?.description || "A personal collection of films and series."}</p>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-zinc-300"><span>{activeFolder?.items.length || 0} titles</span><span className="text-zinc-600">•</span><span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-400" />Cloud synced</span></div>
            </div>
          </div>

          <div ref={searchContainerRef} className="relative z-30 mt-5 p-3 rounded-3xl bg-zinc-950/90 border border-white/15 backdrop-blur-2xl shadow-2xl">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-zinc-500" />
              <input value={inputQuery} onChange={(event) => setInputQuery(event.target.value)} placeholder="Search movies or series to add..." className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-400/60 placeholder:text-zinc-600" />
              {isSearching && <Loader2 className="absolute right-3.5 w-4 h-4 animate-spin text-amber-300" />}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 max-h-[390px] overflow-y-auto rounded-3xl bg-zinc-950/95 border border-white/20 shadow-2xl divide-y divide-white/10">
                {searchResults.map(renderSearchResult)}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-5 mb-6">
            <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search this list..." className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-400/60 placeholder:text-zinc-600" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 overflow-x-auto">
                {[["all", "All"], ["movie", "Movies"], ["tv", "Series"]].map(([value, label]) => <button key={value} onClick={() => setFilterType(value as typeof filterType)} className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filterType === value ? "bg-amber-400 text-black shadow-lg" : "text-zinc-400 hover:text-white"}`}>{label}</button>)}
              </div>
              <select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950 border border-white/10 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-amber-400/60">
                <option value="all">All genres</option>
                {availableGenres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-950 border border-white/10 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-amber-400/60">
                <option value="default">Sort: Recently added</option>
                <option value="rating">Sort: Highest rating</option>
                <option value="runtime">Sort: Longest runtime</option>
              </select>
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-6 sm:gap-5">
              {filteredItems.map((item) => (
                <motion.article key={`${item.type}-${item.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} className="group min-w-0">
                  <div onClick={() => navigate(`/${item.type}/${item.id}`)} className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 group-hover:border-amber-400/50 shadow-lg cursor-pointer transition-colors">
                    {item.poster ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-zinc-700" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-70" />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/65 border border-white/10 backdrop-blur-md"><MetaLine item={{ voteAverage: item.voteAverage }} compact /></div>
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/65 border border-white/10 backdrop-blur-md text-cyan-300 flex items-center justify-center">
                      {item.type === "tv" ? (
                        <Tv className="w-3 h-3" />
                      ) : (
                        <Clapperboard className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                    <button onClick={(event) => handleDeleteItem(event, item)} className="absolute bottom-2 right-2 p-2 rounded-full bg-black/70 border border-white/15 text-white hover:bg-red-500 active:scale-95 transition-all" aria-label={`Remove ${item.title}`}><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <h2 className="mt-2 text-sm font-bold text-zinc-200 group-hover:text-amber-300 transition-colors line-clamp-2">{item.title}</h2>
                  <MetaLine item={{ releaseYear: yearOf(item.releaseYear), runtimeMinutes: item.runtimeMinutes }} />
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="relative overflow-hidden min-h-[280px] rounded-3xl border border-white/10 flex items-center justify-center text-center p-8"><FallbackCover /><div className="relative z-10"><Film className="w-10 h-10 text-amber-300 mx-auto mb-3" /><h2 className="text-lg font-bold">No titles in this view</h2><p className="text-sm text-zinc-400 mt-1">Search above to add something special.</p></div></div>
          )}
        </main>
      )}

      <Toast
        message={status?.message || ""}
        type={status?.type || "success"}
        isVisible={Boolean(status)}
        onClose={() => setStatus(null)}
      />

      <AnimatePresence>
        {isEditingFolder && activeFolder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4" onMouseDown={() => setIsEditingFolder(false)}>
            <motion.form initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onSubmit={saveFolderDetails} onMouseDown={(event) => event.stopPropagation()} className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-white/15 p-5 sm:p-7 shadow-2xl">
              <div className="flex items-center justify-between mb-5"><div><p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold">Collection settings</p><h2 className="text-xl font-black mt-1">Edit list</h2></div><button type="button" onClick={() => setIsEditingFolder(false)} className="p-2 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button></div>
              <div className="space-y-4">
                <label className="block"><span className="text-xs font-bold text-zinc-400">List name</span><input required value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-400/60" /></label>
                <label className="block"><span className="text-xs font-bold text-zinc-400">Description</span><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} className="mt-2 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm resize-none focus:outline-none focus:border-amber-400/60" /></label>
                <div><span className="text-xs font-bold text-zinc-400">Choose cover image</span><div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 max-h-64 overflow-y-auto pr-1">
                  <button type="button" onClick={() => setEditCover(null)} className={`relative aspect-video min-w-0 rounded-xl overflow-hidden border ${editCover === null ? "border-amber-400 ring-2 ring-amber-400/30" : "border-white/10"} bg-zinc-900`}><div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-500"><Sparkles className="w-4 h-4" /><span className="text-[8px] uppercase">Auto</span></div>{editCover === null && <span className="absolute top-1 right-1 bg-amber-400 text-black rounded-full p-0.5"><Check className="w-3 h-3" /></span>}</button>
                  {activeFolder.items.filter((item) => item.backdrop).map((item) => <button type="button" key={`${item.type}-${item.id}`} onClick={() => setEditCover(item.backdrop)} className={`relative aspect-video min-w-0 rounded-xl overflow-hidden border ${editCover === item.backdrop ? "border-amber-400 ring-2 ring-amber-400/30" : "border-white/10"} bg-zinc-900`}><img src={imageSource(item.backdrop) || ""} alt={item.title} className="block w-full h-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />{editCover === item.backdrop && <span className="absolute top-1 right-1 bg-amber-400 text-black rounded-full p-0.5"><Check className="w-3 h-3" /></span>}<span className="absolute inset-x-1 bottom-1 text-[8px] text-white truncate text-left drop-shadow-md">{item.title}</span></button>)}
                </div></div>
                <button type="submit" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm active:scale-[0.99] transition-transform">Save list changes</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyList;