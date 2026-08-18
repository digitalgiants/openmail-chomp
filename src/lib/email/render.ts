import mjml2html from "mjml";
import type { EmailComponent, EmailDocument } from "./types";
import { groupColumnsIntoRows } from "./layout";

const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// mj-text/mj-button don't accept a generic `style` attribute -- MJML
// rejects it outright (confirmed against the real mjml2html output, not
// assumed), so styles picked in the Inspector have to be translated into
// each component's own first-class attributes instead of dumped into one
// inline style string.
const STYLE_ATTR_MAP: Record<string, string> = { fontFamily: "font-family", fontSize: "font-size", fontWeight: "font-weight", color: "color", textDecoration: "text-decoration" };

function styleAttrs(node: EmailComponent, defaults: Record<string, string> = {}): string {
  const merged = { ...defaults, ...(node.styles ?? {}) };
  return Object.entries(merged).map(([k, v]) => {
    const attr = STYLE_ATTR_MAP[k];
    return attr && v ? ` ${attr}="${esc(v)}"` : "";
  }).join("");
}

// The recipient token is a placeholder, not filled in here — the base
// document only ever gets compiled once per campaign (compiling MJML per
// recipient would be far more expensive than a cheap string swap), and
// campaign-store.ts substitutes the real campaignRecipients row id into
// every tracked link afterward, once per recipient.
export const RECIPIENT_TOKEN = "{{RID}}";

// trackingBase, when given, rewrites any button/image href that has a
// linkId (i.e. was set via LinkPicker, not typed in free-hand) to a click
// tracking redirect instead of the real destination. Left undefined for
// the builder's live preview and the plain /api/render endpoint, which
// should show/link to the real destination while editing.
function componentToMjml(node: EmailComponent, trackingBase?: string): string {
  const p = node.props ?? {};
  const children = (node.children ?? []).map(child => componentToMjml(child, trackingBase)).join("");
  const trackedHref = (): string | undefined => {
    if (!p.href) return undefined;
    if (trackingBase && p.linkId) return `${trackingBase}/${RECIPIENT_TOKEN}/${esc(p.linkId)}`;
    return String(p.href);
  };
  switch (node.type) {
    case "section": {
      const bg = p.backgroundColor ? ` background-color="${esc(p.backgroundColor)}"` : "";
      const rows = groupColumnsIntoRows(node.children ?? []);
      if (rows.length <= 1) {
        const padTop = p.paddingTop ? ` padding-top="${esc(p.paddingTop)}"` : "";
        const padBottom = p.paddingBottom ? ` padding-bottom="${esc(p.paddingBottom)}"` : "";
        return `<mj-section${bg}${padTop}${padBottom}>${children}</mj-section>`;
      }
      // mj-wrapper can't nest inside the document's own outer mj-wrapper
      // (MJML rejects it outright), so multiple rows can't share one
      // wrapper element. Instead every row gets its own mj-section with
      // the same background color — edge to edge, no gap between them —
      // so they read as one seamless block. Vertical padding only goes on
      // the first/last row so it doesn't open a visible gap in the middle.
      const rowsHtml = rows.map((row, i) => {
        const padTop = i === 0 && p.paddingTop ? ` padding-top="${esc(p.paddingTop)}"` : "";
        const padBottom = i === rows.length - 1 && p.paddingBottom ? ` padding-bottom="${esc(p.paddingBottom)}"` : "";
        return `<mj-section${bg}${padTop}${padBottom}>${row.map(child => componentToMjml(child, trackingBase)).join("")}</mj-section>`;
      }).join("");
      return rowsHtml;
    }
    case "column": return `<mj-column${p.width ? ` width="${esc(p.width)}"` : ""}>${children}</mj-column>`;
    case "group": return `<mj-group>${children}</mj-group>`;
    case "text": return `<mj-text${styleAttrs(node)}>${String(p.content ?? "")}</mj-text>`;
    case "heading": return `<mj-text${styleAttrs(node, { fontSize: "28px", fontWeight: "700" })}>${String(p.content ?? "Your headline")}</mj-text>`;
    case "image": {
      const src = p.assetUrl ?? p.src;
      if (!src) return `<mj-text color="#71717a" align="center">[ Image ]</mj-text>`;
      const href = trackedHref();
      return `<mj-image src="${esc(src)}" alt="${esc(p.alt)}"${href ? ` href="${esc(href)}"` : ""} />`;
    }
    case "button": return `<mj-button href="${esc(trackedHref() ?? "#")}"${styleAttrs(node)}>${esc(p.text ?? "Learn More")}</mj-button>`;
    case "divider": return `<mj-divider />`;
    case "spacer": return `<mj-spacer height="${esc(p.height ?? "24px")}" />`;
    case "html": return String(p.html ?? "");
    case "footer": return `<mj-section><mj-column><mj-text align="center" font-size="12px" color="#71717a">${children || "You are receiving this email because you subscribed."}</mj-text></mj-column></mj-section>`;
    default: return children;
  }
}

export function documentToMjml(document: EmailDocument, trackingBase?: string) {
  const width = document.settings.width;
  // width belongs on mj-body, not mj-wrapper (mj-wrapper doesn't accept
  // it -- MJML rejects it even under soft validation; it just also
  // doesn't refuse to render, so this went unnoticed).
  return `<mjml><mj-head><mj-attributes><mj-all font-family="Arial, Helvetica, sans-serif" /></mj-attributes>${document.customCss ? `<mj-style>${document.customCss}</mj-style>` : ""}</mj-head><mj-body background-color="${esc(document.settings.backgroundColor)}" width="${width}px"><mj-wrapper background-color="${esc(document.settings.contentBackgroundColor)}">${document.children.map(child => componentToMjml(child, trackingBase)).join("")}</mj-wrapper></mj-body></mjml>`;
}

export async function renderDocument(document: EmailDocument, options?: { trackingBase?: string }) {
  const result = await mjml2html(documentToMjml(document, options?.trackingBase), { validationLevel: "soft" });
  return { html: result.html, errors: result.errors };
}
