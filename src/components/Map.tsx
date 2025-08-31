import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Navigation, Sun, Moon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map instance access
const MapController: React.FC<{ 
  userLocation: [number, number] | null; 
  onMapReady: (map: LeafletMap) => void; 
}> = ({ userLocation, onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return null;
};

// Add some randomization to protect exact location (within ~500m radius)
const addLocationNoise = (coords: [number, number]): [number, number] => {
  const [lat, lng] = coords;
  // Add random offset of up to ~0.005 degrees (roughly 500m)
  const latOffset = (Math.random() - 0.5) * 0.01;
  const lngOffset = (Math.random() - 0.5) * 0.01;
  return [lat + latOffset, lng + lngOffset];
};

type MapStyle = 'light' | 'dark';

const mapStyles = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    icon: Sun,
    name: 'Light'
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    icon: Moon,
    name: 'Dark'
  }
};

const Map: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showArea, setShowArea] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const mapRef = useRef<LeafletMap | null>(null);
  const { toast } = useToast();
  const defaultCenter: LatLngExpression = [55.6761, 12.5683]; // Copenhagen, Denmark

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleMapReady = (map: LeafletMap) => {
    mapRef.current = map;
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported by this browser",
        variant: "destructive"
      });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords: [number, number] = [latitude, longitude];
        setUserLocation(coords);
        
        // Show general area instead of exact location
        const areaCenter = addLocationNoise(coords);
        setShowArea(areaCenter);
        
        // Center map on general area with moderate zoom for privacy
        mapRef.current?.setView(areaCenter, 12);
        setIsLocating(false);
        toast({
          title: "Success",
          description: "General area located!"
        });
      },
      (error) => {
        setIsLocating(false);
        let message = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        toast({
          title: "Error",
          description: message,
          variant: "destructive"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  if (!isClient) {
    return (
      <div className="relative w-full min-h-[60vh] h-[70vh] rounded-lg overflow-hidden border border-border" />
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full min-h-[60vh] h-[70vh] rounded-lg overflow-hidden border border-border">
        <MapContainer
          center={defaultCenter}
          zoom={10}
          className="w-full h-full"
          zoomControl={true}
          attributionControl={false}
        >
          <MapController userLocation={showArea} onMapReady={handleMapReady} />
          <TileLayer
            key={mapStyle}
            attribution={mapStyles[mapStyle].attribution}
            url={mapStyles[mapStyle].url}
          />

          {showArea && (
            <Circle 
              center={showArea} 
              radius={800}
              pathOptions={{
                color: 'hsl(var(--primary))',
                fillColor: 'hsl(var(--primary))',
                fillOpacity: 0.2,
                weight: 2
              }}
            >
              <Popup>
                <div className="text-center">
                  <Navigation className="h-4 w-4 inline mr-1" />
                  Your General Area
                </div>
              </Popup>
            </Circle>
          )}
        </MapContainer>

        <div className="absolute top-16 right-4 z-[1000] flex flex-col gap-2">
          {(Object.keys(mapStyles) as MapStyle[]).map((style) => {
            const StyleIcon = mapStyles[style].icon;
            return (
              <Button
                key={style}
                onClick={() => setMapStyle(style)}
                size="sm"
                variant={mapStyle === style ? "default" : "secondary"}
                className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                title={`Switch to ${mapStyles[style].name} mode`}
              >
                <StyleIcon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>

        <div className="absolute top-4 right-4 z-[1000]">
          <Button
            onClick={handleLocate}
            disabled={isLocating}
            size="sm"
            variant="outline"
            className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          >
            <Navigation className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="text-center mt-2 text-xs text-muted-foreground/60">
        Map data © OpenStreetMap contributors | Tiles © CARTO | Powered by Leaflet
      </div>
    </div>
  );
};

export default Map;