import React, { useCallback, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clapperboard,
  Users,
  AlertCircle,
  Video,
  Search,
  ExternalLink,
  Film,
  UserCheck
} from 'lucide-react';
import Loading from '../components/Loading.tsx';

type MediaType = 'movie' | 'tv';

type SharedCred = {
  media_type: MediaType;
  id: number;
  title: string;
};

type ConnectionType = 'director' | 'costar';

type ConnectionItem = {
  id: number;
  name: string;
  profile_path: string | null;
  type: ConnectionType;
  score: number;
  titles: SharedCred[];
};

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const MAX_FILMS = 8;

async function fetchTMDBJSON<T>(url: string): Promise<T> {
  const res = await axios.get(url);
  return res.data as T;
}

function safeYear(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getFullYear());
}

function displayTitle(c: any): string {
  const base = c?.title || c?.name || 'Untitled';
  const year = safeYear(c?.release_date ?? c?.first_air_date);
  return year ? `${base} (${year})` : base;
}

export default function TalentsConnections() {
  const { id } = useParams<{ id: string }>();
  const talentId = Number(id);

  const [talent, setTalent] = useState<{ id: number; name: string; profile_path: string | null } | null>(null);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'director' | 'costar'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const imgUrl = (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w185${path}` : '/user-icon.jpg';

  const load = useCallback(async () => {
    if (!Number.isFinite(talentId)) {
      setError('Invalid talent profile.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const personRes = await fetchTMDBJSON<{ id: number; name: string; profile_path: string | null }>(
        `https://api.themoviedb.org/3/person/${talentId}?api_key=${API_KEY}`
      );
      setTalent(personRes);

      const credits = await fetchTMDBJSON<{ id: number; cast: any[]; crew: any[] }>(
        `https://api.themoviedb.org/3/person/${talentId}/combined_credits?api_key=${API_KEY}`
      );

      const itemsMap = new Map<string, ConnectionItem>();

      for (const c of credits.crew ?? []) {
        const isDirector = c?.job === 'Director' || c?.known_for_department === 'Directing';
        if (!isDirector || typeof c?.id !== 'number') continue;
        const key = `dir_${c.id}`;
        const row: ConnectionItem = itemsMap.get(key) ?? {
          id: c.id,
          name: c.name ?? 'Unknown Director',
          profile_path: c.profile_path ?? null,
          type: 'director',
          score: 0,
          titles: [],
        };
        row.score += 1;
        row.titles.push({
          media_type: (c.media_type as MediaType) ?? 'movie',
          id: c.id,
          title: displayTitle(c),
        });
        itemsMap.set(key, row);
      }

      const acting = (credits.cast ?? [])
        .filter((c) => c?.media_type === 'movie' || c?.media_type === 'tv')
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, MAX_FILMS);

      const cache = new Map<string, any>();

      for (const film of acting) {
        const mediaType = film.media_type as MediaType;
        const filmId = Number(film.id);
        const cacheKey = `${mediaType}:${filmId}`;
        if (!Number.isFinite(filmId)) continue;

        let filmData: any = cache.get(cacheKey);
        if (!filmData) {
          try {
            filmData = await fetchTMDBJSON<any>(
              `https://api.themoviedb.org/3/${mediaType}/${filmId}?api_key=${API_KEY}&append_to_response=credits`
            );
            cache.set(cacheKey, filmData);
          } catch {
            continue;
          }
        }

        const title = displayTitle(film);
        const cast = (filmData?.credits?.cast ?? [])
          .slice(0, 12)
          .filter((m: any) => typeof m?.id === 'number' && m?.name && Number(m.id) !== talentId);

        for (const m of cast) {
          const key = `star_${m.id}`;
          const row: ConnectionItem = itemsMap.get(key) ?? {
            id: Number(m.id),
            name: m.name,
            profile_path: m.profile_path ?? null,
            type: 'costar',
            score: 0,
            titles: [],
          };
          row.score += 1;
          row.titles.push({ media_type: mediaType, id: filmId, title });
          itemsMap.set(key, row);
        }
      }

      const merged = Array.from(itemsMap.values()).sort((a, b) => b.score - a.score);
      setConnections(merged);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load connections.');
    } finally {
      setLoading(false);
    }
  }, [talentId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredConnections = useMemo(() => {
    return connections.filter((item) => {
      const matchesTab = activeTab === 'all' || item.type === activeTab;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.titles.some((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [connections, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const directorsCount = connections.filter((c) => c.type === 'director').length;
    const coStarsCount = connections.filter((c) => c.type === 'costar').length;
    const topPartner = connections[0]?.name ?? 'N/A';
    return { directorsCount, coStarsCount, topPartner };
  }, [connections]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white py-12 px-4 flex items-center justify-center">
        <div className="max-w-sm w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm text-zinc-300 font-medium mb-6">{error}</p>
          <Link
            to={`/talent/${talentId}`}
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 relative overflow-hidden pb-16">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            to={`/talent/${talentId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-all active:scale-95 shadow-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Profile</span>
          </Link>
        </div>

        <section className="p-6 sm:p-10 rounded-3xl bg-zinc-950 border border-zinc-800/80 shadow-2xl mb-8 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <img
                  src={imgUrl(talent?.profile_path ?? null)}
                  alt={talent?.name ?? ''}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-zinc-800 shadow-2xl"
                />
                <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-indigo-600 text-white shadow-lg">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {talent?.name}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Collaborators, recurring cast mates & frequent directors
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 bg-zinc-900/50 border border-zinc-800 p-3 rounded-2xl">
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/60 text-center">
                <div className="text-xs text-zinc-400 font-medium">Directors</div>
                <div className="text-lg font-bold text-rose-400 mt-0.5">{stats.directorsCount}</div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/60 text-center">
                <div className="text-xs text-zinc-400 font-medium">Co-Stars</div>
                <div className="text-lg font-bold text-blue-400 mt-0.5">{stats.coStarsCount}</div>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/60 text-center min-w-[100px]">
                <div className="text-xs text-zinc-400 font-medium">Top Match</div>
                <div className="text-xs font-bold text-indigo-300 mt-1 truncate">{stats.topPartner}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center p-1 rounded-2xl bg-zinc-950 border border-zinc-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All ({connections.length})
            </button>
            <button
              onClick={() => setActiveTab('director')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'director'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              Directors
            </button>
            <button
              onClick={() => setActiveTab('costar')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'costar'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-lg'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Co-Stars
            </button>
          </div>

          <div className="relative sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search collaborator or film..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
        </div>

        {filteredConnections.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950">
            <Film className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-400">No connections match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConnections.map((item) => (
              <Link
                key={`${item.type}_${item.id}`}
                to={`/talent/${item.id}`}
                className="group relative flex flex-col justify-between p-5 rounded-3xl bg-zinc-950 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 shadow-xl active:scale-[0.98] overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={imgUrl(item.profile_path)}
                        alt={item.name}
                        loading="lazy"
                        className="w-14 h-14 rounded-2xl object-cover bg-zinc-900 border border-zinc-800 shadow-md group-hover:scale-105 transition-transform"
                      />
                      <div>
                        <h3 className="font-bold text-base text-zinc-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {item.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full mt-1 ${
                            item.type === 'director'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {item.type === 'director' ? <Clapperboard className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          {item.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-bold text-indigo-300 shrink-0">
                      {item.score}×
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="text-[11px] font-medium text-zinc-500">Shared Projects</div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.titles.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 truncate max-w-[200px]"
                        >
                          {t.title}
                        </span>
                      ))}
                      {item.titles.length > 3 && (
                        <span className="text-[11px] px-2 py-1 rounded-xl bg-zinc-900 text-zinc-500 border border-zinc-800/50">
                          +{item.titles.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-900 text-xs text-zinc-400 group-hover:text-indigo-300 transition-colors">
                  <span className="font-medium">View network profile</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <footer className="mt-12 p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-xs text-zinc-500 flex items-center justify-center gap-2">
          <Video className="w-4 h-4 text-zinc-500" />
          <span>Interactive network map for exploring film and TV collaborations.</span>
        </footer>
      </div>
    </div>
  );
}