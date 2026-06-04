"use client";

import React, { useRef, useState, useEffect } from "react";
import { LoadScript, Autocomplete } from "@react-google-maps/api";

const libraries: "places"[] = ["places"];

export interface AddressData {
  street: string;
  city: string;
  state: string;
  zip: string;
  fullAddress: string;
  placeId: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface AddressAutocompleteProps {
  value?: string;
  onChange: (addressData: AddressData) => void;
  error?: string;
  placeholder?: string;
  className?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  error,
  placeholder = "Start typing an address...",
  className = "",
}: AddressAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(value || "");
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Support both NEXT_PUBLIC_ (Next.js) and VITE_ (Vite) prefixes for flexibility
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (value && value !== inputValue) {
      setInputValue(value);
    }
  }, [value, inputValue]);

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();

      if (place.address_components && place.geometry?.location) {
        const addressData: AddressData = {
          street: "",
          city: "",
          state: "",
          zip: "",
          fullAddress: place.formatted_address || "",
          placeId: place.place_id || "",
          coordinates: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
        };

        // Parse address components
        place.address_components.forEach((component) => {
          const types = component.types;

          if (types.includes("street_number")) {
            addressData.street = component.long_name + " ";
          }
          if (types.includes("route")) {
            addressData.street += component.long_name;
          }
          if (types.includes("locality")) {
            addressData.city = component.long_name;
          }
          if (types.includes("administrative_area_level_1")) {
            addressData.state = component.short_name;
          }
          if (types.includes("postal_code")) {
            addressData.zip = component.long_name;
          }
        });

        setInputValue(addressData.fullAddress);
        onChange(addressData);
      }
    }
  };

  if (!apiKey) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            // Fallback: create basic address data
            onChange({
              street: e.target.value,
              city: "",
              state: "",
              zip: "",
              fullAddress: e.target.value,
              placeId: "",
              coordinates: { lat: 0, lng: 0 },
            });
          }}
          placeholder={placeholder}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
            error ? "border-red-500" : "border-gray-300"
          } ${className}`}
        />
        <p className="text-yellow-600 text-xs mt-1">
          Google Maps API key not configured. Address autocomplete disabled.
        </p>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={libraries}
      onLoad={() => setIsLoaded(true)}
      onError={(error) => {
        console.error("Google Maps API load error:", error);
        setLoadError("Failed to load Google Maps API");
      }}
    >
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        {loadError ? (
          <div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                onChange({
                  street: e.target.value,
                  city: "",
                  state: "",
                  zip: "",
                  fullAddress: e.target.value,
                  placeId: "",
                  coordinates: { lat: 0, lng: 0 },
                });
              }}
              placeholder={placeholder}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                error ? "border-red-500" : "border-gray-300"
              } ${className}`}
            />
            <p className="text-yellow-600 text-xs mt-1">{loadError}</p>
          </div>
        ) : (
          <Autocomplete
            onLoad={onLoad}
            onPlaceChanged={onPlaceChanged}
            options={{
              types: ["address"],
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Bubble raw text up so parent state tracks typing even if
                // the user submits without picking a Places suggestion.
                onChange({
                  street: e.target.value,
                  city: "",
                  state: "",
                  zip: "",
                  fullAddress: e.target.value,
                  placeId: "",
                  coordinates: { lat: 0, lng: 0 },
                });
              }}
              placeholder={placeholder}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                error ? "border-red-500" : "border-gray-300"
              } ${className}`}
            />
          </Autocomplete>
        )}
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>
    </LoadScript>
  );
}
