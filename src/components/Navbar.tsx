import React, { useState, useEffect } from 'react';
import { Search, Menu, User, X, Compass, CircleUser, Users, Heart, Award } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
  release_date?: string;
  media_type: string;
}

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchSearchResults = async (query: string) => {
    if (!query) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=859afbb4b98e3b467da9c99ac390e950&query=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results);
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

  useEffect(() => {
    const debounceFetch = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchSearchResults(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceFetch);
  }, [searchQuery]);

  useEffect(() => {
    if (location.pathname === '/search' && isMenuOpen && searchQuery === '') {
      setIsMenuOpen(false);
    }
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setSearchResults([]);
      setIsMenuOpen(false);
    }
  };

  const handleResultClick = (id: number, mediaType: string) => {
    if (mediaType === 'person') {
      navigate(`/actor/${id}`);
    } else if (mediaType === 'tv') {
      navigate(`/tv/${id}`);
    }
    else {
      navigate(`/movie/${id}`)
    }
    setSearchQuery('');
    setSearchResults([]);
    setIsMenuOpen(false);
  };

  const navItems = [
    { label: 'Explore', path: '/explore', icon: Compass },
    { label: 'Top Rated', path: '/top-rated', icon: Award },
    { label: 'Actors', path: '/actors', icon: Users },
    { label: 'Fav Actors', path: '/fav-actors', icon: Heart },
  ];

  const movies = searchResults.filter(result => result.media_type === 'movie');
  const tvShows = searchResults.filter(result => result.media_type === 'tv');
  const actors = searchResults.filter(result => result.media_type === 'person');

  return (
    <nav className="bg-white/70 dark:bg-black/70 backdrop-blur-md border-b border-gray-300 dark:border-zinc-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/home" className="flex items-center gap-2">
            <img src="/Logo.png" alt="Logo" className="h-6 w-6" />
            <img src="/Cinescape.png" alt="Cinescape" className="h-6 w-auto" />
          </Link>
          <div className="hidden md:block">
            <form onSubmit={handleSearch} className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, TV shows, actors..."
                className="bg-gray-500 bg-opacity-30 text-white pl-10 pr-10 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-700 w-full"
              />
              {searchQuery && (
                <X
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5 cursor-pointer hover:text-white"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                />
              )}
              {loading && <div className="absolute top-full left-0 w-full bg-black text-white p-2 rounded-b-lg">Loading...</div>}
              {error && <div className="absolute top-full left-0 w-full bg-red-600 text-white p-2 rounded-b-lg">{error}</div>}
              {searchResults.length > 0 && (
                <ul className="absolute bg-black/80 text-white w-full rounded-lg shadow-xl max-h-60 overflow-y-auto mt-2">
                  {movies.length > 0 && (
                    <li>
                      <h3 className="bg-gradient-to-r from-orange-500 to-red-600 p-3 text-white font-semibold rounded-t-lg">Movies</h3>
                      {movies.map((result) => (
                        <li
                          key={result.id}
                          onClick={() => handleResultClick(result.id, result.media_type)}
                          className="p-3 hover:bg-zinc-900 cursor-pointer transition duration-200"
                        >
                          <div className="flex items-center">
                            {result.poster_path && (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                alt={result.title || result.name}
                                className="inline-block mr-3 w-16 h-24 rounded-lg"
                              />
                            )}
                            <span className="text-sm font-semibold">{result.title || result.name}</span>
                            {result.media_type === 'movie' && result.release_date && (
                              <span className="text-xs text-gray-400 ml-2">({new Date(result.release_date).getFullYear()})</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </li>
                  )}
                  {tvShows.length > 0 && (
                    <li>
                      <h3 className="bg-gradient-to-r from-blue-600 to-cyan-500 p-3 text-white font-semibold">TV Shows</h3>
                      {tvShows.map((result) => (
                        <li
                          key={result.id}
                          onClick={() => handleResultClick(result.id, result.media_type)}
                          className="p-3 hover:bg-gray-900 cursor-pointer transition duration-200"
                        >
                          <div className="flex items-center">
                            {result.poster_path && (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                alt={result.title || result.name}
                                className="inline-block mr-3 w-16 h-24 rounded-lg"
                              />
                            )}
                            <span className="text-sm font-semibold">{result.title || result.name}</span>
                          </div>
                        </li>
                      ))}
                    </li>
                  )}
                  {actors.length > 0 && (
                    <li>
                      <h3 className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 text-white font-semibold">Actors</h3>
                      {actors.map((result) => (
                        <li
                          key={result.id}
                          onClick={() => handleResultClick(result.id, result.media_type)}
                          className="p-3 hover:bg-gray-900 cursor-pointer transition duration-200"
                        >
                          <div className="flex items-center">
                            {result.profile_path && (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${result.profile_path}`}
                                alt={result.name}
                                className="inline-block mr-6 w-auto h-12 rounded-full"
                              />
                            )}
                            <span className="text-sm font-semibold">{result.name}</span>
                          </div>
                        </li>
                      ))}
                    </li>
                  )}
                </ul>
              )}
            </form>
          </div>
        </div>
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full bg-zinc-800 hover:bg-orange-500 transition-colors"
            aria-label="Open menu"
          >
            {isMenuOpen ? <X className="w-7 h-7 text-white" /> : <Menu className="w-7 h-7 text-white" />}
          </button>
        </div>
        <div className="hidden md:flex items-center gap-10">
          <div className="flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className="flex items-center gap-2 text-gray-300 hover:text-red-600 transition-colors duration-200"
              >
                {item.icon && <item.icon className="w-5 h-5" />}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          <Link to="/profile" className="text-gray-300 hover:text-red-600 transition-colors duration-200">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-red-600 transition-colors duration-200">
              <User className="text-white text-lg" />
            </div>
          </Link>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-black text-white p-6">
          <form onSubmit={handleSearch} className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies, TV shows, actors..."
              className="bg-gray-500 bg-opacity-30 text-white pl-10 pr-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-700 w-full"
            />
            {loading && <div className="w-full bg-black text-white p-2 rounded-b-lg mt-2">Loading...</div>}
            {error && <div className="w-full bg-red-600 text-white p-2 rounded-b-lg mt-2">{error}</div>}
            {searchResults.length > 0 && (
              <ul className="absolute bg-zinc-900 text-white w-full rounded-lg shadow-xl max-h-60 overflow-y-auto mt-2">
                {movies.length > 0 && (
                  <li>
                    <h3 className="bg-gradient-to-r from-orange-500 to-red-600 p-3 text-white font-semibold rounded-t-lg">Movies</h3>
                    {movies.map((result) => (
                      <li
                        key={result.id}
                        onClick={() => handleResultClick(result.id, result.media_type)}
                        className="p-3 hover:bg-gray-900 cursor-pointer transition duration-200"
                      >
                        <div className="flex items-center">
                          {result.poster_path && (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                              alt={result.title || result.name}
                              className="inline-block mr-3 w-16 h-24 rounded-lg"
                            />
                          )}
                          <span className="text-sm font-semibold">{result.title || result.name}</span>
                          {result.media_type === 'movie' && result.release_date && (
                            <span className="text-xs text-gray-400 ml-2">({new Date(result.release_date).getFullYear()})</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </li>
                )}
                {tvShows.length > 0 && (
                  <li>
                    <h3 className="bg-gradient-to-r from-blue-600 to-cyan-500 p-3 text-white font-semibold">TV Shows</h3>
                    {tvShows.map((result) => (
                      <li
                        key={result.id}
                        onClick={() => handleResultClick(result.id, result.media_type)}
                        className="p-3 hover:bg-gray-900 cursor-pointer transition duration-200"
                      >
                        <div className="flex items-center">
                          {result.poster_path && (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                              alt={result.title || result.name}
                              className="inline-block mr-3 w-16 h-24 rounded-lg"
                            />
                          )}
                          <span className="text-sm font-semibold">{result.title || result.name}</span>
                        </div>
                      </li>
                    ))}
                  </li>
                )}
                {actors.length > 0 && (
                  <li>
                    <h3 className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 text-white font-semibold">Actors</h3>
                    {actors.map((result) => (
                      <li
                        key={result.id}
                        onClick={() => handleResultClick(result.id, result.media_type)}
                        className="p-3 hover:bg-gray-900 cursor-pointer transition duration-200"
                      >
                        <div className="flex items-center">
                          {result.profile_path && (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${result.profile_path}`}
                              alt={result.name}
                              className="inline-block mr-6 w-auto h-12 rounded-full"
                            />
                          )}
                          <span className="text-sm font-semibold">{result.name}</span>
                        </div>
                      </li>
                    ))}
                  </li>
                )}
              </ul>
            )}
          </form>

          <Link
            to="/profile"
            className="flex items-center gap-3 text-gray-300 hover:text-red-600 py-3"
            onClick={() => setIsMenuOpen(false)}
          >
            <CircleUser className="w-5 h-5" />
            <span>Profile</span>
          </Link>

          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className="flex items-center gap-3 text-gray-300 hover:text-red-700 py-3"
              onClick={() => setIsMenuOpen(false)}
            >
              {item.icon && <item.icon className="w-5 h-5" />}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
export default Navbar;