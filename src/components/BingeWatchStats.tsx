import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CalendarDays, CalendarRange, Clock3, Compass, Film, Fingerprint, Flame, Moon, Share2, Sparkles, Star, Sun, TrendingDown, TrendingUp, Trophy, Tv, Zap } from 'lucide-react';
import axios from 'axios';
import { toPng } from 'html-to-image';
import { RatedMovie } from './Recommendation.tsx';

const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";

interface HistoryItem {
  id: string;
  title: string;
  mediaType: string;
  genres: string[];
  watchedDate: unknown;
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

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const parseWatchedDate = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
};

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dateKeyToDayNumber = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};

const formatHour = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${suffix}`;
};

const percentDelta = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
};


type TimeRange = '30d' | '3m' | '6m' | '1y' | 'all';
type Session = { item: HistoryItem; date: Date; runtime: number };
type IntensityLevel = 'Casual' | 'Active' | 'Heavy' | 'Marathon';

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '30d', label: '30D' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

const INTENSITY_STYLES: Record<IntensityLevel, { label: string; border: string; bg: string; text: string; dot: string }> = {
  Casual: { label: '< 2h', border: 'border-sky-500/15', bg: 'bg-sky-500/[0.05]', text: 'text-sky-300', dot: 'bg-sky-400' },
  Active: { label: '2–4h', border: 'border-emerald-500/15', bg: 'bg-emerald-500/[0.05]', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  Heavy: { label: '4–6h', border: 'border-amber-500/15', bg: 'bg-amber-500/[0.05]', text: 'text-amber-300', dot: 'bg-amber-400' },
  Marathon: { label: '6h+', border: 'border-rose-500/15', bg: 'bg-rose-500/[0.05]', text: 'text-rose-300', dot: 'bg-rose-400' },
};

const shiftDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const shiftMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getRangeWindow = (anchor: Date, range: TimeRange) => {
  const end = new Date(anchor);
  let start: Date | null = null;
  let previousStart: Date;
  let previousEnd: Date;

  if (range === '30d') {
    start = startOfDay(shiftDays(end, -29));
    previousEnd = new Date(start.getTime() - 1);
    previousStart = startOfDay(shiftDays(start, -30));
  } else if (range === '3m') {
    start = startOfDay(shiftMonths(end, -3));
    previousEnd = new Date(start.getTime() - 1);
    previousStart = startOfDay(shiftMonths(start, -3));
  } else if (range === '6m') {
    start = startOfDay(shiftMonths(end, -6));
    previousEnd = new Date(start.getTime() - 1);
    previousStart = startOfDay(shiftMonths(start, -6));
  } else if (range === '1y') {
    start = startOfDay(shiftMonths(end, -12));
    previousEnd = new Date(start.getTime() - 1);
    previousStart = startOfDay(shiftMonths(start, -12));
  } else {
    const rollingStart = startOfDay(shiftMonths(end, -12));
    previousEnd = new Date(rollingStart.getTime() - 1);
    previousStart = startOfDay(shiftMonths(rollingStart, -12));
  }

  return { start, end, previousStart, previousEnd };
};

const formatMinutes = (minutes: number) => {
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours ? `${hours}h ` : ''}${mins ? `${mins}m` : ''}`.trim();
};

const topGenreForSessions = (sessions: Session[]) => {
  const counts = new Map<string, number>();
  sessions.forEach(({ item }) => item.genres.forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Explorer';
};

const getIntensity = (minutes: number): IntensityLevel => {
  if (minutes >= 360) return 'Marathon';
  if (minutes >= 240) return 'Heavy';
  if (minutes >= 120) return 'Active';
  return 'Casual';
};

const getLongestStreak = (sessions: Session[]) => {
  const days = [...new Set(sessions.map(({ date }) => localDateKey(date)))]
    .map(dateKeyToDayNumber)
    .sort((a, b) => a - b);
  let longest = 0;
  let running = 0;
  let previous: number | null = null;
  days.forEach((day) => {
    running = previous !== null && day === previous + 1 ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = day;
  });
  return longest;
};

const BingeWatchStats: React.FC<BingeWatchStatsProps> = ({ history, ratedMovies }) => {
  const [details, setDetails] = useState<Record<string, { runtime: number; director?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'genres' | 'directors'>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('6m');
  const [recapYear, setRecapYear] = useState<number | null>(null);
  const [sharingRecap, setSharingRecap] = useState(false);
  const recapRef = useRef<HTMLDivElement>(null);

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

  const allSessions = useMemo<Session[]>(() => {
    return history
      .map((item) => {
        const date = parseWatchedDate(item.watchedDate);
        if (!date) return null;
        const runtime = details[item.id]?.runtime || (item.mediaType === 'movie' ? 100 : 45);
        return { item, date, runtime };
      })
      .filter((session): session is Session => Boolean(session))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [history, details]);

  const anchorDate = useMemo(
    () => allSessions.at(-1)?.date || new Date(),
    [allSessions],
  );

  const rangeWindow = useMemo(
    () => getRangeWindow(anchorDate, timeRange),
    [anchorDate, timeRange],
  );

  const filteredSessions = useMemo(() => {
    if (!rangeWindow.start) return allSessions;
    return allSessions.filter(({ date }) => date >= rangeWindow.start! && date <= rangeWindow.end);
  }, [allSessions, rangeWindow]);

  const previousComparableSessions = useMemo(() => {
    return allSessions.filter(({ date }) => date >= rangeWindow.previousStart && date <= rangeWindow.previousEnd);
  }, [allSessions, rangeWindow]);

  const filteredRatedMovies = useMemo(() => {
    const dated = (ratedMovies || []).map((movie) => {
      const source = movie as any;
      const date = parseWatchedDate(source.timestamp ?? source.ratedAt ?? source.createdAt ?? source.date);
      const mediaId = source.movieId ?? source.tvId ?? source.id ?? source.mediaId;
      return { movie, date, mediaId: mediaId == null ? null : String(mediaId) };
    });
    const hasDates = dated.some(({ date }) => Boolean(date));
    if (hasDates && rangeWindow.start) {
      return dated
        .filter(({ date }) => date && date >= rangeWindow.start! && date <= rangeWindow.end)
        .map(({ movie }) => movie);
    }
    if (timeRange !== 'all') {
      const ids = new Set(filteredSessions.map(({ item }) => String(item.id)));
      const hasIds = dated.some(({ mediaId }) => mediaId !== null);
      if (hasIds) return dated.filter(({ mediaId }) => mediaId !== null && ids.has(mediaId)).map(({ movie }) => movie);
    }
    return ratedMovies || [];
  }, [ratedMovies, rangeWindow, timeRange, filteredSessions]);

  const stats = useMemo(() => {
    const genreCounts: Record<string, { count: number; hours: number }> = {};
    const directorCounts: Record<string, number> = {};
    const monthlyCounts: Record<string, { label: string; count: number }> = {};
    let movieMins = 0;
    let tvMins = 0;
    let movieCount = 0;
    let tvCount = 0;

    filteredSessions.forEach(({ item, date, runtime }) => {
      const runtimeHours = runtime / 60;

      if (item.mediaType === 'movie') {
        movieMins += runtime;
        movieCount += 1;
      } else {
        tvMins += runtime;
        tvCount += 1;
      }

      item.genres.forEach((genre) => {
        if (!genreCounts[genre]) genreCounts[genre] = { count: 0, hours: 0 };
        genreCounts[genre].count += 1;
        genreCounts[genre].hours += runtimeHours;
      });

      const director = details[item.id]?.director;
      if (director) directorCounts[director] = (directorCounts[director] || 0) + 1;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyCounts[monthKey]) monthlyCounts[monthKey] = { label: monthLabel, count: 0 };
      monthlyCounts[monthKey].count += 1;
    });

    const chartMonths = timeRange === '30d' ? 2 : timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
    const monthlyData = Object.entries(monthlyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-chartMonths)
      .map(([, data]) => ({ month: data.label, count: data.count }));

    return {
      genres: Object.entries(genreCounts)
        .map(([name, data]) => ({ name, value: Math.round(data.hours), titles: data.count }))
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
      monthlyData,
    };
  }, [filteredSessions, details, timeRange]);

  const topGenre = stats.genres[0]?.name || 'Explorer';

  const computedRatingData = useMemo(() => {
    const groups = { '1-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 };
    filteredRatedMovies.forEach((movie) => {
      const score = Math.round(movie.rating);
      if (score >= 1 && score <= 2) groups['1-2'] += 1;
      else if (score >= 3 && score <= 4) groups['3-4'] += 1;
      else if (score >= 5 && score <= 6) groups['5-6'] += 1;
      else if (score >= 7 && score <= 8) groups['7-8'] += 1;
      else if (score >= 9 && score <= 10) groups['9-10'] += 1;
    });
    return Object.entries(groups).map(([range, count]) => ({ range, count }));
  }, [filteredRatedMovies]);

  const totalFormatHours = stats.moviesHours + stats.tvHours;
  const moviePercent = totalFormatHours > 0 ? Math.round((stats.moviesHours / totalFormatHours) * 100) : 0;
  const tvPercent = totalFormatHours > 0 ? Math.round((stats.tvHours / totalFormatHours) * 100) : 0;

  const activityAnalytics = useMemo(() => {
    const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    const dayTotals = Array(7).fill(0) as number[];
    const hourTotals = Array(24).fill(0) as number[];
    const uniqueDays = new Set<string>();

    filteredSessions.forEach(({ date }) => {
      const dayIndex = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      heatmap[dayIndex][hour] += 1;
      dayTotals[dayIndex] += 1;
      hourTotals[hour] += 1;
      uniqueDays.add(localDateKey(date));
    });

    const maxHeatValue = Math.max(0, ...heatmap.flat());
    const peakDayIndex = dayTotals.some(Boolean) ? dayTotals.indexOf(Math.max(...dayTotals)) : 0;
    const peakHour = hourTotals.some(Boolean) ? hourTotals.indexOf(Math.max(...hourTotals)) : 0;
    const orderedDayNumbers = [...uniqueDays].map(dateKeyToDayNumber).sort((a, b) => a - b);

    let longestStreak = 0;
    let runningStreak = 0;
    let previousDay: number | null = null;

    orderedDayNumbers.forEach((day) => {
      runningStreak = previousDay !== null && day === previousDay + 1 ? runningStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, runningStreak);
      previousDay = day;
    });

    let latestStreak = 0;
    if (orderedDayNumbers.length) {
      latestStreak = 1;
      for (let index = orderedDayNumbers.length - 1; index > 0; index -= 1) {
        if (orderedDayNumbers[index] - orderedDayNumbers[index - 1] !== 1) break;
        latestStreak += 1;
      }
    }

    const latestDayNumber = orderedDayNumbers.at(-1);
    const todayNumber = dateKeyToDayNumber(localDateKey(new Date()));
    const currentStreak = latestDayNumber != null && todayNumber - latestDayNumber <= 1 ? latestStreak : 0;

    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const nextMonthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1);
    const previousMonthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1);
    const yearStart = new Date(anchorDate.getFullYear(), 0, 1);
    const nextYearStart = new Date(anchorDate.getFullYear() + 1, 0, 1);
    const previousYearStart = new Date(anchorDate.getFullYear() - 1, 0, 1);

    const summarizePeriod = (start: Date, end: Date) =>
      filteredSessions.reduce(
        (summary, session) => {
          if (session.date >= start && session.date < end) {
            summary.logs += 1;
            summary.minutes += session.runtime;
          }
          return summary;
        },
        { logs: 0, minutes: 0 },
      );

    const currentMonth = summarizePeriod(monthStart, nextMonthStart);
    const previousMonth = summarizePeriod(previousMonthStart, monthStart);
    const currentYear = summarizePeriod(yearStart, nextYearStart);
    const previousYear = summarizePeriod(previousYearStart, yearStart);

    return {
      heatmap,
      maxHeatValue,
      peakDay: DAY_LABELS[peakDayIndex],
      peakDayLogs: dayTotals[peakDayIndex] || 0,
      peakHour,
      peakHourLogs: hourTotals[peakHour] || 0,
      currentStreak,
      longestStreak,
      monthLabel: anchorDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      previousMonthLabel: previousMonthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      yearLabel: String(anchorDate.getFullYear()),
      previousYearLabel: String(anchorDate.getFullYear() - 1),
      monthDeltaLogs: percentDelta(currentMonth.logs, previousMonth.logs),
      monthDeltaHours: percentDelta(currentMonth.minutes, previousMonth.minutes),
      yearDeltaLogs: percentDelta(currentYear.logs, previousYear.logs),
      yearDeltaHours: percentDelta(currentYear.minutes, previousYear.minutes),
      currentMonthLogs: currentMonth.logs,
      currentMonthHours: Math.round(currentMonth.minutes / 60),
      currentYearLogs: currentYear.logs,
      currentYearHours: Math.round(currentYear.minutes / 60),
    };
  }, [filteredSessions, anchorDate]);

  const behaviorAnalytics = useMemo(() => {
    const summarizeBehavior = (sessions: Session[]) => {
      const totalMinutes = sessions.reduce((sum, session) => sum + session.runtime, 0);
      return {
        sessions: sessions.length,
        totalMinutes,
        averageRuntime: sessions.length ? Math.round(totalMinutes / sessions.length) : 0,
        topGenre: topGenreForSessions(sessions),
      };
    };

    const weekendSessions = filteredSessions.filter(({ date }) => date.getDay() === 0 || date.getDay() === 6);
    const weekdaySessions = filteredSessions.filter(({ date }) => date.getDay() !== 0 && date.getDay() !== 6);
    const weekend = summarizeBehavior(weekendSessions);
    const weekday = summarizeBehavior(weekdaySessions);

    const dayMap = new Map<string, { date: Date; sessions: Session[]; minutes: number }>();
    filteredSessions.forEach((session) => {
      const key = localDateKey(session.date);
      const existing = dayMap.get(key) || { date: session.date, sessions: [], minutes: 0 };
      existing.sessions.push(session);
      existing.minutes += session.runtime;
      dayMap.set(key, existing);
    });

    const intensityCounts: Record<IntensityLevel, number> = { Casual: 0, Active: 0, Heavy: 0, Marathon: 0 };
    const intensityDays = [...dayMap.values()]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((day) => {
        const level = getIntensity(day.minutes);
        intensityCounts[level] += 1;
        return { ...day, level };
      });

    const weightedScore = intensityDays.length
      ? Math.round(intensityDays.reduce((sum, day) => sum + Math.min(100, (day.minutes / 360) * 100), 0) / intensityDays.length)
      : 0;

    const sorted = [...filteredSessions].sort((a, b) => a.date.getTime() - b.date.getTime());
    const clusters: { start: Date; end: Date; sessions: Session[]; minutes: number }[] = [];
    let clusterIndex = 0;
    while (clusterIndex < sorted.length) {
      let endIndex = clusterIndex + 1;
      while (endIndex < sorted.length && sorted[endIndex].date.getTime() - sorted[clusterIndex].date.getTime() <= 5 * 60 * 60 * 1000) {
        endIndex += 1;
      }
      if (endIndex - clusterIndex >= 3) {
        const clusterSessions = sorted.slice(clusterIndex, endIndex);
        clusters.push({
          start: clusterSessions[0].date,
          end: clusterSessions.at(-1)!.date,
          sessions: clusterSessions,
          minutes: clusterSessions.reduce((sum, session) => sum + session.runtime, 0),
        });
        clusterIndex = endIndex;
      } else {
        clusterIndex += 1;
      }
    }

    const longestDay = [...dayMap.values()].sort((a, b) => b.minutes - a.minutes)[0] || null;

    const evolutionMap = new Map<string, { date: Date; genres: Map<string, number>; sessions: number }>();
    filteredSessions.forEach(({ item, date }) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = evolutionMap.get(key) || {
        date: new Date(date.getFullYear(), date.getMonth(), 1),
        genres: new Map<string, number>(),
        sessions: 0,
      };
      existing.sessions += 1;
      item.genres.forEach((genre) => existing.genres.set(genre, (existing.genres.get(genre) || 0) + 1));
      evolutionMap.set(key, existing);
    });

    const evolution = [...evolutionMap.values()]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-12)
      .map((entry) => {
        const ranked = [...entry.genres.entries()].sort((a, b) => b[1] - a[1]);
        return {
          month: entry.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          primary: ranked[0]?.[0] || 'Mixed',
          secondary: ranked[1]?.[0] || '',
          primaryShare: entry.sessions ? Math.round(((ranked[0]?.[1] || 0) / entry.sessions) * 100) : 0,
        };
      });

    const summarizeFormat = (sessions: Session[]) => {
      const movies = sessions.filter(({ item }) => item.mediaType === 'movie').length;
      const series = sessions.length - movies;
      return {
        movies,
        series,
        movieShare: sessions.length ? Math.round((movies / sessions.length) * 100) : 0,
        seriesShare: sessions.length ? Math.round((series / sessions.length) * 100) : 0,
      };
    };

    const currentTrendSessions = timeRange === 'all'
      ? allSessions.filter(({ date }) => date >= startOfDay(shiftMonths(anchorDate, -12)) && date <= anchorDate)
      : filteredSessions;
    const currentFormat = summarizeFormat(currentTrendSessions);
    const previousFormat = summarizeFormat(previousComparableSessions);

    const averageRating = filteredRatedMovies.length
      ? filteredRatedMovies.reduce((sum, movie) => sum + movie.rating, 0) / filteredRatedMovies.length
      : 0;
    const lateSessions = filteredSessions.filter(({ date }) => date.getHours() >= 21 || date.getHours() < 4).length;
    const morningSessions = filteredSessions.filter(({ date }) => date.getHours() >= 5 && date.getHours() < 10).length;
    const weekendDensity = weekendSessions.length / 2;
    const weekdayDensity = weekdaySessions.length / 5;
    const topGenreCount = filteredSessions.filter(({ item }) => item.genres.includes(topGenreForSessions(filteredSessions))).length;
    const topGenreShare = filteredSessions.length ? topGenreCount / filteredSessions.length : 0;

    const fingerprint = new Set<string>();
    if (filteredSessions.length) {
      if (lateSessions / filteredSessions.length >= 0.4) fingerprint.add('Night Owl');
      else if (morningSessions / filteredSessions.length >= 0.35) fingerprint.add('Early Bird');
      else fingerprint.add('Anytime Viewer');

      if (weekendDensity > weekdayDensity * 1.15) fingerprint.add('Weekend Binger');
      else fingerprint.add('Weekday Regular');

      if (topGenreShare >= 0.25) fingerprint.add(`${topGenreForSessions(filteredSessions)} Heavy`);
      else fingerprint.add('Genre Explorer');

      if (averageRating >= 7.5) fingerprint.add('High Rater');
      else if (averageRating && averageRating <= 5.5) fingerprint.add('Tough Critic');
      else if (averageRating) fingerprint.add('Balanced Critic');

      if (clusters.length >= 2) fingerprint.add('Binge Sprinter');
      if (currentFormat.movieShare >= 65) fingerprint.add('Film First');
      if (currentFormat.seriesShare >= 65) fingerprint.add('Series Mode');
    }

    return {
      weekend,
      weekday,
      intensityCounts,
      intensityDays,
      intensityScore: weightedScore,
      clusters,
      longestDay,
      evolution,
      currentFormat,
      previousFormat,
      movieDelta: currentFormat.movieShare - previousFormat.movieShare,
      seriesDelta: currentFormat.seriesShare - previousFormat.seriesShare,
      fingerprint: [...fingerprint].slice(0, 6),
      averageRating,
    };
  }, [filteredSessions, previousComparableSessions, allSessions, filteredRatedMovies, timeRange, anchorDate]);

  const availableYears = useMemo(
    () => [...new Set(allSessions.map(({ date }) => date.getFullYear()))].sort((a, b) => b - a),
    [allSessions],
  );

  useEffect(() => {
    if (!availableYears.length) {
      setRecapYear(null);
      return;
    }
    if (recapYear == null || !availableYears.includes(recapYear)) setRecapYear(availableYears[0]);
  }, [availableYears, recapYear]);

  const annualRecap = useMemo(() => {
    if (recapYear == null) return null;
    const sessions = allSessions.filter(({ date }) => date.getFullYear() === recapYear);
    const monthCounts = new Map<number, number>();
    const directorCounts = new Map<string, number>();
    sessions.forEach(({ item, date }) => {
      monthCounts.set(date.getMonth(), (monthCounts.get(date.getMonth()) || 0) + 1);
      const director = details[item.id]?.director;
      if (director) directorCounts.set(director, (directorCounts.get(director) || 0) + 1);
    });
    const favoriteMonthIndex = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topDirector = [...directorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Still discovering';
    return {
      year: recapYear,
      sessions: sessions.length,
      hours: Math.round(sessions.reduce((sum, session) => sum + session.runtime, 0) / 60),
      topGenre: topGenreForSessions(sessions),
      topDirector,
      favoriteMonth: favoriteMonthIndex == null
        ? '—'
        : new Date(recapYear, favoriteMonthIndex, 1).toLocaleDateString('en-US', { month: 'long' }),
      longestStreak: getLongestStreak(sessions),
      movies: sessions.filter(({ item }) => item.mediaType === 'movie').length,
      series: sessions.filter(({ item }) => item.mediaType !== 'movie').length,
    };
  }, [allSessions, recapYear, details]);

  const shareAnnualRecap = async () => {
    if (!recapRef.current || !annualRecap) return;
    setSharingRecap(true);
    try {
      const dataUrl = await toPng(recapRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#09090b',
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `cinescape-${annualRecap.year}-watch-recap.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: `${annualRecap.year} Watch Recap`, text: 'My Cinescape watch recap' });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } catch {
    } finally {
      setSharingRecap(false);
    }
  };

  const renderDelta = (value: number | null) => {
    if (value === null) return <span className="text-emerald-400">New</span>;
    const positive = value >= 0;
    const Icon = positive ? TrendingUp : TrendingDown;
    return (
      <span className={`inline-flex items-center gap-1 ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
        <Icon className="h-3 w-3" />
        {positive ? '+' : ''}{value}%
      </span>
    );
  };

  return (
    <div className="font-sans antialiased text-zinc-200 p-4 max-w-6xl mx-auto space-y-8 select-none">
      {annualRecap && (
        <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none">
          <div
            ref={recapRef}
            className="relative h-[1350px] w-[1080px] overflow-hidden bg-zinc-950 p-20 text-white font-sans"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(99,102,241,0.42),transparent_28%),radial-gradient(circle_at_90%_30%,rgba(244,63,94,0.30),transparent_30%),radial-gradient(circle_at_40%_95%,rgba(245,158,11,0.20),transparent_28%),linear-gradient(155deg,#09090b_0%,#111827_48%,#09090b_100%)]" />
            <div className="absolute inset-8 rounded-[48px] border border-white/10" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-black uppercase tracking-[0.28em] text-indigo-300">Cinescape</p>
                  <p className="mt-2 text-lg font-medium text-white/45">Annual Watch Recap</p>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-7 py-3 text-3xl font-black">{annualRecap.year}</div>
              </div>
              <div className="my-auto">
                <p className="text-8xl font-black leading-none tracking-[-0.06em]">{annualRecap.hours}</p>
                <p className="mt-3 text-3xl font-bold text-white/55">hours spent inside stories</p>
                <div className="mt-14 grid grid-cols-2 gap-5">
                  {[
                    ['Top genre', annualRecap.topGenre],
                    ['Top director', annualRecap.topDirector],
                    ['Favorite month', annualRecap.favoriteMonth],
                    ['Longest streak', `${annualRecap.longestStreak} days`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[32px] border border-white/10 bg-white/[0.07] p-7">
                      <p className="text-lg font-bold uppercase tracking-[0.16em] text-white/40">{label}</p>
                      <p className="mt-3 text-3xl font-black leading-tight">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-end justify-between border-t border-white/10 pt-8">
                <div>
                  <p className="text-3xl font-black">{annualRecap.sessions} titles logged</p>
                  <p className="mt-2 text-xl text-white/45">{annualRecap.movies} films · {annualRecap.series} series</p>
                </div>
                <Sparkles className="h-12 w-12 text-amber-300" />
              </div>
            </div>
          </div>
        </div>
      )}
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
                {filteredSessions.length}<span className="text-xs font-normal text-zinc-500 ml-0.5">logs</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 overflow-hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CalendarRange className="h-4 w-4 shrink-0 text-zinc-600" />
            <div className="flex shrink-0 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTimeRange(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-mono font-black uppercase tracking-wider transition ${timeRange === option.value
                      ? 'bg-indigo-500 text-white shadow-[0_6px_18px_rgba(99,102,241,0.25)]'
                      : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <span className="hidden shrink-0 text-[9px] font-mono uppercase tracking-widest text-zinc-600 sm:block">
            {filteredSessions.length} in range
          </span>
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

      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/30 p-3.5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/[0.06] blur-3xl" />
        <div className="relative z-10">
          <div className="mb-4 sm:mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-indigo-400">
                <Activity className="h-3.5 w-3.5" /> Viewing rhythm
              </div>
              <h2 className="mt-1 text-lg sm:text-2xl font-black tracking-tight text-white">Binge activity signals</h2>
              <p className="mt-1 max-w-2xl text-[11px] sm:text-xs leading-relaxed text-zinc-500">
                Discover when you watch most, how consistently you return, and how your latest activity compares with earlier periods.
              </p>
            </div>
            <span className="w-fit rounded-lg border border-zinc-800 bg-black/30 px-2.5 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
              Based on {filteredSessions.length} logs
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl sm:rounded-2xl border border-orange-500/15 bg-orange-500/[0.05] p-3 sm:p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Current streak</span>
                <Flame className="h-4 w-4 text-orange-400" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white">{activityAnalytics.currentStreak}<span className="ml-1 text-xs font-medium text-zinc-500">days</span></p>
              <p className="mt-0.5 sm:mt-1 text-[10px] text-zinc-600">Longest: {activityAnalytics.longestStreak} days</p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-sky-500/15 bg-sky-500/[0.05] p-3 sm:p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Peak day</span>
                <CalendarDays className="h-4 w-4 text-sky-400" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white truncate">{activityAnalytics.peakDay}</p>
              <p className="mt-0.5 sm:mt-1 text-[10px] text-zinc-600">{activityAnalytics.peakDayLogs} logged sessions</p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-violet-500/15 bg-violet-500/[0.05] p-3 sm:p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Peak hour</span>
                <Clock3 className="h-4 w-4 text-violet-400" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white">{formatHour(activityAnalytics.peakHour)}</p>
              <p className="mt-0.5 sm:mt-1 text-[10px] text-zinc-600">{activityAnalytics.peakHourLogs} logged sessions</p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3 sm:p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Consistency</span>
                <Activity className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white">{activityAnalytics.longestStreak}<span className="ml-1 text-xs font-medium text-zinc-500">best</span></p>
              <p className="mt-0.5 sm:mt-1 text-[10px] text-zinc-600">Consecutive record</p>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[1.55fr_.8fr]">
            <div className="rounded-xl sm:rounded-2xl border border-zinc-800/80 bg-black/25 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Watch-time heatmap</p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-zinc-400">Day × hour concentration</p>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-600">
                  <span>Less</span>
                  {[0.12, 0.28, 0.48, 0.72, 1].map((opacity) => (
                    <span key={opacity} className="h-2.5 w-2.5 rounded-[3px] border border-indigo-400/10" style={{ backgroundColor: `rgba(99,102,241,${opacity})` }} />
                  ))}
                  <span>More</span>
                </div>
              </div>

              <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="min-w-[540px]">
                  <div className="mb-1 grid grid-cols-[30px_repeat(24,minmax(0,1fr))] gap-1">
                    <span />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <span key={hour} className="text-center text-[7px] font-mono text-zinc-700">
                        {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {activityAnalytics.heatmap.map((row, dayIndex) => (
                      <div key={DAY_LABELS[dayIndex]} className="grid grid-cols-[30px_repeat(24,minmax(0,1fr))] gap-1">
                        <span className="flex items-center text-[8px] font-mono font-bold text-zinc-600">{DAY_LABELS[dayIndex]}</span>
                        {row.map((count, hour) => {
                          const intensity = activityAnalytics.maxHeatValue ? count / activityAnalytics.maxHeatValue : 0;
                          const opacity = count ? 0.14 + intensity * 0.82 : 0.035;
                          return (
                            <div
                              key={`${dayIndex}-${hour}`}
                              title={`${DAY_LABELS[dayIndex]} · ${formatHour(hour)} · ${count} ${count === 1 ? 'session' : 'sessions'}`}
                              className="aspect-square min-h-2.5 rounded-[3px] border border-white/[0.025] transition hover:scale-125 hover:border-white/20"
                              style={{ backgroundColor: count ? `rgba(99,102,241,${opacity})` : 'rgba(39,39,42,0.45)' }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl sm:rounded-2xl border border-zinc-800/80 bg-black/25 p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Month over month</p>
                    <p className="mt-0.5 sm:mt-1 text-xs font-semibold text-zinc-300">{activityAnalytics.monthLabel} vs {activityAnalytics.previousMonthLabel}</p>
                  </div>
                  <span className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[9px] font-mono text-zinc-500">MoM</span>
                </div>
                <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-lg sm:text-xl font-black text-white">{activityAnalytics.currentMonthLogs}</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">logs</p>
                    <div className="mt-1 text-[10px] font-mono font-bold">{renderDelta(activityAnalytics.monthDeltaLogs)}</div>
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-black text-white">{activityAnalytics.currentMonthHours}h</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">watch time</p>
                    <div className="mt-1 text-[10px] font-mono font-bold">{renderDelta(activityAnalytics.monthDeltaHours)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-zinc-800/80 bg-black/25 p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">Year over year</p>
                    <p className="mt-0.5 sm:mt-1 text-xs font-semibold text-zinc-300">{activityAnalytics.yearLabel} vs {activityAnalytics.previousYearLabel}</p>
                  </div>
                  <span className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[9px] font-mono text-zinc-500">YoY</span>
                </div>
                <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-lg sm:text-xl font-black text-white">{activityAnalytics.currentYearLogs}</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">logs</p>
                    <div className="mt-1 text-[10px] font-mono font-bold">{renderDelta(activityAnalytics.yearDeltaLogs)}</div>
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-black text-white">{activityAnalytics.currentYearHours}h</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">watch time</p>
                    <div className="mt-1 text-[10px] font-mono font-bold">{renderDelta(activityAnalytics.yearDeltaHours)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/30 p-3.5 sm:p-6 lg:col-span-7">
          <div className="pointer-events-none absolute -left-20 top-10 h-52 w-52 rounded-full bg-cyan-500/[0.05] blur-3xl" />
          <div className="relative z-10">
            <div className="mb-4 sm:mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-cyan-400">Behavior split</p>
                <h2 className="mt-1 text-lg sm:text-xl font-black text-white">Weekend vs weekday</h2>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/25 px-2.5 py-1.5 text-[9px] font-mono text-zinc-500">{filteredSessions.length} logs</div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-2">
              {[
                { label: 'Weekend', data: behaviorAnalytics.weekend, icon: Moon, tint: 'text-violet-300', ring: 'border-violet-500/15 bg-violet-500/[0.04]' },
                { label: 'Weekday', data: behaviorAnalytics.weekday, icon: Sun, tint: 'text-amber-300', ring: 'border-amber-500/15 bg-amber-500/[0.04]' },
              ].map(({ label, data, icon: Icon, tint, ring }) => (
                <div key={label} className={`rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 ${ring}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${tint}`} />
                      <span className="text-xs font-black text-white">{label}</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600">{data.topGenre}</span>
                  </div>
                  <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2">
                    <div><p className="text-lg sm:text-xl font-black text-white">{data.sessions}</p><p className="text-[9px] uppercase tracking-wider text-zinc-600">sessions</p></div>
                    <div><p className="text-lg sm:text-xl font-black text-white">{formatMinutes(data.averageRuntime)}</p><p className="text-[9px] uppercase tracking-wider text-zinc-600">avg runtime</p></div>
                    <div><p className="truncate text-xs sm:text-sm font-black text-white">{data.topGenre}</p><p className="text-[9px] uppercase tracking-wider text-zinc-600">top genre</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/70 to-zinc-950 p-3.5 sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-orange-400">Binge intensity</p>
              <h2 className="mt-1 text-lg sm:text-xl font-black text-white">Daily load score</h2>
            </div>
            <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-orange-500/20 bg-orange-500/10 text-lg sm:text-xl font-black text-orange-300">{behaviorAnalytics.intensityScore}</div>
          </div>
          <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2">
            {(Object.keys(INTENSITY_STYLES) as IntensityLevel[]).map((level) => {
              const style = INTENSITY_STYLES[level];
              return (
                <div key={level} className={`rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 ${style.border} ${style.bg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-black ${style.text}`}>{level}</span>
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  </div>
                  <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white">{behaviorAnalytics.intensityCounts[level]}</p>
                  <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-600">days · {style.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-12">
        <div className="rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/25 p-3.5 sm:p-6 xl:col-span-7">
          <div className="mb-4 sm:mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-rose-400">Session clusters</p>
              <h2 className="mt-1 text-lg sm:text-xl font-black text-white">Detected binge sessions</h2>
              <p className="mt-1 text-[11px] sm:text-xs text-zinc-500">Three or more titles started inside a five-hour window.</p>
            </div>
            <span className="rounded-xl border border-rose-500/15 bg-rose-500/[0.06] px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-black text-rose-300">{behaviorAnalytics.clusters.length}</span>
          </div>
          {behaviorAnalytics.clusters.length ? (
            <div className="space-y-2 sm:space-y-2.5">
              {behaviorAnalytics.clusters.slice(0, 4).map((cluster, index) => (
                <div key={`${cluster.start.toISOString()}-${index}`} className="flex items-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-zinc-800/70 bg-black/20 p-2.5 sm:p-3.5">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-rose-500/15 bg-rose-500/[0.06] text-rose-300"><Zap className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-xs font-black text-white">Binge session #{index + 1}</p>
                      <span className="text-[9px] font-mono text-zinc-600">{cluster.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <p className="mt-0.5 sm:mt-1 truncate text-[10px] text-zinc-500">{cluster.sessions.map(({ item }) => item.title).join(' · ')}</p>
                  </div>
                  <div className="shrink-0 text-right"><p className="text-xs sm:text-sm font-black text-white">{cluster.sessions.length} titles</p><p className="text-[9px] font-mono text-zinc-600">{formatMinutes(cluster.minutes)}</p></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-xl sm:rounded-2xl border border-dashed border-zinc-800 bg-black/15 text-center text-xs text-zinc-600">No five-hour binge clusters detected in this range.</div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.08] via-zinc-900/50 to-zinc-950 p-3.5 sm:p-6 xl:col-span-5">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-400/[0.08] blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-amber-300"><Trophy className="h-4 w-4" /><span className="text-[10px] font-mono font-black uppercase tracking-[0.18em]">Longest single-day marathon</span></div>
            {behaviorAnalytics.longestDay ? (
              <>
                <p className="mt-3 sm:mt-4 text-3xl sm:text-4xl font-black tracking-tight text-white">{formatMinutes(behaviorAnalytics.longestDay.minutes)}</p>
                <p className="mt-1 text-xs sm:text-sm font-bold text-zinc-300">{behaviorAnalytics.longestDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5">
                  {behaviorAnalytics.longestDay.sessions.slice(0, 5).map(({ item }) => (
                    <span key={`${item.mediaType}-${item.id}-${item.title}`} className="max-w-full truncate rounded-lg border border-white/10 bg-black/25 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] font-semibold text-zinc-300">{item.title}</span>
                  ))}
                </div>
                <p className="mt-2.5 sm:mt-3 text-[10px] font-mono uppercase tracking-wider text-zinc-600">{behaviorAnalytics.longestDay.sessions.length} titles in one day</p>
              </>
            ) : (
              <p className="mt-5 text-xs text-zinc-600">No marathon data in this range.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/25 p-3.5 sm:p-6">
        <div className="mb-4 sm:mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-fuchsia-400">Genre evolution</p>
            <h2 className="mt-1 text-lg sm:text-xl font-black text-white">How your taste moved</h2>
            <p className="mt-1 text-[11px] sm:text-xs text-zinc-500">Your dominant genre month by month across the selected range.</p>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600">{behaviorAnalytics.evolution.length} months mapped</span>
        </div>
        {behaviorAnalytics.evolution.length ? (
          <div className="-mx-3.5 sm:mx-0 flex snap-x gap-2.5 overflow-x-auto px-3.5 sm:px-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {behaviorAnalytics.evolution.map((entry, index) => (
              <motion.div key={`${entry.month}-${index}`} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="w-[135px] sm:w-[150px] shrink-0 snap-start rounded-xl sm:rounded-2xl border border-zinc-800/80 bg-black/20 p-3 sm:p-3.5">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-600">{entry.month}</p>
                <p className="mt-2 sm:mt-3 truncate text-sm sm:text-base font-black text-white">{entry.primary}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500" style={{ width: `${Math.max(8, entry.primaryShare)}%` }} /></div>
                <p className="mt-2 truncate text-[10px] text-zinc-500">{entry.secondary ? `then ${entry.secondary}` : 'single-genre lead'}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center text-xs text-zinc-600">Not enough genre history in this range.</div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
        <div className="rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-900/30 p-3.5 sm:p-6 lg:col-span-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-blue-400">Format momentum</p>
              <h2 className="mt-1 text-lg sm:text-xl font-black text-white">Movie vs series trend</h2>
            </div>
            <span className="rounded-lg border border-zinc-800 bg-black/30 px-2.5 py-1.5 text-[9px] font-mono text-zinc-600">vs previous range</span>
          </div>
          <div className="mt-4 sm:mt-5 h-7 sm:h-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-0.5 flex">
            <motion.div initial={{ width: 0 }} animate={{ width: `${behaviorAnalytics.currentFormat.movieShare}%` }} className="flex h-full items-center justify-end rounded-l-lg bg-gradient-to-r from-blue-500 to-cyan-400 pr-2 text-[9px] font-black text-black">{behaviorAnalytics.currentFormat.movieShare >= 15 ? `${behaviorAnalytics.currentFormat.movieShare}%` : ''}</motion.div>
            <motion.div initial={{ width: 0 }} animate={{ width: `${behaviorAnalytics.currentFormat.seriesShare}%` }} className="flex h-full items-center rounded-r-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 pl-2 text-[9px] font-black text-white">{behaviorAnalytics.currentFormat.seriesShare >= 15 ? `${behaviorAnalytics.currentFormat.seriesShare}%` : ''}</motion.div>
          </div>
          <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="rounded-xl sm:rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-3 sm:p-3.5">
              <div className="flex items-center gap-2"><Film className="h-4 w-4 text-cyan-300" /><span className="text-xs font-black text-white">Films</span></div>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white">{behaviorAnalytics.currentFormat.movieShare}%</p>
              <p className={`mt-0.5 sm:mt-1 text-[10px] font-mono font-bold ${behaviorAnalytics.movieDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{behaviorAnalytics.movieDelta >= 0 ? '+' : ''}{behaviorAnalytics.movieDelta} pts vs prior</p>
            </div>
            <div className="rounded-xl sm:rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/[0.04] p-3 sm:p-3.5">
              <div className="flex items-center gap-2"><Tv className="h-4 w-4 text-fuchsia-300" /><span className="text-xs font-black text-white">Series</span></div>
              <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black text-white">{behaviorAnalytics.currentFormat.seriesShare}%</p>
              <p className={`mt-0.5 sm:mt-1 text-[10px] font-mono font-bold ${behaviorAnalytics.seriesDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{behaviorAnalytics.seriesDelta >= 0 ? '+' : ''}{behaviorAnalytics.seriesDelta} pts vs prior</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-3.5 sm:p-6 lg:col-span-5">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/[0.08] blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-300"><Fingerprint className="h-4 w-4 text-indigo-400" /><span className="text-[10px] font-mono font-black uppercase tracking-[0.18em]">Personal viewing fingerprint</span></div>
            <h2 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-black text-white">Your cinema DNA</h2>
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
              {behaviorAnalytics.fingerprint.length ? behaviorAnalytics.fingerprint.map((trait, index) => (
                <span key={trait} className={`rounded-full border px-2.5 py-1.5 sm:px-3 sm:py-2 text-[10px] font-black ${index === 0 ? 'border-indigo-400/30 bg-indigo-400/15 text-indigo-200' : 'border-white/10 bg-white/[0.04] text-zinc-300'}`}>{trait}</span>
              )) : <span className="text-xs text-zinc-600">Log more titles to reveal your viewing fingerprint.</span>}
            </div>
            {behaviorAnalytics.averageRating > 0 && <p className="mt-3 sm:mt-4 text-[10px] font-mono text-zinc-600">Average personal rating · <span className="font-black text-zinc-300">{behaviorAnalytics.averageRating.toFixed(1)}/10</span></p>}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl sm:rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_100%_80%,rgba(244,63,94,0.12),transparent_32%),linear-gradient(145deg,#111827_0%,#09090b_55%,#111111_100%)] p-3.5 sm:p-6">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-300"><Trophy className="h-4 w-4" /><span className="text-[10px] font-mono font-black uppercase tracking-[0.2em]">Annual recap</span></div>
              <h2 className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-black tracking-tight text-white">Your year in cinema</h2>
              <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-white/45">A share-ready Cinescape recap generated from your watch history.</p>
            </div>
            <div className="flex items-center gap-2">
              {availableYears.length > 0 && (
                <select value={recapYear ?? ''} onChange={(event) => setRecapYear(Number(event.target.value))} className="h-8 sm:h-9 flex-1 sm:flex-initial rounded-xl border border-white/10 bg-black/30 px-2.5 sm:px-3 text-xs font-black text-white outline-none">
                  {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              )}
              <button type="button" onClick={shareAnnualRecap} disabled={!annualRecap || sharingRecap} className="flex h-8 sm:h-9 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 text-[10px] font-black text-white transition hover:bg-white/15 disabled:opacity-40">
                {sharingRecap ? <Activity className="h-3.5 w-3.5 animate-pulse" /> : <Share2 className="h-3.5 w-3.5 text-amber-300" />}
                {sharingRecap ? 'Preparing' : 'Share poster'}
              </button>
            </div>
          </div>

          {annualRecap ? (
            <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Hours', `${annualRecap.hours}h`],
                ['Top genre', annualRecap.topGenre],
                ['Director', annualRecap.topDirector],
                ['Favorite month', annualRecap.favoriteMonth],
                ['Longest streak', `${annualRecap.longestStreak}d`],
                ['Titles', String(annualRecap.sessions)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl sm:rounded-2xl border border-white/10 bg-black/20 p-2.5 sm:p-3.5 backdrop-blur-xl">
                  <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-white/35">{label}</p>
                  <p className="mt-1 sm:mt-2 truncate text-sm sm:text-base font-black text-white">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-dashed border-white/10 p-6 sm:p-8 text-center text-xs text-white/35">No annual history available yet.</div>
          )}
        </div>
      </section>

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
                      Your historical timeline maps <span className="text-white font-semibold">{filteredSessions.length} active sessions</span>. Activity is pacing with steady retention. Let's analyze the month-by-month session densities.
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
              {filteredRatedMovies.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-current" /> {((filteredRatedMovies.reduce((sum, m) => sum + m.rating, 0)) / filteredRatedMovies.length).toFixed(1)} Avg
                </div>
              )}
            </div>

            <div className="h-[140px] w-full">
              {filteredRatedMovies.length > 0 ? (
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
                { label: 'Elite Critic', target: '5+ Distinct Ratings', current: filteredRatedMovies.length, max: 5, color: 'from-amber-400 to-orange-500' }
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