export type PlayerSource =
  | "vidking"
  | "vsembed"
  | "vidsrc"
  | "twoembed"
  | "vidlink"
  | "vidly"
  | "vidy";

export interface MovieEmbedUrls {
  vidking: string;
  vsembed: string | null;
  vidsrc: string;
  twoembed: string;
  vidlink: string;
  vidly: string;
  vidy: string;
}

export interface TvEmbedUrls {
  vidking: string | null;
  vsembed: string | null;
  vidsrc: string;
  twoembed: string;
  vidlink: string;
  vidly: string;
  vidy: string;
}

export function getMovieEmbedUrls(
  tmdbId: string,
  imdbId?: string | null,
  progress?: number,
): MovieEmbedUrls {
  const progressParam =
    progress !== undefined && progress > 0
      ? `&progress=${Math.floor(progress)}`
      : "";

  return {
    vidking: `https://www.vidking.net/embed/movie/${tmdbId}?color=fa003f&nextEpisode=true&episodeSelector=true`,
    vsembed: imdbId ? `https://vsembed.ru/embed/movie/${imdbId}` : null,
    vidsrc: `https://vidsrc.sbs/embed/movie/${tmdbId}`,
    twoembed: `https://www.2embed.cc/embed/${tmdbId}`,
    vidlink: `https://vidlink.pro/movie/${tmdbId}`,
    vidly: `https://vidly.pro/movie/${tmdbId}?color=fa003f&audioPicker=1&theme=aurora`,
    vidy: `https://www.vidy.st/movie/${tmdbId}?color=fa003f${progressParam}`,
  };
}

export function getTvEmbedUrls(
  tmdbId: string,
  season: number,
  episode: number,
  imdbId?: string | null,
  progress?: number,
): TvEmbedUrls {
  const progressParam =
    progress !== undefined && progress > 0
      ? `&progress=${Math.floor(progress)}`
      : "";

  return {
    vidking: `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?color=fa003f&nextEpisode=true&episodeSelector=true`,
    vsembed: imdbId
      ? `https://vsembed.ru/embed/tv/${imdbId}/${season}/${episode}`
      : null,
    vidsrc: `https://vidsrc.mov/embed/tv/${tmdbId}/${season}/${episode}`,
    twoembed: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
    vidlink: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
    vidly: `https://vidly.pro/tv/${tmdbId}/${season}/${episode}?color=fa003f&audioPicker=1&theme=aurora&nextEpisode=1&episodeSelector=1`,
    vidy: `https://www.vidy.st/tv/${tmdbId}/${season}/${episode}?color=fa003f&nextEpisode=true&episodeSelector=true${progressParam}`,
  };
}
