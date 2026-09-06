import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image as AvatarImage } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppStore } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';
import { DonutChart } from '@/src/components/DonutChart';
import { recommendRecipes } from '@/src/lib/recommend';
import { toLocalYMD } from '@/src/lib/date';

const today = () => toLocalYMD(new Date());
const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });
const fmtDateFull = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, planner, recipes, getRecipeById } = useAppStore();
  const [selectedDate, setSelectedDate] = useState<string>(today());

  const week = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const todaysPlan = planner.filter((p) => p.date === selectedDate);
  const todaysRecipes = todaysPlan.map((p) => ({ item: p, recipe: getRecipeById(p.recipe_id)! })).filter((x) => x.recipe);

  const totals = todaysRecipes.reduce(
    (acc, x) => {
      const s = x.item.servings || 1;
      acc.cal += x.recipe.macros.calories * s;
      acc.c += x.recipe.macros.carbs_g * s;
      acc.p += x.recipe.macros.protein_g * s;
      acc.f += x.recipe.macros.fat_g * s;
      return acc;
    },
    { cal: 0, c: 0, p: 0, f: 0 }
  );

  const suggestions = useMemo(() => recommendRecipes(recipes, user?.preferences, { limit: 6 }), [recipes, user?.preferences]);

  return (
    <View style={styles.container} testID="home-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[colors.brandTertiary, colors.surface]} style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.hello}>Hey {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
              <Text style={styles.subhello}>Fresh picks for a healthier you</Text>
            </View>
            <Pressable onPress={() => router.push('/profile-sheet')} testID="profile-avatar">
              <AvatarImage source={{ uri: user?.picture }} style={styles.avatar} resizeMode="cover" />
            </Pressable>
          </View>

          {/* Week strip (tap a day to view its plan) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
            {week.map((d, i) => {
              const key = toLocalYMD(d);
              const hasPlan = planner.some((p) => p.date === key);
              const isSelected = key === selectedDate;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedDate(key)}
                  style={[styles.dayPill, isSelected && styles.dayPillActive]}
                  testID={`day-pill-${i}`}
                >
                  <Text style={[styles.dayLbl, isSelected && styles.dayLblActive]}>{dayLabel(d)}</Text>
                  <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{d.getDate()}</Text>
                  {hasPlan && <View style={[styles.dot, isSelected && styles.dotActive]} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{selectedDate === today() ? "Today's Nutrition" : fmtDateFull(selectedDate)}</Text>
          </View>
          <View style={styles.card} testID="today-nutrition-card">
            {totals.cal === 0 ? (
              <View style={styles.emptyPlan}>
                <Ionicons name="nutrition-outline" size={36} color={colors.mutedText} />
                <Text style={styles.emptyText}>No salads planned for {selectedDate === today() ? 'today' : 'this day'}</Text>
                <Pressable onPress={() => router.push('/(tabs)/planner')} style={styles.emptyBtn} testID="empty-plan-cta">
                  <Text style={styles.emptyBtnText}>Plan a meal</Text>
                </Pressable>
              </View>
            ) : (
              <DonutChart
                calories={Math.round(totals.cal)}
                carbs_g={Math.round(totals.c)}
                protein_g={Math.round(totals.p)}
                fat_g={Math.round(totals.f)}
              />
            )}
          </View>

          {todaysRecipes.length > 0 && (
            <View style={styles.plannedList} testID="day-planned-meals">
              {todaysRecipes.map(({ item, recipe }) => (
                <Pressable
                  key={`${item.date}-${item.slot}`}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  style={styles.plannedRow}
                  testID={`planned-${item.slot}`}
                >
                  <Image source={{ uri: recipe.image }} style={styles.plannedImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plannedSlot}>{item.slot.toUpperCase()}</Text>
                    <Text style={styles.plannedName} numberOfLines={1}>{recipe.name}</Text>
                    <Text style={styles.plannedMeta}>{Math.round(recipe.macros.calories * (item.servings || 1))} kcal • {recipe.prep_time_min}m</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <Pressable onPress={() => router.push('/(tabs)/recipes')} testID="see-all-recipes">
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
            {suggestions.map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/recipe/${r.id}`)} style={styles.recipeCard} testID={`recipe-card-${r.id}`}>
                <Image source={{ uri: r.image }} style={styles.recipeImg} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.recipeGradient} />
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeName} numberOfLines={2}>{r.name}</Text>
                  <View style={styles.recipeMeta}>
                    <View style={styles.metaChip}>
                      <Ionicons name="flame-outline" size={12} color={colors.onBrandSecondary} />
                      <Text style={styles.metaTxt}>{r.macros.calories} kcal</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={12} color={colors.onBrandSecondary} />
                      <Text style={styles.metaTxt}>{r.prep_time_min}m</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  hello: { fontSize: type.xxl, fontWeight: '700', color: colors.onSurface },
  subhello: { fontSize: type.base, color: colors.mutedText, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  weekStrip: { gap: spacing.sm, paddingVertical: spacing.sm },
  dayPill: { width: 52, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  dayPillActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dayLbl: { fontSize: type.sm, color: colors.mutedText, fontWeight: '600' },
  dayLblActive: { color: colors.onBrandPrimary },
  dayNum: { fontSize: type.lg, color: colors.onSurface, fontWeight: '700', marginTop: 2 },
  dayNumActive: { color: colors.onBrandPrimary },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brandSecondary, marginTop: 3 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },
  seeAll: { color: colors.brandPrimary, fontWeight: '600', fontSize: type.base },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  emptyPlan: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  emptyText: { fontSize: type.base, color: colors.mutedText },
  emptyBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.sm },
  emptyBtnText: { color: colors.onBrandPrimary, fontWeight: '600' },
  plannedList: { marginTop: spacing.md, gap: spacing.sm },
  plannedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  plannedImg: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  plannedSlot: { fontSize: type.sm, fontWeight: '700', color: colors.brandPrimary, letterSpacing: 0.5 },
  plannedName: { fontSize: type.base, fontWeight: '600', color: colors.onSurface, marginTop: 2 },
  plannedMeta: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  rowScroll: { gap: spacing.md, paddingRight: spacing.lg },
  recipeCard: { width: 210, height: 260, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceTertiary },
  recipeImg: { width: '100%', height: '100%' },
  recipeGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' },
  recipeInfo: { position: 'absolute', bottom: spacing.md, left: spacing.md, right: spacing.md },
  recipeName: { color: '#fff', fontSize: type.lg, fontWeight: '700', marginBottom: spacing.sm },
  recipeMeta: { flexDirection: 'row', gap: spacing.sm },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSecondary },
  metaTxt: { color: colors.onBrandSecondary, fontSize: type.sm, fontWeight: '600' },
});
