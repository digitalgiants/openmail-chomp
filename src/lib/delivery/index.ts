import type { DeliveryProvider } from "./types";
import { ResendDeliveryProvider } from "./resend";

let provider: DeliveryProvider | undefined;
export function getDeliveryProvider(): DeliveryProvider {
  if (!provider) {
    if (process.env.DELIVERY_PROVIDER !== "resend") throw new Error("Delivery provider not configured. Set DELIVERY_PROVIDER=resend and RESEND_API_KEY.");
    provider = new ResendDeliveryProvider();
  }
  return provider;
}
