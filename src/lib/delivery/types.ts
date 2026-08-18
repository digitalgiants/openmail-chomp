export type EmailMessage = { from: string; to: string[]; subject: string; html: string; replyTo?: string };
export type DeliveryResult = { id: string; provider: string };
export interface DeliveryProvider {
  send(message: EmailMessage): Promise<DeliveryResult>;
  // Sends multiple independent messages in as few round-trips as the
  // provider allows. Implementations should throw if the whole batch call
  // fails; callers are responsible for chunking to whatever limit the
  // provider imposes per call.
  sendBatch(messages: EmailMessage[]): Promise<DeliveryResult[]>;
}
