import { View, Text, TouchableOpacity } from 'react-native';
import { Plant } from '../hooks/useGardenState';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
    plants: Plant[];
    onPlantClick?: (id: string) => void;
};

export function GardenGrid({ plants, onPlantClick }: Props) {
    // Simple grid logic: Just render them in a flex wrap container
    return (
        <View className="flex-1 bg-green-100 p-4 rounded-xl shadow-inner flex-row flex-wrap content-start gap-2">
            {plants.length === 0 && (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-green-800 opacity-50">Empty Garden. Start praying to grow.</Text>
                </View>
            )}

            {plants.map((plant) => (
                <TouchableOpacity
                    key={plant.id}
                    onPress={() => onPlantClick?.(plant.id)}
                    className="w-16 h-16 items-center justify-center bg-green-200 rounded-lg shadow-sm"
                >
                    <PlantIcon type={plant.type} />
                </TouchableOpacity>
            ))}
        </View>
    );
}

function PlantIcon({ type }: { type: Plant['type'] }) {
    // Using vector icons for now
    switch (type) {
        case 'palm':
            return <MaterialCommunityIcons name="palm-tree" size={32} color="#166534" />;
        case 'flower':
            return <MaterialCommunityIcons name="flower" size={28} color="#D946EF" />;
        case 'bush':
            return <MaterialCommunityIcons name="grass" size={28} color="#15803d" />;
        default:
            return <MaterialCommunityIcons name="sprout" size={24} color="#15803d" />;
    }
}
