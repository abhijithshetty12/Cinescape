import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Network } from 'vis-network/standalone';
import {
  Clapperboard,
  Search,
  User,
  ChevronRight,
  Info,
  Sliders,
  X,
  AlertCircle,
  Sparkles,
  Maximize2,
  Film,
  Tv,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';

type MediaType = 'movie' | 'tv';
type PersonKind = 'director' | 'actor';

type TMDBPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
};

type GraphNode = {
  id: string;
  label: string;
  group: string;
  mediaType?: MediaType;
  posterPath?: string | null;
  profilePath?: string | null;
  color: { background: string; border: string; highlight: { background: string; border: string } };
  shape: 'dot' | 'box';
  title?: string;
  genres?: string[];
  year?: string;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  value: number;
  width: number;
  color: { color: string; opacity: number };
  title: string;
};

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

const nodeColors = {
  director: {
    background: '#f43f5e',
    border: '#ffffff',
    highlight: { background: '#fb7185', border: '#ffffff' },
  },
  actor: {
    background: '#06b6d4',
    border: '#ffffff',
    highlight: { background: '#22d3ee', border: '#ffffff' },
  },
  title: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.3)',
    highlight: { background: 'rgba(255, 255, 255, 0.2)', border: '#ffffff' },
  },
};

function safeYear(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getFullYear());
}

async function fetchTMDBJSON<T>(url: string) {
  const res = await axios.get(url);
  return res.data as T;
}

export default function DirectorsCut() {
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);

  const [kind, setKind] = useState<PersonKind>('director');
  const [query, setQuery] = useState('Christopher Nolan');
  const [selectedPerson, setSelectedPerson] = useState<TMDBPerson | null>(null);

  const [depth, setDepth] = useState(2);
  const [maxNodes, setMaxNodes] = useState(45);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspector, setInspector] = useState<GraphNode | null>(null);
  const [sidebarGallery, setSidebarGallery] = useState<GraphNode[]>([]);

  async function searchPerson(q: string): Promise<TMDBPerson[]> {
    const url = `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(q)}&include_adult=false`;
    type Resp = { results: { id: number; name: string; profile_path?: string | null }[] };
    const data = await fetchTMDBJSON<Resp>(url);
    return (data?.results ?? []).slice(0, 8).map((r) => ({
      id: r.id,
      name: r.name,
      profile_path: r.profile_path,
    }));
  }

  async function fetchDirectorGraph(personId: number) {
    type CreditItem = {
      id: number;
      media_type: MediaType;
      title?: string;
      name?: string;
      release_date?: string;
      first_air_date?: string;
      job?: string;
      known_for_department?: string;
      poster_path?: string | null;
    };

    const credits = await fetchTMDBJSON<{ crew: any[]; id: number }>(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${API_KEY}`
    );

    const directed = (credits.crew ?? []).filter((c: CreditItem) => c.job === 'Director' || c.known_for_department === 'Directing');
    const picked = directed.slice(0, Math.max(8, depth * 6));
    const nodePeople = new Map<number, { kind: PersonKind; name: string; profilePath?: string | null }>();
    const edgeWeight = new Map<string, number>();
    const edgeByPair = new Map<string, { from: string; to: string }>();

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const rootId = `person:${personId}`;
    const directorLabel = selectedPerson?.name ?? 'Director';

    nodes.push({
      id: rootId,
      label: directorLabel,
      group: 'director',
      profilePath: selectedPerson?.profile_path,
      color: nodeColors.director,
      shape: 'dot',
      title: `${directorLabel}\nDirector`,
    });

    for (let i = 0; i < picked.length; i++) {
      const c = picked[i] as CreditItem;
      const mediaType = c.media_type;
      const title = c.title ?? c.name ?? 'Untitled';
      const titleId = c.id;
      const titleNodeId = `title:${mediaType}:${titleId}`;

      if (nodes.length > maxNodes) break;

      let titleData: any = null;
      try {
        titleData = await fetchTMDBJSON<any>(`https://api.themoviedb.org/3/${mediaType}/${titleId}?api_key=${API_KEY}&append_to_response=credits`);
      } catch {
        continue;
      }

      const genres = Array.isArray(titleData?.genres) ? titleData.genres.map((g: any) => String(g?.name ?? '')).filter(Boolean) : [];
      const year = safeYear(c.release_date ?? c.first_air_date);
      const titleLabel = year ? `${title} (${year})` : title;

      nodes.push({
        id: titleNodeId,
        label: titleLabel,
        group: mediaType === 'movie' ? 'movie' : 'series',
        mediaType,
        posterPath: titleData?.poster_path ?? c.poster_path,
        genres,
        year,
        color: nodeColors.title,
        shape: 'box',
        title: `${titleLabel}\nGenres: ${genres.length ? genres.join(', ') : 'Unknown'}`,
      });

      edges.push({
        id: `edge:root->${titleNodeId}`,
        from: rootId,
        to: titleNodeId,
        value: 1,
        width: 1.5,
        color: { color: '#f43f5e', opacity: 0.5 },
        title: 'Directed',
      });

      const cast = (titleData?.credits?.cast ?? []).slice(0, 10).filter((m: any) => typeof m?.id === 'number' && m?.name);
      const actorIds: number[] = [];

      for (const m of cast) {
        const actorId = m.id as number;
        actorIds.push(actorId);
        if (!nodePeople.has(actorId)) {
          nodePeople.set(actorId, { kind: 'actor', name: m.name, profilePath: m.profile_path });
        }
      }

      for (const actorId of actorIds) {
        if (nodes.length >= maxNodes) break;
        if (nodes.some((n) => n.id === `person:${actorId}`)) continue;

        const p = nodePeople.get(actorId)!;
        nodes.push({
          id: `person:${actorId}`,
          label: p.name,
          group: 'actor',
          profilePath: p.profilePath,
          color: nodeColors.actor,
          shape: 'dot',
          title: `${p.name}\nActor`,
        });
      }

      for (let a = 0; a < actorIds.length; a++) {
        for (let b = a + 1; b < actorIds.length; b++) {
          const from = `person:${actorIds[a]}`;
          const to = `person:${actorIds[b]}`;
          const key = [from, to].sort().join('::');
          edgeWeight.set(key, (edgeWeight.get(key) ?? 0) + 1);
          edgeByPair.set(key, { from, to });
        }
      }
    }

    for (const [key, w] of edgeWeight.entries()) {
      if (nodes.length > maxNodes) break;
      if (w < Math.max(2, depth)) continue;

      const pair = edgeByPair.get(key)!;
      edges.push({
        id: `edge:${pair.from}<->${pair.to}`,
        from: pair.from,
        to: pair.to,
        value: w,
        width: Math.min(8, 1.2 + w * 1.0),
        color: { color: '#8b5cf6', opacity: 0.4 },
        title: `Co-appeared ${w} times`,
      });
    }

    return { nodes, edges };
  }

  async function fetchActorGraph(personId: number) {
    const credits = await fetchTMDBJSON<{ id: number; cast: any[] }>(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${API_KEY}`
    );

    const acting = (credits.cast ?? []).slice(0, Math.max(8, depth * 6));
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const rootId = `person:${personId}`;
    const rootLabel = selectedPerson?.name ?? 'Actor';

    nodes.push({
      id: rootId,
      label: rootLabel,
      group: 'actor',
      profilePath: selectedPerson?.profile_path,
      color: nodeColors.actor,
      shape: 'dot',
      title: `${rootLabel}\nActor`,
    });

    const edgeWeight = new Map<string, number>();
    const edgeByPair = new Map<string, { from: string; to: string }>();

    for (const c0 of acting) {
      if (nodes.length > maxNodes) break;

      const mediaType = c0.media_type as MediaType;
      const titleId = c0.id as number;
      const title = c0.title ?? c0.name ?? 'Untitled';
      const titleNodeId = `title:${mediaType}:${titleId}`;

      let titleData: any = null;
      try {
        titleData = await fetchTMDBJSON<any>(`https://api.themoviedb.org/3/${mediaType}/${titleId}?api_key=${API_KEY}&append_to_response=credits`);
      } catch {
        continue;
      }

      const genres = Array.isArray(titleData?.genres) ? titleData.genres.map((g: any) => String(g?.name ?? '')) : [];
      const year = safeYear(c0.release_date ?? c0.first_air_date);
      const titleLabel = year ? `${title} (${year})` : title;

      nodes.push({
        id: titleNodeId,
        label: titleLabel,
        group: mediaType === 'movie' ? 'movie' : 'series',
        mediaType,
        posterPath: titleData?.poster_path ?? c0.poster_path,
        genres,
        year,
        color: nodeColors.title,
        shape: 'box',
        title: `${titleLabel}\nGenres: ${genres.length ? genres.join(', ') : 'Unknown'}`,
      });

      edges.push({
        id: `edge:root->${titleNodeId}`,
        from: rootId,
        to: titleNodeId,
        value: 1,
        width: 1.5,
        color: { color: '#06b6d4', opacity: 0.5 },
        title: 'Appeared in',
      });

      const cast = (titleData?.credits?.cast ?? []).slice(0, 10).filter((m: any) => typeof m?.id === 'number' && m?.name);
      const actorIds: number[] = [personId];
      for (const m of cast) actorIds.push(m.id);

      const uniqueActorIds = Array.from(new Set(actorIds));
      for (const actorId of uniqueActorIds) {
        if (nodes.length >= maxNodes) break;
        if (nodes.some((n) => n.id === `person:${actorId}`)) continue;

        const actorObj = cast.find((m: any) => m.id === actorId);
        const actorName = actorId === personId ? rootLabel : actorObj?.name;
        if (!actorName) continue;

        nodes.push({
          id: `person:${actorId}`,
          label: actorName,
          group: 'actor',
          profilePath: actorId === personId ? selectedPerson?.profile_path : actorObj?.profile_path,
          color: nodeColors.actor,
          shape: 'dot',
          title: `${actorName}\nActor`,
        });
      }

      const castIdsOnly = cast.map((m: any) => m.id as number);
      for (let a = 0; a < castIdsOnly.length; a++) {
        for (let b = a + 1; b < castIdsOnly.length; b++) {
          const from = `person:${castIdsOnly[a]}`;
          const to = `person:${castIdsOnly[b]}`;
          const key = [from, to].sort().join('::');
          edgeWeight.set(key, (edgeWeight.get(key) ?? 0) + 1);
          edgeByPair.set(key, { from, to });
        }
      }
    }

    for (const [key, w] of edgeWeight.entries()) {
      if (w < Math.max(2, depth)) continue;
      const pair = edgeByPair.get(key)!;
      edges.push({
        id: `edge:${pair.from}<->${pair.to}`,
        from: pair.from,
        to: pair.to,
        value: w,
        width: Math.min(8, 1.2 + w * 1.0),
        color: { color: '#8b5cf6', opacity: 0.4 },
        title: `Co-appeared ${w} times`,
      });
    }

    return { nodes, edges };
  }

  function destroyNetwork() {
    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }
  }

  function renderGraph(nodes: GraphNode[], edges: GraphEdge[]) {
    if (!containerRef.current) return;
    destroyNetwork();

    const options: any = {
      autoResize: true,
      physics: {
        enabled: true,
        stabilization: { iterations: 120 },
        solver: 'barnesHut',
        barnesHut: { springLength: 140, springConstant: 0.04, gravitationalConstant: -3000 },
      },
      interaction: { hover: true, multiselect: false, zoomView: true },
      nodes: {
        font: { color: '#ffffff', size: 12, face: '-apple-system, sans-serif' },
        borderWidth: 1.5,
      },
      edges: {
        arrows: { to: { enabled: false } },
        smooth: { type: 'continuous', roundness: 0.4 },
      },
      layout: { improvedLayout: true },
    };

    const net = new Network(containerRef.current, { nodes, edges }, options);
    networkRef.current = net;

    net.on('click', (params: any) => {
      const nodeId = params?.nodes?.[0];
      if (!nodeId) return;
      const found = nodes.find((n) => n.id === nodeId);
      if (found) {
        setInspector(found);
        try {
          net.focus(nodeId, { scale: 1.15, animation: { duration: 400, easingFunction: 'easeInOutCubic' } });
        } catch { /* ignore */ }
      }
    });
  }

  async function buildGraphForPerson(p: TMDBPerson) {
    setError(null);
    setInspector(null);
    setLoading(true);
    try {
      const graph = kind === 'director' ? await fetchDirectorGraph(p.id) : await fetchActorGraph(p.id);
      const activeNodes = graph.nodes.slice(0, maxNodes);

      const itemsWithImages = activeNodes.filter((n) => n.posterPath || n.profilePath);
      setSidebarGallery(itemsWithImages.slice(0, 6));

      renderGraph(activeNodes, graph.edges);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to map graph infrastructure');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => destroyNetwork();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const results = await searchPerson(query);
        const pick = results[0] ?? null;
        if (!pick || cancelled) return;
        setSelectedPerson(pick);
        buildGraphForPerson(pick);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Initialization failure');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function onSubmitSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchPerson(query);
      const pick = results[0] ?? null;
      if (!pick) {
        setError('Resource not found inside database.');
        return;
      }
      setSelectedPerson(pick);
      await buildGraphForPerson(pick);
    } catch (e: any) {
      setError(e?.message ?? 'Search query interrupted');
    } finally {
      setLoading(false);
    }
  }

  // Redirect Route Resolver
  const inspectorLink = useMemo(() => {
    if (!inspector) return null;
    if (inspector.id.startsWith('title:')) {
      const [, mediaType, idStr] = inspector.id.split(':');
      return `/${mediaType}/${idStr}`; // Redirects to /movie/:id or /tv/:id
    }
    if (inspector.id.startsWith('person:')) {
      const actorId = inspector.id.split(':')[1];
      return `/actor/${actorId}`; // Redirects to /actor/:id
    }
    return null;
  }, [inspector]);

  // Handler for Redirecting
  const handleNavigateToDetails = () => {
    if (inspectorLink) {
      navigate(inspectorLink);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-100 font-[-apple-system,sans-serif] antialiased p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <header className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">Director’s Cut</h1>
              <p className="text-xs text-zinc-400">Cinematic Lineage Architecture</p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-rose-400" />
              <span>Updating Graph...</span>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Controls & Side Gallery */}
          <aside className="lg:col-span-4 space-y-6">

            {/* Control Deck */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-300">
                <Sliders className="w-4 h-4 text-rose-400" />
                <span>Control Deck</span>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Search Target</label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSubmitSearch()}
                    className="w-full pl-10 pr-8 py-2.5 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/50"
                    placeholder="Search talent..."
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 border border-white/10 rounded-xl">
                <button
                  onClick={() => setKind('director')}
                  className={`py-2 rounded-lg text-xs font-medium transition ${kind === 'director' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-zinc-400 hover:text-white'
                    }`}
                >
                  Director
                </button>
                <button
                  onClick={() => setKind('actor')}
                  className={`py-2 rounded-lg text-xs font-medium transition ${kind === 'actor' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-zinc-400 hover:text-white'
                    }`}
                >
                  Actor
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 uppercase mb-1">
                    <span>Depth</span>
                    <span className="text-rose-400 font-mono">{depth} Gen</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={depth}
                    onChange={(e) => setDepth(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 uppercase mb-1">
                    <span>Max Nodes</span>
                    <span className="text-rose-400 font-mono">{maxNodes}</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={80}
                    value={maxNodes}
                    onChange={(e) => setMaxNodes(Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>
              </div>

              <button
                onClick={onSubmitSearch}
                disabled={loading || !query.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold text-xs rounded-xl hover:opacity-90 transition disabled:opacity-40"
              >
                Generate Graph
              </button>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Side Gallery */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-300">
                  <ImageIcon className="w-4 h-4 text-rose-400" />
                  <span>Graph Gallery</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">{sidebarGallery.length} Items</span>
              </div>

              {sidebarGallery.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No media or talent photos available.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sidebarGallery.map((item) => {
                    const imgSrc = item.posterPath
                      ? `${TMDB_IMAGE_BASE}${item.posterPath}`
                      : item.profilePath
                        ? `${TMDB_IMAGE_BASE}${item.profilePath}`
                        : null;

                    return (
                      <div
                        key={item.id}
                        onClick={() => setInspector(item)}
                        className="group relative cursor-pointer aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-black/40 hover:border-rose-500/50 transition-all"
                      >
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={item.label}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                            <User className="w-5 h-5 text-zinc-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex flex-col justify-end">
                          <p className="text-[9px] font-medium text-white truncate">{item.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </aside>

          {/* Canvas & Node Inspector */}
          <main className="lg:col-span-8 space-y-6">

            {/* Graph Canvas */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 relative">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Info className="w-4 h-4 text-rose-400" />
                  <span>Lineage Map</span>
                </div>
                {selectedPerson && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    {selectedPerson.profile_path && (
                      <img
                        src={`${TMDB_IMAGE_BASE}${selectedPerson.profile_path}`}
                        alt={selectedPerson.name}
                        className="w-4 h-4 rounded-full object-cover border border-white/20"
                      />
                    )}
                    <span>Target: <span className="text-white font-medium">{selectedPerson.name}</span></span>
                  </div>
                )}
              </div>

              <div
                ref={containerRef}
                className="w-full h-[420px] sm:h-[480px] bg-black/60 rounded-xl overflow-hidden border border-white/5"
              />
            </div>

            {/* Click-Redirect Node Inspector */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-300">
                  <Maximize2 className="w-4 h-4 text-rose-400" />
                  <span>Node Inspector</span>
                </div>
                {inspector && (
                  <span className="text-[10px] text-rose-400 font-mono animate-pulse">
                    Click card to view details
                  </span>
                )}
              </div>

              {!inspector ? (
                <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  Click any node on the graph or gallery item to inspect and view movie/actor details
                </div>
              ) : (
                <div
                  onClick={handleNavigateToDetails}
                  className="group cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-black/40 border border-white/10 hover:border-rose-500/50 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-4">
                    {inspector.posterPath ? (
                      <img
                        src={`${TMDB_IMAGE_BASE}${inspector.posterPath}`}
                        alt={inspector.label}
                        className="w-16 h-24 rounded-lg object-cover border border-white/20 shadow-md shrink-0 group-hover:scale-105 transition-transform"
                      />
                    ) : inspector.profilePath ? (
                      <img
                        src={`${TMDB_IMAGE_BASE}${inspector.profilePath}`}
                        alt={inspector.label}
                        className="w-16 h-16 rounded-xl object-cover border border-white/20 shadow-md shrink-0 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        {inspector.group === 'movie' ? (
                          <Film className="w-6 h-6 text-zinc-400" />
                        ) : inspector.group === 'series' ? (
                          <Tv className="w-6 h-6 text-zinc-400" />
                        ) : (
                          <User className="w-6 h-6 text-zinc-400" />
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          {inspector.group}
                        </span>
                        {inspector.year && <span className="text-[10px] text-zinc-400">{inspector.year}</span>}
                      </div>
                      <h3 className="text-sm font-medium text-white group-hover:text-rose-400 transition-colors">
                        {inspector.label}
                      </h3>
                      {inspector.genres && inspector.genres.length > 0 && (
                        <p className="text-xs text-zinc-400">{inspector.genres.join(', ')}</p>
                      )}
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-500/20 group-hover:bg-rose-500 border border-rose-500/30 text-rose-300 group-hover:text-white text-xs font-medium rounded-xl transition-all shrink-0">
                    <span>Inspect Details</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}