import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useAppStore, Preferences } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';
import { FloatingVeggies } from '@/src/components/FloatingVeggies';

type Option<T extends string> = { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap };

const DIET: Option<'veg' | 'egg' | 'nonveg'>[] = [
  { value: 'veg', label: 'Vegetarian', icon: 'leaf-outline' },
  { value: 'egg', label: 'Eggitarian', icon: 'egg-outline' },
  { value: 'nonveg', label: 'Non-Vegetarian', icon: 'restaurant-outline' },
];

const GOALS: Option<'weight_loss' | 'muscle_gain'>[] = [
  { value: 'weight_loss', label: 'Weight loss', icon: 'trending-down-outline' },
  { value: 'muscle_gain', label: 'Muscle gain', icon: 'barbell-outline' },
];

const CAL: Option<'low' | 'medium' | 'high'>[] = [
  { value: 'low', label: 'Low (<400 kcal)' },
  { value: 'medium', label: 'Medium (400–600)' },
  { value: 'high', label: 'High (600+)' },
];

const BASE_ALLERGY_OPTS = ['Peanut', 'Dairy', 'Gluten', 'Soy', 'Mustard'];

// Seafood only ever appears as an allergen on fish recipes, which dietAllows
// already hard-excludes for both veg and egg diets — so it's a meaningless
// option to show until Non-Vegetarian is selected.
const allergyOptionsForDiet = (dietType?: Preferences['dietType']): string[] =>
  dietType === 'nonveg' ? [...BASE_ALLERGY_OPTS, 'Seafood'] : BASE_ALLERGY_OPTS;

const SPICE: Option<'mild' | 'medium' | 'high'>[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High Indian Spice' },
];

const DRESSING: Option<'creamy' | 'light' | 'desi'>[] = [
  { value: 'creamy', label: 'Creamy Western', icon: 'ice-cream-outline' },
  { value: 'light', label: 'Light Vinaigrette', icon: 'water-outline' },
  { value: 'desi', label: 'Desi Fusion', icon: 'flower-outline' },
];

// Mirrors the diet hierarchy in src/lib/recommend.ts's dietAllows: veg is a
// subset of egg, which is a subset of nonveg — never show a protein whose
// diet the user has already ruled out.
const VEG_PROTEINS = ['Paneer', 'Tofu', 'Chickpeas', 'Sprouts', 'Soya Beans', 'Nuts and Seeds', 'Peanuts', 'Mushroom'];
const EGG_PROTEINS = [...VEG_PROTEINS, 'Eggs'];
const NONVEG_PROTEINS = [...EGG_PROTEINS, 'Chicken', 'Fish'];

const proteinOptionsForDiet = (dietType?: Preferences['dietType']): string[] => {
  if (dietType === 'veg') return VEG_PROTEINS;
  if (dietType === 'egg') return EGG_PROTEINS;
  return NONVEG_PROTEINS;
};

const PREP: Option<'under10' | 'under20' | 'nobar'>[] = [
  { value: 'under10', label: '<10 mins' },
  { value: 'under20', label: '15–20 mins' },
  { value: 'nobar', label: 'No bar' },
];

const BUDGET: Option<'budget' | 'premium'>[] = [
  { value: 'budget', label: 'Budget (Local Seasonal)', icon: 'wallet-outline' },
  { value: 'premium', label: 'Premium (Avocado, Berries)', icon: 'diamond-outline' },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, savePreferences } = useAppStore();
  const [step, setStep] = useState(0);
  // Only prefill from saved preferences when this is an already-onboarded
  // user revisiting via "Update preferences" — `onboarded: false` covers
  // both a genuinely brand-new user and the auth screen's "New User" toggle
  // (which forces onboarded back to false on the same mock account), and
  // both of those should start every step completely blank.
  const [p, setP] = useState<Preferences>(() => (
    user?.onboarded
      ? { allergies: [], proteins: [], dressings: [], budgets: [], ...user.preferences }
      : { allergies: [], proteins: [], dressings: [], budgets: [] }
  ));

  const totalSteps = 3;
  const progress = (step + 1) / totalSteps;

  const proteinOptions = useMemo(() => proteinOptionsForDiet(p.dietType), [p.dietType]);
  const allergyOptions = useMemo(() => allergyOptionsForDiet(p.dietType), [p.dietType]);

  // If the user narrows their diet type after already picking a protein or
  // allergen (e.g. Chicken/Seafood while non-veg, then backs up to
  // Vegetarian), drop any now-invalid selections rather than silently
  // keeping them saved.
  useEffect(() => {
    setP((prev) => {
      const allowedProteins = proteinOptionsForDiet(prev.dietType);
      const allowedAllergies = allergyOptionsForDiet(prev.dietType);
      const proteins = (prev.proteins || []).filter((pr) => allowedProteins.includes(pr));
      const allergies = (prev.allergies || []).filter((a) => allowedAllergies.includes(a));
      if (proteins.length === (prev.proteins || []).length && allergies.length === (prev.allergies || []).length) {
        return prev;
      }
      return { ...prev, proteins, allergies };
    });
  }, [p.dietType]);

  const set = (k: keyof Preferences, v: any) => setP((prev) => ({ ...prev, [k]: v }));

  const toggleInArray = <K extends keyof Preferences>(k: K, v: any) => {
    setP((prev) => {
      const arr = ((prev[k] as unknown as any[]) || []).slice();
      const idx = arr.indexOf(v);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(v);
      return { ...prev, [k]: arr } as Preferences;
    });
  };

  const canNext = useMemo(() => {
    if (step === 0) {
      return !!p.dietType && !!p.fitnessGoal && !!p.calorieBucket;
    }
    if (step === 1) return !!p.spice && (p.dressings?.length ?? 0) > 0 && (p.proteins?.length ?? 0) > 0;
    if (step === 2) return !!p.prepTime && (p.budgets?.length ?? 0) > 0;
    return false;
  }, [step, p]);

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      await savePreferences(p, true);
      router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Reached onboarding via a redirect (e.g. cold start with an
      // incomplete signup) rather than a push from /auth — there's no
      // history entry to pop, so land explicitly on the auth screen.
      router.replace('/auth');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]} testID="onboarding-screen">
      <FloatingVeggies opacity={0.15} />

      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} style={styles.iconBtn} testID="onboarding-back">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.progressWrap}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.stepText} testID="onboarding-step-indicator">{step + 1}/{totalSteps}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)} key={`step-${step}`}>
          {step === 0 && (
            <View>
              <Text style={styles.h1}>Goals & Profile</Text>

              <Text style={styles.h2}>Diet Type</Text>
              <View style={styles.grid}>
                {DIET.map((o) => (
                  <Chip
                    key={o.value}
                    selected={p.dietType === o.value}
                    label={o.label}
                    icon={o.icon}
                    onPress={() => set('dietType', o.value)}
                    testID={`diet-${o.value}`}
                  />
                ))}
              </View>

              <Text style={styles.h2}>Primary Fitness Goal</Text>
              <View style={styles.grid}>
                {GOALS.map((o) => <Chip key={o.value} selected={p.fitnessGoal === o.value} label={o.label} icon={o.icon} onPress={() => set('fitnessGoal', o.value)} testID={`goal-${o.value}`} />)}
              </View>

              <Text style={styles.h2}>Calorie Target</Text>
              <View style={styles.grid}>
                {CAL.map((o) => <Chip key={o.value} selected={p.calorieBucket === o.value} label={o.label} onPress={() => set('calorieBucket', o.value)} testID={`calorie-${o.value}`} />)}
              </View>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.h1}>Taste & Restrictions</Text>

              <Text style={styles.h2}>Preferred Proteins</Text>
              <View style={styles.grid}>
                {proteinOptions.map((v) => <Chip key={v} selected={p.proteins?.includes(v) ?? false} label={v} onPress={() => toggleInArray('proteins', v)} testID={`protein-${v.toLowerCase()}`} />)}
              </View>

              <Text style={styles.h2}>Spice Tolerance</Text>
              <View style={styles.grid}>
                {SPICE.map((o) => <Chip key={o.value} selected={p.spice === o.value} label={o.label} onPress={() => set('spice', o.value)} testID={`spice-${o.value}`} />)}
              </View>

              <Text style={styles.h2}>Preferred Dressings (multi-select)</Text>
              <View style={styles.grid}>
                {DRESSING.map((o) => (
                  <Chip
                    key={o.value}
                    selected={p.dressings?.includes(o.value) ?? false}
                    label={o.label}
                    icon={o.icon}
                    onPress={() => toggleInArray('dressings', o.value)}
                    testID={`dressing-${o.value}`}
                  />
                ))}
              </View>

              <Text style={styles.h2}>Allergies / Aversions</Text>
              <View style={styles.grid}>
                {allergyOptions.map((v) => <Chip key={v} selected={p.allergies?.includes(v) ?? false} label={v} onPress={() => toggleInArray('allergies', v)} testID={`allergy-${v.toLowerCase()}`} />)}
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.h1}>Logistics</Text>

              <Text style={styles.h2}>Prep Time Limit</Text>
              <View style={styles.grid}>
                {PREP.map((o) => <Chip key={o.value} selected={p.prepTime === o.value} label={o.label} onPress={() => set('prepTime', o.value)} testID={`prep-${o.value}`} />)}
              </View>

              <Text style={styles.h2}>Budget Profile (multi-select)</Text>
              <View style={styles.grid}>
                {BUDGET.map((o) => (
                  <Chip
                    key={o.value}
                    selected={p.budgets?.includes(o.value) ?? false}
                    label={o.label}
                    icon={o.icon}
                    onPress={() => toggleInArray('budgets', o.value)}
                    testID={`budget-${o.value}`}
                  />
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          testID="onboarding-next"
          onPress={handleNext}
          disabled={!canNext}
          style={[styles.nextBtn, !canNext && styles.nextBtnDisabled]}
        >
          <Text style={styles.nextText}>{step === totalSteps - 1 ? 'Finish' : 'Next'}</Text>
          <Ionicons name={step === totalSteps - 1 ? 'checkmark' : 'arrow-forward'} size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const Chip: React.FC<{ selected?: boolean; label: string; icon?: any; onPress: () => void; testID: string }> = ({ selected, label, icon, onPress, testID }) => (
  <Pressable onPress={onPress} testID={testID} style={[styles.chip, selected && styles.chipSelected]}>
    {icon && <Ionicons name={icon} size={16} color={selected ? colors.onBrandPrimary : colors.onSurfaceSecondary} />}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary },
  progressWrap: { flex: 1, height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  stepText: { fontSize: type.sm, color: colors.mutedText, fontWeight: '600' },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  h1: { fontSize: type.xxl, fontWeight: '700', color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.lg },
  h2: { fontSize: type.lg, fontWeight: '600', color: colors.onSurfaceSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { fontSize: type.base, color: colors.onSurfaceSecondary },
  chipTextSelected: { color: colors.onBrandPrimary, fontWeight: '600' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.surface },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.pill },
  nextBtnDisabled: { backgroundColor: colors.borderStrong },
  nextText: { color: colors.onBrandPrimary, fontSize: type.lg, fontWeight: '700' },
});
