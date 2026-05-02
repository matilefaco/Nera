export interface ThemeColors {
  primary: string;
  accent: string;
  accentRGB: string;
  background: string;
  border: string;
  text: string;
  light: string;
  name: string;
}

export const THEMES: Record<string, ThemeColors> = {
  terracotta: {
    name: "Terracotta (Padrão)",
    primary: "#8A7060",
    accent: "#B45228",
    accentRGB: "180, 82, 40",
    background: "#F8F5F2",
    border: "#E8E2DD",
    text: "#1A1A1A",
    light: "#FAF9F8"
  },
  rose: {
    name: "Rose Quartz",
    primary: "#A67B7B",
    accent: "#D48B8B",
    accentRGB: "212, 139, 139",
    background: "#FBF7F7",
    border: "#EADADA",
    text: "#2D1D1D",
    light: "#FEFBFB"
  },
  sage: {
    name: "Sage Green",
    primary: "#6B7A6B",
    accent: "#8B9D8B",
    accentRGB: "139, 157, 139",
    background: "#F7F8F7",
    border: "#DAE0DA",
    text: "#1D231D",
    light: "#FBFBFB"
  },
  navy: {
    name: "Midnight Navy",
    primary: "#1B2B3A",
    accent: "#3D5A73",
    accentRGB: "61, 90, 115",
    background: "#F2F5F8",
    border: "#DDE4EC",
    text: "#0D151D",
    light: "#F9FAFB"
  },
  plum: {
    name: "Rich Plum",
    primary: "#4A3B4A",
    accent: "#725A72",
    accentRGB: "114, 90, 114",
    background: "#F8F5F8",
    border: "#ECDDEC",
    text: "#1D151D",
    light: "#FBF9FB"
  }
};

export type ThemeVariant = keyof typeof THEMES;

export const getTheme = (variant?: string): ThemeColors => {
  return THEMES[variant as ThemeVariant] || THEMES.terracotta;
};
