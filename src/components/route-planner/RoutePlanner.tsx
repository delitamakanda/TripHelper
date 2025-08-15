import { useState, useEffect, useMemo } from "react";
import { GoogleMap, LoadScript, DirectionsRenderer, Marker } from "@react-google-maps/api";
import dayjs from "dayjs";
import { getGeolocation } from "../../services/googleRouting";
import {Card, CardContent} from "../card/Card";
import { Input } from "react-aria-components";

type DayPlan = {
    day: string;
    activities: string[];
}

const mapContainerStyle = {
    width: "100%",
    height: "400px",
    borderRadius: "10px",
};

const LIBRAIRIES: ["places"] = ["places"];

const MODES = ["DRIVING", "WALKING", "BICYCLING", "TRANSIT"] as const;
type TravelMode = typeof MODES[number];

const getCurrentLocation = (): Promise<google.maps.LatLngLiteral> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            (error) => {
                reject(error)
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )
    })
}

export default function TripPlanner({
    apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    plans,
    defaultCenter = { lat: 25.046, lng: 121.516 },
 }: { apiKey?: string, plans: DayPlan[], defaultCenter?: { lat: number; lng: number}}) {
    const [selectedDay, setSelectedDay] = useState(plans[0]?.day || '');
    const [selectedMode, setSelectedMode] = useState<TravelMode>('WALKING');
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [departureTime, setDepartureTime] = useState(dayjs().hour(9).minute(0).toISOString());
    const [summary, setSummary] = useState<{ distanceKm: number; durationMin: number }>({ distanceKm: 0, durationMin: 0 });

    const day = useMemo(() => plans.find(plan => plan.day === selectedDay), [plans, selectedDay]);
    const [useCurrentLocation, setUseCurrentLocation] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null);

    async function ComputeRoute() {
        if (!day || day.activities.length < 2) {
            setDirections(null);
            return;
        }
        setLoading(true);
        try {
            let origin;
            const coords = await Promise.all(day.activities.map(name => getGeolocation(`${name} Taipei`, apiKey)));
            if (useCurrentLocation) {
                try {
                    origin = await getCurrentLocation();
                    setCurrentLocation(origin);
                } catch (error) {
                    console.error('Error getting current location:', error);
                    origin = coords[0];
                }
            } else {
                origin = coords[0];
            }
            const destinations = coords[coords.length - 1];
            const waypoints = coords.slice(useCurrentLocation ? 0 : 1, -1).map(coord => ({ location: coord }));
            const service = new google.maps.DirectionsService();
            const result = await service.route({
                origin: origin,
                destination: destinations,
                waypoints: waypoints,
                provideRouteAlternatives: false,
                travelMode: google.maps.TravelMode[selectedMode],
                transitOptions: selectedMode === 'TRANSIT' ? { departureTime: new Date(departureTime) } : undefined,
                unitSystem: google.maps.UnitSystem.METRIC,
            })
            setDirections(result);
            let distanceMeters = 0;
            let durationSeconds = 0;
            result.routes[0].legs.forEach(leg => {
                distanceMeters += leg.distance?.value || 0;
                durationSeconds += leg.duration?.value || 0;
            })
            setSummary({ distanceKm: +(distanceMeters / 1000).toFixed(1), durationMin: Math.round(durationSeconds / 60) });
        } catch {
            setDirections(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (day) {
            ComputeRoute();
        }
    }, [selectedDay, selectedMode, departureTime]);


    return (
        <Card>
            <CardContent className="space-y-3 dark:bg-black">
                <h2 className="text-lg font-semibold dark:text-white">🗺️ Planificateur d’itinéraire</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                        <p className="text-sm font-medium mb-1">Jour</p>
                        <select className="border rounded px-2 py-1 text-sm w-full" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
                            {
                                plans.map(plan => (
                                    <option key={plan.day} value={plan.day}>{plan.day}</option>
                                ))
                            }
                        </select>
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-1">Mode</p>
                        <select className="border rounded px-2 py-1 text-sm w-full" value={selectedMode} onChange={e => setSelectedMode(e.target.value as TravelMode)}>
                            {
                                MODES.map(mode => (
                                    <option key={mode} value={mode}>{mode}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div>
                        <p className="text-sm font-medium mb-1">Horaire de départ</p>
                        <Input type="datetime-local" className="border rounded px-2 py-1 text-sm w-full" value={dayjs(departureTime).format("YYYY-MM-DDTHH:mm")} onChange={e => setDepartureTime(dayjs(e.target.value).toISOString())} />
                    </div>
                </div>
                <div className="flex items-center mt-2">
                    <input type="checkbox" className="mr-2" id="use-current-location" checked={useCurrentLocation} onChange={e => setUseCurrentLocation(e.target.checked)} />
                    <label htmlFor="use-current-location" className="text-sm">Utiliser votre position actuelle</label>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={ComputeRoute} disabled={loading}>{loading ? 'Calcul...' : "Recalculer"}</button>
                    <p className="text-sm text-gray-600">
                        Total ≈ <strong>{summary.distanceKm} km</strong> · <strong>{summary.durationMin} min</strong>
                    </p>
                </div>

                <LoadScript googleMapsApiKey={apiKey} libraries={LIBRAIRIES}>
                    <GoogleMap mapContainerStyle={mapContainerStyle}
                        center={defaultCenter || currentLocation} zoom={12}>
                        {directions && <DirectionsRenderer directions={directions} />}
                        {currentLocation && useCurrentLocation && <Marker position={currentLocation} icon={{
                            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                        }} />}
                    </GoogleMap>
                </LoadScript>

                {directions?.routes?.[0] && (
                    <div className="mt-3">
                        <p className="text-sm font-medium">Etapes :</p>
                        <ol className="list-decimal list-inside text-sm text-gray-700">
                            {
                                directions?.routes[0].waypoint_order ? [0, ...directions.routes[0].waypoint_order].map(index => (
                                    <li key={index}>{day!.activities[index]}</li>
                                )) : day!.activities.map((activity, index) => (
                                    <li key={index}>{activity}</li>
                                ))
                            }
                        </ol>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}