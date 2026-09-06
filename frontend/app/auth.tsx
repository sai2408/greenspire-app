import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';

import { useAppStore } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';
import { FloatingVeggies } from '@/src/components/FloatingVeggies';

const HERO = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHNhbGFkJTIwYm93bHxlbnwwfHx8fDE3ODQ0MDU5OTB8MA&ixlib=rb-4.1.0&q=85';

// Required for the OAuth redirect promise to actually resolve — without
// this, promptAsync() hangs forever after the browser closes.
WebBrowser.maybeCompleteAuthSession();

export default function Auth() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container} testID="auth-screen">
      <View style={styles.heroWrap}>
        <Image source={{ uri: HERO }} style={styles.hero} contentFit="cover" transition={300} />
        <LinearGradient
          colors={['rgba(253,251,247,0)', 'rgba(253,251,247,0.4)', 'rgba(253,251,247,1)']}
          style={StyleSheet.absoluteFill}
        />
        <FloatingVeggies opacity={0.35} />
      </View>

      <View style={[styles.contentWrap, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="leaf" size={22} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brand}>GreenSpire</Text>
        </View>
        <Text style={styles.title}>Fresh Indian salads,{'\n'}personalised for you</Text>
        <Text style={styles.subtitle}>Track macros, plan meals and shop smarter — one salad at a time.</Text>

        {/* Google.useAuthRequest() throws on native without a platform-specific
            iosClientId/androidClientId, which this app doesn't have yet (see
            SignInUnavailable below) — mounting a wholly separate component per
            platform (rather than branching inside one) keeps that hook call
            from ever happening on native, respecting the rules of hooks. */}
        {Platform.OS === 'web' ? <GoogleSignIn /> : <SignInUnavailable />}
      </View>
    </View>
  );
}

const GoogleSignIn: React.FC = () => {
  const router = useRouter();
  const { signInWithGoogle } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token (not IdToken): the id_token-only implicit response omits profile
  // claims like picture/name — the backend verifies this access token and
  // fetches the full profile from Google's userinfo endpoint instead.
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    responseType: ResponseType.Token,
    scopes: ['openid', 'profile', 'email'],
  });

  const onSignIn = async () => {
    if (!request) return;
    setError(null);
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type === 'success' && result.params.access_token) {
        await signInWithGoogle(result.params.access_token);
        router.replace('/');
      } else if (result.type === 'error') {
        setError('Sign-in failed. Please try again.');
      }
      // 'cancel'/'dismiss': user backed out of the browser — nothing to report.
    } catch (e) {
      setError('Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        testID="google-signin-button"
        onPress={onSignIn}
        disabled={busy || !request}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onBrandSecondary} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color={colors.onBrandSecondary} />
            <Text style={styles.buttonText}>Sign in with Google</Text>
          </>
        )}
      </Pressable>

      {error && <Text style={styles.errorTxt} testID="auth-error">{error}</Text>}
    </>
  );
};

// Real Google sign-in only has a working redirect target on the web build
// right now (the OAuth client registered so far is Web-only). Native support
// needs a separate iOS/Android OAuth client plus a custom dev client build —
// out of scope for this pass.
const SignInUnavailable: React.FC = () => (
  <View style={styles.unavailableBox} testID="auth-unavailable">
    <Ionicons name="desktop-outline" size={22} color={colors.mutedText} />
    <Text style={styles.unavailableTxt}>
      Sign-in currently requires opening this app in a web browser. Native (iOS/Android) support is coming soon.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  heroWrap: { height: '55%', width: '100%' },
  hero: { width: '100%', height: '100%' },
  contentWrap: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'flex-end', marginTop: -spacing.xxxl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logoBadge: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface },
  title: { fontSize: type.display, fontWeight: '700', color: colors.onSurface, lineHeight: 38, marginBottom: spacing.sm },
  subtitle: { fontSize: type.lg, color: colors.mutedText, marginBottom: spacing.xxl, lineHeight: 22 },
  button: {
    backgroundColor: colors.brandSecondary,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    shadowColor: colors.brandSecondary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonText: { color: colors.onBrandSecondary, fontSize: type.lg, fontWeight: '700' },
  errorTxt: { marginTop: spacing.md, fontSize: type.sm, color: colors.error, textAlign: 'center' },
  unavailableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  unavailableTxt: { flex: 1, fontSize: type.sm, color: colors.mutedText, lineHeight: 18 },
});
