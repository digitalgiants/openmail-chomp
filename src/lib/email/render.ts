import mjml2html from "mjml";
import type { EmailComponent, EmailDocument } from "./types";

const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (styles?: Record<string, string>) => Object.entries(styles ?? {}).map(([k, v]) => `${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${v}`).join(";");

function componentToMjml(node: EmailComponent): string {
  const style = attrs(node.styles);
  const p = node.props ?? {};
  const children = (node.children ?? []).map(componentToMjml).join("");
  switch (node.type) {
    case "section": return `<mj-section${style ? ` css-class="vf-section"` : ""}>${children}</mj-section>`;
    case "column": return `<mj-column>${children}</mj-column>`;
    case "group": return `<mj-group>${children}</mj-group>`;
    case "text": return `<mj-text${style ? ` style="${esc(style)}"` : ""}>${String(p.content ?? "")}</mj-text>`;
    case "heading": return `<mj-text font-size="28px" font-weight="700"${style ? ` style="${esc(style)}"` : ""}>${String(p.content ?? "Your headline")}</mj-text>`;
    case "image": return p.assetUrl ? `<mj-image src="${esc(p.assetUrl)}" alt="${esc(p.alt)}"${p.href ? ` href="${esc(p.href)}"` : ""} />` : p.src ? `<mj-image src="${esc(p.src)}" alt="${esc(p.alt)}"${p.href ? ` href="${esc(p.href)}"` : ""} />` : `<mj-text color="#71717a" align="center">[ Image ]</mj-text>`;
    case "button": return `<mj-button href="${esc(p.href ?? "#")}">${esc(p.text ?? "Learn More")}</mj-button>`;
    case "divider": return `<mj-divider />`;
    case "spacer": return `<mj-spacer height="${esc(p.height ?? "24px")}" />`;
    case "html": return String(p.html ?? "");
    case "footer": return `<mj-section><mj-column><mj-text align="center" font-size="12px" color="#71717a">${children || "You are receiving this email because you subscribed."}</mj-text></mj-column></mj-section>`;
    default: return children;
  }
}

export function documentToMjml(document: EmailDocument) {
  const width = document.settings.width;
  return `<mjml><mj-head><mj-attributes><mj-all font-family="Arial, Helvetica, sans-serif" /></mj-attributes>${document.customCss ? `<mj-style>${document.customCss}</mj-style>` : ""}</mj-head><mj-body background-color="${esc(document.settings.backgroundColor)}"><mj-wrapper background-color="${esc(document.settings.contentBackgroundColor)}" width="${width}px">${document.children.map(componentToMjml).join("")}</mj-wrapper></mj-body></mjml>`;
}

export async function renderDocument(document: EmailDocument) {
  const result = await mjml2html(documentToMjml(document), { validationLevel: "soft" });
  return { html: result.html, errors: result.errors };
}
