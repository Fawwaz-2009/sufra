import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

/**
 * The authed app shell — the tab navigator, reached only past the root gate (a live session). The
 * branded splash overlay fades on first mount here; theming is provided by the root gate above.
 */
export default function AppLayout() {
  return (
    <>
      <AnimatedSplashOverlay />
      <AppTabs />
    </>
  );
}
