import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Award, Star } from "react-feather";
import { Link } from "react-router-dom";

const TopRated = () => {
  const [media, setMedia] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mediaType, setMediaType] = useState("movie");
  const API_KEY = "859afbb4b98e3b467da9c99ac390e950";

  useEffect(() => {
    const fetchTopRated = async () => {
      setLoading(true);
      try {
        const API_URL = `https://api.themoviedb.org/3/${mediaType}/top_rated?api_key=${API_KEY}&language=en-US&page=${page}`;
        const response = await axios.get(API_URL);
        setMedia((prevMedia) =>
          page === 1
            ? response.data.results
            : [...prevMedia, ...response.data.results]
        );
      } catch (error) {
        console.error(`Error fetching top-rated ${mediaType}:`, error);
      }
      setLoading(false);
    };

    fetchTopRated();
  }, [page, mediaType]);

  const handleMediaTypeChange = (type) => {
    if (type !== mediaType) {
      setMediaType(type);
      setMedia([]);
      setPage(1);
    }
  };

  const loadMore = () => {
    setPage((prevPage) => prevPage + 1);
  };

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black min-h-screen py-8">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-6">
            <Award className="w-10 h-10 text-amber-400 drop-shadow" />
            <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow">
              Top Rated
            </h1>
          </div>
          <div className="flex items-center p-1 bg-zinc-900 rounded-full w-fit">
            <div className={`relative flex items-center rounded-full`}>
              <button
                onClick={() => handleMediaTypeChange("movie")}
                className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${
                  mediaType === "movie" ? "text-white" : "text-gray-400"
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => handleMediaTypeChange("tv")}
                className={`relative z-10 px-4 py-2 font-semibold transition-colors duration-300 rounded-full bg-transparent ${
                  mediaType === "tv" ? "text-white" : "text-gray-400"
                }`}
              >
                Series
              </button>
              <motion.div
                className="absolute inset-0 bg-red-600 rounded-full"
                animate={{
                  width: mediaType === "movie" ? "85px" : "80px",
                  x: mediaType === "movie" ? 0 : 85,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
          {media.map((item) => {
            const title = item.title || item.name || "Untitled";
            const poster = item.poster_path
              ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
              : "/path/to/default-image.jpg";
            const dateStr = item.release_date || item.first_air_date || "";
            const year = dateStr ? new Date(dateStr).getFullYear() : "N/A";
            const to =
              mediaType === "movie" ? `/movie/${item.id}` : `/tv/${item.id}`;

            return (
              <Link to={to} key={item.id}>
                <motion.div
                  className="group bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-zinc-700 hover:border-yellow-500"
                  whileHover={{ scale: 1.04, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="relative">
                    <img
                      src={poster}
                      alt={title}
                      className="w-full h-auto object-cover object-center transition-all duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-3 right-3 bg-black/70 rounded backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-white font-bold text-xs">
                        {item.vote_average?.toFixed(1) ?? "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-1">
                    <h2 className="text-lg font-bold text-white truncate">
                      {title}
                    </h2>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{year}</span>
                      <span className="uppercase">{mediaType}</span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
        <div className="flex justify-center mt-10">
          <button
            onClick={loadMore}
            disabled={loading}
            className="
                        px-4 py-2 sm:px-6 sm:py-3
                        bg-gradient-to-r from-orange-600/90 via-orange-400/90 to-red-600/90
                        text-white font-bold text-base sm:text-lg tracking-wide
                        rounded-xl sm:rounded-2xl
                        shadow-2xl
                        border border-orange-400/70
                        backdrop-blur-xl
                        transition-all duration-300
                        hover:from-orange-500/80 hover:via-yellow-400/70 hover:to-red-400/80
                        hover:scale-105
                        disabled:opacity-60
                        relative
                        overflow-hidden
                    "
            style={{
              WebkitBackdropFilter: "blur(20px)",
              backdropFilter: "blur(20px)",
            }}
          >
            <span className="relative z-10 drop-shadow-lg">
              {loading ? "Loading..." : "Load More"}
            </span>
            <span
              className="absolute inset-0 pointer-events-none animate-pulse"
              style={{
                background:
                  "linear-gradient(120deg, rgba(255,220,180,0.22) 0%, rgba(255,255,255,0.14) 100%)",
                opacity: 0.7,
              }}
            />
            <span
              className="absolute left-1/2 top-0 w-2/3 h-2/3 -translate-x-1/2 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,200,80,0.22) 0%, transparent 70%)",
                filter: "blur(10px)",
                opacity: 0.5,
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopRated;
