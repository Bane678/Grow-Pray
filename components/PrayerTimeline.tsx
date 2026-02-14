import { View, Text } from 'react-native';
import { usePrayerTimes } from '../hooks/usePrayerTimes';

export function PrayerTimeline() {
    const { timings, nextPrayer, loading } = usePrayerTimes();

    if (loading || !timings) {
        return (
            <View className="mb-4">
                <Text className="text-center text-green-700">Loading Prayer Times...</Text>
            </View>
        );
    }

    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    return (
        <View className="flex-row justify-between bg-white/50 p-4 rounded-xl mb-4">
            {prayers.map((prayer) => (
                <View key={prayer} className="items-center">
                    <Text className={`text-xs font-bold ${nextPrayer === prayer ? 'text-green-600' : 'text-gray-500'}`}>
                        {prayer}
                    </Text>
                    <Text className="text-xs text-gray-800">
                        {timings[prayer].split(' ')[0]}
                    </Text>
                </View>
            ))}
        </View>
    );
}
