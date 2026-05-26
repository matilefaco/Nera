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
  isTestAccount?: boolean;
}

/**
 * Checks if a profile matches any test, fake, QA, audit, or draft criteria.
 * Returns true if the profile is classified as non-public/test/fake.
 * This is used for Directory indexing or situations where we require explicit publication.
 */
export function isNonPublicProfile(userData: UserProfileData | null | undefined): boolean {
  if (!userData) return true;

  // 1. Minimum structural validation
  const slug = (userData.slug || "").toLowerCase().trim();
  const specialty = (userData.specialty || "").trim();
  
  if (!slug || slug.length < 3) return true;
  if (!specialty) return true;
  if (userData.onboardingCompleted !== true) return true;
  if (userData.indexable !== true) return true;

  // 2. Check for fake data
  return isFakeOrTestProfile(userData);
}

/**
 * Checks if a profile can be accessed via its direct public link (/p/:slug).
 * It enforces minimum quality and blocks fake accounts but does NOT require
 * indexable=true (which controls directory presence) or strict onboarding flag
 * (for legacy accounts that have valid names but lack the flag).
 */
export function isPublicProfileAccessibleByDirectLink(userData: UserProfileData | null | undefined): boolean {
  if (!userData) return false;

  const slug = (userData.slug || "").toLowerCase().trim();
  const specialty = (userData.specialty || "").trim();
  const name = (userData.displayName || userData.name || "").trim();
  
  if (!slug || slug.length < 3) return false;
  if (!specialty) return false;
  if (!name || name.length < 3) return false;

  // Enforce fake/test block
  if (isFakeOrTestProfile(userData)) return false;

  return true;
}

/**
 * Checks strictly if a profile contains fake, QA, or test data.
 * Does NOT check publication status (indexable, onboardingCompleted).
 */
export function isFakeOrTestProfile(userData: UserProfileData | null | undefined): boolean {
  if (!userData) return false;
  
  if (userData.isTestAccount === true) return true;

  const displayNameStr = userData.displayName || "";
  const nameStr = userData.name || "";
  const name = (displayNameStr || nameStr || "").toLowerCase().trim();
  const slug = (userData.slug || "").toLowerCase().trim();
  const email = (userData.email || "").toLowerCase().trim();

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
