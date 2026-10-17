import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface PosterImageProps {
  src?: string | null;
  alt?: string;
  size?: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';
  srcSet?: string;
  sizes?: string;
  fallbackLabel?: string;
  className?: string;
  imageClassName?: string;
  onImageLoad?: () => void;
  onImageError?: () => void;
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const resolveImageSource = (src: string | null | undefined, size: PosterImageProps['size']) => {
  const value = src?.trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${TMDB_IMAGE_BASE}/${size || 'w500'}/${value.replace(/^\/+/, '')}`;
};

const PosterImage: React.FC<PosterImageProps> = ({
  src,
  alt = '',
  size = 'w500',
  srcSet,
  sizes,
  fallbackLabel = 'No image available',
  className = '',
  imageClassName = '',
  onImageLoad,
  onImageError,
}) => {
  const [loadedSrc, setLoadedSrc] = useState('');
  const [failedSrc, setFailedSrc] = useState('');
  const resolvedSrc = resolveImageSource(src, size);
  const loaded = Boolean(resolvedSrc) && loadedSrc === resolvedSrc;
  const failed = Boolean(resolvedSrc) && failedSrc === resolvedSrc;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden bg-zinc-900/80 ${className}`}>
      {!loaded && !failed && resolvedSrc && (
        <div aria-hidden="true" className="media-skeleton absolute inset-0 rounded-[inherit]" />
      )}
      {resolvedSrc && !failed ? (
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => { setLoadedSrc(resolvedSrc); onImageLoad?.(); }}
          onError={() => { setFailedSrc(resolvedSrc); onImageError?.(); }}
          className={`h-full w-full object-cover opacity-0 transition-opacity duration-500 ease-out ${loaded ? 'opacity-100' : ''} ${imageClassName}`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-900 to-zinc-950 text-zinc-600">
          <ImageOff aria-hidden="true" className="h-7 w-7 stroke-[1.5]" />
          <span className="px-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em]">{fallbackLabel}</span>
        </div>
      )}
    </div>
  );
};

export default PosterImage;
