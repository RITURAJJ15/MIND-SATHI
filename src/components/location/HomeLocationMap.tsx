import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface HomeLocationMapProps {
  latitude: number;
  longitude: number;
  locationName?: string;
  zoom?: number;
  className?: string;
}

export const HomeLocationMap: React.FC<HomeLocationMapProps> = ({
  latitude,
  longitude,
  locationName = 'My Home Location',
  zoom = 15,
  className = 'h-72 w-full rounded-2xl overflow-hidden',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check valid coordinates
    if (isNaN(latitude) || isNaN(longitude)) return;

    // If map already exists, just update view and marker
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([latitude, longitude], zoom);
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
      return;
    }

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // Add OpenStreetMap tile layer (no secret API keys required)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom branded pin icon using Tailwind styling
    const customIcon = L.divIcon({
      className: 'custom-home-pin-icon',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #d97706, #b45309);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            border: 3px solid white;
            font-size: 20px;
          ">
            📍
          </div>
          <div style="
            background: rgba(17, 24, 39, 0.92);
            color: white;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 6px;
            margin-top: 4px;
            white-space: nowrap;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            border: 1px solid rgba(255, 255, 255, 0.15);
          ">
            ${locationName}
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    // Invalidate map size after mount for modal container rendering
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [latitude, longitude, zoom, locationName]);

  return <div ref={mapContainerRef} className={className} style={{ minHeight: '280px' }} />;
};
