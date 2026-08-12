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
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  runtime?: number;
  overview?: string;
}

export interface MovieCollectionProps {
  movieParts: MoviePart[];
  collectionName?: string | null;
  watchedMovieIds?: number[];
  SpatialCard?: React.ComponentType<{
    children: React.ReactNode;
    containerRef: any;
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

  const sortedParts = [...movieParts].sort((a, b) => {
    const timeA = a.release_date ? new Date(a.release_date).getTime() : 0;
    const timeB = b.release_date ? new Date(b.release_date).getTime() : 0;
    return timeA - timeB;
  });

  const watchedSet = new Set(watchedMovieIds);
  const watchedCount = sortedParts.filter((part) => watchedSet.has(part.id)).length;
  const progressPercentage = Math.round((watchedCount / sortedParts.length) * 100);

  const nextUnwatchedMovie = sortedParts.find((part) => !watchedSet.has(part.id)) || sortedParts[0];
  const nextChapterNumber = sortedParts.findIndex((p) => p.id === nextUnwatchedMovie?.id) + 1;

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {}
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-[32px] border border-white/[0.15] bg-zinc-950/60 p-5 sm:p-6 md:p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-3xl backdrop-saturate-200 overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Segoe_UI',Roboto,sans-serif] antialiased select-none"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]" />

      <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md shrink-0">
            <Clapperboard className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-xl md:text-2xl font-semibold text-white/95 tracking-tight leading-none mb-1.5">
              {collectionName ? `Part of ${collectionName}` : 'Movie Collection'}
            </h2>
            <span className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase leading-none">
              {sortedParts.length} {sortedParts.length === 1 ? 'Chapter' : 'Chapters Available'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {nextUnwatchedMovie && (
            <Link
              to={`/movie/${nextUnwatchedMovie.id}`}
              onClick={triggerHaptic}
              className="flex items-center gap-1.5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 px-3.5 py-1.5 text-xs font-semibold text-blue-300 backdrop-blur-md shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>
                {watchedCount === sortedParts.length
                  ? `Rewatch: Ch. 1`
                  : `Watch Next: Ch. ${nextChapterNumber}`}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-70" />
            </Link>
          )}

          <div className="flex items-center p-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md shadow-inner">
            <button
              onClick={() => {
                triggerHaptic();
                setViewMode('grid');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                viewMode === 'grid'
                  ? 'bg-white/20 text-white border border-white/20 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic();
                setViewMode('timeline');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                viewMode === 'timeline'
                  ? 'bg-white/20 text-white border border-white/20 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Timeline</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-20 mb-7 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-md">
        <div className="flex justify-between items-center text-[11px] font-medium text-zinc-300 mb-2.5">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Franchise Completion
          </span>
          <span className="text-blue-400 font-semibold tracking-wide">
            {watchedCount} of {sortedParts.length} Watched ({progressPercentage}%)
          </span>
        </div>
        <div className="relative h-2.5 w-full rounded-full bg-black/60 overflow-hidden border border-white/5 flex gap-1 p-0.5">
          {sortedParts.map((part) => {
            const isPartWatched = watchedSet.has(part.id);
            return (
              <div
                key={part.id}
                title={`${part.title} - ${isPartWatched ? 'Watched' : 'Unwatched'}`}
                className={`h-full flex-1 rounded-full transition-all duration-500 ${
                  isPartWatched
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]'
                    : 'bg-white/10'
                }`}
              />
            );
          })}
        </div>
      </div>

      {viewMode === 'grid' && (
        <AnimatePresence mode="wait">
          <motion.div
            key="grid-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={moviePartsContainerRef}
            className="relative z-20 flex gap-4 pb-2 snap-x snap-mandatory overflow-x-auto scroll-smooth -mx-5 px-5 sm:mx-0 sm:px-1 no-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {sortedParts.map((part, index) => {
              const isWatched = watchedSet.has(part.id);
              return (
                <Link
                  key={part.id}
                  to={`/movie/${part.id}`}
                  onClick={triggerHaptic}
                  className="flex-shrink-0 snap-start group/card focus:outline-none"
                  aria-label={`View ${part.title}`}
                >
                  <SpatialCard containerRef={moviePartsContainerRef} index={index}>
                    <div className="w-[130px] sm:w-[160px] md:w-[180px]">
                      <div className="relative rounded-2xl border border-white/15 bg-black/50 overflow-hidden shadow-2xl backdrop-blur-md transition-all duration-500 ease-out group-hover/card:border-blue-400/50 group-hover/card:shadow-[0_0_30px_rgba(59,130,246,0.25)]">
                        <div className="relative aspect-[2/3] overflow-hidden bg-zinc-950">
                          {part.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w780${part.poster_path}`}
                              alt={part.title}
                              loading="lazy"
                              className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover/card:scale-105 ${
                                isWatched ? 'brightness-90' : ''
                              }`}
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white/[0.02] text-zinc-500">
                              <ImageOff className="w-6 h-6 stroke-[1.5]" />
                              <span className="text-[10px] font-medium tracking-wider uppercase">No Poster</span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-60 group-hover/card:opacity-40 transition-opacity" />

                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 shadow-[0_8px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-xl flex items-center justify-center scale-85 group-hover/card:scale-100 transition-transform duration-300 ease-out">
                              <Play className="w-4 h-4 text-white fill-white translate-x-[1px]" />
                            </div>
                          </div>

                          <div className="absolute top-2.5 left-2.5 z-30">
                            <span className="bg-black/50 backdrop-blur-md border border-white/15 text-zinc-200 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm">
                              {part.release_date?.slice(0, 4) || 'TBA'}
                            </span>
                          </div>

                          {part.vote_average > 0 && (
                            <div className="absolute bottom-2.5 right-2.5 z-30 pointer-events-none">
                              <span className="bg-amber-400/90 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md backdrop-blur-md">
                                <Star className="w-2.5 h-2.5 fill-current stroke-none" />
                                {part.vote_average.toFixed(1)}
                              </span>
                            </div>
                          )}

                          {isWatched && (
                            <div className="absolute bottom-2.5 left-2.5 z-30 pointer-events-none">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 backdrop-blur-md shadow-sm">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Watched
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 ring-1 ring-inset ring-white/15 group-hover/card:ring-blue-400/40 rounded-2xl pointer-events-none transition-all duration-500" />
                        </div>
                      </div>

                      <div className="mt-2.5 px-1 text-center">
                        <h3 className="text-zinc-200 font-semibold text-xs sm:text-sm leading-tight line-clamp-1 group-hover/card:text-blue-400 transition-colors duration-300">
                          {part.title}
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
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="relative z-20 py-3 px-1"
          >
            <div className="absolute left-[23px] sm:left-[27px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500/50 to-blue-500/10 rounded-full" />

            <div className="space-y-6">
              {sortedParts.map((part, index) => {
                const isWatched = watchedSet.has(part.id);
                return (
                  <div
                    key={part.id}
                    className="relative flex items-center gap-4 sm:gap-6 group/timeline"
                  >
                    <div
                      className={`relative z-10 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border backdrop-blur-xl shrink-0 transition-all duration-300 ${
                        isWatched
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105'
                          : 'bg-zinc-900/90 border-white/20 text-zinc-400'
                      }`}
                    >
                      {isWatched ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <span className="text-xs sm:text-sm font-bold">{index + 1}</span>
                      )}
                    </div>

                    <Link
                      to={`/movie/${part.id}`}
                      onClick={triggerHaptic}
                      className="flex-1 focus:outline-none"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] p-4 backdrop-blur-md transition-all duration-300 group-hover/timeline:border-blue-400/40 group-hover/timeline:shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center gap-4">
                          <div className="relative h-20 w-14 rounded-xl overflow-hidden bg-zinc-950 border border-white/10 shrink-0 shadow-lg">
                            {part.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w185${part.poster_path}`}
                                alt={part.title}
                                className={`h-full w-full object-cover transition-transform duration-500 group-hover/timeline:scale-105 ${
                                  isWatched ? 'brightness-90' : ''
                                }`}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-600">
                                <ImageOff className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                                Chapter {index + 1}
                              </span>
                              {isWatched && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" /> Watched
                                </span>
                              )}
                            </div>

                            <h3 className="text-base sm:text-lg font-semibold text-white/90 group-hover/timeline:text-blue-400 transition-colors line-clamp-1">
                              {part.title}
                            </h3>

                            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-zinc-500" />
                                {part.release_date || 'TBA'}
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

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {part.vote_average > 0 && (
                            <div className="flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-300">
                              <Star className="w-3 h-3 fill-current" />
                              {part.vote_average.toFixed(1)}
                            </div>
                          )}

                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white group-hover/timeline:bg-blue-500 group-hover/timeline:border-blue-400 transition-all duration-300">
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

      {viewMode === 'grid' && (
        <div className="flex items-center justify-center gap-2 mt-4 text-zinc-400 text-[10px] md:hidden font-medium uppercase tracking-widest relative z-20">
          <span>Swipe Collection</span>
          <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-md">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </motion.section>
  );
};

export default MovieCollection;