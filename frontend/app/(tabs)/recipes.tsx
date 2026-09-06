import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore, Recipe } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';
import { recommendRecipes, dietAllows } from '@/src/lib/recommend';

const FILTERS = ['For You', 'Indian Street', 'Tandoori', 'Global Fusion', 'Under 10m', 'High Protein'] as const;
type FilterKey = typeof FILTERS[number];
type DietFilter = 'all' | 'veg' | 'nonveg';

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, recipes } = useAppStore();
  const [filter, setFilter] = useState<FilterKey>('For You');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');

  // Vegetarian and Eggitarian users' recipes are already all-veg-compatible
  // (enforced below via dietAllows), so a Veg/Non-Veg toggle has nothing
  // meaningful to filter — only Non-Vegetarian (or no preference set yet)
  // actually needs the choice between the two.
  const showDietToggle = !user?.preferences?.dietType || user.preferences.dietType === 'nonveg';

  useEffect(() => {
    if (!showDietToggle && dietFilter !== 'all') setDietFilter('all');
  }, [showDietToggle, dietFilter]);

  const list = useMemo(() => {
    let base: Recipe[] = recipes;
    if (filter === 'For You') base = recommendRecipes(recipes, user?.preferences);
    else if (filter === 'Under 10m') base = recipes.filter((r) => r.prep_time_min <= 10);
    else if (filter === 'High Protein') base = recipes.filter((r) => r.macros.protein_g >= 25);
    else base = recipes.filter((r) => r.cuisine === filter);

    // Every tab — not just "For You" — must respect the user's onboarding
    // diet. A Vegetarian browsing "Tandoori" should never see a chicken dish.
    base = base.filter((r) => dietAllows(user?.preferences, r.diet));

    if (dietFilter === 'veg') base = base.filter((r) => r.diet === 'veg');
    else if (dietFilter === 'nonveg') base = base.filter((r) => r.diet === 'chicken' || r.diet === 'fish' || r.diet === 'egg');

    return base;
  }, [recipes, filter, dietFilter, user?.preferences]);

  return (
    <View style={styles.container} testID="recipes-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Recipes</Text>
        <Text style={styles.subtitle}>{list.length} salads to explore</Text>

        {/* Veg / Non-Veg toggle — only meaningful for a Non-Vegetarian user */}
        {showDietToggle && (
          <View style={styles.dietToggle} testID="diet-toggle">
            <Pressable
              onPress={() => setDietFilter(dietFilter === 'veg' ? 'all' : 'veg')}
              style={[styles.dietBtn, dietFilter === 'veg' && styles.dietBtnVegActive]}
              testID="diet-toggle-veg"
            >
              <View style={[styles.dietDot, { backgroundColor: '#2E7D32' }]} />
              <Text style={[styles.dietBtnTxt, dietFilter === 'veg' && styles.dietBtnTxtActive]}>Veg Only</Text>
            </Pressable>
            <Pressable
              onPress={() => setDietFilter(dietFilter === 'nonveg' ? 'all' : 'nonveg')}
              style={[styles.dietBtn, dietFilter === 'nonveg' && styles.dietBtnNonVegActive]}
              testID="diet-toggle-nonveg"
            >
              <View style={[styles.dietDot, { backgroundColor: '#D32F2F' }]} />
              <Text style={[styles.dietBtnTxt, dietFilter === 'nonveg' && styles.dietBtnTxtActive]}>Non-Veg Only</Text>
            </Pressable>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              testID={`filter-${f.replace(/\s/g, '-').toLowerCase()}`}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
            >
              <Text style={[styles.filterTxt, filter === f && styles.filterTxtActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/recipe/${item.id}`)} style={styles.card} testID={`recipe-list-${item.id}`}>
            <Image source={{ uri: item.image }} style={styles.cardImg} contentFit="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.cardGradient} />
            <View style={styles.cardContent}>
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{item.cuisine}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cardTagline} numberOfLines={1}>{item.tagline}</Text>
              <View style={styles.cardMeta}>
                <MetaPill icon="flame-outline" text={`${item.macros.calories} kcal`} />
                <MetaPill icon="time-outline" text={`${item.prep_time_min}m`} />
                <MetaPill icon="barbell-outline" text={`${item.macros.protein_g}g protein`} />
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTxt}>No recipes match your filters yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const MetaPill: React.FC<{ icon: any; text: string }> = ({ icon, text }) => (
  <View style={styles.metaPill}>
    <Ionicons name={icon} size={12} color={colors.onBrandSecondary} />
    <Text style={styles.metaPillTxt}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  title: { fontSize: type.xxl, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  dietToggle: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  dietBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border },
  dietBtnVegActive: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  dietBtnNonVegActive: { backgroundColor: '#FDECEA', borderColor: '#D32F2F' },
  dietDot: { width: 10, height: 10, borderRadius: 5 },
  dietBtnTxt: { fontSize: type.base, fontWeight: '600', color: colors.mutedText },
  dietBtnTxtActive: { color: colors.onSurface },
  filterRow: { gap: spacing.sm, paddingVertical: spacing.md, paddingRight: spacing.lg },
  filterChip: { flexShrink: 0, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: colors.brandPrimary },
  filterTxt: { fontSize: type.base, color: colors.onSurfaceSecondary, fontWeight: '600' },
  filterTxtActive: { color: colors.onBrandPrimary },
  card: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceTertiary },
  cardImg: { width: '100%', height: '100%' },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '75%' },
  cardContent: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, marginBottom: spacing.sm },
  badgeTxt: { color: colors.onBrandPrimary, fontSize: type.sm, fontWeight: '700' },
  cardName: { color: '#fff', fontSize: type.xl, fontWeight: '700' },
  cardTagline: { color: '#e5e5e5', fontSize: type.sm, marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSecondary },
  metaPillTxt: { color: colors.onBrandSecondary, fontSize: type.sm, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTxt: { color: colors.mutedText, fontSize: type.base },
});
