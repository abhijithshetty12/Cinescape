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
  Search,
  X,
  Play,
  Loader2,
} from "lucide-react";
import {
  fetchMediaByType,
  searchTMDB,
  fetchGenres,
  MediaItem,
} from "../api.ts";
import Loading from "../components/Loading.tsx";

/* ─── Circular Rating Badge ─── */
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

/* ─── Skeleton Card ─── */
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

/* ─── Movie Card ─── */
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
          {/* Poster Image */}
          <img
            src={movie.image}
            alt={movie.title}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
              isHovered && movie.backdrop ? "opacity-0 scale-105" : "opacity-100 scale-100"
            }`}
          />

          {/* Backdrop Reveal on Hover */}
          {movie.backdrop && (
            <img
              src={movie.backdrop}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                isHovered ? "opacity-100 scale-100" : "opacity-0 scale-110"
              }`}
            />
          )}

          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
          <div className="absolute inset-0 bg-gradient-to-br from-red-900/0 to-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Top Badges */}
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

          {/* Hover Content */}
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

/* ─── Hero Banner ─── */
const HeroBanner = ({
  featured,
  mediaType,
}: {
  featured: MediaItem | null;
  mediaType: "movie" | "tv";
}) => {
  if (!featured) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative w-full h-[50vh] md:h-[60vh] lg:h-[70vh] overflow-hidden rounded-3xl mb-8 group"
    >
      <img
        src={
          featured.backdrop ||
          featured.image.replace("w500", "original")
        }
        alt={featured.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 lg:p-14">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-red-600/90 backdrop-blur-sm rounded-full text-xs font-bold text-white uppercase tracking-wider">
              {mediaType === "movie" ? "Featured Movie" : "Featured Series"}
            </span>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-white font-bold text-sm">
                {featured.rating.toFixed(1)}
              </span>
            </div>
            {featured.year > 0 && (
              <span className="text-white/60 text-sm">{featured.year}</span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight">
            {featured.title}
          </h1>

          {featured.overview && (
            <p className="text-white/70 text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-6 max-w-2xl">
              {featured.overview}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={
                mediaType === "movie"
                  ? `/movie/${featured.id}`
                  : `/tv/${featured.id}`
              }
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all duration-300 hover:scale-105 shadow-lg shadow-red-900/30"
            >
              <Play className="w-4 h-4 fill-current" />
              View Details
            </Link>

            {featured.genre.slice(0, 3).map((g) => (
              <span
                key={g}
                className="px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-full text-xs font-medium text-white/80"
              >
                {g}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

/* ─── Main Component ─── */
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

  /* Load genres when media type changes */
  useEffect(() => {
    const loadGenres = async () => {
      const g = await fetchGenres(mediaType);
      setGenres(g);
    };
    loadGenres();
  }, [mediaType]);

  /* Unified load function */
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

  /* Initial load */
  useEffect(() => {
    setInitialLoading(true);
    setMovies([]);
    setPage(1);
    setHasMore(true);
    loadMedia(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, searchQuery, sortBy, selectedGenre]);

  /* Infinite scroll observer */
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

  /* Close sort dropdown on outside click */
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
    // Pick the highest-rated item with a backdrop
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
        {/* Hero Banner */}
        {!searchQuery && <HeroBanner featured={featured} mediaType={mediaType} />}

        {/* Search Results Header */}
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

        {/* Sticky Filter Bar */}
        <div className="sticky top-[72px] z-30 mb-8 -mx-4 px-4 py-3 bg-zinc-950/80 backdrop-blur-xl border-y border-white/5">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            {/* Media Type Toggle */}
            <div className="flex items-center p-1 bg-zinc-900/80 rounded-full w-fit border border-white/5">
              <div className="relative flex items-center">
                <button
                  onClick={() => handleMediaTypeChange("movie")}
                  className={`relative z-10 px-4 py-2 text-sm font-semibold transition-colors duration-300 rounded-full flex items-center gap-2 ${
                    mediaType === "movie" ? "text-white" : "text-zinc-500"
                  }`}
                >
                  <Clapperboard className="w-4 h-4" />
                  Movies
                </button>
                <button
                  onClick={() => handleMediaTypeChange("tv")}
                  className={`relative z-10 px-4 py-2 text-sm font-semibold transition-colors duration-300 rounded-full flex items-center gap-2 ${
                    mediaType === "tv" ? "text-white" : "text-zinc-500"
                  }`}
                >
                  <Tv className="w-4 h-4" />
                  Series
                </button>
                <motion.div
                  className="absolute inset-0 bg-red-600 rounded-full"
                  animate={{
                    x: mediaType === "movie" ? 0 : 110,
                    width: mediaType === "movie" ? 110 : 100,
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                />
              </div>
            </div>

            {/* Genre Chips */}
            {!searchQuery && genres.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
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
            )}

            {/* Sort Dropdown */}
            {!searchQuery && (
              <div className="relative ml-auto" ref={sortRef}>
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

        {/* Section Title */}
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

        {/* Grid */}
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

        {/* Loading state for pagination */}
        {loading && movies.length > 0 && (
          <div className="flex justify-center mt-10">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        )}

        {/* No results */}
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

        {/* Infinite Scroll Sentinel */}
        <div ref={sentinelRef} className="h-10 mt-8" />
      </div>

      {/* Skeleton shimmer animation style */}
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

