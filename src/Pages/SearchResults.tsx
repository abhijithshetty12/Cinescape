import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Star, ImageOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
  release_date?: string;
  first_air_date?: string;
  media_type: string;
  vote_average?: number;
}

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'movies' | 'tv' | 'actors'>('movies');

  useEffect(() => {
    if (query) {
      fetchSearchResults(query);
    }
  }, [query]);

  const fetchSearchResults = async (searchQuery: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=859afbb4b98e3b467da9c99ac390e950&query=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data.results) {
        setResults(data.results);
      } else {
        setError('No results found.');
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
      setError('Failed to fetch results. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const movies = results.filter(result => result.media_type === 'movie');
  const tvShows = results.filter(result => result.media_type === 'tv');
  const actors = results.filter(result => result.media_type === 'person');

  const renderResults = (items: SearchResult[], title: string, mediaType: string) => (
    <div className="mb-10">
      <h2 className="text-2xl font-bold text-white mb-6 drop-shadow">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-8">
        {items.map((item) => (
          <Link
            key={item.id}
            to={mediaType === 'person' ? `/actor/${item.id}` : mediaType === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`}
            className="group bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-zinc-700 hover:border-orange-500"
          >
            <div className="aspect-[2/3] relative">
              {item.poster_path || item.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${item.poster_path || item.profile_path}`}
                  alt={item.title || item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex flex-col items-center justify-center text-gray-400">
                  <ImageOff className="w-12 h-12 mb-2" />
                  <span className="text-sm text-center">No Image Available</span>
                </div>
              )}
              {item.vote_average && (
                <div className="absolute top-3 right-3 bg-black/70 rounded-full px-3 py-1 flex items-center gap-1 shadow">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-white text-sm font-bold">{item.vote_average.toFixed(1) || 'N/A'}</span>
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col gap-1">
              <h3 className="text-lg font-bold text-white truncate mb-1">
                {item.title || item.name}
              </h3>
              <span className="text-gray-400 text-sm">
                {item.release_date && new Date(item.release_date).getFullYear()}
                {item.first_air_date && new Date(item.first_air_date).getFullYear()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <Search className="w-9 h-9 text-orange-500 drop-shadow" />
          <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow">
            Search Results for "{query}"
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 rounded-full w-fit p-1 mb-4">
        <div className="relative flex items-center rounded-full">
          <button
            onClick={() => setActiveTab('movies')}
            className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${
              activeTab === 'movies' ? 'text-white' : 'text-gray-400'
            }`}
          >
            Movies
          </button>
          <button
            onClick={() => setActiveTab('tv')}
            className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${
              activeTab === 'tv' ? 'text-white' : 'text-gray-400'
            }`}
          >
            TV Shows
          </button>
          <button
            onClick={() => setActiveTab('actors')}
            className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${
              activeTab === 'actors' ? 'text-white' : 'text-gray-400'
            }`}
          >
            Actors
          </button>
          <motion.div
            className="absolute inset-0 bg-red-600 rounded-full"
            animate={{
              width: activeTab === 'movies' ? '85px' : activeTab === 'tv' ? '110px' : '85px',
              x: activeTab === 'movies' ? 0 : activeTab === 'tv' ? 95 : 190,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          />
        </div>
      </div>

        {loading && (
          <div className="text-center text-white">Loading...</div>
        )}

        {error && (
          <div className="text-center text-red-500">{error}</div>
        )}

        {!loading && !error && (
          <>
            {activeTab === 'movies' && movies.length > 0 && renderResults(movies, 'Movies', 'movie')}
            {activeTab === 'tv' && tvShows.length > 0 && renderResults(tvShows, 'TV Shows', 'tv')}
            {activeTab === 'actors' && actors.length > 0 && renderResults(actors, 'Actors', 'person')}

            {((activeTab === 'movies' && movies.length === 0) ||
              (activeTab === 'tv' && tvShows.length === 0) ||
              (activeTab === 'actors' && actors.length === 0)) && (
              <div className="text-center text-gray-400">
                No {activeTab === 'movies' ? 'movies' : activeTab === 'tv' ? 'TV shows' : 'actors'} found for "{query}"
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResults;