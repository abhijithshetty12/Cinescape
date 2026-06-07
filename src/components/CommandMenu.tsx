import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Film,
  Tv,
  User,
  Bookmark,
  ChevronRight,
} from 'lucide-react';


type MediaType = 'movie' | 'tv' | 'person';

type SearchResult = {
  id: number;
  media_type: MediaType;
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
  release_date?: string;
  first_air_date?: string;
};

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  onSelect: () => void;
  keywords?: string[];
};

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';

const getImageUrl = (r: SearchResult) => {
  const path = r.media_type === 'person' ? r.profile_path : r.poster_path;
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w92${path}`;
};

const CommandMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);

  const [activeIndex, setActiveIndex] = useState(0);

  const baseActions: CommandItem[] = useMemo(
    () => [
      {
        id: 'directors-cut',
        label: "Open Director’s Cut",
        description: 'Interactive film lineage map',
        icon: Film,
        onSelect: () => {
          navigate('/directors-cut');
          onClose();
        },
        keywords: ['directors cut', "director's cut", 'lineage', 'graph', 'director', 'actor'],
      },
      {
        id: 'watchlist',
        label: 'Go to Watchlist',
        description: 'Jump to your saved items',
        icon: Bookmark,
        onSelect: () => {
          navigate('/watchlist');
          onClose();
        },
        keywords: ['watchlist', 'saved', 'bookmark'],
      },
    ],
    [navigate, onClose]
  );


  const actionList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseActions;

    return baseActions.filter((a) => {
      const hay = [a.label, a.description ?? '', ...(a.keywords ?? [])]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [baseActions, query]);

  const groupedSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchResult[];
    return results;
  }, [query, results]);

  const listItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actionItems = actionList.map((a) => ({
      kind: 'action' as const,
      id: a.id,
      label: a.label,
      description: a.description,
      icon: a.icon,
      onSelect: a.onSelect,
      image: null as string | null,
      mediaType: null as MediaType | null,
      item: null as SearchResult | null,
    }));

    if (!q) {
      return actionItems;
    }

    const resultItems = groupedSuggestions.slice(0, 12).map((r) => ({
      kind: 'result' as const,
      id: `result-${r.media_type}-${r.id}`,
      label: r.media_type === 'person' ? r.name ?? 'Untitled' : r.title ?? 'Untitled',
      description:
        r.media_type === 'person'
          ? 'Actor'
          : r.media_type === 'tv'
            ? `TV • ${r.first_air_date ? new Date(r.first_air_date).getFullYear() : ''}`
            : `Movie • ${r.release_date ? new Date(r.release_date).getFullYear() : ''}`,
      icon: r.media_type === 'person' ? User : r.media_type === 'tv' ? Tv : Film,
      onSelect: () => {
        if (r.media_type === 'person') navigate(`/actor/${r.id}`);
        else if (r.media_type === 'tv') navigate(`/tv/${r.id}`);
        else navigate(`/movie/${r.id}`);
        onClose();
      },
      image: getImageUrl(r),
      mediaType: r.media_type,
      item: r,
    }));

    return [...actionItems, ...resultItems];
  }, [actionList, groupedSuggestions, query, navigate, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setResults([]);
    setActiveIndex(0);
    setError(null);

    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();

    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(q)}`
        );
        const data = await response.json();
        const list: SearchResult[] = Array.isArray(data?.results) ? data.results : [];
        setResults(list);
      } catch {
        setError('Failed to fetch results');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [API_KEY, isOpen, query]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, listItems.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const item = listItems[activeIndex];
        if (item) item.onSelect();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, isOpen, listItems, onClose]);

  if (!isOpen) return null;

  const ActiveIcon = listItems[activeIndex]?.icon;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />

      <div className="relative h-full flex items-start justify-center pt-[10vh] px-4">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl bg-zinc-950/80 border border-white/10 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="flex-1">
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder="Search movies, TV, actors… or type 'watchlist'"
                    className="w-full bg-transparent text-white placeholder:text-zinc-500 outline-none text-sm sm:text-base"
                  />
                </div>
                <button
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-zinc-300" />
                </button>
              </div>
            </div>

            <div className="max-h-[52vh] overflow-y-auto">
              <div className="p-2">
                {loading && (
                  <div className="px-3 py-6 text-center text-zinc-400 text-sm">
                    Searching…
                  </div>
                )}

                {!loading && error && (
                  <div className="px-3 py-6 text-center text-red-300 text-sm">{error}</div>
                )}

                {!loading && !error && listItems.length === 0 && (
                  <div className="px-3 py-6 text-center text-zinc-400 text-sm">No matches</div>
                )}

                {!loading && listItems.length > 0 && (
                  <ul className="space-y-1">
                    {listItems.map((item, idx) => {
                      const selected = idx === activeIndex;
                      const Icon = item.icon;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => item.onSelect()}
                            className={`w-full text-left px-3 py-3 rounded-2xl transition-all duration-150 flex items-center gap-3 border border-transparent ${
                              selected
                                ? 'bg-white/10 border-white/15'
                                : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                              <Icon className="w-5 h-5 text-zinc-200" />
                            </div>

                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.label}
                                className="w-10 h-10 rounded-xl object-cover border border-white/10"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-10 h-10" />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white truncate">{item.label}</span>
                                {selected && <ChevronRight className="w-4 h-4 text-red-400 ml-auto" />}
                              </div>
                              {item.description && (
                                <div className="text-xs text-zinc-400 truncate mt-0.5">{item.description}</div>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-white/10 text-xs text-zinc-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Cmd/Ctrl + K</span>
                </span>
                <span className="hidden sm:inline">to open</span>
              </div>
              <div className="flex items-center gap-2">
                <span>↑↓</span>
                <span>Enter</span>
                <span>Esc</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {ActiveIcon ? null : null}
    </div>
  );
};

export default CommandMenu;

