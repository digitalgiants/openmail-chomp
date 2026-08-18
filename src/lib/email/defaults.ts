import { defaultEmailDocument, type EmailDocument } from "./types";
import { componentRegistry } from "./registry";

export function starterEmailDocument(): EmailDocument {
  const doc = defaultEmailDocument();
  const section = componentRegistry.section.create("section_hero");
  section.children = [
    componentRegistry.heading.create("heading_1"),
    componentRegistry.text.create("text_1"),
    componentRegistry.button.create("button_1"),
  ];
  doc.children.push(section);
  return doc;
}
