import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { motion } from 'framer-motion';
import { Flame, Brain, Clock, Users } from 'lucide-react';
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

const COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444'  // red
];

const BingeWatchStats: React.FC<BingeWatchStatsProps> = ({ history }) => {
  const [details, setDetails] = useState<Record<string, { runtime: number; director?: string }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchExtraDetails = async () => {
      // Fetch only for movies to get directors and exact runtimes
      const movieItems = history.filter(item => item.mediaType === 'movie' && !details[item.id]).slice(0, 15);
      // For TV shows, we can just use defaults or fetch if needed, but movies are better for director stats
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

  // Analytics Processing
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const genreCounts: Record<string, number> = {};
    let movieMins = 0;
    let tvMins = 0;
    const directorCounts: Record<string, number> = {};

    history.forEach(item => {
      const watchedDate = new Date(item.watchedDate);
      
      // 1. Genres (30 days)
      if (watchedDate >= thirtyDaysAgo) {
        item.genres.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }

      // 2. Time
      const runtime = details[item.id]?.runtime || (item.mediaType === 'movie' ? 100 : 45);
      if (item.mediaType === 'movie') movieMins += runtime;
      else tvMins += runtime;

      // 3. Directors
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
        <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-tighter mb-1">{payload[0].name}</p>
          <p className="text-sm font-bold text-white">
            {payload[0].value} {payload[0].name === 'Movies' || payload[0].name === 'Series' ? 'Hours' : 'Items'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 sm:gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
            <Flame className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Binge Insights</h2>
            <p className="text-zinc-500 text-sm">Your cinematic habits visualized</p>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 px-4 sm:px-6 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
          <div className="text-center sm:text-left">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Total Time</p>
            <p className="text-lg sm:text-xl font-black text-blue-400">{stats.totalHours}h</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center sm:text-left">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Titles Watched</p>
            <p className="text-lg sm:text-xl font-black text-purple-400">{history.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Genre Bar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-blue-500/30 transition-all duration-500"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Brain className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Top Genres (30d)</h3>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.genres} layout="vertical" margin={{ left: 10, right: 30 }}>
                <defs>
                  <linearGradient id="barGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={90}
                  tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }} 
                />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                <Bar 
                  dataKey="value" 
                  fill="url(#barGlow)" 
                  radius={[0, 10, 10, 0]} 
                  barSize={18}
                  stroke="#3b82f6"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Binge Time Pie */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative group bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-purple-500/30 transition-all duration-500"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Time Allocation</h3>
          </div>
          <div className="h-[220px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.time}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  animationBegin={200}
                >
                  {stats.time.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Movies/TV</p>
              <p className="text-lg font-black text-white">Split</p>
            </div>
          </div>
        </motion.div>

        {/* Favorite Directors Radar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative group bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-emerald-500/30 transition-all duration-500"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Favorite Directors</h3>
          </div>
          <div className="h-[220px] w-full">
            {stats.directors.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats.directors}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 8, fontWeight: 700 }} />
                  <Radar
                    name="Films"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="#10b981"
                    fillOpacity={0.4}
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4 border border-white/5">
                  <Users className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Watch more movies to see your favorite directors' breakdown.
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
