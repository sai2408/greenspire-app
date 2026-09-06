import { Recipe, Preferences } from '@/src/store/AppStore';

// Score recipes against preferences and return sorted (best first)
export const recommendRecipes = (recipes: Recipe[], prefs: Preferences | undefined, opts: { limit?: number } = {}): Recipe[] => {
  const list = recipes.map((r) => ({ r, score: scoreRecipe(r, prefs) }))
    .filter((x) => x.score > -100)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
  return opts.limit ? list.slice(0, opts.limit) : list;
};

export const dietAllows = (prefs: Preferences | undefined, recipeDiet: Recipe['diet']): boolean => {
  if (!prefs?.dietType) return true;
  if (prefs.dietType === 'veg') return recipeDiet === 'veg';
  if (prefs.dietType === 'egg') return recipeDiet === 'veg' || recipeDiet === 'egg';
  return true; // nonveg eats everything, including veg/egg

};

const scoreRecipe = (r: Recipe, prefs?: Preferences): number => {
  if (!prefs) return 0;
  let score = 0;

  // Hard filters
  if (!dietAllows(prefs, r.diet)) return -1000;
  if (prefs.allergies?.length) {
    const lc = prefs.allergies.map((a) => a.toLowerCase());
    if (r.allergens.some((a) => lc.includes(a.toLowerCase()))) return -1000;
  }

  if (prefs.calorieBucket && r.calorie_bucket === prefs.calorieBucket) score += 3;
  if (prefs.spice && r.spice === prefs.spice) score += 2;
  if (prefs.dressings?.length && prefs.dressings.includes(r.dressing_style)) score += 2;
  if (prefs.budgets?.length && prefs.budgets.includes(r.budget)) score += 2;

  if (prefs.prepTime === 'under10' && r.prep_time_min <= 10) score += 2;
  else if (prefs.prepTime === 'under20' && r.prep_time_min <= 20) score += 2;
  else if (prefs.prepTime === 'nobar') score += 1;

  if (prefs.proteins?.length) {
    const lc = prefs.proteins.map((p) => p.toLowerCase());
    if (r.proteins.some((p) => lc.includes(p.toLowerCase()))) score += 3;
  }

  if (prefs.fitnessGoal === 'weight_loss' && r.calorie_bucket === 'low') score += 2;
  if (prefs.fitnessGoal === 'muscle_gain' && r.macros.protein_g >= 25) score += 2;

  return score;
};
