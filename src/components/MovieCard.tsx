import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
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
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
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
    setIsPlaying(true);
    try {
      const type = media_type || (title ? "movie" : "tv");
      const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${API_KEY}`
      );
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.results) && data.results.length) {
        const trailer =
          data.results.find(
            (v: any) => v.type === "Trailer" && v.site === "YouTube"
          ) || data.results.find((v: any) => v.site === "YouTube");
        if (trailer && trailer.key) {
          setTrailerUrl(
            `https://www.youtube.com/embed/${trailer.key}?autoplay=1`
          );
          return;
        }
      }
      setTrailerUrl(null);
    } catch {
      setTrailerUrl(null);
    }
  };

  const handleMouseLeave = () => {
    setIsPlaying(false);
    setTrailerUrl(null);
  };

  const imagePath = backdrop_path || poster_path || "";
  const imageSrc = imagePath
    ? `https://image.tmdb.org/t/p/w780${imagePath}`
    : "/placeholder-poster.png";

  const date = release_date || first_air_date || "";
  const year = date ? String(new Date(date).getFullYear()) : "N/A";
  const displayTitle = title || name || "Untitled";
  const rating =
    typeof vote_average === "number" ? vote_average.toFixed(1) : "N/A";

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
      className="group relative rounded-2xl overflow-hidden border border-white/[0.07] bg-black/50 shadow-lg hover:shadow-xl hover:shadow-red-900/25 hover:border-red-500/25 hover:-translate-y-0.5 transition-all duration-500 cursor-pointer"
      style={{
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Image section */}
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={imageSrc}
          alt={displayTitle}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
        />

        {/* Bottom gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {/* Subtle red tint on hover */}
        <div className="absolute inset-0 bg-red-900/0 group-hover:bg-red-900/10 transition-colors duration-500 pointer-events-none" />

        {/* TMDB rating badge — top right */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-white/[0.1] rounded-md px-2 py-0.5 shadow-md">
          <Star className="w-3 h-3 text-yellow-400 fill-current" />
          <span className="text-white text-[11px] font-bold leading-none">
            {rating}
          </span>
        </div>

        {/* User rating badge — top left */}
        {userRating !== null && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-red-950/80 backdrop-blur-sm border border-red-500/30 rounded-md px-2 py-0.5 shadow-md">
            <span className="text-red-300 text-[11px] font-bold leading-none">
              ★ {userRating}
            </span>
          </div>
        )}

        {/* Trailer iframe */}
        {trailerUrl && isPlaying && (
          <iframe
            src={trailerUrl}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; fullscreen"
            allowFullScreen
            title={displayTitle + " Trailer"}
          />
        )}
      </div>

      {/* Info section */}
      <div
        className="px-3.5 py-3 flex flex-col gap-1.5"
        style={{
          background:
            "linear-gradient(to bottom, rgba(12,0,0,0.75), rgba(0,0,0,0.88))",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-white leading-snug truncate">
            {displayTitle}
          </h3>
          <span className="text-zinc-600 text-xs flex-shrink-0 pt-0.5">
            {year}
          </span>
        </div>

        {genreNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genreNames.slice(0, 2).map((gName, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 bg-red-950/50 border border-red-800/30 rounded-full text-red-300/80 font-medium"
              >
                {gName}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Inset red glow ring on hover */}
      <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 group-hover:ring-red-500/20 pointer-events-none transition-all duration-500" />
    </div>
  );
};

export default MovieCard;
