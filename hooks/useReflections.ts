import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REFLECTIONS, Reflection, reflectionIndexForDate } from '../data/reflections';

const FAVOURITES_KEY = '@GrowPray:reflectionFavourites';

export function useReflections() {
  const [favourites, setFavourites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setFavourites(parsed.filter((x) => typeof x === 'string'));
        }
      } catch {
        // Safe default: empty list.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Today's reflection — deterministic per calendar day.
  const today: Reflection | null = useMemo(() => {
    if (REFLECTIONS.length === 0) return null;
    return REFLECTIONS[reflectionIndexForDate(new Date())];
  }, []);

  const persist = useCallback((next: string[]) => {
    AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const isFavourite = useCallback(
    (id: string) => favourites.includes(id),
    [favourites],
  );

  const toggleFavourite = useCallback(
    (id: string) => {
      setFavourites((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const favouriteReflections = useMemo(
    () => REFLECTIONS.filter((r) => favourites.includes(r.id)),
    [favourites],
  );

  return {
    today,
    archive: REFLECTIONS,
    favourites,
    favouriteReflections,
    isFavourite,
    toggleFavourite,
    loaded,
  };
}
