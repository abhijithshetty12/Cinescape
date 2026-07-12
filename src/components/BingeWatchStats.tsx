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

const GENRE_COLORS = [
  { main: '#3b82f6', grad: ['#2563eb', '#60a5fa'] },
  { main: '#a855f7', grad: ['#7c3aed', '#c084fc'] },
  { main: '#10b981', grad: ['#059669', '#34d399'] },
  { main: '#f59e0b', grad: ['#d97706', '#fbbf24'] },
  { main: '#ec4899', grad: ['#db2777', '#f472b6'] },
];

const THEME_COLORS = {
  blue: { main: '#3b82f6', grad: ['#2563eb', '#60a5fa'] },
  purple: { main: '#a855f7', grad: ['#7c3aed', '#c084fc'] },
  emerald: { main: '#10b981', grad: ['#059669', '#34d399'] },
};

const BINGE_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }
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
    let movieCount = 0;
    let tvCount = 0;
    const directorCounts: Record<string, number> = {};

    history.forEach(item => {
      const watchedDate = new Date(item.watchedDate);

      if (watchedDate >= thirtyDaysAgo) {
        item.genres.forEach(genre => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }

      const runtime = details[item.id]?.runtime || (item.mediaType === 'movie' ? 100 : 45);
      if (item.mediaType === 'movie') {
        movieMins += runtime;
        movieCount++;
      } else {
        tvMins += runtime;
        tvCount++;
      }

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
        { name: 'Movies', value: Math.round(movieMins / 60), titles: movieCount },
        { name: 'Series', value: Math.round(tvMins / 60), titles: tvCount }
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
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950/90 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl shadow-2xl min-w-[120px]">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">{payload[0].name}</p>
          <p className="text-xs font-bold text-white">
            {payload[0].value} {payload[0].name === 'Movies' || payload[0].name === 'Series' ? 'Hours' : 'Titles'}
          </p>
          {data?.titles !== undefined && (
            <p className="text-[10px] font-medium text-zinc-400 mt-0.5">
              {data.titles} {data.titles === 1 ? 'Title' : 'Titles'} logged
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const renderCustomPolarAngleAxis = ({ payload, x, y, cx, cy, ...rest }: any) => {
    const formattedName = payload.value.length > 12 ? `${payload.value.substring(0, 10)}...` : payload.value;
    return (
      <text
        {...rest}
        x={x}
        y={y}
        cx={cx}
        cy={cy}
        className="fill-zinc-300 text-[10px] font-medium"
        textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'}
      >
        {formattedName}
      </text>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 py-2 sm:py-4 max-w-7xl mx-auto px-2 sm:px-4 select-none font-sans text-white">

      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-6 backdrop-blur-xl shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl shadow-lg shadow-red-500/30">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-current animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white">Binge Analytics</h2>
              <p className="text-zinc-400 text-xs sm:text-sm font-normal">Personalized watch habits & runtime stats</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:min-w-[360px]">
            <div className="p-2.5 sm:p-3 bg-white/[0.03] border border-white/10 rounded-xl text-center md:text-left backdrop-blur-md">
              <div className="flex items-center gap-1.5 justify-center md:justify-start mb-0.5 text-zinc-400">
                <Clock className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] sm:text-[10px] uppercase font-semibold tracking-wider">Screen Time</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-blue-400">{stats.totalHours}<span className="text-xs font-medium text-zinc-500 ml-0.5">h</span></p>
            </div>

            <div className="p-2.5 sm:p-3 bg-white/[0.03] border border-white/10 rounded-xl text-center md:text-left backdrop-blur-md">
              <div className="flex items-center gap-1.5 justify-center md:justify-start mb-0.5 text-zinc-400">
                <Activity className="w-3 h-3 text-purple-400" />
                <span className="text-[9px] sm:text-[10px] uppercase font-semibold tracking-wider">Total Logs</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-purple-400">{history.length}</p>
            </div>

            <div className="p-2.5 sm:p-3 bg-white/[0.03] border border-white/10 rounded-xl text-center md:text-left backdrop-blur-md">
              <div className="flex items-center gap-1.5 justify-center md:justify-start mb-0.5 text-zinc-400">
                <Film className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] sm:text-[10px] uppercase font-semibold tracking-wider">Live State</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 mt-1 justify-center md:justify-start">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Synced
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">

        <motion.div
          custom={0}
          variants={BINGE_VARIANTS}
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-950/60 p-3 backdrop-blur-xl shadow-lg hover:border-blue-500/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-semibold tracking-tight text-white/90">
                Favorite Genres
              </h3>
            </div>
            {loading && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            )}
          </div>

          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.genres}
                layout="vertical"
                margin={{ left: -25, right: 10, top: 0, bottom: 0 }}
              >
                <defs>
                  {GENRE_COLORS.map((color, idx) => (
                    <linearGradient
                      key={`genre-grad-${idx}`}
                      id={`genreGrad-${idx}`}
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor={color.grad[0]} stopOpacity={1} />
                      <stop offset="100%" stopColor={color.grad[1]} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  width={75}
                  tick={{ fill: "#e4e4e7", fontSize: 10, fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={8}>
                  {stats.genres.map((entry, index) => (
                    <Cell
                      key={`genre-cell-${index}`}
                      fill={`url(#genreGrad-${index % GENRE_COLORS.length})`}
                      stroke={GENRE_COLORS[index % GENRE_COLORS.length].main}
                      strokeWidth={1}
                      style={{
                        filter: `drop-shadow(0px 0px 6px ${GENRE_COLORS[index % GENRE_COLORS.length].main
                          }80)`,
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          custom={1} variants={BINGE_VARIANTS} initial="hidden" animate="visible"
          className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-zinc-950/60 p-4 backdrop-blur-xl shadow-xl hover:border-purple-500/30 transition-all duration-300"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white/90">Allocation Matrix</h3>
          </div>

          <div className="h-[150px] sm:h-[160px] w-full flex items-center justify-center relative">
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
                  innerRadius={48}
                  outerRadius={62}
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

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-sm font-bold text-white tracking-tight">Distribution</p>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-center">
            {stats.time.map((item) => (
              <div key={item.name} className="p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400">
                  {item.name === 'Movies' ? <Film className="w-2.5 h-2.5 text-blue-400" /> : <Tv className="w-2.5 h-2.5 text-purple-400" />}
                  <span>{item.name}</span>
                </div>
                <p className="text-xs font-bold text-white mt-0.5">{item.value}h <span className="text-[10px] font-normal text-zinc-500">({item.titles} titles)</span></p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          custom={2} variants={BINGE_VARIANTS} initial="hidden" animate="visible"
          className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-zinc-950/60 p-4 backdrop-blur-xl shadow-xl hover:border-emerald-500/30 transition-all duration-300 md:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white/90">Top Directors</h3>
          </div>

          <div className="h-[200px] sm:h-[220px] w-full">
            {stats.directors.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="68%" data={stats.directors}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#d4d4d8', fontSize: 10, fontWeight: 500 }} />
                  <Radar
                    name="Director Logs"
                    dataKey="value"
                    stroke={THEME_COLORS.emerald.main}
                    strokeWidth={1.5}
                    fill={`url(#emGrad)`}
                    fillOpacity={0.3}
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
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-6 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2 text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-zinc-300">Not enough director data</p>
                <p className="text-[10px] text-zinc-500 max-w-[180px] mt-0.5">
                  Watch more movies to unlock your favorite directors profile.
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