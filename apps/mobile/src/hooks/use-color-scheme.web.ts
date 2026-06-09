import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Intentional one-shot hydration flag for static rendering (the documented "have I hydrated?"
    // pattern). Refactor to useSyncExternalStore if you'd rather not suppress.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-shot hydration flag
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
