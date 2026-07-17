import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Star, Compass } from 'lucide-react';
import axios from 'axios';
import { RatedMovie } from './Recommendation.tsx';

const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";

interface HistoryItem {
  id: string;
  title: string;
  mediaType: string;
  genres: string[];
  watchedDate: string;
  userRating?: number;
}

interface BingeWatchStatsProps {
  history: HistoryItem[];
  ratedMovies: RatedMovie[];
}

const THEME_GRADIENTS = [
  'from-indigo-500 via-purple-500 to-pink-500',
  'from-cyan-500 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-500',
  'from-rose-500 to-pink-600'
];

const BingeWatchStats: React.FC<BingeWatchStatsProps> = ({ history, ratedMovies }) => {
  const [details, setDetails] = useState<Record<string, { runtime: number; director?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'genres' | 'directors'>('overview');

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
    const genreCounts: Record<string, { count: number; hours: number }> = {};
    let movieMins = 0;
    let tvMins = 0;
    let movieCount = 0;
    let tvCount = 0;
    const directorCounts: Record<string, number> = {};
    const monthlyCounts: Record<string, number> = {};

    history.forEach(item => {
      const runtime = details[item.id]?.runtime || (item.mediaType === 'movie' ? 100 : 45);
      const runtimeHours = runtime / 60;

      if (item.mediaType === 'movie') {
        movieMins += runtime;
        movieCount++;
      } else {
        tvMins += runtime;
        tvCount++;
      }

      item.genres.forEach(genre => {
        if (!genreCounts[genre]) {
          genreCounts[genre] = { count: 0, hours: 0 };
        }
        genreCounts[genre].count += 1;
        genreCounts[genre].hours += runtimeHours;
      });

      const director = details[item.id]?.director;
      if (director) {
        directorCounts[director] = (directorCounts[director] || 0) + 1;
      }

      const date = new Date(item.watchedDate);
      if (!isNaN(date.getTime())) {
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
        monthlyCounts[monthLabel] = (monthlyCounts[monthLabel] || 0) + 1;
      }
    });

    const monthlyData = Object.entries(monthlyCounts)
      .map(([month, count]) => ({ month, count }))
      .slice(-6);

    return {
      genres: Object.entries(genreCounts)
        .map(([name, data]) => ({
          name,
          value: Math.round(data.hours),
          titles: data.count
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      moviesHours: Math.round(movieMins / 60),
      tvHours: Math.round(tvMins / 60),
      movieCount,
      tvCount,
      directors: Object.entries(directorCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      totalHours: Math.round((movieMins + tvMins) / 60),
      monthlyData
    };
  }, [history, details]);

  const topGenre = stats.genres[0]?.name || "Explorer";

  const computedRatingData = useMemo(() => {
    const groups = { "1-2": 0, "3-4": 0, "5-6": 0, "7-8": 0, "9-10": 0 };
    ratedMovies?.forEach((m) => {
      const score = Math.round(m.rating);
      if (score >= 1 && score <= 2) groups["1-2"]++;
      else if (score >= 3 && score <= 4) groups["3-4"]++;
      else if (score >= 5 && score <= 6) groups["5-6"]++;
      else if (score >= 7 && score <= 8) groups["7-8"]++;
      else if (score >= 9 && score <= 10) groups["9-10"]++;
    });
    return Object.entries(groups).map(([range, count]) => ({ range, count }));
  }, [ratedMovies]);

  const totalFormatHours = stats.moviesHours + stats.tvHours;
  const moviePercent = totalFormatHours > 0 ? Math.round((stats.moviesHours / totalFormatHours) * 100) : 0;
  const tvPercent = totalFormatHours > 0 ? Math.round((stats.tvHours / totalFormatHours) * 100) : 0;

  return (
    <div className="font-sans antialiased text-zinc-200 p-4 max-w-6xl mx-auto space-y-8 select-none">
      <div className="relative flex flex-col gap-6 sm:gap-8 pb-8 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                The Watch <span className="text-zinc-400 font-light">Manifest</span>
              </h1>
              <div className="flex items-center gap-2 mt-2 bg-zinc-900/40 border border-zinc-800/40 px-2 py-1 rounded-md w-fit">
                <div className="flex items-end gap-0.5 shrink-0 h-3.5 mb-[1px]">
                  <span className="w-[2px] h-1.5 bg-zinc-700 rounded-full" />
                  <span className="w-[2px] h-2.5 bg-zinc-500 rounded-full" />
                  <span className="w-[2px] h-3.5 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-[pulse_1.5s_infinite_ease-in-out]" />
                </div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                  Data Feed Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 px-5 py-3 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl sm:self-auto self-start shadow-inner shadow-indigo-500/[0.03]">
            <div className="text-left">
              <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Aggregate Time</p>
              <p className="text-lg font-black text-indigo-400 mt-0.5">
                {stats.totalHours}<span className="text-xs font-normal text-zinc-500 ml-0.5">hrs</span>
              </p>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="text-left">
              <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Frequency</p>
              <p className="text-lg font-black text-indigo-400 mt-0.5">
                {history.length}<span className="text-xs font-normal text-zinc-500 ml-0.5">logs</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-2">
          <p className="md:col-span-7 text-zinc-400 text-sm leading-relaxed max-w-xl">
            A clear summary of what you watch, how much time you spend, and your personal viewing patterns.
          </p>
          <div className="md:col-span-5 relative flex items-center justify-between p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent group-hover:via-amber-400/40 transition-all duration-500" />

            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-amber-400 group-hover:border-amber-500/30 transition-all duration-300 shrink-0">
                <Compass className="w-4 h-4 transition-transform duration-700 group-hover:rotate-180" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase flex items-center gap-1">
                  Taste Preference <span className="text-amber-500/40">•</span> Alpha
                </span>
                <span className="text-sm font-black tracking-tight text-white mt-0.5">
                  {topGenre}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-extrabold bg-gradient-to-b from-amber-400 to-orange-500 text-black px-2.5 py-1 rounded-md shadow-lg shadow-amber-500/10 uppercase tracking-wider">
              Core
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Volume Allocation</p>

            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="text-6xl font-black text-white tracking-tighter">{stats.totalHours}</span>
              <span className="text-zinc-500 font-mono text-xs uppercase tracking-wider">Aggregate Hours</span>
            </div>

            <div className="w-full h-7 rounded-lg bg-zinc-800 overflow-hidden flex p-0.5 border border-zinc-700/30">
              {moviePercent > 0 && (
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${moviePercent}%` }} transition={{ duration: 0.8 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-l-md flex items-center justify-end pr-2 text-[10px] font-bold text-black"
                >
                  {moviePercent >= 15 && `${moviePercent}%`}
                </motion.div>
              )}
              {tvPercent > 0 && (
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${tvPercent}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-r-md flex items-center justify-start pl-2 text-[10px] font-bold text-white"
                >
                  {tvPercent >= 15 && `${tvPercent}%`}
                </motion.div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-zinc-800/60">
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 mt-1" />
                <div>
                  <h4 className="text-sm font-bold text-white">{stats.moviesHours}h <span className="text-xs text-zinc-500 font-normal">({stats.movieCount} films)</span></h4>
                  <p className="text-xs text-zinc-400 font-medium">Feature Length Projections</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-1" />
                <div>
                  <h4 className="text-sm font-bold text-white">{stats.tvHours}h <span className="text-xs text-zinc-500 font-normal">({stats.tvCount} shows)</span></h4>
                  <p className="text-xs text-zinc-400 font-medium">Serialized Content Units</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-3xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
              <div className="flex gap-4">
                {(['overview', 'genres', 'directors'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs font-mono tracking-wider uppercase pb-1 relative transition-colors ${activeTab === tab ? 'text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {tab}
                    {activeTab === tab && <motion.div layoutId="activeTabUnderline" className="absolute left-0 bottom-0 right-0 h-[2px] bg-indigo-400" />}
                  </button>
                ))}
              </div>
              {loading && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />}
            </div>

            <div className="min-h-[190px]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-4">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Your historical timeline maps <span className="text-white font-semibold">{history.length} active sessions</span>. Activity is pacing with steady retention. Let's analyze the month-by-month session densities.
                    </p>
                    <div className="h-[120px] w-full mt-2">
                      {stats.monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={stats.monthlyData}
                            margin={{ top: 10, left: 0, right: 0, bottom: 0 }}
                          >
                            <XAxis
                              dataKey="month"
                              tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
                              axisLine={false}
                              tickLine={false}
                              dy={4}
                            />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip
                              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-zinc-950 px-2.5 py-1 border border-zinc-800 rounded-md text-[11px] font-mono text-white shadow-xl">
                                      {payload[0].value} logs
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="count" fill="#4338ca" radius={[4, 4, 0, 0]} barSize={14} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-zinc-600 font-mono">Insufficient index points</div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'genres' && (
                  <motion.div key="genres" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-3">
                    {stats.genres.map((item, idx) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-zinc-300 font-bold">{item.name}</span>
                          <span className="text-zinc-500 font-mono">{item.value} hrs / {item.titles} logs</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800/60 rounded-full overflow-hidden">
                          <motion.div
                            key={item.name}
                            initial={{ width: 0 }} animate={{ width: `${Math.min(100, (item.value / (stats.totalHours || 1)) * 100)}%` }}
                            className={`h-full bg-gradient-to-r ${THEME_GRADIENTS[idx % THEME_GRADIENTS.length]}`}
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeTab === 'directors' && (
                  <motion.div
                    key="directors"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="h-[195px] w-full flex items-center justify-center"
                  >
                    {stats.directors.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="68%" data={stats.directors}>
                          <PolarGrid stroke="#27272a" strokeWidth={1} />
                          <PolarAngleAxis
                            dataKey="name"
                            tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 500 }}
                          />
                          <Tooltip content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-zinc-950 px-3 py-2 border border-zinc-800 rounded-xl shadow-xl flex flex-col text-left">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">DIRECTOR LOGS</span>
                                  <span className="text-sm font-extrabold text-white mt-0.5">{payload[0].value} Titles</span>
                                </div>
                              );
                            }
                            return null;
                          }} />
                          <Radar
                            name="Directors"
                            dataKey="value"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.12}
                            dot={{ r: 3, fill: '#10b981', strokeWidth: 1 }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-zinc-600 font-mono">
                        Awaiting director metadata tracking
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Taste Profile</p>
                <h3 className="text-lg font-bold text-white mt-0.5">Rating Metrics</h3>
              </div>
              {ratedMovies.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-current" /> {((ratedMovies.reduce((sum, m) => sum + m.rating, 0)) / ratedMovies.length).toFixed(1)} Avg
                </div>
              )}
            </div>

            <div className="h-[140px] w-full">
              {ratedMovies && ratedMovies.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={computedRatingData} margin={{ top: 20, right: 0, left: -35, bottom: 0 }}>
                    <XAxis dataKey="range" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Bar dataKey="count" fill="url(#critiqueGrad)" radius={[4, 4, 0, 0]} barSize={34}>
                      <LabelList dataKey="count" position="top" offset={6} style={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }} />
                    </Bar>
                    <defs>
                      <linearGradient id="critiqueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#be123c" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40">
                  <span className="text-xs font-medium text-zinc-500">Evaluation index currently unassigned</span>
                  <span className="text-[10px] text-zinc-600 max-w-[180px] mt-1">Assign star values within user console to build vectors.</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">Milestones Unlocked</p>

            <div className="space-y-2">
              {[
                { label: 'Cinemaphile', target: '10+ Feature Films', current: stats.movieCount, max: 10, color: 'from-blue-500 to-cyan-500' },
                { label: 'Marathoner', target: '50+ Hours Registered', current: stats.totalHours, max: 50, color: 'from-purple-500 to-pink-500' },
                { label: 'Elite Critic', target: '5+ Distinct Ratings', current: ratedMovies?.length ?? 0, max: 5, color: 'from-amber-400 to-orange-500' }
              ].map((milestone) => {
                const isPassed = milestone.current >= milestone.max;
                return (
                  <div key={milestone.label} className={`p-3.5 rounded-2xl border transition-all ${isPassed ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-950/20 border-zinc-900/60 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <h4 className={`text-xs font-bold ${isPassed ? 'text-white' : 'text-zinc-500'}`}>{milestone.label}</h4>
                        <p className="text-[10px] text-zinc-500 font-medium">{milestone.target}</p>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/40 px-2 py-0.5 rounded-md">
                        {milestone.current}/{milestone.max}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${milestone.color}`}
                        style={{ width: `${Math.min(100, (milestone.current / milestone.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BingeWatchStats;