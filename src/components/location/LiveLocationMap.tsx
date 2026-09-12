import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle, Radio } from 'lucide-react';

interface LiveLocationMapProps {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  patientName?: string;
  isLive: boolean;
  lastUpdatedText?: string;
  className?: string;
  zoom?: number;
}

export const LiveLocationMap: React.FC<LiveLocationMapProps> = ({
  latitude,
  longitude,
  accuracyMeters,
  patientName = 'Patient',
  isLive,
  lastUpdatedText,
  className = 'h-80 w-full rounded-2xl overflow-hidden relative shadow-inner',
  zoom = 16,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Initialize or update map view
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (isNaN(latitude) || isNaN(longitude)) return;

    // 1. If map exists, update center, marker, and accuracy circle
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }

      if (circleRef.current) {
        circleRef.current.setLatLng([latitude, longitude]);
        if (accuracyMeters && accuracyMeters > 0) {
          circleRef.current.setRadius(accuracyMeters);
        }
      }

      return;
    }

    // 2. Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Accuracy circle
    if (accuracyMeters && accuracyMeters > 0) {
      const circle = L.circle([latitude, longitude], {
        radius: accuracyMeters,
        color: isLive ? '#10b981' : '#9ca3af',
        fillColor: isLive ? '#10b981' : '#9ca3af',
        fillOpacity: 0.15,
        weight: 1.5,
      }).addTo(map);
      circleRef.current = circle;
    }

    // Custom pulsing pin
    const pinColor = isLive ? '#059669' : '#6b7280';
    const customIcon = L.divIcon({
      className: 'custom-live-patient-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="position: relative;">
            ${
              isLive
                ? `
              <div style="
                position: absolute;
                inset: -6px;
                border-radius: 50%;
                background: rgba(16, 185, 129, 0.4);
                animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>
            `
                : ''
            }
            <div style="
              position: relative;
              width: 44px;
              height: 44px;
              background: linear-gradient(135deg, ${pinColor}, #047857);
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
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${
              isLive ? '#10b981' : '#ef4444'
            };"></span>
            <span>${patientName}</span>
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude, isLive, patientName]);

  // Update circle color dynamically when live state changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setStyle({
        color: isLive ? '#10b981' : '#ef4444',
        fillColor: isLive ? '#10b981' : '#ef4444',
      });
    }
  }, [isLive]);

  return (
    <div className={className}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Status Badge */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200 shadow-md">
        {isLive ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-emerald-800">Live Location</span>
          </>
        ) : (
          <>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-xs font-black text-rose-800">Disconnected</span>
          </>
        )}
        {accuracyMeters && accuracyMeters > 0 && isLive && (
          <span className="text-[10px] font-bold text-gray-500 border-l border-gray-200 pl-2">
            ±{Math.round(accuracyMeters)}m
          </span>
        )}
      </div>

      {/* Disconnected Overlay Banner if inactive */}
      {!isLive && (
        <div className="absolute inset-x-0 bottom-0 z-[1000] bg-rose-950/85 backdrop-blur-xs text-white p-3 flex items-center justify-between gap-3 text-xs border-t border-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="font-extrabold text-rose-200">Location Disconnected. </span>
              <span className="text-rose-300">
                {lastUpdatedText ? `Last seen ${lastUpdatedText}. Coordinates shown are not live.` : 'Live location sharing has stopped.'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
