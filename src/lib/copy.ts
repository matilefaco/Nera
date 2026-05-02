export const SERVICE_MODES = {
  studio: {
    label: "Só no estúdio",
    shortLabel: "Estúdio",
    description: "Clientes vão até você no seu espaço.",
    icon: "Building2"
  },
  home: {
    label: "Só em domicílio",
    shortLabel: "Domicílio",
    description: "Você vai até o endereço das suas clientes.",
    icon: "Home"
  },
  hybrid: {
    label: "Estúdio e domicílio",
    shortLabel: "Híbrido",
    description: "Você atende no seu espaço e também vai até as clientes.",
    icon: "MapPin"
  }
} as const;

export type ServiceModeKey = keyof typeof SERVICE_MODES;

export const getServiceModeLabel = (mode?: string) => {
  if (!mode) return "";
  return (SERVICE_MODES as any)[mode]?.label || mode;
};

export const getServiceModeShortLabel = (mode?: string) => {
  if (!mode) return "";
  return (SERVICE_MODES as any)[mode]?.shortLabel || mode;
};

export const getServiceModeDescription = (mode?: string) => {
  if (!mode) return "";
  return (SERVICE_MODES as any)[mode]?.description || "";
};

/**
 * Returns dynamic copywriting for the hero section based on the professional's specialty.
 */
export const getProfileHeroCopy = (specialty: string = "", id: string = "") => {
  const s = specialty.toLowerCase();
  
  if (s.includes('unha') || s.includes('manicure') || s.includes('pedicure') || s.includes('nail')) {
    return { main: "Transformando mãos em", accent: "arte" };
  }
  if (s.includes('sobrancelha') || s.includes('brow') || s.includes('olhar')) {
    return { main: "Design que valoriza o seu", accent: "olhar" };
  }
  if (s.includes('cílios') || s.includes('lash') || s.includes('extensão')) {
    return { main: "O segredo de um", accent: "olhar marcante" };
  }
  if (s.includes('cabelo') || s.includes('hair') || s.includes('penteado')) {
    return { main: "Expressando sua essência através dos", accent: "fios" };
  }
  if (s.includes('maquiagem') || s.includes('make') || s.includes('estética')) {
    return { main: "Sua beleza autêntica", accent: "realçada" };
  }
  
  return { main: "Especialista em", accent: specialty || "Beleza" };
};

/**
 * Categorizes a service name into one of the predefined categories.
 */
export const categorizeService = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('unha') || n.includes('pé') || n.includes('mão') || n.includes('esmalte') || n.includes('manicure') || n.includes('pedicure') || n.includes('gel') || n.includes('nail')) return 'Unhas';
  if (n.includes('sobrancelha') || n.includes('henna') || n.includes('brow') || n.includes('micro')) return 'Sobrancelhas';
  if (n.includes('cílio') || n.includes('lash') || n.includes('fio a fio')) return 'Cílios';
  if (n.includes('cabelo') || n.includes('corte') || n.includes('escova') || n.includes('mecha') || n.includes('color') || n.includes('hair')) return 'Cabelo';
  if (n.includes('limpeza') || n.includes('pele') || n.includes('facial') || n.includes('massagem') || n.includes('facial') || n.includes('corpo') || n.includes('estética')) return 'Estética';
  return 'Outros';
};
