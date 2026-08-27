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
import { RecommendationSection, WatchlistItem, HistoryItem, FavouriteTalent, RatedMovie } from "../components/Recommendation.tsx";
import { UserRatingSection } from "../components/UserRating.tsx";
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

type TabId =
  | "overview"
  | "watchlist"
  | "history"
  | "talents"
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
  { id: "talents", label: "Talents", icon: <Heart className="w-3.5 h-3.5" /> },
  {
    id: "reviews",
    label: "Reviews",
    icon: <SquarePen className="w-3.5 h-3.5" />,
  },
  { id: "ratings", label: "Ratings", icon: <Star className="w-3.5 h-3.5" /> },
];

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
  const [favouriteTalents, setFavouriteTalents] = useState<FavouriteTalent[]>([]);
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
  const [runtimeDetails, setRuntimeDetails] = useState<Record<string, { runtime: number }>>({});
  const [loadingRuntimes, setLoadingRuntimes] = useState(false);

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
    let totalMins = 0;
    history.forEach((item) => {
      const runtime = runtimeDetails[item.id]?.runtime || (item.mediaType === "movie" ? 120 : 45);
      totalMins += runtime;
    });
    return Math.round(totalMins / 60);
  }, [history, runtimeDetails]);
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
              mediaType: data.mediaType || "movie",
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
        collection(db, `users/${user.uid}/favouriteTalents`),
        (snap) => {
          const seen = new Map<string, FavouriteTalent>();
          snap.docs.forEach((d) => {
            const data = d.data();
            const id = data.talentId ?? data.id;
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
          setFavouriteTalents(Array.from(seen.values()));
        },
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  useEffect(() => {
    const fetchRuntimes = async () => {
      const historyItems = history.filter((item) => item.id && !runtimeDetails[item.id]);
      if (historyItems.length === 0) return;

      setLoadingRuntimes(true);
      const newDetails: Record<string, { runtime: number }> = {};

      await Promise.all(
        historyItems.map(async (item) => {
          try {
            const res = await axios.get(
              `https://api.themoviedb.org/3/${item.mediaType}/${item.id}?api_key=${TMDB_API_KEY}`
            );
            const runtime =
              item.mediaType === "movie"
                ? (res.data.runtime || 120)
                : (res.data.episode_run_time?.[0] || 45);
            newDetails[item.id] = { runtime };
          } catch {
            newDetails[item.id] = {
              runtime: item.mediaType === "movie" ? 120 : 45,
            };
          }
        })
      );

      setRuntimeDetails((prev) => ({ ...prev, ...newDetails }));
      setLoadingRuntimes(false);
    };

    if (history.length > 0) {
      fetchRuntimes();
    }
  }, [history]);

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
            className="relative flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold tracking-tight text-white bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:from-red-400 hover:via-red-500 hover:to-orange-500 active:from-red-600 active:to-orange-700 border border-white/25 backdrop-blur-2xl transition-all duration-300 active:scale-95 shadow-[0_6px_20px_rgba(239,68,68,0.35),inset_0_1px_1px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.3)] overflow-hidden group font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]"
          >
            <div className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-white/35 via-white/10 to-transparent rounded-t-2xl pointer-events-none" />
            <LogOut className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] relative z-10 transition-transform duration-300 group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
              Logout
            </span>
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-5 pt-4 border-t border-white/[0.08]">
              <div className="group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 hover:bg-white/[0.055] hover:border-red-500/20 hover:-translate-y-0.5">
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-red-500/[0.12] blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-red-500/[0.18]" />

                <div className="relative flex items-center justify-between mb-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-red-500/90 to-rose-700/90 flex items-center justify-center border border-white/10 shadow-[0_5px_15px_rgba(239,68,68,0.25)]">
                    <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>

                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.18em] text-red-300/80">
                    Films
                  </span>
                </div>

                <div className="relative">
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums leading-none">
                    {filmsWatched}
                  </p>

                  <p className="text-[9px] sm:text-[10px] text-zinc-500 font-medium mt-1.5">
                    Films Watched
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 hover:bg-white/[0.055] hover:border-blue-500/20 hover:-translate-y-0.5">
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-blue-500/[0.12] blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-blue-500/[0.18]" />

                <div className="relative flex items-center justify-between mb-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-500/90 to-cyan-700/90 flex items-center justify-center border border-white/10 shadow-[0_5px_15px_rgba(59,130,246,0.25)]">
                    <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>

                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300/80">
                    Series
                  </span>
                </div>

                <div className="relative">
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums leading-none">
                    {seriesWatched}
                  </p>

                  <p className="text-[9px] sm:text-[10px] text-zinc-500 font-medium mt-1.5">
                    Series Watched
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 hover:bg-white/[0.055] hover:border-emerald-500/20 hover:-translate-y-0.5">
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-500/[0.12] blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-emerald-500/[0.18]" />

                <div className="relative flex items-center justify-between mb-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400/90 to-green-700/90 flex items-center justify-center border border-white/10 shadow-[0_5px_15px_rgba(16,185,129,0.25)]">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>

                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300/80">
                    Time
                  </span>
                </div>

                <div className="relative">
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums leading-none">
                    {loadingRuntimes &&
                      history.length > 0 &&
                      Object.keys(runtimeDetails).length < history.length ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-emerald-400" />
                        <span className="text-xs sm:text-sm font-bold text-emerald-400">
                          ...
                        </span>
                      </span>
                    ) : (
                      <>
                        {totalBingeHours}
                        <span className="text-xs sm:text-sm font-bold text-zinc-500 ml-1">
                          h
                        </span>
                      </>
                    )}
                  </p>

                  <p className="text-[9px] sm:text-[10px] text-zinc-500 font-medium mt-1.5">
                    Total Binge Time
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-white/[0.035] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 hover:bg-white/[0.055] hover:border-amber-500/20 hover:-translate-y-0.5">
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-500/[0.12] blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-amber-500/[0.18]" />

                <div className="relative flex items-center justify-between mb-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-yellow-400/90 to-amber-600/90 flex items-center justify-center border border-white/10 shadow-[0_5px_15px_rgba(245,158,11,0.25)]">
                    <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white" />
                  </div>

                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
                    Rating
                  </span>
                </div>

                <div className="relative">
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums leading-none">
                    {avgRating ?? '—'}
                  </p>

                  <p className="text-[9px] sm:text-[10px] text-zinc-500 font-medium mt-1.5">
                    Avg. Rating
                  </p>
                </div>
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
                  case "talents":
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
              <BingeWatchStats history={history} ratedMovies={ratedMovies} />
              <RecommendationSection
                watchlist={watchlist}
                history={history}
                favouriteTalents={favouriteTalents}
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
              className="w-full font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif] tracking-tight antialiased"
            >
              <div className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] border border-white/15 dark:border-white/10 bg-white/10 dark:bg-white/[0.04] p-4 sm:p-7 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.2)]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/5 rounded-full blur-[70px] pointer-events-none" />

                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30">
                      <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">
                        Watchlist
                      </h2>
                      <p className="text-[11px] sm:text-xs text-white/50 font-medium mt-0.5">
                        {watchlist.length} item{watchlist.length !== 1 ? "s" : ""} saved
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/watchlist"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors duration-200 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
                  <TogglePill
                    value={watchlistFilter}
                    onChange={setWatchlistFilter}
                    options={[
                      { value: "movie", label: "Movies" },
                      { value: "tv", label: "Series" },
                    ]}
                    layoutId="watchlist-pill"
                    activeColor="bg-blue-600/90 text-white shadow-[0_4px_16px_rgba(37,99,235,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-blue-400/40"
                  />
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4 w-full">
                  {filteredWatchlist.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-xs font-semibold text-white/40 uppercase tracking-wider bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md">
                      {`No ${watchlistFilter === "movie" ? "movies" : "series"} in watchlist`}
                    </div>
                  ) : (
                    filteredWatchlist.slice().reverse().map((item) => {
                      const targetLink = `/${item.mediaType}/${item.id}`;
                      return (
                        <Link
                          key={item.id}
                          to={targetLink}
                          className="group relative flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-1.5 sm:p-2 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.08] hover:border-blue-400/40 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-[0.97]"
                        >
                          <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-black/60 border border-white/10 shadow-md">
                            {item.posterPath ? (
                              <img
                                src={item.posterPath}
                                alt={item.title || (item as any).name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/30">
                                <Bookmark className="w-5 h-5 sm:w-6 sm:h-6" />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                          </div>
                          <div className="pt-2 px-1">
                            <p className="text-[11px] sm:text-xs font-semibold text-white/80 group-hover:text-blue-300 tracking-tight transition-colors truncate">
                              {item.title || (item as any).name}
                            </p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
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
              className="w-full font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif] tracking-tight antialiased"
            >
              <div className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] border border-white/15 dark:border-white/10 bg-white/10 dark:bg-white/[0.04] p-4 sm:p-7 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.2)]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/5 rounded-full blur-[70px] pointer-events-none" />

                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30">
                      <History className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">
                        Watch History
                      </h2>
                      <p className="text-[11px] sm:text-xs text-white/50 font-medium mt-0.5">
                        {history.length} item{history.length !== 1 ? "s" : ""} watched
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/history"
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors duration-200 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
                  <TogglePill
                    value={historyFilter}
                    onChange={setHistoryFilter}
                    options={[
                      { value: "movie", label: "Movies" },
                      { value: "tv", label: "Series" },
                    ]}
                    layoutId="history-pill"
                    activeColor="bg-emerald-600/90 text-white shadow-[0_4px_16px_rgba(5,150,105,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-emerald-400/40"
                  />
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4 w-full">
                  {filteredHistory.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-xs font-semibold text-white/40 uppercase tracking-wider bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md">
                      {`No ${historyFilter === "movie" ? "movies" : "series"} in history`}
                    </div>
                  ) : (
                    filteredHistory.slice(0, 20).map((item) => {
                      const targetLink = `/${item.mediaType || "movie"}/${item.id}`;
                      return (
                        <Link
                          key={item.id}
                          to={targetLink}
                          className="group relative flex flex-col bg-white/[0.03] border border-white/10 rounded-2xl p-1.5 sm:p-2 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.08] hover:border-emerald-400/40 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] active:scale-[0.97]"
                        >
                          <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-black/60 border border-white/10 shadow-md">
                            {item.posterPath ? (
                              <img
                                src={item.posterPath}
                                alt={item.title || (item as any).name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/30">
                                <History className="w-5 h-5 sm:w-6 sm:h-6" />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                          </div>
                          <div className="pt-2 px-1">
                            <p className="text-[11px] sm:text-xs font-semibold text-white/80 group-hover:text-emerald-300 tracking-tight transition-colors truncate">
                              {item.title || (item as any).name}
                            </p>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "talents" && (
            <motion.div
              key="talents"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full"
            >
              <div className="relative overflow-hidden rounded-[32px] border border-white/[0.04] bg-zinc-950/20 p-5 sm:p-8 backdrop-blur-3xl shadow-2xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/5 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/[0.02] rounded-full blur-[60px] pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

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
                        {favouriteTalents.length} talent
                        {favouriteTalents.length !== 1 ? "s" : ""} saved
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

                {favouriteTalents.length === 0 ? (
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-950/30 p-8 text-center shadow-inner">
                    <div className="relative z-10 flex flex-col items-center max-w-xs mx-auto">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 mb-4 shadow-xl">
                        <Heart className="w-5 h-5" />
                      </div>
                      <h3 className="text-xs font-black tracking-[0.2em] text-zinc-400 uppercase">Roster Empty</h3>
                      <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        Bookmark talent and artist profiles to automatically generate your interactive visual matrix here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4 w-full">
                    {favouriteTalents.map((talent, idx) => (
                      <Link
                        key={talent.id}
                        to={`/talent/${talent.id}`}
                        className="group relative flex flex-col justify-between bg-zinc-950/30 border border-zinc-900 rounded-2xl p-2 transition-all duration-500 hover:bg-zinc-950/80 hover:border-red-500/20 hover:shadow-[0_12px_30px_rgba(239,68,68,0.04)] active:scale-[0.98]"
                      >
                        <div className="absolute -inset-px rounded-2xl border border-transparent group-hover:border-red-500/10 bg-gradient-to-b from-white/[0.04] to-transparent [mask-image:linear-gradient(to_bottom,white,transparent)] group-hover:[mask-image:none] pointer-events-none transition-all duration-500" />

                        <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-zinc-900 border border-white/[0.02] shadow-md">
                          <div className="absolute top-1.5 left-1.5 z-10 flex items-center justify-center h-4 bg-zinc-950/80 backdrop-blur-md border border-white/[0.06] rounded-md px-1.5 shadow-sm">
                            <span className="text-[8px] font-black tracking-tighter text-zinc-400 group-hover:text-red-400 transition-colors">
                              #{idx + 1}
                            </span>
                          </div>

                          <div className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center w-4 h-4 bg-red-500 rounded-md shadow-md shadow-red-500/20">
                            <Heart className="w-2 h-2 text-white fill-current" />
                          </div>

                          {talent.profilePath ? (
                            <img
                              src={talent.profilePath}
                              alt={talent.name}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                              <User className="w-5 h-5 text-zinc-700" />
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent pointer-events-none" />
                        </div>

                        <div className="pt-2 px-0.5">
                          <p className="text-[10px] sm:text-xs font-bold text-zinc-400 group-hover:text-red-400 tracking-tight transition-colors truncate">
                            {talent.name}
                          </p>
                          <span className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600 block mt-0.5">
                            Talent
                          </span>
                        </div>
                      </Link>
                    ))}
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
            <UserRatingSection
              ratedMovies={ratedMovies}
              onMediaClick={handleMediaClick}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProfilePage;