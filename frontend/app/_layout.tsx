import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppStoreProvider, useAppStore } from "@/src/store/AppStore";
import { colors } from "@/src/theme";


// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

// The single place that decides, for every route, whether the current
// visitor may see it. Previously only the root `/` route checked this —
// deep-linking straight to e.g. /profile-sheet or /recipe/[id] rendered the
// screen with a null user instead of redirecting to sign in. Renders a
// spinner instead of the requested screen while loading or mid-redirect, so
// an unauthenticated visit never flashes real screen content first.
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

  const atRoot = segments.length === 0;
  const inAuthScreen = segments[0] === 'auth';
  const inOnboarding = segments[0] === 'onboarding';
  const needsRedirect = !loading && (
    (!user && !inAuthScreen) ||
    (!!user && !user.onboarded && !inOnboarding) ||
    (!!user && user.onboarded && (inAuthScreen || inOnboarding || atRoot))
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (!inAuthScreen) router.replace('/auth');
    } else if (!user.onboarded) {
      if (!inOnboarding) router.replace('/onboarding');
    } else if (inAuthScreen || inOnboarding || atRoot) {
      router.replace('/(tabs)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, segments.join('/')]);

  if (loading || needsRedirect) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStoreProvider>
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FDFBF7' } }} />
          </AuthGuard>
        </AppStoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
