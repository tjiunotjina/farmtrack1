/**
 * Every payment provider adapter must implement this shape. Nothing in
 * billing.js or routes/billing.js imports a specific provider's SDK
 * directly — they only ever call through this interface, resolved by the
 * subscription's `provider` column (see index.js). That's what makes it
 * possible to add Paystack/Flutterwave/PayFast/Stripe later, or run
 * several at once, without rewriting the subscription model, trial logic,
 * or entitlement checks — only a new file in this folder plus one line in
 * the registry below.
 *
 * @typedef {Object} PaymentProvider
 * @property {(args: {farm, plan, billingCycle, subscriptionId}) => Promise<{checkoutUrl: string}>} createCheckout
 *   Starts a payment for the given plan/cycle. Returns a URL to send the
 *   farm owner to (a hosted checkout page). For providers that don't need
 *   a redirect flow, this can return a URL to your own confirmation page.
 * @property {(req) => boolean} verifyWebhookSignature
 *   Given the raw Express request, returns whether the webhook is
 *   authentically from this provider (signature/HMAC check). Must return
 *   false — never throw — on anything suspicious.
 * @property {(req) => {type: string, providerSubscriptionId: string, providerCustomerId?: string}} parseWebhookEvent
 *   Normalizes a verified webhook into a small set of event types the
 *   billing route understands: 'payment_succeeded', 'payment_failed',
 *   'subscription_cancelled'.
 */

export const WEBHOOK_EVENT_TYPES = ['payment_succeeded', 'payment_failed', 'subscription_cancelled'];
