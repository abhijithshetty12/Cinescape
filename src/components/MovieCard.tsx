import React, { useEffect, useState } from "react";
import { Star, } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.ts";

interface MovieCardProps {
  id: number;
  title?: string;
  name?: string;
  vote_average?: number;
  backdrop_path?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  media_type?: "movie" | "tv";
}

const genreMapping: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};

const API_KEY = "859afbb4b98e3b467da9c99ac390e950";

const MovieCard: React.FC<MovieCardProps> = ({
  id,
  title,
  name,
  vote_average,
  backdrop_path,
  poster_path,
  release_date,
  first_air_date,
  genre_ids,
  genres,
  media_type,
}) => {
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadRating = async () => {
      try {
        const ref = doc(db, "ratings", String(id));
        const snap = await getDoc(ref);
        if (mounted && snap.exists()) {
          const data = snap.data();
          const r = typeof data?.rating === "number" ? data.rating : null;
          setUserRating(r);
        }
      } catch {
        if (mounted) setUserRating(null);
      }
    };
    loadRating();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleMouseEnter = async () => {
    setIsHovered(true);
    setIsPlaying(true);
    try {
      const type = media_type || (title ? "movie" : "tv");
      const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${API_KEY}`
      );
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.results) && data.results.length) {
        const trailer =
          data.results.find((v: any) => v.type === "Trailer" && v.site === "YouTube") ||
          data.results.find((v: any) => v.site === "YouTube");
        if (trailer && trailer.key) {
          setTrailerUrl(`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3`);
          return;
        }
      }
      setTrailerUrl(null);
    } catch {
      setTrailerUrl(null);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPlaying(false);
    setTrailerUrl(null);
  };

  const isTvShow = media_type === "tv" || (!title && name);
  const imagePath = backdrop_path || poster_path || "";
  const imageSrc = imagePath
    ? `https://image.tmdb.org/t/p/w780${imagePath}`
    : "/placeholder-poster.png";

  const date = release_date || first_air_date || "";
  const year = date ? String(new Date(date).getFullYear()) : "—";
  const displayTitle = title || name || "Untitled";
  const rating = typeof vote_average === "number" ? vote_average.toFixed(1) : "0.0";

  const genreNames: string[] =
    Array.isArray(genre_ids) && genre_ids.length
      ? genre_ids.map((gid) => genreMapping[gid]).filter(Boolean)
      : Array.isArray(genres) && genres.length
        ? genres.map((g) => g.name).filter(Boolean)
        : [];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col w-full overflow-hidden rounded-2xl bg-[#0d0d11] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
      style={{
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.04) inset"
      }}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#070709] select-none">

        <img
          src={imageSrc}
          alt={displayTitle}
          className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 group-hover:blur-[2px] opacity-90 group-hover:opacity-40"
          loading="lazy"
        />

        <div className="absolute inset-0 pointer-events-none transition-all duration-500 group-hover:bg-gradient-to-b group-hover:from-white/[0.02] group-hover:to-transparent z-10" />

        <div
          className={`absolute top-3.5 inset-x-3.5 flex items-center justify-between pointer-events-none z-30 transition-opacity duration-300 ${trailerUrl && isPlaying && isHovered ? "opacity-0" : "opacity-100"
            }`}
        >
          <div className="flex items-center gap-1.5">
            {userRating !== null && (
              <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-lg px-2 py-1 shadow-lg text-[11px] font-bold tracking-tight text-red-400">
                ★ {userRating}
              </div>
            )}
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg px-2 py-1 shadow-lg">
              <Star className="w-3 h-3 text-amber-400 fill-current" />
              <span className="text-zinc-100 text-[11px] font-bold tracking-wide">
                {rating}
              </span>
            </div>
          </div>
        </div>

        {trailerUrl && isPlaying && (
          <div className={`absolute inset-0 z-0 h-full w-full pointer-events-none transition-opacity duration-700 ${isHovered ? "opacity-100 delay-300" : "opacity-0"}`}>
            <iframe
              src={trailerUrl}
              className="w-full h-full scale-[1.05] object-cover"
              allow="autoplay; fullscreen"
              title={`${displayTitle} Engine`}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 bg-[#0d0d11]">
        <div className="flex items-start justify-between gap-4 mb-2.5">
          <h3 className="font-semibold text-[15px] text-zinc-100 leading-snug tracking-tight group-hover:text-white transition-colors duration-300 line-clamp-1">
            {displayTitle}
          </h3>
          <span className="text-zinc-600 font-medium text-[12px] tracking-widest shrink-0 pt-0.5 font-mono">
            {year}
          </span>
        </div>

        {genreNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {genreNames.slice(0, 2).map((name, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2.5 py-0.5 bg-zinc-900 border border-zinc-800/80 rounded-md text-zinc-400 font-medium tracking-wide transition-colors duration-300 group-hover:border-zinc-700/60 group-hover:text-zinc-300"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="absolute inset-0 rounded-2xl border border-white/0 pointer-events-none transition-all duration-500 group-hover:border-white/[0.06] z-40" />
    </div>
  );
};

export default MovieCard;