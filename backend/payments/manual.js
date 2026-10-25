// No real gateway is wired in yet (Paystack/Flutterwave/PayFast are the
// realistic options for Namibia — Stripe doesn't pay out there — but which
// one wasn't decided as of writing this). This adapter fills that gap
// honestly: instead of a hosted checkout, it tells the farm owner to pay
// by EFT/bank transfer and wait for confirmation, which is how many small
// Namibian businesses already operate. It implements the exact same
// PaymentProvider shape a real gateway would, so swapping it out later is
// a matter of writing one new adapter file, not touching billing logic.

export async function createCheckout({ plan, billingCycle, invoice }) {
  const price = invoice ? invoice.amount : (billingCycle === 'annual' ? plan.annual_price : plan.monthly_price);
  const amount = `N$${Number(price).toFixed(2)}`;
  const eft = process.env.EFT_DETAILS ? `\n\n${process.env.EFT_DETAILS}` : '\n\nReply to the invoice email and we will send you our banking details.';
  const ref = invoice ? ` Use ${invoice.invoice_number} as your payment reference.` : '';
  return {
    checkoutUrl: null,
    instructions:
      `${invoice ? `Invoice ${invoice.invoice_number} for the ${plan.name} plan (${amount}) has been created and emailed to you. ` : ''}` +
      `Pay by EFT.${ref}${eft}\n\nYour subscription is activated once we confirm the payment.`,
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
