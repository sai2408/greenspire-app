import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/src/utils/storage';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Preferences {
  dietType?: 'veg' | 'egg' | 'nonveg';
  fitnessGoal?: 'weight_loss' | 'muscle_gain';
  calorieBucket?: 'low' | 'medium' | 'high';
  allergies?: string[];
  spice?: 'mild' | 'medium' | 'high';
  dressings?: ('creamy' | 'light' | 'desi')[];
  proteins?: string[];
  prepTime?: 'under10' | 'under20' | 'nobar';
  budgets?: ('budget' | 'premium')[];
}

export interface UserData {
  user_id: string;
  name: string;
  email: string;
  picture?: string;
  onboarded: boolean;
  is_admin: boolean;
  preferences: Preferences;
}

export interface PlannerItem {
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  recipe_id: string;
  servings: number;
}

export type IngredientCategory = 'Produce' | 'Proteins' | 'Condiments' | 'Nuts & Seeds';

export interface Ingredient {
  name: string;
  qty: number;
  unit: 'g' | 'ml' | 'piece';
  category: IngredientCategory;
}

export interface Step {
  phase: 'Preparation' | 'Dressing' | 'Tossing';
  text: string;
}

export interface Macros {
  calories: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
}

export interface Recipe {
  id: string;
  name: string;
  tagline: string;
  cuisine: 'Indian Street' | 'Tandoori' | 'Global Fusion';
  diet: 'veg' | 'egg' | 'chicken' | 'fish';
  proteins: string[];
  prep_time_min: number;
  spice: 'mild' | 'medium' | 'high';
  calorie_bucket: 'low' | 'medium' | 'high';
  budget: 'budget' | 'premium';
  dressing_style: 'creamy' | 'light' | 'desi';
  meal_slot: MealSlot[];
  allergens: string[];
  image: string;
  ingredients: Ingredient[];
  steps: Step[];
  macros: Macros; // per 1 serving
}

export type RecipeInput = Omit<Recipe, 'id'> & { id?: string };

interface AppStoreCtx {
  user: UserData | null;
  planner: PlannerItem[];
  recipes: Recipe[];
  recipesLoading: boolean;
  loading: boolean;
  checkedGroceryItems: string[];
  signInWithGoogle: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  savePreferences: (p: Preferences, onboarded?: boolean) => Promise<void>;
  addToPlanner: (item: PlannerItem) => Promise<void>;
  addManyToPlanner: (items: PlannerItem[]) => Promise<void>;
  removeFromPlanner: (date: string, slot: MealSlot) => Promise<void>;
  getRecipeById: (id: string) => Recipe | undefined;
  createRecipe: (payload: RecipeInput) => Promise<Recipe | null>;
  updateRecipe: (id: string, payload: RecipeInput) => Promise<Recipe | null>;
  deleteRecipe: (id: string) => Promise<void>;
  toggleGroceryItem: (key: string) => Promise<void>;
}

const AppStoreContext = createContext<AppStoreCtx | null>(null);
const STORAGE_USER = '@greenspire/user';
const STORAGE_PLAN = '@greenspire/planner';
const STORAGE_RECIPES = '@greenspire/recipes';
const STORAGE_GROCERY_CHECKED = '@greenspire/grocery_checked';
// No '@' or '/' — expo-secure-store's native Keychain binding only accepts
// alphanumeric, '.', '-', '_' (stricter than AsyncStorage's other keys above).
const STORAGE_TOKEN = 'greenspire_session_token';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

// Thrown when the backend rejects our credentials (expired/invalid session
// token, or — for the sign-in call itself — a rejected Google token). Callers
// that care about telling "not authorized" apart from "server unreachable"
// (the initial-load reconcile effect) check for this specifically.
export class UnauthorizedError extends Error {}

// Backend I/O helper. Returns null for a confirmed 404 ("not found"),
// throws for anything else (network down, 5xx, etc). Callers rely on this
// distinction to tell "no data yet" apart from "couldn't reach the server".
// Attaches the stored session token automatically; on a 401 it clears the
// (now-invalid) stored session before throwing UnauthorizedError.
async function api<T>(path: string, options?: RequestInit): Promise<T | null> {
  const { headers, ...rest } = options ?? {};
  const token = await storage.secureGet(STORAGE_TOKEN, null);
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...rest,
    });
    if (res.status === 404) return null;
    if (res.status === 401) {
      await storage.secureRemove(STORAGE_TOKEN);
      await AsyncStorage.removeItem(STORAGE_USER);
      throw new UnauthorizedError('Session invalid, expired, or rejected');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[AppStore] ${options?.method ?? 'GET'} ${path} failed:`, e);
    throw e;
  }
}

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [planner, setPlanner] = useState<PlannerItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [checkedGroceryItems, setCheckedGroceryItems] = useState<string[]>([]);

  const persistUser = useCallback(async (u: UserData | null) => {
    if (u) await AsyncStorage.setItem(STORAGE_USER, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_USER);
    setUser(u);
  }, []);

  const persistPlanner = useCallback(async (items: PlannerItem[]) => {
    await AsyncStorage.setItem(STORAGE_PLAN, JSON.stringify(items));
    setPlanner(items);
  }, []);

  const persistRecipes = useCallback(async (items: Recipe[]) => {
    await AsyncStorage.setItem(STORAGE_RECIPES, JSON.stringify(items));
    setRecipes(items);
  }, []);

  const persistCheckedGroceryItems = useCallback(async (keys: string[]) => {
    await AsyncStorage.setItem(STORAGE_GROCERY_CHECKED, JSON.stringify(keys));
    setCheckedGroceryItems(keys);
  }, []);

  // On app launch, restore any cached session then reconcile it against the
  // backend (the source of truth) — falling back to the cached copy only if
  // the backend is unreachable. A confirmed-invalid session (401) is treated
  // as a real sign-out, not a fallback-to-cache case.
  useEffect(() => {
    (async () => {
      let cachedUser: UserData | null = null;
      let cachedPlanner: PlannerItem[] = [];
      try {
        const u = await AsyncStorage.getItem(STORAGE_USER);
        const p = await AsyncStorage.getItem(STORAGE_PLAN);
        const g = await AsyncStorage.getItem(STORAGE_GROCERY_CHECKED);
        if (u) cachedUser = JSON.parse(u);
        if (p) cachedPlanner = JSON.parse(p);
        // No backend counterpart for this — it's purely local, so it's
        // restored here directly rather than going through the
        // reconcile-with-backend dance below.
        if (g) setCheckedGroceryItems(JSON.parse(g));
      } catch (e) {
        console.warn('[AppStore] AsyncStorage read failed:', e);
      }

      if (!cachedUser) {
        setLoading(false);
        return;
      }

      try {
        const remote = await api<UserData>(`/api/profile/me`);
        if (remote) {
          await persistUser(remote);
          const plannerRemote = await api<PlannerItem[]>(`/api/planner`);
          await persistPlanner(plannerRemote ?? []);
        } else {
          await persistUser(cachedUser);
          await persistPlanner(cachedPlanner);
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          await persistUser(null);
          await persistPlanner([]);
        } else {
          await persistUser(cachedUser);
          await persistPlanner(cachedPlanner);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [persistUser, persistPlanner]);

  // Recipes aren't user-scoped, so this fetch runs unconditionally and
  // independently of the user/planner reconciliation above.
  useEffect(() => {
    (async () => {
      let cachedRecipes: Recipe[] = [];
      try {
        const r = await AsyncStorage.getItem(STORAGE_RECIPES);
        if (r) cachedRecipes = JSON.parse(r);
      } catch (e) {
        console.warn('[AppStore] AsyncStorage recipes read failed:', e);
      }

      try {
        const remote = await api<Recipe[]>(`/api/recipes`);
        await persistRecipes(remote ?? []);
      } catch (e) {
        await persistRecipes(cachedRecipes);
      } finally {
        setRecipesLoading(false);
      }
    })();
  }, [persistRecipes]);

  const signInWithGoogle = useCallback(async (accessToken: string) => {
    const result = await api<{ user: UserData; token: string }>(`/api/auth/google`, {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    });
    if (!result) throw new Error('Google sign-in failed');
    await storage.secureSet(STORAGE_TOKEN, result.token);
    await persistUser(result.user);
    const plannerRemote = await api<PlannerItem[]>(`/api/planner`);
    await persistPlanner(plannerRemote ?? []);
  }, [persistUser, persistPlanner]);

  const signOut = useCallback(async () => {
    await storage.secureRemove(STORAGE_TOKEN);
    await persistUser(null);
    await persistPlanner([]);
    // Grocery-checked state is intentionally left alone — it's local-only
    // (no backend counterpart) and signing back in as the same account
    // should restore progress, not reset it.
  }, [persistUser, persistPlanner]);

  const savePreferences = useCallback(async (p: Preferences, onboarded?: boolean) => {
    if (!user) return;
    const merged: UserData = { ...user, preferences: { ...user.preferences, ...p }, onboarded: onboarded ?? user.onboarded };
    await persistUser(merged);
    try {
      await api(`/api/profile`, {
        method: 'POST',
        body: JSON.stringify({ name: merged.name, picture: merged.picture, preferences: merged.preferences, onboarded: merged.onboarded }),
      });
    } catch (e) { /* already logged in api(); local state already updated */ }
  }, [user, persistUser]);

  const addToPlanner = useCallback(async (item: PlannerItem) => {
    const filtered = planner.filter((p) => !(p.date === item.date && p.slot === item.slot));
    const next = [...filtered, item];
    await persistPlanner(next);
    if (user) {
      try {
        await api(`/api/planner`, {
          method: 'POST',
          body: JSON.stringify(item),
        });
      } catch (e) { /* already logged in api(); local state already updated */ }
    }
  }, [planner, persistPlanner, user]);

  // Batches a whole set of writes into a single state/storage update. Calling
  // addToPlanner in a loop instead would have every call compute `next` from
  // the same stale `planner` closure (the component never re-renders
  // mid-loop), so each write overwrites the last instead of accumulating.
  const addManyToPlanner = useCallback(async (items: PlannerItem[]) => {
    if (!items.length) return;
    const key = (p: { date: string; slot: MealSlot }) => `${p.date}|${p.slot}`;
    const dedupedBatch = Array.from(new Map(items.map((it) => [key(it), it])).values());
    const overridden = new Set(dedupedBatch.map(key));
    const filtered = planner.filter((p) => !overridden.has(key(p)));
    const next = [...filtered, ...dedupedBatch];
    await persistPlanner(next);
    if (user) {
      await Promise.all(dedupedBatch.map(async (item) => {
        try {
          await api(`/api/planner`, {
            method: 'POST',
            body: JSON.stringify(item),
          });
        } catch (e) { /* already logged in api(); local state already updated */ }
      }));
    }
  }, [planner, persistPlanner, user]);

  const removeFromPlanner = useCallback(async (date: string, slot: MealSlot) => {
    const next = planner.filter((p) => !(p.date === date && p.slot === slot));
    await persistPlanner(next);
    if (user) {
      try {
        await api(`/api/planner/${date}/${slot}`, { method: 'DELETE' });
      } catch (e) { /* already logged in api(); local state already updated */ }
    }
  }, [planner, persistPlanner, user]);

  const getRecipeById = useCallback((id: string) => recipes.find((r) => r.id === id), [recipes]);

  const toggleGroceryItem = useCallback(async (key: string) => {
    const next = checkedGroceryItems.includes(key)
      ? checkedGroceryItems.filter((k) => k !== key)
      : [...checkedGroceryItems, key];
    await persistCheckedGroceryItems(next);
  }, [checkedGroceryItems, persistCheckedGroceryItems]);

  // Admin mutators are not optimistic/fire-and-forget like the planner
  // writes above — they require connectivity and surface real failures,
  // since a silently-failed delete would be actively misleading to an admin.
  const createRecipe = useCallback(async (payload: RecipeInput) => {
    const created = await api<Recipe>(`/api/recipes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (created) setRecipes((prev) => [...prev, created]);
    return created;
  }, []);

  const updateRecipe = useCallback(async (id: string, payload: RecipeInput) => {
    const updated = await api<Recipe>(`/api/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (updated) setRecipes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const deleteRecipe = useCallback(async (id: string) => {
    await api(`/api/recipes/${id}`, { method: 'DELETE' });
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo(() => ({
    user, planner, recipes, recipesLoading, loading, checkedGroceryItems,
    signInWithGoogle, signOut, savePreferences, addToPlanner, addManyToPlanner, removeFromPlanner,
    getRecipeById, createRecipe, updateRecipe, deleteRecipe, toggleGroceryItem,
  }), [user, planner, recipes, recipesLoading, loading, checkedGroceryItems, signInWithGoogle, signOut, savePreferences, addToPlanner, addManyToPlanner, removeFromPlanner, getRecipeById, createRecipe, updateRecipe, deleteRecipe, toggleGroceryItem]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
};

export const useAppStore = () => {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be inside AppStoreProvider');
  return ctx;
};
