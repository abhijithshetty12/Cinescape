import React from 'react';

interface PosterSkeletonProps {
  className?: string;
  ratio?: 'poster' | 'landscape';
  withCaption?: boolean;
}

export const PosterSkeleton: React.FC<PosterSkeletonProps> = ({
  className = '',
  ratio = 'poster',
  withCaption = false,
}) => (
  <div aria-hidden="true" className={`min-w-0 ${className}`}>
    <div className={`media-skeleton rounded-2xl ${ratio === 'poster' ? 'aspect-[2/3]' : 'aspect-[16/10]'}`} />
    {withCaption && (
      <div className="mt-3 space-y-2.5 px-3 pb-3 pt-1">
        <div className="media-skeleton h-3.5 w-4/5 rounded-full" />
        <div className="media-skeleton h-2.5 w-2/5 rounded-full" />
        <div className="flex gap-1.5 pt-1">
          <div className="media-skeleton h-4 w-12 rounded-md" />
          <div className="media-skeleton h-4 w-14 rounded-md" />
        </div>
      </div>
    )}
  </div>
);

export const MovieCarouselSkeleton: React.FC = () => (
  <div role="status" aria-live="polite" aria-label="Loading titles" aria-busy="true" className="flex w-full gap-1 overflow-hidden rounded-2xl px-2 py-1">
    <span className="sr-only">Loading titles</span>
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="w-[78%] shrink-0 snap-start p-1.5 sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5">
        <PosterSkeleton ratio="landscape" withCaption />
      </div>
    ))}
  </div>
);
