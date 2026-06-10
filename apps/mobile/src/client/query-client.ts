import { onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';

// RN has no browser online/offline events, so without this TanStack Query assumes
// permanently-online: `refetchOnReconnect` never fires and offline queries fail instantly
// (we run `retry: false`). `initialised` guards the race where the listener fires before
// the seed read resolves — the listener's value must win.
onlineManager.setEventListener((setOnline) => {
  let initialised = false;

  const eventSubscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(!!state.isConnected);
  });

  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) {
        setOnline(!!state.isConnected);
      }
    })
    .catch(() => {
      // getNetworkStateAsync can reject on some platforms; the listener still seeds state.
    });

  return eventSubscription.remove;
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});
