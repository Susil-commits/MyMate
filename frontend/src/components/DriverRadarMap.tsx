import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import {
  HiLocationMarker,
  HiStar,
  HiCurrencyDollar,
  HiClock,
  HiRefresh,
  HiFilter,
  HiCheckCircle,
  HiChevronRight,
} from "react-icons/hi";
import { FaCar, FaCrosshairs } from "react-icons/fa";
import api from "../api/axios";
import { useSocket } from "../context/SocketContext";
import { formatINR } from "../utils/constants";

// Fix standard Leaflet default marker icons for Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface RadarDriver {
  id: string;
  name: string;
  avatar?: string;
  locality?: string;
  averageRating: number;
  totalReviews: number;
  vehicleTypes: string[];
  hourlyRate: number;
  dailyRate: number;
  experienceYears: number;
  distanceKm: number;
  etaMins: number;
  lat: number;
  lng: number;
  status: string;
}

interface DriverRadarMapProps {
  onSelectDriver?: (driverId: string) => void;
}

// Custom vehicle marker icon generator
const createVehicleIcon = (vehicleType: string, isOnline: boolean) => {
  return L.divIcon({
    className: "custom-radar-marker",
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: ${isOnline ? "#2563eb" : "#475569"};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        transition: transform 0.3s ease;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="#ffffff" style="width: 18px; height: 18px;">
          <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>
        </svg>
        <span style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 10px;
          height: 10px;
          background: #10b981;
          border: 2px solid #ffffff;
          border-radius: 50%;
        "></span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
};

// User's own location pulsing blue beacon
const userBeaconIcon = L.divIcon({
  className: "user-radar-beacon",
  html: `
    <div style="position: relative; width: 24px; height: 24px;">
      <div style="
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: #2563eb;
        opacity: 0.4;
        animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
      "></div>
      <div style="
        position: relative;
        width: 16px;
        height: 16px;
        top: 4px;
        left: 4px;
        border-radius: 50%;
        background: #1d4ed8;
        border: 3px solid #ffffff;
        box-shadow: 0 0 8px rgba(37,99,235,0.8);
      "></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Helper component to re-center map view
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom(), { duration: 1.2 });
  }, [center, map]);
  return null;
}

export default function DriverRadarMap({ onSelectDriver }: DriverRadarMapProps) {
  const { socket } = useSocket();
  const [center, setCenter] = useState<[number, number]>([28.4595, 77.0266]); // Default NCR center
  const [hasUserLocation, setHasUserLocation] = useState<boolean>(false);
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [vehicleFilter, setVehicleFilter] = useState<string>("");
  const [drivers, setDrivers] = useState<RadarDriver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [source, setSource] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<RadarDriver | null>(null);

  // Request browser geolocation dynamically
  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
          setHasUserLocation(true);
        },
        () => {
          // If user denies permission, keep current coordinates
          setHasUserLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  useEffect(() => {
    detectLocation();
  }, []);

  // Fetch nearby drivers from real-time spatial radar API
  const fetchRadarDrivers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(center[0]),
        lng: String(center[1]),
        radius: String(radiusKm),
      });
      if (vehicleFilter) {
        params.append("vehicleType", vehicleFilter);
      }

      const { data } = await api.get(`/drivers/radar?${params.toString()}`);
      setDrivers(data.drivers || []);
      setSource(data.source || "");
    } catch (err) {
      console.error("Failed to load driver radar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadarDrivers();
  }, [center, radiusKm, vehicleFilter]);

  // Real-time WebSocket location tracking updates
  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (payload: any) => {
      if (!payload || !payload.driverId) return;

      setDrivers((prev) =>
        prev.map((d) => {
          if (d.id === payload.driverId && payload.lat && payload.lng) {
            return {
              ...d,
              lat: payload.lat,
              lng: payload.lng,
              status: "online",
            };
          }
          return d;
        })
      );
    };

    socket.on("location_update", handleLocationUpdate);
    return () => {
      socket.off("location_update", handleLocationUpdate);
    };
  }, [socket]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={detectLocation}
            className="px-3.5 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FaCrosshairs className="w-3.5 h-3.5" />
            {hasUserLocation ? "Re-center GPS" : "Detect My Location"}
          </button>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 font-medium">Search Radius:</span>
            {[5, 10, 25, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  radiusKm === r
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <HiFilter className="w-4 h-4 text-gray-400" />
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="">All Vehicles</option>
              <option value="Car">Car</option>
              <option value="SUV">SUV</option>
              <option value="Van">Van</option>
              <option value="Truck">Truck</option>
              <option value="Luxury">Luxury</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {drivers.length} Drivers Online
          </span>

          <button
            onClick={fetchRadarDrivers}
            disabled={loading}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            title="Refresh Radar"
          >
            <HiRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Map View */}
      <div className="relative w-full h-[580px] rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapRecenter center={center} />

          {/* User Location Beacon */}
          <Marker position={center} icon={userBeaconIcon}>
            <Popup>
              <div className="text-xs p-1">
                <strong>Your Search Origin</strong>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Scanning for drivers within {radiusKm} km
                </p>
              </div>
            </Popup>
          </Marker>

          {/* Search Radius Circle */}
          <Circle
            center={center}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#60a5fa",
              fillOpacity: 0.08,
              weight: 1.5,
              dashArray: "4, 6",
            }}
          />

          {/* Active Drivers Markers */}
          {drivers.map((d) => {
            if (!d.lat || !d.lng) return null;
            return (
              <Marker
                key={d.id}
                position={[d.lat, d.lng]}
                icon={createVehicleIcon(d.vehicleTypes?.[0] || "Car", d.status === "online")}
                eventHandlers={{
                  click: () => setSelectedDriver(d),
                }}
              >
                <Popup>
                  <div className="text-xs p-1.5 space-y-2 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                        {d.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{d.name}</h4>
                        <div className="flex items-center gap-1 text-[11px] text-gray-500">
                          <HiStar className="w-3.5 h-3.5 text-yellow-500" />
                          <span>{d.averageRating || "New"}</span>
                          <span>({d.totalReviews})</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-lg text-[11px]">
                      <div>
                        <span className="text-gray-400 block">Distance</span>
                        <strong className="text-blue-600">{d.distanceKm} km</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Est. Arrival</span>
                        <strong className="text-emerald-600">{d.etaMins} mins</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-100">
                      <span className="font-bold text-gray-900">
                        {formatINR(d.hourlyRate)}/hr
                      </span>
                      {onSelectDriver ? (
                        <button
                          onClick={() => onSelectDriver(d.id)}
                          className="px-2.5 py-1 bg-blue-600 text-white font-semibold rounded-md text-[11px] hover:bg-blue-700 transition"
                        >
                          Quick View
                        </button>
                      ) : (
                        <Link
                          to={`/drivers/${d.id}`}
                          className="px-2.5 py-1 bg-blue-600 text-white font-semibold rounded-md text-[11px] hover:bg-blue-700 transition"
                        >
                          Hire Driver
                        </Link>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Selected Driver Floating Card Overlay */}
        {selectedDriver && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 z-[1000] bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-2xl animate-slide-in-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center">
                  {selectedDriver.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">
                    {selectedDriver.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedDriver.locality || "Verified Professional Driver"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 my-3 py-2 border-y border-gray-100 dark:border-gray-800 text-center">
              <div>
                <span className="text-[11px] text-gray-400 block">Distance</span>
                <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  {selectedDriver.distanceKm} km
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-400 block">ETA</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  ~{selectedDriver.etaMins} mins
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-400 block">Hourly Rate</span>
                <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {formatINR(selectedDriver.hourlyRate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/drivers/${selectedDriver.id}`}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                Book This Driver Now
                <HiChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

