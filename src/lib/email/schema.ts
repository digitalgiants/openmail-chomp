import { z } from "zod";
import { componentTypes } from "./types";

const componentSchema: z.ZodTypeAny = z.lazy(() => z.object({
  id: z.string().min(1),
  type: z.enum(componentTypes),
  props: z.record(z.string(), z.unknown()).optional(),
  styles: z.record(z.string(), z.string()).optional(),
  classes: z.array(z.string()).optional(),
  meta: z.object({ sourceBlockId: z.string().optional(), sourceBlockVersion: z.number().int().positive().optional() }).optional(),
  children: z.array(componentSchema).optional(),
}));

export const emailDocumentSchema = z.object({
  version: z.number().int().positive(),
  type: z.literal("email"),
  metadata: z.object({
    name: z.string().optional(),
    subject: z.string().optional(),
    previewText: z.string().optional(),
    language: z.string().optional(),
  }),
  settings: z.object({
    width: z.number().int().min(320).max(1200),
    backgroundColor: z.string(),
    contentBackgroundColor: z.string(),
  }),
  styles: z.object({
    body: z.record(z.string(), z.string()).optional(),
    headings: z.record(z.string(), z.string()).optional(),
    links: z.record(z.string(), z.string()).optional(),
    buttons: z.record(z.string(), z.string()).optional(),
  }),
  children: z.array(componentSchema),
  customCss: z.string().optional(),
});

export type ValidatedEmailDocument = z.infer<typeof emailDocumentSchema>;
