import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { CalendarDays, Clapperboard, Star, Tv, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext.tsx";
import { db } from "../firebase.ts";

type MediaType = "movie" | "tv";

type HistorySignal = {
    id: string;
    mediaType: MediaType;
    genres: string[];
};

type FavouriteTalentSignal = {
    id: string;
    name: string;
};

type DailyPick = {
    id: number;
    title: string;
    mediaType: MediaType;
    posterPath: string;
    releaseDate: string;
    voteAverage: number;
    voteCount: number;
    popularity: number;
    genreIds: number[];
    sourceGenres: string[];
    talentNames: string[];
};

type GenreMaps = {
    movie: Map<string, number>;
    tv: Map<string, number>;
};

const TMDB_API_KEY = "859afbb4b98e3b467da9c99ac390e950";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const normalizeGenre = (value: string) => value.trim().toLowerCase();

const daySeed = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate(),
    ).padStart(2, "0")}`;
};

const hashString = (value: string) => {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
};

const seededShuffle = <T,>(items: T[], seedValue: string) => {
    const result = [...items];
    let seed = hashString(seedValue) || 1;

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

const mergePick = (
    target: Map<string, DailyPick>,
    incoming: DailyPick,
) => {
    const key = `${incoming.mediaType}-${incoming.id}`;
    const existing = target.get(key);

    if (!existing) {
        target.set(key, incoming);
        return;
    }

    target.set(key, {
        ...existing,
        posterPath: existing.posterPath || incoming.posterPath,
        releaseDate: existing.releaseDate || incoming.releaseDate,
        voteAverage: Math.max(existing.voteAverage, incoming.voteAverage),
        voteCount: Math.max(existing.voteCount, incoming.voteCount),
        popularity: Math.max(existing.popularity, incoming.popularity),
        genreIds: Array.from(new Set([...existing.genreIds, ...incoming.genreIds])),
        sourceGenres: Array.from(
            new Set([...existing.sourceGenres, ...incoming.sourceGenres]),
        ),
        talentNames: Array.from(
            new Set([...existing.talentNames, ...incoming.talentNames]),
        ),
    });
};

const toPick = (
    raw: any,
    mediaType: MediaType,
    sourceGenres: string[] = [],
    talentNames: string[] = [],
): DailyPick | null => {
    const id = Number(raw?.id);

    if (!Number.isFinite(id) || id <= 0) return null;

    return {
        id,
        title: raw.title || raw.name || "Untitled",
        mediaType,
        posterPath: raw.poster_path ? `${IMAGE_BASE}${raw.poster_path}` : "",
        releaseDate: raw.release_date || raw.first_air_date || "",
        voteAverage: Number(raw.vote_average) || 0,
        voteCount: Number(raw.vote_count) || 0,
        popularity: Number(raw.popularity) || 0,
        genreIds: Array.isArray(raw.genre_ids)
            ? raw.genre_ids.map(Number).filter(Number.isFinite)
            : [],
        sourceGenres,
        talentNames,
    };
};

const DailyPicks: React.FC = () => {
    const { user } = useAuth();

    const [history, setHistory] = useState<HistorySignal[]>([]);
    const [favouriteTalents, setFavouriteTalents] = useState<
        FavouriteTalentSignal[]
    >([]);
    const [items, setItems] = useState<DailyPick[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) {
            setHistory([]);
            setFavouriteTalents([]);
            return;
        }

        const historyUnsubscribe = onSnapshot(
            collection(db, `users/${user.uid}/history`),
            (snapshot) => {
                const nextHistory = snapshot.docs.map((historyDoc) => {
                    const data = historyDoc.data();
                    const rawType = data.mediaType;
                    const mediaType: MediaType = rawType === "tv" ? "tv" : "movie";

                    return {
                        id: String(data.movieId ?? data.id ?? historyDoc.id),
                        mediaType,
                        genres: Array.isArray(data.genres)
                            ? data.genres.filter(
                                (genre: unknown): genre is string =>
                                    typeof genre === "string" && Boolean(genre.trim()),
                            )
                            : [],
                    };
                });

                setHistory(nextHistory);
            },
            () => setHistory([]),
        );

        const talentsUnsubscribe = onSnapshot(
            collection(db, `users/${user.uid}/favouriteTalents`),
            (snapshot) => {
                const nextTalents = snapshot.docs
                    .map((talentDoc) => {
                        const data = talentDoc.data();
                        const id = String(data.talentId ?? data.id ?? "");

                        if (!id) return null;

                        return {
                            id,
                            name: String(data.name || "Favourite talent"),
                        };
                    })
                    .filter(
                        (
                            talent,
                        ): talent is FavouriteTalentSignal => talent !== null,
                    );

                setFavouriteTalents(nextTalents);
            },
            () => setFavouriteTalents([]),
        );

        return () => {
            historyUnsubscribe();
            talentsUnsubscribe();
        };
    }, [user?.uid]);

    const topGenres = useMemo(() => {
        const counts = new Map<string, { label: string; count: number }>();

        history.forEach((item) => {
            item.genres.forEach((genre) => {
                const key = normalizeGenre(genre);
                if (!key) return;

                const previous = counts.get(key);
                counts.set(key, {
                    label: previous?.label || genre,
                    count: (previous?.count || 0) + 1,
                });
            });
        });

        return [...counts.values()]
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
            .slice(0, 3)
            .map((item) => item.label);
    }, [history]);

    useEffect(() => {
        let cancelled = false;

        const fetchDailyPicks = async () => {
            setLoading(true);

            try {
                const genreResponses = await Promise.all([
                    axios
                        .get(`${TMDB_BASE}/genre/movie/list`, {
                            params: {
                                api_key: TMDB_API_KEY,
                                language: "en-US",
                            },
                        })
                        .catch(() => ({ data: { genres: [] } })),
                    axios
                        .get(`${TMDB_BASE}/genre/tv/list`, {
                            params: {
                                api_key: TMDB_API_KEY,
                                language: "en-US",
                            },
                        })
                        .catch(() => ({ data: { genres: [] } })),
                ]);

                const genreMaps: GenreMaps = {
                    movie: new Map<string, number>(),
                    tv: new Map<string, number>(),
                };

                (genreResponses[0].data.genres || []).forEach((genre: any) => {
                    if (genre?.name && genre?.id) {
                        genreMaps.movie.set(normalizeGenre(genre.name), Number(genre.id));
                    }
                });

                (genreResponses[1].data.genres || []).forEach((genre: any) => {
                    if (genre?.name && genre?.id) {
                        genreMaps.tv.set(normalizeGenre(genre.name), Number(genre.id));
                    }
                });

                const topGenreIds = {
                    movie: new Map<number, string>(),
                    tv: new Map<number, string>(),
                };

                topGenres.forEach((genreName) => {
                    const normalized = normalizeGenre(genreName);
                    const movieGenreId = genreMaps.movie.get(normalized);
                    const tvGenreId = genreMaps.tv.get(normalized);

                    if (movieGenreId) topGenreIds.movie.set(movieGenreId, genreName);
                    if (tvGenreId) topGenreIds.tv.set(tvGenreId, genreName);
                });

                const candidates = new Map<string, DailyPick>();
                const watchedKeys = new Set(
                    history.map((item) => `${item.mediaType}-${item.id}`),
                );

                const addPick = (pick: DailyPick | null) => {
                    if (!pick || !pick.posterPath) return;
                    if (watchedKeys.has(`${pick.mediaType}-${pick.id}`)) return;
                    mergePick(candidates, pick);
                };

                const trendingRequests: Promise<void>[] = (
                    ["movie", "tv"] as MediaType[]
                ).map(async (mediaType) => {
                    try {
                        const response = await axios.get(
                            `${TMDB_BASE}/trending/${mediaType}/day`,
                            {
                                params: {
                                    api_key: TMDB_API_KEY,
                                    language: "en-US",
                                },
                            },
                        );

                        (response.data.results || []).forEach((raw: any) => {
                            const rawGenreIds = Array.isArray(raw.genre_ids)
                                ? raw.genre_ids.map(Number)
                                : [];

                            const matchedGenres = rawGenreIds
                                .map((genreId: number) => topGenreIds[mediaType].get(genreId))
                                .filter(
                                    (genreName: string | undefined): genreName is string =>
                                        Boolean(genreName),
                                );

                            if (topGenres.length > 0 && matchedGenres.length === 0) return;

                            addPick(toPick(raw, mediaType, matchedGenres));
                        });
                    } catch {
                        return;
                    }
                });

                const discoverRequests: Promise<void>[] = (
                    ["movie", "tv"] as MediaType[]
                ).map(async (mediaType) => {
                    const ids = [...topGenreIds[mediaType].keys()];
                    if (!ids.length) return;

                    try {
                        const response = await axios.get(
                            `${TMDB_BASE}/discover/${mediaType}`,
                            {
                                params: {
                                    api_key: TMDB_API_KEY,
                                    language: "en-US",
                                    sort_by: "popularity.desc",
                                    with_genres: ids.join("|"),
                                    "vote_count.gte": mediaType === "movie" ? 100 : 50,
                                    page: 1,
                                },
                            },
                        );

                        (response.data.results || []).slice(0, 14).forEach((raw: any) => {
                            const rawGenreIds = Array.isArray(raw.genre_ids)
                                ? raw.genre_ids.map(Number)
                                : [];

                            const matchedGenres = rawGenreIds
                                .map((genreId: number) => topGenreIds[mediaType].get(genreId))
                                .filter(
                                    (genreName: string | undefined): genreName is string =>
                                        Boolean(genreName),
                                );

                            addPick(toPick(raw, mediaType, matchedGenres));
                        });
                    } catch {
                        return;
                    }
                });

                const talentRequests = favouriteTalents
                    .slice(0, 8)
                    .map(async (talent) => {
                        try {
                            const response = await axios.get(
                                `${TMDB_BASE}/person/${talent.id}/combined_credits`,
                                {
                                    params: {
                                        api_key: TMDB_API_KEY,
                                        language: "en-US",
                                    },
                                },
                            );

                            (response.data.cast || [])
                                .filter(
                                    (raw: any) =>
                                        raw.media_type === "movie" || raw.media_type === "tv",
                                )
                                .sort(
                                    (a: any, b: any) =>
                                        Number(b.popularity || 0) - Number(a.popularity || 0),
                                )
                                .slice(0, 18)
                                .forEach((raw: any) => {
                                    const mediaType: MediaType =
                                        raw.media_type === "tv" ? "tv" : "movie";

                                    const matchedGenres = Array.isArray(raw.genre_ids)
                                        ? raw.genre_ids
                                            .map((genreId: number) =>
                                                topGenreIds[mediaType].get(Number(genreId)),
                                            )
                                            .filter(
                                                (
                                                    genreName: string | undefined,
                                                ): genreName is string => Boolean(genreName),
                                            )
                                        : [];

                                    addPick(
                                        toPick(
                                            raw,
                                            mediaType,
                                            matchedGenres,
                                            [talent.name],
                                        ),
                                    );
                                });
                        } catch {
                            return;
                        }
                    });

                await Promise.allSettled([
                    ...trendingRequests,
                    ...discoverRequests,
                    ...talentRequests,
                ]);

                if (candidates.size < 8) {
                    const fallbackResponses = await Promise.all([
                        axios
                            .get(`${TMDB_BASE}/trending/movie/day`, {
                                params: { api_key: TMDB_API_KEY },
                            })
                            .catch(() => ({ data: { results: [] } })),
                        axios
                            .get(`${TMDB_BASE}/trending/tv/day`, {
                                params: { api_key: TMDB_API_KEY },
                            })
                            .catch(() => ({ data: { results: [] } })),
                    ]);

                    (fallbackResponses[0].data.results || []).forEach((raw: any) =>
                        addPick(toPick(raw, "movie")),
                    );
                    (fallbackResponses[1].data.results || []).forEach((raw: any) =>
                        addPick(toPick(raw, "tv")),
                    );
                }

                const ranked = [...candidates.values()]
                    .map((pick) => {
                        const personalSignals =
                            pick.sourceGenres.length * 3.5 +
                            pick.talentNames.length * 4.5;
                        const quality =
                            pick.voteAverage * 0.55 +
                            Math.min(2.5, Math.log10(pick.voteCount + 1));
                        const freshnessTieBreak =
                            (hashString(`${daySeed()}-${pick.mediaType}-${pick.id}`) % 1000) /
                            1000;

                        return {
                            pick,
                            score: personalSignals + quality + freshnessTieBreak * 0.8,
                        };
                    })
                    .sort((a, b) => b.score - a.score);

                const topBand = seededShuffle(
                    ranked.slice(0, 12),
                    `${daySeed()}-top`,
                );
                const discoveryBand = seededShuffle(
                    ranked.slice(12),
                    `${daySeed()}-discovery`,
                );

                const selected = [...topBand.slice(0, 9), ...discoveryBand.slice(0, 7)]
                    .slice(0, 16)
                    .map((entry) => entry.pick);

                if (!cancelled) {
                    setItems(selected);
                }
            } catch {
                if (!cancelled) {
                    setItems([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchDailyPicks();

        return () => {
            cancelled = true;
        };
    }, [history, favouriteTalents, topGenres]);

    const todayLabel = useMemo(
        () =>
            new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            }),
        [],
    );

    if (!user) return null;

    return (
        <section className="relative mb-8 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif] tracking-tight antialiased sm:mb-14">
            <div className="relative overflow-hidden rounded-[32px] border border-white/20 bg-black p-4 shadow-2xl sm:rounded-[38px] sm:p-6">
                <div className="relative z-10 mb-4 flex flex-col gap-3 border-b border-blue-900/30 pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src="/dailypicks.png"
                            alt="Daily Picks Icon"
                            className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                        />

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <h2 className="truncate text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                                    Daily Picks
                                </h2>
                                <span className="mb-0.5 rounded-full border border-blue-500/20 bg-blue-950/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400 sm:mb-1">
                                    For You
                                </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-zinc-400">
                                Fresh picks shaped by what you watch and who you follow
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {topGenres.map((genre) => (
                            <span
                                key={genre}
                                className="shrink-0 rounded-full border border-blue-800/40 bg-blue-950/20 px-3 py-1 text-[10px] font-semibold text-white/80"
                            >
                                {genre}
                            </span>
                        ))}
                        {topGenres.length > 0 && (
                            <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-800" />
                        )}
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950 px-3 py-1 text-[10px] font-medium text-zinc-400">
                            <CalendarDays className="h-3 w-3 text-emerald-600" />
                            {todayLabel}
                        </span>
                    </div>
                </div>

                <div className="relative z-10">
                    {loading ? (
                        <div className="flex min-h-[220px] items-center gap-3 overflow-hidden py-2">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="w-32 shrink-0 sm:w-36"
                                >
                                    <div className="aspect-[2/3] animate-pulse rounded-[22px] border border-blue-950 bg-black" />
                                    <div className="mt-2.5 h-3.5 w-4/5 animate-pulse rounded-full bg-zinc-900" />
                                </div>
                            ))}
                        </div>
                    ) : items.length > 0 ? (
                        <>
                            <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-2 pb-4 pt-1 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
                                {items.map((item, index) => {
                                    const year = item.releaseDate
                                        ? new Date(item.releaseDate).getFullYear()
                                        : null;
                                    const primaryReason =
                                        item.talentNames[0] || item.sourceGenres[0] || "";
                                    const isTalentPick = Boolean(item.talentNames.length);

                                    return (
                                        <motion.div
                                            key={`${item.mediaType}-${item.id}`}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{
                                                duration: 0.4,
                                                delay: Math.min(index * 0.035, 0.3),
                                                ease: [0.16, 1, 0.3, 1],
                                            }}
                                            whileTap={{ scale: 0.96 }}
                                            className="group w-32 shrink-0 snap-start active:opacity-90 sm:w-36 md:w-40"
                                        >
                                            <Link
                                                to={`/${item.mediaType}/${item.id}`}
                                                className="block"
                                            >
                                                <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] border border-blue-900/30 bg-black shadow-md transition-all duration-500 group-hover:border-white/30 group-hover:shadow-[0_8px_30px_rgba(255,255,255,0.12)]">
                                                    <img
                                                        src={item.posterPath}
                                                        alt={item.title}
                                                        loading="lazy"
                                                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                                    />

                                                    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                                                        <div className="h-full w-full -translate-x-full -translate-y-full transform bg-gradient-to-br from-transparent via-white/30 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full group-hover:translate-y-full" />
                                                    </div>

                                                    <div className="absolute left-2 right-2 top-2 z-30 flex items-start justify-between gap-1">
                                                        {item.voteAverage > 0 ? (
                                                            <span className="flex h-5 items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 text-[9px] font-bold text-amber-400">
                                                                <Star className="h-2.5 w-2.5 fill-amber-400" />
                                                                {item.voteAverage.toFixed(1)}
                                                            </span>
                                                        ) : (
                                                            <span />
                                                        )}

                                                        <span
                                                            className={`flex h-5 items-center rounded-full border border-white/10 bg-black/60 px-2 text-[8px] font-black uppercase tracking-wider ${item.mediaType === "tv"
                                                                ? "text-cyan-400"
                                                                : "text-white/80"
                                                                }`}
                                                        >
                                                            {item.mediaType === "tv" ? "TV" : "Film"}
                                                        </span>
                                                    </div>

                                                    {primaryReason && (
                                                        <div className="absolute bottom-2 left-2 right-2 z-30">
                                                            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[8px] font-bold text-blue-200">
                                                                {isTalentPick ? (
                                                                    <UserRound className="h-2.5 w-2.5 shrink-0 text-cyan-400" />
                                                                ) : (
                                                                    <Clapperboard className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                                                                )}
                                                                <span className="truncate">
                                                                    {isTalentPick
                                                                        ? `With ${primaryReason}`
                                                                        : primaryReason}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="px-1 pt-2.5">
                                                    <h3 className="truncate text-xs font-bold text-zinc-100 transition-colors duration-200 group-hover:text-blue-400 sm:text-sm">
                                                        {item.title}
                                                    </h3>
                                                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-zinc-500">
                                                        {item.mediaType === "tv" ? (
                                                            <Tv className="h-3 w-3 text-cyan-500" />
                                                        ) : (
                                                            <Clapperboard className="h-3 w-3 text-amber-500" />
                                                        )}
                                                        <span>{year || "—"}</span>
                                                    </div>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            <div className="mt-1 flex items-center justify-between border-t border-blue-900/30 px-1 pt-3 text-[11px] font-semibold text-zinc-500">
                                <span>Refreshes with your taste each day</span>
                                <span>{items.length} picks</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-900/40 bg-black">
                                <Clapperboard className="h-6 w-6 text-amber-400" />
                            </div>
                            <h3 className="text-base font-bold text-white">
                                Your Daily Picks are warming up
                            </h3>
                            <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-400">
                                Watch a few titles or follow your favourite talents and this section will become more personal.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default DailyPicks;