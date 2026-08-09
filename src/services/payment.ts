import 'server-only'

// Payment boundary. Klarna slots in here later as a second implementation —
// checkout code never imports a provider directly, only this interface.

export type PaymentIntent = {
  reference: string
  status: 'authorized' | 'captured' | 'failed'
  amountCents: number
}

export interface PaymentProvider {
  readonly id: string
  createPayment(input: { amountCents: number; orderNumber: string; email: string }): Promise<PaymentIntent>
  capturePayment(reference: string): Promise<PaymentIntent>
  refundPayment(reference: string, amountCents: number): Promise<PaymentIntent>
}

/** Development provider: records the intent, moves no money. */
const devProvider: PaymentProvider = {
  id: 'dev',
  async createPayment({ amountCents, orderNumber }) {
    return { reference: `dev_${orderNumber}`, status: 'authorized', amountCents }
  },
  async capturePayment(reference) {
    return { reference, status: 'captured', amountCents: 0 }
  },
  async refundPayment(reference, amountCents) {
    return { reference, status: 'captured', amountCents: -amountCents }
  },
}

export function getPaymentProvider(): PaymentProvider {
  // ponytail: single provider, so no registry. Add a switch on an env var when
  // Klarna lands alongside dev.
  return devProvider
}
