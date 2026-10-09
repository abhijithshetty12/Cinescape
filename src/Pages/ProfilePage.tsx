import React, { useState, useEffect, useRef, useContext, useCallback, useMemo, } from "react";
import { AuthContext } from "../context/AuthContext.tsx";
import { getAuth, signOut } from "firebase/auth";
import { db } from "../firebase.ts";
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import ReviewList from "../components/ReviewList.tsx";
import { RecommendationSection, WatchlistItem, HistoryItem, FavouriteTalent, RatedMovie } from "../components/Recommendation.tsx";
import { UserRatingSection } from "../components/UserRating.tsx";
import { User, ChevronRight, Star, Heart, Film, Bookmark, History, SquarePen, Tv, Camera, Loader2, ImageOff, X, MapPin, CalendarDays, ImagePlus, Upload, Search, CheckCircle2, Trash2, ExternalLink, } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import BingeWatchStats from "../components/BingeWatchStats.tsx";
import Toast from "../components/Toast.tsx";

const BASE_POSTER_URL = "https://image.tmdb.org/t/p/original/";
const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";
const MAX_PHOTO_PX = 256;
const PHOTO_QUALITY = 0.72;

interface FavouriteMediaItem {
  id: string;
  title: string;
  posterPath: string;
  mediaType: "movie" | "tv";
  addedAt?: number;
}

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

const compressBanner = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const image = new Image();
    image.onerror = reject;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const width = 1280;
      const height = 440;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas unavailable"));
      const scale = Math.max(width / image.width, height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

type TabId =
  | "overview"
  | "watchlist"
  | "history"
  | "favourites"
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
  { id: "favourites", label: "Favourites", icon: <Heart className="w-3.5 h-3.5" /> },
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
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [handle, setHandle] = useState("");
  const [profileLinks, setProfileLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [portraitCreditsOpen, setPortraitCreditsOpen] = useState(false);
  const [photoMode, setPhotoMode] = useState<"favourites" | "search">("favourites");
  const [talentSearch, setTalentSearch] = useState("");
  const [talentResults, setTalentResults] = useState<Array<{ id: number; name: string; profile_path: string | null }>>([]);
  const [talentGallery, setTalentGallery] = useState<Array<{ file_path: string }>>([]);
  const [talentGalleryName, setTalentGalleryName] = useState("");
  const [talentLoading, setTalentLoading] = useState(false);
  const [editDraft, setEditDraft] = useState({ username: "", bio: "", handle: "", location: "", links: [] as Array<{ label: string; url: string }> });
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ratedMovies, setRatedMovies] = useState<RatedMovie[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favouriteMedia, setFavouriteMedia] = useState<FavouriteMediaItem[]>([]);
  const [favouriteTalents, setFavouriteTalents] = useState<FavouriteTalent[]>([]);
  const [favouritesFilter, setFavouritesFilter] = useState<"movie" | "tv" | "talent">("movie");
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
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerSearch, setBannerSearch] = useState("");
  const [bannerChoices, setBannerChoices] = useState<Record<string, string>>({});
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerSelected, setBannerSelected] = useState("");
  const [scenePosition, setScenePosition] = useState<"top" | "center" | "bottom">("center");
  const [sceneSource, setSceneSource] = useState<"discover" | "history">("discover");
  const [sceneResults, setSceneResults] = useState<Array<{ id: number; title: string; mediaType: "movie" | "tv"; backdrop: string }>>([]);
  const [sceneResultLoading, setSceneResultLoading] = useState(false);
  const [sceneImages, setSceneImages] = useState<Array<{ url: string; title: string }>>([]);
  const [sceneImagesLoading, setSceneImagesLoading] = useState(false);
  const [sceneTitle, setSceneTitle] = useState("");
  const [sceneChosenUrl, setSceneChosenUrl] = useState("");

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
        setHandle(data.handle ?? "");
        setProfileLinks(Array.isArray(data.profileLinks) ? data.profileLinks : []);
        setBannerUrl(data.profileBannerUrl ?? "");
        setBannerTitle(data.profileBannerTitle ?? "");
        setScenePosition(data.profileScenePosition === "top" || data.profileScenePosition === "bottom" ? data.profileScenePosition : "center");
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
        collection(db, `users/${user.uid}/favouriteMedia`),
        (snap) => {
          const seen = new Map<string, FavouriteMediaItem>();
          snap.docs.forEach((d) => {
            const data = d.data();
            const rawType = data.mediaType ?? data.type ?? (d.id.startsWith("tv-") ? "tv" : "movie");
            const mediaType: "movie" | "tv" = rawType === "tv" ? "tv" : "movie";
            const rawId = data.movieId ?? data.mediaId ?? data.id ?? d.id.replace(/^(movie|tv)-/, "");
            const id = String(rawId ?? "");
            if (!id) return;

            const key = `${mediaType}-${id}`;
            if (seen.has(key)) return;

            const rawPoster = String(data.posterPath ?? data.poster_path ?? data.poster ?? "");
            const posterPath = rawPoster
              ? /^https?:\/\//i.test(rawPoster)
                ? rawPoster
                : `${BASE_POSTER_URL}${rawPoster}`
              : "";

            seen.set(key, {
              id,
              title: String(data.title ?? data.name ?? "Untitled"),
              posterPath,
              mediaType,
              addedAt: data.addedAt?.toMillis
                ? data.addedAt.toMillis()
                : data.createdAt?.toMillis
                  ? data.createdAt.toMillis()
                  : Number(data.addedAt ?? data.createdAt ?? data.timestamp ?? 0) || 0,
            });
          });
          setFavouriteMedia(Array.from(seen.values()));
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

  const bannerCandidates = useMemo(() => {
    const seen = new Set<string>();
    return history.filter((item) => {
      const key = `${item.mediaType}-${item.id}`;
      if (!item.id || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 60);
  }, [history]);

  useEffect(() => {
    if (!bannerOpen || !bannerCandidates.length) return;
    let cancelled = false;
    const load = async () => {
      setBannerLoading(true);
      const results: Record<string, string> = {};
      await Promise.all(bannerCandidates.map(async (item) => {
        const key = `${item.mediaType}-${item.id}`;
        if (bannerChoices[key]) return;
        try {
          const response = await axios.get(`https://api.themoviedb.org/3/${item.mediaType}/${item.id}?api_key=${TMDB_API_KEY}`);
          if (response.data.backdrop_path) results[key] = `https://image.tmdb.org/t/p/original${response.data.backdrop_path}`;
        } catch { }
      }));
      if (!cancelled) {
        setBannerChoices((previous) => ({ ...previous, ...results }));
        setBannerLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [bannerOpen, bannerCandidates]);

  useEffect(() => {
    if (!bannerOpen || sceneSource !== "discover") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSceneResultLoading(true);
      try {
        const term = bannerSearch.trim();
        const requests = term
          ? [axios.get("https://api.themoviedb.org/3/search/multi", { params: { api_key: TMDB_API_KEY, query: term, include_adult: false, page: 1 } })]
          : [axios.get("https://api.themoviedb.org/3/trending/all/week", { params: { api_key: TMDB_API_KEY } })];
        const responses = await Promise.all(requests);
        if (cancelled) return;
        setSceneResults(responses.flatMap((response) => (response.data.results ?? []).filter((item: any) => (item.media_type === "movie" || item.media_type === "tv") && item.backdrop_path).map((item: any) => ({ id: item.id, title: item.title || item.name || "Untitled", mediaType: item.media_type, backdrop: `https://image.tmdb.org/t/p/w780${item.backdrop_path}` }))));
      } catch {
        if (!cancelled) showToast("Couldn't load titles from TMDB", "error");
      } finally {
        if (!cancelled) setSceneResultLoading(false);
      }
    }, bannerSearch.trim() ? 350 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bannerOpen, sceneSource, bannerSearch]);

  const openSceneTitle = async (mediaType: "movie" | "tv", id: number, title: string) => {
    setSceneTitle(title);
    setSceneImages([]);
    setSceneChosenUrl("");
    setSceneImagesLoading(true);
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/${mediaType}/${id}/images`, { params: { api_key: TMDB_API_KEY, include_image_language: "en,null" } });
      const backdrops = (response.data.backdrops ?? []).filter((item: any) => item.file_path && item.width >= 780).slice(0, 36);
      setSceneImages(backdrops.map((item: any) => ({ url: `https://image.tmdb.org/t/p/original${item.file_path}`, title })));
      if (!backdrops.length) showToast("No backdrops available for this title", "info");
    } catch {
      showToast("Couldn't load this title's scenes", "error");
    } finally {
      setSceneImagesLoading(false);
    }
  };

  const saveBanner = async (url: string, title: string, position: "top" | "center" | "bottom" = scenePosition) => {
    if (!user?.uid) return;
    setBannerSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), { profileBannerUrl: url, profileBannerTitle: title, profileScenePosition: position }, { merge: true });
      setBannerUrl(url);
      setBannerTitle(title);
      setScenePosition(position);
      setBannerOpen(false);
      showToast(url ? "Profile banner updated" : "Profile banner removed", "success");
    } catch {
      showToast("Could not update your banner", "error");
    } finally {
      setBannerSaving(false);
    }
  };

  const uploadBanner = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Choose a valid image", "error");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast("Choose an image smaller than 15 MB", "error");
      return;
    }
    setBannerSaving(true);
    try {
      const data = await compressBanner(file);
      if (data.length > 850000) {
        showToast("Image is too large after compression", "error");
        return;
      }
      await saveBanner(data, "Custom banner");
    } catch {
      showToast("Could not process the image", "error");
    } finally {
      setBannerSaving(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

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

  const useAccountPhoto = async () => {
    if (!user?.uid || !accountPhoto) return;
    setIsUploadingPhoto(true);
    try {
      await setDoc(doc(db, "users", user.uid), { photoDataUrl: accountPhoto }, { merge: true });
      setPhotoDataUrl(accountPhoto);
      setPhotoPreview(null);
      setPhotoOpen(false);
      showToast("Account photo applied", "success");
    } catch {
      showToast("Could not apply account photo", "error");
    } finally {
      setIsUploadingPhoto(false);
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

  const openEdit = () => {
    setEditDraft({ username, bio, handle, location, links: profileLinks.map((item) => ({ ...item })) });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!user?.uid) return;
    const nextHandle = editDraft.handle.trim().replace(/^@/, "");
    if (nextHandle && !/^[a-zA-Z0-9_]{3,15}$/.test(nextHandle)) {
      showToast("Handle must contain 3–15 letters, numbers or underscores", "error");
      return;
    }
    const nextLinks = editDraft.links.filter((item) => item.label.trim() && item.url.trim());
    if (nextLinks.some((item) => !/^https?:\/\//i.test(item.url.trim()))) {
      showToast("Links must start with https:// or http://", "error");
      return;
    }
    setIsSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), { username: editDraft.username.trim(), bio: editDraft.bio.trim(), handle: nextHandle, location: editDraft.location.trim(), profileLinks: nextLinks }, { merge: true });
      setUsername(editDraft.username.trim());
      setBio(editDraft.bio.trim());
      setHandle(nextHandle);
      setLocation(editDraft.location.trim());
      setProfileLinks(nextLinks);
      setEditOpen(false);
      showToast("Profile updated", "success");
    } catch {
      showToast("Couldn't save your profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const saveTalentPhoto = async (path: string) => {
    if (!user?.uid) return;
    setIsUploadingPhoto(true);
    try {
      const response = await fetch(`https://image.tmdb.org/t/p/w500${path}`);
      if (!response.ok) throw new Error("Image unavailable");
      const blob = await response.blob();
      const dataUrl = await compressImageToBase64(new File([blob], "talent.jpg", { type: blob.type || "image/jpeg" }));
      await setDoc(doc(db, "users", user.uid), { photoDataUrl: dataUrl }, { merge: true });
      setPhotoDataUrl(dataUrl);
      setPhotoOpen(false);
      showToast("Profile photo updated", "success");
    } catch {
      showToast("Could not use this talent image", "error");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const openTalentGallery = async (id: number, name: string) => {
    setTalentGalleryName(name);
    setTalentGallery([]);
    setTalentLoading(true);
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/person/${id}/images`, { params: { api_key: TMDB_API_KEY } });
      setTalentGallery((response.data.profiles ?? []).filter((item: any) => item.file_path).slice(0, 48));
    } catch {
      showToast("Couldn't load talent images", "error");
    } finally {
      setTalentLoading(false);
    }
  };

  useEffect(() => {
    if (!photoOpen || photoMode !== "search") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!talentSearch.trim()) { setTalentResults([]); return; }
      setTalentLoading(true);
      try {
        const response = await axios.get("https://api.themoviedb.org/3/search/person", { params: { api_key: TMDB_API_KEY, query: talentSearch, include_adult: false } });
        if (!cancelled) setTalentResults((response.data.results ?? []).slice(0, 24));
      } catch {
        if (!cancelled) showToast("Talent search failed", "error");
      } finally {
        if (!cancelled) setTalentLoading(false);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [photoOpen, photoMode, talentSearch]);

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

  const favouriteMovies = useMemo(
    () => favouriteMedia.filter((item) => item.mediaType === "movie"),
    [favouriteMedia],
  );

  const favouriteSeries = useMemo(
    () => favouriteMedia.filter((item) => item.mediaType === "tv"),
    [favouriteMedia],
  );

  const totalFavourites = favouriteMedia.length + favouriteTalents.length;

  const accountPhoto = getAuth().currentUser?.photoURL || null;
  const displayPhoto = photoPreview ?? photoDataUrl;

  const isEditing = isEditingUsername || isEditingBio || isEditingLocation;

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[270px] overflow-hidden sm:h-[390px] lg:h-[460px]">
        {bannerUrl ? <div className="absolute inset-0 bg-cover bg-no-repeat" style={{ backgroundImage: `url(${bannerUrl})`, backgroundPosition: `center ${scenePosition}` }} /> : <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_10%,rgba(220,38,38,0.8),transparent_65%),linear-gradient(130deg,#7f1d1d,#170507)]" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/20 to-black" />
      </div>
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((t) => ({ ...t, isVisible: false }))}
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-14 pt-4 sm:px-6 sm:pt-7">
        <section className="relative mb-6 pt-24 sm:pt-32 lg:pt-40">
          <div className="relative grid lg:rounded-[22px] lg:border lg:border-white/10 lg:bg-[#050505]/90 lg:shadow-[0_25px_90px_rgba(0,0,0,.5)] lg:backdrop-blur-2xl lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="relative min-w-0 lg:border-r">
              <div className="relative flex items-start gap-3 rounded-t-[22px] bg-[#050505]/90 px-3 pb-3 pt-4 shadow-[0_-10px_35px_rgba(0,0,0,.3)] sm:px-6 lg:block lg:rounded-none lg:bg-transparent lg:px-5 lg:pb-0 lg:pt-0 lg:shadow-none">
                <div className="relative z-20 -mt-20 mb-[-28px] w-[112px] shrink-0 self-start [perspective:900px] sm:mb-0 sm:w-32 lg:mx-auto lg:-mt-16 lg:w-[174px]">
                  <motion.div
                    initial={false}
                    animate={{ rotateY: portraitCreditsOpen ? -7 : 0, rotateX: portraitCreditsOpen ? 3 : 0, y: portraitCreditsOpen ? -5 : 0 }}
                    whileHover={{ rotateY: -9, rotateX: 5, y: -7, scale: 1.025 }}
                    whileTap={{ scale: 0.975 }}
                    transition={{ type: "spring", stiffness: 210, damping: 20 }}
                    className="group relative [transform-style:preserve-3d]"
                  >
                    <div className="pointer-events-none absolute -inset-3 rounded-2xl bg-gradient-to-br from-amber-300/25 via-red-500/10 to-transparent blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="relative overflow-hidden bg-[#17100c] shadow-[7px_15px_0_-7px_#493020,12px_25px_36px_rgba(0,0,0,.85),inset_0_1px_0_rgba(255,230,180,.5)]" style={{ clipPath: "polygon(0 0,100% 0,100% 42%,94% 46%,94% 54%,100% 58%,100% 100%,0 100%,0 58%,6% 54%,6% 46%,0 42%)" }}>
                      <button type="button" onClick={() => setPortraitCreditsOpen(value => !value)} aria-expanded={portraitCreditsOpen} aria-label={portraitCreditsOpen ? "Hide ticket holder" : "Reveal ticket holder"} className="relative block w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                        <div className="flex h-[19px] items-center justify-between gap-1 border-b border-dashed border-amber-200/45 bg-[#20140e] px-2 font-mono text-[6px] font-bold tracking-[.08em] text-amber-100 sm:h-[23px] sm:text-[8px]"><span>CINESCAPE</span><span>ADMIT ONE</span></div>
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#120e0c]"><img src={displayPhoto || accountPhoto || "/user-icon.jpg"} alt="Profile portrait" className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.06]" /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" /><div className="pointer-events-none absolute inset-0 opacity-[.10] mix-blend-screen [background:repeating-linear-gradient(110deg,transparent_0px,transparent_3px,rgba(255,245,210,.3)_4px,transparent_5px)]" /></div>
                        <div className="flex h-[19px] items-center justify-between gap-1 border-t border-dashed border-amber-200/45 bg-[#20140e] px-2 font-mono text-[6px] font-semibold tracking-[.03em] text-amber-100 sm:h-[23px] sm:text-[7px]"><span>PREMIERE PASS</span><span>01 / 01</span></div>
                        <div className="pointer-events-none absolute inset-[2px] border border-amber-100/30" />
                        <div className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-[480%] motion-reduce:hidden" />
                      </button>
                      <button type="button" onClick={() => { setPhotoMode("favourites"); setTalentGallery([]); setPhotoOpen(true); }} disabled={isUploadingPhoto} aria-label="Change profile picture" className="absolute right-2 top-7 z-20 rounded-full border border-amber-200/40 bg-black/80 p-2 text-amber-100 shadow-lg backdrop-blur-md transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">{isUploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}</button>
                    </div>
                    <AnimatePresence initial={false}>{portraitCreditsOpen && <motion.div initial={{ height: 0, opacity: 0, y: -8 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="overflow-hidden"><div className="mt-1 border-x border-b border-dashed border-amber-200/40 bg-[#21160f] px-2 py-3 text-center shadow-xl"><p className="font-mono text-[8px] tracking-[.2em] text-amber-300">TICKET HOLDER</p><p className="mt-1 break-words text-xs font-bold text-white">{username || "Cinescape member"}</p>{handle && <p className="mt-1 truncate text-[9px] text-amber-100/60">@{handle}</p>}</div></motion.div>}</AnimatePresence>
                  </motion.div>
                </div>
                <div className="min-w-0 flex-1 pb-0 lg:hidden">
                  <h2 className="break-words text-xl font-extrabold tracking-tight">{username || "Cinescape member"}</h2>
                  {handle && <p className="mt-1 text-xs text-zinc-400">@{handle}</p>}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-600" />{memberSince ? `Member since ${memberSince}` : "Cinescape member"}</p>
                  {location && <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400"><MapPin className="h-3.5 w-3.5 shrink-0 text-blue-600" />{location}</p>}
                  <div className="mt-2.5 flex flex-nowrap items-center gap-1.5"><button onClick={openEdit} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/[0.08] px-2 py-1.5 text-[9px] sm:px-3 sm:text-[11px] text-zinc-200 transition hover:bg-white/15"><SquarePen className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Edit Profile</button><button onClick={() => setBannerOpen(true)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/[0.08] px-2 py-1.5 text-[9px] text-zinc-200 transition hover:bg-white/15 sm:px-3 sm:text-[11px]"><ImagePlus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Change Scene</button></div>
                </div>
              </div>
              <div className="space-y-4 px-1 pb-5 pt-2 sm:px-6 lg:px-5 lg:pt-5">
                <div className="hidden lg:block"><h2 className="break-words text-2xl font-extrabold tracking-tight">{username || "Cinescape member"}</h2>{handle && <p className="mt-1 text-xs text-zinc-400">@{handle}</p>}<div className="mt-3 space-y-1 text-xs text-zinc-500">{memberSince && <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-green-600" /> Member since {memberSince}</p>}{location && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-blue-600" /> {location}</p>}</div></div>
                <div className="grid grid-cols-2 gap-2 lg:hidden">{[{ label: "SEEN", value: filmsWatched + seriesWatched }, { label: "VERDICTS", value: ratedMovies.length }, { label: "QUEUED", value: watchlist.length }, { label: "AVG VERDICT", value: avgRating ?? "N/A" }].map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><p className="text-xl font-extrabold tabular-nums">{item.value}</p><p className="mt-1 text-[10px] font-semibold tracking-wider text-zinc-500">{item.label}</p></div>)}</div>
                {bio && <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{bio}</p>}
                {profileLinks.length > 0 && <div className="flex flex-wrap gap-2">{profileLinks.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><span className="truncate">{item.label}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>)}</div>}
                <div className="hidden"><button onClick={openEdit} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-zinc-300"><SquarePen className="h-4 w-4" /> Edit profile</button><button onClick={() => setBannerOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-zinc-300"><ImagePlus className="h-4 w-4" /> Change scene</button></div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
            </aside>
            <div className="hidden min-w-0 lg:block">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4"><div className="grid grid-cols-4 gap-2">{[{ label: "SEEN", value: filmsWatched + seriesWatched }, { label: "VERDICTS", value: ratedMovies.length }, { label: "QUEUED", value: watchlist.length }, { label: "AVG VERDICT", value: avgRating ?? "N/A" }].map((item) => <div key={item.label} className="min-w-[100px] rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2"><p className="text-lg font-extrabold tabular-nums">{item.value}</p><p className="text-[9px] font-semibold tracking-wider text-zinc-500">{item.label}</p></div>)}</div><div className="flex gap-2"><button onClick={openEdit} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><SquarePen className="h-4 w-4" /> Edit profile</button><button onClick={() => setBannerOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-zinc-300 hover:bg-white/10"><ImagePlus className="h-4 w-4" /> Change scene</button></div></div>
              <div className="border-b border-white/10 px-5 py-6 sm:px-7"><h3 className="text-sm font-bold tracking-tight">The Top Five</h3><p className="mt-4 text-xs text-zinc-500">Your cinematic favorites, all in one place.</p><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{favouriteMedia.slice(0, 5).map((item) => <Link key={`${item.mediaType}-${item.id}`} to={`/${item.mediaType}/${item.id}`} className="w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 sm:w-24"><img src={item.posterPath} alt={item.title} className="aspect-[2/3] w-full object-cover" /><p className="truncate px-1 py-1 text-[10px] text-zinc-400">{item.title}</p></Link>)}{favouriteMedia.length === 0 && <p className="py-3 text-xs text-zinc-600">Empty. Five slots await your favorite titles.</p>}</div></div>
              <div className="grid min-h-[180px] grid-cols-2"><div className="border-r border-white/10 p-6"><h3 className="text-sm font-bold">Favorite Actors</h3><div className="mt-5 flex flex-wrap gap-2">{favouriteTalents.slice(0, 4).map((item) => <Link key={item.id} to={`/talent/${item.id}`} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-xs text-zinc-300">{item.profilePath && <img src={item.profilePath} alt="" className="h-7 w-7 rounded-full object-cover" />}{item.name}</Link>)}{favouriteTalents.length === 0 && <p className="text-xs text-zinc-500">No faces enshrined yet.</p>}</div></div><div className="p-6"><h3 className="text-sm font-bold">Highest Rated</h3><div className="mt-5 space-y-2">{ratedMovies.slice().sort((a, b) => b.rating - a.rating).slice(0, 3).map((item) => <Link key={item.id} to={`/${item.mediaType || "movie"}/${item.id}`} className="flex items-center justify-between gap-2 text-xs text-zinc-400 hover:text-white"><span className="truncate">{item.title}</span><span className="shrink-0 text-amber-400">★ {item.rating}</span></Link>)}{ratedMovies.length === 0 && <p className="text-xs leading-relaxed text-zinc-500">Rate a few films or shows and the best of them stand here.</p>}</div></div></div>
            </div>
          </div>
        </section>
        <AnimatePresence>
          {editOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 px-3 pb-3 pt-20 backdrop-blur-lg sm:px-5 sm:pb-5 sm:pt-24" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}><motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} role="dialog" aria-modal="true" aria-label="Edit profile" className="max-h-[calc(100dvh-6.5rem)] w-full max-w-lg overflow-y-auto rounded-[22px] border border-white/10 bg-[#0b0b0d] p-5 shadow-[0_25px_90px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.08)] sm:p-7"><h3 className="mb-6 text-base font-bold">Edit profile</h3><div className="space-y-5"><label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Name</span><input value={editDraft.username} onChange={(e) => setEditDraft((d) => ({ ...d, username: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-white/30" /></label><label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Bio</span><textarea rows={4} value={editDraft.bio} onChange={(e) => setEditDraft((d) => ({ ...d, bio: e.target.value }))} placeholder="Your cinematic thesis, e.g. Practical effects or nothing." className="w-full resize-none rounded-lg border border-white/10 bg-black p-3 text-sm outline-none focus:border-white/30" /></label><label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Location</span><input value={editDraft.location} onChange={(e) => setEditDraft((d) => ({ ...d, location: e.target.value }))} placeholder="City, country" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-white/30" /></label><label className="block"><span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Handle</span><div className="flex items-center rounded-lg border border-white/10 bg-black"><span className="pl-3 text-zinc-500">@</span><input value={editDraft.handle} onChange={(e) => setEditDraft((d) => ({ ...d, handle: e.target.value.replace(/^@/, "") }))} maxLength={15} placeholder="username" className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none" /></div><p className="mt-1 text-[10px] text-zinc-500">3–15 characters; letters, numbers, underscores.</p></label><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Links</p><div className="space-y-2">{editDraft.links.map((item, index) => <div key={index} className="flex gap-2"><input aria-label="Link label" placeholder="Label" value={item.label} onChange={(e) => setEditDraft((d) => ({ ...d, links: d.links.map((link, i) => i === index ? { ...link, label: e.target.value } : link) }))} className="w-[35%] min-w-0 rounded-lg border border-white/10 bg-black px-2 py-2 text-xs outline-none" /><input aria-label="Link URL" placeholder="https://..." value={item.url} onChange={(e) => setEditDraft((d) => ({ ...d, links: d.links.map((link, i) => i === index ? { ...link, url: e.target.value } : link) }))} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-2 py-2 text-xs outline-none" /><button aria-label="Remove link" onClick={() => setEditDraft((d) => ({ ...d, links: d.links.filter((_, i) => i !== index) }))} className="p-1 text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button></div>)}</div><button onClick={() => setEditDraft((d) => ({ ...d, links: [...d.links, { label: "", url: "" }] }))} className="mt-2 text-xs text-zinc-400 hover:text-white">+ Add link</button></div></div><div className="mt-7 flex items-center gap-4"><button disabled={isSaving} onClick={saveEdit} className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50">{isSaving ? "Saving..." : "Save"}</button><button onClick={() => setEditOpen(false)} className="text-xs text-zinc-400 hover:text-white">Cancel</button></div></motion.div></motion.div>}
          {photoOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 px-3 pb-3 pt-20 backdrop-blur-lg sm:px-5 sm:pb-5 sm:pt-24" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoOpen(false); }}><motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} role="dialog" aria-modal="true" aria-label="Profile photo" className="flex max-h-[calc(100dvh-6.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0b0d] shadow-[0_25px_90px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.08)]"><div className="flex items-center justify-between border-b border-white/10 p-5"><h3 className="font-bold">Profile photo</h3><button onClick={() => setPhotoOpen(false)} aria-label="Close"><X className="h-4 w-4" /></button></div><div className="min-h-0 overflow-y-auto p-5"><div className="mb-5 flex items-start gap-4"><img src={displayPhoto || "/user-icon.jpg"} alt="Current profile" className="h-28 w-24 rounded-lg bg-zinc-900 object-contain" /><div className="space-y-3"><button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs"><Upload className="h-4 w-4" /> Upload from device</button>{accountPhoto && <button onClick={useAccountPhoto} disabled={isUploadingPhoto} className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"><img src={accountPhoto} alt="Account" className="h-5 w-5 rounded-full object-cover" /> Use account photo</button>}<button onClick={async () => { await handleRemovePhoto(); setPhotoOpen(false); }} disabled={!displayPhoto || isUploadingPhoto} className="flex items-center gap-2 text-xs text-zinc-400 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Remove photo</button><p className="max-w-[240px] text-[11px] leading-relaxed text-zinc-500">Choose your own photo or use an image from a talent's gallery.</p></div></div><div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/50 p-1">{([{ id: "favourites", label: "Favourite talents" }, { id: "search", label: "Search talents" }] as const).map((item) => <button key={item.id} onClick={() => { setPhotoMode(item.id); setTalentGallery([]); setTalentGalleryName(""); }} className={`rounded-lg px-2 py-2.5 text-xs font-semibold ${photoMode === item.id ? "border border-white/15 bg-white/10 text-white shadow-inner" : "text-zinc-500"}`}>{item.label}</button>)}</div>{photoMode === "search" && <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={talentSearch} onChange={(e) => { setTalentSearch(e.target.value); setTalentGallery([]); }} placeholder="Search actors, directors, talents..." className="w-full rounded-xl border border-white/10 bg-black/50 py-3 pl-10 pr-3 text-sm outline-none" /></div>}{talentGalleryName && <button onClick={() => { setTalentGalleryName(""); setTalentGallery([]); }} className="mb-3 flex items-center gap-1 text-xs text-zinc-400"><ChevronRight className="h-4 w-4 rotate-180" /> {talentGalleryName} · Back</button>}{talentLoading && <div className="flex items-center gap-2 py-3 text-xs text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>}{talentGalleryName ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{talentGallery.map((item) => <button key={item.file_path} disabled={isUploadingPhoto} onClick={() => saveTalentPhoto(item.file_path)} className="overflow-hidden rounded-xl border border-white/10 hover:border-red-400/50 disabled:opacity-50"><img src={`https://image.tmdb.org/t/p/w185${item.file_path}`} alt={`${talentGalleryName} portrait`} loading="lazy" className="aspect-[3/4] w-full object-contain bg-zinc-900" /></button>)}{!talentLoading && !talentGallery.length && <p className="col-span-full py-6 text-center text-xs text-zinc-500">No gallery images available.</p>}</div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{(photoMode === "favourites" ? favouriteTalents.map((item) => ({ id: Number(item.id), name: item.name, profile_path: item.profilePath ? item.profilePath.replace(/^.*?image\.tmdb\.org\/t\/p\/[^/]+/, "") : null })) : talentResults).map((item) => <button key={item.id} onClick={() => openTalentGallery(item.id, item.name)} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left hover:border-white/30">{item.profile_path ? <img src={item.profile_path.startsWith("http") ? item.profile_path : `https://image.tmdb.org/t/p/w185${item.profile_path}`} alt={item.name} loading="lazy" className="aspect-[3/4] w-full object-contain bg-zinc-900" /> : <div className="flex aspect-[3/4] items-center justify-center"><User className="h-6 w-6 text-zinc-600" /></div>}<p className="truncate p-2 text-[11px]">{item.name}</p></button>)}{photoMode === "favourites" && !favouriteTalents.length && <p className="col-span-full py-6 text-center text-xs text-zinc-500">No favourite talents yet. Try searching instead.</p>}</div>}</div><div className="border-t border-white/10 p-4 text-right"><button onClick={() => setPhotoOpen(false)} className="rounded-lg bg-white/10 px-4 py-2 text-xs text-zinc-300">Close</button></div></motion.div></motion.div>}
        </AnimatePresence>
        <AnimatePresence>
          {bannerOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] flex items-end justify-center bg-black/80 px-0 pb-0 pt-20 backdrop-blur-lg sm:items-center sm:px-5 sm:pb-5 sm:pt-24" onMouseDown={(event) => { if (event.target === event.currentTarget) setBannerOpen(false); }}>
            <motion.div initial={{ y: 36, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 36, opacity: 0 }} className="flex max-h-[calc(100dvh-6.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#141417] shadow-2xl sm:max-h-[85vh] sm:rounded-[28px]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6"><div><h3 className="text-lg font-bold tracking-tight">Set the scene</h3><p className="mt-0.5 text-xs text-zinc-500">Make your profile feel like your favorite film</p></div><button onClick={() => setBannerOpen(false)} aria-label="Close banner selector" className="rounded-full bg-white/10 p-2 text-zinc-300 hover:bg-white/20"><X className="h-4 w-4" /></button></div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="flex rounded-full border border-white/10 bg-black/40 p-1">
                    {([{ id: "discover", label: "Explore TMDB" }, { id: "history", label: "Watch history" }] as const).map((item) => <button key={item.id} onClick={() => { setSceneSource(item.id); setSceneImages([]); setSceneTitle(""); setBannerSearch(""); }} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${sceneSource === item.id ? "bg-red-600 text-white" : "text-zinc-400 hover:text-white"}`}>{item.label}</button>)}
                  </div>
                  <button onClick={() => bannerInputRef.current?.click()} className="ml-auto flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20"><Upload className="h-3.5 w-3.5" /> Upload image</button>
                  <input ref={bannerInputRef} type="file" accept="image/*" onChange={uploadBanner} className="hidden" />
                </div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={bannerSearch} onChange={(event) => setBannerSearch(event.target.value)} placeholder={sceneSource === "discover" ? "Search movies and series..." : "Filter watched titles..."} className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-red-500/50" /></div>
                </div>
                <div className="mb-4 flex items-center gap-2"><span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Scene position</span>{(["top", "center", "bottom"] as const).map((position) => <button key={position} onClick={() => setScenePosition(position)} className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${scenePosition === position ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}>{position}</button>)}</div>
                {sceneTitle && <button onClick={() => { setSceneTitle(""); setSceneImages([]); setSceneChosenUrl(""); }} className="mb-3 flex items-center gap-2 self-start text-xs font-medium text-zinc-300 hover:text-white"><ChevronRight className="h-4 w-4 rotate-180" /> Back to titles <span className="text-zinc-500">/ {sceneTitle}</span></button>}
                {(sceneResultLoading || sceneImagesLoading || (sceneSource === "history" && bannerLoading)) && <div className="flex items-center gap-2 py-3 text-xs text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading scenes...</div>}
                {sceneTitle ? <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{sceneImages.map((item, index) => <button key={`${item.url}-${index}`} onClick={() => setSceneChosenUrl(item.url)} className={`group relative overflow-hidden rounded-xl border transition ${sceneChosenUrl === item.url ? "border-red-500 ring-2 ring-red-500/30" : "border-white/10 hover:border-white/30"}`}><img src={item.url.replace('/original', '/w500')} alt={`${item.title} scene ${index + 1}`} loading="lazy" className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />{sceneChosenUrl === item.url && <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 rounded-full bg-black/60 text-red-400" />}</button>)}</div> : <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{sceneSource === "discover" ? sceneResults.map((item) => <button key={`${item.mediaType}-${item.id}`} onClick={() => openSceneTitle(item.mediaType, item.id, item.title)} className="group relative overflow-hidden rounded-xl border border-white/10 text-left hover:border-red-500/40"><img src={item.backdrop} alt={item.title} loading="lazy" className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent px-2.5 pb-2 pt-8"><p className="truncate text-xs font-semibold">{item.title}</p><p className="text-[10px] uppercase text-zinc-400">{item.mediaType === "tv" ? "Series" : "Movie"}</p></div></button>) : bannerCandidates.filter((item) => item.title.toLowerCase().includes(bannerSearch.toLowerCase()) && bannerChoices[`${item.mediaType}-${item.id}`]).map((item) => { const key = `${item.mediaType}-${item.id}`; return <button key={key} onClick={() => openSceneTitle(item.mediaType as "movie" | "tv", Number(item.id), item.title)} className="group relative overflow-hidden rounded-xl border border-white/10 text-left hover:border-red-500/40"><img src={bannerChoices[key]} alt={item.title} loading="lazy" className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent px-2.5 pb-2 pt-8"><p className="truncate text-xs font-semibold">{item.title}</p></div></button>; })}</div>}
                {sceneTitle && !sceneImagesLoading && !sceneImages.length && <p className="py-8 text-center text-sm text-zinc-500">No scenes available for this title.</p>}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#141417] px-4 py-4 sm:px-6"><button disabled={bannerSaving || !bannerUrl} onClick={() => saveBanner("", "")} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white disabled:opacity-30"><Trash2 className="h-4 w-4" /> Reset scene</button><button disabled={bannerSaving || (!sceneChosenUrl && !bannerUrl)} onClick={() => saveBanner(sceneChosenUrl || bannerUrl, sceneChosenUrl ? sceneTitle : bannerTitle)} className="rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2.5 text-xs font-bold text-white transition hover:from-red-400 hover:to-rose-500 disabled:opacity-40">{bannerSaving ? "Saving…" : "Apply scene"}</button></div>
            </motion.div>
          </motion.div>}
        </AnimatePresence>

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
                  case "favourites":
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

          {activeTab === "favourites" && (
            <motion.div
              key="favourites"
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

                <div className="relative flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/30 shrink-0">
                      <Heart className="w-4 h-4 fill-current" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-white">
                        Favourites
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {totalFavourites} item{totalFavourites !== 1 ? "s" : ""} saved
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/favourites"
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors duration-200 shrink-0"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="relative grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.06] bg-black/30 p-1 mb-5 backdrop-blur-2xl">
                  {[
                    { key: "movie" as const, label: "Movies", count: favouriteMovies.length, icon: Film },
                    { key: "tv" as const, label: "Series", count: favouriteSeries.length, icon: Tv },
                    { key: "talent" as const, label: "Talent", count: favouriteTalents.length, icon: User },
                  ].map((option) => {
                    const active = favouritesFilter === option.key;
                    const Icon = option.icon;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setFavouritesFilter(option.key)}
                        className={`relative flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] sm:text-xs font-bold transition-all duration-300 ${active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="profile-favourites-filter"
                            className="absolute inset-0 rounded-xl border border-white/[0.1] bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_5px_16px_rgba(0,0,0,0.25)]"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <Icon
                          className={`relative z-10 w-3.5 h-3.5 ${active
                              ? option.key === "movie"
                                ? "text-red-400"
                                : option.key === "tv"
                                  ? "text-cyan-400"
                                  : "text-violet-400"
                              : "text-zinc-600"
                            }`}
                        />
                        <span className="relative z-10 hidden xs:inline">{option.label}</span>
                        <span
                          className={`relative z-10 min-w-5 rounded-md px-1.5 py-0.5 text-[8px] tabular-nums ${active ? "bg-white/[0.08] text-zinc-300" : "bg-white/[0.03] text-zinc-600"
                            }`}
                        >
                          {option.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {favouritesFilter === "movie" && (
                  favouriteMovies.length === 0 ? (
                    <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-950/30 p-8 text-center shadow-inner">
                      <div className="relative z-10 flex flex-col items-center max-w-xs mx-auto">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 mb-4 shadow-xl">
                          <Film className="w-5 h-5" />
                        </div>
                        <h3 className="text-xs font-black tracking-[0.2em] text-zinc-400 uppercase">No Favourite Movies</h3>
                        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">Favourite movies you love and they will appear here.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4 w-full">
                      {favouriteMovies.map((item, idx) => (
                        <Link
                          key={`movie-${item.id}`}
                          to={`/movie/${item.id}`}
                          className="group relative flex flex-col justify-between bg-zinc-950/30 border border-zinc-900 rounded-2xl p-2 transition-all duration-500 hover:bg-zinc-950/80 hover:border-red-500/20 hover:shadow-[0_12px_30px_rgba(239,68,68,0.04)] active:scale-[0.98]"
                        >
                          <div className="absolute -inset-px rounded-2xl border border-transparent group-hover:border-red-500/10 bg-gradient-to-b from-white/[0.04] to-transparent [mask-image:linear-gradient(to_bottom,white,transparent)] group-hover:[mask-image:none] pointer-events-none transition-all duration-500" />
                          <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/[0.02] shadow-md">
                            <div className="absolute top-1.5 left-1.5 z-10 flex items-center justify-center h-4 bg-zinc-950/80 backdrop-blur-md border border-white/[0.06] rounded-md px-1.5 shadow-sm">
                              <span className="text-[8px] font-black tracking-tighter text-zinc-400 group-hover:text-red-400 transition-colors">#{idx + 1}</span>
                            </div>
                            <div className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center w-4 h-4 bg-red-500 rounded-md shadow-md shadow-red-500/20">
                              <Heart className="w-2 h-2 text-white fill-current" />
                            </div>
                            {item.posterPath ? (
                              <img src={item.posterPath} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900"><Film className="w-5 h-5 text-zinc-700" /></div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent pointer-events-none" />
                          </div>
                          <div className="pt-2 px-0.5">
                            <p className="text-[10px] sm:text-xs font-bold text-zinc-400 group-hover:text-red-400 tracking-tight transition-colors truncate">{item.title}</p>
                            <span className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600 block mt-0.5">Movie</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
                )}

                {favouritesFilter === "tv" && (
                  favouriteSeries.length === 0 ? (
                    <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-950/30 p-8 text-center shadow-inner">
                      <div className="relative z-10 flex flex-col items-center max-w-xs mx-auto">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 mb-4 shadow-xl"><Tv className="w-5 h-5" /></div>
                        <h3 className="text-xs font-black tracking-[0.2em] text-zinc-400 uppercase">No Favourite Series</h3>
                        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">Favourite series you love and they will appear here.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4 w-full">
                      {favouriteSeries.map((item, idx) => (
                        <Link
                          key={`tv-${item.id}`}
                          to={`/tv/${item.id}`}
                          className="group relative flex flex-col justify-between bg-zinc-950/30 border border-zinc-900 rounded-2xl p-2 transition-all duration-500 hover:bg-zinc-950/80 hover:border-red-500/20 hover:shadow-[0_12px_30px_rgba(239,68,68,0.04)] active:scale-[0.98]"
                        >
                          <div className="absolute -inset-px rounded-2xl border border-transparent group-hover:border-red-500/10 bg-gradient-to-b from-white/[0.04] to-transparent [mask-image:linear-gradient(to_bottom,white,transparent)] group-hover:[mask-image:none] pointer-events-none transition-all duration-500" />
                          <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-white/[0.02] shadow-md">
                            <div className="absolute top-1.5 left-1.5 z-10 flex items-center justify-center h-4 bg-zinc-950/80 backdrop-blur-md border border-white/[0.06] rounded-md px-1.5 shadow-sm"><span className="text-[8px] font-black tracking-tighter text-zinc-400 group-hover:text-red-400 transition-colors">#{idx + 1}</span></div>
                            <div className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center w-4 h-4 bg-red-500 rounded-md shadow-md shadow-red-500/20"><Heart className="w-2 h-2 text-white fill-current" /></div>
                            {item.posterPath ? (
                              <img src={item.posterPath} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900"><Tv className="w-5 h-5 text-zinc-700" /></div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent pointer-events-none" />
                          </div>
                          <div className="pt-2 px-0.5">
                            <p className="text-[10px] sm:text-xs font-bold text-zinc-400 group-hover:text-red-400 tracking-tight transition-colors truncate">{item.title}</p>
                            <span className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600 block mt-0.5">Series</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
                )}

                {favouritesFilter === "talent" && (
                  favouriteTalents.length === 0 ? (
                    <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-950/30 p-8 text-center shadow-inner">
                      <div className="relative z-10 flex flex-col items-center max-w-xs mx-auto">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 mb-4 shadow-xl"><User className="w-5 h-5" /></div>
                        <h3 className="text-xs font-black tracking-[0.2em] text-zinc-400 uppercase">No Favourite Talent</h3>
                        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">Favourite actors, directors and artists to keep them together here.</p>
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
                            <div className="absolute top-1.5 left-1.5 z-10 flex items-center justify-center h-4 bg-zinc-950/80 backdrop-blur-md border border-white/[0.06] rounded-md px-1.5 shadow-sm"><span className="text-[8px] font-black tracking-tighter text-zinc-400 group-hover:text-red-400 transition-colors">#{idx + 1}</span></div>
                            <div className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center w-4 h-4 bg-red-500 rounded-md shadow-md shadow-red-500/20"><Heart className="w-2 h-2 text-white fill-current" /></div>
                            {talent.profilePath ? (
                              <img src={talent.profilePath} alt={talent.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900"><User className="w-5 h-5 text-zinc-700" /></div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent pointer-events-none" />
                          </div>
                          <div className="pt-2 px-0.5">
                            <p className="text-[10px] sm:text-xs font-bold text-zinc-400 group-hover:text-red-400 tracking-tight transition-colors truncate">{talent.name}</p>
                            <span className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600 block mt-0.5">Talent</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
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