# Customer numbers, email, client area and accounting

## What you get

- **Customer numbers.** Every farm gets a permanent number like `ORU-000042` at
  signup. Numbers come from a database sequence, so two signups at the same
  moment can never share one. Farms that signed up before this existed are
  numbered the next time the server starts, oldest first.
- **Emails.** A welcome email with the customer number at signup, an invoice
  email when an invoice is created, and a receipt when you record a payment.
  Every email is logged (admin page, Emails tab) with its outcome. A mail
  problem never blocks a signup or a payment.
- **Client area.** Inside the app, tap the billing card on Home. Customers see
  their customer number, plan, amount due with bank details and reference,
  every invoice (printable, "save as PDF" from the print dialog) and every
  payment. It needs a connection; billing is not kept offline.
- **Accounting.** Invoices, payments and a revenue summary, run from the admin
  page at `/admin/` on your website.

## How money flows

1. A customer picks a paid plan in the app. An **invoice** is created
   (`INV-000123`), emailed, and shown in the client area. Their current plan,
   including a running trial, is **not touched** yet.
2. They pay by EFT using the invoice number as the reference.
3. You see the money arrive, open the admin page, find the invoice and click
   **Record payment**. The plan activates, the invoice is marked paid, and a
   receipt is emailed.
4. When the paid period ends the farm becomes **past due** (keeps its plan, the
   app shows "payment overdue"). After **7 days** it drops to the Free plan.
   Nothing is deleted. Paying again restores it. Change `GRACE_DAYS` in
   `backend/billing.js` to alter the 7.

Details: paying the same plan before it ends adds the new period onto the end
of the current one, so paying early never loses days. Choosing a different plan
voids the customer's earlier unpaid invoice. Pressing the same plan twice
returns the same invoice. Admin-created invoices are never voided by a
customer's clicks.

## Settings (Render: your backend Web Service, then Environment)

| Variable | What it does |
|---|---|
| `ADMIN_SECRET` | Signs you in to the admin page. Use 20+ random characters. |
| `EFT_DETAILS` | Your bank details, printed on invoices. Without it, invoices tell the customer to reply for them. |
| `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_VAT_NUMBER`, `SUPPORT_EMAIL` | Printed on invoices and in the client area. All optional. |
| `APP_URL` | Your app's address, for links in emails. |
| `MAIL_PROVIDER` | `log` (default), `brevo` or `resend`. |
| `MAIL_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO` | Your email provider's key and the sender details. |

Redeploy after changing them. New tables are created automatically on startup.

## Turning on real email

Until you set `MAIL_PROVIDER`, emails are only **logged**, not sent. The website
already tells new customers that a welcome email is on its way, so do this
before you launch.

Render's free tier blocks all outbound SMTP (ports 25, 465 and 587), so a normal
mail-server setup would silently fail there. This code sends through a provider's
HTTPS API instead, which is never blocked.

1. Create an account with Brevo or Resend. Both have free tiers; check their
   current limits and rules before you rely on them.
2. Verify your sender: a domain you own (best, and needed by Resend to email other
   people), or a single sender address where the provider allows it.
3. Create an API key.
4. Set `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM_EMAIL` (the verified address)
   and `MAIL_FROM_NAME`. Redeploy.
5. Sign up on your site with your own email. Check the inbox, and the admin
   page's **Emails** tab: it shows `sent`, or `failed` with the provider's error.

Mail sent from a free address like Gmail through these services often lands in
spam. A domain with SPF and DKIM set up is much more reliable.

## The admin page

Open `/admin/` on your website (for example `https://your-site/admin/`),
enter `ADMIN_SECRET`. Summary tiles, then Customers, Invoices, Payments and
Emails. You can create an invoice for any customer (a plan, or a custom amount
for something like an Enterprise arrangement), record a payment, or void an
invoice.

It is one shared secret, kept only in the browser tab until you sign out, and
wrong guesses are rate limited (10 per 15 minutes per address). That is fine
while you are the only operator. Move to real admin accounts before anyone else
needs access. The page is not linked from anywhere and asks search engines not
to index it.

## Decisions that are yours

- **VAT.** Prices are treated as final amounts and invoices have no tax lines.
  If you are VAT-registered, put your number in `COMPANY_VAT_NUMBER` and get
  advice on how to show VAT before you invoice real customers.
- **Partial payments.** A payment must equal the invoice total. A different
  amount is rejected. Record exact payments, or void and re-issue.
- **No refunds or credit notes yet.** Void an unpaid invoice; there is nothing
  for a paid one.
- **No automatic renewals or reminders.** There is no scheduled job. A
  customer renews by choosing their plan again, which creates the next invoice.
  Reminder emails and automatic renewal invoices are the natural next step.
- **Old `mark-paid` endpoint.** `POST /api/billing/admin/mark-paid` still
  exists from the earlier version. It activates a plan with no invoice or
  payment record, so it leaves a hole in your books. Use the admin page instead;
  it can be removed.
- **Netlify copy.** These features live in `backend/`. The `netlify/functions`
  copy of the API does not have them.

## Tests

```bash
cd backend
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/orutumbo_test npm test
```

Use a throwaway database: the tests create their own farms and never delete.
Without `TEST_DATABASE_URL` only the email tests run.
