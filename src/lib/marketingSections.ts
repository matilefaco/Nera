export interface MarketingSection {
  id: string;
  label: string;
  selector: string;
}

export const marketingSections: MarketingSection[] = [
  { id: "hero", label: "Hero", selector: '[data-marketing-section="hero"]' },
  { id: "services", label: "Services", selector: '[data-marketing-section="services"]' },
  { id: "about", label: "About", selector: '[data-marketing-section="about"]' },
  { id: "gallery", label: "Gallery", selector: '[data-marketing-section="gallery"]' },
  { id: "reviews", label: "Reviews", selector: '[data-marketing-section="reviews"]' },
  { id: "payments", label: "Payments", selector: '[data-marketing-section="payments"]' },
  { id: "agenda", label: "Agenda", selector: '[data-marketing-section="agenda"]' },
  { id: "confidence", label: "Confidence", selector: '[data-marketing-section="confidence"]' },
  { id: "finalCta", label: "Final CTA", selector: '[data-marketing-section="finalCta"]' },
  { id: "footer", label: "Footer", selector: '[data-marketing-section="footer"]' },
  { id: "fullPage", label: "Full Page", selector: 'body' },
];
