import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/src/theme';
import { FloatingVeggies } from '@/src/components/FloatingVeggies';

// Redirect logic now lives in AuthGuard (app/_layout.tsx), which covers
// every route, not just this one — this just renders while that decides
// where to actually send the visitor.
export default function Index() {
  return (
    <View style={styles.container} testID="splash-screen">
      <FloatingVeggies opacity={0.5} />
      <ActivityIndicator size="large" color={colors.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
