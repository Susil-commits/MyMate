import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HiStar, HiLocationMarker, HiClock, HiCurrencyDollar, HiSearch, HiX } from "react-icons/hi";
import api from "../api/axios";
import { useDebounce } from "../hooks/useDebounce";
import { hireTypes, vehicleTypes } from "../utils/constants";

const sortOptions = [
  { value: "rating", label: "Top Rated" },
  { value: "experience", label: "Most Experienced" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
];

const inputClass =
  "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200";

function getPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const range = [1];
  if (left > 2) range.push("…");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("…");
  range.push(total);
  return range;
}

export default function DriverSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drivers, setDrivers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    locality: searchParams.get("locality") || "",
    minExperience: searchParams.get("minExperience") || "",
    minRating: searchParams.get("minRating") || "",
    vehicleType: searchParams.get("vehicleType") || "",
    hireType: searchParams.get("hireType") || "",
    languages: searchParams.get("languages") || "",
    minRate: searchParams.get("minRate") || "",
    maxRate: searchParams.get("maxRate") || "",
    sort: searchParams.get("sort") || "rating",
  });

  const page = Number(searchParams.get("page")) || 1;

  const debouncedLocality = useDebounce(filters.locality, 400);
  const debouncedLanguages = useDebounce(filters.languages, 400);
  const debouncedMinRate = useDebounce(filters.minRate, 400);
  const debouncedMaxRate = useDebounce(filters.maxRate, 400);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const params = new URLSearchParams();
        const queryFilters = {
          minExperience: filters.minExperience,
          minRating: filters.minRating,
          vehicleType: filters.vehicleType,
          hireType: filters.hireType,
          locality: debouncedLocality,
          languages: debouncedLanguages,
          minRate: debouncedMinRate,
          maxRate: debouncedMaxRate,
          sort: filters.sort !== "rating" ? filters.sort : "",
        };
        Object.entries({ ...queryFilters, page, limit: 12 }).forEach(([key, val]) => {
          if (val) params.append(key, val);
        });
        const { data } = await api.get(`/drivers?${params}`);
        if (!active) return;
        setDrivers(data.drivers);
        setPagination(data.pagination);
      } catch (err) {
        if (active) console.error("Failed to fetch drivers:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [
    debouncedLocality,
    debouncedLanguages,
    debouncedMinRate,
    debouncedMaxRate,
    filters.minExperience,
    filters.minRating,
    filters.vehicleType,
    filters.hireType,
    filters.sort,
    page,
  ]);

  const syncUrl = (newFilters, nextPage = 1) => {
    const params = new URLSearchParams();
    Object.entries({ ...newFilters, page: nextPage }).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    setSearchParams(params);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    syncUrl(newFilters);
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage);
    setSearchParams(params);
  };

  const clearFilters = () => {
    const cleared = {
      locality: "",
      minExperience: "",
      minRating: "",
      vehicleType: "",
      hireType: "",
      languages: "",
      minRate: "",
      maxRate: "",
      sort: "rating",
    };
    setFilters(cleared);
    syncUrl(cleared);
  };

  const activeFilterCount = useMemo(
    () =>
      ["locality", "minExperience", "minRating", "vehicleType", "hireType", "languages", "minRate", "maxRate"].filter(
        (k) => filters[k]
      ).length,
    [filters]
  );

  const pageList = getPageList(pagination.page, pagination.pages);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Find <span className="gradient-text">Drivers</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} drivers available</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Sort by</label>
          <select
            value={filters.sort}
            onChange={(e) => handleFilterChange("sort", e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-slide-in-left">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiSearch className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors"
            >
              <HiX className="w-4 h-4" /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Locality</label>
            <input
              type="text"
              placeholder="City or area..."
              value={filters.locality}
              onChange={(e) => handleFilterChange("locality", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Exp (yrs)</label>
            <input
              type="number"
              min="0"
              value={filters.minExperience}
              onChange={(e) => handleFilterChange("minExperience", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Rating</label>
            <select
              value={filters.minRating}
              onChange={(e) => handleFilterChange("minRating", e.target.value)}
              className={inputClass}
            >
              <option value="">Any</option>
              <option value="3">3+</option>
              <option value="3.5">3.5+</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Vehicle</label>
            <select
              value={filters.vehicleType}
              onChange={(e) => handleFilterChange("vehicleType", e.target.value)}
              className={inputClass}
            >
              <option value="">All</option>
              {vehicleTypes.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hire Type</label>
            <select
              value={filters.hireType}
              onChange={(e) => handleFilterChange("hireType", e.target.value)}
              className={inputClass}
            >
              <option value="">All</option>
              {hireTypes.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Languages</label>
            <input
              type="text"
              placeholder="e.g. English, Hindi"
              value={filters.languages}
              onChange={(e) => handleFilterChange("languages", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {filters.hireType && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 animate-slide-in-left">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Min Rate ({filters.hireType === "temporary" ? "$/hr" : "$/day"})
              </label>
              <input
                type="number"
                min="0"
                placeholder="No min"
                value={filters.minRate}
                onChange={(e) => handleFilterChange("minRate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Max Rate ({filters.hireType === "temporary" ? "$/hr" : "$/day"})
              </label>
              <input
                type="number"
                min="0"
                placeholder="No max"
                value={filters.maxRate}
                onChange={(e) => handleFilterChange("maxRate", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="skeleton h-5 w-32 rounded" />
                  <div className="skeleton h-4 w-24 rounded" />
                </div>
                <div className="skeleton h-8 w-14 rounded-lg" />
              </div>
              <div className="flex gap-2 mt-4">
                <div className="skeleton h-6 w-14 rounded-md" />
                <div className="skeleton h-6 w-14 rounded-md" />
              </div>
              <div className="flex justify-between mt-4">
                <div className="skeleton h-4 w-16 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <div className="mt-16 text-center animate-fade-up">
          <HiSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No drivers found matching your criteria.</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-1">
            {drivers.map((driver) => (
              <Link
                key={driver._id}
                to={`/drivers/${driver._id}`}
                className="card-hover bg-white rounded-2xl p-6 border border-gray-100 animate-scale-in group block"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    {driver.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{driver.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5 text-gray-500 text-sm">
                      <HiLocationMarker className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{driver.locality}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  <HiStar className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-bold text-gray-900">{driver.averageRating || "New"}</span>
                  <span className="text-xs text-gray-400">({driver.totalReviews})</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {driver.vehicleTypes?.slice(0, 3).map((v) => (
                    <span key={v} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg font-medium">{v}</span>
                  ))}
                  {driver.vehicleTypes?.length > 3 && (
                    <span className="px-2.5 py-1 bg-gray-50 text-gray-500 text-xs rounded-lg">+{driver.vehicleTypes.length - 3}</span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-500">
                    <HiClock className="w-4 h-4" />
                    {driver.experienceYears}y exp
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-bold">
                    <HiCurrencyDollar className="w-4 h-4" />
                    ${driver.hourlyRate}/hr
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="mt-10 flex justify-center items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                Prev
              </button>
              {pageList.map((p, idx) =>
                p === "…" ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      p === pagination.page
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
