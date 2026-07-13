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
  Activity,
  Maximize2
} from 'lucide-react';

type MediaType = 'movie' | 'tv';
type PersonKind = 'director' | 'actor';

type TMDBPerson = {
  id: number;
  name: string;
};

type GraphNode = {
  id: string;
  label: string;
  group: string;
  color: { background: string; border: string; highlight: { background: string; border: string } };
  shape: 'dot' | 'box';
  title?: string;
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

const palette = [
  '#f43f5e',
  '#f97316', 
  '#eab308', 
  '#10b981',
  '#06b6d4',
  '#3b82f6', 
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
];

function hashStringToInt(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function genreColor(genre: string) {
  const idx = hashStringToInt(genre.trim().toLowerCase()) % palette.length;
  const base = palette[idx];
  return {
    background: `${base}25`,
    border: `${base}90`,
    highlight: { background: `${base}50`, border: base },
  };
}

function personNodeColor(kind: PersonKind) {
  const base = kind === 'director' ? '#f43f5e' : '#3b82f6';
  return {
    background: base,
    border: base,
    highlight: { background: base, border: base },
  };
}

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

  const getColorLegend = useMemo(() => palette.slice(0, 8), []);

  async function searchPerson(q: string): Promise<TMDBPerson[]> {
    const url = `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(q)}&include_adult=false`;
    type Resp = { results: { id: number; name: string }[] };
    const data = await fetchTMDBJSON<Resp>(url);
    return (data?.results ?? []).slice(0, 8).map((r) => ({ id: r.id, name: r.name }));
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
    };

    const credits = await fetchTMDBJSON<{ crew: any[]; id: number }>(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${API_KEY}`
    );

    const directed = (credits.crew ?? []).filter((c: CreditItem) => c.job === 'Director' || c.known_for_department === 'Directing');
    const picked = directed.slice(0, Math.max(8, depth * 6));
    const nodePeople = new Map<number, { kind: PersonKind; name: string }>();
    const edgeWeight = new Map<string, number>();
    const edgeByPair = new Map<string, { from: string; to: string }>();

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const rootId = `person:${personId}`;
    const directorLabel = selectedPerson?.name ?? 'Director';
    
    nodes.push({
      id: rootId,
      label: directorLabel,
      group: 'person',
      color: personNodeColor('director'),
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
      const dominant = genres[0] ?? 'Collaboration';
      const col = genreColor(dominant);

      nodes.push({
        id: titleNodeId,
        label: titleLabel,
        group: 'title',
        color: col,
        shape: 'box',
        title: `${titleLabel}\nGenres: ${genres.length ? genres.join(', ') : 'Unknown'}`,
      });

      edges.push({
        id: `edge:root->${titleNodeId}`,
        from: rootId,
        to: titleNodeId,
        value: 1,
        width: 1.5,
        color: { color: '#f43f5e', opacity: 0.4 },
        title: 'Directed',
      });

      const cast = (titleData?.credits?.cast ?? []).slice(0, 10).filter((m: any) => typeof m?.id === 'number' && m?.name);
      const actorIds: number[] = [];

      for (const m of cast) {
        const actorId = m.id as number;
        actorIds.push(actorId);
        if (!nodePeople.has(actorId)) {
          nodePeople.set(actorId, { kind: 'actor', name: m.name });
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
          color: personNodeColor('actor'),
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
        color: { color: '#8b5cf6', opacity: 0.3 },
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
      group: 'person',
      color: personNodeColor('actor'),
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

      const genres = Array.isArray(titleData?.genres) ? titleData.genres.map((g: any) => String(g?.name ?? '')).filter(Boolean) : [];
      const year = safeYear(c0.release_date ?? c0.first_air_date);
      const titleLabel = year ? `${title} (${year})` : title;
      const dominant = genres[0] ?? 'Collaboration';
      const col = genreColor(dominant);

      nodes.push({
        id: titleNodeId,
        label: titleLabel,
        group: 'title',
        color: col,
        shape: 'box',
        title: `${titleLabel}\nGenres: ${genres.length ? genres.join(', ') : 'Unknown'}`,
      });

      edges.push({
        id: `edge:root->${titleNodeId}`,
        from: rootId,
        to: titleNodeId,
        value: 1,
        width: 1.5,
        color: { color: '#3b82f6', opacity: 0.4 },
        title: 'Appeared in',
      });

      const cast = (titleData?.credits?.cast ?? []).slice(0, 10).filter((m: any) => typeof m?.id === 'number' && m?.name);
      const actorIds: number[] = [personId];
      for (const m of cast) actorIds.push(m.id);

      const uniqueActorIds = Array.from(new Set(actorIds));
      for (const actorId of uniqueActorIds) {
        if (nodes.length >= maxNodes) break;
        if (nodes.some((n) => n.id === `person:${actorId}`)) continue;

        const actorName = actorId === personId ? rootLabel : cast.find((m: any) => m.id === actorId)?.name;
        if (!actorName) continue;

        nodes.push({
          id: `person:${actorId}`,
          label: actorName,
          group: 'actor',
          color: personNodeColor('actor'),
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
        color: { color: '#8b5cf6', opacity: 0.3 },
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
        font: { color: '#f4f4f5', size: 12, face: 'system-ui, -apple-system, sans-serif' },
        borderWidth: 1.5,
        shadow: { enabled: true, color: 'rgba(0,0,0,0.6)', size: 8, x: 0, y: 4 }
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
      renderGraph(graph.nodes.slice(0, maxNodes), graph.edges);
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
        if (!cancelled) setError(e?.message ?? 'Initialization pipeline failure');
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

  const inspectorLink = useMemo(() => {
    if (!inspector) return null;
    if (inspector.id.startsWith('title:')) {
      const [, mediaType, idStr] = inspector.id.split(':');
      return `/${mediaType}/${idStr}`;
    }
    if (inspector.id.startsWith('person:')) {
      return `/actor/${inspector.id.split(':')[1]}`;
    }
    return null;
  }, [inspector]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 antialiased font-sans selection:bg-rose-500/30 selection:text-white relative overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-rose-500/10 rounded-full blur-[100px] sm:blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-indigo-500/10 rounded-full blur-[100px] sm:blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:2rem_2rem] sm:bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-7xl">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5 mb-6 sm:mb-8 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/[0.03] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl group overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Clapperboard className="w-5 h-5 text-rose-500 relative z-10" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Director’s Cut</h1>
              <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 font-medium tracking-wider">CINEMATIC INTERACTION ARCHITECTURE & LINEAGE</p>
            </div>
          </div>
          
          {loading && (
            <div className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs font-medium text-zinc-300 backdrop-blur-xl shadow-lg">
              <Activity className="w-3.5 h-3.5 text-rose-500 animate-spin" />
              <span>Compiling Lineage...</span>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          
          <aside className="lg:col-span-4 flex flex-col gap-5 sm:gap-6">
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <Sliders className="w-4 h-4 text-rose-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Control Deck</h2>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Search Identity</label>
                  <div className="relative mt-1.5 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4 group-focus-within:text-rose-500 transition-colors" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onSubmitSearch()}
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-950/40 border border-white/10 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 backdrop-blur-md transition-all"
                      placeholder="Enter identity name..."
                    />
                    {query && (
                      <button
                        onClick={() => setQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setKind('director')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border tracking-wide transition-all ${
                      kind === 'director'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)] backdrop-blur-md'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" /> Director
                  </button>
                  <button
                    onClick={() => setKind('actor')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border tracking-wide transition-all ${
                      kind === 'actor'
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] backdrop-blur-md'
                        : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" /> Actor
                  </button>
                </div>

                <div className="space-y-3.5 bg-white/[0.02] border border-white/5 rounded-xl p-3.5 backdrop-blur-md">
                  <div>
                    <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      <span>Exploration Depth</span>
                      <span className="text-zinc-200 font-mono text-xs">{depth} gen</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      value={depth}
                      onChange={(e) => setDepth(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      <span>Saturation Boundary</span>
                      <span className="text-zinc-200 font-mono text-xs">{maxNodes} units</span>
                    </div>
                    <input
                      type="range"
                      min={25}
                      max={80}
                      value={maxNodes}
                      onChange={(e) => setMaxNodes(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>
                </div>

                <button
                  onClick={onSubmitSearch}
                  disabled={loading || !query.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs tracking-wider uppercase rounded-xl border border-rose-500/30 shadow-[0_4px_20px_rgba(225,29,72,0.25)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  Generate Network
                </button>

                {error && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs leading-relaxed backdrop-blur-md">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
              <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Metric Genre Distinctions
              </div>
              <div className="flex flex-wrap gap-2">
                {getColorLegend.map((c) => (
                  <div
                    key={c}
                    className="w-6 h-6 rounded-lg border border-white/10 shadow-inner transition-transform hover:scale-110 duration-200 cursor-pointer"
                    style={{ background: `${c}30`, borderColor: `${c}80` }}
                  />
                ))}
              </div>
            </div>
          </aside>

          <main className="lg:col-span-8 flex flex-col gap-5 sm:gap-6">
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl p-3.5 sm:p-4 flex flex-col shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-300">
                  <Info className="w-3.5 h-3.5 text-rose-500" /> Lineage Space Map
                </div>
                {selectedPerson && (
                  <div className="text-[10px] sm:text-[11px] text-zinc-400 tracking-wide font-medium">
                    Anchor: <span className="text-white font-semibold font-mono">{selectedPerson.name}</span>
                  </div>
                )}
              </div>

              <div
                ref={containerRef}
                className="w-full h-[380px] sm:h-[480px] lg:h-[520px] bg-zinc-950/60 border border-white/5 rounded-xl overflow-hidden relative backdrop-blur-inner"
              />
              
              <div className="mt-3 flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-500">
                <span>* Click node to inspect & focus position.</span>
                <span className="hidden sm:inline">Pinch / Scroll to zoom</span>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 border-b border-white/10 pb-3 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                    <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-zinc-300">Inspector</h3>
                    <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Node Metadata Details</p>
                  </div>
                </div>

                {!inspector ? (
                  <div className="py-8 sm:py-10 flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-xl p-4 bg-white/[0.01]">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping mb-2.5" />
                    <span className="text-xs text-zinc-500 font-medium">Select any graph node on canvas</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-zinc-950/50 border border-white/10 rounded-xl p-3.5 shadow-inner">
                      <div className="text-white font-bold text-sm tracking-tight break-words">{inspector.label}</div>
                      <div className="text-zinc-300 text-xs font-medium mt-2 leading-relaxed bg-white/[0.03] border border-white/10 p-2.5 rounded-lg border-l-2 border-l-rose-500 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {inspector.title ? inspector.title : `Node ID: ${inspector.id}`}
                      </div>
                    </div>

                    {inspectorLink && (
                      <button
                        onClick={() => navigate(inspectorLink)}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 rounded-xl transition-all shadow-md active:scale-[0.99]"
                      >
                        Deep Link Matrix <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[10px] text-zinc-500 leading-relaxed pt-3 border-t border-white/10 mt-5 font-medium">
                Cinematic lineage network tracking co-appearance vectors and shared entity graph structures.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}