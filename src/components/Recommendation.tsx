import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { Film, Star, Tv } from "lucide-react";

const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";

export type RecommendedItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
  overview: string;
  voteAverage: number;
};

export type WatchlistItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
};

export type HistoryItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
  genres: string[];
  watchedDate: string;
};

export type FavouriteActor = { id: string; name: string; profilePath: string };

export type RatedMovie = {
  id: string;
  title: string;
  posterPath: string;
  rating: number;
};

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

export default RecommendationSection;