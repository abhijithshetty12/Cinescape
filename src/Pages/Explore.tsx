import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Clapperboard,
  Tv,
  TrendingUp,
  Calendar,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Play,
  Loader2,
  ImageOff,
} from "lucide-react";
import {
  fetchMediaByType,
  searchTMDB,
  fetchGenres,
  MediaItem,
} from "../api.ts";
import Loading from "../components/Loading.tsx";

const CircularRating = ({ rating }: { rating: number }) => {
  const percentage = Math.round((rating / 10) * 100);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color =
    percentage >= 70 ? "#22c55e" : percentage >= 50 ? "#eab308" : "#ef4444";

  return (
    <div className="relative w-12 h-12 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full border border-white/10">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">
        {percentage}%
      </span>
    </div>
  );
};

const SkeletonCard = () => (
  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900/80 border border-white/5">
    <div className="absolute inset-0 skeleton-shimmer" />
    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
    <div className="absolute bottom-4 left-4 right-4 space-y-2">
      <div className="h-4 bg-zinc-800 rounded w-3/4" />
      <div className="h-3 bg-zinc-800 rounded w-1/2" />
    </div>
  </div>
);

const MovieCard = ({
  movie,
  mediaType,
  index,
}: {
  movie: MediaItem;
  mediaType: "movie" | "tv";
  index: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrors, setImageErrors] = useState<{ poster?: boolean; backdrop?: boolean }>({});

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      className="group relative"
    >
      <Link to={mediaType === "movie" ? `/movie/${movie.id}` : `/tv/${movie.id}`}>
        <div
          className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 shadow-lg transition-all duration-500 hover:shadow-2xl hover:shadow-red-900/20 hover:border-white/20 hover:-translate-y-1"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {movie.image && !imageErrors.poster ? (
            <img
              src={movie.image}
              alt={movie.title}
              loading="lazy"
              onError={() => setImageErrors((prev) => ({ ...prev, poster: true }))}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                isHovered && movie.backdrop && !imageErrors.backdrop ? "opacity-0 scale-105" : "opacity-100 scale-100"
              }`}
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-900 to-zinc-950 text-zinc-500 px-4 text-center">
              <ImageOff className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
              <span className="text-xs font-medium tracking-wide">No Image Available</span>
            </div>
          )}

          {movie.backdrop && !imageErrors.backdrop && (
            <img
              src={movie.backdrop}
              alt=""
              onError={() => setImageErrors((prev) => ({ ...prev, backdrop: true }))}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                isHovered ? "opacity-100 scale-100" : "opacity-0 scale-110"
              }`}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
          <div className="absolute inset-0 bg-gradient-to-br from-red-900/0 to-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="absolute top-3 right-3 z-10">
            <CircularRating rating={movie.rating} />
          </div>

          {movie.year > 0 && (
            <div className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg px-2 py-1">
              <span className="text-[11px] font-semibold text-white/90">
                {movie.year}
              </span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <div className="transform transition-all duration-500 translate-y-2 group-hover:translate-y-0">
              <h3 className="text-white font-bold text-base md:text-lg leading-tight mb-2 line-clamp-2 drop-shadow-lg">
                {movie.title}
              </h3>

              <div className="flex flex-wrap gap-1.5 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-75">
                {movie.genre.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="text-[10px] px-2 py-0.5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-white/80 font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {movie.videoUrl && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Watch Now</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const HeroBanner = ({
  featured,
  mediaType,
}: {
  featured: MediaItem | null;
  mediaType: "movie" | "tv";
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [heroImageError, setHeroImageError] = useState(false);

  const featuredItems = useMemo(() => {
    if (!featured) return [];
    return [featured];
  }, [featured]);

  const items = featuredItems;
  const current = items[currentIndex];

  useEffect(() => {
    if (items.length <= 1 || !isAutoPlaying) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [items.length, isAutoPlaying, currentIndex]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  useEffect(() => {
    setHeroImageError(false);
  }, [currentIndex]);

  if (!current) return null;

  const heroImageSrc = current.backdrop || current.image?.replace("w500", "original");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative w-full h-[45vh] md:h-[55vh] lg:h-[70vh] overflow-hidden rounded-3xl mb-8 group bg-zinc-950 border border-white/5"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {heroImageSrc && !heroImageError ? (
            <img
              src={heroImageSrc}
              alt={current.title}
              onError={() => setHeroImageError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-900 to-zinc-950 text-zinc-500">
              <ImageOff className="w-12 h-12 text-zinc-700 stroke-[1.5]" />
              <span className="text-sm font-medium tracking-wide">No Preview Image Available</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950/60" />

      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-10 lg:p-14 pt-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg text-[10px] font-black uppercase tracking-wider text-white shadow-[0_4px_12px_rgba(239,68,68,0.25)]">
                {mediaType === "movie" ? "Featured Movie" : "Featured Series"}
              </span>
              <div className="flex items-center gap-1.5 bg-neutral-950/60 backdrop-blur-md border border-white/[0.06] px-2.5 py-1 rounded-lg shadow-md">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="text-zinc-100 font-bold text-xs">
                  {current.rating.toFixed(1)}
                </span>
              </div>
              {current.year > 0 && (
                <span className="text-zinc-200 text-xs font-bold bg-neutral-950/60 backdrop-blur-md border border-white/[0.06] px-2.5 py-1 rounded-lg shadow-md">
                  {current.year}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-2.5 tracking-tight leading-[1.1] uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {current.title}
            </h1>

            {current.overview && (
              <p className="text-zinc-100 text-xs sm:text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-5 max-w-2xl leading-relaxed tracking-wide font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {current.overview}
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Link
                to={mediaType === "movie" ? `/movie/${current.id}` : `/tv/${current.id}`}
                className="hero-btn-glow group relative flex items-center justify-center gap-2.5 px-6 py-3 sm:px-8 sm:py-3.5 rounded-xl font-bold text-white text-xs sm:text-sm uppercase tracking-wider overflow-hidden w-full sm:w-fit shrink-0 shadow-lg"
                aria-label="View Details"
              >
                <span className="hero-btn-shine" aria-hidden="true" />
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white relative z-10 group-hover:scale-110 transition-transform duration-200" />
                <span className="relative z-10">View Details</span>
              </Link>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                {current.genre.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="shrink-0 px-3 py-1.5 bg-neutral-950/70 backdrop-blur-md border border-white/[0.08] rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-200 shadow-md"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {items.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border border-white/10 text-white p-2 md:p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110 active:scale-95 z-20"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-md border border-white/10 text-white p-2 md:p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110 active:scale-95 z-20"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </>
      )}

      {items.length > 1 && (
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 md:gap-2 z-20">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${
                currentIndex === index
                  ? "w-6 md:w-8 bg-red-600"
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {items.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
          <motion.div
            className="h-full bg-red-600"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 5, ease: "linear" }}
            key={currentIndex}
          />
        </div>
      )}
    </motion.div>
  );
};

const MovieList = () => {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search");

  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [sortOpen, setSortOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);

  const sortOptions = useMemo(
    () => [
      { value: "popularity.desc", label: "Most Popular", icon: TrendingUp },
      { value: "vote_average.desc", label: "Top Rated", icon: Star },
      { value: "release_date.desc", label: "Newest", icon: Calendar },
    ],
    []
  );

  useEffect(() => {
    const loadGenres = async () => {
      const g = await fetchGenres(mediaType);
      setGenres(g);
    };
    loadGenres();
  }, [mediaType]);

  const loadMedia = useCallback(
    async (currentPage: number, reset: boolean = false) => {
      if (loading) return;
      setLoading(true);

      let data: MediaItem[] = [];

      if (searchQuery) {
        data = await searchTMDB(searchQuery, currentPage, mediaType);
      } else {
        data = await fetchMediaByType(
          mediaType,
          currentPage,
          sortBy,
          selectedGenre ?? undefined
        );
      }

      if (reset) {
        setMovies(data);
        setPage(1);
        setHasMore(data.length >= 20);
      } else {
        setMovies((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newItems = data.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newItems];
        });
        setHasMore(data.length >= 20);
      }

      setLoading(false);
      setInitialLoading(false);
    },
    [mediaType, searchQuery, sortBy, selectedGenre, loading]
  );

  useEffect(() => {
    setInitialLoading(true);
    setMovies([]);
    setPage(1);
    setHasMore(true);
    loadMedia(1, true);
  }, [mediaType, searchQuery, sortBy, selectedGenre]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadMedia(nextPage);
        }
      },
      { rootMargin: "300px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [page, hasMore, loading, loadMedia]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleMediaTypeChange = (type: "movie" | "tv") => {
    if (type === mediaType) return;
    setMediaType(type);
    setSelectedGenre(null);
  };

  const activeSortLabel = sortOptions.find((s) => s.value === sortBy)?.label;

  const featured = useMemo(() => {
    if (movies.length === 0) return null;
    const withBackdrop = movies.filter((m) => m.backdrop);
    if (withBackdrop.length > 0) {
      return withBackdrop.reduce((best, curr) =>
        curr.rating > best.rating ? curr : best
      );
    }
    return movies[0];
  }, [movies]);

  if (initialLoading && movies.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="container mx-auto px-4 py-8">
          <div className="h-[50vh] rounded-3xl bg-zinc-900 animate-pulse mb-8" />
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-48 bg-zinc-900 rounded-full animate-pulse" />
            <div className="h-10 w-32 bg-zinc-900 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <div className="container mx-auto px-4 py-6 md:py-8">
        {!searchQuery && <HeroBanner featured={featured} mediaType={mediaType} />}

        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 text-white mb-2">
              <Search className="w-6 h-6 text-red-500" />
              <h1 className="text-2xl md:text-3xl font-bold">
                Search Results for "{searchQuery}"
              </h1>
            </div>
            <p className="text-zinc-400 text-sm ml-9">
              {movies.length} {mediaType === "movie" ? "movies" : "series"}{" "}
              found
            </p>
          </motion.div>
        )}

        <div className="sticky top-[72px] z-30 mb-8 -mx-4 px-4 py-3 bg-zinc-950/80 backdrop-blur-xl border-y border-white/5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex items-center p-1 bg-neutral-900/40 backdrop-blur-xl rounded-xl border border-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-fit">
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => handleMediaTypeChange("movie")}
                    className={`relative z-10 px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs font-bold tracking-wider uppercase transition-colors duration-300 rounded-lg flex items-center gap-2 outline-none ${
                      mediaType === "movie" ? "text-neutral-950" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Clapperboard className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Movies</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMediaTypeChange("tv")}
                    className={`relative z-10 px-3.5 py-2 sm:px-5 sm:py-2.5 text-xs font-bold tracking-wider uppercase transition-colors duration-300 rounded-lg flex items-center gap-2 outline-none ${
                      mediaType === "tv" ? "text-neutral-950" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Series</span>
                  </button>

                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg shadow-[0_4px_15px_rgba(239,68,68,0.3)] pointer-events-none"
                    animate={{
                      x: mediaType === "movie" ? "0%" : "100%",
                    }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      width: "50%",
                      zIndex: 0,
                    }}
                  />
                </div>
              </div>

              {!searchQuery && (
                <div className="relative lg:hidden" ref={sortRef}>
                  <button
                    onClick={() => setSortOpen(!sortOpen)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900/60 border border-white/5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:border-white/10 transition-all duration-300"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>{activeSortLabel}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-300 ${
                        sortOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {sortOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-48 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                      >
                        {sortOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSortBy(option.value);
                              setSortOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                              sortBy === option.value
                                ? "bg-red-600/10 text-red-400"
                                : "text-zinc-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {!searchQuery && genres.length > 0 && (
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar py-1">
                <div className="inline-flex items-center gap-2 pr-4">
                  <button
                    onClick={() => setSelectedGenre(null)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${
                      selectedGenre === null
                        ? "bg-red-600/20 border-red-500/40 text-red-400"
                        : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/10"
                    }`}
                  >
                    All
                  </button>
                  {genres.map((g) => (
                    <button
                      key={g.id}
                      onClick={() =>
                        setSelectedGenre(
                          selectedGenre === g.id ? null : g.id
                        )
                      }
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${
                        selectedGenre === g.id
                          ? "bg-red-600/20 border-red-500/40 text-red-400"
                          : "bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/10"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!searchQuery && (
              <div className="relative hidden lg:block shrink-0" ref={sortRef}>
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900/60 border border-white/5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:border-white/10 transition-all duration-300"
                >
                  <Filter className="w-3.5 h-3.5" />
                  {activeSortLabel}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${
                      sortOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {sortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-48 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      {sortOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setSortOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                            sortBy === option.value
                              ? "bg-red-600/10 text-red-400"
                              : "text-zinc-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <option.icon className="w-4 h-4" />
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {!searchQuery && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            {mediaType === "movie" ? (
              <Clapperboard className="w-7 h-7 text-red-500" />
            ) : (
              <Tv className="w-7 h-7 text-red-500" />
            )}
            <h2 className="text-xl md:text-2xl font-bold text-white">
              {selectedGenre
                ? genres.find((g) => g.id === selectedGenre)?.name
                : mediaType === "movie"
                ? "Popular Movies"
                : "Popular Series"}
            </h2>
            {selectedGenre && (
              <button
                onClick={() => setSelectedGenre(null)}
                className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-white/10 rounded-full text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {movies.map((movie, index) => (
              <MovieCard
                key={`${movie.id}-${index}`}
                movie={movie}
                mediaType={mediaType}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>

        {loading && movies.length > 0 && (
          <div className="flex justify-center mt-10">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        )}

        {!loading && movies.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <Search className="w-16 h-16 text-zinc-700 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              No results found
            </h3>
            <p className="text-zinc-400 text-sm max-w-md">
              Try adjusting your filters or search query to find what you're
              looking for.
            </p>
          </motion.div>
        )}

        <div ref={sentinelRef} className="h-10 mt-8" />
      </div>

      <style>{`
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.03) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default MovieList;