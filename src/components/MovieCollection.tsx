import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clapperboard,
  LayoutGrid,
  GitCommit,
  Play,
  Star,
  ImageOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  Calendar,
} from 'lucide-react';

export interface MoviePart {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  runtime?: number;
  overview?: string;
  media_type?: 'movie' | 'tv';
}

export interface MovieCollectionProps {
  movieParts: MoviePart[];
  collectionName?: string | null;
  watchedMovieIds?: number[];
  SpatialCard?: React.ComponentType<{
    children: React.ReactNode;
    containerRef: React.RefObject<any>;
    index: number;
  }>;
}

export const MovieCollection: React.FC<MovieCollectionProps> = ({
  movieParts = [],
  collectionName,
  watchedMovieIds = [],
  SpatialCard = ({ children }) => <div>{children}</div>,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const moviePartsContainerRef = useRef<HTMLDivElement | null>(null);

  if (!movieParts || movieParts.length === 0) return null;

  const getItemTitle = (item: MoviePart) => item.title || item.name || 'Untitled';
  const getItemDate = (item: MoviePart) => item.release_date || item.first_air_date || '';
  const getItemRoute = (item: MoviePart) =>
    item.media_type === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`;

  const sortedParts = [...movieParts].sort((a, b) => {
    const timeA = getItemDate(a) ? new Date(getItemDate(a)).getTime() : 0;
    const timeB = getItemDate(b) ? new Date(getItemDate(b)).getTime() : 0;
    return timeA - timeB;
  });

  const watchedSet = new Set(watchedMovieIds);
  const watchedCount = sortedParts.filter((part) => watchedSet.has(part.id)).length;
  const progressPercentage = Math.round((watchedCount / sortedParts.length) * 100);

  const nextUnwatchedMovie = sortedParts.find((part) => !watchedSet.has(part.id)) || sortedParts[0];
  const nextChapterNumber = sortedParts.findIndex((p) => p.id === nextUnwatchedMovie?.id) + 1;

  const handleMovieClick = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(10);
        } catch {}
      }
    }
  };

  const triggerHapticOnly = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-3xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 md:p-8 shadow-2xl backdrop-blur-3xl antialiased select-none overflow-hidden font-sans flex flex-col"
    >
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      {/* Header Section */}
      <div className="relative z-20 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/20 text-amber-400 shadow-inner shrink-0 backdrop-blur-md">
            <Clapperboard className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-zinc-100 tracking-tight leading-tight">
              {collectionName ? `Part of ${collectionName}` : 'Franchise Collection'}
            </h2>
            <p className="text-xs text-zinc-400 font-medium tracking-wide">
              {sortedParts.length} {sortedParts.length === 1 ? 'Title' : 'Titles in Order'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          {nextUnwatchedMovie && (
            <Link
              to={getItemRoute(nextUnwatchedMovie)}
              onClick={handleMovieClick}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-600/15 hover:from-amber-500/25 hover:via-orange-500/25 hover:to-amber-600/25 border border-amber-500/30 px-3.5 py-2 text-xs font-semibold text-amber-300 transition-all duration-200 active:scale-95 backdrop-blur-md shadow-lg shadow-amber-950/20"
            >
              <Play className="w-3 h-3 fill-current text-amber-400" />
              <span>
                {watchedCount === sortedParts.length
                  ? 'Rewatch Series'
                  : `Next: Ch. ${nextChapterNumber}`}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </Link>
          )}

          <div className="flex items-center p-1 rounded-full bg-zinc-900/80 border border-white/10 backdrop-blur-xl">
            <button
              onClick={() => {
                triggerHapticOnly();
                setViewMode('grid');
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'text-amber-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {viewMode === 'grid' && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30 shadow-sm"
                  transition={{ type: 'spring', duration: 0.4 }}
                />
              )}
              <LayoutGrid className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10 hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => {
                triggerHapticOnly();
                setViewMode('timeline');
              }}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                viewMode === 'timeline' ? 'text-amber-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {viewMode === 'timeline' && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30 shadow-sm"
                  transition={{ type: 'spring', duration: 0.4 }}
                />
              )}
              <GitCommit className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10 hidden sm:inline">Timeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="relative z-20 mb-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-3 sm:p-3.5 backdrop-blur-xl shrink-0">
        <div className="flex justify-between items-center text-xs font-medium text-zinc-300 mb-2">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Franchise Completion
          </span>
          <span className="text-amber-400 font-semibold">
            {watchedCount}/{sortedParts.length} Watched ({progressPercentage}%)
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-950/80 overflow-hidden border border-white/5 flex gap-1 p-0.5">
          {sortedParts.map((part) => {
            const isPartWatched = watchedSet.has(part.id);
            return (
              <div
                key={part.id}
                title={`${getItemTitle(part)} - ${isPartWatched ? 'Watched' : 'Unwatched'}`}
                className={`h-full flex-1 rounded-full transition-all duration-300 ${
                  isPartWatched
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                    : 'bg-white/10'
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="relative z-20 max-h-[300px] sm:max-h-[300px] overflow-y-auto no-scrollbar pr-1">
        {viewMode === 'grid' && (
          <AnimatePresence mode="wait">
            <motion.div
              key="grid-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              ref={moviePartsContainerRef}
              className="relative flex gap-3.5 pb-2 snap-x snap-mandatory overflow-x-auto scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {sortedParts.map((part, index) => {
                const isWatched = watchedSet.has(part.id);
                const title = getItemTitle(part);
                const releaseYear = getItemDate(part)?.slice(0, 4) || 'TBA';

                return (
                  <Link
                    key={part.id}
                    to={getItemRoute(part)}
                    onClick={handleMovieClick}
                    className="flex-shrink-0 snap-start group/card focus:outline-none"
                    aria-label={`View ${title}`}
                  >
                    <SpatialCard containerRef={moviePartsContainerRef} index={index}>
                      <div className="w-[125px] sm:w-[150px] md:w-[165px]">
                        <div className="relative rounded-2xl border border-white/10 bg-zinc-900/80 overflow-hidden shadow-xl transition-all duration-300 group-hover/card:border-amber-500/50 group-hover/card:shadow-amber-500/10 backdrop-blur-md">
                          <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
                            {part.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w500${part.poster_path}`}
                                alt={title}
                                loading="lazy"
                                className={`w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105 ${
                                  isWatched ? 'opacity-80' : ''
                                }`}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-zinc-900 text-zinc-600">
                                <ImageOff className="w-5 h-5 stroke-[1.5]" />
                                <span className="text-[10px] font-medium uppercase tracking-wider">No Poster</span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-70 group-hover/card:opacity-40 transition-opacity" />

                            <div className="absolute inset-0 bg-amber-950/20 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none backdrop-blur-[2px]">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-zinc-950 flex items-center justify-center scale-90 group-hover/card:scale-100 transition-transform duration-200 shadow-lg shadow-amber-500/30">
                                <Play className="w-3.5 h-3.5 fill-current translate-x-[0.5px]" />
                              </div>
                            </div>

                            <div className="absolute top-2 left-2">
                              <span className="bg-zinc-950/70 backdrop-blur-md border border-white/10 text-zinc-200 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                                {releaseYear}
                              </span>
                            </div>

                            {part.vote_average > 0 && (
                              <div className="absolute top-2 right-2">
                                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md">
                                  <Star className="w-2.5 h-2.5 fill-zinc-950 stroke-none" />
                                  {part.vote_average.toFixed(1)}
                                </span>
                              </div>
                            )}

                            {isWatched && (
                              <div className="absolute bottom-2 left-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 backdrop-blur-md shadow-sm">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Watched
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 px-0.5 text-left">
                          <h3 className="text-zinc-200 font-medium text-xs leading-snug line-clamp-1 group-hover/card:text-amber-400 transition-colors">
                            {title}
                          </h3>
                        </div>
                      </div>
                    </SpatialCard>
                  </Link>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {viewMode === 'timeline' && (
          <AnimatePresence mode="wait">
            <motion.div
              key="timeline-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative py-2"
            >
              <div className="absolute left-[19px] sm:left-[23px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-amber-500/80 via-orange-500/30 to-transparent rounded-full" />

              <div className="space-y-3.5">
                {sortedParts.map((part, index) => {
                  const isWatched = watchedSet.has(part.id);
                  const title = getItemTitle(part);
                  const releaseYear = getItemDate(part) || 'TBA';

                  return (
                    <div
                      key={part.id}
                      className="relative flex items-center gap-3.5 sm:gap-5 group/timeline"
                    >
                      <div
                        className={`relative z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border shrink-0 transition-colors shadow-sm backdrop-blur-md ${
                          isWatched
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-zinc-900/90 border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {isWatched ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </div>

                      <Link
                        to={getItemRoute(part)}
                        onClick={handleMovieClick}
                        className="flex-1 focus:outline-none min-w-0"
                      >
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 hover:bg-zinc-900/70 p-2.5 sm:p-3 backdrop-blur-xl transition-all group-hover/timeline:border-amber-500/40 group-hover/timeline:shadow-lg group-hover/timeline:shadow-amber-500/5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-14 w-10 rounded-lg overflow-hidden bg-zinc-950 border border-white/10 shrink-0">
                              {part.poster_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w185${part.poster_path}`}
                                  alt={title}
                                  className={`h-full w-full object-cover ${
                                    isWatched ? 'opacity-70' : ''
                                  }`}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-zinc-600">
                                  <ImageOff className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                  Part {index + 1}
                                </span>
                                {isWatched && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-400">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Watched
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-semibold text-zinc-100 group-hover/timeline:text-amber-400 transition-colors truncate">
                                {title}
                              </h3>

                              <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-zinc-500" />
                                  {releaseYear}
                                </span>
                                {part.runtime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-zinc-500" />
                                    {part.runtime}m
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {part.vote_average > 0 && (
                              <div className="hidden sm:flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                                <Star className="w-3 h-3 fill-current" />
                                {part.vote_average.toFixed(1)}
                              </div>
                            )}

                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-400 group-hover/timeline:bg-gradient-to-r group-hover/timeline:from-amber-500 group-hover/timeline:to-orange-500 group-hover/timeline:text-zinc-950 group-hover/timeline:border-amber-400 transition-all shadow-sm">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {viewMode === 'grid' && (
        <div className="flex items-center justify-center gap-1.5 mt-3 text-zinc-500 text-[10px] sm:hidden font-medium uppercase tracking-widest relative z-20 shrink-0">
          <span>Swipe to explore</span>
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
        </div>
      )}
    </motion.section>
  );
};

export default MovieCollection;