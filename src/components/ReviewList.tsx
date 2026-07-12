import React, { useEffect, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Star, Trash2, Calendar, MessageSquare } from 'lucide-react';
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
      <div className="relative flex flex-col items-center justify-center py-8 px-3 rounded-2xl bg-neutral-900/30 border border-white/[0.05] backdrop-blur-md max-w-xs mx-auto overflow-hidden text-center">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
        </div>
        <h4 className="text-white/80 font-semibold text-xs mb-0.5 tracking-wide">No Reviews Yet</h4>
        <p className="text-zinc-500 text-[10px] max-w-[180px] leading-tight">Your movie log is waiting for your thoughts.</p>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'flex gap-2.5 overflow-x-auto pb-2 pt-1 px-1 -mx-1 scrollbar-none snap-x snap-mandatory'
          : 'grid grid-cols-1 sm:grid-cols-2 gap-3 w-full'
      }
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {reviews.slice(0, compact ? 6 : reviews.length).map((review) => {
        const cardContent = (
          <>
            {/* Hover Shine Effect */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent skew-x-[-20deg] transition-transform duration-700 ease-in-out" />
            </div>

            <div className="relative z-10 flex flex-col h-full w-full justify-between gap-2">
              <div>
                {/* Header: Author & Timestamp */}
                <div className="flex items-center justify-between gap-2 mb-2 pr-5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-3.5 h-3.5 rounded-full overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                      <img
                        src={userPhoto || '/user-icon.jpg'}
                        alt={review.author}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-medium text-white/80 text-[10px] truncate">{review.author}</span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400 text-[9px] shrink-0">
                    <Calendar className="w-2 h-2 text-emerald-400/80" />
                    <span>
                      {review.timestamp?.seconds
                        ? new Date(review.timestamp.seconds * 1000).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Recent'}
                    </span>
                  </div>
                </div>

                {/* Main Content Row */}
                <div className="flex gap-2.5 items-start">
                  {review.posterPath && (
                    <div className="w-10 h-14 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-zinc-900 shadow-md">
                      <img
                        src={`https://image.tmdb.org/t/p/w185${review.posterPath}`}
                        alt={review.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {review.title && (
                      <h4 className="text-xs font-semibold text-white/90 truncate group-hover:text-emerald-400 transition-colors duration-200 mb-0.5">
                        {review.title}
                      </h4>
                    )}
                    <p className="text-zinc-400 text-[11px] leading-tight line-clamp-2 font-normal">
                      {review.content}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Rating Badge */}
              {review.rating && (
                <div className="flex items-center gap-1 w-fit bg-amber-500/10 border border-amber-500/20 backdrop-blur-md px-1.5 py-0.5 rounded shadow-sm">
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  <span className="text-[9px] font-bold text-amber-300 tracking-wider">
                    {review.rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Delete Button */}
            <button
              className="absolute top-2 right-2 z-20 flex items-center justify-center w-5 h-5 text-zinc-400 bg-neutral-950/60 border border-white/[0.08] rounded opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete(review.id);
              }}
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </>
        );

        const baseStyles = `group relative flex flex-col justify-between bg-gradient-to-b from-neutral-900/50 to-neutral-950/70 backdrop-blur-md rounded-xl p-2.5 border border-white/[0.06] hover:border-white/[0.15] shadow-md transition-all duration-200 ${
          compact ? 'w-[210px] flex-shrink-0 snap-start' : 'w-full'
        }`;

        return review.movieId ? (
          <Link
            key={review.id}
            to={review.mediaType === 'tv' ? `/tv/${review.movieId}` : `/movie/${review.movieId}`}
            className={`${baseStyles} hover:scale-[1.01] active:scale-[0.99]`}
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