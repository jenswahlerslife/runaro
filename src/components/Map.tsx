import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap, Polygon } from 'react-leaflet';
import { Icon, LatLngExpression, Map as LeafletMap, LatLngBounds } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Navigation, Sun, Moon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { Territory, createTerritoryFromActivity } from '@/utils/territory';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// FitManager: single source of truth for map fitting, prevents race conditions
let fitGeneration = 0;
let rafHandle: number | null = null;

const scheduleFit = (map: LeafletMap, bounds: LatLngBounds, padding = 110) => {
  const gen = ++fitGeneration;

  const run = () => {
    // Check if this fit was superseded
    if (fitGeneration !== gen) {
      console.log('[FitManager] Fit canceled (superseded)');
      return;
    }

    const anyMap = map as any;

    // Guard: ensure map DOM is ready
    if (!anyMap?._mapPane) {
      console.log('[FitManager] Map pane not ready, skipping fit');
      return;
    }

    if (!anyMap?._loaded) {
      console.log('[FitManager] Map not loaded, using whenReady');
      map.whenReady(() => {
        if (fitGeneration === gen && anyMap._mapPane) {
          console.log('[FitManager] Fitting bounds after ready:', bounds.toBBoxString());
          map.fitBounds(bounds, { padding: [padding, padding], animate: false });
        }
      });
      return;
    }

    console.log('[FitManager] Fitting bounds:', bounds.toBBoxString());
    map.fitBounds(bounds, { padding: [padding, padding], animate: false });
  };

  // Cancel any pending fit and schedule this one
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
  }
  rafHandle = requestAnimationFrame(run);
};

// Simplified focus function using FitManager
const focusOnTerritory = (map: LeafletMap, coords: [number, number][], padding = 110) => {
  const bounds = new LatLngBounds(coords).pad(0.18); // 18% breathing room
  scheduleFit(map, bounds, padding);
};

// Animation function to show route from start to end, then show territory
const animateRouteAndShowTerritory = async (map: LeafletMap, territory: Territory) => {
  if (!territory.routeCoordinates || territory.routeCoordinates.length < 2) {
    console.warn('[Animation] No route coordinates available for animation');
    // Fallback to polygon-only fit
    focusOnTerritory(map, territory.polygon, 110);
    return;
  }

  const routeCoords = territory.routeCoordinates;
  console.log('[Animation] Starting route animation with', routeCoords.length, 'points');

  // Focus to the full territory polygon ONCE at the start (no intermediate fits)
  focusOnTerritory(map, territory.polygon, 110);

  // Create a temporary polyline for animation
  const animatedLine = L.polyline([], {
    color: '#ef4444',
    weight: 4,
    opacity: 0.8
  }).addTo(map);

  // Animate the route drawing
  const animationDuration = 2000; // 2 seconds
  const stepCount = 50; // Number of animation steps
  const pointsPerStep = Math.max(1, Math.floor(routeCoords.length / stepCount));

  for (let i = 0; i <= stepCount; i++) {
    const endIndex = Math.min(i * pointsPerStep, routeCoords.length - 1);
    const currentPoints = routeCoords.slice(0, endIndex + 1);

    animatedLine.setLatLngs(currentPoints);

    // Wait for next animation frame
    await new Promise(resolve => setTimeout(resolve, animationDuration / stepCount));
  }

  // Wait a moment, then remove the animated line (no additional fit needed)
  setTimeout(() => {
    map.removeLayer(animatedLine);
    console.log('[Animation] Route animation complete');
  }, 500);
};

// Component to handle map instance access and territory bounds
const MapController: React.FC<{
  userLocation: [number, number] | null;
  territories: Territory[];
  focusActivityId: number | null;
  shouldAnimateRoute: boolean;
  onMapReady: (map: LeafletMap) => void;
  onFocus?: (bounds: LatLngBounds, padding: number, maxZoom: number) => void;
}> = ({ userLocation, territories, focusActivityId, shouldAnimateRoute, onMapReady, onFocus }) => {
  const map = useMap();
  const lastFocusedAidRef = useRef<number | null>(null);

  useEffect(() => {
    if (map) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  useEffect(() => {
    // Early return if map or territories not ready
    if (!map || territories.length === 0) {
      console.log('[MapController] Waiting for map or territories');
      return;
    }

    console.log('[MapController] Effect triggered:', {
      territoriesCount: territories.length,
      focusActivityId,
      lastFocusedAid: lastFocusedAidRef.current
    });

    // If we have a specific activity to focus on, fit to that ONLY
    if (focusActivityId) {
      const focusTerritory = territories.find(t => t.stravaActivityId === focusActivityId);

      if (!focusTerritory) {
        console.warn('[MapController] Focus activity not found:', focusActivityId);
        return; // Don't fit anything if territory not found yet
      }

      console.log('[MapController] Focusing on territory:', focusTerritory.name);
      lastFocusedAidRef.current = focusActivityId;

      // Single fit to polygon, with optional animation
      if (shouldAnimateRoute && focusTerritory.routeCoordinates && focusTerritory.routeCoordinates.length > 1) {
        console.log('[MapController] Using animation path');
        animateRouteAndShowTerritory(map, focusTerritory);
      } else {
        console.log('[MapController] Focusing directly on territory polygon');
        focusOnTerritory(map, focusTerritory.polygon, 110);
      }

      const bounds = new LatLngBounds(focusTerritory.polygon);
      onFocus?.(bounds, 110, 15);
      return; // Early return - do NOT fit all when focusing
    }

    // No focus activity - skip "fit all" to avoid unnecessary view changes
    console.log('[MapController] No focus activity, skipping fit-all');
  }, [map, territories, focusActivityId, shouldAnimateRoute, onFocus]);

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
  const [mapStyle, setMapStyle] = useState<MapStyle>('light');
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<LeafletMap | null>(null);
  const lastBoundsRef = useRef<LatLngBounds | null>(null);
  const lastFitOptionsRef = useRef<{ padding: number; maxZoom: number } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultCenter: LatLngExpression = [55.6761, 12.5683]; // Copenhagen, Denmark
  
  const focusActivityId = searchParams.get('aid') ? parseInt(searchParams.get('aid')!) : null;
  const shouldAnimateRoute = searchParams.get('animate') === 'true';

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchTerritories = async (retryCount = 0) => {
      if (!user || !isClient) return;

      setLoading(true);
      try {
        console.log('[Map] Fetching activities for user:', user.id, `(attempt ${retryCount + 1})`);

        // First get the user's profile ID (user_activities FK references profiles.id)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profile?.id) {
          console.error('[Map] Error fetching profile:', profileError);
          toast({
            title: "Error",
            description: "Could not load user profile",
            variant: "destructive"
          });
          return;
        }

        console.log('[Map] Found profile ID:', profile.id);

        const { data: activities, error } = await supabase
          .from('user_activities')
          .select('id, name, activity_type, strava_activity_id, polyline, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Map] Error fetching territories:', error);
          toast({
            title: "Error",
            description: "Could not load your territories",
            variant: "destructive"
          });
          return;
        }

        console.log('[Map] Fetched activities:', activities?.length || 0, 'activities');
        console.log('[Map] Raw activities data:', activities);

        const territoryList: Territory[] = [];
        activities?.forEach((activity, index) => {
          console.log(`[Map] Processing activity ${index + 1}:`, {
            id: activity.id,
            name: activity.name,
            strava_activity_id: activity.strava_activity_id,
            has_polyline: !!activity.polyline,
            polyline_length: activity.polyline?.length || 0
          });

          const territory = createTerritoryFromActivity(activity);
          if (territory) {
            territoryList.push(territory);
            console.log(`[Map] Created territory with ${territory.polygon.length} points`);
          } else {
            console.warn(`[Map] Failed to create territory from activity:`, activity.name);
          }
        });

        setTerritories(territoryList);
        console.log(`[Map] Final result: ${territoryList.length} territories ready for rendering`);

        // If we're looking for a specific activity that hasn't appeared yet, retry
        if (focusActivityId && retryCount < 3) {
          const foundActivity = territoryList.find(t => t.stravaActivityId === focusActivityId);
          if (!foundActivity) {
            console.log(`[Map] Focus activity ${focusActivityId} not found, retrying in 2 seconds...`);
            setTimeout(() => fetchTerritories(retryCount + 1), 2000);
            return;
          } else {
            console.log(`[Map] Found focus activity:`, foundActivity.name);
          }
        }

        if (territoryList.length === 0 && retryCount === 0) {
          console.warn('[Map] No territories created! Check if activities have valid polylines.');
        }
      } catch (error) {
        console.error('[Map] Error loading territories:', error);
        toast({
          title: "Error",
          description: "Failed to load territories",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTerritories();
  }, [user, isClient, toast, focusActivityId]);

  const handleMapReady = (map: LeafletMap) => {
    mapRef.current = map;
    // Single invalidate on mount to ensure proper sizing
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });
  };

  const handleFocused = (bounds: LatLngBounds, padding: number, maxZoom: number) => {
    lastBoundsRef.current = bounds;
    lastFitOptionsRef.current = { padding, maxZoom };
  };

  // Tile load handler: no-op (FitManager handles all fitting)
  const handleTileLoad = () => {
    // FitManager already handles all fits; no additional tile-based refitting needed
    // This prevents late tile loads from interfering with focused view
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

  if (!user) {
    return (
      <div className="w-full">
        <div className="relative w-full min-h-[60vh] h-[70vh] rounded-lg overflow-hidden border border-border flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center p-8">
            <Navigation className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Log in to see your territories
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Upload your running routes from Strava to see them as territories on the map
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="relative w-full min-h-[60vh] h-[70vh] rounded-lg overflow-hidden border border-border flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your territories...</p>
          </div>
        </div>
      </div>
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
          <MapController
            userLocation={showArea}
            territories={territories}
            focusActivityId={focusActivityId}
            shouldAnimateRoute={shouldAnimateRoute}
            onMapReady={handleMapReady}
            onFocus={handleFocused}
          />
          <TileLayer
            key={mapStyle}
            attribution={mapStyles[mapStyle].attribution}
            url={mapStyles[mapStyle].url}
            eventHandlers={{ load: handleTileLoad }}
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

          {/* Render territories as polygons */}
          {(focusActivityId ? territories.filter(t => t.stravaActivityId === focusActivityId) : []).map((territory, index) => {
            console.log(`[Map] Rendering territory ${index + 1}:`, {
              id: territory.id,
              name: territory.name,
              polygonPoints: territory.polygon.length,
              firstPoint: territory.polygon[0],
              lastPoint: territory.polygon[territory.polygon.length - 1],
              isFocused: focusActivityId === territory.stravaActivityId
            });
            
            return (
              <Polygon 
                key={territory.id}
                positions={territory.polygon}
                pathOptions={{
                  color: '#111827',
                  weight: 2,
                  fillColor: focusActivityId === territory.stravaActivityId ? '#ef4444' : '#f97316',
                  fillOpacity: 0.35,
                  opacity: focusActivityId === territory.stravaActivityId ? 1 : 0.8,
                }}
              >
                <Popup>
                  <div className="text-center">
                    <h4 className="font-semibold text-sm">{territory.name}</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {territory.activityType} • {new Date(territory.createdAt).toLocaleDateString('da-DK')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {territory.polygon.length} points
                    </p>
                  </div>
                </Popup>
              </Polygon>
            );
          })}
        </MapContainer>

        {/* No territories message */}
        {territories.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg text-center max-w-sm mx-4">
              <Navigation className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {focusActivityId ? "Indlæser territorium..." : "Ingen territorier endnu"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {focusActivityId
                  ? "Vent venligst mens dit nye territorium indlæses. Dette kan tage et øjeblik."
                  : "Tilslut din Strava-konto og overfør dine løberuter for at se dem som territorier på kortet."
                }
              </p>
            </div>
          </div>
        )}

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
