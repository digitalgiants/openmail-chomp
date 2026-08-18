import type { DeliveryProvider } from "./types";
export function getDeliveryProvider(): DeliveryProvider { throw new Error("Delivery provider not configured. Implement Resend/SMTP/SES adapters."); }
