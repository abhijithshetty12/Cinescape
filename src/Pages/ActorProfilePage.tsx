import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import Loading from '../components/Loading.tsx';

interface Actor {
  id: number;
  name: string;
  profile_path: string;
}

const ActorProfiles = () => {
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [movies, setMovies] = useState<{ [key: number]: string[] }>({});

  useEffect(() => {
    const fetchPopularActors = async () => {
      try {
        const response = await axios.get('https://api.themoviedb.org/3/person/popular?api_key=734a09c1281680980a71703eb69d9571');
        setActors(response.data.results.slice(0, 20));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching popular actors:', error);
        setLoading(false);
      }
    };

    fetchPopularActors();
  }, []);

  useEffect(() => {
    const fetchMoviesForActors = async () => {
      const actorMovies: { [key: number]: string[] } = {};
      for (const actor of actors) {
        try {
          const response = await axios.get(`https://api.themoviedb.org/3/person/${actor.id}/movie_credits?api_key=734a09c1281680980a71703eb69d9571`);
          actorMovies[actor.id] = response.data.cast.map((movie: { title: string }) => movie.title);
        } catch (error) {
          console.error(`Error fetching movies for actor ${actor.id}:`, error);
        }
      }
      setMovies(actorMovies);
    };

    if (actors.length > 0) {
      fetchMoviesForActors();
    }
  }, [actors]);

  if (loading) {
    return <Loading />;
  }

  const loadMoreActors = async () => {
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/person/popular?api_key=859afbb4b98e3b467da9c99ac390e950&page=${page + 1}`);
      const {data} = response;
      setActors((prevActors) => [...prevActors, ...data.results]);
      setPage((prevPage) => prevPage + 1);
    } catch (error) {
      console.error('Error loading more actors:', error);
    }
  };

  return (
    <div className="bg-gradient-to-b from-zinc-950 via-zinc-900 to-black min-h-screen py-8">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4 mb-10"
        >
          <Users className="w-10 h-10 text-orange-500 drop-shadow" />
          <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow">Popular Actors</h1>
        </motion.div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5 sm:gap-8">
          {actors.length > 0 ? (
            actors.map((actor) => (
              <Link
                to={`/actor/${actor.id}`}
                key={actor.id}
                className="group bg-gradient-to-br from-zinc-900/80 to-zinc-800/60 rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-zinc-700 hover:border-orange-500"
              >
                <div className="relative">
                  <img
                    src={
                      actor.profile_path
                        ? `https://image.tmdb.org/t/p/w300${actor.profile_path}`
                        : "/path/to/default-image.jpg"
                    }
                    alt={actor.name}
                    className="w-full object-cover object-center transition-all duration-300 group-hover:scale-105 h-40 sm:h-64"
                  />
                </div>
                <div className="p-2 sm:p-4 flex flex-col gap-1">
                  <h2 className="font-bold text-base sm:text-lg text-white truncate">{actor.name}</h2>
                  <h3 className="text-xs text-orange-400 font-semibold mb-1">Movies:</h3>
                  <ul className="text-xs text-gray-300">
                    {movies[actor.id] && movies[actor.id].length > 0 ? (
                      movies[actor.id].slice(0, window.innerWidth < 640 ? 1 : 3).map((movie, index) => (
                        <li key={index} className="truncate">{movie}</li>
                      ))
                    ) : (
                      <li>No movies found</li>
                    )}
                  </ul>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-white">No actors found.</p>
          )}
        </div>
        <div className="flex justify-center mt-12">
          <button
            onClick={loadMoreActors}
            className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full shadow-lg hover:from-orange-600 hover:to-red-700 transition-all duration-300 font-bold text-lg tracking-wide disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActorProfiles;