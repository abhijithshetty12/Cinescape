import React, { useState, useEffect, FormEvent, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import { db } from "../firebase.ts";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import {
  X,
  Film,
  Plus,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Search,
  FolderPlus,
  Star,
  Bookmark,
  Sparkles,
  Trash2,
  Tv,
  Calendar,
} from "lucide-react";
import Loading from "../components/Loading.tsx";

interface ListItem {
  id: number;
  title: string;
  type: "movie" | "tv";
  poster: string | null;
  releaseYear: string;
  overview: string;
  voteAverage: number;
}

interface CustomFolder {
  id: string;
  name: string;
  description: string;
  items: ListItem[];
}

interface StatusState {
  type: "success" | "error";
  message: string;
}

interface SearchResultItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
  media_type: "movie" | "tv";
}

const API_KEY = "859afbb4b98e3b467da9c99ac390e950";

const MyList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [folders, setFolders] = useState<CustomFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [newFolderDesc, setNewFolderDesc] = useState<string>("");

  const [inputQuery, setInputQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusState | null>(null);

  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.uid) {
      setFolders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const customWatchlistsRef = collection(
      db,
      `users/${user.uid}/customWatchlists`
    );

    const unsubscribe = onSnapshot(
      customWatchlistsRef,
      (snapshot) => {
        const fetchedFolders: CustomFolder[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || "Untitled Folder",
            description: data.description || "",
            items: Array.isArray(data.items) ? data.items : [],
          };
        });

        setFolders(fetchedFolders);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching Firestore folders:", error);
        setStatus({
          type: "error",
          message: "Failed to load watchlists from cloud.",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!inputQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/search/multi`,
          {
            params: {
              api_key: API_KEY,
              query: inputQuery.trim(),
              language: "en-US",
            },
          }
        );
        const filtered = (response.data.results || []).filter(
          (item: any) => item.media_type === "movie" || item.media_type === "tv"
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [inputQuery]);

  const handleCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !user?.uid) return;

    const folderId = Date.now().toString();
    const newFolder: CustomFolder = {
      id: folderId,
      name: newFolderName.trim(),
      description: newFolderDesc.trim() || "Custom collection.",
      items: [],
    };

    try {
      const folderDocRef = doc(
        db,
        `users/${user.uid}/customWatchlists`,
        folderId
      );
      await setDoc(folderDocRef, newFolder);
      setNewFolderName("");
      setNewFolderDesc("");
      setIsCreatingFolder(false);
    } catch (error) {
      console.error("Error creating folder in Firestore:", error);
      setStatus({ type: "error", message: "Failed to create list." });
    }
  };

  const addItemToActiveFolder = async (itemData: ListItem) => {
    if (!activeFolderId || !user?.uid) return;

    const activeFolder = folders.find((f) => f.id === activeFolderId);
    if (
      activeFolder &&
      activeFolder.items.some(
        (existing) =>
          existing.id === itemData.id && existing.type === itemData.type
      )
    ) {
      setStatus({
        type: "error",
        message: "This title is already in this folder.",
      });
      return;
    }

    const updatedItems = [itemData, ...(activeFolder?.items || [])];

    try {
      const folderDocRef = doc(
        db,
        `users/${user.uid}/customWatchlists`,
        activeFolderId
      );
      await updateDoc(folderDocRef, { items: updatedItems });
      setInputQuery("");
      setSearchResults([]);
      setStatus({ type: "success", message: "Added successfully!" });
    } catch (error) {
      console.error("Error adding item to Firestore:", error);
      setStatus({ type: "error", message: "Failed to update list." });
    }
  };

  const handleSelectSearchResult = (
    e: React.MouseEvent,
    item: SearchResultItem
  ) => {
    e.stopPropagation();
    const newItem: ListItem = {
      id: item.id,
      title: item.title || item.name || "Untitled",
      type: item.media_type,
      poster: item.poster_path
        ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
        : null,
      releaseYear: item.release_date || item.first_air_date || "",
      overview: item.overview || "No description available.",
      voteAverage: item.vote_average
        ? Number(item.vote_average.toFixed(1))
        : 0,
    };

    addItemToActiveFolder(newItem);
  };

  const handleItemClick = (type: "movie" | "tv", id: number) => {
    navigate(`/${type}/${id}`);
  };

  const handleDeleteItem = async (
    folderId: string,
    itemId: number,
    itemType: "movie" | "tv",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!user?.uid) return;

    const targetFolder = folders.find((f) => f.id === folderId);
    if (!targetFolder) return;

    const updatedItems = targetFolder.items.filter(
      (item) => !(item.id === itemId && item.type === itemType)
    );

    try {
      const folderDocRef = doc(
        db,
        `users/${user.uid}/customWatchlists`,
        folderId
      );
      await updateDoc(folderDocRef, { items: updatedItems });
    } catch (error) {
      console.error("Error deleting item from Firestore:", error);
      setStatus({ type: "error", message: "Failed to remove item." });
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;

    try {
      const folderDocRef = doc(
        db,
        `users/${user.uid}/customWatchlists`,
        folderId
      );
      await deleteDoc(folderDocRef);

      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }
    } catch (error) {
      console.error("Error deleting folder from Firestore:", error);
      setStatus({ type: "error", message: "Failed to delete list." });
    }
  };

  const currentFolder = folders.find((f) => f.id === activeFolderId);

  const filteredFolderItems = currentFolder?.items.filter((item) => {
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesSearch = item.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const movieResults = searchResults.filter(
    (result) => result.media_type === "movie"
  );
  const tvResults = searchResults.filter(
    (result) => result.media_type === "tv"
  );

  const renderSearchResultItem = (result: SearchResultItem) => {
    const title = result.title || result.name || "Untitled";
    const year =
      result.release_date || result.first_air_date
        ? new Date(
            result.release_date || result.first_air_date || ""
          ).getFullYear()
        : null;

    return (
      <div
        key={`${result.media_type}-${result.id}`}
        onClick={() => handleItemClick(result.media_type, result.id)}
        className="w-full p-3 flex items-center gap-3.5 hover:bg-white/10 active:bg-white/15 text-left transition-colors group cursor-pointer backdrop-blur-md"
      >
        <div className="w-10 h-14 bg-black rounded-xl overflow-hidden flex-shrink-0 border border-white/10 shadow-inner">
          {result.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <Film className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-300">
            {title}
          </h4>
          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
            {year && (
              <span className="flex items-center gap-0.5">
                <Calendar className="w-3 h-3 text-zinc-400" />
                {year}
              </span>
            )}
            {result.vote_average > 0 && (
              <span className="flex items-center gap-0.5 text-amber-300 font-medium">
                <Star className="w-3 h-3 fill-amber-300" />
                {result.vote_average.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => handleSelectSearchResult(e, result)}
          className="p-2 rounded-full bg-white/10 hover:bg-amber-400 hover:text-black text-amber-300 backdrop-blur-md border border-white/15 active:scale-95 transition-all"
          title="Add to list"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-amber-400 selection:text-black pb-12 relative overflow-x-hidden">
      {!activeFolderId ? (
        <div className="max-w-md sm:max-w-xl md:max-w-5xl mx-auto px-4 py-6 sm:py-10 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 text-zinc-200 hover:text-white hover:bg-white/20 active:scale-95 transition-all shadow-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Your lists
              </h1>
            </div>

            <button
              onClick={() => setIsCreatingFolder(true)}
              className="p-2.5 bg-white/10 backdrop-blur-xl border border-white/15 hover:bg-white/20 rounded-full text-zinc-100 active:scale-95 transition-all shadow-lg"
              title="Create New List"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[11px] font-semibold text-zinc-400 mb-6 uppercase tracking-wider pl-1">
            {folders.length} {folders.length === 1 ? "list" : "lists"}
          </div>

          <AnimatePresence>
            {isCreatingFolder && (
              <motion.form
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                onSubmit={handleCreateFolder}
                className="mb-8 bg-zinc-950/60 backdrop-blur-2xl border border-white/15 p-5 rounded-3xl flex flex-col gap-3.5 shadow-2xl relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                    <FolderPlus className="w-4 h-4" /> Create New List
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(false)}
                    className="p-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="List Title (e.g., Survival Thrillers)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/50 backdrop-blur-md transition-all"
                />
                <input
                  type="text"
                  placeholder="Short description (optional)"
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/50 backdrop-blur-md transition-all"
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-black font-bold text-sm rounded-2xl disabled:opacity-40 active:scale-[0.99] transition-all shadow-lg"
                >
                  Create List
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-6">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex flex-col gap-3.5 p-4 sm:p-5 rounded-3xl bg-zinc-950/50 backdrop-blur-xl border border-white/10 shadow-xl transition-all"
              >
                <div className="flex items-center justify-between group">
                  <button
                    onClick={() => setActiveFolderId(folder.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                      {folder.name}
                    </h2>
                    <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-amber-300 group-hover:translate-x-1 transition-all" />
                  </button>

                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    className="text-zinc-500 hover:text-red-400 p-2 rounded-full hover:bg-white/5 transition-colors"
                    title="Delete list"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {folder.description && (
                  <p className="text-xs text-zinc-400 -mt-2">
                    {folder.description}
                  </p>
                )}

                {folder.items.length > 0 ? (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
                    {folder.items.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleItemClick(item.type, item.id)}
                        className="flex-shrink-0 w-28 sm:w-32 group cursor-pointer"
                      >
                        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-black border border-white/10 group-hover:border-amber-400/50 transition-all shadow-md">
                          {item.poster ? (
                            <img
                              src={item.poster}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-zinc-600">
                              <Film className="w-6 h-6" />
                            </div>
                          )}

                          {item.voteAverage > 0 && (
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-amber-300 flex items-center gap-0.5">
                              <span>{item.voteAverage}</span>
                            </div>
                          )}

                          <div className="absolute bottom-2 right-2 p-1.5 rounded-full bg-cyan-400/80 backdrop-blur-md text-black shadow-md">
                            <Bookmark className="w-3 h-3 fill-black text-black" />
                          </div>
                        </div>

                        <h3 className="mt-2 text-xs font-medium text-zinc-200 truncate group-hover:text-amber-300 transition-colors">
                          {item.title}
                        </h3>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => setActiveFolderId(folder.id)}
                    className="p-5 rounded-2xl border border-dashed border-white/10 bg-white/5 text-center cursor-pointer hover:border-white/20 transition-colors backdrop-blur-sm"
                  >
                    <p className="text-xs text-zinc-400 font-medium">
                      No titles in this folder yet. Tap to open & add items.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-md sm:max-w-xl md:max-w-5xl mx-auto px-4 py-4 sm:py-8 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                setActiveFolderId(null);
                setStatus(null);
                setInputQuery("");
                setSearchResults([]);
              }}
              className="p-2.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 text-zinc-200 hover:text-white hover:bg-white/20 active:scale-95 transition-all shadow-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
              {currentFolder?.name}
            </h1>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <span className="flex items-center gap-1 text-amber-300">
                <Sparkles className="w-3.5 h-3.5" /> Cloud Synced
              </span>
              <span>•</span>
              <span>{currentFolder?.items.length || 0} items</span>
            </div>
          </div>

          <div
            ref={searchContainerRef}
            className="relative mb-6 z-[100] bg-zinc-950/80 backdrop-blur-2xl border border-white/15 p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-2xl"
          >
            <div className="relative w-full">
              <div className="relative flex items-center w-full">
                <Search className="w-4 h-4 absolute left-3.5 text-zinc-400 z-10" />
                <input
                  type="text"
                  placeholder="Search movies or series to add..."
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/50 backdrop-blur-md transition-all"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 absolute right-3.5 animate-spin text-amber-300 z-10" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-zinc-950/95 backdrop-blur-3xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden z-[100] max-h-80 overflow-y-auto no-scrollbar divide-y divide-white/10">
                  {movieResults.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-black/80 text-[10px] font-bold text-amber-300 tracking-wider uppercase backdrop-blur-md flex items-center gap-1.5 sticky top-0 z-20 border-b border-white/10">
                        <Film className="w-3 h-3" /> Movies
                      </div>
                      <div>{movieResults.map(renderSearchResultItem)}</div>
                    </div>
                  )}

                  {tvResults.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-black/80 text-[10px] font-bold text-amber-300 tracking-wider uppercase backdrop-blur-md flex items-center gap-1.5 sticky top-0 z-20 border-b border-white/10">
                        <Tv className="w-3 h-3" /> Series
                      </div>
                      <div>{tvResults.map(renderSearchResultItem)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-3 rounded-2xl mb-6 text-xs font-semibold backdrop-blur-md border ${
                  status.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-red-500/10 border-red-500/20 text-red-300"
                }`}
              >
                {status.message}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 relative z-10">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search list..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-xs text-white focus:outline-none focus:border-amber-400/50 placeholder-zinc-500 transition-all"
              />
            </div>

            <div className="flex items-center justify-center bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1 text-xs self-start sm:self-auto">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  filterType === "all"
                    ? "bg-amber-400 text-black font-bold shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("movie")}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  filterType === "movie"
                    ? "bg-amber-400 text-black font-bold shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => setFilterType("tv")}
                className={`px-3 py-1 rounded-full font-medium transition-all ${
                  filterType === "tv"
                    ? "bg-amber-400 text-black font-bold shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Series
              </button>
            </div>
          </div>

          {filteredFolderItems && filteredFolderItems.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 relative z-0">
              {filteredFolderItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleItemClick(item.type, item.id)}
                  className="relative group flex flex-col cursor-pointer"
                >
                  <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-md">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-600">
                        <Film className="w-6 h-6" />
                      </div>
                    )}

                    {item.voteAverage > 0 && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-amber-300 flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                        <span>{item.voteAverage}</span>
                      </div>
                    )}

                    <button
                      onClick={(e) =>
                        handleDeleteItem(
                          activeFolderId,
                          item.id,
                          item.type,
                          e
                        )
                      }
                      className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md hover:bg-red-500 text-white transition-colors"
                      title="Remove from list"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="mt-2 text-xs font-medium text-zinc-200 truncate group-hover:text-amber-300 transition-colors">
                    {item.title}
                  </h3>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 relative z-0">
              <Film className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-400 font-medium">
                No items match your criteria in this list.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyList;