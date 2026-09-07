import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Clapperboard, Flame, Award, Tv } from "lucide-react";
import { RatedMovie } from "./Recommendation.tsx";

const tabVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

type MediaTypeFilter = "movie" | "tv";

export const UserRatingSection = ({
  ratedMovies,
  onMediaClick,
}: {
  ratedMovies: RatedMovie[];
  onMediaClick: (id: string, mediaType: string) => void;
}) => {
  const [activeFilter, setActiveFilter] = useState<MediaTypeFilter>("movie");

  const getPosterUrl = (path: string | null) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("//")) return `https:${path}`;
    return `https://image.tmdb.org/t/p/w780${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const movieItems = ratedMovies.filter((item) => item.mediaType !== "tv");
  const seriesItems = ratedMovies.filter((item) => item.mediaType === "tv");

  const activeList = activeFilter === "movie" ? movieItems : seriesItems;

  const avgRating = activeList.length
    ? (activeList.reduce((acc, m) => acc + m.rating, 0) / activeList.length).toFixed(1)
    : "0.0";

  const sortedByUserRating = [...activeList].sort((a, b) => b.rating - a.rating);

  const spotlightMovie = sortedByUserRating[0];
  const remainingMovies = sortedByUserRating.slice(1);

  return (
    <motion.div
      key="ratings"
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full max-w-5xl mx-auto px-3 sm:px-4 space-y-4 sm:space-y-6 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif] tracking-tight antialiased"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex items-center p-1 bg-white/5 backdrop-blur-xl border border-white/[0.04] rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden flex-1 sm:flex-initial">
          <button
            onClick={() => setActiveFilter("movie")}
            className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-xs tracking-wide transition-all duration-300 rounded-lg ${
              activeFilter === "movie"
                ? "text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clapperboard
              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                activeFilter === "movie" ? "scale-110 text-red-400" : ""
              }`}
            />
            <span>Movies</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold transition-colors ${
                activeFilter === "movie"
                  ? "bg-white/10 text-white"
                  : "bg-white/[0.05] text-zinc-400"
              }`}
            >
              {movieItems.length}
            </span>

            {activeFilter === "movie" && (
              <motion.div
                layoutId="liquid-pill"
                className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveFilter("tv")}
            className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 font-bold text-xs tracking-wide transition-all duration-300 rounded-lg ${
              activeFilter === "tv"
                ? "text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Tv
              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                activeFilter === "tv" ? "scale-110 text-cyan-400" : ""
              }`}
            />
            <span>Series</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold transition-colors ${
                activeFilter === "tv"
                  ? "bg-white/10 text-white"
                  : "bg-white/[0.05] text-zinc-400"
              }`}
            >
              {seriesItems.length}
            </span>

            {activeFilter === "tv" && (
              <motion.div
                layoutId="liquid-pill"
                className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
              />
            )}
          </button>

          <div className="absolute inset-y-1 left-1 right-1 pointer-events-none overflow-hidden rounded-lg hidden sm:block">
            <motion.div
              className={`absolute top-0 bottom-0 w-16 blur-md opacity-80 ${
                activeFilter === "movie"
                  ? "bg-gradient-to-r from-red-500/10 via-red-500/20 to-orange-500/10"
                  : "bg-gradient-to-r from-cyan-500/10 via-cyan-500/20 to-blue-500/10"
              }`}
              animate={{ x: activeFilter === "movie" ? 0 : 96 }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {activeList.length === 0 ? (
            <div className="relative overflow-hidden rounded-[28px] border border-amber-500/20 bg-black p-8 sm:p-12 text-center shadow-2xl">
              <div className="relative z-10 flex flex-col items-center max-w-sm mx-auto">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-black shadow-lg shadow-amber-500/30 mb-4">
                  {activeFilter === "movie" ? (
                    <Clapperboard className="w-6 h-6 stroke-[2]" />
                  ) : (
                    <Tv className="w-6 h-6 stroke-[2]" />
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  No Rated {activeFilter === "movie" ? "Movies" : "Series"} Found
                </h3>
                <p className="text-xs text-amber-200/60 mt-1.5 leading-relaxed font-medium">
                  Rate your favorite {activeFilter === "movie" ? "movies" : "TV shows"} across the application to build your personalized gallery.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="relative overflow-hidden rounded-[28px] border border-amber-500/30 bg-black p-5 sm:p-6 flex flex-col justify-between shadow-2xl min-h-[180px] sm:min-h-[220px]">
                <div className="relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-black shadow-md shadow-amber-500/30 shrink-0">
                      <Star className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold tracking-tight text-white">Curated</h2>
                      <span className="text-[10px] font-medium tracking-wider text-amber-400 uppercase block">
                        Rated {activeFilter === "movie" ? "Movies" : "Series"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 sm:mt-8 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{activeList.length}</span>
                      <span className="text-xs font-semibold text-amber-200/70">
                        {activeFilter === "movie" ? "Movies Rated" : "Series Rated"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium pt-1">
                      <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>
                        Average rating: <strong className="text-amber-300 font-bold">{avgRating}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                onClick={() => onMediaClick(spotlightMovie.id, activeFilter)}
                className="group relative overflow-hidden rounded-[28px] border border-amber-500/30 bg-black p-4 sm:p-5 md:col-span-2 flex flex-col justify-end shadow-2xl min-h-[220px] cursor-pointer transition-all duration-300 active:scale-[0.99]"
              >
                {spotlightMovie.posterPath && (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={getPosterUrl(spotlightMovie.posterPath)}
                      alt={spotlightMovie.title}
                      className="w-full h-full object-cover opacity-35 scale-[1.01] group-hover:scale-105 group-hover:opacity-45 transition-all duration-500 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                  </div>
                )}

                <div className="relative z-10 flex flex-row items-center gap-3.5 sm:gap-4 w-full">
                  <div className="relative w-20 h-28 sm:w-24 sm:h-36 rounded-2xl overflow-hidden border border-amber-500/40 shadow-xl shrink-0">
                    {spotlightMovie.posterPath ? (
                      <img
                        src={getPosterUrl(spotlightMovie.posterPath)}
                        alt={spotlightMovie.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        {activeFilter === "movie" ? (
                          <Clapperboard className="w-6 h-6 text-amber-500/60" />
                        ) : (
                          <Tv className="w-6 h-6 text-amber-500/60" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-black text-[10px] font-bold shadow-sm shadow-amber-500/30 mb-1.5">
                      <Award className="w-3 h-3 fill-current" />
                      <span>Top Choice</span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight line-clamp-1 group-hover:text-amber-300 transition-colors duration-200">
                      {spotlightMovie.title}
                    </h3>
                    <p className="text-[11px] text-amber-200/70 font-semibold uppercase tracking-wider mt-0.5">
                      {activeFilter === "movie" ? "Movie" : "Series"}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-black text-xs font-extrabold shadow-md shadow-amber-500/30">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{spotlightMovie.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {remainingMovies.length > 0 && (
                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 w-full pt-1">
                  {remainingMovies.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onMediaClick(item.id, activeFilter)}
                      className="group relative overflow-hidden rounded-[22px] border border-amber-500/25 bg-black p-2.5 sm:p-3 flex flex-col justify-between shadow-xl cursor-pointer aspect-[3/4] transition-all duration-300 active:scale-[0.97]"
                    >
                      <div className="absolute inset-0 z-0 rounded-[22px] overflow-hidden">
                        {item.posterPath ? (
                          <img
                            src={getPosterUrl(item.posterPath)}
                            alt={item.title}
                            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 scale-[1.01] group-hover:scale-105 transition-all duration-500 pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
                            {activeFilter === "movie" ? (
                              <Clapperboard className="w-6 h-6 text-amber-500/40" />
                            ) : (
                              <Tv className="w-6 h-6 text-amber-500/40" />
                            )}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                      </div>

                      <div className="relative z-10 flex items-center justify-between w-full">
                        <div className="p-1.5 rounded-lg bg-black/70 border border-amber-500/30 backdrop-blur-md text-amber-300">
                          {activeFilter === "movie" ? (
                            <Clapperboard className="w-3 h-3" />
                          ) : (
                            <Tv className="w-3 h-3" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 text-black text-[10px] font-extrabold shadow-md shadow-amber-500/30">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span>{item.rating.toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="relative z-10 mt-auto pt-6">
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                          {item.title}
                        </h4>
                        <span className="text-[9px] font-medium text-amber-200/70 uppercase tracking-wider block mt-0.5">
                          {activeFilter === "movie" ? "Movie" : "Series"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default UserRatingSection;