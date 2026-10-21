declare module "leaflet.heat";
declare module "leaflet-routing-machine";
declare module "react-leaflet" {
  import { ComponentType, ReactNode } from "react";
  export const MapContainer: ComponentType<any>;
  export const TileLayer: ComponentType<any>;
  export const Marker: ComponentType<any>;
  export const Popup: ComponentType<any>;
  export const useMap: () => any;
  export const useMapEvents: (handlers: any) => any;
}
declare module "*.png" {
  const content: string;
  export default content;
}
declare module "*.css";
