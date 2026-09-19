"use client";

import { useEffect } from "react";

import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Professional {
  $id: string;
  professionalName: string;
  serviceCategory: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceArea?: string | null;
  rating?: number | null;
  availability?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  locationVisibility?: boolean;
}

interface ProfessionalMapProps {
  professionals: Professional[];
  selectedProfessional?: Professional | null;
  onSelectProfessional?: (
    professional: Professional
  ) => void;
}

const defaultCenter: [number, number] = [
  22.5726,
  88.3639,
];

const professionalIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",

  iconSize: [25, 41],

  iconAnchor: [12, 41],

  popupAnchor: [1, -34],

  shadowSize: [41, 41],
});

/*
 * Focus the map on the selected professional.
 *
 * IMPORTANT:
 * setView must run inside useEffect.
 * Running it directly during render can cause
 * Leaflet DOM lifecycle errors.
 */
function MapFocus({
  professional,
}: {
  professional?: Professional | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      professional?.latitude != null &&
      professional?.longitude != null
    ) {
      map.setView(
        [
          professional.latitude,
          professional.longitude,
        ],
        14,
        {
          animate: true,
        }
      );
    }
  }, [map, professional]);

  return null;
}

export default function ProfessionalMap({
  professionals,
  selectedProfessional,
  onSelectProfessional,
}: ProfessionalMapProps) {
  /*
   * Only professionals whose locations are public
   * and whose coordinates are available should appear
   * on the map.
   */
  const visibleProfessionals =
    professionals.filter(
      (professional) =>
        professional.locationVisibility !== false &&
        professional.latitude != null &&
        professional.longitude != null
    );

  return (
    <div className="h-[600px] w-full overflow-hidden border border-slate-800 bg-slate-950">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        {/* OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Focus map when professional is selected */}
        <MapFocus
          professional={selectedProfessional}
        />

        {/* Professional Markers */}
        {visibleProfessionals.map(
          (professional) => (
            <Marker
              key={professional.$id}
              position={[
                professional.latitude as number,
                professional.longitude as number,
              ]}
              icon={professionalIcon}
              eventHandlers={{
                click: () => {
                  onSelectProfessional?.(
                    professional
                  );
                },
              }}
            >
              <Popup>
                <div className="min-w-[190px]">
                  {/* Name */}
                  <h3 className="text-base font-semibold text-slate-900">
                    {professional.professionalName}
                  </h3>

                  {/* Category */}
                  <p className="mt-1 text-sm text-slate-600">
                    {professional.serviceCategory}
                  </p>

                  {/* Rating */}
                  {professional.rating != null && (
                    <p className="mt-1 text-sm text-slate-700">
                      ⭐{" "}
                      {professional.rating.toFixed(1)}
                    </p>
                  )}

                  {/* Service Area */}
                  {professional.serviceArea && (
                    <p className="mt-1 text-xs text-slate-500">
                      📍{" "}
                      {professional.serviceArea}
                    </p>
                  )}

                  {/* Price */}
                  {professional.minPrice != null &&
                    professional.maxPrice !=
                      null && (
                      <p className="mt-1 text-xs text-slate-500">
                        💰 ₹
                        {professional.minPrice} - ₹
                        {professional.maxPrice}
                      </p>
                    )}

                  {/* Availability */}
                  {professional.availability && (
                    <p className="mt-1 text-xs text-slate-500">
                      🕐{" "}
                      {professional.availability}
                    </p>
                  )}

                  {/* Select button */}
                  <button
                    type="button"
                    onClick={() =>
                      onSelectProfessional?.(
                        professional
                      )
                    }
                    className="mt-3 w-full border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    View Profile
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        )}
      </MapContainer>
    </div>
  );
}