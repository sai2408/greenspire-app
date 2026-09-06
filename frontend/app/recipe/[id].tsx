import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Modal, ActivityIndicator, Share } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, type, radius } from '@/src/theme';
import { DonutChart } from '@/src/components/DonutChart';
import { useAppStore, MealSlot } from '@/src/store/AppStore';
import { toLocalYMD } from '@/src/lib/date';

const SLOTS: { key: MealSlot; label: string; icon: any }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'cafe-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'sunny-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snack', icon: 'ice-cream-outline' },
];

export default function RecipeDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToPlanner, getRecipeById, recipesLoading } = useAppStore();
  const recipe = id ? getRecipeById(id) : null;

  const [servings, setServings] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const scaled = useMemo(() => {
    if (!recipe) return null;
    return {
      calories: Math.round(recipe.macros.calories * servings),
      carbs: Math.round(recipe.macros.carbs_g * servings),
      protein: Math.round(recipe.macros.protein_g * servings),
      fat: Math.round(recipe.macros.fat_g * servings),
      ingredients: recipe.ingredients.map((i) => ({ ...i, qty: i.qty * servings })),
    };
  }, [recipe, servings]);

  if (recipesLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!recipe || !scaled) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.error, padding: spacing.xl }}>Recipe not found</Text>
      </View>
    );
  }

  const shareText = `Just tossed up a ${recipe.name} tracking ${scaled.calories} kcal! 🥗🔥 Made with GreenSpire — the Indian salad planner. #GreenSpireSalads #CleanEatingIndia #FitIndian #SaladGoals #VibeCoding`;

  // Deep link into this exact recipe. Opens the app directly to this screen
  // if the recipient already has it installed and taps the link. It does
  // NOT yet fall back to the App/Play Store for someone without the app —
  // that requires a hosted web page (for install detection) and a published
  // store listing (as the destination), neither of which exist yet.
  const recipeLink = ExpoLinking.createURL(`/recipe/${recipe.id}`);

  const shareRecipeLink = async () => {
    try {
      await Share.share({
        message: `Check out this ${recipe.name} recipe on GreenSpire! ${recipeLink}`,
        url: recipeLink,
      });
    } catch (e) {
      console.warn('[RecipeDetail] share failed:', e);
    }
  };

  const shareToInstagram = async () => {
    await Clipboard.setStringAsync(shareText);
    // Try to open Instagram
    const url = 'instagram://story-camera';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL('https://www.instagram.com/');
    }
    setToast('Caption copied! Paste on your Instagram post 🎉');
    setTimeout(() => setToast(null), 3000);
    setShowShare(false);
  };

  const copyCaption = async () => {
    await Clipboard.setStringAsync(shareText);
    setToast('Caption copied to clipboard!');
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddToPlanner = async (slot: MealSlot) => {
    const today = toLocalYMD(new Date());
    await addToPlanner({ date: today, slot, recipe_id: recipe.id, servings });
    setShowAdd(false);
    setToast(`Added to today's ${slot}!`);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <View style={styles.container} testID="recipe-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: recipe.image }} style={styles.hero} contentFit="cover" transition={300} />
          <LinearGradient
            colors={['rgba(17,26,19,0.3)', 'rgba(17,26,19,0)', 'rgba(17,26,19,0.85)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + spacing.sm }]} testID="recipe-back">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setShowShare(true)} style={[styles.shareBtn, { top: insets.top + spacing.sm }]} testID="recipe-share-btn">
            <Ionicons name="share-social" size={20} color="#fff" />
          </Pressable>

          <View style={styles.heroInfo}>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{recipe.cuisine}</Text>
            </View>
            <Text style={styles.heroTitle} testID="recipe-title">{recipe.name}</Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMeta}>
                <Ionicons name="time-outline" size={14} color="#fff" />
                <Text style={styles.heroMetaTxt}>{recipe.prep_time_min} mins</Text>
              </View>
              <View style={styles.heroMeta}>
                <Ionicons name="flame-outline" size={14} color="#fff" />
                <Text style={styles.heroMetaTxt}>{recipe.spice} spice</Text>
              </View>
              <View style={styles.heroMeta}>
                <Ionicons name="wallet-outline" size={14} color="#fff" />
                <Text style={styles.heroMetaTxt}>{recipe.budget}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Portion Scaler */}
        <View style={styles.scalerWrap}>
          <View style={styles.scaler} testID="portion-scaler">
            <Text style={styles.scalerLbl}>Servings</Text>
            <Pressable onPress={() => setServings(Math.max(0.5, servings - 0.5))} style={styles.scalerBtn} testID="portion-decrease">
              <Ionicons name="remove" size={18} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.scalerVal} testID="portion-value">{servings}</Text>
            <Pressable onPress={() => setServings(Math.min(5, servings + 0.5))} style={styles.scalerBtn} testID="portion-increase">
              <Ionicons name="add" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
        </View>

        {/* Nutrition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <View style={styles.card}>
            <DonutChart calories={scaled.calories} carbs_g={scaled.carbs} protein_g={scaled.protein} fat_g={scaled.fat} />
            <View style={styles.macroGrid}>
              <MacroBox label="Carbs" value={`${scaled.carbs}g`} />
              <MacroBox label="Protein" value={`${scaled.protein}g`} />
              <MacroBox label="Fats" value={`${scaled.fat}g`} />
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.card}>
            {scaled.ingredients.map((ing, i) => (
              <View key={i} style={styles.ingRow} testID={`ingredient-${i}`}>
                <View style={styles.ingBullet} />
                <Text style={styles.ingName}>{ing.name}</Text>
                <Text style={styles.ingQty}>
                  {ing.unit === 'piece' ? `${ing.qty}` : `${Math.round(ing.qty * 10) / 10}${ing.unit}`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Step by Step</Text>
          <View style={styles.card}>
            {recipe.steps.map((s, i) => (
              <View key={i} style={styles.stepRow} testID={`step-${i}`}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumTxt}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepPhase}>{s.phase}</Text>
                  <Text style={styles.stepText}>{s.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable onPress={() => setShowAdd(true)} style={styles.ctaBtn} testID="add-to-planner-btn">
          <Ionicons name="calendar" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.ctaTxt}>Add to Planner</Text>
        </Pressable>
      </View>

      {/* Add-to-Planner Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add to today&apos;s planner</Text>
            <View style={styles.slotOpts}>
              {SLOTS.map((s) => (
                <Pressable key={s.key} onPress={() => handleAddToPlanner(s.key)} style={styles.slotOpt} testID={`add-slot-${s.key}`}>
                  <Ionicons name={s.icon} size={22} color={colors.brandPrimary} />
                  <Text style={styles.slotOptTxt}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setShowAdd(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Share Sheet */}
      <Modal visible={showShare} transparent animationType="slide" onRequestClose={() => setShowShare(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Share your masterpiece</Text>
            <View style={styles.sharePreview} testID="share-preview">
              <Text style={styles.shareText}>{shareText}</Text>
            </View>
            <Pressable onPress={shareRecipeLink} style={styles.linkBtn} testID="share-recipe-link-btn">
              <Ionicons name="link" size={20} color={colors.onBrandPrimary} />
              <Text style={styles.linkBtnTxt}>Share Recipe Link</Text>
            </Pressable>
            <Pressable onPress={shareToInstagram} style={styles.instaBtn} testID="share-instagram-btn">
              <Ionicons name="logo-instagram" size={20} color="#fff" />
              <Text style={styles.instaBtnTxt}>Open Instagram</Text>
            </Pressable>
            <Pressable onPress={copyCaption} style={styles.copyBtn} testID="share-copy-btn">
              <Ionicons name="copy-outline" size={18} color={colors.brandPrimary} />
              <Text style={styles.copyBtnTxt}>Copy caption</Text>
            </Pressable>
            <Pressable onPress={() => setShowShare(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 100 }]} testID="toast">
          <Ionicons name="checkmark-circle" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const MacroBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.macroBox}>
    <Text style={styles.macroVal}>{value}</Text>
    <Text style={styles.macroLbl}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  heroWrap: { height: 360, width: '100%', position: 'relative' },
  hero: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', left: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  shareBtn: { position: 'absolute', right: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroInfo: { position: 'absolute', bottom: spacing.xxl, left: spacing.lg, right: spacing.lg },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.brandSecondary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, marginBottom: spacing.sm },
  badgeTxt: { color: colors.onBrandSecondary, fontSize: type.sm, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: type.display, fontWeight: '700', lineHeight: 36 },
  heroMetaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaTxt: { color: '#fff', fontSize: type.sm, textTransform: 'capitalize' },
  scalerWrap: { paddingHorizontal: spacing.lg, marginTop: -spacing.xl },
  scaler: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  scalerLbl: { flex: 1, fontSize: type.base, fontWeight: '600', color: colors.onSurface, paddingLeft: spacing.md },
  scalerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  scalerVal: { fontSize: type.lg, fontWeight: '700', color: colors.onSurface, width: 32, textAlign: 'center' },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  macroGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  macroBox: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  macroVal: { fontSize: type.lg, fontWeight: '700', color: colors.onSurface },
  macroLbl: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  ingBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
  ingName: { flex: 1, fontSize: type.base, color: colors.onSurfaceSecondary },
  ingQty: { fontSize: type.base, color: colors.brandPrimary, fontWeight: '700' },
  stepRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt: { color: colors.onBrandPrimary, fontWeight: '700' },
  stepPhase: { fontSize: type.sm, color: colors.brandSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  stepText: { fontSize: type.base, color: colors.onSurface, lineHeight: 20 },
  ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.pill },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: type.lg, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface, textAlign: 'center', marginBottom: spacing.lg },
  slotOpts: { flexDirection: 'row', gap: spacing.sm },
  slotOpt: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  slotOptTxt: { fontSize: type.base, fontWeight: '600', color: colors.onSurface },
  modalCancel: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  modalCancelTxt: { color: colors.error, fontSize: type.base, fontWeight: '600' },
  sharePreview: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  shareText: { fontSize: type.base, color: colors.onSurface, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.pill, marginBottom: spacing.sm },
  linkBtnTxt: { color: colors.onBrandPrimary, fontSize: type.lg, fontWeight: '700' },
  instaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#E4405F', paddingVertical: spacing.lg, borderRadius: radius.pill },
  instaBtnTxt: { color: '#fff', fontSize: type.lg, fontWeight: '700' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surfaceTertiary, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.sm },
  copyBtnTxt: { color: colors.brandPrimary, fontSize: type.base, fontWeight: '600' },
  toast: { position: 'absolute', left: spacing.lg, right: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  toastTxt: { color: colors.onBrandPrimary, fontSize: type.base, fontWeight: '600', flex: 1 },
});
