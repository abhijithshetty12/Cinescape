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
        try { navigator.vibrate(10); } catch { }
      }
    }
  };

  const triggerHapticOnly = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(10); } catch { }
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative lg:col-span-2 w-full bg-zinc-950/40 backdrop-blur-3xl rounded-3xl p-5 sm:p-6 md:p-8 border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden group flex flex-col justify-between gap-6 sm:gap-8"
    >
      <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent blur-sm pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-gradient-to-br from-red-600/10 via-orange-600/10 to-transparent rounded-full blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      <div className="relative z-20 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff4b1f] to-[#ff9068] border border-orange-500/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_0_20px_rgba(255,75,31,0.2)] shrink-0">
            <Clapperboard className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-zinc-100 tracking-tight leading-tight">
              {collectionName ? `Part of ${collectionName}` : 'Franchise Collection'}
            </h2>
            <p className="text-[13px] text-zinc-400 font-medium tracking-wide mt-0.5">
              {sortedParts.length} {sortedParts.length === 1 ? 'Title' : 'Titles in Order'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          {nextUnwatchedMovie && (
            <Link
              to={getItemRoute(nextUnwatchedMovie)}
              onClick={handleMovieClick}
              className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-300 hover:bg-[#252525] active:scale-95 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
            >
              <Play className="w-3.5 h-3.5 fill-[#ff4b1f] text-[#ff4b1f]" />
              <span>
                {watchedCount === sortedParts.length
                  ? 'Rewatch'
                  : `Next: Ch. ${nextChapterNumber}`}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 ml-1" />
            </Link>
          )}

          <div className="flex items-center rounded-xl bg-[#1a1a1a] border border-white/10 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
            <button
              onClick={() => {
                triggerHapticOnly();
                setViewMode('grid');
              }}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${viewMode === 'grid' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {viewMode === 'grid' && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-lg bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
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
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${viewMode === 'timeline' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {viewMode === 'timeline' && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-lg bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                  transition={{ type: 'spring', duration: 0.4 }}
                />
              )}
              <GitCommit className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10 hidden sm:inline">Timeline</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-20 shrink-0">
        <div className="flex justify-between items-center text-[12px] font-medium text-zinc-400 mb-2.5">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#ff9068]" />
            Franchise Completion
          </span>
          <span className="text-zinc-300 font-semibold">
            {watchedCount}/{sortedParts.length} Watched
          </span>
        </div>
        <div className="flex h-2.5 w-full gap-1 overflow-hidden rounded-full bg-[#111] p-[2px] border border-white/5">
          {sortedParts.map((part) => {
            const isPartWatched = watchedSet.has(part.id);
            return (
              <div
                key={part.id}
                title={`${getItemTitle(part)} - ${isPartWatched ? 'Watched' : 'Unwatched'}`}
                className={`h-full flex-1 rounded-full transition-all duration-500 ${isPartWatched
                    ? 'bg-gradient-to-r from-[#ff4b1f] to-[#ff9068] shadow-[0_0_10px_rgba(255,75,31,0.4)]'
                    : 'bg-white/5'
                  }`}
              />
            );
          })}
        </div>
      </div>

      <div className="relative z-20 max-h-[340px] overflow-y-auto no-scrollbar pr-1">
        {viewMode === 'grid' && (
          <AnimatePresence mode="wait">
            <motion.div
              key="grid-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              ref={moviePartsContainerRef}
              className="relative flex gap-4 pb-2 snap-x snap-mandatory overflow-x-auto scroll-smooth -mx-5 px-5 sm:mx-0 sm:px-0 no-scrollbar"
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
                      <div className="w-[130px] sm:w-[155px] md:w-[170px]">
                        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#111] transition-all duration-500 group-hover/card:border-white/20 group-hover/card:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                          <div className="relative aspect-[2/3] overflow-hidden bg-black">
                            {part.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w500${part.poster_path}`}
                                alt={title}
                                loading="lazy"
                                className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-105 ${isWatched ? 'opacity-60' : 'opacity-100'
                                  }`}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-[#1b1d22] text-zinc-600">
                                <ImageOff className="w-5 h-5 stroke-[1.5]" />
                                <span className="text-[10px] font-medium uppercase tracking-wider">No Poster</span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover/card:opacity-20" />

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 bg-black/20 backdrop-blur-[1px]">
                              <div className="flex h-10 w-10 scale-90 items-center justify-center rounded-full bg-gradient-to-br from-[#ff4b1f] to-[#ff9068] text-white shadow-[0_0_15px_rgba(255,75,31,0.5)] transition-transform duration-300 group-hover/card:scale-100">
                                <Play className="w-4 h-4 fill-current translate-x-[1px]" />
                              </div>
                            </div>

                            <div className="absolute top-2 left-2">
                              <span className="rounded-md border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 backdrop-blur-md">
                                {releaseYear}
                              </span>
                            </div>

                            {part.vote_average > 0 && (
                              <div className="absolute top-2 right-2">
                                <span className="flex items-center gap-0.5 rounded-md border border-white/10 bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-500 backdrop-blur-md">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 stroke-none" />
                                  {part.vote_average.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2.5 px-0.5 text-left">
                          <h3 className="text-[13px] font-medium leading-snug text-zinc-200 line-clamp-1 transition-colors group-hover/card:text-white">
                            {title}
                          </h3>
                          {isWatched && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-green-500">
                              <CheckCircle2 className="w-3 h-3" /> Watched
                            </p>
                          )}
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
              <div className="absolute left-[19px] sm:left-[23px] top-4 bottom-4 w-px bg-gradient-to-b from-[#ff4b1f]/50 via-white/10 to-transparent" />

              <div className="space-y-3">
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
                        className={`relative z-10 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border shrink-0 transition-colors shadow-sm ${isWatched
                            ? 'bg-[#0a1f11] border-green-800/50 text-green-500'
                            : 'bg-[#1a1a1a] border-white/10 text-zinc-500'
                          }`}
                      >
                        {isWatched ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <span className="text-[12px] font-semibold">{index + 1}</span>
                        )}
                      </div>

                      <Link
                        to={getItemRoute(part)}
                        onClick={handleMovieClick}
                        className="flex-1 focus:outline-none min-w-0"
                      >
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#151515] hover:bg-[#1a1a1a] p-3 transition-all duration-300 group-hover/timeline:border-white/15">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative h-14 w-10 rounded-lg overflow-hidden bg-black border border-white/5 shrink-0">
                              {part.poster_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w185${part.poster_path}`}
                                  alt={title}
                                  className={`h-full w-full object-cover ${isWatched ? 'opacity-50' : 'opacity-90'}`}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-zinc-600">
                                  <ImageOff className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="text-[14px] font-semibold text-zinc-200 group-hover/timeline:text-white transition-colors truncate">
                                {title}
                              </h3>
                              <div className="flex items-center gap-3 mt-1.5 text-[12px] text-zinc-400 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-green-500" />
                                  {releaseYear}
                                </span>
                                {part.runtime && (
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                    {part.runtime}m
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {part.vote_average > 0 && (
                              <div className="hidden sm:flex items-center gap-1 rounded-md border border-white/10 bg-[#111] px-1.5 py-0.5 text-[11px] font-bold text-amber-500">
                                <Star className="w-3 h-3 fill-amber-500 stroke-none" />
                                {part.vote_average.toFixed(1)}
                              </div>
                            )}
                            <div className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-all duration-300 group-hover/timeline:bg-white/10 group-hover/timeline:text-white">
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
        <div className="relative z-20 flex items-center justify-center gap-1.5 mt-2 text-[10px] font-medium text-zinc-500 sm:hidden uppercase tracking-widest shrink-0">
          <span>Swipe to explore</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#ff4b1f] animate-pulse" />
        </div>
      )}
    </motion.section>
  );
};

export default MovieCollection;