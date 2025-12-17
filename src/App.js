import "./App.css";
import Navbar from "./components/Navbar.tsx";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Home from "./Pages/Home.tsx";
import Explore from "./Pages/Explore.tsx";
import MovieDetails from "./Pages/MovieDetails.tsx";
import Toprated from "./Pages/Toprated.jsx";
import Actordetails from "./Pages/Actordetails.tsx";
import LoginPage from "./Pages/LoginPage.tsx";
import ProfilePage from "./Pages/ProfilePage.tsx";
import ActorProfilePage from "./Pages/ActorProfilePage.tsx";
import ConditionalRoute from './components/ConditionalRoute.tsx';
import Tvdetails from './Pages/Tvdetails.tsx'
import FavActors from './Pages/FavActors.tsx'
import Trending from './Pages/Trending.tsx';
import Watchlist from "./Pages/Watchlist.tsx";
import Upcoming from "./Pages/Upcoming.tsx";
import SearchResults from "./Pages/SearchResults.tsx";
import HistoryPage from "./Pages/History.tsx";
import License from "./components/License.tsx";

const AppRoutes = () => {
  const location = useLocation();

  return (
    <>
      {location.pathname !== "/login" && <Navbar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/actors" element={<ActorProfilePage />} />
        <Route path="/" element={<ConditionalRoute />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/movie/:id" element={<MovieDetails />} />
        <Route path="/actor/:id" element={<Actordetails />} />
        <Route path="tv/:id" element={<Tvdetails />} />
        <Route path="/top-rated" element={<Toprated />} />
        <Route path="/fav-actors" element={<FavActors />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/upcoming" element={<Upcoming />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white relative">
        <AppRoutes />
        <License/>
      </div>
    </BrowserRouter>
  );
}

export default App;