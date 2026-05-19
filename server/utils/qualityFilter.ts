/**
 * qualityFilter
 * Helper utility to centralize target criteria for non-public, fake, QA, audit, or test profiles.
 */

export interface UserProfileData {
  name?: string;
  displayName?: string;
  slug?: string;
  email?: string;
  onboardingCompleted?: boolean;
  indexable?: boolean;
  specialty?: string;
}

/**
 * Checks if a profile matches any test, fake, QA, audit, or draft criteria.
 * Returns true if the profile is classified as non-public/test/fake.
 */
export function isNonPublicProfile(userData: UserProfileData | null | undefined): boolean {
  if (!userData) return true;

  const displayNameStr = userData.displayName || "";
  const nameStr = userData.name || "";
  const name = (displayNameStr || nameStr || "").toLowerCase().trim();
  const slug = (userData.slug || "").toLowerCase().trim();
  const email = (userData.email || "").toLowerCase().trim();
  const specialty = (userData.specialty || "").trim();

  // 1. Minimum structural validation
  if (!slug || slug.length < 3) return true;
  if (!specialty) return true;
  if (userData.onboardingCompleted !== true) return true;
  if (userData.indexable !== true) return true;

  // 2. Reserved system slugs represent controlled demo/internal placeholders
  const RESERVED_SLUGS = ['helena-prado', 'exemplo', 'admin', 'nera', 'suporte', 'ajuda', 'beta'];
  if (RESERVED_SLUGS.includes(slug)) {
    return true;
  }

  // 3. Email filters: contendo test, teste, qa, audit, codex, fake, example, demo interna, demo
  const BANNED_EMAIL_SUBSTRINGS = ['test', 'teste', 'qa', 'audit', 'codex', 'fake', 'example', 'demo interna', 'demo'];
  if (email && BANNED_EMAIL_SUBSTRINGS.some(sub => email.includes(sub))) {
    return true;
  }

  // 4. Slug filters: contendo test, teste, qa, audit, regress, fake, lixo
  const BANNED_SLUG_SUBSTRINGS = ['test', 'teste', 'qa', 'audit', 'regress', 'fake', 'lixo'];
  if (BANNED_SLUG_SUBSTRINGS.some(sub => slug.includes(sub))) {
    return true;
  }

  // 5. Name filters: contendo teste, test, jajajsje, bubu, bebe, bebê, fsdf, asdasd, 77777, audit, and other known generic/banned strings
  const BANNED_NAME_SUBSTRINGS = [
    'teste', 'test', 'jajajsje', 'bubu', 'bebe', 'bebê', 'fsdf', 'asdasd', '77777', 'audit',
    'shitley', 'pilonha', 'provisorio', 'asdf', 'qwerty', '12345', 'nenhum', 'vazio',
    'null', 'undefined', 'joaquina princesa', 'testeeeee', 'lixo', 'regress'
  ];
  if (name) {
    if (BANNED_NAME_SUBSTRINGS.some(sub => name.includes(sub))) {
      return true;
    }

    // 6. Clearly invalid or repetitive names
    if (name.length < 3) return true;
    // Purely numeric:
    if (/^\d+$/.test(name.replace(/\s/g, ''))) return true;
    // Repeating characters: 4 or more consecutive identical characters (e.g., testeeeee, aaaa)
    if (/([a-z0-9])\1{3,}/i.test(name)) return true;
  }

  return false;
}
