import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { motion } from 'framer-motion';
import { Flame, Brain, Clock, Users, Activity, Film, Tv } from 'lucide-react';
import axios from 'axios';

const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";

interface HistoryItem {
  id: string;
  title: string;
  mediaType: string;
  genres: string[];
  watchedDate: string;
}

interface BingeWatchStatsProps {
  history: HistoryItem[];
}

const THEME_COLORS = {
  blue: { main: '#3b82f6', glow: 'rgba(59,130,246,0.15)', grad: ['#2563eb', '#60a5fa'] },
  purple: { main: '#a855f7', glow: 'rgba(168,85,247,0.15)', grad: ['#7c3aed', '#c084fc'] },
  emerald: { main: '#10b981', glow: 'rgba(16,185,129,0.15)', grad: ['#059669', '#34d399'] },
  pink: { main: '#ec4899', glow: 'rgba(236,72,153,0.15)', grad: ['#db2777', '#f472b6'] },
};

const BINGE_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  })
};

const BingeWatchStats: React.FC<BingeWatchStatsProps> = ({ history }) => {
  const [details, setDetails] = useState<Record<string, { runtime: number; director?: string }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchExtraDetails = async () => {
      const movieItems = history.filter(item => item.mediaType === 'movie' && !details[item.id]).slice(0, 15);
      const tvItems = history.filter(item => item.mediaType === 'tv' && !details[item.id]).slice(0, 10);
      
      const itemsToFetch = [...movieItems, ...tvItems];
      if (itemsToFetch.length === 0) return;

      setLoading(true);
      const newDetails = { ...details };

      await Promise.all(itemsToFetch.map(async (item) => {
        try {
          const res = await axios.get(`https://api.themoviedb.org/3/${item.mediaType}/${item.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
          const runtime = item.mediaType === 'movie' ? (res.data.runtime || 100) : (res.data.episode_run_time?.[0] || 45);
          const director = res.data.credits?.crew?.find((c: any) => c.job === 'Director')?.name;
          newDetails[item.id] = { runtime, director };
        } catch (error) {
          newDetails[item.id] = { runtime: item.mediaType === 'movie' ? 100 : 45 };
        }
      }));

      setDetails(newDetails);
      setLoading(false);
    };

    if (history.length > 0) {
      fetchExtraDetails();
    }
  }, [history]);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const genreCounts: Record<string, number> = {};
    let movieMins = 0;
    let tvMins = 0;
    const directorCounts: Record<string, number> = {};

    history.forEach(item => {
      const watchedDate = new Date(item.watchedDate);
      
      if (watchedDate >= thirtyDaysAgo) {
        item.genres.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }

      const runtime = details[item.id]?.runtime || (item.mediaType === 'movie' ? 100 : 45);
      if (item.mediaType === 'movie') movieMins += runtime;
      else tvMins += runtime;

      const director = details[item.id]?.director;
      if (director) {
        directorCounts[director] = (directorCounts[director] || 0) + 1;
      }
    });

    return {
      genres: Object.entries(genreCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      time: [
        { name: 'Movies', value: Math.round(movieMins / 60) },
        { name: 'Series', value: Math.round(tvMins / 60) }
      ].filter(d => d.value > 0),
      directors: Object.entries(directorCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      totalHours: Math.round((movieMins + tvMins) / 60)
    };
  }, [history, details]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-950/95 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.8)] min-w-[120px]">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{payload[0].name}</p>
          <p className="text-sm font-black text-white">
            {payload[0].value} {payload[0].name === 'Movies' || payload[0].name === 'Series' ? 'Hours' : 'Titles'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 py-6 max-w-7xl mx-auto px-1 select-none font-sans bg-black text-white">
      
      {/* ── Header Platform Module ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-b from-neutral-900/60 to-neutral-950/20 border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <Flame className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">Binge Analytics</h2>
            <p className="text-neutral-500 text-xs tracking-wide">Algorithmic ingestion of your runtime metrics</p>
          </div>
        </div>

        {/* Global Key-Value Metas */}
        <div className="grid grid-cols-3 gap-2 w-full lg:w-auto md:min-w-[420px]">
          <div className="p-3 bg-neutral-900/40 border border-white/5 rounded-xl text-center md:text-left">
            <div className="flex items-center gap-1.5 justify-center md:justify-start mb-1 text-neutral-500">
              <Clock className="w-3 h-3" />
              <span className="text-[9px] uppercase font-bold tracking-widest">Screen Time</span>
            </div>
            <p className="text-lg font-black text-blue-400">{stats.totalHours}<span className="text-xs font-normal text-neutral-500 ml-0.5">h</span></p>
          </div>
          
          <div className="p-3 bg-neutral-900/40 border border-white/5 rounded-xl text-center md:text-left">
            <div className="flex items-center gap-1.5 justify-center md:justify-start mb-1 text-neutral-500">
              <Activity className="w-3 h-3" />
              <span className="text-[9px] uppercase font-bold tracking-widest">Total Logs</span>
            </div>
            <p className="text-lg font-black text-purple-400">{history.length}</p>
          </div>

          <div className="p-3 bg-neutral-900/40 border border-white/5 rounded-xl text-center md:text-left">
            <div className="flex items-center gap-1.5 justify-center md:justify-start mb-1 text-neutral-500">
              <Film className="w-3 h-3" />
              <span className="text-[9px] uppercase font-bold tracking-widest">Live State</span>
            </div>
            <span className="inline-flex items-center gap-2 text-[11px] font-bold text-amber-400 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
               Synced
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Grids ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Module 01: Top Genres */}
        <motion.div
          custom={0} variants={BINGE_VARIANTS} initial="hidden" animate="visible"
          className="bg-neutral-900/30 border border-white/5 rounded-2xl p-5 hover:border-blue-500/20 transition-all duration-300 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Brain className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <h3 className="text-xs font-black text-neutral-300 uppercase tracking-widest">Genre DNA (30d)</h3>
            </div>
            {loading && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.genres} layout="vertical" margin={{ left: -15, right: 10 }}>
                <defs>
                  <linearGradient id="blueGlowGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={THEME_COLORS.blue.grad[0]} stopOpacity={1} />
                    <stop offset="100%" stopColor={THEME_COLORS.blue.grad[1]} stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={85}
                  tick={{ fill: '#a3a3a3', fontSize: 10, fontWeight: 700 }} 
                />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} content={<CustomTooltip />} />
                <Bar 
                  dataKey="value" 
                  fill="url(#blueGlowGrad)" 
                  radius={[0, 4, 4, 0]} 
                  barSize={14}
                  stroke={THEME_COLORS.blue.main}
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Module 02: Time Allocation Split */}
        <motion.div
          custom={1} variants={BINGE_VARIANTS} initial="hidden" animate="visible"
          className="bg-neutral-900/30 border border-white/5 rounded-2xl p-5 hover:border-purple-500/20 transition-all duration-300 relative overflow-hidden"
        >
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <h3 className="text-xs font-black text-neutral-300 uppercase tracking-widest">Allocation Matrix</h3>
          </div>

          <div className="h-[220px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="moviesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THEME_COLORS.blue.grad[0]} />
                    <stop offset="100%" stopColor={THEME_COLORS.blue.grad[1]} />
                  </linearGradient>
                  <linearGradient id="seriesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={THEME_COLORS.purple.grad[0]} />
                    <stop offset="100%" stopColor={THEME_COLORS.purple.grad[1]} />
                  </linearGradient>
                </defs>
                <Pie
                  data={stats.time}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={76}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                  animationDuration={600}
                >
                  {stats.time.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Movies' ? 'url(#moviesGrad)' : 'url(#seriesGrad)'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Middle Absolute Details Panel */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <div className="flex items-center gap-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
                <span className="flex items-center gap-1"><Film className="w-2.5 h-2.5 text-blue-500" /> MV</span>
                <span className="text-neutral-700">|</span>
                <span className="flex items-center gap-1"><Tv className="w-2.5 h-2.5 text-purple-500" /> TV</span>
              </div>
              <p className="text-lg font-black text-white tracking-tighter">Distribution</p>
            </div>
          </div>
        </motion.div>

        {/* Module 03: Favorite Directors */}
        <motion.div
          custom={2} variants={BINGE_VARIANTS} initial="hidden" animate="visible"
          className="bg-neutral-900/30 border border-white/5 rounded-2xl p-5 hover:border-emerald-500/20 transition-all duration-300 relative overflow-hidden md:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <h3 className="text-xs font-black text-neutral-300 uppercase tracking-widest">Auteur Fingerprint</h3>
          </div>

          <div className="h-[220px] w-full">
            {stats.directors.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="68%" data={stats.directors}>
                  <PolarGrid stroke="rgba(255,255,255,0.04)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#a3a3a3', fontSize: 9, fontWeight: 700 }} />
                  <Radar
                    name="Auteur Logs"
                    dataKey="value"
                    stroke={THEME_COLORS.emerald.main}
                    strokeWidth={1.5}
                    fill={`url(#emGrad)`}
                    fillOpacity={0.25}
                    dot={{ r: 3, fill: THEME_COLORS.emerald.main, strokeWidth: 1 }}
                  />
                  <defs>
                    <linearGradient id="emGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={THEME_COLORS.emerald.grad[0]} />
                      <stop offset="100%" stopColor={THEME_COLORS.emerald.grad[1]} />
                    </linearGradient>
                  </defs>
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center mb-3 border border-white/5 shadow-inner">
                  <Users className="w-5 h-5 text-neutral-600" />
                </div>
                <p className="text-neutral-500 text-xs max-w-[200px] leading-relaxed font-medium">
                  Gather deeper catalog data to generate auteur radar profiles.
                </p>
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default BingeWatchStats;