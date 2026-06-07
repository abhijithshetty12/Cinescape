import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Network } from 'vis-network/standalone';

import {
  Film,
  Search,
  User,
  ChevronRight,
  Info,
  Sparkles,
  X,
  AlertCircle,
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
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
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
    background: `${base}`,
    border: `${base}`,
    highlight: { background: base, border: base },
  };
}

function personNodeColor(kind: PersonKind) {
  const base = kind === 'director' ? '#f97316' : '#60a5fa';
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



  const getColorLegend = useMemo(() => {
    return palette.slice(0, 6).map((c) => c);
  }, []);

  async function searchPerson(q: string): Promise<TMDBPerson[]> {
    const url = `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(
      q
    )}&include_adult=false`;
    type Resp = { results: { id: number; name: string }[] };
    const data = await fetchTMDBJSON<Resp>(url);
    return (data?.results ?? []).slice(0, 8).map((r) => ({ id: r.id, name: r.name }));
  }

  async function fetchDirectorGraph(personId: number) {
    // Fetch director credits (as person credits). We'll treat movies/TV equally.
    type CreditsResp = {
      cast: any[];
      crew: any[];
      id: number;
    };

    type CreditItem = {
      id: number;
      media_type: MediaType;
      title?: string;
      name?: string;
      release_date?: string;
      first_air_date?: string;
      genre_ids?: number[];
      genre_names?: string[];
      known_for_department?: string;
      character?: string;
      job?: string;
    };

    type MovieCredits = {
      cast: { id: number; name: string; character?: string; order?: number; profile_path?: string }[];
      genres?: { id: number; name: string }[];
    };

    const credits = await fetchTMDBJSON<CreditsResp>(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${API_KEY}`
    );

    const directed = (credits.crew ?? []).filter((c: CreditItem) => c.job === 'Director' || c.known_for_department === 'Directing');

    // Take top credits for performance
    const picked = directed.slice(0, Math.max(8, depth * 6));

    // Helper cache
    const personCache = new Map<number, { id: number; name: string }>();
    const titleByNode = new Map<string, { kind: 'title'; id: number; mediaType: MediaType; label: string; genres: string[] }>();

    const nodePeople = new Map<number, { kind: PersonKind; name: string }>();

    // Edges: co-actor collaborations weighted by shared titles
    const edgeWeight = new Map<string, number>();
    const edgeByPair = new Map<string, { from: string; to: string }>();

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Root director node
    const rootDirectorId = personId;
    const directorLabel = selectedPerson?.name ?? 'Director';
    const rootId = `person:${rootDirectorId}`;
    nodes.push({
      id: rootId,
      label: directorLabel,
      group: 'person',
      color: personNodeColor('director'),
      shape: 'dot',
      title: `${directorLabel}\nDirector`,
    });

    // Fetch each title details for genres + cast
    for (let i = 0; i < picked.length; i++) {
      const c = picked[i] as CreditItem;
      const mediaType = c.media_type;
      const title = c.title ?? c.name ?? 'Untitled';
      const titleId = c.id;
      const titleNodeId = `title:${mediaType}:${titleId}`;

      // Limit nodes
      if (nodes.length > maxNodes) break;

      const titleUrl = `https://api.themoviedb.org/3/${mediaType}/${titleId}?api_key=${API_KEY}&append_to_response=credits`;

      let titleData: any = null;
      try {
        titleData = await fetchTMDBJSON<any>(titleUrl);
      } catch {
        continue;
      }

      const genres = Array.isArray(titleData?.genres)
        ? titleData.genres.map((g: any) => String(g?.name ?? '')).filter(Boolean)
        : [];

      const year = safeYear(c.release_date ?? c.first_air_date);
      const titleLabel = year ? `${title} (${year})` : title;

      titleByNode.set(titleNodeId, {
        kind: 'title',
        id: titleId,
        mediaType,
        label: titleLabel,
        genres,
      });

      // pick dominant genre color
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
        color: { color: '#f97316', opacity: 0.5 },
        title: 'Directed',
      });

      const cast = (titleData?.credits?.cast ?? [])
        .slice(0, 10)
        .filter((m: any) => typeof m?.id === 'number' && m?.name);

      // Add co-actor nodes + connect collaborations by pair
      const actorIds: number[] = [];
      for (const m of cast) {
        const actorId = m.id as number;
        actorIds.push(actorId);

        if (!nodePeople.has(actorId)) {
          nodePeople.set(actorId, { kind: 'actor', name: m.name });
        }
      }

      // Create nodes for actors in this title
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

      // Build pairwise edges among cast members
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

    // Convert weighted edges into GraphEdge list
    for (const [key, w] of edgeWeight.entries()) {
      if (nodes.length > maxNodes) break;

      if (w < Math.max(2, depth)) {
        // Keep it readable: only stronger collaborations
        continue;
      }

      const pair = edgeByPair.get(key)!;
      const col = { color: '#a78bfa', opacity: 0.35 };
      edges.push({
        id: `edge:${pair.from}<->${pair.to}`,
        from: pair.from,
        to: pair.to,
        value: w,
        width: Math.min(10, 1.2 + w * 1.1),
        color: col,
        title: `Co-appeared ${w} times`,
      });
    }

    return { nodes, edges };
  }

  async function fetchActorGraph(personId: number) {
    // Actor credits -> build titles and co-actors.
    type CreditsResp = {
      id: number;
      cast: any[];
    };

    const credits = await fetchTMDBJSON<CreditsResp>(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${API_KEY}`
    );

    const acting = (credits.cast ?? []).slice(0, Math.max(8, depth * 6));

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Root actor node
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

      const titleUrl = `https://api.themoviedb.org/3/${mediaType}/${titleId}?api_key=${API_KEY}&append_to_response=credits`;

      let titleData: any = null;
      try {
        titleData = await fetchTMDBJSON<any>(titleUrl);
      } catch {
        continue;
      }

      const genres = Array.isArray(titleData?.genres)
        ? titleData.genres.map((g: any) => String(g?.name ?? '')).filter(Boolean)
        : [];

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
        color: { color: '#60a5fa', opacity: 0.45 },
        title: 'Appeared in',
      });

      const cast = (titleData?.credits?.cast ?? [])
        .slice(0, 10)
        .filter((m: any) => typeof m?.id === 'number' && m?.name);

      const actorIds: number[] = [personId];
      for (const m of cast) actorIds.push(m.id);

      // nodes for co-actors
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

      // co-actor pair weights
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
        width: Math.min(10, 1.2 + w * 1.1),
        color: { color: '#a78bfa', opacity: 0.35 },
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

    const datasetNodes = nodes.map((n) => ({
      id: n.id,
      label: n.label,
      color: n.color,
      shape: n.shape,
      group: n.group,
      title: n.title ?? n.label,
    }));

    const datasetEdges = edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      value: e.value,
      width: e.width,
      color: e.color,
      title: e.title,
    }));

    const options: any = {
      autoResize: true,
      physics: {
        enabled: true,
        stabilization: { iterations: 150 },
        solver: 'barnesHut',
        barnesHut: { springLength: 120, springConstant: 0.03, gravitationalConstant: -2500 },
      },
      interaction: {
        hover: true,
        multiselect: false,
      },
      nodes: {
        font: { color: '#fff', size: 14, face: 'Arial' },
      },
      edges: {
        arrows: { to: { enabled: false } },
        shadow: false,
      },
      layout: {
        improvedLayout: true,
      },
    };

    const net = new Network(containerRef.current, { nodes: datasetNodes, edges: datasetEdges }, options);
    networkRef.current = net;

    net.on('click', (params: any) => {
      const nodeId = params?.nodes?.[0];
      if (!nodeId) return;
      const found = nodes.find((n) => n.id === nodeId);
      if (found) {
        setInspector(found);
        // subtle: re-enable physics stabilization by focusing
        try {
          net.focus(nodeId, { scale: 1.1, animation: { duration: 350, easingFunction: 'easeInOutQuad' } });
        } catch {
          // ignore
        }
      }
    });

    net.on('stabilizationIterationsDone', () => {
      // nothing
    });
  }

  async function buildGraphForPerson(p: TMDBPerson) {
    setError(null);
    setInspector(null);
    setLoading(true);

    try {
      const graph = kind === 'director' ? await fetchDirectorGraph(p.id) : await fetchActorGraph(p.id);

      const cappedNodes = graph.nodes.slice(0, maxNodes);
      renderGraph(cappedNodes, graph.edges);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to build graph');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => destroyNetwork();
  }, []);

  // Initial graph: based on default query
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setError(null);
      setLoading(true);
      try {
        const results = await searchPerson(query);
        const pick = results[0] ?? null;
        if (!pick || cancelled) return;
        setSelectedPerson(pick);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        buildGraphForPerson(pick);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to init graph');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmitSearch() {
    setLoading(true);
    setError(null);
    try {
      const results = await searchPerson(query);
      const pick = results[0] ?? null;
      if (!pick) {
        setError('No person found for that query. Try a different name.');
        return;
      }
      setSelectedPerson(pick);
      await buildGraphForPerson(pick);
    } catch (e: any) {
      setError(e?.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function parseNodeClickToLink(node: GraphNode | null) {
    if (!node) return null;
    if (node.id.startsWith('title:')) {
      const [, mediaType, idStr] = node.id.split(':');
      const idNum = Number(idStr);
      if (!Number.isNaN(idNum)) {
        if (mediaType === 'movie') return `/movie/${idNum}`;
        if (mediaType === 'tv') return `/tv/${idNum}`;
      }
    }
    if (node.id.startsWith('person:')) {
      const idNum = Number(node.id.split(':')[1]);
      if (!Number.isNaN(idNum)) return `/actor/${idNum}`;
    }
    return null;
  }

  const inspectorLink = useMemo(() => parseNodeClickToLink(inspector), [inspector]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 via-zinc-950 to-black pointer-events-none" />
        <div className="absolute top-[-80px] right-[-80px] w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-120px] left-[-120px] w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative container mx-auto px-4 pt-10 pb-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 backdrop-blur-xl">
                  <Film className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Director’s Cut</h1>
                  <p className="text-zinc-400 text-sm md:text-base mt-1">Interactive lineage map: click nodes to trace collaborations.</p>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[420px]">
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 md:p-6 shadow-xl">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-semibold text-white/90">Deck Controls</span>
                  </div>
                  {loading && (
                    <span className="text-xs text-zinc-400 inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Building…
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-zinc-400">Target</label>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 transition-all duration-300 text-sm"
                        placeholder="Type a director or actor name…"
                      />
                      {query && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
                          onClick={() => setQuery('')}
                          aria-label="Clear"
                        >
                          <X className="w-4 h-4 text-zinc-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setKind('director')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold border transition-all duration-300 ${
                        kind === 'director'
                          ? 'bg-red-500/15 border-red-500/30 text-red-400'
                          : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.07]'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Director
                    </button>
                    <button
                      onClick={() => setKind('actor')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold border transition-all duration-300 ${
                        kind === 'actor'
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                          : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.07]'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Actor
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400">Depth</label>
                      <input
                        type="range"
                        min={1}
                        max={4}
                        value={depth}
                        onChange={(e) => setDepth(Number(e.target.value))}
                        className="w-full accent-red-500"
                      />
                      <div className="mt-1 text-xs text-zinc-400">{depth}</div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">Max nodes</label>
                      <input
                        type="range"
                        min={25}
                        max={80}
                        value={maxNodes}
                        onChange={(e) => setMaxNodes(Number(e.target.value))}
                        className="w-full accent-red-500"
                      />
                      <div className="mt-1 text-xs text-zinc-400">{maxNodes}</div>
                    </div>
                  </div>

                  <button
                    onClick={onSubmitSearch}
                    disabled={loading || !query.trim()}
                    className="w-full mt-1 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm tracking-wide rounded-2xl shadow-xl shadow-red-500/20 border border-red-400/30 backdrop-blur-xl transition-all duration-300 hover:from-red-500 hover:to-red-400 hover:scale-[1.02] hover:shadow-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5"
                  >
                    Build Lineage
                  </button>

                  {error && (
                    <div className="mt-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-200 text-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <div>{error}</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-2">
                    <div className="text-xs text-zinc-400 mb-2">Genre colors (titles)</div>
                    <div className="flex flex-wrap gap-2">
                      {getColorLegend.map((c) => (
                        <span key={c} className="w-4 h-4 rounded-full border border-white/10" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-4 md:p-5 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-zinc-200">Lineage Canvas</span>
                </div>
                {selectedPerson && (
                  <div className="text-xs text-zinc-400">
                    Showing: <span className="text-zinc-200 font-semibold">{selectedPerson.name}</span>
                  </div>
                )}
              </div>

              <div
                ref={containerRef}
                className="w-full h-[62vh] rounded-2xl border border-white/10 bg-black/20"
              />

              <div className="mt-3 text-xs text-zinc-500">
                Tip: click any node to zoom + inspect. Edges represent repeated collaborations (weighted).
              </div>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-4 md:p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-2xl bg-white/[0.06] border border-white/[0.10] flex items-center justify-center">
                  <Info className="w-4 h-4 text-zinc-200" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Inspector</div>
                  <div className="text-xs text-zinc-500">Click a node</div>
                </div>
              </div>

              {!inspector ? (
                <div className="mt-6 text-sm text-zinc-400">
                  <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Waiting for selection…
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className="rounded-2xl border border-white/[0.10] bg-black/20 p-3"
                    style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-bold text-sm truncate">{inspector.label}</div>
                        <div className="text-zinc-400 text-xs mt-1 break-words">
                          {inspector.title ? inspector.title : inspector.id}
                        </div>
                      </div>
                    </div>
                  </div>

                  {inspectorLink && (
                    <button
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 border border-red-400/30 text-white font-bold text-sm hover:from-red-500 hover:to-red-400 transition-all duration-300"
                      onClick={() => navigate(inspectorLink)}
                    >
                      Open Details <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  <div className="text-xs text-zinc-500 leading-relaxed">
                    This deck blends director/actor filmography with collaboration paths. Increase depth for bigger graphs; reduce max nodes for speed.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

