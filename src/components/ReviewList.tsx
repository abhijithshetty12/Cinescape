import React, { useEffect, useState } from 'react';
import { db } from '../firebase.ts';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Star, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ReviewList = ({
    userId,
    compact = false,
}: {
    userId: string;
    compact?: boolean;
}) => {
    const [reviews, setReviews] = useState<
        { id: string; content: string; author: string; timestamp: any; title?: string; rating?: number; movieId?: string }[]
    >([]);

    useEffect(() => {
        if (!userId) return;
        const reviewsRef = collection(db, `users/${userId}/reviews`);
        const reviewsQuery = query(reviewsRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
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
                };
            });
            setReviews(reviewArr);
        });
        return () => unsubscribe();
    }, [userId]);

    const handleDelete = async (reviewId: string) => {
        if (!userId || !reviewId) return;
        try {
            await deleteDoc(doc(db, `users/${userId}/reviews/${reviewId}`));
        } catch (error) {
            console.error("Error deleting review:", error);
        }
    };

    const navigate = useNavigate();

    if (reviews.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8">
                <Star className="w-8 h-8 text-blue-400 mb-2" />
                <p className="text-gray-500 text-center">No reviews yet</p>
            </div>
        );
    }

    return (
        <div
            className={
                compact
                    ? "flex flex-col gap-3 overflow-x-auto no-scrollbar"
                    : "grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
            }
        >
            {reviews.slice(0, compact ? 6 : reviews.length).map((review) =>
                review.movieId ? (
                    <div
                        key={review.id}
                        className="relative group w-full"
                    >
                        <Link
                            to={`/movie/${review.movieId}`}
                            className="block flex flex-col items-start gap-2 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/20 shadow transition-all duration-300 w-full group-hover:scale-[1.02] cursor-pointer relative"
                        >
                            <div className="flex flex-col flex-1 w-full">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-blue-400 text-xs">{review.author}</span>
                                    <span className="text-xs text-gray-400">
                                        {review.timestamp?.seconds
                                            ? new Date(review.timestamp.seconds * 1000).toLocaleDateString()
                                            : ""}
                                    </span>
                                </div>
                                {review.title && (
                                    <span className="text-xs text-gray-300 font-semibold mb-1">{review.title}</span>
                                )}
                                <p className="text-gray-200 text-sm line-clamp-3">{review.content}</p>
                            </div>
                            <button
                                className="absolute top-2 right-2 flex items-center gap-1 text-xs text-red-400 bg-gray-800/80 px-2 py-1 rounded hover:bg-red-800/80 transition"
                                onClick={e => { e.stopPropagation(); handleDelete(review.id); }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </Link>
                    </div>
                ) : (
                    <div
                        key={review.id}
                        className="relative flex flex-col items-start gap-2 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-4 border border-blue-500/20 shadow transition-all duration-300 w-full"
                    >
                        <div className="flex flex-col flex-1 w-full">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-blue-400 text-xs">{review.author}</span>
                                <span className="text-xs text-gray-400">
                                    {review.timestamp?.seconds
                                        ? new Date(review.timestamp.seconds * 1000).toLocaleDateString()
                                        : ""}
                                </span>
                            </div>
                            {review.title && (
                                <span className="text-xs text-gray-300 font-semibold mb-1">{review.title}</span>
                            )}
                            <p className="text-gray-200 text-sm line-clamp-3">{review.content}</p>
                        </div>
                        <button
                            className="absolute top-2 right-2 flex items-center gap-1 text-xs text-red-400 bg-gray-800/80 px-2 py-1 rounded hover:bg-red-800/80 transition"
                            onClick={() => handleDelete(review.id)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )
            )}
        </div>
    );
};

export default ReviewList;