import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Film, Gem, RefreshCw, Star, Tv } from "lucide-react";

const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const CACHE_TTL = 5 * 60 * 1000;

type MediaType = "movie" | "tv";
type RecommendationMode = "forYou" | "hiddenGems";

type CandidateSource = {
  ratedSeed: boolean;
  historySeed: boolean;
  discover: boolean;
  trending: boolean;
  popular: boolean;
  talentNames: string[];
};

type Candidate = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: MediaType;
  overview: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genreIds: number[];
  source: CandidateSource;
};

type GenreProfile = {
  weights: Record<number, number>;
  idToName: Record<number, string>;
  topGenres: string[];
  magnitude: number;
};

type CachedResult = {
  expiresAt: number;
  items: RecommendedItem[];
  hiddenGems: RecommendedItem[];
};

export type RecommendedItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
  overview: string;
  voteAverage: number;
};

export type WatchlistItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
};

export type HistoryItem = {
  id: string;
  title: string;
  posterPath: string;
  mediaType: string;
  genres: string[];
  watchedDate: string;
};

export type FavouriteTalent = {
  id: string;
  name: string;
  profilePath: string;
};

export type RatedMovie = {
  id: string;
  title: string;
  posterPath: string;
  rating: number;
  mediaType: string;
};

const recommendationCache = new Map<string, CachedResult>();
const genreMapCache = new Map<MediaType, Map<string, number>>();

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const parseWatchDate = (value?: string) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const getRecencyWeight = (watchedDate?: string) => {
  const watchedAt = parseWatchDate(watchedDate);
  if (!watchedAt) return 0.8;
  const daysAgo = Math.max(0, (Date.now() - watchedAt) / 86_400_000);
  return 0.55 + 1.45 * Math.exp(-daysAgo / 75);
};

const getGenreMap = async (type: MediaType) => {
  const cached = genreMapCache.get(type);
  if (cached) return cached;

  const response = await axios.get(`${TMDB_BASE}/genre/${type}/list`, {
    params: {
      api_key: TMDB_API_KEY,
      language: "en-US",
    },
  });

  const map = new Map<string, number>();
  for (const genre of response.data.genres ?? []) {
    if (genre?.name && genre?.id) {
      map.set(String(genre.name).toLowerCase(), Number(genre.id));
    }
  }

  genreMapCache.set(type, map);
  return map;
};

const buildGenreProfile = async (
  type: MediaType,
  history: HistoryItem[],
): Promise<GenreProfile> => {
  let genreMap = new Map<string, number>();

  try {
    genreMap = await getGenreMap(type);
  } catch {
    genreMap = new Map();
  }

  const weights: Record<number, number> = {};
  const idToName: Record<number, string> = {};

  history.forEach((item) => {
    const recencyWeight = getRecencyWeight(item.watchedDate);
    const crossFormatWeight = item.mediaType === type ? 1 : 0.72;

    item.genres?.forEach((genreName) => {
      const genreId = genreMap.get(genreName.toLowerCase());
      if (!genreId) return;

      weights[genreId] =
        (weights[genreId] ?? 0) + recencyWeight * crossFormatWeight;
      idToName[genreId] = genreName;
    });
  });

  const entries = Object.entries(weights)
    .map(([id, weight]) => ({ id: Number(id), weight }))
    .sort((a, b) => b.weight - a.weight);

  const magnitude = Math.sqrt(
    entries.reduce((sum, item) => sum + item.weight ** 2, 0),
  );

  return {
    weights,
    idToName,
    magnitude,
    topGenres: entries
      .slice(0, 4)
      .map((item) => idToName[item.id])
      .filter(Boolean),
  };
};

const createCandidate = (
  raw: any,
  type: MediaType,
  sourcePatch: Partial<CandidateSource>,
): Candidate | null => {
  const id = raw?.id?.toString();
  if (!id) return null;

  return {
    id,
    title: raw.title ?? raw.name ?? "Untitled",
    posterPath: raw.poster_path ? `${TMDB_IMAGE_BASE}${raw.poster_path}` : "",
    mediaType: type,
    overview: raw.overview ?? "",
    voteAverage: Number(raw.vote_average) || 0,
    voteCount: Number(raw.vote_count) || 0,
    popularity: Number(raw.popularity) || 0,
    genreIds: Array.isArray(raw.genre_ids)
      ? raw.genre_ids.map(Number).filter(Number.isFinite)
      : [],
    source: {
      ratedSeed: false,
      historySeed: false,
      discover: false,
      trending: false,
      popular: false,
      talentNames: [],
      ...sourcePatch,
    },
  };
};

const mergeCandidate = (
  target: Map<string, Candidate>,
  candidate: Candidate | null,
) => {
  if (!candidate) return;
  const existing = target.get(candidate.id);

  if (!existing) {
    target.set(candidate.id, candidate);
    return;
  }

  target.set(candidate.id, {
    ...existing,
    posterPath: existing.posterPath || candidate.posterPath,
    overview: existing.overview || candidate.overview,
    voteAverage: Math.max(existing.voteAverage, candidate.voteAverage),
    voteCount: Math.max(existing.voteCount, candidate.voteCount),
    popularity: Math.max(existing.popularity, candidate.popularity),
    genreIds: Array.from(new Set([...existing.genreIds, ...candidate.genreIds])),
    source: {
      ratedSeed: existing.source.ratedSeed || candidate.source.ratedSeed,
      historySeed: existing.source.historySeed || candidate.source.historySeed,
      discover: existing.source.discover || candidate.source.discover,
      trending: existing.source.trending || candidate.source.trending,
      popular: existing.source.popular || candidate.source.popular,
      talentNames: Array.from(
        new Set([
          ...existing.source.talentNames,
          ...candidate.source.talentNames,
        ]),
      ),
    },
  });
};

const cosineGenreSimilarity = (
  candidateGenreIds: number[],
  profile: GenreProfile,
) => {
  if (!candidateGenreIds.length || profile.magnitude === 0) return 0;

  const dot = candidateGenreIds.reduce(
    (sum, genreId) => sum + (profile.weights[genreId] ?? 0),
    0,
  );
  const candidateMagnitude = Math.sqrt(candidateGenreIds.length);
  return clamp(dot / (profile.magnitude * candidateMagnitude));
};

const scoreCandidate = (
  candidate: Candidate,
  profile: GenreProfile,
  hasFavouriteTalents: boolean,
  hasRatedSeeds: boolean,
  hasHistorySeeds: boolean,
) => {
  const genreScore = cosineGenreSimilarity(candidate.genreIds, profile);
  const talentScore = candidate.source.talentNames.length
    ? clamp(candidate.source.talentNames.length / 2)
    : 0;
  const ratedScore = candidate.source.ratedSeed ? 1 : 0;
  const historyScore = candidate.source.historySeed ? 1 : 0;
  const discoverScore = candidate.source.discover ? 1 : 0;
  const qualityConfidence = clamp(Math.log10(candidate.voteCount + 1) / 3.2);
  const qualityScore = clamp(candidate.voteAverage / 10) *
    (0.55 + 0.45 * qualityConfidence);
  const popularityScore = clamp(Math.log10(candidate.popularity + 1) / 3.2);

  const components = [
    { score: genreScore, weight: profile.magnitude > 0 ? 0.46 : 0 },
    { score: talentScore, weight: hasFavouriteTalents ? 0.28 : 0 },
    { score: ratedScore, weight: hasRatedSeeds ? 0.11 : 0 },
    { score: historyScore, weight: hasHistorySeeds ? 0.07 : 0 },
    { score: discoverScore, weight: profile.magnitude > 0 ? 0.03 : 0 },
    { score: qualityScore, weight: 0.04 },
    { score: popularityScore, weight: 0.01 },
  ];

  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = totalWeight
    ? components.reduce(
        (sum, item) => sum + item.score * item.weight,
        0,
      ) / totalWeight
    : qualityScore;

  return clamp(weightedScore);
};


const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededShuffle = <T,>(items: T[], seedValue: string) => {
  const result = [...items];
  let seed = hashSeed(seedValue) || 1;

  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
};

const freshenRecommendations = (
  items: RecommendedItem[],
  seedValue: string,
) => {
  if (items.length <= 4) return items;

  const windowSize = Math.min(10, items.length);
  const rotateCount = Math.min(
    Math.max(2, Math.round(windowSize * 0.25)),
    Math.max(1, windowSize - 1),
  );
  const stableCount = Math.max(1, windowSize - rotateCount);
  const stable = items.slice(0, stableCount);
  const rotationPool = items.slice(stableCount);

  if (!rotationPool.length) return items;

  const rotated = seededShuffle(rotationPool, seedValue).slice(0, rotateCount);
  const front = [...stable, ...rotated];
  const used = new Set(front.map((item) => item.id));
  const remainder = items.filter((item) => !used.has(item.id));

  return [...front, ...remainder];
};

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * ratio)),
  );
  return sorted[index];
};

const buildCacheKey = (
  type: MediaType,
  history: HistoryItem[],
  watchlist: WatchlistItem[],
  favouriteTalents: FavouriteTalent[],
  ratedMovies: RatedMovie[],
) => {
  const historySignature = history
    .map((item) => `${item.mediaType}:${item.id}:${item.watchedDate}`)
    .sort()
    .join("|");
  const watchlistSignature = watchlist
    .map((item) => `${item.mediaType}:${item.id}`)
    .sort()
    .join("|");
  const talentSignature = favouriteTalents
    .map((talent) => talent.id)
    .sort()
    .join("|");
  const ratingSignature = ratedMovies
    .map((item) => `${item.mediaType}:${item.id}:${item.rating}`)
    .sort()
    .join("|");

  return `${type}::${historySignature}::${watchlistSignature}::${talentSignature}::${ratingSignature}`;
};

export const RecommendationSection = ({
  watchlist,
  history,
  favouriteTalents,
  ratedMovies,
  onMediaClick,
}: {
  watchlist: WatchlistItem[];
  history: HistoryItem[];
  favouriteTalents: FavouriteTalent[];
  ratedMovies: RatedMovie[];
  onMediaClick: (id: string, mediaType: string) => void;
}) => {
  const [rankedItems, setRankedItems] = useState<RecommendedItem[]>([]);
  const [hiddenGemItems, setHiddenGemItems] = useState<RecommendedItem[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [recommendationMode, setRecommendationMode] =
    useState<RecommendationMode>("forYou");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [freshnessVersion, setFreshnessVersion] = useState(0);
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const sessionSeedRef = useRef(
    Math.floor(Math.random() * 2_147_483_647).toString(36),
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchRecommendations = useCallback(
    async (type: MediaType, force = false, background = false) => {
      const seq = ++seqRef.current;
      const cacheKey = buildCacheKey(
        type,
        history,
        watchlist,
        favouriteTalents,
        ratedMovies,
      );
      const cached = recommendationCache.get(cacheKey);

      if (!force && cached && cached.expiresAt > Date.now()) {
        setRankedItems(cached.items);
        setHiddenGemItems(cached.hiddenGems);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const filterType = <T extends { mediaType: string; id: string }>(arr: T[]) =>
        arr.filter((item) => item.mediaType === type).map((item) => item.id);

      const watchedOrWatchlistIds = new Set([
        ...filterType(history),
        ...filterType(watchlist),
      ]);

      const ratedSeeds = ratedMovies
        .filter((item) => item.mediaType === type && item.rating >= 7)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .map((item) => item.id);

      const historySeeds = history
        .filter((item) => item.mediaType === type)
        .sort(
          (a, b) => parseWatchDate(b.watchedDate) - parseWatchDate(a.watchedDate),
        )
        .slice(0, 7)
        .map((item) => item.id);

      const profile = await buildGenreProfile(type, history);
      const candidates = new Map<string, Candidate>();

      const addResults = (
        results: any[],
        sourcePatch: Partial<CandidateSource>,
      ) => {
        results.forEach((raw) => {
          const candidate = createCandidate(raw, type, sourcePatch);
          if (!candidate || watchedOrWatchlistIds.has(candidate.id)) return;
          mergeCandidate(candidates, candidate);
        });
      };

      const recommendationRequests = [
        ...ratedSeeds.map(async (id) => {
          try {
            const response = await axios.get(
              `${TMDB_BASE}/${type}/${id}/recommendations`,
              {
                params: {
                  api_key: TMDB_API_KEY,
                  language: "en-US",
                  page: 1,
                },
              },
            );
            addResults(response.data.results ?? [], { ratedSeed: true });
          } catch {
            return;
          }
        }),
        ...historySeeds.map(async (id) => {
          try {
            const response = await axios.get(
              `${TMDB_BASE}/${type}/${id}/recommendations`,
              {
                params: {
                  api_key: TMDB_API_KEY,
                  language: "en-US",
                  page: 1,
                },
              },
            );
            addResults(response.data.results ?? [], { historySeed: true });
          } catch {
            return;
          }
        }),
      ];

      const talentRequests = favouriteTalents.slice(0, 10).map(async (talent) => {
        try {
          const response = await axios.get(
            `${TMDB_BASE}/person/${talent.id}/${type}_credits`,
            {
              params: {
                api_key: TMDB_API_KEY,
                language: "en-US",
              },
            },
          );
          addResults((response.data.cast ?? []).slice(0, 30), {
            talentNames: [talent.name],
          });
        } catch {
          return;
        }
      });

      const topGenreIds = Object.entries(profile.weights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      const discoveryRequests = [
        (async () => {
          if (!topGenreIds.length) return;
          try {
            const response = await axios.get(`${TMDB_BASE}/discover/${type}`, {
              params: {
                api_key: TMDB_API_KEY,
                language: "en-US",
                sort_by: "vote_average.desc",
                "vote_count.gte": type === "movie" ? 250 : 100,
                with_genres: topGenreIds.join("|"),
                page: 1,
              },
            });
            addResults(response.data.results ?? [], { discover: true });
          } catch {
            return;
          }
        })(),
        (async () => {
          if (!topGenreIds.length) return;
          try {
            const response = await axios.get(`${TMDB_BASE}/discover/${type}`, {
              params: {
                api_key: TMDB_API_KEY,
                language: "en-US",
                sort_by: "popularity.asc",
                "vote_average.gte": 7,
                "vote_count.gte": type === "movie" ? 100 : 50,
                with_genres: topGenreIds.join("|"),
                page: 1,
              },
            });
            addResults(response.data.results ?? [], { discover: true });
          } catch {
            return;
          }
        })(),
        (async () => {
          try {
            const response = await axios.get(`${TMDB_BASE}/trending/${type}/week`, {
              params: { api_key: TMDB_API_KEY },
            });
            addResults(response.data.results ?? [], { trending: true });
          } catch {
            return;
          }
        })(),
        (async () => {
          try {
            const response = await axios.get(`${TMDB_BASE}/${type}/popular`, {
              params: {
                api_key: TMDB_API_KEY,
                language: "en-US",
                page: 1,
              },
            });
            addResults(response.data.results ?? [], { popular: true });
          } catch {
            return;
          }
        })(),
      ];

      await Promise.allSettled([
        ...recommendationRequests,
        ...talentRequests,
        ...discoveryRequests,
      ]);

      if (!mountedRef.current || seq !== seqRef.current) return;

      const hasFavouriteTalents = favouriteTalents.length > 0;
      const hasRatedSeeds = ratedSeeds.length > 0;
      const hasHistorySeeds = historySeeds.length > 0;

      const scoredCandidates = Array.from(candidates.values())
        .filter((candidate) => candidate.posterPath)
        .map((candidate) => {
          const score = scoreCandidate(
            candidate,
            profile,
            hasFavouriteTalents,
            hasRatedSeeds,
            hasHistorySeeds,
          );
          const genreSimilarity = cosineGenreSimilarity(
            candidate.genreIds,
            profile,
          );

          return {
            candidate,
            score,
            genreSimilarity,
          };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.candidate.voteAverage - a.candidate.voteAverage;
        });

      const toRecommendedItem = ({
        candidate,
      }: {
        candidate: Candidate;
      }): RecommendedItem => ({
        id: candidate.id,
        title: candidate.title,
        posterPath: candidate.posterPath,
        mediaType: candidate.mediaType,
        overview: candidate.overview,
        voteAverage: candidate.voteAverage,
      });

      const rankedItems = scoredCandidates
        .slice(0, 50)
        .map(toRecommendedItem);

      const popularityValues = scoredCandidates
        .map(({ candidate }) => candidate.popularity)
        .filter((value) => Number.isFinite(value) && value > 0);
      const popularityCutoff =
        percentile(popularityValues, 0.62) ||
        (type === "movie" ? 55 : 40);
      const minVotes = type === "movie" ? 100 : 50;
      const minSimilarity = profile.magnitude > 0 ? 0.34 : 0;
      const minScore = profile.magnitude > 0 ? 0.38 : 0.2;

      const scoreHiddenGem = ({
        candidate,
        score,
        genreSimilarity,
      }: {
        candidate: Candidate;
        score: number;
        genreSimilarity: number;
      }) => {
        const inversePopularity = popularityCutoff > 0
          ? clamp(1 - candidate.popularity / (popularityCutoff * 1.35))
          : 0.5;
        const quality = clamp((candidate.voteAverage - 6.5) / 3.5);

        return (
          score * 0.62 +
          genreSimilarity * 0.16 +
          quality * 0.16 +
          inversePopularity * 0.06
        );
      };

      const primaryHiddenGems = scoredCandidates
        .filter(({ candidate, score, genreSimilarity }) =>
          candidate.voteAverage >= 7 &&
          candidate.voteCount >= minVotes &&
          candidate.popularity > 0 &&
          candidate.popularity <= popularityCutoff &&
          score >= minScore &&
          genreSimilarity >= minSimilarity
        )
        .map((entry) => ({
          ...entry,
          hiddenGemScore: scoreHiddenGem(entry),
        }))
        .sort((a, b) => b.hiddenGemScore - a.hiddenGemScore);

      const relaxedHiddenGems = scoredCandidates
        .filter(({ candidate, score, genreSimilarity }) =>
          candidate.voteAverage >= 6.8 &&
          candidate.voteCount >= Math.max(25, Math.floor(minVotes * 0.55)) &&
          candidate.popularity > 0 &&
          candidate.popularity <= popularityCutoff * 1.5 &&
          score >= Math.max(0.24, minScore - 0.08) &&
          genreSimilarity >= Math.max(0, minSimilarity - 0.12)
        )
        .map((entry) => ({
          ...entry,
          hiddenGemScore: scoreHiddenGem(entry),
        }))
        .sort((a, b) => b.hiddenGemScore - a.hiddenGemScore);

      const hiddenGemMap = new Map<string, RecommendedItem>();

      [...primaryHiddenGems, ...relaxedHiddenGems].forEach((entry) => {
        if (hiddenGemMap.size >= 40) return;
        if (!hiddenGemMap.has(entry.candidate.id)) {
          hiddenGemMap.set(
            entry.candidate.id,
            toRecommendedItem(entry),
          );
        }
      });

      const hiddenGems = Array.from(hiddenGemMap.values());

      recommendationCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL,
        items: rankedItems,
        hiddenGems,
      });

      setRankedItems(rankedItems);
      setHiddenGemItems(hiddenGems);

      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    },
    [watchlist, history, favouriteTalents, ratedMovies],
  );

  useEffect(() => {
    setRankedItems([]);
    setHiddenGemItems([]);
    setRefreshing(false);
    fetchRecommendations(mediaType);
  }, [mediaType, fetchRecommendations]);

  useEffect(() => {
    const refresh = () => {
      fetchRecommendations(mediaType);
    };

    const onVisible = () => {
      if (!document.hidden) refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [mediaType, fetchRecommendations]);

  const switchType = (type: MediaType) => {
    if (type === mediaType) return;
    setRankedItems([]);
    setHiddenGemItems([]);
    setRefreshing(false);
    setMediaType(type);
  };

  const handleManualRefresh = () => {
    if (refreshing || loading) return;
    setFreshnessVersion((version) => version + 1);
    fetchRecommendations(mediaType, true, true);
  };

  const items = useMemo(() => {
    const source =
      recommendationMode === "hiddenGems" ? hiddenGemItems : rankedItems;

    return freshenRecommendations(
      source,
      `${sessionSeedRef.current}:${mediaType}:${recommendationMode}:${freshnessVersion}`,
    );
  }, [
    rankedItems,
    hiddenGemItems,
    mediaType,
    recommendationMode,
    freshnessVersion,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-3xl bg-neutral-900/40 border border-white/[0.08] backdrop-blur-2xl p-4 sm:p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
    >
      <div className="absolute top-0 left-1/4 -translate-y-1/2 w-72 sm:w-96 h-32 bg-red-600/10 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-72 sm:w-96 h-32 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.06]">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-500/25 blur-md rounded-full animate-pulse" />
            <img
              src="/recommendation-icon.png"
              alt="Recommendations"
              className="relative z-10 w-9 h-9 sm:w-11 sm:h-11 object-contain filter brightness-110 drop-shadow-[0_4px_20px_rgba(124,58,237,0.7)]"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              Recommendations
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">
              Curated based on your taste
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:ml-1">
            <button
              type="button"
              onClick={() =>
                setRecommendationMode((mode) =>
                  mode === "hiddenGems" ? "forYou" : "hiddenGems",
                )
              }
              aria-pressed={recommendationMode === "hiddenGems"}
              className={`flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-bold transition-all duration-300 sm:h-9 sm:px-3 sm:text-[11px] ${
                recommendationMode === "hiddenGems"
                  ? "border-amber-400/35 bg-amber-400/12 text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.08)]"
                  : "border-white/10 bg-white/[0.035] text-zinc-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-200"
              }`}
            >
              <Gem className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hidden Gems</span>
              <span className="sm:hidden">Gems</span>
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              aria-label="Refresh recommendations"
              title="Refresh recommendations"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-400 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="relative self-stretch sm:self-auto flex items-center bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-1 shadow-inner">
          <button
            onClick={() => switchType("movie")}
            className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-colors duration-300 ${mediaType === "movie" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Movies</span>
          </button>
          <button
            onClick={() => switchType("tv")}
            className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-colors duration-300 ${mediaType === "tv" ? "text-white" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Series</span>
          </button>
          <motion.div
            className="absolute inset-y-1 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-xl shadow-lg shadow-red-600/30"
            layoutId="recommendation-toggle"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              left: mediaType === "movie" ? "4px" : "calc(50% + 2px)",
              width: "calc(50% - 6px)",
            }}
          />
        </div>
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-zinc-400 text-xs font-medium tracking-wide uppercase">
              Curating {mediaType === "movie" ? "movies" : "series"}…
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
              <Film className="w-6 h-6 text-zinc-500" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              {recommendationMode === "hiddenGems"
                ? "No Hidden Gems Yet"
                : "No Recommendations Yet"}
            </h3>
            <p className="text-zinc-400 text-xs max-w-xs mx-auto">
              {recommendationMode === "hiddenGems"
                ? "Your next underrated pick will appear here as your taste profile grows"
                : "Watch more to get personalised picks"}
            </p>
          </div>
        ) : (
          <div>
            <div
              className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-3 pt-1 px-1 -mx-1 scrollbar-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onMediaClick(item.id, item.mediaType)}
                  className="group relative flex-shrink-0 w-28 sm:w-32 bg-neutral-900/60 border border-white/[0.08] hover:border-white/20 rounded-xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
                    {item.posterPath ? (
                      <img
                        src={item.posterPath}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-950">
                        <Film className="w-6 h-6 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-300" />
                    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg] transition-transform duration-1000 ease-in-out" />
                    </div>
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 z-10 pointer-events-none">
                      {item.voteAverage > 0 ? (
                        <div className="h-5 shrink-0 flex items-center gap-0.5 bg-black/70 border border-white/10 backdrop-blur-md px-1.5 rounded-md shadow-md">
                          <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="text-[9px] font-bold text-amber-300 leading-none">
                            {item.voteAverage.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}
                      <div className="h-5 shrink-0 flex items-center justify-center bg-black/70 border border-white/10 backdrop-blur-md px-1.5 rounded-md shadow-md">
                        <span
                          className={`text-[8px] font-black uppercase tracking-wider leading-none ${item.mediaType === "tv" ? "text-cyan-400" : "text-amber-400"}`}
                        >
                          {item.mediaType === "tv" ? "TV" : "FILM"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-neutral-900/90 border-t border-white/[0.04] transition-colors duration-300 group-hover:bg-neutral-900">
                    <h3 className="text-xs font-semibold text-white/90 group-hover:text-white transition-colors duration-300 truncate leading-snug">
                      {item.title}
                    </h3>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 px-1 pt-2 border-t border-white/[0.04] text-[11px] text-zinc-500 font-medium">
              <span>Swipe for more</span>
              <span>
                {items.length} {mediaType === "movie" ? "movies" : "series"}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RecommendationSection;