import React, { useEffect, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Star, Trash2, Calendar, User, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const ReviewList = ({
    userId,
    compact = false,
}: {
    userId: string;
    compact?: boolean;
}) => {
    const [reviews, setReviews] = useState<
        { 
            id: string; 
            content: string; 
            author: string; 
            timestamp: any; 
            title?: string; 
            rating?: number; 
            movieId?: string;
            posterPath?: string;
            mediaType?: 'movie' | 'tv';
        }[]
    >([]);
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
            const reviewArr = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    content: data.content ?? "",
                    author: data.author ?? "Unknown",
                    timestamp: data.timestamp ?? null,
                    title: data.title ?? "",
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
            console.error("Error deleting review:", error);
        }
    };

    if (reviews.length === 0) {
        return (
            <div className="relative flex flex-col items-center justify-center py-16 px-4 rounded-3xl bg-neutral-900/20 border border-white/[0.04] backdrop-blur-md max-w-md mx-auto overflow-hidden">
                <div className="absolute -inset-10 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 blur-2xl rounded-full pointer-events-none" />
                <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-inner mb-4 group">
                    <MessageSquare className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h4 className="text-white/80 font-semibold text-base mb-1 tracking-wide">Voice Your Thoughts</h4>
                <p className="text-zinc-500 text-xs text-center max-w-[240px] leading-relaxed">You haven't written any reviews yet. Your cinematic journey starts here.</p>
            </div>
        );
    }

    return (
        <div
            className={
                compact
                    ? "flex gap-4 overflow-x-auto pb-4 pt-2 px-2 -mx-2 scrollbar-none snap-x snap-mandatory"
                    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 w-full auto-rows-fr"
            }
            style={{ WebkitOverflowScrolling: "touch" }}
        >
            {reviews.slice(0, compact ? 6 : reviews.length).map((review) => {
                const cardContent = (
                    <>
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-2xl">
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent skew-x-[-20deg] transition-transform duration-1000 ease-in-out" />
                        </div>

                        <div className="relative z-10 flex flex-col h-full w-full justify-between gap-4">
                            <div className="w-full">
                                <div className="flex items-center justify-between gap-4 mb-3">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 max-w-[calc(100%-2rem)]">
                                        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                                            <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                                                <img 
                                                    src={userPhoto || "/user-icon.jpg"} 
                                                    alt={review.author} 
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="font-medium text-white/80 text-[11px] truncate max-w-[90px] sm:max-w-[120px]">{review.author}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-medium">
                                            <Calendar className="w-2.5 h-2.5 text-emerald-400/80" />
                                            <span>
                                                {review.timestamp?.seconds
                                                    ? new Date(review.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : "Recent"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3.5">
                                    {review.posterPath && (
                                        <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl overflow-hidden border border-white/10 shadow-2xl flex-shrink-0 bg-zinc-900 group-hover:border-emerald-500/30 transition-colors duration-300">
                                            <img 
                                                src={`https://image.tmdb.org/t/p/w185${review.posterPath}`} 
                                                alt={review.title} 
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        {review.title && (
                                            <h4 className="text-sm font-bold text-white/90 tracking-wide mb-1.5 line-clamp-1 group-hover:text-emerald-400 transition-colors duration-300">
                                                {review.title}
                                            </h4>
                                        )}
                                        <p className="text-zinc-300 text-xs leading-relaxed font-normal opacity-85 group-hover:opacity-100 transition-opacity duration-300 line-clamp-3">
                                            {review.content}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {review.rating && (
                                <div className="flex items-center gap-1 w-fit bg-amber-500/10 border border-amber-500/20 backdrop-blur-md px-2 py-0.5 rounded-md shadow-sm">
                                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                    <span className="text-[10px] font-bold text-amber-300 tracking-wider">
                                        {review.rating.toFixed(1)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            className="absolute top-3 right-3 z-20 flex items-center justify-center w-7 h-7 text-zinc-400 bg-neutral-950/40 border border-white/[0.06] rounded-lg md:opacity-0 group-hover:opacity-100 md:translate-x-1 group-hover:translate-x-0 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 shadow-lg transition-all duration-300"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(review.id);
                            }}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </>
                );

                const baseStyles = `group relative flex flex-col items-start bg-gradient-to-b from-neutral-900/40 to-neutral-950/60 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/[0.05] hover:border-white/[0.15] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.12)] ${
                    compact ? "w-[260px] sm:w-[300px] flex-shrink-0 snap-start" : "w-full"
                }`;

                return review.movieId ? (
                    <Link
                        key={review.id}
                        to={review.mediaType === 'tv' ? `/tv/${review.movieId}` : `/movie/${review.movieId}`}
                        className={`${baseStyles} hover:scale-[1.015] active:scale-[0.99] cursor-pointer`}
                    >
                        {cardContent}
                    </Link>
                ) : (
                    <div
                        key={review.id}
                        className={baseStyles}
                    >
                        {cardContent}
                    </div>
                );
            })}
        </div>
    );
};

export default ReviewList;