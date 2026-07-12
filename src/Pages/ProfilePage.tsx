import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { AuthContext } from "../context/AuthContext.tsx";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../firebase.ts";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import ReviewList from "../components/ReviewList.tsx";
import {
  User,
  ChevronRight,
  LogOut,
  Star,
  Heart,
  Film,
  Bookmark,
  History,
  SquarePen,
  Tv,
  Camera,
  Loader2,
  Check,
  ImageOff,
  X,
  MapPin,
  CalendarDays,
  Clock,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import BingeWatchStats from "../components/BingeWatchStats.tsx";
import Toast from "../components/Toast.tsx";

const BASE_POSTER_URL = "https://image.tmdb.org/t/p/original/";
const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";
const MAX_PHOTO_PX = 256;
const PHOTO_QUALITY = 0.72;

const compressImageToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (evt) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = MAX_PHOTO_PX;
        canvas.height = MAX_PHOTO_PX;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        const scale = Math.max(
          MAX_PHOTO_PX / img.width,
          MAX_PHOTO_PX / img.height,
        );
        const scaledW = img.width * scale;
        const scaledH = img.height * scale;
        const offsetX = (MAX_PHOTO_PX - scaledW) / 2;
        const offsetY = (MAX_PHOTO_PX - scaledH) / 2;
        ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

type RecommendedItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
  overview: string;
  voteAverage: number;
};
type WatchlistItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
};
type HistoryItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
  genres: string[];
  watchedDate: string;
};
type FavouriteActor = { id: string; name: string; profilePath: string };
type RatedMovie = {
  id: string;
  title: string;
  posterPath: string;
  rating: number;
};
type TabId =
  | "overview"
  | "watchlist"
  | "history"
  | "actors"
  | "reviews"
  | "ratings";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Film className="w-3.5 h-3.5" /> },
  {
    id: "watchlist",
    label: "Watchlist",
    icon: <Bookmark className="w-3.5 h-3.5" />,
  },
  {
    id: "history",
    label: "History",
    icon: <History className="w-3.5 h-3.5" />,
  },
  { id: "actors", label: "Actors", icon: <Heart className="w-3.5 h-3.5" /> },
  {
    id: "reviews",
    label: "Reviews",
    icon: <SquarePen className="w-3.5 h-3.5" />,
  },
  { id: "ratings", label: "Ratings", icon: <Star className="w-3.5 h-3.5" /> },
];

export const RecommendationSection = ({
  watchlist,
  history,
  favouriteActors,
  ratedMovies,
  onMediaClick,
}: {
  watchlist: WatchlistItem[];
  history: HistoryItem[];
  favouriteActors: FavouriteActor[];
  ratedMovies: RatedMovie[];
  onMediaClick: (id: string, mediaType: string) => void;
}) => {
  const [items, setItems] = useState<RecommendedItem[]>([]);
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchRecommendations = useCallback(
    async (type: "movie" | "tv") => {
      const seq = ++seqRef.current;
      setLoading(true);

      const filterType = <T extends { mediaType: string; id: string }>(
        arr: T[],
      ) => arr.filter((x) => x.mediaType === type).map((x) => x.id);

      const watchedOrWatchlistIds = new Set([
        ...filterType(history),
        ...filterType(watchlist),
      ]);
      const highlyRated = ratedMovies
        .filter((m) => m.rating >= 7)
        .map((m) => m.id);
      const watchlistIds = filterType(watchlist);
      const historyIds = filterType(history);

      let recommended: any[] = [];

      const fetchBatch = async (
        ids: string[],
        endpointFn: (id: string) => string,
        limit: number,
      ) => {
        const results = await Promise.all(
          ids.slice(0, 5).map(async (id) => {
            try {
              const res = await axios.get(endpointFn(id));
              return res.data.results ?? [];
            } catch {
              return [];
            }
          }),
        );
        results.forEach((r) => recommended.push(...r.slice(0, limit)));
      };

      try {
        if (highlyRated.length > 0) {
          await fetchBatch(
            highlyRated,
            (id) =>
              `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`,
            12,
          );
        }
        if (watchlistIds.length > 0 && recommended.length < 20) {
          await fetchBatch(
            watchlistIds,
            (id) =>
              `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`,
            10,
          );
        }
        if (historyIds.length > 0 && recommended.length < 20) {
          await fetchBatch(
            historyIds,
            (id) =>
              `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=en-US`,
            8,
          );
        }
        if (favouriteActors.length > 0 && recommended.length < 20) {
          const results = await Promise.all(
            favouriteActors.slice(0, 10).map(async (actor) => {
              try {
                const res = await axios.get(
                  `https://api.themoviedb.org/3/person/${actor.id}/${type}_credits?api_key=${TMDB_API_KEY}&language=en-US`,
                );
                return res.data.cast ?? [];
              } catch {
                return [];
              }
            }),
          );
          results.forEach((r) => recommended.push(...r.slice(0, 10)));
        }

        const fetchFallback = async (endpoint: string, limit: number) => {
          try {
            const res = await axios.get(endpoint);
            recommended.push(...(res.data.results ?? []).slice(0, limit));
          } catch { }
        };

        await fetchFallback(
          `https://api.themoviedb.org/3/trending/${type}/week?api_key=${TMDB_API_KEY}`,
          15,
        );
        await fetchFallback(
          `https://api.themoviedb.org/3/${type}/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`,
          15,
        );
        if (recommended.length === 0) {
          await fetchFallback(
            `https://api.themoviedb.org/3/${type}/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`,
            20,
          );
        }
      } catch { }

      if (!mountedRef.current || seq !== seqRef.current) return;

      const unique = new Map<string, RecommendedItem>();
      recommended.forEach((m: any) => {
        const mid = m.id?.toString();
        const mType = m.media_type || type;
        if (
          mid &&
          !unique.has(mid) &&
          !watchedOrWatchlistIds.has(mid) &&
          mType === type
        ) {
          unique.set(mid, {
            id: mid,
            title: m.title ?? m.name ?? "",
            posterPath: m.poster_path
              ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
              : "",
            mediaType: mType,
            overview: m.overview ?? "",
            voteAverage: m.vote_average ?? 0,
          });
        }
      });

      const sorted = Array.from(unique.values()).sort(
        (a, b) => b.voteAverage - a.voteAverage,
      );
      setItems(sorted.slice(0, 50));
      setLoading(false);
    },
    [watchlist, history, favouriteActors, ratedMovies],
  );

  useEffect(() => {
    setItems([]);
    fetchRecommendations(mediaType);
  }, [mediaType, fetchRecommendations]);

  useEffect(() => {
    const refresh = () => {
      setItems([]);
      fetchRecommendations(mediaType);
    };
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [mediaType, fetchRecommendations]);

  const switchType = (t: "movie" | "tv") => {
    if (t === mediaType) return;
    setItems([]);
    setMediaType(t);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-3xl bg-neutral-900/40 border border-white/[0.08] backdrop-blur-2xl p-4 sm:p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      <div className="absolute top-0 left-1/4 -translate-y-1/2 w-72 sm:w-96 h-32 bg-red-600/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-72 sm:w-96 h-32 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-500/25 blur-md rounded-full animate-pulse" />
            <img
              src="/recommendation-icon.png"
              alt="Recommendations"
              className="relative z-10 w-9 h-9 sm:w-11 sm:h-11 object-contain filter brightness-110 drop-shadow-[0_4px_20px_rgba(124,58,237,0.7)]"
            />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              Recommendations
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">
              Curated based on your taste
            </p>
          </div>
        </div>

        <div className="relative self-stretch sm:self-auto flex items-center bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-1 shadow-inner">
          <button
            onClick={() => switchType("movie")}
            className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-colors duration-300 ${mediaType === "movie" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Movies</span>
          </button>
          <button
            onClick={() => switchType("tv")}
            className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-colors duration-300 ${mediaType === "tv" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Series</span>
          </button>
          <motion.div
            className="absolute inset-y-1 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-xl shadow-lg shadow-red-600/30"
            layoutId="recommendation-toggle"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              left: mediaType === "movie" ? "4px" : "calc(50% + 2px)",
              width: "calc(50% - 6px)",
            }}
          />
        </div>
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-zinc-400 text-xs font-medium tracking-wide uppercase">
              Curating {mediaType === "movie" ? "movies" : "series"}…
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
              <Film className="w-6 h-6 text-zinc-500" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              No Recommendations Yet
            </h3>
            <p className="text-zinc-400 text-xs max-w-xs mx-auto">
              Watch more to get personalised picks
            </p>
          </div>
        ) : (
          <div>
            <div
              className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-3 pt-1 px-1 -mx-1 scrollbar-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onMediaClick(item.id, item.mediaType)}
                  className="group relative flex-shrink-0 w-28 sm:w-32 bg-neutral-900/60 border border-white/[0.08] hover:border-white/20 rounded-xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
                    {item.posterPath ? (
                      <img
                        src={item.posterPath}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                        <Film className="w-6 h-6 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-300" />
                    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg] transition-transform duration-1000 ease-in-out" />
                    </div>
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 z-10 pointer-events-none">
                      {item.voteAverage > 0 ? (
                        <div className="h-5 shrink-0 flex items-center gap-0.5 bg-black/70 border border-white/10 backdrop-blur-md px-1.5 rounded-md shadow-md">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="text-[9px] font-bold text-amber-300 leading-none">
                            {item.voteAverage.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}
                      <div className="h-5 shrink-0 flex items-center justify-center bg-black/70 border border-white/10 backdrop-blur-md px-1.5 rounded-md shadow-md">
                        <span
                          className={`text-[8px] font-black uppercase tracking-wider leading-none ${item.mediaType === "tv" ? "text-cyan-400" : "text-amber-400"}`}
                        >
                          {item.mediaType === "tv" ? "TV" : "FILM"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-neutral-900/90 border-t border-white/[0.04] transition-colors duration-300 group-hover:bg-neutral-900">
                    <h3 className="text-xs font-semibold text-white/90 group-hover:text-white transition-colors duration-300 truncate leading-snug">
                      {item.title}
                    </h3>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 px-1 pt-2 border-t border-white/[0.04] text-[11px] text-zinc-500 font-medium">
              <span>Swipe for more</span>
              <span>
                {items.length} {mediaType === "movie" ? "movies" : "series"}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const MediaRow = ({
  items,
  emptyLabel,
  accentClass,
  to,
}: {
  items: { id: string; title: string; posterPath: string; mediaType: string }[];
  emptyLabel: string;
  accentClass: string;
  to: (item: { id: string; mediaType: string }) => string;
}) =>
  items.length === 0 ? (
    <p className="text-zinc-500 text-center py-8 text-sm">{emptyLabel}</p>
  ) : (
    <div
      className="overflow-x-auto -mx-1 px-1 pb-2 scrollbar-none"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="flex gap-2.5 sm:gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={to(item)}
            className={`group relative flex-shrink-0 w-[95px] sm:w-[110px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors duration-200 ${accentClass}`}
          >
            <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
              {item.posterPath ? (
                <img
                  src={item.posterPath}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <ImageOff className="w-5 h-5 text-zinc-600" />
                </div>
              )}
              <div className="absolute inset-0 -translate-x-full -translate-y-full bg-gradient-to-br from-transparent via-white/25 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full group-hover:translate-y-full pointer-events-none -rotate-45 scale-150 z-10" />
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950/80 to-transparent" />
            </div>
            <div className="p-1.5 sm:p-2">
              <p className="text-[11px] sm:text-xs font-medium truncate text-zinc-200 group-hover:text-white transition-colors">
                {item.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

const TogglePill = ({
  value,
  onChange,
  options,
  layoutId,
  activeColor,
}: {
  value: string;
  onChange: (v: any) => void;
  options: { value: string; label: string }[];
  layoutId: string;
  activeColor: string;
}) => (
  <div className="flex justify-center mb-4">
    <div className="relative flex items-center bg-zinc-800/60 border border-white/10 rounded-full p-0.5 shadow-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative z-10 px-4 py-1.5 font-semibold text-xs rounded-full transition-all duration-300 ${value === opt.value ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          {opt.label}
        </button>
      ))}
      <motion.div
        className={`absolute inset-y-1 ${activeColor} rounded-full shadow-lg`}
        layoutId={layoutId}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          left: value === options[0].value ? 2 : "50%",
          right: value === options[1].value ? 2 : "50%",
        }}
      />
    </div>
  </div>
);

const tabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2 } },
};

const ProfilePage = () => {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ratedMovies, setRatedMovies] = useState<RatedMovie[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favouriteActors, setFavouriteActors] = useState<FavouriteActor[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"movie" | "tv">("movie");
  const [watchlistFilter, setWatchlistFilter] = useState<"movie" | "tv">(
    "movie",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ message, type, isVisible: true });
  };

  const memberSince = useMemo(() => {
    const ct = (user as any)?.metadata?.creationTime;
    if (!ct) return null;
    return new Date(ct).getFullYear().toString();
  }, [user]);

  const filmsWatched = useMemo(
    () => history.filter((h) => h.mediaType === "movie").length,
    [history],
  );
  const seriesWatched = useMemo(
    () => history.filter((h) => h.mediaType === "tv").length,
    [history],
  );
  const totalBingeHours = useMemo(() => {
    const mins = filmsWatched * 120 + seriesWatched * 45;
    return Math.round(mins / 60);
  }, [filmsWatched, seriesWatched]);
  const avgRating = useMemo(() => {
    if (ratedMovies.length === 0) return null;
    const sum = ratedMovies.reduce((acc, m) => acc + m.rating, 0);
    return (sum / ratedMovies.length).toFixed(1);
  }, [ratedMovies]);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setLocation(data.location ?? "");
        if (data.photoDataUrl) setPhotoDataUrl(data.photoDataUrl);
      }
    };
    fetchProfile();

    const unsubs = [
      onSnapshot(collection(db, `users/${user.uid}/watchlist`), (snap) => {
        setWatchlist(
          snap.docs.map((d) => ({
            id: d.data().movieId?.toString(),
            title: d.data().title,
            posterPath: `${BASE_POSTER_URL}${d.data().posterPath}`,
            mediaType: d.data().mediaType || "movie",
          })),
        );
      }),

      onSnapshot(collection(db, `users/${user.uid}/ratings`), (snap) => {
        const seen = new Map<string, RatedMovie>();
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!seen.has(data.title)) {
            seen.set(data.title, {
              id: d.id,
              title: data.title,
              posterPath: `${BASE_POSTER_URL}${data.posterPath}`,
              rating: data.rating,
            });
          }
        });
        setRatedMovies(Array.from(seen.values()));
      }),

      onSnapshot(
        query(
          collection(db, `users/${user.uid}/history`),
          orderBy("watchedDate", "desc"),
        ),
        (snap) => {
          setHistory(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: data.movieId?.toString(),
                title: data.title ?? data.name ?? "",
                posterPath: `${BASE_POSTER_URL}${data.posterPath}`,
                mediaType: data.mediaType || "movie",
                genres: data.genres ?? [],
                watchedDate: data.watchedDate ?? new Date().toISOString(),
              };
            }),
          );
        },
      ),

      onSnapshot(
        collection(db, `users/${user.uid}/favouriteActors`),
        (snap) => {
          const seen = new Map<string, FavouriteActor>();
          snap.docs.forEach((d) => {
            const data = d.data();
            const id = data.actorId ?? data.id;
            if (id && data.name && !seen.has(id)) {
              seen.set(id, {
                id,
                name: data.name,
                profilePath: data.profile_path
                  ? `${BASE_POSTER_URL}${data.profile_path}`
                  : data.profilePath
                    ? `${BASE_POSTER_URL}${data.profilePath}`
                    : "",
              });
            }
          });
          setFavouriteActors(Array.from(seen.values()));
        },
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToBase64(file);
      const sizeBytes = Math.round((dataUrl.length * 3) / 4);
      if (sizeBytes > 900_000) {
        showToast(
          "Image too large even after compression. Try a smaller photo.",
          "error",
        );
        return;
      }
      setPhotoPreview(dataUrl);
      await setDoc(
        doc(db, "users", user.uid),
        { photoDataUrl: dataUrl },
        { merge: true },
      );
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(null);
      showToast("Profile photo updated!", "success");
    } catch {
      showToast("Failed to update photo. Please try again.", "error");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.uid) return;
    setIsUploadingPhoto(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { photoDataUrl: null },
        { merge: true },
      );
      setPhotoDataUrl(null);
      setPhotoPreview(null);
      showToast("Photo removed", "info");
    } catch {
      showToast("Failed to remove photo", "error");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid) {
      showToast("You must be logged in", "error");
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { username, bio, location },
        { merge: true },
      );
      showToast("Profile updated!", "success");
      setIsEditingUsername(false);
      setIsEditingBio(false);
      setIsEditingLocation(false);
    } catch {
      showToast("Error updating profile, please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    signOut(getAuth())
      .then(() => navigate("/login"))
      .catch(() => { });
  };

  const handleMediaClick = (id: string, mediaType: string) =>
    navigate(`/${mediaType}/${id}`);

  const filteredHistory = useMemo(
    () => history.filter((h) => h.mediaType === historyFilter),
    [history, historyFilter],
  );
  const filteredWatchlist = useMemo(
    () => watchlist.filter((w) => w.mediaType === watchlistFilter),
    [watchlist, watchlistFilter],
  );
  const displayPhoto = photoPreview ?? photoDataUrl;

  const isEditing = isEditingUsername || isEditingBio || isEditingLocation;

  return (
    <div className="bg-black text-white min-h-screen">
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((t) => ({ ...t, isVisible: false }))}
      />

      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <img
                src="cd.jpg"
                alt="Cinescape"
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Profile
              </h1>
              <p className="text-zinc-500 text-xs font-medium">
                Manage your account
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 active:scale-[0.97] bg-gradient-to-r from-red-500 via-red-600 to-orange-600 text-white hover:brightness-110 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:-translate-x-full hover:before:animate-[shimmer_1.5s_infinite]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl mb-6"
        >
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          <div className="relative z-10 p-5 sm:p-8">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-6 sm:gap-8">
              <div className="flex flex-col items-center gap-3 flex-shrink-0">
                <div className="relative group">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-2 border-white/80 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-2xl">
                    <AnimatePresence mode="wait">
                      {displayPhoto ? (
                        <motion.img
                          key="photo"
                          src={displayPhoto}
                          alt={username}
                          className="w-full h-full object-cover"
                          initial={{ opacity: 0, scale: 1.08 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.3 }}
                        />
                      ) : (
                        <motion.img
                          key="default"
                          src="/user-icon.jpg"
                          alt="Default Profile"
                          className="w-full h-full object-cover"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        />
                      )}
                    </AnimatePresence>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 hover:bg-black/70 transition-all duration-300 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer"
                      aria-label="Change profile picture"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-white mb-0.5" />
                          <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
                            Change
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-600/30 border-2 border-zinc-950 transition-all duration-200 hover:scale-110 active:scale-95 z-10"
                    aria-label="Upload photo"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                {displayPhoto && (
                  <button
                    onClick={handleRemovePhoto}
                    disabled={isUploadingPhoto}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white text-[11px] font-medium transition-colors duration-200"
                  >
                    <X className="w-3 h-3" />
                    Remove photo
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2">
                  <div className="group/edit flex items-center gap-1.5">
                    {isEditingUsername ? (
                      <input
                        type="text"
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        className="text-2xl sm:text-3xl font-black tracking-tight bg-transparent border-b-2 border-red-500/70 text-white focus:outline-none focus:border-amber-400 w-auto min-w-[120px] max-w-[240px]"
                      />
                    ) : (
                      <h2
                        onClick={() => setIsEditingUsername(true)}
                        className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-white to-zinc-300 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {username || "Anonymous"}
                      </h2>
                    )}
                    <button
                      onClick={() => setIsEditingUsername(true)}
                      className="opacity-0 group-hover/edit:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-lg"
                    >
                      <SquarePen className="w-3.5 h-3.5 text-zinc-500 hover:text-white transition-colors" />
                    </button>
                  </div>
                  <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-200 bg-zinc-950/90 border border-amber-500/40 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.3)] backdrop-blur-md overflow-hidden group">
                    <span className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 opacity-70 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 relative z-10 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                    <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-100 font-extrabold tracking-widest">
                      Cinephile
                    </span>
                  </span>
                </div>

                <div className="group/edit flex items-start justify-center sm:justify-start gap-1.5 mb-4">
                  {isEditingBio ? (
                    <textarea
                      autoFocus
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself…"
                      rows={2}
                      className="flex-1 bg-zinc-900/60 border border-zinc-700 text-zinc-300 text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 placeholder:text-zinc-600 resize-none leading-relaxed"
                    />
                  ) : (
                    <p
                      onClick={() => setIsEditingBio(true)}
                      className="text-sm text-zinc-400 leading-relaxed cursor-pointer hover:text-zinc-300 transition-colors flex-1 max-w-md"
                    >
                      {bio || "Add a bio…"}
                    </p>
                  )}
                  <button
                    onClick={() => setIsEditingBio(true)}
                    className="opacity-0 group-hover/edit:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-lg shrink-0 mt-0.5"
                  >
                    <SquarePen className="w-3 h-3 text-zinc-500 hover:text-white transition-colors" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 mb-5">
                  <div className="group/loc flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    {isEditingLocation ? (
                      <input
                        type="text"
                        autoFocus
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        placeholder="Your location"
                        className="text-xs bg-transparent border-b border-zinc-600 text-zinc-300 focus:outline-none focus:border-zinc-400 min-w-[80px] max-w-[140px]"
                      />
                    ) : (
                      <span
                        onClick={() => setIsEditingLocation(true)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
                      >
                        {location || "Add location"}
                      </span>
                    )}
                    <button
                      onClick={() => setIsEditingLocation(true)}
                      className="opacity-0 group-hover/loc:opacity-100 transition-opacity p-0.5 hover:bg-white/10 rounded"
                    >
                      <SquarePen className="w-3 h-3 text-zinc-600 hover:text-white transition-colors" />
                    </button>
                  </div>

                  {memberSince && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                      <span className="text-xs text-zinc-400">
                        Member since {memberSince}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 active:scale-[0.97] bg-white text-black hover:bg-zinc-100 hover:shadow-[0_0_24px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                  {isEditing && (
                    <button
                      onClick={() => {
                        setIsEditingUsername(false);
                        setIsEditingBio(false);
                        setIsEditingLocation(false);
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 active:scale-[0.97] bg-zinc-900 text-zinc-400 hover:text-white border border-white/10 hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/[0.08]">
              <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-red-500/20 via-rose-600/10 to-transparent border border-red-500/25 shadow-[0_0_16px_rgba(220,38,38,0.08)]">
                <div className="absolute top-1.5 right-1.5 w-8 h-8 bg-red-500/15 rounded-full blur-lg" />
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md shadow-red-500/30">
                    <Film className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-300">
                    Films
                  </span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums leading-none">
                  {filmsWatched}
                </p>
                <p className="text-[9px] text-zinc-400 font-medium mt-1">
                  Films Watched
                </p>
              </div>

              <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-blue-500/20 via-sky-600/10 to-transparent border border-blue-500/25 shadow-[0_0_16px_rgba(59,130,246,0.08)]">
                <div className="absolute top-1.5 right-1.5 w-8 h-8 bg-blue-500/15 rounded-full blur-lg" />
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-md shadow-blue-500/30">
                    <Tv className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-blue-300">
                    Series
                  </span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums leading-none">
                  {seriesWatched}
                </p>
                <p className="text-[9px] text-zinc-400 font-medium mt-1">
                  Series Watched
                </p>
              </div>

              <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-emerald-500/20 via-green-600/10 to-transparent border border-emerald-500/25 shadow-[0_0_16px_rgba(16,185,129,0.08)]">
                <div className="absolute top-1.5 right-1.5 w-8 h-8 bg-emerald-500/15 rounded-full blur-lg" />
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                    Time
                  </span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums leading-none">
                  {totalBingeHours}
                  <span className="text-xs font-bold text-zinc-400 ml-0.5">h</span>
                </p>
                <p className="text-[9px] text-zinc-400 font-medium mt-1">
                  Total Binge Time
                </p>
              </div>

              <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-yellow-500/20 via-amber-600/10 to-transparent border border-yellow-500/25 shadow-[0_0_16px_rgba(234,179,8,0.08)]">
                <div className="absolute top-1.5 right-1.5 w-8 h-8 bg-yellow-500/15 rounded-full blur-lg" />
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-md shadow-yellow-500/30">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-300">
                    Rating
                  </span>
                </div>
                <p className="text-2xl font-black text-white tabular-nums leading-none">
                  {avgRating ?? "—"}
                </p>
                <p className="text-[9px] text-zinc-400 font-medium mt-1">
                  Avg. Rating
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
          <div className="relative flex items-center p-1 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] min-w-max sm:min-w-0">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;

              const getActiveIconStyles = (id: string) => {
                switch (id) {
                  case "overview":
                    return "[&>svg]:text-red-500 [&>svg]:fill-red-500/20 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]";
                  case "watchlist":
                    return "[&>svg]:text-blue-500 [&>svg]:fill-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]";
                  case "history":
                    return "[&>svg]:text-emerald-500 [&>svg]:fill-emerald-500/20 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]";
                  case "actors":
                    return "[&>svg]:text-rose-500 [&>svg]:fill-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]";
                  case "reviews":
                    return "[&>svg]:text-purple-400 [&>svg]:fill-purple-400/20 drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]";
                  case "ratings":
                    return "[&>svg]:text-amber-400 [&>svg]:fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]";
                  default:
                    return "[&>svg]:text-white";
                }
              };

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all duration-300 whitespace-nowrap select-none flex-1 ${isActive
                    ? "text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
                    : "text-zinc-400 hover:text-zinc-200 active:scale-95"
                    }`}
                >
                  {tab.icon && (
                    <span
                      className={`transition-all duration-300 ${isActive
                        ? `scale-110 ${getActiveIconStyles(tab.id)}`
                        : "opacity-60 text-zinc-400"
                        }`}
                    >
                      {tab.icon}
                    </span>
                  )}
                  <span>{tab.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="profile-tab-indicator"
                      className="absolute inset-0 rounded-xl bg-white/[0.08] backdrop-blur-md border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_8px_20px_rgba(0,0,0,0.3)] -z-10"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
            >
              <BingeWatchStats history={history} />
              <RecommendationSection
                watchlist={watchlist}
                history={history}
                favouriteActors={favouriteActors}
                ratedMovies={ratedMovies}
                onMediaClick={handleMediaClick}
              />
            </motion.div>
          )}

          {activeTab === "watchlist" && (
            <motion.div
              key="watchlist"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-500/30">
                      <Bookmark className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        Watchlist
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {watchlist.length} item
                        {watchlist.length !== 1 ? "s" : ""} saved
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/watchlist"
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <TogglePill
                  value={watchlistFilter}
                  onChange={setWatchlistFilter}
                  options={[
                    { value: "movie", label: "Movies" },
                    { value: "tv", label: "Series" },
                  ]}
                  layoutId="watchlist-pill"
                  activeColor="bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20"
                />
                <MediaRow
                  items={filteredWatchlist.slice().reverse()}
                  emptyLabel={`No ${watchlistFilter === "movie" ? "movies" : "series"} in watchlist`}
                  accentClass="hover:border-cyan-500/30"
                  to={(item) => `/${item.mediaType}/${item.id}`}
                />
              </div>
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div
              key="history"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        Watch History
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {history.length} item{history.length !== 1 ? "s" : ""}{" "}
                        watched
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/history"
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors duration-200"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <TogglePill
                  value={historyFilter}
                  onChange={setHistoryFilter}
                  options={[
                    { value: "movie", label: "Movies" },
                    { value: "tv", label: "Series" },
                  ]}
                  layoutId="history-pill"
                  activeColor="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/20"
                />
                <MediaRow
                  items={filteredHistory.slice(0, 20)}
                  emptyLabel="No history yet"
                  accentClass="hover:border-emerald-500/30"
                  to={(item) => `/${item.mediaType || "movie"}/${item.id}`}
                />
              </div>
            </motion.div>
          )}

          {activeTab === "actors" && (
            <motion.div
              key="actors"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30">
                      <Heart className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        Favourite Talents
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {favouriteActors.length} talent
                        {favouriteActors.length !== 1 ? "s" : ""} saved
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/fav-talents"
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors duration-200"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {favouriteActors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                      <Heart className="w-4 h-4 fill-current" />
                    </div>
                    <p className="text-sm font-medium text-zinc-300">
                      No favourite talents yet
                    </p>
                    <p className="text-xs text-zinc-500 text-center px-6">
                      Save actor profiles to see them here
                    </p>
                  </div>
                ) : (
                  <div
                    className="overflow-x-auto -mx-1 px-1 pb-2 scrollbar-none"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <div className="flex gap-3">
                      {favouriteActors.map((actor, idx) => (
                        <Link
                          key={actor.id}
                          to={`/actor/${actor.id}`}
                          className="group relative flex-shrink-0 w-[90px] sm:w-[105px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-red-500/30 transition-all duration-200"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
                            <div className="absolute top-1 left-1 z-10 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md border border-white/10 rounded px-1 py-0.5 min-w-[18px]">
                              <span className="text-[9px] font-bold leading-none text-zinc-400 group-hover:text-red-400 transition-colors">
                                #{idx + 1}
                              </span>
                            </div>
                            <div className="absolute top-1 right-1 z-10 bg-red-500 p-0.5 rounded-full shadow-md shadow-red-500/30">
                              <Heart className="w-2 h-2 text-white fill-current" />
                            </div>
                            {actor.profilePath ? (
                              <img
                                src={actor.profilePath}
                                alt={actor.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                <User className="w-5 h-5 text-zinc-600" />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                          </div>
                          <div className="p-1.5">
                            <p className="text-[11px] sm:text-xs font-medium text-zinc-200 group-hover:text-red-400 transition-colors truncate">
                              {actor.name}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "reviews" && (
            <motion.div
              key="reviews"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="p-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/30">
                    <SquarePen className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      Your Reviews
                    </h2>
                    <p className="text-xs text-zinc-500">
                      All reviews you've written
                    </p>
                  </div>
                </div>
                <ReviewList userId={user?.uid ?? ""} />
              </div>
            </motion.div>
          )}

          {activeTab === "ratings" && (
            <motion.div
              key="ratings"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        Rated Media
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {ratedMovies.length} title
                        {ratedMovies.length !== 1 ? "s" : ""} rated
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/top-rated"
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors duration-200"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {ratedMovies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                    <div className="p-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <p className="text-sm font-medium text-zinc-300">
                      No rated movies yet
                    </p>
                    <p className="text-xs text-zinc-500 text-center px-6">
                      Rate media across the app to see them here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-none">
                    {ratedMovies.map((movie, idx) => {
                      const raw = movie.posterPath ?? "";
                      const posterUrl = raw.startsWith("http")
                        ? raw
                        : raw.startsWith("//")
                          ? `https:${raw}`
                          : raw
                            ? `https://image.tmdb.org/t/p/w185${raw.startsWith("/") ? "" : "/"}${raw}`
                            : "";
                      return (
                        <div
                          key={movie.id}
                          onClick={() => handleMediaClick(movie.id, "movie")}
                          className="group relative flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-amber-500/20 transition-all duration-200 cursor-pointer"
                        >
                          <div className="w-5 h-5 shrink-0 rounded-md bg-zinc-900/80 border border-white/5 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-zinc-500 group-hover:text-amber-400 transition-colors">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                          </div>
                          <div className="relative w-8 h-11 shrink-0 rounded-md overflow-hidden border border-white/10 bg-zinc-900">
                            {posterUrl ? (
                              <img
                                src={posterUrl}
                                alt={movie.title}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                <Film className="w-3 h-3 text-zinc-700" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-zinc-200 group-hover:text-amber-300 transition-colors truncate">
                              {movie.title}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              Movie
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold group-hover:bg-amber-500 group-hover:text-black group-hover:border-transparent transition-all duration-200">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            {movie.rating}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProfilePage;