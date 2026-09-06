import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';

const LABELS: Record<string, string> = {
  dietType: 'Diet',
  fitnessGoal: 'Goal',
  calorieBucket: 'Calorie target',
  spice: 'Spice',
  prepTime: 'Prep time',
};

export default function ProfileSheet() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAppStore();

  const prefs = user?.preferences || {};

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  const handleReset = () => {
    router.push('/onboarding');
  };

  return (
    <View style={styles.container} testID="profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="profile-close">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }}>
        <View style={styles.userCard}>
          <Image source={{ uri: user?.picture }} style={styles.avatar} resizeMode="cover" />
          <Text style={styles.name} testID="profile-name">{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Text style={styles.sectionTitle}>Your Preferences</Text>
        <View style={styles.prefCard}>
          {Object.entries(LABELS).map(([k, label]) => (
            <View key={k} style={styles.prefRow} testID={`pref-${k}`}>
              <Text style={styles.prefLabel}>{label}</Text>
              <Text style={styles.prefVal}>{(prefs as any)[k] ?? '—'}</Text>
            </View>
          ))}
          <View style={styles.prefRow} testID="pref-dressings">
            <Text style={styles.prefLabel}>Dressings</Text>
            <Text style={styles.prefVal} numberOfLines={2}>{prefs.dressings?.length ? prefs.dressings.join(', ') : '—'}</Text>
          </View>
          <View style={styles.prefRow} testID="pref-budgets">
            <Text style={styles.prefLabel}>Budget</Text>
            <Text style={styles.prefVal} numberOfLines={2}>{prefs.budgets?.length ? prefs.budgets.join(', ') : '—'}</Text>
          </View>
          <View style={styles.prefRow} testID="pref-allergies">
            <Text style={styles.prefLabel}>Allergies</Text>
            <Text style={styles.prefVal} numberOfLines={2}>{prefs.allergies?.length ? prefs.allergies.join(', ') : 'None'}</Text>
          </View>
          <View style={[styles.prefRow, { borderBottomWidth: 0 }]} testID="pref-proteins">
            <Text style={styles.prefLabel}>Proteins</Text>
            <Text style={styles.prefVal} numberOfLines={2}>{prefs.proteins?.length ? prefs.proteins.join(', ') : '—'}</Text>
          </View>
        </View>

        <Pressable onPress={handleReset} style={styles.resetBtn} testID="update-prefs-btn">
          <Ionicons name="options" size={18} color={colors.brandPrimary} />
          <Text style={styles.resetTxt}>Update preferences</Text>
        </Pressable>

        {user?.is_admin && (
          <Pressable onPress={() => router.push('/admin/recipes')} style={styles.resetBtn} testID="manage-recipes-btn">
            <Ionicons name="restaurant" size={18} color={colors.brandPrimary} />
            <Text style={styles.resetTxt}>Manage Recipes</Text>
          </Pressable>
        )}

        <Pressable onPress={handleSignOut} style={styles.signoutBtn} testID="sign-out-btn">
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.signoutTxt}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface },
  userCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  name: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface },
  email: { fontSize: type.base, color: colors.mutedText },
  sectionTitle: { fontSize: type.lg, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.sm },
  prefCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  prefLabel: { fontSize: type.base, color: colors.mutedText },
  prefVal: { fontSize: type.base, fontWeight: '600', color: colors.onSurface, textTransform: 'capitalize', maxWidth: '60%', textAlign: 'right' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brandTertiary, paddingVertical: spacing.lg, borderRadius: radius.pill, marginTop: spacing.lg },
  resetTxt: { color: colors.brandPrimary, fontSize: type.base, fontWeight: '700' },
  signoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginTop: spacing.md },
  signoutTxt: { color: colors.error, fontSize: type.base, fontWeight: '600' },
});
