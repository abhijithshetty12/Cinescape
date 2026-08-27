import React, { useState, useEffect } from 'react';
import { Search, Menu, X, Compass, Users, Heart, Award, Clapperboard, Tv, User, Loader2, AlertCircle, SearchX, ListPlus, ChevronRight } from 'lucide-react';
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

const Navbar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
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
        setPhotoUrl(data.photoDataUrl || null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = isTrayOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isTrayOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>('section[id], div[id]');
      const scrollPosition = window.scrollY + 100;

      let currentSection = '';

      sections.forEach((section) => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        if (
          scrollPosition >= sectionTop &&
          scrollPosition < sectionTop + sectionHeight
        ) {
          currentSection = section.getAttribute('id') || '';
        }
      });

      setActiveSection(currentSection);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const fetchSearchResults = async (query: string) => {
    if (!query) return;

    setLoading(true);
    setError('');

    try {
      const apiKey = '859afbb4b98e3b467da9c99ac390e950';

      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}`
      );

      const data = await response.json();

      if (data.results) {
        setSearchResults(data.results);
      } else {
        setError('No results found.');
      }
    } catch (err) {
      console.error('Error fetching search results:', err);
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
    if (location.pathname === '/search' && isTrayOpen && searchQuery === '') {
      setIsTrayOpen(false);
    }
  }, [location.pathname, isTrayOpen, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (searchQuery.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setSearchResults([]);
      setIsTrayOpen(false);
    }
  };

  const handleResultClick = (id: number, mediaType: string) => {
    if (mediaType === 'person') {
      navigate(`/talent/${id}`);
    } else if (mediaType === 'tv') {
      navigate(`/tv/${id}`);
    } else {
      navigate(`/movie/${id}`);
    }

    setSearchQuery('');
    setSearchResults([]);
    setIsTrayOpen(false);
  };

  const navItems = [
    {
      label: 'Explore',
      path: '/explore',
      sectionId: 'explore',
      icon: Compass
    },
    {
      label: 'Top Rated',
      path: '/top-rated',
      sectionId: 'top-rated',
      icon: Award
    },
    {
      label: 'My List',
      path: '/mylist',
      sectionId: 'mylist',
      icon: ListPlus
    },
    {
      label: 'Talents',
      path: '/talents',
      sectionId: 'talents',
      icon: Users
    },
    {
      label: 'Fav Talents',
      path: '/fav-talents',
      sectionId: 'fav-talents',
      icon: Heart
    }
  ];

  const movies = searchResults.filter(
    (result) => result.media_type === 'movie'
  );

  const tvShows = searchResults.filter(
    (result) => result.media_type === 'tv'
  );

  const talents = searchResults.filter(
    (result) => result.media_type === 'person'
  );

  const SearchDropdownContent = () => (
    <>
      {loading && (
        <div className="absolute top-full left-0 w-full mt-3 bg-zinc-950/70 backdrop-blur-3xl backdrop-saturate-150 border border-white/10 rounded-2xl shadow-2xl p-6 flex items-center justify-center gap-3 z-50">
          <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
          <span className="text-zinc-300 text-sm">Searching...</span>
        </div>
      )}

      {error && !loading && (
        <div className="absolute top-full left-0 w-full mt-3 bg-zinc-950/70 backdrop-blur-3xl backdrop-saturate-150 border border-red-500/30 rounded-2xl shadow-2xl p-4 flex items-center gap-3 z-50">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}

      {searchQuery && !loading && !error && searchResults.length === 0 && (
        <div className="absolute top-full left-0 w-full mt-3 bg-zinc-950/70 backdrop-blur-3xl backdrop-saturate-150 border border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col items-center justify-center gap-3 z-50">
          <SearchX className="w-8 h-8 text-zinc-600" />
          <span className="text-zinc-400 text-sm">
            No results found for "{searchQuery}"
          </span>
        </div>
      )}

      {searchResults.length > 0 && !loading && (
        <div className="absolute top-full left-0 w-full mt-3 bg-zinc-950/95 backdrop-blur-3xl backdrop-saturate-150 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] max-h-[60vh] overflow-y-auto custom-scrollbar z-[100] p-1.5 space-y-2">
          {movies.length > 0 && (
            <div className="py-1">
              <div className="sticky top-0 z-10 bg-gradient-to-r from-rose-500/20 via-orange-500/15 to-transparent backdrop-blur-xl border border-rose-500/30 rounded-xl px-4 py-2 flex items-center gap-2.5 mb-1">
                <div className="p-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <Clapperboard className="w-3.5 h-3.5" />
                </div>

                <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                  Movies
                </h3>

                <span className="ml-auto text-rose-200 text-[11px] font-medium bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                  {movies.length}
                </span>
              </div>

              <ul>
                {movies.map((result) => (
                  <li
                    key={result.id}
                    onClick={() =>
                      handleResultClick(result.id, result.media_type)
                    }
                    className="px-3 py-2 rounded-xl hover:bg-white/[0.07] cursor-pointer transition-all duration-200 group border border-transparent hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-zinc-900/70 border border-white/10 group-hover:border-rose-500/40 transition-all">
                        {result.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                            alt={result.title || result.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Clapperboard className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-rose-400 transition-colors">
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
            <div className="py-1">
              <div className="sticky top-0 z-10 bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-transparent backdrop-blur-xl border border-cyan-500/30 rounded-xl px-4 py-2 flex items-center gap-2.5 mb-1">
                <div className="p-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
                  <Tv className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                  TV Series
                </h3>
                <span className="ml-auto text-cyan-200 text-[11px] font-medium bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                  {tvShows.length}
                </span>
              </div>
              <ul>
                {tvShows.map((result) => (
                  <li
                    key={result.id}
                    onClick={() =>
                      handleResultClick(result.id, result.media_type)
                    }
                    className="px-3 py-2 rounded-xl hover:bg-white/[0.07] cursor-pointer transition-all duration-200 group border border-transparent hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-zinc-900/70 border border-white/10 group-hover:border-cyan-500/40 transition-all">
                        {result.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                            alt={result.title || result.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Tv className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-cyan-400 transition-colors">
                          {result.title || result.name}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {talents.length > 0 && (
            <div className="py-1">
              <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-transparent backdrop-blur-xl border border-emerald-500/30 rounded-xl px-4 py-2 flex items-center gap-2.5 mb-1">
                <div className="p-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <User className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                  Talents
                </h3>
                <span className="ml-auto text-emerald-200 text-[11px] font-medium bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  {talents.length}
                </span>
              </div>
              <ul>
                {talents.map((result) => (
                  <li
                    key={result.id}
                    onClick={() =>
                      handleResultClick(result.id, result.media_type)
                    }
                    className="px-3 py-2 rounded-xl hover:bg-white/[0.07] cursor-pointer transition-all duration-200 group border border-transparent hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-zinc-900/70 border border-white/10 group-hover:border-emerald-500/40 transition-all">
                        {result.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${result.profile_path}`}
                            alt={result.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-emerald-400 transition-colors">
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
    </>
  );

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/60 dark:bg-black/60 backdrop-blur-2xl border-b border-white/10 dark:border-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 lg:gap-4 flex-1 md:flex-initial min-w-0">
          <Link
            to="/home"
            className="group flex items-center gap-2 px-1.5 py-1.5 rounded-2xl transition-all duration-300 hover:scale-[1.02] shrink-0"
          >
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md shadow-inner shadow-white/10 group-hover:border-red-500/50 group-hover:shadow-red-500/20 transition-all duration-300">
              <img
                src="/Logo.png"
                alt="Logo"
                className="h-5 w-5 object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              />
            </div>
            <img
              src="/Cinescape.png"
              alt="Cinescape"
              className="h-5 w-auto opacity-90 group-hover:opacity-100 transition-opacity duration-300 sm:block"
            />
          </Link>
          <div className="hidden md:block">
            <form
              onSubmit={handleSearch}
              className="relative w-64 lg:w-80 xl:w-96"
            >
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4 transition-colors group-focus-within:text-red-500" />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, TV shows, talents..."
                  className="bg-white/5 dark:bg-zinc-900/40 backdrop-blur-xl border border-white/10 text-white pl-11 pr-10 py-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/30 w-full transition-all duration-300 placeholder:text-zinc-500 text-sm shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <X className="text-zinc-400 w-3.5 h-3.5 hover:text-white transition-colors" />
                  </button>
                )}
              </div>
              <SearchDropdownContent />
            </form>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 lg:gap-5">
          <div className="flex items-center gap-0.5 lg:gap-1 bg-white/5 dark:bg-zinc-900/30 backdrop-blur-xl p-1 rounded-2xl border border-white/10 shadow-inner">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                activeSection === item.sectionId;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`relative flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-300 ${isActive
                    ? 'bg-white/10 text-white shadow-md backdrop-blur-md border border-white/10'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                    }`}
                >
                  <item.icon
                    className={`w-3.5 h-3.5 transition-colors duration-300 ${isActive ? 'text-red-500' : 'text-zinc-400'
                      }`}
                  />

                  <span>{item.label}</span>

                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                  )}
                </Link>
              );
            })}
          </div>

          <Link
            to="/profile"
            className="relative flex items-center justify-center p-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 backdrop-blur-xl transition-all duration-300 group shadow-sm hover:shadow-[0_0_12px_rgba(255,255,255,0.15)] shrink-0"
          >
            <img
              src={photoUrl || '/user-icon.jpg'}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-300"
            />

            <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-950 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <Link
            to="/profile"
            className="relative p-0.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] shrink-0"
          >
            <img
              src={photoUrl || '/user-icon.jpg'}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
          </Link>
          <button
            onClick={() => setIsTrayOpen(!isTrayOpen)}
            className="relative p-2 rounded-2xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 active:scale-95 text-zinc-100 backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_8px_16px_-4px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden active:scale-90"
            aria-label="Toggle Navigation Menu"
          >
            <div className="relative w-6 h-6 flex items-center justify-center [perspective:1000px]">
              <div
                className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out ${isTrayOpen
                  ? '[transform:translateZ(-100px)_rotate(180deg)] opacity-0 blur-sm pointer-events-none'
                  : '[transform:translateZ(0px)_rotate(0deg)] opacity-100 blur-0'
                  }`}
              >
                <Menu className="w-5 h-5 text-zinc-100 drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]" />
              </div>
              <div
                className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out ${isTrayOpen
                  ? '[transform:translateZ(0px)_rotate(0deg)] opacity-100 blur-0'
                  : '[transform:translateZ(100px)_rotate(-180deg)] opacity-0 blur-sm pointer-events-none'
                  }`}
              >
                <X className="w-5 h-5 text-red-500 stroke-[2.5] filter drop-shadow-[0_0_12px_rgba(248,113,113,0.9)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
              </div>
            </div>
          </button>
        </div>
      </div>
      {isTrayOpen && (
        <div className="absolute inset-x-0 top-full z-50 md:hidden overflow-hidden border-t border-white/10 bg-black/85 backdrop-blur-3xl backdrop-saturate-200 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.95)] transition-all">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-40 bg-gradient-to-b from-white/[0.07] via-red-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-red-900/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative px-5 py-5 space-y-5 max-h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar">
            <div className="relative z-50 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.6)]">
              <form onSubmit={handleSearch} className="relative w-full">
                <div className="relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4 transition-colors group-focus-within:text-red-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies, TV shows, talents..."
                    className="w-full bg-black/60 border border-white/5 text-white pl-10 pr-9 py-3 rounded-xl text-sm placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-black/80 focus:ring-1 focus:ring-red-500/40 transition-all duration-300 shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <SearchDropdownContent />
              </form>
            </div>
            <div className="relative z-10 space-y-2">
              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  activeSection === item.sectionId;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setIsTrayOpen(false)}
                    className={`group relative flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-300 overflow-hidden backdrop-blur-xl ${isActive
                      ? 'bg-white/[0.08] border border-red-500/40 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_25px_rgba(0,0,0,0.7)]'
                      : 'bg-white/[0.02] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.06] hover:border-white/15 hover:text-white active:scale-[0.985]'
                      }`}
                  >
                    {isActive && (
                      <div className="absolute inset-y-2 left-0 w-[3px] bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                    )}
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl transition-all duration-300 ${isActive
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                          : 'bg-white/[0.04] text-zinc-400 border border-white/5 group-hover:bg-white/10 group-hover:text-zinc-200'
                          }`}
                      >
                        <item.icon className="w-4 h-4" />
                      </div>
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-all duration-300 ${isActive
                        ? 'text-red-400 translate-x-0.5'
                        : 'text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5'
                        }`}
                    />
                  </Link>
                );
              })}
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex justify-center pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15 backdrop-blur-md" />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
export default Navbar;