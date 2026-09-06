import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore, Recipe, RecipeInput, Ingredient, Step, IngredientCategory, MealSlot } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';

type Option<T extends string> = { value: T; label: string };

// Deliberately declared fresh here rather than shared with onboarding.tsx —
// these describe a recipe's own properties, not a user preference, and
// several (e.g. diet) use a different value set than the similarly-named
// preference despite the coincidental overlap on others.
const CUISINE: Option<Recipe['cuisine']>[] = [
  { value: 'Indian Street', label: 'Indian Street' },
  { value: 'Tandoori', label: 'Tandoori' },
  { value: 'Global Fusion', label: 'Global Fusion' },
];
const DIET: Option<Recipe['diet']>[] = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg' },
  { value: 'chicken', label: 'Chicken' },
  { value: 'fish', label: 'Fish' },
];
const SPICE: Option<Recipe['spice']>[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const CAL: Option<Recipe['calorie_bucket']>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const BUDGET: Option<Recipe['budget']>[] = [
  { value: 'budget', label: 'Budget' },
  { value: 'premium', label: 'Premium' },
];
const DRESSING: Option<Recipe['dressing_style']>[] = [
  { value: 'creamy', label: 'Creamy' },
  { value: 'light', label: 'Light' },
  { value: 'desi', label: 'Desi' },
];
const MEAL_SLOTS: Option<MealSlot>[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];
const PROTEINS = ['Paneer', 'Tofu', 'Chickpeas', 'Sprouts', 'Soya Beans', 'Nuts and Seeds', 'Peanuts', 'Mushroom', 'Eggs', 'Chicken', 'Fish'];
const ALLERGENS = ['Peanut', 'Dairy', 'Gluten', 'Soy', 'Mustard', 'Seafood'];
const UNITS: Option<Ingredient['unit']>[] = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'piece', label: 'piece' },
];
const CATEGORIES: Option<IngredientCategory>[] = [
  { value: 'Produce', label: 'Produce' },
  { value: 'Proteins', label: 'Proteins' },
  { value: 'Condiments', label: 'Condiments' },
  { value: 'Nuts & Seeds', label: 'Nuts & Seeds' },
];
const STEP_PHASES: Step['phase'][] = ['Preparation', 'Dressing', 'Tossing'];

const blankIngredient = (): Ingredient => ({ name: '', qty: 0, unit: 'g', category: 'Produce' });

const Chip: React.FC<{ label: string; selected: boolean; onPress: () => void; testID?: string }> = ({ label, selected, onPress, testID }) => (
  <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]} testID={testID}>
    <Text style={[styles.chipTxt, selected && styles.chipTxtActive]}>{label}</Text>
  </Pressable>
);

export default function RecipeFormScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, getRecipeById, createRecipe, updateRecipe } = useAppStore();
  const existing = id ? getRecipeById(id) : undefined;
  const isEdit = !!existing;

  useEffect(() => {
    if (user && !user.is_admin) router.replace('/(tabs)');
  }, [user, router]);

  const [name, setName] = useState(existing?.name ?? '');
  const [tagline, setTagline] = useState(existing?.tagline ?? '');
  const [image, setImage] = useState(existing?.image ?? '');
  const [prepTime, setPrepTime] = useState(existing ? String(existing.prep_time_min) : '');
  const [cuisine, setCuisine] = useState<Recipe['cuisine']>(existing?.cuisine ?? 'Indian Street');
  const [diet, setDiet] = useState<Recipe['diet']>(existing?.diet ?? 'veg');
  const [spice, setSpice] = useState<Recipe['spice']>(existing?.spice ?? 'mild');
  const [calorieBucket, setCalorieBucket] = useState<Recipe['calorie_bucket']>(existing?.calorie_bucket ?? 'low');
  const [budget, setBudget] = useState<Recipe['budget']>(existing?.budget ?? 'budget');
  const [dressingStyle, setDressingStyle] = useState<Recipe['dressing_style']>(existing?.dressing_style ?? 'light');
  const [mealSlot, setMealSlot] = useState<MealSlot[]>(existing?.meal_slot ?? []);
  const [proteins, setProteins] = useState<string[]>(existing?.proteins ?? []);
  const [allergens, setAllergens] = useState<string[]>(existing?.allergens ?? []);
  const [calories, setCalories] = useState(existing ? String(existing.macros.calories) : '');
  const [carbs, setCarbs] = useState(existing ? String(existing.macros.carbs_g) : '');
  const [protein, setProtein] = useState(existing ? String(existing.macros.protein_g) : '');
  const [fat, setFat] = useState(existing ? String(existing.macros.fat_g) : '');
  const [ingredients, setIngredients] = useState<Ingredient[]>(existing?.ingredients?.length ? existing.ingredients : [blankIngredient()]);
  const [steps, setSteps] = useState<Record<Step['phase'], string>>(() => {
    const base: Record<Step['phase'], string> = { Preparation: '', Dressing: '', Tossing: '' };
    existing?.steps.forEach((s) => { base[s.phase] = s.text; });
    return base;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleInArray = <T,>(list: T[], value: T, set: (v: T[]) => void) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const canSubmit = useMemo(() => name.trim() && tagline.trim() && image.trim() && prepTime, [name, tagline, image, prepTime]);

  if (!user?.is_admin) return null;

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const payload: RecipeInput = {
      id: existing?.id,
      name: name.trim(),
      tagline: tagline.trim(),
      image: image.trim(),
      cuisine,
      diet,
      spice,
      calorie_bucket: calorieBucket,
      budget,
      dressing_style: dressingStyle,
      prep_time_min: Number(prepTime) || 0,
      meal_slot: mealSlot,
      proteins,
      allergens,
      macros: {
        calories: Number(calories) || 0,
        carbs_g: Number(carbs) || 0,
        protein_g: Number(protein) || 0,
        fat_g: Number(fat) || 0,
      },
      ingredients: ingredients.filter((i) => i.name.trim()),
      steps: STEP_PHASES.map((phase) => ({ phase, text: steps[phase] })),
    };

    const result = isEdit && existing
      ? await updateRecipe(existing.id, payload).catch(() => null)
      : await createRecipe(payload).catch(() => null);

    setSubmitting(false);
    if (result) {
      router.back();
    } else {
      setError('Could not save recipe. Check your connection and try again.');
    }
  };

  return (
    <View style={styles.container} testID="admin-recipe-form-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="recipe-form-close">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Edit Recipe' : 'Add Recipe'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl, gap: spacing.lg }}>
        <Field label="Name">
          <TextInput style={styles.input} value={name} onChangeText={setName} testID="recipe-name-input" />
        </Field>
        <Field label="Tagline">
          <TextInput style={styles.input} value={tagline} onChangeText={setTagline} testID="recipe-tagline-input" />
        </Field>
        <Field label="Image URL">
          <TextInput style={styles.input} value={image} onChangeText={setImage} autoCapitalize="none" testID="recipe-image-input" />
        </Field>
        <Field label="Prep time (minutes)">
          <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" testID="recipe-preptime-input" />
        </Field>

        <Field label="Cuisine">
          <View style={styles.grid}>
            {CUISINE.map((o) => <Chip key={o.value} label={o.label} selected={cuisine === o.value} onPress={() => setCuisine(o.value)} testID={`cuisine-${o.value}`} />)}
          </View>
        </Field>
        <Field label="Diet">
          <View style={styles.grid}>
            {DIET.map((o) => <Chip key={o.value} label={o.label} selected={diet === o.value} onPress={() => setDiet(o.value)} testID={`diet-${o.value}`} />)}
          </View>
        </Field>
        <Field label="Spice">
          <View style={styles.grid}>
            {SPICE.map((o) => <Chip key={o.value} label={o.label} selected={spice === o.value} onPress={() => setSpice(o.value)} testID={`spice-${o.value}`} />)}
          </View>
        </Field>
        <Field label="Calorie bucket">
          <View style={styles.grid}>
            {CAL.map((o) => <Chip key={o.value} label={o.label} selected={calorieBucket === o.value} onPress={() => setCalorieBucket(o.value)} testID={`cal-${o.value}`} />)}
          </View>
        </Field>
        <Field label="Budget">
          <View style={styles.grid}>
            {BUDGET.map((o) => <Chip key={o.value} label={o.label} selected={budget === o.value} onPress={() => setBudget(o.value)} testID={`budget-${o.value}`} />)}
          </View>
        </Field>
        <Field label="Dressing style">
          <View style={styles.grid}>
            {DRESSING.map((o) => <Chip key={o.value} label={o.label} selected={dressingStyle === o.value} onPress={() => setDressingStyle(o.value)} testID={`dressing-${o.value}`} />)}
          </View>
        </Field>
        <Field label="Meal slots">
          <View style={styles.grid}>
            {MEAL_SLOTS.map((o) => <Chip key={o.value} label={o.label} selected={mealSlot.includes(o.value)} onPress={() => toggleInArray(mealSlot, o.value, setMealSlot)} testID={`mealslot-${o.value}`} />)}
          </View>
        </Field>
        <Field label="Proteins">
          <View style={styles.grid}>
            {PROTEINS.map((p) => <Chip key={p} label={p} selected={proteins.includes(p)} onPress={() => toggleInArray(proteins, p, setProteins)} testID={`protein-${p}`} />)}
          </View>
        </Field>
        <Field label="Allergens">
          <View style={styles.grid}>
            {ALLERGENS.map((a) => <Chip key={a} label={a} selected={allergens.includes(a)} onPress={() => toggleInArray(allergens, a, setAllergens)} testID={`allergen-${a}`} />)}
          </View>
        </Field>

        <Field label="Macros (per serving)">
          <View style={styles.macroRow}>
            <TextInput style={[styles.input, styles.macroInput]} placeholder="Calories" value={calories} onChangeText={setCalories} keyboardType="numeric" testID="macro-calories-input" />
            <TextInput style={[styles.input, styles.macroInput]} placeholder="Carbs g" value={carbs} onChangeText={setCarbs} keyboardType="numeric" testID="macro-carbs-input" />
            <TextInput style={[styles.input, styles.macroInput]} placeholder="Protein g" value={protein} onChangeText={setProtein} keyboardType="numeric" testID="macro-protein-input" />
            <TextInput style={[styles.input, styles.macroInput]} placeholder="Fat g" value={fat} onChangeText={setFat} keyboardType="numeric" testID="macro-fat-input" />
          </View>
        </Field>

        <Field label="Ingredients">
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingRow} testID={`ingredient-row-${i}`}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Ingredient name"
                value={ing.name}
                onChangeText={(v) => setIngredients((prev) => prev.map((it, idx) => (idx === i ? { ...it, name: v } : it)))}
                testID={`ingredient-name-${i}`}
              />
              <TextInput
                style={[styles.input, { width: 70 }]}
                placeholder="Qty"
                value={ing.qty ? String(ing.qty) : ''}
                onChangeText={(v) => setIngredients((prev) => prev.map((it, idx) => (idx === i ? { ...it, qty: Number(v) || 0 } : it)))}
                keyboardType="numeric"
                testID={`ingredient-qty-${i}`}
              />
              <Pressable onPress={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={10} testID={`ingredient-remove-${i}`}>
                <Ionicons name="close-circle" size={22} color={colors.error} />
              </Pressable>
            </View>
          ))}
          {ingredients.map((ing, i) => (
            <View key={`meta-${i}`} style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
              <View style={styles.grid}>
                {UNITS.map((u) => (
                  <Chip
                    key={u.value}
                    label={u.label}
                    selected={ing.unit === u.value}
                    onPress={() => setIngredients((prev) => prev.map((it, idx) => (idx === i ? { ...it, unit: u.value } : it)))}
                    testID={`ingredient-unit-${i}-${u.value}`}
                  />
                ))}
              </View>
              <View style={styles.grid}>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    selected={ing.category === c.value}
                    onPress={() => setIngredients((prev) => prev.map((it, idx) => (idx === i ? { ...it, category: c.value } : it)))}
                    testID={`ingredient-category-${i}-${c.value}`}
                  />
                ))}
              </View>
            </View>
          ))}
          <Pressable onPress={() => setIngredients((prev) => [...prev, blankIngredient()])} style={styles.addRowBtn} testID="add-ingredient-btn">
            <Ionicons name="add" size={18} color={colors.brandPrimary} />
            <Text style={styles.addRowTxt}>Add ingredient</Text>
          </Pressable>
        </Field>

        <Field label="Steps">
          {STEP_PHASES.map((phase) => (
            <View key={phase} style={{ marginBottom: spacing.sm }}>
              <Text style={styles.stepLabel}>{phase}</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={steps[phase]}
                onChangeText={(v) => setSteps((prev) => ({ ...prev, [phase]: v }))}
                multiline
                testID={`step-input-${phase}`}
              />
            </View>
          ))}
        </Field>

        {error && <Text style={styles.errorTxt}>{error}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          testID="recipe-submit-btn"
        >
          <Text style={styles.submitTxt}>{submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create recipe'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface },
  fieldLabel: { fontSize: type.base, fontWeight: '600', color: colors.onSurface, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: type.base, color: colors.onSurface, backgroundColor: colors.surfaceSecondary },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipTxt: { fontSize: type.sm, fontWeight: '600', color: colors.onSurfaceSecondary },
  chipTxtActive: { color: colors.onBrandPrimary },
  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macroInput: { flex: 1 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  addRowTxt: { color: colors.brandPrimary, fontSize: type.base, fontWeight: '600' },
  stepLabel: { fontSize: type.sm, fontWeight: '700', color: colors.brandSecondary, textTransform: 'uppercase', marginBottom: spacing.xs },
  errorTxt: { color: colors.error, fontSize: type.base, textAlign: 'center' },
  submitBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.pill, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: colors.borderStrong },
  submitTxt: { color: colors.onBrandPrimary, fontSize: type.lg, fontWeight: '700' },
});
