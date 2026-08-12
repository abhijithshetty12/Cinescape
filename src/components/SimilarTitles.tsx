import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { ChevronRight, ImageOff, Play } from "lucide-react";

const TMDB_KEY = "859afbb4b98e3b467da9c99ac390e950";

interface SimilarItem {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number;
  genre_ids?: number[];
  popularity?: number;
  media_type?: "movie" | "tv";
}

interface SimilarTitlesProps {
  mediaType: "movie" | "tv";
  currentId: number;
  genreIds?: number[];
  title?: string;
  subtitle?: string;
}

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western", 10759: "Action & Adventure",
  10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
  10767: "Talk", 10768: "War & Politics",
};

const IOSCircularRating = ({ rating = 0 }: { rating?: number }) => {
  const percentage = Math.round((rating / 10) * 100);
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  let color = "#34C759";
  if (percentage < 50) color = "#FF3B30";
  else if (percentage < 70) color = "#FFCC00";

  return (
    <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-black/50 backdrop-blur-xl rounded-full border border-white/15 shadow-md">
      <svg className="w-7 h-7 sm:w-8 sm:h-8 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2.5"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-[9px] font-semibold text-white tracking-tighter">
        {percentage}%
      </span>
    </div>
  );
};

const IOSCard = ({
  item,
  mediaType,
  index,
}: {
  item: SimilarItem;
  mediaType: "movie" | "tv";
  index: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrors, setImageErrors] = useState<{ poster?: boolean; backdrop?: boolean }>({});

  const title = item.title || item.name || "Untitled";
  const releaseDate = item.release_date || item.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;
  const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
  const backdropUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null;
  const genres = (item.genre_ids ?? []).map((id) => GENRE_MAP[id]).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (index % 10) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-[140px] xs:w-[155px] sm:w-[175px] md:w-[190px] shrink-0 snap-start flex flex-col"
    >
      <Link to={mediaType === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`}>
        <div
          className="relative aspect-[2/3] rounded-[20px] overflow-hidden bg-neutral-900 border border-white/10 shadow-md transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-2xl hover:shadow-black/60 hover:border-white/25 hover:scale-[1.03]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {posterUrl && !imageErrors.poster ? (
            <img
              src={posterUrl}
              alt={title}
              loading="lazy"
              onError={() => setImageErrors((prev) => ({ ...prev, poster: true }))}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isHovered && backdropUrl && !imageErrors.backdrop ? "opacity-0 scale-105" : "opacity-100 scale-100"
              }`}
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-900 text-neutral-500 px-3 text-center">
              <ImageOff className="w-6 h-6 text-neutral-600 stroke-[1.5]" />
              <span className="text-[10px] sm:text-xs font-medium tracking-tight">No Preview</span>
            </div>
          )}

          {backdropUrl && !imageErrors.backdrop && (
            <img
              src={backdropUrl}
              alt=""
              onError={() => setImageErrors((prev) => ({ ...prev, backdrop: true }))}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isHovered ? "opacity-100 scale-100" : "opacity-0 scale-105"
              }`}
            />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-white/25 backdrop-blur-md border border-white/40 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-lg">
              <Play className="w-5 h-5 fill-white text-white translate-x-[1px]" />
            </div>
          </div>
          {item.vote_average !== undefined && item.vote_average > 0 && (
            <div className="absolute top-2.5 right-2.5 z-10">
              <IOSCircularRating rating={item.vote_average} />
            </div>
          )}
          {year > 0 && (
            <div className="absolute top-2.5 left-2.5 z-10 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full px-2 py-0.5">
              <span className="text-[10px] font-medium text-white/90 tracking-tight">
                {year}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 px-1 flex flex-col gap-1">
          <h3 className="text-white font-semibold text-xs sm:text-sm leading-snug line-clamp-1 tracking-tight group-hover:text-white/80 transition-colors duration-300">
            {title}
          </h3>
          {genres.length > 0 && (
            <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] font-medium">
              <span className="line-clamp-1 text-neutral-400/90 text-[11px]">
                {genres.slice(0, 2).join(" • ")}
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

const SimilarTitles: React.FC<SimilarTitlesProps> = ({
  mediaType,
  currentId,
  genreIds = [],
  title = "Similar Titles",
  subtitle = "Handpicked recommendations",
}) => {
  const [items, setItems] = useState<SimilarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const genreSet = useMemo(() => new Set(genreIds), [genreIds]);

  const fetchItems = async (pageNum: number) => {
    try {
      const [similarRes, recRes] = await Promise.all([
        axios
          .get(`https://api.themoviedb.org/3/${mediaType}/${currentId}/similar?api_key=${TMDB_KEY}&language=en-US&page=${pageNum}`)
          .then((r) => r.data.results ?? []),
        axios
          .get(`https://api.themoviedb.org/3/${mediaType}/${currentId}/recommendations?api_key=${TMDB_KEY}&language=en-US&page=${pageNum}`)
          .then((r) => r.data.results ?? []),
      ]).catch(() => [[], []]);

      const rawItems = [...similarRes, ...recRes];
      if (rawItems.length === 0) {
        setHasMore(false);
        return [];
      }

      const map = new Map<number, SimilarItem>();
      rawItems.forEach((it: any) => {
        if (!it || it.id === currentId) return;
        if (!it.poster_path && !it.backdrop_path) return;
        map.set(it.id, {
          id: it.id,
          title: it.title,
          name: it.name,
          backdrop_path: it.backdrop_path ?? null,
          poster_path: it.poster_path ?? null,
          release_date: it.release_date ?? null,
          first_air_date: it.first_air_date ?? null,
          vote_average: it.vote_average ?? 0,
          genre_ids: it.genre_ids ?? [],
          popularity: it.popularity ?? 0,
          media_type: mediaType,
        });
      });

      return [...map.values()]
        .map((it) => {
          const overlap = (it.genre_ids ?? []).filter((g) => genreSet.has(g)).length;
          return { it, score: overlap * 1000 + (it.popularity ?? 0) };
        })
        .sort((a, b) => b.score - a.score)
        .map(({ it }) => it);
    } catch {
      setHasMore(false);
      return [];
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadInitial = async () => {
      setLoading(true);
      setPage(1);
      setHasMore(true);
      const initialItems = await fetchItems(1);
      if (mounted) {
        setItems(initialItems);
        setLoading(false);
      }
    };

    loadInitial();
    return () => {
      mounted = false;
    };
  }, [mediaType, currentId, genreIds]);

  const loadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    const newItems = await fetchItems(nextPage);

    if (newItems.length > 0) {
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const filteredNew = newItems.filter((i) => !existingIds.has(i.id));
        if (filteredNew.length === 0) setHasMore(false);
        return [...prev, ...filteredNew];
      });
      setPage(nextPage);
    } else {
      setHasMore(false);
    }
    setIsFetchingMore(false);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    if (scrollLeft + clientWidth >= scrollWidth - 400) {
      loadMore();
    }
  };

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 360, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [items, page, hasMore, isFetchingMore]);

  if (loading || items.length === 0) return null;

  return (
    <section className="relative w-full max-w-full mx-auto rounded-[28px] bg-neutral-950/60 border border-white/10 p-5 sm:p-7 shadow-xl backdrop-blur-2xl overflow-hidden">
      <div className="relative z-10 flex items-end justify-between gap-4 mb-5 px-1">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs font-medium text-neutral-400 tracking-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className="w-8 h-8 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-20 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center backdrop-blur-md border border-white/10"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canScrollRight && !hasMore}
            aria-label="Scroll right"
            className="w-8 h-8 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white disabled:opacity-20 disabled:pointer-events-none active:scale-95 transition-all flex items-center justify-center backdrop-blur-md border border-white/10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="relative z-10 flex gap-3.5 sm:gap-4.5 overflow-x-auto overflow-y-hidden select-none touch-pan-x snap-x snap-mandatory scroll-smooth pb-3 pt-1 px-1 no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item, index) => (
            <IOSCard
              key={item.id}
              item={item}
              mediaType={mediaType}
              index={index}
            />
          ))}

          {isFetchingMore && (
            <div className="flex items-center justify-center w-24 shrink-0">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-3 w-10 bg-gradient-to-r from-neutral-950 to-transparent z-20 transition-opacity duration-300 ${
            canScrollLeft ? "opacity-80" : "opacity-0"
          }`}
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-3 w-10 bg-gradient-to-l from-neutral-950 to-transparent z-20 transition-opacity duration-300 ${
            canScrollRight ? "opacity-80" : "opacity-0"
          }`}
        />
      </div>
    </section>
  );
};

export default SimilarTitles;