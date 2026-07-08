import React, { useState, useEffect } from 'react';
import { Search, Menu, X, Compass, Users, Heart, Award, Clapperboard, Tv, User, Loader2, AlertCircle, SearchX } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { db } from '../firebase.ts';
import { doc, onSnapshot } from 'firebase/firestore';

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
  const { user } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.uid) {
      setPhotoUrl(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.photoDataUrl) {
          setPhotoUrl(data.photoDataUrl);
        } else {
          setPhotoUrl(null);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

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
    { label: 'Fav Talents', path: '/fav-talents', icon: Heart },
  ];

  const movies = searchResults.filter(result => result.media_type === 'movie');
  const tvShows = searchResults.filter(result => result.media_type === 'tv');
  const actors = searchResults.filter(result => result.media_type === 'person');

  return (
    <nav className="bg-white/70 dark:bg-black/70 backdrop-blur-md border-b border-gray-300 dark:border-zinc-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/home"
            className="group flex items-center gap-2 px-3 py-2 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl shadow-md shadow-red-500/20 group-hover:shadow-red-500/40 transition-shadow duration-300">
              <img
                src="/Logo.png"
                alt="Logo"
                className="h-5 w-5 object-contain drop-shadow-sm"
              />
            </div>
            <img
              src="/Cinescape.png"
              alt="Cinescape"
              className="h-5 w-auto opacity-90 group-hover:opacity-100 transition-opacity duration-300"
            />
          </Link>
          <div className="hidden md:block">
            <form onSubmit={handleSearch} className="relative w-96">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4 transition-colors group-focus-within:text-red-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, TV shows, actors..."
                  className="bg-zinc-800/60 backdrop-blur-md border border-zinc-700/50 text-white pl-11 pr-10 py-2.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/30 w-full transition-all duration-300 placeholder:text-zinc-500 text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-zinc-700/50 transition-colors"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <X className="text-zinc-400 w-3.5 h-3.5 hover:text-white transition-colors" />
                  </button>
                )}
              </div>

              {loading && (
                <div className="absolute top-full left-0 w-full mt-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 p-6 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                  <span className="text-zinc-300 text-sm">Searching...</span>
                </div>
              )}

              {error && !loading && (
                <div className="absolute top-full left-0 w-full mt-3 bg-zinc-900/95 backdrop-blur-xl border border-red-900/50 rounded-2xl shadow-2xl shadow-black/50 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-red-200 text-sm">{error}</span>
                </div>
              )}

              {searchQuery && !loading && !error && searchResults.length === 0 && (
                <div className="absolute top-full left-0 w-full mt-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 p-6 flex flex-col items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <SearchX className="w-8 h-8 text-zinc-600" />
                  <span className="text-zinc-400 text-sm">No results found for "{searchQuery}"</span>
                </div>
              )}

              {searchResults.length > 0 && !loading && (
                <div className="absolute top-full left-0 w-full mt-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
                  {movies.length > 0 && (
                    <div className="py-2">
                      <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2.5 flex items-center gap-2">
                        <Clapperboard className="w-4 h-4 text-white/90" />
                        <h3 className="text-white font-semibold text-sm tracking-wide">Movies</h3>
                        <span className="ml-auto text-white/70 text-xs bg-white/10 px-2 py-0.5 rounded-full">{movies.length}</span>
                      </div>
                      <ul>
                        {movies.map((result) => (
                          <li
                            key={result.id}
                            onClick={() => handleResultClick(result.id, result.media_type)}
                            className="px-4 py-3 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 group border-b border-zinc-800/50 last:border-0"
                          >
                            <div className="flex items-center gap-4">
                              <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-zinc-800">
                                {result.poster_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                    alt={result.title || result.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Clapperboard className="w-5 h-5 text-zinc-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-red-400 transition-colors">
                                  {result.title || result.name}
                                </p>
                                {result.release_date && (
                                  <p className="text-xs text-zinc-500 mt-0.5">
                                    {new Date(result.release_date).getFullYear()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {tvShows.length > 0 && (
                    <div className="py-2">
                      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 flex items-center gap-2">
                        <Tv className="w-4 h-4 text-white/90" />
                        <h3 className="text-white font-semibold text-sm tracking-wide">TV Shows</h3>
                        <span className="ml-auto text-white/70 text-xs bg-white/10 px-2 py-0.5 rounded-full">{tvShows.length}</span>
                      </div>
                      <ul>
                        {tvShows.map((result) => (
                          <li
                            key={result.id}
                            onClick={() => handleResultClick(result.id, result.media_type)}
                            className="px-4 py-3 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 group border-b border-zinc-800/50 last:border-0"
                          >
                            <div className="flex items-center gap-4">
                              <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-zinc-800">
                                {result.poster_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                    alt={result.title || result.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Tv className="w-5 h-5 text-zinc-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-cyan-400 transition-colors">
                                  {result.title || result.name}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {actors.length > 0 && (
                    <div className="py-2">
                      <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-2.5 flex items-center gap-2">
                        <User className="w-4 h-4 text-white/90" />
                        <h3 className="text-white font-semibold text-sm tracking-wide">Talents</h3>
                        <span className="ml-auto text-white/70 text-xs bg-white/10 px-2 py-0.5 rounded-full">{actors.length}</span>
                      </div>
                      <ul>
                        {actors.map((result) => (
                          <li
                            key={result.id}
                            onClick={() => handleResultClick(result.id, result.media_type)}
                            className="px-4 py-3 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 group border-b border-zinc-800/50 last:border-0"
                          >
                            <div className="flex items-center gap-4">
                              <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-zinc-800">
                                {result.profile_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w92${result.profile_path}`}
                                    alt={result.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-zinc-600" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-emerald-400 transition-colors">
                                  {result.name}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2.5 rounded-xl border transition-all duration-200 active:scale-95 ${isMenuOpen
                ? 'bg-zinc-900 border-zinc-800 text-red-500 shadow-inner'
                : 'bg-zinc-900/60 hover:bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-100'
              }`}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 transition-transform duration-200 rotate-90 animate-in fade-in zoom-in-75" />
            ) : (
              <Menu className="w-5 h-5 transition-transform duration-200 animate-in fade-in zoom-in-75" />
            )}
          </button>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 bg-zinc-900/40 backdrop-blur-sm p-1.5 rounded-2xl border border-zinc-800/50">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isActive
                      ? 'bg-zinc-800 text-white shadow-lg shadow-black/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                >
                  {item.icon && (
                    <item.icon
                      className={`w-4 h-4 transition-colors duration-300 ${isActive ? 'text-red-500' : 'text-zinc-500 group-hover:text-zinc-300'
                        }`}
                    />
                  )}
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
          <Link
            to="/profile"
            className="relative group p-1.5 rounded-full bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/60 transition-all duration-300"
          >
            <img
              src={photoUrl || "/user-icon.jpg"}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent group-hover:ring-red-500/30 transition-all duration-300"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-zinc-950 rounded-full" />
          </Link>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-zinc-950/98 backdrop-blur-xl text-white p-6 border-t border-zinc-800">
          <form onSubmit={handleSearch} className="relative mb-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4 transition-colors group-focus-within:text-red-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, TV shows, actors..."
                className="bg-zinc-900/80 border border-zinc-700/50 text-white pl-11 pr-10 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/30 w-full transition-all duration-300 placeholder:text-zinc-500 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-zinc-700/50 transition-colors"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <X className="text-zinc-400 w-3.5 h-3.5 hover:text-white transition-colors" />
                </button>
              )}
            </div>

            {loading && (
              <div className="w-full mt-3 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                <span className="text-zinc-300 text-sm">Searching...</span>
              </div>
            )}

            {error && !loading && (
              <div className="w-full mt-3 bg-zinc-900/95 border border-red-900/50 rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span className="text-red-200 text-sm">{error}</span>
              </div>
            )}

            {searchQuery && !loading && !error && searchResults.length === 0 && (
              <div className="w-full mt-3 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <SearchX className="w-8 h-8 text-zinc-600" />
                <span className="text-zinc-400 text-sm">No results found for "{searchQuery}"</span>
              </div>
            )}

            {searchResults.length > 0 && !loading && (
              <div className="w-full mt-3 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl max-h-[60vh] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
                {movies.length > 0 && (
                  <div className="py-2">
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2.5 flex items-center gap-2">
                      <Clapperboard className="w-4 h-4 text-white/90" />
                      <h3 className="text-white font-semibold text-sm tracking-wide">Movies</h3>
                      <span className="ml-auto text-white/70 text-xs bg-white/10 px-2 py-0.5 rounded-full">{movies.length}</span>
                    </div>
                    <ul>
                      {movies.map((result) => (
                        <li
                          key={result.id}
                          onClick={() => handleResultClick(result.id, result.media_type)}
                          className="px-4 py-3 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 group border-b border-zinc-800/50 last:border-0"
                        >
                          <div className="flex items-center gap-4">
                            <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-zinc-800">
                              {result.poster_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                  alt={result.title || result.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Clapperboard className="w-5 h-5 text-zinc-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-red-400 transition-colors">
                                {result.title || result.name}
                              </p>
                              {result.release_date && (
                                <p className="text-xs text-zinc-500 mt-0.5">
                                  {new Date(result.release_date).getFullYear()}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tvShows.length > 0 && (
                  <div className="py-2">
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 flex items-center gap-2">
                      <Tv className="w-4 h-4 text-white/90" />
                      <h3 className="text-white font-semibold text-sm tracking-wide">TV Shows</h3>
                      <span className="ml-auto text-white/70 text-xs bg-white/10 px-2 py-0.5 rounded-full">{tvShows.length}</span>
                    </div>
                    <ul>
                      {tvShows.map((result) => (
                        <li
                          key={result.id}
                          onClick={() => handleResultClick(result.id, result.media_type)}
                          className="px-4 py-3 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 group border-b border-zinc-800/50 last:border-0"
                        >
                          <div className="flex items-center gap-4">
                            <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-zinc-800">
                              {result.poster_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                  alt={result.title || result.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Tv className="w-5 h-5 text-zinc-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-cyan-400 transition-colors">
                                {result.title || result.name}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {actors.length > 0 && (
                  <div className="py-2">
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-2.5 flex items-center gap-2">
                      <User className="w-4 h-4 text-white/90" />
                      <h3 className="text-white font-semibold text-sm tracking-wide">Talents</h3>
                      <span className="ml-auto text-white/70 text-xs bg-white/10 px-2 py-0.5 rounded-full">{actors.length}</span>
                    </div>
                    <ul>
                      {actors.map((result) => (
                        <li
                          key={result.id}
                          onClick={() => handleResultClick(result.id, result.media_type)}
                          className="px-4 py-3 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 group border-b border-zinc-800/50 last:border-0"
                        >
                          <div className="flex items-center gap-4">
                            <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-zinc-800">
                              {result.profile_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${result.profile_path}`}
                                  alt={result.name}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-zinc-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-emerald-400 transition-colors">
                                {result.name}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </form>

          <Link
            to="/profile"
            className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 hover:bg-zinc-800/60 hover:border-zinc-700/50 transition-all duration-300 mb-2 group"
            onClick={() => setIsMenuOpen(false)}
          >
            <div className="relative">
              <img src={photoUrl || "/user-icon.jpg"} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-700 group-hover:ring-red-500/30 transition-all duration-300" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-zinc-900 rounded-full" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">Profile</p>
              <p className="text-xs text-zinc-500">View your account</p>
            </div>
          </Link>

          <div className="space-y-1 mt-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive
                      ? 'bg-zinc-800/80 text-white border border-zinc-700/50 shadow-lg shadow-black/10'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border border-transparent'
                    }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div className={`p-2 rounded-xl ${isActive ? 'bg-red-500/10' : 'bg-zinc-800/50'
                    }`}>
                    {item.icon && (
                      <item.icon
                        className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-red-500' : 'text-zinc-500'
                          }`}
                      />
                    )}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 bg-red-500 rounded-full" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
export default Navbar;