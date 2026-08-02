import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useSocket } from "../context/SocketContext";

// Fix leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const customDriverIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3204/3204121.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// Component to handle auto-panning the map to the driver's location
function MapAutoPan({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);
  return null;
}

export default function LiveLocationMap({ bookingId, initialLat, initialLng }) {
  const { socket } = useSocket();
  const [driverLocation, setDriverLocation] = useState(
    initialLat && initialLng ? [initialLat, initialLng] : [20.5937, 78.9629]
  );
  const [targetLocation, setTargetLocation] = useState(
    initialLat && initialLng ? [initialLat, initialLng] : [20.5937, 78.9629]
  );
  const [lastUpdate, setLastUpdate] = useState(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!socket || !bookingId) return;

    socket.emit("join_booking", bookingId);

    const handleLocationUpdate = (data) => {
      setTargetLocation([data.lat, data.lng]);
      setLastUpdate(new Date(data.timestamp));
    };

    socket.on("location_update", handleLocationUpdate);

    return () => {
      socket.emit("leave_booking", bookingId);
      socket.off("location_update", handleLocationUpdate);
    };
  }, [socket, bookingId]);

  useEffect(() => {
    if (!markerRef.current) return;
    const marker = markerRef.current;
    
    // Animate to targetLocation over 1000ms
    const startLatLng = marker.getLatLng();
    const targetLatLng = L.latLng(targetLocation[0], targetLocation[1]);
    
    if (startLatLng.equals(targetLatLng)) return;

    let start = null;
    const duration = 1000; 

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      
      const lat = startLatLng.lat + (targetLatLng.lat - startLatLng.lat) * progress;
      const lng = startLatLng.lng + (targetLatLng.lng - startLatLng.lng) * progress;
      
      marker.setLatLng([lat, lng]);
      setDriverLocation([lat, lng]); // Update state so MapAutoPan can follow

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [targetLocation]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm z-0">
      <MapContainer
        center={driverLocation}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[300px] z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={driverLocation} icon={customDriverIcon} ref={markerRef}>
          <Popup>
            <div className="text-center font-semibold text-gray-800">
              Driver Location
              {lastUpdate && (
                <div className="text-xs text-gray-500 mt-1 font-normal">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
        <MapAutoPan position={driverLocation} />
      </MapContainer>
      
      {/* Overlay to show real-time status */}
      <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md flex items-center gap-2 border border-green-100">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        <span className="text-xs font-bold text-green-700 tracking-wide uppercase">Live</span>
      </div>
    </div>
  );
}
