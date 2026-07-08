import axios from 'axios';

const API_KEY = '859afbb4b98e3b467da9c99ac390e950';
const API_URL = 'https://api.themoviedb.org/3';

const genreMap: { [key: number]: string } = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export type MediaItem = {
  id: number;
  title: string;
  rating: number;
  image: string;
  backdrop?: string;
  year: number;
  genre: string[];
  videoUrl: string;
  overview?: string;
};

const fetchRandomMovieImages = async () => {
  try {
    const response = await axios.get(`${API_URL}/movie/popular?api_key=${API_KEY}&page=${Math.floor(Math.random() * 10)}`);
    const movies = response.data.results;
    const randomMovie = movies[Math.floor(Math.random() * movies.length)];
    return `https://image.tmdb.org/t/p/original${randomMovie.backdrop_path}`;
  } catch (error) {
    console.error('Error fetching random movie image:', error);
    return null;
  }
};

const fetchPopularMovies = async (page: number = 1) => {
  try {
    const response = await axios.get(`${API_URL}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}`);
    const movies = response.data.results;

    const moviePromises = movies.map(async (movie: any) => {
      const year = new Date(movie.release_date).getFullYear();
      const genres = movie.genre_ids.map((id: number) => genreMap[id] || 'Unknown');

      let videoUrl = '';
      try {
        const videoResponse = await axios.get(`${API_URL}/movie/${movie.id}/videos?api_key=${API_KEY}&language=en-US`);
        const videos = videoResponse.data.results;
        const trailer = videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) {
          videoUrl = `https://www.youtube.com/embed/${trailer.key}`;
        }
      } catch (videoError) {
        console.error('Error fetching video for movie:', movie.id, videoError);
      }

      return {
        id: movie.id,
        title: movie.title,
        rating: movie.vote_average,
        image: `https://image.tmdb.org/t/p/w780${movie.poster_path}`,
        year,
        genre: genres,
        videoUrl,
      };
    });

    return await Promise.all(moviePromises);
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return [];
  }
};

export const fetchTVShows = async (page: number = 1): Promise<MediaItem[]> => {
  try {
    const response = await axios.get(`${API_URL}/tv/popular?api_key=${API_KEY}&language=en-US&page=${page}`);
    const shows = response.data.results;

    const promises = shows.map(async (tv: any) => {
      let videoUrl = '';
      let genres: string[] = [];
      try {
        const detailsRes = await axios.get(`${API_URL}/tv/${tv.id}?api_key=${API_KEY}&language=en-US`);
        genres = detailsRes.data.genres.map((g: { id: number; name: string }) => g.name);
      } catch {
        genres = tv.genre_ids.map((id: number) => genreMap[id] || 'Unknown');
      }
      try {
        const videoRes = await axios.get(`${API_URL}/tv/${tv.id}/videos?api_key=${API_KEY}&language=en-US`);
        const trailer = videoRes.data.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) videoUrl = `https://www.youtube.com/embed/${trailer.key}`;
      } catch { /* ignore */ }

      return {
        id: tv.id,
        title: tv.name,
        rating: tv.vote_average,
        image: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : '',
        backdrop: tv.backdrop_path ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}` : undefined,
        year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : 0,
        genre: genres,
        videoUrl,
        overview: tv.overview,
      };
    });

    return await Promise.all(promises);
  } catch (error) {
    console.error('Error fetching TV shows:', error);
    return [];
  }
};

export const fetchGenres = async (type: 'movie' | 'tv') => {
  try {
    const res = await axios.get(`${API_URL}/genre/${type}/list?api_key=${API_KEY}&language=en-US`);
    return res.data.genres as { id: number; name: string }[];
  } catch {
    return [];
  }
};

export const searchTMDB = async (
  query: string,
  page: number = 1,
  type?: 'movie' | 'tv'
): Promise<MediaItem[]> => {
  try {
    const url = type
      ? `${API_URL}/search/${type}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=${page}`
      : `${API_URL}/search/multi?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=${page}`;
    const response = await axios.get(url);
    const results = response.data.results.filter((r: any) => r.media_type !== 'person');

    const promises = results.map(async (item: any) => {
      const isMovie = item.media_type === 'movie' || type === 'movie';
      const id = item.id;
      let videoUrl = '';
      try {
        const videoRes = await axios.get(`${API_URL}/${isMovie ? 'movie' : 'tv'}/${id}/videos?api_key=${API_KEY}&language=en-US`);
        const trailer = videoRes.data.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) videoUrl = `https://www.youtube.com/embed/${trailer.key}`;
      } catch { /* ignore */ }

      const genreNames = (item.genre_ids || []).map((gid: number) => genreMap[gid]).filter(Boolean);

      return {
        id,
        title: item.title || item.name || 'Untitled',
        rating: item.vote_average || 0,
        image: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
        year: item.release_date || item.first_air_date
          ? new Date(item.release_date || item.first_air_date).getFullYear()
          : 0,
        genre: genreNames,
        videoUrl,
        overview: item.overview,
      };
    });

    return await Promise.all(promises);
  } catch (error) {
    console.error('Error searching TMDB:', error);
    return [];
  }
};

export const fetchMediaByType = async (
  type: 'movie' | 'tv',
  page: number = 1,
  sortBy: string = 'popularity.desc',
  genreId?: number
): Promise<MediaItem[]> => {
  try {
    const genreParam = genreId ? `&with_genres=${genreId}` : '';
    const url =
      type === 'movie'
        ? `${API_URL}/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=${sortBy}&include_adult=false&page=${page}${genreParam}`
        : `${API_URL}/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=${sortBy}&include_adult=false&page=${page}${genreParam}`;
    const response = await axios.get(url);
    const results = response.data.results;

    const promises = results.map(async (item: any) => {
      let videoUrl = '';
      try {
        const videoRes = await axios.get(`${API_URL}/${type}/${item.id}/videos?api_key=${API_KEY}&language=en-US`);
        const trailer = videoRes.data.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
        if (trailer) videoUrl = `https://www.youtube.com/embed/${trailer.key}`;
      } catch { /* ignore */ }

      const genreNames = (item.genre_ids || []).map((gid: number) => genreMap[gid]).filter(Boolean);

      return {
        id: item.id,
        title: item.title || item.name || 'Untitled',
        rating: item.vote_average || 0,
        image: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : undefined,
        year: item.release_date || item.first_air_date
          ? new Date(item.release_date || item.first_air_date).getFullYear()
          : 0,
        genre: genreNames,
        videoUrl,
        overview: item.overview,
      };
    });

    return await Promise.all(promises);
  } catch (error) {
    console.error('Error fetching media:', error);
    return [];
  }
};

export { fetchPopularMovies };
export default fetchRandomMovieImages;
