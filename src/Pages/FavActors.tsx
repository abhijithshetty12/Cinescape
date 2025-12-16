import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import { motion } from 'framer-motion';
import { Heart, ImageOff, Star, Users } from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, onSnapshot } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext.tsx';

const FavoriteActorPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [favoriteActors, setFavoriteActors] = useState<{ id: string; name: string; profilePath: string }[]>([]);

  useEffect(() => {
    if (user?.uid) {
      const favouriteActorsRef = collection(db, `users/${user.uid}/favouriteActors`);
      const unsubscribe = onSnapshot(favouriteActorsRef, (snapshot) => {
        const actorMap = new Map<string, { id: string; name: string; profilePath: string }>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const id = data.actorId || data.id;
          if (id && data.name && !actorMap.has(id)) {
            actorMap.set(id, {
              id,
              name: data.name,
              profilePath: data.profile_path ? `https://image.tmdb.org/t/p/w500${data.profile_path}` : '',
            });
          }
        });
        setFavoriteActors(Array.from(actorMap.values()));
      });

      return () => unsubscribe();
    }
  }, [user?.uid]);

  const hasActors = favoriteActors.length > 0;
  const actorCount = favoriteActors.length;

  if (!hasActors) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center">
              <Heart className="w-12 h-12 text-gray-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">No Favorite Actors Found</h1>
            <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
              Start building your collection by adding your favorite actors from their profile pages.
            </p>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-500/25"
            >
              <Users className="w-5 h-5" />
              Discover Actors
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 md:mb-12"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
              <Heart className="text-white w-8 h-8 md:w-10 md:h-10" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">
                Favourite Actors
              </h1>
              <p className="text-gray-400 text-sm md:text-base mt-1">
                {`${actorCount} ${actorCount === 1 ? 'actor' : 'actors'} in your collection`}
              </p>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6"
      >
        {favoriteActors.map((actor, index) => {
          const actorImageUrl = actor.profilePath;
          const actorName = actor.name ?? 'Unknown Actor';

          return (
            <motion.div
              key={actor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                to={`/actor/${actor.id}`}
                className="group block bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700/30 hover:border-gray-600/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  {actor.profilePath ? (
                    <img
                      src={actorImageUrl}
                      alt={`${actorName} profile`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center text-gray-400">
                      <ImageOff className="w-12 h-12 md:w-16 md:h-16 mb-2 opacity-60" />
                      <span className="text-xs md:text-sm text-center px-2">No Image Available</span>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-full shadow-lg">
                    <Heart className="w-3 h-3 md:w-4 md:h-4 text-white fill-current" />
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <div className="p-3 md:p-4">
                  <h2 className="font-bold text-sm md:text-base lg:text-lg text-white mb-1 truncate group-hover:text-green-400 transition-colors duration-300">
                    {actorName}
                  </h2>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-12 text-center"
      >
        <div className="inline-flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm px-6 py-3 rounded-full border border-gray-700/50">
          <Star className="w-5 h-5 text-yellow-400 fill-current" />
          <span className="text-gray-300 text-sm md:text-base">
            {`You've favorited ${actorCount} talented ${actorCount === 1 ? 'actor' : 'actors'}`}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default FavoriteActorPage;