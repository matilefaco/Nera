import { marketingSections } from './marketingSections';

export const getMarketingSectionSelector = (sectionId: string): string | undefined => {
  return marketingSections.find((s) => s.id === sectionId)?.selector;
};

export const getMarketingSections = () => {
  return marketingSections;
};

export const isValidMarketingSection = (sectionId: string): boolean => {
  return marketingSections.some((s) => s.id === sectionId);
};
