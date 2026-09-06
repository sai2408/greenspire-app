import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, MealSlot, Recipe } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';
import { recommendRecipes, dietAllows } from '@/src/lib/recommend';
import { toLocalYMD } from '@/src/lib/date';

const SLOTS: { key: MealSlot; label: string; icon: any }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'cafe-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'sunny-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snack', icon: 'ice-cream-outline' },
];

const fmtDate = (d: Date) => toLocalYMD(d);
const displayDate = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const { planner, user, recipes, getRecipeById, addToPlanner, addManyToPlanner, removeFromPlanner } = useAppStore();
  const [range, setRange] = useState<7 | 30>(7);
  const [pick, setPick] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all');

  // Veg users only ever see veg-compatible recipes anyway (dietAllows below
  // already guarantees that), so there's nothing meaningful to toggle for
  // them — the Veg/Non-Veg choice only matters once egg or meat dishes are
  // in play (egg or non-veg preference, or no preference set yet).
  const showDietToggle = user?.preferences?.dietType !== 'veg';

  const pickerRecipes = useMemo(() => {
    let base = recipes.filter((r) => dietAllows(user?.preferences, r.diet));
    if (dietFilter === 'veg') base = base.filter((r) => r.diet === 'veg');
    else if (dietFilter === 'nonveg') base = base.filter((r) => r.diet === 'chicken' || r.diet === 'fish' || r.diet === 'egg');
    return base;
  }, [recipes, user?.preferences, dietFilter]);

  const days = useMemo(() => {
    const start = new Date();
    return Array.from({ length: range }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [range]);

  const autoGenerate = async () => {
    const suggestions = recommendRecipes(recipes, user?.preferences, { limit: recipes.length });
    if (!suggestions.length) return;
    const slotOrder = SLOTS.map((s) => s.key);
    // Prefer recipes actually tagged for that slot (e.g. don't put a
    // dinner-only salad in Breakfast); fall back to the full list only if a
    // slot has no matching recipe among the user's diet-filtered suggestions.
    const bySlot: Record<MealSlot, Recipe[]> = {
      breakfast: suggestions.filter((r) => r.meal_slot.includes('breakfast')),
      lunch: suggestions.filter((r) => r.meal_slot.includes('lunch')),
      dinner: suggestions.filter((r) => r.meal_slot.includes('dinner')),
      snack: suggestions.filter((r) => r.meal_slot.includes('snack')),
    };
    const idxBySlot: Record<MealSlot, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    const items = days.flatMap((d) => slotOrder.map((slot) => {
      const pool = bySlot[slot].length ? bySlot[slot] : suggestions;
      const rec = pool[idxBySlot[slot] % pool.length];
      idxBySlot[slot] += 1;
      return { date: fmtDate(d), slot, recipe_id: rec.id, servings: 1 };
    }));
    await addManyToPlanner(items);
  };

  return (
    <View style={styles.container} testID="planner-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>Meal Planner</Text>
            <Text style={styles.subtitle}>Plan your salads ahead</Text>
          </View>
          <Pressable onPress={autoGenerate} style={styles.autoBtn} testID="auto-generate-btn">
            <Ionicons name="sparkles" size={16} color={colors.onBrandSecondary} />
            <Text style={styles.autoTxt}>Auto-fill</Text>
          </Pressable>
        </View>
        <View style={styles.rangeRow}>
          <Pressable onPress={() => setRange(7)} style={[styles.rangeChip, range === 7 && styles.rangeChipActive]} testID="range-7">
            <Text style={[styles.rangeTxt, range === 7 && styles.rangeTxtActive]}>7 Day</Text>
          </Pressable>
          <Pressable onPress={() => setRange(30)} style={[styles.rangeChip, range === 30 && styles.rangeChipActive]} testID="range-30">
            <Text style={[styles.rangeTxt, range === 30 && styles.rangeTxtActive]}>30 Day</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}>
        {days.map((d) => {
          const dateKey = fmtDate(d);
          const items = planner.filter((p) => p.date === dateKey);
          return (
            <View key={dateKey} style={styles.dayCard} testID={`plan-day-${dateKey}`}>
              <Text style={styles.dayHeader}>{displayDate(d)}</Text>
              {SLOTS.map((s) => {
                const item = items.find((x) => x.slot === s.key);
                const recipe = item ? getRecipeById(item.recipe_id) : null;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setPick({ date: dateKey, slot: s.key })}
                    style={styles.slotRow}
                    testID={`slot-${dateKey}-${s.key}`}
                  >
                    <View style={styles.slotIcon}>
                      <Ionicons name={s.icon} size={16} color={colors.brandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotLabel}>{s.label}</Text>
                      {recipe ? (
                        <Text style={styles.slotRecipe} numberOfLines={1}>{recipe.name} • {recipe.macros.calories} kcal</Text>
                      ) : (
                        <Text style={styles.slotEmpty}>Tap to add a salad</Text>
                      )}
                    </View>
                    {recipe ? (
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); removeFromPlanner(dateKey, s.key); }}
                        hitSlop={10}
                        testID={`remove-${dateKey}-${s.key}`}
                      >
                        <Ionicons name="close-circle" size={22} color={colors.mutedText} />
                      </Pressable>
                    ) : (
                      <Ionicons name="add-circle" size={22} color={colors.brandPrimary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!pick} animationType="slide" transparent onRequestClose={() => setPick(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pick a salad</Text>
            {showDietToggle && (
              <View style={styles.dietToggle} testID="picker-diet-toggle">
                <Pressable
                  onPress={() => setDietFilter(dietFilter === 'veg' ? 'all' : 'veg')}
                  style={[styles.dietBtn, dietFilter === 'veg' && styles.dietBtnVegActive]}
                  testID="picker-diet-toggle-veg"
                >
                  <View style={[styles.dietDot, { backgroundColor: '#2E7D32' }]} />
                  <Text style={[styles.dietBtnTxt, dietFilter === 'veg' && styles.dietBtnTxtActive]}>Only Veg</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDietFilter(dietFilter === 'nonveg' ? 'all' : 'nonveg')}
                  style={[styles.dietBtn, dietFilter === 'nonveg' && styles.dietBtnNonVegActive]}
                  testID="picker-diet-toggle-nonveg"
                >
                  <View style={[styles.dietDot, { backgroundColor: '#D32F2F' }]} />
                  <Text style={[styles.dietBtnTxt, dietFilter === 'nonveg' && styles.dietBtnTxtActive]}>Only Non-Veg</Text>
                </Pressable>
              </View>
            )}
            <FlatList
              data={pickerRecipes}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={async () => {
                    if (!pick) return;
                    await addToPlanner({ ...pick, recipe_id: item.id, servings: 1 });
                    setPick(null);
                  }}
                  style={styles.pickRow}
                  testID={`pick-recipe-${item.id}`}
                >
                  <Image source={{ uri: item.image }} style={styles.pickImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{item.name}</Text>
                    <Text style={styles.pickMeta}>{item.macros.calories} kcal • {item.prep_time_min}m</Text>
                  </View>
                </Pressable>
              )}
            />
            <Pressable onPress={() => setPick(null)} style={styles.modalCancel} testID="cancel-pick">
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: type.xxl, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  autoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandSecondary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  autoTxt: { color: colors.onBrandSecondary, fontWeight: '700', fontSize: type.base },
  rangeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  rangeChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  rangeChipActive: { backgroundColor: colors.brandPrimary },
  rangeTxt: { color: colors.onSurfaceSecondary, fontWeight: '600' },
  rangeTxtActive: { color: colors.onBrandPrimary },
  dayCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  dayHeader: { fontSize: type.lg, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  slotIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  slotLabel: { fontSize: type.base, fontWeight: '600', color: colors.onSurfaceSecondary },
  slotRecipe: { fontSize: type.sm, color: colors.brandPrimary, marginTop: 2 },
  slotEmpty: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginTop: spacing.sm },
  modalTitle: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginTop: spacing.md },
  dietToggle: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  dietBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border },
  dietBtnVegActive: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  dietBtnNonVegActive: { backgroundColor: '#FDECEA', borderColor: '#D32F2F' },
  dietDot: { width: 10, height: 10, borderRadius: 5 },
  dietBtnTxt: { fontSize: type.base, fontWeight: '600', color: colors.mutedText },
  dietBtnTxtActive: { color: colors.onSurface },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  pickImg: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  pickName: { fontSize: type.base, fontWeight: '600', color: colors.onSurface },
  pickMeta: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  modalCancel: { paddingVertical: spacing.md, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  modalCancelTxt: { color: colors.error, fontSize: type.base, fontWeight: '600' },
});
