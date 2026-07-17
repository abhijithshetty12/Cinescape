import React, { useEffect, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Star, Trash2, Calendar, MessageSquare, Quote } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ReviewItem {
  id: string;
  content: string;
  author: string;
  timestamp: any;
  title?: string;
  rating?: number;
  movieId?: string;
  posterPath?: string;
  mediaType?: 'movie' | 'tv';
}

const ReviewList = ({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const userUnsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setUserPhoto(snap.data().photoDataUrl ?? null);
      }
    });

    const reviewsRef = collection(db, `users/${userId}/reviews`);
    const reviewsQuery = query(reviewsRef, orderBy('timestamp', 'desc'));
    const reviewsUnsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      const reviewArr = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          content: data.content ?? '',
          author: data.author ?? 'Unknown',
          timestamp: data.timestamp ?? null,
          title: data.title ?? '',
          rating: data.rating ?? undefined,
          movieId: data.movieId ?? undefined,
          posterPath: data.posterPath ?? undefined,
          mediaType: data.mediaType ?? 'movie',
        };
      });
      setReviews(reviewArr);
    });

    return () => {
      userUnsubscribe();
      reviewsUnsubscribe();
    };
  }, [userId]);

  const handleDelete = async (reviewId: string) => {
    if (!userId || !reviewId) return;
    try {
      await deleteDoc(doc(db, `users/${userId}/reviews/${reviewId}`));
    } catch (error) {
      console.error('Error deleting review:', error);
    }
  };

  if (reviews.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[32px] border border-white/[0.04] bg-zinc-950/20 p-8 sm:p-12 text-center backdrop-blur-3xl shadow-2xl max-w-md mx-auto">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center max-w-xs mx-auto">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.01] border border-white/[0.05] text-zinc-600 mb-5 shadow-inner">
            <MessageSquare className="w-5 h-5 stroke-[1.2] text-emerald-500/80" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight uppercase">Timeline Empty</h3>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            Your critique panel is clear. Author a review inside any title catalog to map your cinematic footprint here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'flex gap-4 overflow-x-auto pb-4 pt-1 px-1 -mx-1 scrollbar-none snap-x snap-mandatory'
          : 'grid grid-cols-1 lg:grid-cols-2 gap-4 w-full'
      }
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {reviews.slice(0, compact ? 6 : reviews.length).map((review) => {
        const cardContent = (
          <>
            <div className="absolute inset-0 z-0 pointer-events-none">
              {review.posterPath && (
                <div className="absolute right-0 top-0 bottom-0 w-2/3 opacity-[0.03] group-hover:opacity-[0.08] blur-[2px] group-hover:blur-0 group-hover:scale-105 transition-all duration-700 overflow-hidden mix-blend-luminosity">
                  <img
                    src={`https://image.tmdb.org/t/p/w342${review.posterPath}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent" />
                </div>
              )}
              <div className="absolute -inset-px rounded-[20px] sm:rounded-[24px] border border-transparent group-hover:border-emerald-500/20 bg-gradient-to-b from-white/[0.06] to-transparent [mask-image:linear-gradient(to_bottom,white,transparent)] group-hover:[mask-image:none] transition-all duration-500" />
            </div>

            <div className="relative z-10 flex flex-row gap-3.5 items-start w-full h-full">
              {review.posterPath && (
                <div className="relative w-14 h-20 sm:w-20 sm:h-28 rounded-lg sm:rounded-xl overflow-hidden border border-white/[0.06] shrink-0 bg-zinc-950 shadow-xl group-hover:border-emerald-500/30 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-500 self-start">
                  <img
                    src={`https://image.tmdb.org/t/p/w185${review.posterPath}`}
                    alt={review.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0 flex flex-col justify-between h-full min-h-[80px] sm:min-h-[112px] w-full">
                <div className="space-y-1 sm:space-y-1.5 w-full">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full overflow-hidden bg-zinc-900 border border-white/[0.08] shrink-0">
                        <img
                          src={userPhoto || '/user-icon.jpg'}
                          alt={review.author}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="font-bold text-zinc-400 text-[9px] sm:text-[10px] uppercase tracking-wider truncate">
                        {review.author}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-zinc-500 text-[8px] sm:text-[9px] font-semibold shrink-0 uppercase tracking-widest bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded pr-6 sm:pr-1.5">
                      <Calendar className="w-2.5 h-2.5 text-emerald-500/70" />
                      <span>
                        {review.timestamp?.seconds
                          ? new Date(review.timestamp.seconds * 1000).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Now'}
                      </span>
                    </div>
                  </div>

                  {review.title && (
                    <h4 className="text-xs sm:text-sm font-black text-white tracking-tight truncate group-hover:text-emerald-400 transition-colors duration-300">
                      {review.title}
                    </h4>
                  )}

                  <div className="relative pt-0.5 sm:pt-1">
                    <Quote className="absolute -left-1 -top-1.5 w-3 h-3 text-zinc-800 rotate-180 opacity-60 pointer-events-none" />
                    <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed font-normal line-clamp-2 pl-2.5 group-hover:text-zinc-300 transition-colors">
                      {review.content}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/[0.02]">
                  {review.rating ? (
                    <div className="flex items-center gap-1 bg-amber-500/[0.04] border border-amber-500/[0.12] px-1.5 sm:2 py-0.5 rounded-md sm:rounded-lg shadow-sm">
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                      <span className="text-[9px] sm:text-[10px] font-black text-amber-400 tracking-wider">
                        {review.rating.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  <span className="text-[8px] font-extrabold tracking-widest text-zinc-500 uppercase bg-zinc-900/60 border border-white/[0.04] px-1.5 py-0.5 rounded-md">
                    {review.mediaType || 'Movie'}
                  </span>
                </div>
              </div>
            </div>

            <button
              className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-zinc-500 bg-zinc-950/80 border border-white/[0.04] rounded-lg sm:rounded-xl opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-red-400 hover:border-red-500/30 hover:bg-red-950/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all duration-300 backdrop-blur-md"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete(review.id);
              }}
            >
              <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </button>
          </>
        );

        const baseStyles = `group relative flex flex-col bg-zinc-950/30 border border-white/[0.03] rounded-[20px] sm:rounded-[24px] p-3 sm:p-4 backdrop-blur-3xl transition-all duration-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.04)] ${
          compact ? 'w-[260px] sm:w-[340px] flex-shrink-0 snap-start' : 'w-full'
        }`;

        return review.movieId ? (
          <Link
            key={review.id}
            to={review.mediaType === 'tv' ? `/tv/${review.movieId}` : `/movie/${review.movieId}`}
            className={`${baseStyles} hover:bg-zinc-950/50 active:scale-[0.995]`}
          >
            {cardContent}
          </Link>
        ) : (
          <div key={review.id} className={baseStyles}>
            {cardContent}
          </div>
        );
      })}
    </div>
  );
};

export default ReviewList;