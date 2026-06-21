import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Star, ImageOff, Film, Tv, User, Frown, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassSweep from "../components/GlassSweep.tsx";

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  media_type: string;
  vote_average?: number;
  overview?: string;
  genre_ids?: number[];
  known_for_department?: string;
}

const GENRE_MAPPING: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

type TabType = 'movies' | 'tv' | 'talents';

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const noImageSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 150"><rect width="100%" height="100%" fill="%2327272a"/><g transform="translate(38, 50) scale(1)" stroke="%2371717a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M10.41 4.41A2 2 0 0 1 11 4h9a2 2 0 0 1 2 2v9a2 2 0 0 1-.42 1.15"/><path d="M16 16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 .42-1.15"/><path d="m2 18 5.58-5.58a1 1 0 0 1 1.41 0l3.41 3.41"/><path d="m16 11.5 1-1a1 1 0 0 1 .18-.15"/></g><text x="50%" y="95" fill="%2371717a" font-size="6" font-family="sans-serif" text-anchor="middle" font-weight="500">No Image Available</text></svg>`;

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

const TAB_CONFIG: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: 'movies', label: 'Movies', icon: Film },
  { key: 'tv', label: 'TV Shows', icon: Tv },
  { key: 'talents', label: 'Talents', icon: User },
];

const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden bg-zinc-900/30 border border-zinc-800/40 backdrop-blur-sm animate-pulse">
    <div className="aspect-[2/3] bg-zinc-800/50" />
    <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
      <div className="h-4 bg-zinc-800/60 rounded-md w-5/6" />
      <div className="flex items-center justify-between pt-1">
        <div className="h-3 bg-zinc-800/40 rounded-md w-12" />
        <div className="h-3 bg-zinc-800/40 rounded-md w-16" />
      </div>
      <div className="flex gap-1.5 pt-1">
        <div className="h-5 bg-zinc-800/40 rounded-full w-12 sm:w-14" />
        <div className="h-5 bg-zinc-800/40 rounded-full w-12 sm:w-14" />
      </div>
    </div>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
    {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
);

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query') || '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('movies');

  const fetchSearchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=859afbb4b98e3b467da9c99ac390e950&query=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) throw new Error('Network failure');
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setResults(data.results);
      } else {
        setResults([]);
        setError('No results match your search criteria.');
      }
    } catch {
      setError('Unable to fetch results. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) fetchSearchResults(query);
  }, [query, fetchSearchResults]);

  const { movies, tvShows, talents } = useMemo(() => {
    return {
      movies: results.filter((r) => r.media_type === 'movie'),
      tvShows: results.filter((r) => r.media_type === 'tv'),
      talents: results.filter((r) => r.media_type === 'person'),
    };
  }, [results]);

  const tabCounts = useMemo(() => ({
    movies: movies.length,
    tv: tvShows.length,
    talents: talents.length,
  }), [movies, tvShows, talents]);

  const filteredResults = useMemo(() => {
    switch (activeTab) {
      case 'movies': return movies;
      case 'tv': return tvShows;
      case 'talents': return talents;
      default: return [];
    }
  }, [activeTab, movies, tvShows, talents]);

  const getRoute = (item: SearchResult) => {
    if (item.media_type === 'person') return `/actor/${item.id}`;
    if (item.media_type === 'tv') return `/tv/${item.id}`;
    return `/movie/${item.id}`;
  };

  const getImageUrl = (item: SearchResult) => {
    const path = item.media_type === 'person'
      ? (item.profile_path || item.poster_path)
      : (item.poster_path || item.backdrop_path);
    return path ? `https://image.tmdb.org/t/p/w780${path}` : null;
  };

  const getBadgeDetails = (item: SearchResult) => {
    if (item.media_type !== 'person') {
      const isTv = item.media_type === 'tv';
      return {
        label: isTv ? 'TV Show' : 'Movie',
        styles: 'bg-zinc-950/90 backdrop-blur-md text-zinc-200 border-l-2 border-zinc-500 shadow-lg shadow-black/40',
      };
    }

    const normalized = item.known_for_department?.toLowerCase().trim();
    switch (normalized) {
      case 'acting':
        return { 
          label: 'Actor', 
          styles: 'bg-zinc-950/90 backdrop-blur-md text-emerald-400 border-l-2 border-emerald-500 shadow-lg shadow-black/40' 
        };
      case 'directing':
        return { 
          label: 'Director', 
          styles: 'bg-zinc-950/90 backdrop-blur-md text-cyan-400 border-l-2 border-cyan-500 shadow-lg shadow-black/40' 
        };
      case 'writing':
        return { 
          label: 'Writer', 
          styles: 'bg-zinc-950/90 backdrop-blur-md text-teal-400 border-l-2 border-teal-500 shadow-lg shadow-black/40' 
        };
      case 'production':
        return { 
          label: 'Producer', 
          styles: 'bg-zinc-950/90 backdrop-blur-md text-sky-400 border-l-2 border-sky-500 shadow-lg shadow-black/40' 
        };
      case 'editing':
      case 'crew':
      case 'visual effects':
        return { 
          label: 'Crew', 
          styles: 'bg-zinc-950/90 backdrop-blur-md text-indigo-400 border-l-2 border-indigo-500 shadow-lg shadow-black/40' 
        };
      default:
        return { 
          label: 'Talent', 
          styles: 'bg-zinc-950/90 backdrop-blur-md text-emerald-400 border-l-2 border-emerald-500 shadow-lg shadow-black/40' 
        };
    }
  };

  return (
    <div className="bg-zinc-950 text-zinc-50 min-h-screen selection:bg-orange-500/30 selection:text-orange-200 overflow-x-hidden">
      <div className="absolute top-0 left-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-orange-600/10 rounded-full blur-[80px] sm:blur-[128px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 sm:w-96 sm:h-96 bg-red-600/5 rounded-full blur-[80px] sm:blur-[128px] pointer-events-none" />

      <div className="relative container mx-auto px-4 py-6 sm:py-12 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 sm:pb-6 mb-6 sm:mb-8 border-b border-zinc-900"
        >
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-[10px] sm:text-xs font-bold tracking-widest text-orange-500 uppercase">Explore Engine</span>
              <span className="h-px w-8 sm:w-12 bg-zinc-800" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Search Results
            </h1>
            {query && (
              <p className="text-zinc-400 text-xs sm:text-sm">
                Showing entries corresponding to <span className="text-zinc-200 font-semibold bg-zinc-900 px-2 py-0.5 rounded-md">"{query}"</span>
              </p>
            )}
          </div>

          <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-zinc-400 text-xs sm:text-sm font-medium w-fit self-start md:self-end">
            <span className="text-zinc-200 font-bold">{results.length}</span> global matches
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">

          <motion.aside
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full lg:w-64 shrink-0 lg:sticky lg:top-6 z-20"
          >
            <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/50 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl w-full flex flex-row lg:flex-col gap-1 overflow-x-auto scrollbar-none snap-x snap-mandatory">
              {TAB_CONFIG.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center justify-between gap-3 sm:gap-4 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 shrink-0 grow lg:grow-0 snap-start ${
                      isActive ? 'text-orange-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 bg-orange-500/10 border border-orange-500/20 rounded-lg sm:rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-orange-500' : 'text-zinc-500'}`} />
                      {tab.label}
                    </span>
                    {tabCounts[tab.key] > 0 && (
                      <span className={`relative z-10 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md font-bold ${
                        isActive ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800/80 text-zinc-400'
                      }`}>
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.aside>

          <div className="grow w-full">
            {loading && <SkeletonGrid />}

            {!loading && error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center border border-zinc-900 rounded-2xl sm:rounded-3xl bg-zinc-900/10 backdrop-blur-sm py-12 sm:py-16 px-4 text-center"
              >
                <div className="p-3 sm:p-4 bg-red-500/5 border border-red-500/10 rounded-xl sm:rounded-2xl mb-4 text-red-500">
                  <Frown className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-200 mb-1">Search Pipeline Interrupted</h3>
                <p className="text-zinc-400 text-xs sm:text-sm mb-5 sm:mb-6 max-w-xs">{error}</p>
                <button
                  onClick={() => fetchSearchResults(query)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Connection
                </button>
              </motion.div>
            )}

            {!loading && !error && filteredResults.length > 0 && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  variants={CONTAINER_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
                >
                  {filteredResults.map((item) => {
                    const imageUrl = getImageUrl(item);
                    const isActor = item.media_type === 'person';
                    const title = item.title || item.name || 'Untitled';
                    const dateSource = item.release_date || item.first_air_date;
                    const year = dateSource ? new Date(dateSource).getFullYear() : null;
                    const genres = (item.genre_ids || [])
                      .map((id) => GENRE_MAPPING[id])
                      .filter(Boolean)
                      .slice(0, 2);

                    const badgeInfo = getBadgeDetails(item);

                    return (
                      <motion.div key={`${activeTab}-${item.id}`} variants={CARD_VARIANTS}>
                        <Link
                          to={getRoute(item)}
                          className="group relative flex flex-col h-full rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900/20 backdrop-blur-md border border-zinc-800/60 hover:border-zinc-700 transition-all duration-300"
                        >
                          
                          <div className="relative aspect-[2/3] w-full overflow-hidden">
                            
                            <GlassSweep
                              posterUrl={imageUrl || noImageSvg}
                              title={title}
                            />

                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={title}
                                className="w-full h-full object-cover transform scale-100 group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/50 p-3 text-center">
                                <ImageOff className="w-6 h-6 sm:w-8 sm:h-8 mb-1.5 sm:mb-2 stroke-[1.5]" />
                                <span className="text-[10px] sm:text-xs tracking-wide">Image Unavailable</span>
                              </div>
                            )}

                            <div className="absolute top-2 inset-x-2 sm:top-3 sm:inset-x-3 flex items-center justify-between gap-1.5 z-10">
                              <span className={`text-[9px] sm:text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md border border-white/5 ${badgeInfo.styles}`}>
                                {badgeInfo.label}
                              </span>

                              {item.vote_average !== undefined && item.vote_average > 0 && (
                                <div className="bg-zinc-950/90 backdrop-blur-md border border-white/5 shadow-lg shadow-black/40 rounded-md px-1.5 py-1 flex items-center gap-0.5 sm:gap-1">
                                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                                  <span className="text-white text-[10px] sm:text-xs font-bold leading-none">{item.vote_average.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-3 sm:p-4 flex flex-col grow justify-between bg-zinc-900/10">
                            <div className="space-y-0.5 sm:space-y-1">
                              <h3 className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-1 group-hover:text-orange-400 transition-colors duration-200">
                                {title}
                              </h3>
                              {(!isActor || year) && (
                                <p className="text-zinc-500 text-[11px] sm:text-xs font-medium">
                                  {year || 'Release N/A'}
                                </p>
                              )}
                            </div>

                            {genres.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-2 sm:pt-3">
                                {genres.map((g) => (
                                  <span
                                    key={g}
                                    className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 rounded"
                                  >
                                    {g}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            )}

            {!loading && !error && filteredResults.length === 0 && query && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 text-center border border-dashed border-zinc-900 rounded-2xl sm:rounded-3xl"
              >
                <div className="p-3.5 bg-zinc-900/40 rounded-full text-zinc-600 mb-3.5">
                  <Search className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-300 mb-1">
                  No matches in this category
                </h3>
                <p className="text-zinc-500 text-xs sm:text-sm max-w-sm">
                  We couldn't pull any {activeTab === 'movies' ? 'movies' : activeTab === 'tv' ? 'TV sequences' : 'talent profiles'} for your current search string. Try evaluating other navigation tracks.
                </p>
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default SearchResults;