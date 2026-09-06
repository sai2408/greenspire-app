import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/src/store/AppStore';
import { colors, spacing, type, radius } from '@/src/theme';

export default function AdminRecipesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, recipes, deleteRecipe } = useAppStore();

  useEffect(() => {
    if (user && !user.is_admin) router.replace('/(tabs)');
  }, [user, router]);

  if (!user?.is_admin) return null;

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete recipe', `Remove "${name}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecipe(id) },
    ]);
  };

  return (
    <View style={styles.container} testID="admin-recipes-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="admin-recipes-close">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Manage Recipes</Text>
        <Pressable onPress={() => router.push('/admin/recipe-form')} style={styles.iconBtn} testID="admin-add-recipe-btn">
          <Ionicons name="add" size={24} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`admin-recipe-row-${item.id}`}>
            <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.meta}>{item.cuisine}</Text>
            </View>
            <Pressable
              onPress={() => router.push(`/admin/recipe-form?id=${item.id}`)}
              hitSlop={10}
              style={styles.actionBtn}
              testID={`admin-edit-${item.id}`}
            >
              <Ionicons name="pencil" size={18} color={colors.brandPrimary} />
            </Pressable>
            <Pressable
              onPress={() => confirmDelete(item.id, item.name)}
              hitSlop={10}
              style={styles.actionBtn}
              testID={`admin-delete-${item.id}`}
            >
              <Ionicons name="trash" size={18} color={colors.error} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTxt}>No recipes yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: type.xl, fontWeight: '700', color: colors.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  name: { fontSize: type.base, fontWeight: '600', color: colors.onSurface },
  meta: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyTxt: { color: colors.mutedText, fontSize: type.base },
});
