import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Star, ImageOff, Film, Tv, User, AlertCircle, RefreshCw, Flame, ArrowRight, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    transition: { staggerChildren: 0.04 },
  },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 22 },
  },
};

const TAB_CONFIG: { key: TabType; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: 'movies', label: 'Movies', shortLabel: 'Movies', icon: Film },
  { key: 'tv', label: 'TV Shows', shortLabel: 'TV', icon: Tv },
  { key: 'talents', label: 'Talent', shortLabel: 'Talent', icon: User },
];

/* Skeleton Loading Component */
const SkeletonGrid = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-2.5 space-y-3 animate-pulse">
          <div className="aspect-[2/3] w-full rounded-xl bg-zinc-900" />
          <div className="space-y-2 px-1">
            <div className="h-3.5 bg-zinc-900 rounded w-3/4" />
            <div className="h-3 bg-zinc-900 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const [inputVal, setInputVal] = useState(query);

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
        setError('No records matched your search parameters.');
      }
    } catch {
      setError('Connection failure. Check your network and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setInputVal(query);
    if (query) fetchSearchResults(query);
  }, [query, fetchSearchResults]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setSearchParams({ query: inputVal.trim() });
    }
  };

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

  const topSpotlights = useMemo(() => {
    return [...filteredResults]
      .filter((item) => item.backdrop_path || item.poster_path)
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 4);
  }, [filteredResults]);

  const getRoute = (item: SearchResult) => {
    if (item.media_type === 'person') return `/talent/${item.id}`;
    if (item.media_type === 'tv') return `/tv/${item.id}`;
    return `/movie/${item.id}`;
  };

  // Fixed return type to string | undefined
  const getImageUrl = (item: SearchResult, highRes = false): string | undefined => {
    const path = item.media_type === 'person'
      ? (item.profile_path || item.poster_path)
      : (item.poster_path || item.backdrop_path);
    return path ? `https://image.tmdb.org/t/p/${highRes ? 'original' : 'w780'}${path}` : undefined;
  };

  const getBadgeText = (item: SearchResult) => {
    if (item.media_type === 'person') {
      return item.known_for_department || 'Talent';
    }
    return item.media_type === 'tv' ? 'TV Series' : 'Movie';
  };

  return (
    <div className="bg-black text-zinc-100 min-h-screen selection:bg-red-600 selection:text-white font-sans overflow-x-hidden pb-24">

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-red-600/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-950/20 rounded-full blur-[180px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-8 sm:space-y-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-950/80">
              <Search className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest text-white uppercase italic">
                SEARCH RESULTS
              </h1>
              {query && (
                <p className="text-[11px] font-mono text-zinc-400">
                  Showing matches for <span className="text-zinc-200">"{query}"</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 bg-zinc-900/80 p-1 sm:p-1.5 rounded-2xl border border-zinc-800/80 max-w-full overflow-x-auto no-scrollbar shrink-0">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-950/80'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="inline sm:hidden">{tab.shortLabel}</span>
                  {tabCounts[tab.key] > 0 && (
                    <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                      {tabCounts[tab.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-72">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Filter results..."
              className="w-full bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 rounded-xl pl-9 pr-14 py-2.5 focus:outline-none focus:border-red-500 transition-colors"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-red-600 text-white text-[11px] font-bold rounded-lg hover:bg-red-700 transition-colors"
            >
              Go
            </button>
          </form>
        </div>

        {!loading && !error && topSpotlights.length > 0 && (
          <div className="hidden sm:block space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-red-500 uppercase">
              <TrendingUp className="w-4 h-4" />
              <span>Top Rated Matches</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {topSpotlights.map((item) => {
                const title = item.title || item.name || 'Untitled';
                const imageUrl = getImageUrl(item, true);
                return (
                  <Link
                    key={`spotlight-${item.id}`}
                    to={getRoute(item)}
                    className="group relative h-40 sm:h-48 rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-xl hover:border-red-600/80 transition-all"
                  >
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                    <div className="absolute bottom-3 inset-x-3 space-y-1 z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-600/80 text-white">
                          {getBadgeText(item)}
                        </span>
                        {item.vote_average !== undefined && item.vote_average > 0 && (
                          <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {item.vote_average.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
                        {title}
                      </h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div>
          {loading && <SkeletonGrid />}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center border border-red-950/50 rounded-3xl bg-zinc-950/80 py-20 px-4 text-center space-y-4">
              <div className="p-4 bg-red-950/40 border border-red-600/30 rounded-full text-red-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-zinc-300 font-bold text-sm">{error}</p>
              <button
                onClick={() => fetchSearchResults(query)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-semibold text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Fetch
              </button>
            </div>
          )}

          {!loading && !error && filteredResults.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={CONTAINER_VARIANTS}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6"
              >
                {filteredResults.map((item) => {
                  const imageUrl = getImageUrl(item);
                  const title = item.title || item.name || 'Untitled';
                  const dateSource = item.release_date || item.first_air_date;
                  const year = dateSource ? new Date(dateSource).getFullYear() : null;
                  const genres = (item.genre_ids || [])
                    .map((id) => GENRE_MAPPING[id])
                    .filter(Boolean)
                    .slice(0, 2);

                  return (
                    <motion.div key={`${activeTab}-${item.id}`} variants={CARD_VARIANTS}>
                      <Link
                        to={getRoute(item)}
                        className="group flex flex-col h-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/80 hover:border-red-600/80 transition-all duration-300 hover:shadow-[0_0_25px_rgba(220,38,38,0.2)] p-2.5 space-y-3"
                      >
                        <div className="group relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/50">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={title}
                              className="w-full h-full object-cover rounded-lg shadow-lg transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-900/80 flex flex-col items-center justify-center rounded-lg text-zinc-500">
                              <ImageOff className="w-8 h-8 mb-2 opacity-50" />
                              <span className="text-xs text-center px-3">No Image</span>
                            </div>
                          )}

                          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] transition-transform duration-1000 ease-in-out" />
                          </div>

                          <div className="absolute top-2 inset-x-2 flex items-center justify-between z-10 pointer-events-none">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-zinc-200 border border-zinc-800/80">
                              {getBadgeText(item)}
                            </span>

                            {item.vote_average !== undefined && item.vote_average > 0 && (
                              <span className="text-[10px] font-mono font-bold text-amber-400 bg-black/80 backdrop-blur-md border border-zinc-800/80 rounded px-1.5 py-0.5 flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-amber-400" />
                                {item.vote_average.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col justify-between grow space-y-2 px-1 pb-1">
                          <div className="space-y-1">
                            <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-red-500 transition-colors">
                              {title}
                            </h3>
                            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                              <span>{year ? year : item.media_type === 'person' ? 'Person' : 'N/A'}</span>
                              <span className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-bold">
                                View <ArrowRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                          {genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-900">
                              {genres.map((g) => (
                                <span key={g} className="text-[9px] px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded">
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
            <div className="py-20 text-center border border-dashed border-zinc-900 rounded-3xl bg-zinc-950/40">
              <Search className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-300">No results found in {activeTab}</h3>
              <p className="text-zinc-500 text-xs mt-1">Try selecting another filter pill above.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SearchResults;