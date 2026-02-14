import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

type Timings = {
    Fajr: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
};

export function usePrayerTimes() {
    const [timings, setTimings] = useState<Timings | null>(null);
    const [nextPrayer, setNextPrayer] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
        getLocationAndFetchTimings();
    }, []);

    const getLocationAndFetchTimings = async () => {
        try {
            // Request location permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                setLocationError('Location permission denied');
                // Fall back to London
                await fetchTimingsByCity('London', 'UK');
                return;
            }

            // Get current location
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;
            await fetchTimingsByCoords(latitude, longitude);
        } catch (error) {
            console.error('Location error:', error);
            setLocationError('Failed to get location');
            // Fall back to London
            await fetchTimingsByCity('London', 'UK');
        }
    };

    const fetchTimingsByCoords = async (lat: number, lng: number) => {
        try {
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyy = today.getFullYear();
            
            const response = await fetch(
                `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=2`
            );
            const data = await response.json();
            if (data.code === 200) {
                setTimings(data.data.timings);
                calculateNextPrayer(data.data.timings);
            }
        } catch (error) {
            console.error('Failed to fetch prayer times', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTimingsByCity = async (city: string, country: string) => {
        try {
            const response = await fetch(
                `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=2`
            );
            const data = await response.json();
            if (data.code === 200) {
                setTimings(data.data.timings);
                calculateNextPrayer(data.data.timings);
            }
        } catch (error) {
            console.error('Failed to fetch prayer times', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateNextPrayer = (timings: Timings) => {
        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (const prayer of prayers) {
            const timeStr = timings[prayer];
            if (timeStr) {
                const [hours, minutes] = timeStr.split(':').map(Number);
                const prayerMinutes = hours * 60 + minutes;
                if (prayerMinutes > currentMinutes) {
                    setNextPrayer(prayer);
                    return;
                }
            }
        }
        // If all prayers passed, next is Fajr tomorrow
        setNextPrayer('Fajr');
    };

    return { timings, nextPrayer, loading, locationError };
}
