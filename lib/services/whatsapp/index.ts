/** Stretch: Twilio WhatsApp mirror. Mock only logs. */
export interface WhatsAppService {
  send(args: { to: string; body: string }): Promise<void>;
}

export const mockWhatsApp: WhatsAppService = {
  async send({ to, body }) {
    console.info(`[whatsapp:mock] → ${to}: ${body}`);
  },
};

export function getWhatsApp(): WhatsAppService {
  return mockWhatsApp;
}
