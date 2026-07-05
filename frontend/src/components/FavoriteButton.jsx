import { useState, useEffect } from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import api from "../api/axios";
import toast from "react-hot-toast";

export default function FavoriteButton({ driverId, variant = "icon" }) {
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get(`/favorites/check/${driverId}`)
      .then(({ data }) => {
        if (active) setFav(data.isFavorited);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [driverId]);

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggling || loading) return;
    setToggling(true);
    try {
      if (fav) {
        await api.delete(`/favorites/${driverId}`);
        setFav(false);
        toast.success("Removed from saved");
      } else {
        await api.post("/favorites", { driverId });
        setFav(true);
        toast.success("Saved to favorites");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setToggling(false);
    }
  };

  if (variant === "pill") {
    return (
      <button
        onClick={toggle}
        disabled={toggling || loading}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 disabled:opacity-50 ${
          fav
            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {fav ? <FaHeart className="w-4 h-4" /> : <FaRegHeart className="w-4 h-4" />}
        {fav ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={toggling || loading}
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      className="p-2.5 rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:bg-gray-50 disabled:opacity-50"
    >
      {fav ? (
        <FaHeart className="w-5 h-5 text-red-500" />
      ) : (
        <FaRegHeart className="w-5 h-5 text-gray-400" />
      )}
    </button>
  );
}
