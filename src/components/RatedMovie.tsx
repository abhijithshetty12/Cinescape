import React from "react";
import { motion } from "framer-motion";
import { Star, Film, Flame, Award } from "lucide-react";
import { RatedMovie } from "./Recommendation.tsx";

const tabVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, y: -15, transition: { duration: 0.25 } },
};

export const RatedMovieSection = ({
  ratedMovies,
  onMediaClick,
}: {
  ratedMovies: RatedMovie[];
  onMediaClick: (id: string, mediaType: string) => void;
}) => {
  const getPosterUrl = (path: string | null) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    if (path.startsWith("//")) return `https:${path}`;
    return `https://image.tmdb.org/t/p/w780${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const avgRating = ratedMovies.length
    ? (ratedMovies.reduce((acc, m) => acc + m.rating, 0) / ratedMovies.length).toFixed(1)
    : "0.0";

  const sortedByUserRating = [...ratedMovies].sort((a, b) => b.rating - a.rating);

  const spotlightMovie = sortedByUserRating[0];
  const remainingMovies = sortedByUserRating.slice(1);

  return (
    <motion.div
      key="ratings"
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full max-w-5xl mx-auto px-4"
    >
      {ratedMovies.length === 0 ? (
        <div className="relative overflow-hidden rounded-[32px] border border-white/[0.04] bg-zinc-950/40 p-8 sm:p-12 md:p-16 text-center backdrop-blur-3xl shadow-2xl">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center max-w-sm mx-auto">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-zinc-500 mb-5 shadow-inner">
              <Star className="w-6 h-6 stroke-[1.2]" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Your Gallery is Empty</h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Rate your favorite titles across the application to build a tailored glassmorphic dashboard of your cinema taste.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="relative overflow-hidden rounded-[28px] border border-white/[0.04] bg-zinc-950/40 p-6 md:p-7 flex flex-col justify-between backdrop-blur-3xl shadow-xl min-h-[200px] md:min-h-[240px]">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/5 rounded-full blur-[60px] pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.06] text-amber-400">
                  <Star className="w-4.5 h-4.5 fill-amber-500/10 stroke-[1.5]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white uppercase">Curated</h2>
                  <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Rated Media</span>
                </div>
              </div>

              <div className="mt-8 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white tracking-tighter">{ratedMovies.length}</span>
                  <span className="text-xs font-semibold text-zinc-500">Titles Rated</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Average rating: <strong className="text-amber-400">{avgRating}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => onMediaClick(spotlightMovie.id, "movie")}
            className="group relative overflow-hidden rounded-[28px] border border-white/[0.04] hover:border-amber-500/30 bg-zinc-950/40 p-5 md:col-span-2 flex flex-col justify-end backdrop-blur-3xl shadow-xl min-h-[240px] cursor-pointer transition-all duration-500 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]"
          >
            {spotlightMovie.posterPath && (
              <div className="absolute inset-0 z-0">
                <img
                  src={getPosterUrl(spotlightMovie.posterPath)}
                  alt={spotlightMovie.title}
                  className="w-full h-full object-cover opacity-40 scale-[1.01] group-hover:scale-105 group-hover:opacity-55 transition-all duration-700 pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
              </div>
            )}

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 w-full mt-12 sm:mt-0">
              <div className="relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl overflow-hidden border border-white/[0.12] shadow-2xl shrink-0 group-hover:border-amber-500/40 transition-colors duration-300">
                {spotlightMovie.posterPath ? (
                  <img
                    src={getPosterUrl(spotlightMovie.posterPath)}
                    alt={spotlightMovie.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <Film className="w-6 h-6 text-zinc-700" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                    <Award className="w-3 h-3 fill-current" />
                    <span>Your Top Choice</span>
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight line-clamp-1 group-hover:text-amber-400 transition-colors duration-300">
                  {spotlightMovie.title}
                </h3>
                <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mt-1">Movie</p>
              </div>

              <div className="self-start sm:self-center shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-500 text-black text-sm font-black shadow-lg shadow-amber-500/15 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-300">
                <Star className="w-4 h-4 fill-current" />
                <span>{spotlightMovie.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {remainingMovies.length > 0 && (
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              {remainingMovies.map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => onMediaClick(movie.id, "movie")}
                  className="group relative overflow-hidden rounded-[24px] border border-white/[0.04] hover:border-amber-500/40 bg-zinc-950/30 hover:bg-zinc-950/50 p-3 flex flex-col justify-between backdrop-blur-2xl shadow-md cursor-pointer aspect-[3/4] transition-all duration-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.18)]"
                >
                  <div className="absolute inset-0 z-0 rounded-[24px] overflow-hidden">
                    {movie.posterPath ? (
                      <img
                        src={getPosterUrl(movie.posterPath)}
                        alt={movie.title}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 scale-[1.01] group-hover:scale-[1.04] transition-all duration-700 pointer-events-none"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
                        <Film className="w-6 h-6 text-zinc-800" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none" />
                  </div>

                  <div className="relative z-10 flex items-center justify-between w-full">
                    <div className="w-8 h-8 rounded-lg bg-zinc-950/80 border border-white/[0.08] backdrop-blur-md flex items-center justify-center">
                      <Film className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400/80 transition-colors duration-300" />
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-950/80 border border-amber-500/[0.2] backdrop-blur-md text-amber-400 text-[10px] font-bold shadow-sm">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span>{movie.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="relative z-10 mt-auto pt-8">
                    <h4 className="text-xs font-extrabold text-white group-hover:text-amber-400 transition-colors line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {movie.title}
                    </h4>
                    <span className="text-[9px] font-semibold text-zinc-300 uppercase tracking-wider mt-0.5 block drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Movie</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </motion.div>
  );
};

export default RatedMovieSection;