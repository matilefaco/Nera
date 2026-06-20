export const normalizePortfolioCategory = (
  rawCategory: string | undefined | null,
  validCategories: { id: string; label: string }[]
): string => {
  if (!rawCategory) return 'Sem categoria';

  const raw = rawCategory.trim();
  const rawLower = raw.toLowerCase();

  // Helper to remove accents
  const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Exact string match ignoring case
  let match = validCategories.find(c => c.label.toLowerCase() === rawLower);
  if (match) return match.label;

  // 2. Singular/Plural adjustments or substring matching (with diacritics removed)
  const rawNormalized = removeAccents(rawLower);
  match = validCategories.find(c => {
    const cNormalized = removeAccents(c.label.toLowerCase());
    // basic singular/plural normalize
    const rBase = rawNormalized.replace(/s$/, '');
    const cBase = cNormalized.replace(/s$/, '');
    
    if (rBase === cBase) return true;
    return false;
  });

  if (match) return match.label;

  // 3. Generic ones that should just become "Sem categoria"
  const generics = ['portfólio', 'portfolio', 'geral', 'facial', 'corporal', 'outros', 'bem-estar', 'bem estar'];
  if (generics.includes(rawLower) || generics.includes(rawNormalized)) {
    return 'Sem categoria';
  }

  // 4. Return as-is (will be marked as (Inválida) in UI if not "Sem categoria")
  return raw;
};
