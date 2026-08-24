import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Search, 
  Star, 
  ImageOff, 
  Clapperboard, 
  Tv, 
  User, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  TrendingUp,
  Camera,
  PenTool,
  Music,
  Sliders,
  Sparkles
} from 'lucide-react';
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
    transition: { staggerChildren: 0.05 },
  },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 15, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
};

const TAB_CONFIG: { key: TabType; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { key: 'movies', label: 'Movies', shortLabel: 'Movies', icon: Clapperboard },
  { key: 'tv', label: 'TV Shows', shortLabel: 'TV', icon: Tv },
  { key: 'talents', label: 'Talent', shortLabel: 'Talent', icon: User },
];

const CustomBadge = ({ 
  icon: Icon, 
  text, 
  isRating = false 
}: { 
  icon?: React.ElementType; 
  text?: string | number; 
  isRating?: boolean;
}) => {
  return (
    <div className={`inline-flex items-center rounded-full bg-[#1c1615]/90 border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_10px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all ${text ? 'gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1' : 'p-1.5 sm:p-2'}`}>
      {Icon && (
        <Icon className={`w-3 h-3 sm:w-3 sm:h-3 ${isRating ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
      )}
      {text && (
        <span className="text-[10px] sm:text-[11px] font-bold tracking-wide text-white uppercase leading-none">
          {text}
        </span>
      )}
    </div>
  );
};

const getBadgeDetails = (item: SearchResult) => {
  if (item.media_type === 'movie') {
    return { label: 'Movie', icon: Clapperboard };
  }
  if (item.media_type === 'tv') {
    return { label: 'Tv', icon: Tv };
  }
  
  const dept = (item.known_for_department || '').toLowerCase();
  switch (dept) {
    case 'acting':
      return { label: 'Acting', icon: User };
    case 'directing':
      return { label: 'Directing', icon: Camera };
    case 'writing':
      return { label: 'Writing', icon: PenTool };
    case 'sound':
    case 'music':
      return { label: 'Sound', icon: Music };
    case 'production':
      return { label: 'Production', icon: Sliders };
    default:
      return { label: item.known_for_department || 'Talent', icon: Sparkles };
  }
};

const SkeletonGrid = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 bg-white/[0.03] border border-white/10 backdrop-blur-2xl animate-pulse">
          <div className="aspect-[2/3] w-full rounded-xl sm:rounded-2xl bg-white/[0.05]" />
          <div className="space-y-2 px-1">
            <div className="h-3 sm:h-3.5 bg-white/[0.05] rounded-full w-3/4" />
            <div className="h-2.5 sm:h-3 bg-white/[0.05] rounded-full w-1/2" />
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

  const getImageUrl = (item: SearchResult, highRes = false): string | undefined => {
    const path = item.media_type === 'person'
      ? (item.profile_path || item.poster_path)
      : (item.poster_path || item.backdrop_path);
    return path ? `https://image.tmdb.org/t/p/${highRes ? 'original' : 'w780'}${path}` : undefined;
  };

  return (
    <div className="bg-[#040406] text-neutral-100 min-h-screen selection:bg-red-600 selection:text-white font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',sans-serif] antialiased overflow-x-hidden pb-16 sm:pb-24">

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent rounded-full blur-[160px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[180px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-10 space-y-5 sm:space-y-10">

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-[20px] sm:rounded-[28px] bg-white/[0.02] border border-white/20 backdrop-blur-3xl shadow-[0_0_25px_rgba(255,255,255,0.06),inset_0_1px_1px_rgba(255,255,255,0.4)]">
          <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#ff2a2a] to-[#990000] border border-white/30 flex items-center justify-center text-white shadow-[0_4px_15px_rgba(235,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.6)]">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow-md" />
              </div>
              <div>
                <h1 className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-white uppercase">
                  Search Results
                </h1>
                {query && (
                  <p className="text-[10px] sm:text-[11px] text-neutral-400 font-medium truncate max-w-[180px] sm:max-w-none">
                    Showing matches for <span className="text-white font-semibold">"{query}"</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 bg-black/50 p-1 sm:p-1.5 rounded-full border border-white/10 backdrop-blur-2xl max-w-full overflow-x-auto no-scrollbar shrink-0 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] w-full md:w-auto justify-around md:justify-start">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-300 whitespace-nowrap ${isActive
                    ? 'bg-gradient-to-b from-[#ff2a2a] via-[#d60000] to-[#880000] text-white border border-red-400/50 shadow-[0_4px_15px_rgba(235,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="inline sm:hidden">{tab.shortLabel}</span>
                  {tabCounts[tab.key] > 0 && (
                    <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-mono font-medium ${isActive ? 'bg-black/40 text-white border border-white/20' : 'bg-white/10 text-neutral-400'}`}>
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
              className="w-full bg-white/[0.03] border border-white/15 text-xs text-white placeholder-neutral-500 rounded-full pl-8 sm:pl-9 pr-12 sm:pr-14 py-2 sm:py-2.5 focus:outline-none focus:border-white/40 focus:bg-white/[0.06] backdrop-blur-2xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.03),inset_0_1px_2px_rgba(0,0,0,0.6)]"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 sm:w-3.5 h-3 sm:h-3.5 text-neutral-400" />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-b from-[#ff2a2a] to-[#b30000] text-white text-[10px] sm:text-[11px] font-bold rounded-full hover:brightness-125 transition-all border border-red-400/40 shadow-[0_2px_10px_rgba(235,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]"
            >
              Go
            </button>
          </form>
        </div>

        {!loading && !error && topSpotlights.length > 0 && (
          <div className="hidden sm:block space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-white uppercase">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <span>Top Rated Matches</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {topSpotlights.map((item) => {
                const title = item.title || item.name || 'Untitled';
                const imageUrl = getImageUrl(item, true);
                const badge = getBadgeDetails(item);

                return (
                  <Link
                    key={`spotlight-${item.id}`}
                    to={getRoute(item)}
                    className="group relative h-44 sm:h-52 rounded-[24px] overflow-hidden border border-white/15 bg-white/[0.02] backdrop-blur-2xl shadow-[0_0_20px_rgba(255,255,255,0.03),inset_0_1px_1px_rgba(255,255,255,0.3)] hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-500"
                  >
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    <div className="absolute bottom-3.5 inset-x-3.5 space-y-1.5 z-10">
                      <div className="flex items-center justify-between">
                        <CustomBadge icon={badge.icon} text={badge.label} />
                        {item.vote_average !== undefined && item.vote_average > 0 && (
                          <CustomBadge icon={Star} text={item.vote_average.toFixed(1)} isRating />
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
            <div className="flex flex-col items-center justify-center border border-white/15 rounded-[24px] sm:rounded-[32px] bg-white/[0.02] backdrop-blur-3xl py-12 sm:py-20 px-4 text-center space-y-3 sm:space-y-4 shadow-[0_0_30px_rgba(255,255,255,0.04)]">
              <div className="p-3 sm:p-4 bg-gradient-to-b from-[#ff2a2a] to-[#990000] border border-white/30 rounded-full text-white shadow-[0_4px_15px_rgba(235,0,0,0.4)]">
                <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <p className="text-neutral-300 font-medium text-xs sm:text-sm">{error}</p>
              <button
                onClick={() => fetchSearchResults(query)}
                className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-white/10 hover:bg-white/20 border border-white/25 rounded-full text-xs font-semibold text-white backdrop-blur-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
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
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6"
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
                  const badge = getBadgeDetails(item);

                  return (
                    <motion.div key={`${activeTab}-${item.id}`} variants={CARD_VARIANTS}>
                      <Link
                        to={getRoute(item)}
                        className="group flex flex-col h-full rounded-[18px] sm:rounded-[24px] overflow-hidden bg-white/[0.02] border border-white/15 hover:border-white/40 backdrop-blur-2xl transition-all duration-500 hover:shadow-[0_0_25px_rgba(255,255,255,0.08),inset_0_1px_1px_rgba(255,255,255,0.4)] p-2 sm:p-3 space-y-2 sm:space-y-3"
                      >
                        <div className="group relative aspect-[2/3] w-full rounded-[14px] sm:rounded-[18px] overflow-hidden bg-neutral-900 border border-white/10">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={title}
                              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-white/[0.02] flex flex-col items-center justify-center text-neutral-500">
                              <ImageOff className="w-6 h-6 sm:w-8 sm:h-8 mb-1.5 sm:mb-2 opacity-40" />
                              <span className="text-[10px] sm:text-xs text-center px-2">No Image</span>
                            </div>
                          )}

                          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] transition-transform duration-1000 ease-in-out" />
                          </div>

                          <div className="absolute top-1.5 left-1.5 right-1.5 sm:top-2 sm:left-2 sm:right-2 flex items-center justify-between z-10 pointer-events-none">
                            <CustomBadge icon={badge.icon} text={badge.label} />
                            {item.vote_average !== undefined && item.vote_average > 0 && (
                              <CustomBadge icon={Star} text={item.vote_average.toFixed(1)} isRating />
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col justify-between grow space-y-1.5 sm:space-y-2 px-0.5 sm:px-1 pb-0.5">
                          <div className="space-y-0.5 sm:space-y-1">
                            <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                              {title}
                            </h3>
                            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-400">
                              <span>{year ? year : item.media_type === 'person' ? 'Person' : 'N/A'}</span>
                              <span className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-semibold text-[9px] sm:text-[10px]">
                                View <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </span>
                            </div>
                          </div>
                          {genres.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1 sm:pt-1.5 border-t border-white/5">
                              {genres.map((g) => (
                                <span key={g} className="text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 bg-white/5 border border-white/10 text-neutral-300 rounded-full backdrop-blur-md">
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
            <div className="py-12 sm:py-20 text-center border border-white/15 rounded-[24px] sm:rounded-[32px] bg-white/[0.01] backdrop-blur-2xl shadow-[0_0_20px_rgba(255,255,255,0.02)]">
              <Search className="w-6 h-6 sm:w-8 sm:h-8 text-neutral-500 mx-auto mb-2 sm:mb-3" />
              <h3 className="text-xs sm:text-sm font-semibold text-neutral-300">No results found in {activeTab}</h3>
              <p className="text-neutral-500 text-[10px] sm:text-xs mt-1">Try selecting another filter pill above.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SearchResults;