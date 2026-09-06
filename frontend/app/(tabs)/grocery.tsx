import { useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, IngredientCategory } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';

interface AggregatedItem {
  name: string;
  qty: number;
  unit: string;
  category: IngredientCategory;
}

const CATEGORY_ORDER: IngredientCategory[] = ['Produce', 'Proteins', 'Condiments', 'Nuts & Seeds'];
const CATEGORY_ICONS: Record<IngredientCategory, any> = {
  'Produce': 'leaf-outline',
  'Proteins': 'egg-outline',
  'Condiments': 'wine-outline',
  'Nuts & Seeds': 'flower-outline',
};

export default function GroceryScreen() {
  const insets = useSafeAreaInsets();
  const { planner, getRecipeById, recipes, checkedGroceryItems, toggleGroceryItem } = useAppStore();
  const checked = useMemo(() => new Set(checkedGroceryItems), [checkedGroceryItems]);

  const sections = useMemo(() => {
    // Aggregate ingredients across planner
    const map = new Map<string, AggregatedItem>();
    for (const p of planner) {
      const r = getRecipeById(p.recipe_id);
      if (!r) continue;
      for (const ing of r.ingredients) {
        const key = `${ing.name}||${ing.unit}||${ing.category}`;
        const prev = map.get(key);
        const addQty = ing.qty * (p.servings || 1);
        if (prev) prev.qty += addQty;
        else map.set(key, { name: ing.name, qty: addQty, unit: ing.unit, category: ing.category });
      }
    }
    const items = Array.from(map.values());
    return CATEGORY_ORDER.map((cat) => ({
      title: cat,
      data: items.filter((i) => i.category === cat).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((s) => s.data.length > 0);
  }, [planner, recipes, getRecipeById]);

  const totalItems = sections.reduce((n, s) => n + s.data.length, 0);
  const checkedCount = checked.size;

  const toggle = (key: string) => {
    toggleGroceryItem(key);
  };

  return (
    <View style={styles.container} testID="grocery-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Smart Grocery List</Text>
        <Text style={styles.subtitle}>
          {totalItems === 0
            ? 'Add salads to your planner to build your list'
            : `${checkedCount}/${totalItems} items collected`}
        </Text>
        {totalItems > 0 && (
          <View style={styles.progressWrap}>
            <View style={[styles.progressFill, { width: `${(checkedCount / totalItems) * 100}%` }]} />
          </View>
        )}
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={48} color={colors.mutedText} />
          <Text style={styles.emptyTxt}>Your grocery list is empty</Text>
          <Text style={styles.emptySub}>Plan meals in the Planner tab to auto-generate your shopping list.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.name}-${item.unit}`}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader} testID={`section-${section.title.replace(/\s+/g, '-').toLowerCase()}`}>
              <Ionicons name={CATEGORY_ICONS[section.title as IngredientCategory]} size={18} color={colors.brandPrimary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const key = `${item.name}||${item.unit}||${item.category}`;
            const isChecked = checked.has(key);
            return (
              <Pressable
                onPress={() => toggle(key)}
                style={[styles.row, isChecked && styles.rowChecked]}
                testID={`grocery-item-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, isChecked && styles.itemNameChecked]}>{item.name}</Text>
                </View>
                <Text style={[styles.itemQty, isChecked && styles.itemNameChecked]}>
                  {item.unit === 'piece' ? `${item.qty}` : `${Math.round(item.qty)}${item.unit}`}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  title: { fontSize: type.xxl, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  progressWrap: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyTxt: { fontSize: type.lg, fontWeight: '600', color: colors.onSurface },
  emptySub: { fontSize: type.base, color: colors.mutedText, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { flex: 1, fontSize: type.lg, fontWeight: '700', color: colors.onSurface },
  sectionCount: { backgroundColor: colors.brandTertiary, color: colors.brandPrimary, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, fontSize: type.sm, fontWeight: '700', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  rowChecked: { backgroundColor: colors.surfaceTertiary, borderColor: colors.divider },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  itemName: { fontSize: type.base, color: colors.onSurface, fontWeight: '600' },
  itemNameChecked: { color: colors.mutedText, textDecorationLine: 'line-through' },
  itemQty: { fontSize: type.base, color: colors.brandPrimary, fontWeight: '700' },
});
