import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import api from "../api/axios";
import { FiRefreshCw } from "react-icons/fi";

function HeatmapLayer({ points }) {
  const map = useMap();
  const [heatLoaded, setHeatLoaded] = useState(false);

  useEffect(() => {
    window.L = L;
    import("leaflet.heat").then(() => {
      setHeatLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!points || points.length === 0 || !heatLoaded) return;
    
    // leaflet.heat expects an array of [lat, lng, intensity]
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points, heatLoaded]);

  return null;
}

export default function HeatmapDisplay({ endpoint = "/ai/heatmap" }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint);
      setPoints(data.heatPoints || []);
    } catch (err) {
      console.error("Failed to fetch heatmap data", err);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHeatmap();
  }, [fetchHeatmap]);

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Demand Heatmap</h2>
          <p className="text-sm text-gray-500">Live booking hotspots to maximize your earnings</p>
        </div>
        <button 
          onClick={fetchHeatmap} 
          disabled={loading}
          className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition"
        >
          <FiRefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-200">
        <MapContainer 
          center={[19.0760, 72.8777]} // Default to Mumbai for demo
          zoom={11} 
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <HeatmapLayer points={points} />
        </MapContainer>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-xs font-medium text-gray-500 px-2">
        <span>Low Demand</span>
        <div className="flex-1 mx-4 h-2 rounded-full bg-gradient-to-r from-blue-500 via-lime-400 to-red-500"></div>
        <span>High Demand</span>
      </div>
    </div>
  );
}
