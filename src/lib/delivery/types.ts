export type EmailMessage = { from: string; to: string[]; subject: string; html: string; replyTo?: string };
export type DeliveryResult = { id: string; provider: string };
export interface DeliveryProvider { send(message: EmailMessage): Promise<DeliveryResult>; }
