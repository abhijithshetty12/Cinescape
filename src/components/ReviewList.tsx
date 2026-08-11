import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase.ts';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Star, Trash2, Calendar, MessageSquare, Quote, Edit3, X, Check, Clapperboard, Tv } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

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

  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

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

  const handleOpenEdit = (review: ReviewItem) => {
    setEditingReview(review);
    setEditContent(review.content);
  };

  const handleCloseEdit = () => {
    setEditingReview(null);
    setEditContent('');
  };

  const handleUpdateReview = async () => {
    if (!userId || !editingReview) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, `users/${userId}/reviews/${editingReview.id}`), {
        content: editContent,
      });
      handleCloseEdit();
    } catch (error) {
      console.error('Error updating review:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (mediaType === 'movie') return review.mediaType === 'movie' || !review.mediaType;
    if (mediaType === 'tv') return review.mediaType === 'tv';
    return true;
  });

  const movieCount = reviews.filter((r) => r.mediaType === 'movie' || !r.mediaType).length;
  const tvCount = reviews.filter((r) => r.mediaType === 'tv').length;

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
    <div className="space-y-4 w-full">
      {!compact && (
        <div className="flex items-center justify-start">
          <div className="relative flex items-center p-0.5 bg-zinc-950/80 backdrop-blur-2xl border border-white/[0.06] rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMediaType('movie')}
              className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 font-bold text-[11px] sm:text-xs tracking-wide transition-all duration-300 rounded-lg select-none active:scale-95 ${
                mediaType === 'movie'
                  ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clapperboard
                className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${
                  mediaType === 'movie' ? 'scale-110 text-red-400' : ''
                }`}
              />
              <span>Movies</span>
              <span
                className={`ml-0.5 text-[9px] px-1 py-0.2 rounded font-extrabold transition-colors duration-300 ${
                  mediaType === 'movie'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.04]'
                }`}
              >
                {movieCount}
              </span>

              {mediaType === 'movie' && (
                <motion.div
                  layoutId="liquid-pill"
                  className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMediaType('tv')}
              className={`relative z-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 font-bold text-[11px] sm:text-xs tracking-wide transition-all duration-300 rounded-lg select-none active:scale-95 ${
                mediaType === 'tv'
                  ? 'text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tv
                className={`w-3.5 h-3.5 transition-transform duration-300 shrink-0 ${
                  mediaType === 'tv' ? 'scale-110 text-cyan-400' : ''
                }`}
              />
              <span>Series</span>
              <span
                className={`ml-0.5 text-[9px] px-1 py-0.2 rounded font-extrabold transition-colors duration-300 ${
                  mediaType === 'tv'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.04] text-zinc-500 border border-white/[0.04]'
                }`}
              >
                {tvCount}
              </span>

              {mediaType === 'tv' && (
                <motion.div
                  layoutId="liquid-pill"
                  className="absolute inset-0 -z-10 bg-gradient-to-b from-white/[0.08] to-white/[0.01] border border-white/[0.12] rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                />
              )}
            </button>

            <div className="absolute inset-y-0.5 left-0.5 right-0.5 pointer-events-none overflow-hidden rounded-lg">
              <motion.div
                className={`absolute top-0 bottom-0 w-1/2 blur-md opacity-80 transition-colors duration-500 ${
                  mediaType === 'movie'
                    ? 'bg-gradient-to-r from-red-500/10 via-red-500/20 to-orange-500/10'
                    : 'bg-gradient-to-l from-cyan-500/10 via-sky-500/20 to-blue-500/10'
                }`}
                animate={{
                  x: mediaType === 'movie' ? '0%' : '100%',
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 28 }}
              />
            </div>
          </div>
        </div>
      )}

      {filteredReviews.length === 0 ? (
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.04] bg-zinc-950/20 p-6 text-center backdrop-blur-2xl my-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            No {mediaType === 'movie' ? 'movie' : 'series'} reviews logged yet.
          </p>
        </div>
      ) : (
        <div
          className={
            compact
              ? 'flex gap-4 overflow-x-auto pb-4 pt-1 px-1 -mx-1 scrollbar-none snap-x snap-mandatory'
              : 'grid grid-cols-1 lg:grid-cols-2 gap-4 w-full'
          }
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {filteredReviews.slice(0, compact ? 6 : filteredReviews.length).map((review) => {
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
                        <div className="flex items-center gap-1 bg-amber-500/[0.04] border border-amber-500/[0.12] px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg shadow-sm">
                          <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                          <span className="text-[9px] sm:text-[10px] font-black text-amber-400 tracking-wider">
                            {review.rating.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-1 text-zinc-500 text-[8px] sm:text-[9px] font-semibold shrink-0 uppercase tracking-widest bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded">
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
                      <span className="order-first text-[8px] font-extrabold tracking-widest text-zinc-500 uppercase bg-zinc-900/60 border border-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">
                        {review.mediaType === 'tv' ? 'Series' : 'Movie'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex items-center gap-1">
                  <button
                    className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-zinc-500 bg-zinc-950/80 border border-white/[0.04] rounded-lg sm:rounded-xl opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-950/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all duration-300 backdrop-blur-md"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenEdit(review);
                    }}
                    title="Edit Review"
                  >
                    <Edit3 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  </button>

                  <button
                    className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-zinc-500 bg-zinc-950/80 border border-white/[0.04] rounded-lg sm:rounded-xl opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-red-400 hover:border-red-500/30 hover:bg-red-950/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all duration-300 backdrop-blur-md"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(review.id);
                    }}
                    title="Delete Review"
                  >
                    <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  </button>
                </div>
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
      )}

      {editingReview &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-black text-white tracking-tight">Edit Review</h3>
                </div>
                <button
                  onClick={handleCloseEdit}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editingReview.title && (
                <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-2xl border border-white/5">
                  {editingReview.posterPath && (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${editingReview.posterPath}`}
                      alt={editingReview.title}
                      className="w-10 h-14 object-cover rounded-lg border border-white/10"
                    />
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white">{editingReview.title}</h4>
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                      {editingReview.mediaType || 'Movie'}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                  Review Content
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full rounded-2xl bg-zinc-950/50 border border-white/5 p-4 text-xs sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                  placeholder="Write your review..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateReview}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-xs font-black uppercase tracking-wider text-zinc-950 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ReviewList;