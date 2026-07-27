import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// Fix for default Leaflet icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const RoutingMachine = ({ start, end, stops = [] }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!start) return;

    let waypoints = [L.latLng(start[0], start[1])];

    if (stops && stops.length > 0) {
      stops.forEach(stop => {
        if (stop && stop.lat !== undefined && stop.lng !== undefined) {
          waypoints.push(L.latLng(stop.lat, stop.lng));
        }
      });
    }

    if (end) {
      waypoints.push(L.latLng(end[0], end[1]));
    }
    
    const routingControl = L.Routing.control({
      waypoints: waypoints,
      routeWhileDragging: false,
      addWaypoints: false,
      show: false, // Hide the default text directions UI
      lineOptions: {
        styles: [{ color: "#4f46e5", weight: 6, opacity: 0.8 }]
      },
      createMarker: () => null // Hide default routing markers as we render our own
    }).addTo(map);

    return () => {
      try {
        map.removeControl(routingControl);
      } catch {
        // Fallback or ignore routing failure
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, start, end]);

  return null;
};

export default function MapDisplay({ pickupLocation, dropLocation, stops = [] }) {
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropCoords, setDropCoords] = useState(null);
  const [stopsCoords, setStopsCoords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    
    const geocode = async (address) => {
      if (!address) return null;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      } catch {
        // Ignore
      }
      return null;
    };

    const fetchCoords = async () => {
      setLoading(true);
      try {
        if (pickupLocation) {
          const coords = await geocode(pickupLocation);
          if (active && coords) setPickupCoords(coords);
          else if (active) setPickupCoords([20.5937, 78.9629]); // Fallback India
        }
        
        const resolvedStops = [];
        if (stops && stops.length > 0) {
          for (const stop of stops) {
            await new Promise(resolve => setTimeout(resolve, 1100));
            const coords = await geocode(stop);
            if (coords) resolvedStops.push({ lat: coords[0], lng: coords[1], address: stop });
          }
        }
        if (active) setStopsCoords(resolvedStops);

        if (dropLocation) {
          // Delay to respect nominatim rate limit (1 req/s)
          await new Promise(resolve => setTimeout(resolve, 1100));
          const coords = await geocode(dropLocation);
          if (active && coords) setDropCoords(coords);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    
    fetchCoords();
    
    return () => {
      active = false;
    };
  }, [pickupLocation, dropLocation, stops]);

  if (loading) {
    return <div className="h-[400px] bg-gray-100 rounded-2xl flex items-center justify-center animate-pulse mt-6"><span className="text-gray-400">Loading map route...</span></div>;
  }

  if (!pickupCoords) return null;

  const centerCoords = pickupCoords;

  return (
    <div className="h-[400px] w-full mt-6 rounded-2xl overflow-hidden shadow-sm border border-gray-100 z-0 relative">
      <MapContainer center={centerCoords} zoom={dropCoords ? 10 : 13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Marker position={pickupCoords}>
          <Popup>Pickup: {pickupLocation}</Popup>
        </Marker>
        
        {stopsCoords.map((stop, i) => (
          <Marker key={i} position={[stop.lat, stop.lng]}>
            <Popup>Stop {i + 1}: {stop.address}</Popup>
          </Marker>
        ))}

        {dropCoords && (
          <Marker position={dropCoords}>
            <Popup>Drop: {dropLocation}</Popup>
          </Marker>
        )}

        {pickupCoords && (dropCoords || stopsCoords.length > 0) && (
          <RoutingMachine start={pickupCoords} end={dropCoords} stops={stopsCoords} />
        )}
      </MapContainer>
    </div>
  );
}
