import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import { HiLocationMarker } from "react-icons/hi";
import BackButton from "../components/BackButton";
import api from "../api/axios";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/favorites")
      .then(({ data }) => setFavorites(data.favorites))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in">
      <BackButton to="/drivers" label="Back to Drivers" />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Saved <span className="gradient-text">Drivers</span>
        </h1>
        <p className="text-sm text-gray-500">{favorites.length} saved</p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="space-y-3">
                <div className="skeleton h-5 w-32 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16 animate-fade-up">
          <FaHeart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No saved drivers yet.</p>
          <Link to="/drivers" className="mt-2 inline-block text-blue-600 hover:text-blue-700 font-semibold text-sm">
            Browse drivers
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-1">
          {favorites.map((driver) => (
            <Link
              key={driver._id}
              to={`/drivers/${driver._id}`}
              className="bg-white rounded-2xl border border-gray-100 p-6 card-hover hover:text-gray-700 animate-scale-in group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  {driver.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{driver.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5 text-gray-500 text-sm">
                    <HiLocationMarker className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{driver.locality}</span>
                  </div>
                </div>
                <FaHeart className="w-5 h-5 text-red-500 flex-shrink-0" />
              </div>

              {driver.bio && (
                <p className="mt-4 text-sm text-gray-600 line-clamp-2">{driver.bio}</p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {driver.experienceYears}y exp
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    driver.availability === "available"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {driver.availability}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
