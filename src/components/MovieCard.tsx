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
  37: "Western"
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
  media_type
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
          data.results.find((v: any) => v.type === "Trailer" && v.site === "YouTube") ||
          data.results.find((v: any) => v.site === "YouTube");
        if (trailer && trailer.key) {
          setTrailerUrl(`https://www.youtube.com/embed/${trailer.key}?autoplay=1`);
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
  const imageSrc = imagePath ? `https://image.tmdb.org/t/p/w500${imagePath}` : "/placeholder-poster.png";

  const date = release_date || first_air_date || "";
  const year = date ? String(new Date(date).getFullYear()) : "N/A";
  const displayTitle = title || name || "Untitled";
  const rating = typeof vote_average === "number" ? vote_average.toFixed(1) : "N/A";

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
      className="group bg-gradient-to-b from-black/20 to-transparent backdrop-blur-sm rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl hover:backdrop-blur-md hover:border-white/20 hover:ring-2 hover:ring-blue-500/30 transition-all duration-500 border border-white/10"
    >
      <div className="relative aspect-[16/9]">
        <img
          src={imageSrc}
          alt={displayTitle}
          className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-500"
        />
        <div className="absolute top-3 right-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-0.5 flex items-center gap-1 shadow-lg">
          <Star className="w-3 h-3 text-yellow-400 fill-current" />
          <span className="text-white font-bold">{rating}</span>
        </div>
        {userRating !== null && (
          <div className="absolute top-3 left-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-0.5 flex items-center gap-1 shadow-lg">
            <span className="text-orange-400 text-xs font-bold">User: {userRating}</span>
          </div>
        )}
        {trailerUrl && isPlaying && (
          <iframe
            src={trailerUrl}
            className="absolute top-0 left-0 w-full h-full rounded-3xl"
            allow="autoplay; fullscreen"
            allowFullScreen
            title={displayTitle + " Trailer"}
          />
        )}
        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-black/0 via-black/20 to-black/40 pointer-events-none" />
      </div>
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg text-white truncate">{displayTitle}</h3>
          <span className="text-gray-400 text-sm">{year}</span>
        </div>
        {genreNames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {genreNames.slice(0, 2).map((gName, idx) => (
              <span
                key={idx}
                className="text-[10px] sm:text-xs px-2 py-0.5 bg-zinc-800/80 border border-zinc-700/50 rounded-full text-zinc-300 font-medium"

              >
                {gName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieCard;

