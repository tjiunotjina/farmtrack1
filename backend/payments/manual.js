// No real gateway is wired in yet (Paystack/Flutterwave/PayFast are the
// realistic options for Namibia — Stripe doesn't pay out there — but which
// one wasn't decided as of writing this). This adapter fills that gap
// honestly: instead of a hosted checkout, it tells the farm owner to pay
// by EFT/bank transfer and wait for confirmation, which is how many small
// Namibian businesses already operate. It implements the exact same
// PaymentProvider shape a real gateway would, so swapping it out later is
// a matter of writing one new adapter file, not touching billing logic.

export async function createCheckout({ plan, billingCycle }) {
  const price = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
  return {
    checkoutUrl: null,
    instructions:
      `To activate the ${plan.name} plan (N$${price}/${billingCycle === 'annual' ? 'year' : 'month'}), ` +
      `make payment via EFT and contact us with proof of payment. Your subscription will be activated ` +
      `manually once payment is confirmed — this is temporary until a real payment gateway is connected.`,
  };
}

// The manual provider has no real webhooks — nothing external ever calls
// in, so any request claiming to be a manual-provider webhook is rejected.
export function verifyWebhookSignature() {
  return false;
}

export function parseWebhookEvent() {
  throw new Error('The manual payment provider does not receive webhooks.');
}
