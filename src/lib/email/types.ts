export const componentTypes = [
  "section", "column", "group", "text", "heading", "image", "button",
  "divider", "spacer", "social", "hero", "quote", "product", "article",
  "header", "footer", "html", "conditional",
] as const;

export type ComponentType = (typeof componentTypes)[number];

export interface EmailMetadata {
  name?: string;
  subject?: string;
  previewText?: string;
  language?: string;
}

export interface EmailSettings {
  width: number;
  backgroundColor: string;
  contentBackgroundColor: string;
}

export interface EmailStyles {
  body?: Record<string, string>;
  headings?: Record<string, string>;
  links?: Record<string, string>;
  buttons?: Record<string, string>;
}

export interface ComponentMetadata {
  sourceBlockId?: string;
  sourceBlockVersion?: number;
}

export interface EmailComponent {
  id: string;
  type: ComponentType;
  props?: Record<string, unknown>;
  styles?: Record<string, string>;
  classes?: string[];
  meta?: ComponentMetadata;
  children?: EmailComponent[];
}

export interface EmailDocument {
  version: number;
  type: "email";
  metadata: EmailMetadata;
  settings: EmailSettings;
  styles: EmailStyles;
  children: EmailComponent[];
  customCss?: string;
}

export const defaultEmailDocument = (): EmailDocument => ({
  version: 1,
  type: "email",
  metadata: {
    name: "Untitled Email",
    subject: "",
    previewText: "",
    language: "en",
  },
  settings: {
    width: 600,
    backgroundColor: "#f5f5f5",
    contentBackgroundColor: "#ffffff",
  },
  styles: {
    body: { fontFamily: "Arial, Helvetica, sans-serif", color: "#18181b", fontSize: "16px" },
    headings: { color: "#18181b" },
    links: { color: "#2563eb" },
    buttons: { backgroundColor: "#18181b", color: "#ffffff" },
  },
  children: [],
});
