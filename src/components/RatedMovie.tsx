import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Film, ChevronRight } from "lucide-react";
import { RatedMovie } from "./Recommendation.tsx";

const tabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2 } },
};

export const RatedMovieSection = ({
  ratedMovies,
  onMediaClick,
}: {
  ratedMovies: RatedMovie[];
  onMediaClick: (id: string, mediaType: string) => void;
}) => {
  return (
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
                  onClick={() => onMediaClick(movie.id, "movie")}
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
  );
};

export default RatedMovieSection;