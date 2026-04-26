import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Star, ImageOff, Film, Tv, User, Frown, RotateCcw } from 'lucide-react';
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
}

const genreMapping: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

type TabType = 'movies' | 'tv' | 'actors';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

const tabConfig: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: 'movies', label: 'Movies', icon: Film },
  { key: 'tv', label: 'TV Shows', icon: Tv },
  { key: 'actors', label: 'Actors', icon: User },
];

const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden bg-zinc-900/50 border border-zinc-800/60 animate-pulse">
    <div className="aspect-[2/3] bg-zinc-800/80" />
    <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
      <div className="h-4 sm:h-5 bg-zinc-800/80 rounded-lg w-3/4" />
      <div className="flex items-center justify-between">
        <div className="h-3.5 sm:h-4 bg-zinc-800/80 rounded-lg w-16" />
        <div className="h-3.5 sm:h-4 bg-zinc-800/80 rounded-lg w-10" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-zinc-800/80 rounded-full w-14" />
        <div className="h-5 bg-zinc-800/80 rounded-full w-14" />
      </div>
    </div>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
    {Array.from({ length: 12 }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
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
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=859afbb4b98e3b467da9c99ac390e950&query=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        setResults(data.results);
      } else {
        setResults([]);
        setError('No results found.');
      }
    } catch {
      setError('Failed to fetch results. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) {
      fetchSearchResults(query);
    }
  }, [query, fetchSearchResults]);

  const movies = results.filter((result) => result.media_type === 'movie');
  const tvShows = results.filter((result) => result.media_type === 'tv');
  const actors = results.filter((result) => result.media_type === 'person');

  const tabCounts: Record<TabType, number> = {
    movies: movies.length,
    tv: tvShows.length,
    actors: actors.length,
  };

  const getFilteredResults = (): SearchResult[] => {
    switch (activeTab) {
      case 'movies':
        return movies;
      case 'tv':
        return tvShows;
      case 'actors':
        return actors;
      default:
        return [];
    }
  };

  const getRoute = (item: SearchResult) => {
    if (item.media_type === 'person') return `/actor/${item.id}`;
    if (item.media_type === 'tv') return `/tv/${item.id}`;
    return `/movie/${item.id}`;
  };

  const getImageUrl = (item: SearchResult) => {
    const path = item.poster_path || item.profile_path || item.backdrop_path;
    if (!path) return null;
    // Use poster for movies/tv (portrait ratio). For actors use profile.
    if (item.media_type === 'person') {
      return `https://image.tmdb.org/t/p/w500${item.profile_path || item.poster_path}`;
    }
    return `https://image.tmdb.org/t/p/w500${item.poster_path || item.backdrop_path}`;
  };

  const filteredResults = getFilteredResults();

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black min-h-screen py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/20 shrink-0">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight truncate">
                Search Results
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 truncate">
                for <span className="text-orange-400 font-semibold">"{query}"</span>
              </p>
            </div>
          </div>

          <div className="sm:ml-auto flex items-center gap-2">
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-zinc-800/80 border border-zinc-700/50 rounded-full text-zinc-300 text-xs sm:text-sm font-medium">
              {results.length} total result{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl w-fit p-1 sm:p-1.5">
            {tabConfig.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors duration-300 ${
                    isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl shadow-lg shadow-red-600/25"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label === 'TV Shows' ? 'TV' : tab.label}</span>
                    {tabCounts[tab.key] > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && <SkeletonGrid />}

        {/* Error State */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-4">
              <Frown className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
            <p className="text-zinc-400 mb-6 text-center max-w-md">{error}</p>
            <button
              onClick={() => fetchSearchResults(query)}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </motion.div>
        )}

        {/* Results Grid */}
        {!loading && !error && filteredResults.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5"
            >
              {filteredResults.map((item) => {
                const imageUrl = getImageUrl(item);
                const isActor = item.media_type === 'person';
                const title = item.title || item.name || 'Untitled';
                const year = item.release_date
                  ? new Date(item.release_date).getFullYear()
                  : item.first_air_date
                  ? new Date(item.first_air_date).getFullYear()
                  : null;
                const genreNames = (item.genre_ids || [])
                  .map((id) => genreMapping[id])
                  .filter(Boolean)
                  .slice(0, 2);

                return (
                  <motion.div key={`${activeTab}-${item.id}`} variants={cardVariants}>
                    <Link
                      to={getRoute(item)}
                      className="group block rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 backdrop-blur-sm border border-zinc-700/40 hover:border-orange-500/50 shadow-lg hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-110 group-hover:brightness-110 transition-all duration-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex flex-col items-center justify-center text-zinc-500">
                            <ImageOff className="w-10 h-10 mb-2 opacity-60" />
                            <span className="text-xs text-center px-4">No Image Available</span>
                          </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                        {/* Rating badge */}
                        {item.vote_average !== undefined && item.vote_average > 0 && (
                          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-lg">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                            <span className="text-white text-sm font-bold">
                              {item.vote_average.toFixed(1)}
                            </span>
                          </div>
                        )}

                        {/* Actor badge */}
                        {isActor && (
                          <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-md rounded-lg px-2.5 py-1 shadow-lg">
                            <span className="text-white text-xs font-bold">Actor</span>
                          </div>
                        )}

                        {/* Media type badge for non-actors */}
                        {!isActor && (
                          <div className="absolute top-3 left-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-2.5 py-1 shadow-lg">
                            <span className="text-white text-xs font-bold">
                              {item.media_type === 'tv' ? 'TV' : 'Movie'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 sm:p-4">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-orange-400 transition-colors duration-300">
                          {title}
                        </h3>
                        <div className="flex items-center justify-between mt-1.5">
                          {year ? (
                            <span className="text-zinc-400 text-xs sm:text-sm">{year}</span>
                          ) : (
                            <span className="text-zinc-500 text-xs sm:text-sm">—</span>
                          )}
                          <span className="text-zinc-500 text-[10px] sm:text-xs">
                            {item.media_type === 'movie'
                              ? 'Movie'
                              : item.media_type === 'tv'
                              ? 'TV Show'
                              : 'Person'}
                          </span>
                        </div>
                        {genreNames.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {genreNames.map((g) => (
                              <span
                                key={g}
                                className="text-[10px] sm:text-xs px-2 py-0.5 bg-zinc-800/80 border border-zinc-700/50 rounded-full text-zinc-300 font-medium"
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

        {/* Empty State */}
        {!loading && !error && filteredResults.length === 0 && query && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="p-5 bg-zinc-800/50 border border-zinc-700/40 rounded-2xl mb-5">
              <Search className="w-10 h-10 text-zinc-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              No {activeTab === 'movies' ? 'movies' : activeTab === 'tv' ? 'TV shows' : 'actors'} found
            </h3>
            <p className="text-zinc-400 text-center max-w-sm">
              We couldn&apos;t find any {activeTab === 'movies' ? 'movies' : activeTab === 'tv' ? 'TV shows' : 'actors'} matching "{query}". Try adjusting your search or check another tab.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;

