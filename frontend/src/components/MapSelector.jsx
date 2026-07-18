import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";

// Fix missing marker icons in Leaflet with Webpack/Vite
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

function LocationMarker({ position, setPosition, setAddress }) {
  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      
      // Reverse geocode to get address string
      axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
        .then(res => {
          if (res.data && res.data.display_name) {
            setAddress(res.data.display_name);
          }
        })
        .catch(() => {});
    },
  });

  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : <Marker position={position} />;
}

export default function MapSelector({ label, value, onChange }) {
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState(value || "");

  // Update parent when address changes
  useEffect(() => {
    if (address !== value) {
      onChange(address);
    }
  }, [address]);

  // Initial geocode if there's a string value but no position
  useEffect(() => {
    if (value && !position) {
      axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}`)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setPosition([parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)]);
          }
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2 mb-2">
        <input 
          type="text" 
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            onChange(e.target.value);
          }}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          placeholder="Enter location or tap on map"
        />
        <button 
          type="button"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                const { latitude, longitude } = pos.coords;
                setPosition([latitude, longitude]);
                axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`)
                  .then(res => {
                    if (res.data && res.data.display_name) {
                      setAddress(res.data.display_name);
                    }
                  }).catch(() => {});
              });
            }
          }}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium"
        >
          Locate Me
        </button>
      </div>
      <div className="h-64 rounded-xl overflow-hidden border border-gray-200 shadow-inner z-0 relative">
        <MapContainer center={position || [20.5937, 78.9629]} zoom={position ? 15 : 5} scrollWheelZoom={true} style={{ height: "100%", width: "100%", zIndex: 0 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} setAddress={setAddress} />
        </MapContainer>
      </div>
    </div>
  );
}
