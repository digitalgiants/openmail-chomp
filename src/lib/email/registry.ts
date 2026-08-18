import type { ComponentType, EmailComponent } from "./types";

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  description: string;
  icon: string;
  defaultProps?: Record<string, unknown>;
  canHaveChildren: boolean;
  create: (id: string) => EmailComponent;
}

const make = (type: ComponentType, label: string, description: string, icon: string, canHaveChildren = false, props: Record<string, unknown> = {}): ComponentDefinition => ({
  type, label, description, icon, canHaveChildren, defaultProps: props,
  create: (id) => ({ id, type, props: { ...props }, children: canHaveChildren ? [] : undefined }),
});

export const componentRegistry: Record<ComponentType, ComponentDefinition> = {
  section: make("section", "Section", "Full-width email section", "▤", true, { backgroundColor: "#ffffff", paddingTop: "24px", paddingBottom: "24px" }),
  column: make("column", "Column", "Responsive content column", "▥", true),
  group: make("group", "Group", "Group related content", "▦", true),
  text: make("text", "Text", "Paragraph text", "T", false, { content: "Start writing your email…" }),
  heading: make("heading", "Heading", "Large headline", "H", false, { content: "Your headline" }),
  image: make("image", "Image", "Image from your asset library", "▧", false, { assetId: null, assetUrl: null, alt: "" }),
  button: make("button", "Button", "Call-to-action button", "▣", false, { text: "Learn More", linkId: null }),
  divider: make("divider", "Divider", "Horizontal divider", "—"),
  spacer: make("spacer", "Spacer", "Vertical spacing", "↕", false, { height: "24px" }),
  social: make("social", "Social", "Social media links", "◎"),
  hero: make("hero", "Hero", "Hero image and headline", "✦", true),
  quote: make("quote", "Quote", "Quote block", "❝", false, { content: "A memorable quote goes here." }),
  product: make("product", "Product", "Product card", "◇", true),
  article: make("article", "Article", "Article preview", "▥", true),
  header: make("header", "Header", "Reusable email header", "⌂", true),
  footer: make("footer", "Footer", "Unsubscribe and footer content", "⌄", true),
  html: make("html", "Custom HTML", "HTML/CSS escape hatch", "<> ", false, { html: "" }),
  conditional: make("conditional", "Conditional", "Conditionally display content", "?", true),
};

export const builderComponents = [
  componentRegistry.section,
  componentRegistry.text,
  componentRegistry.heading,
  componentRegistry.image,
  componentRegistry.button,
  componentRegistry.divider,
  componentRegistry.spacer,
  componentRegistry.html,
];
