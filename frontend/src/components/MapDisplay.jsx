import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default Leaflet icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function MapDisplay({ pickupLocation }) {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    
    const fetchCoords = async () => {
      try {
        setLoading(true);
        // Using Nominatim API for free geocoding (rate limited to 1 req/sec)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(pickupLocation)}&format=json&limit=1`);
        const data = await response.json();
        
        if (active && data && data.length > 0) {
          setCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else if (active) {
          // Fallback coordinate if not found (e.g. center of India or a default)
          setCoords([20.5937, 78.9629]);
        }
      } catch {
        if (active) setCoords([20.5937, 78.9629]);
      } finally {
        if (active) setLoading(false);
      }
    };
    
    if (pickupLocation) {
      fetchCoords();
    }
    
    return () => {
      active = false;
    };
  }, [pickupLocation]);

  if (loading) {
    return <div className="h-64 bg-gray-100 rounded-2xl flex items-center justify-center animate-pulse mt-6"><span className="text-gray-400">Loading map...</span></div>;
  }

  if (!coords) return null;

  return (
    <div className="h-64 w-full mt-6 rounded-2xl overflow-hidden shadow-sm border border-gray-100 z-0 relative">
      <MapContainer center={coords} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={coords}>
          <Popup>Pickup: {pickupLocation}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
