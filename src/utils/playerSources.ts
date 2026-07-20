export type PlayerSource = 'vidking' | 'vsembed' | 'vidsrc' | 'twoembed' | 'vidlink';

export interface MovieEmbedUrls {
  vidking: string;
  vsembed: string | null;
  vidsrc: string;
  twoembed: string;
  vidlink: string;
}

export interface TvEmbedUrls {
  vidking: string | null;
  vsembed: string | null;
  vidsrc: string;
  twoembed: string;
  vidlink: string;
}

export function getMovieEmbedUrls(tmdbId: string, imdbId?: string | null): MovieEmbedUrls {
  return {
    vidking: `https://www.vidking.net/embed/movie/${tmdbId}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`,
    vsembed: imdbId ? `https://vsembed.ru/embed/movie/${imdbId}` : null,
    vidsrc: `https://vidsrc.sbs/embed/movie/${tmdbId}`,
    twoembed: `https://www.2embed.cc/embed/${tmdbId}`,
    vidlink: `https://vidlink.pro/movie/${tmdbId}`,
  };
}

export function getTvEmbedUrls(
  tmdbId: string,
  season: number,
  episode: number,
  imdbId?: string | null,
): TvEmbedUrls {
  return {
    vidking: `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?color=3b82f6&autoPlay=true&nextEpisode=true&episodeSelector=true`,
    vsembed: imdbId ? `https://vsembed.ru/embed/tv/${imdbId}/${season}/${episode}` : null,
    vidsrc: `https://vidsrc.sbs/embed/tv/${tmdbId}/${season}/${episode}`,
    twoembed: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
    vidlink: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
  };
}