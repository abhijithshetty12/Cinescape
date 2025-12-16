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
        image: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
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

export { fetchPopularMovies };
export default fetchRandomMovieImages;
