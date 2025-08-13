export type LatLng = { lat: number; lng: number };

export async function getGeolocation(name: string, key: string): Promise<LatLng> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(name)}&key=${key}`;
    const response = await fetch(url);
    const data = await response.json();
    const result = data.results[0]?.geometry?.location;
    if (!result) {
        throw new Error(`Geolocation for "${name}" not found.`);
    }
    return { lat: result.lat, lng: result.lng  };
}