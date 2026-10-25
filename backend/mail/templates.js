// Plain inline-styled HTML (email clients ignore most CSS) plus a plain-text
// twin of every message. Everything user-supplied goes through esc().

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const money = (n) => 'N$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dateLong = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Windhoek' });

const companyName = () => process.env.COMPANY_NAME || 'Tjiunotjina Mureti Tech';

function layout(inner) {
  return `<div style="background:#EFE9DA;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#26281F">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden">
<div style="background:#3F5232;color:#ffffff;padding:18px 24px;font-size:20px;font-weight:bold">Orutumbo</div>
<div style="padding:24px;font-size:15px;line-height:1.55">${inner}</div>
<div style="padding:14px 24px;background:#F8F5EC;font-size:12px;color:#5B5744">&copy; ${new Date().getFullYear()} ${esc(companyName())}. All rights reserved.</div>
</div></div>`;
}

const button = (href, label) =>
  `<p><a href="${esc(href)}" style="display:inline-block;background:#3F5232;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">${esc(label)}</a></p>`;

const row = (label, value) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#5B5744">${esc(label)}</td><td style="padding:6px 0;font-weight:bold">${esc(value)}</td></tr>`;

export function welcomeEmail({ ownerName, farmName, customerNumber, trialEnd, appUrl, supportEmail }) {
  const subject = `Welcome to Orutumbo. Your customer number is ${customerNumber}`;
  const html = layout(`
<p>Hi ${esc(ownerName)},</p>
<p>Welcome to Orutumbo. <strong>${esc(farmName)}</strong> is set up, and your 30-day Standard trial runs until <strong>${esc(dateLong(trialEnd))}</strong>. No payment is needed during the trial.</p>
<div style="border:2px dashed #8F4F2B;border-radius:8px;padding:14px;text-align:center;margin:18px 0">
<div style="font-size:12px;color:#5B5744">Your customer number</div>
<div style="font:bold 26px 'Courier New',monospace;letter-spacing:1px">${esc(customerNumber)}</div>
</div>
<p>Please quote this number whenever you contact us or make a payment.</p>
${appUrl ? button(appUrl, 'Open Orutumbo') : ''}
<p>Your client area is inside the app: tap the billing card on the Home screen to see your plan, invoices and payments.</p>
${supportEmail ? `<p>Questions? Reply to this email or write to ${esc(supportEmail)}.</p>` : '<p>Questions? Just reply to this email.</p>'}`);
  const text = `Hi ${ownerName},

Welcome to Orutumbo. ${farmName} is set up, and your 30-day Standard trial runs until ${dateLong(trialEnd)}. No payment is needed during the trial.

Your customer number: ${customerNumber}
Please quote it whenever you contact us or make a payment.

${appUrl ? `Open Orutumbo: ${appUrl}\n` : ''}Your client area is inside the app: tap the billing card on the Home screen to see your plan, invoices and payments.
${supportEmail ? `\nQuestions? Reply to this email or write to ${supportEmail}.` : ''}`;
  return { subject, html, text };
}

export function invoiceEmail({ invoice, appUrl, eftDetails }) {
  const b = invoice.bill_to || {};
  const subject = `Invoice ${invoice.invoice_number} from Orutumbo (${money(invoice.amount)})`;
  const payHtml = eftDetails
    ? `<div style="background:#F8F5EC;border-radius:8px;padding:12px 14px;white-space:pre-wrap;margin:8px 0">${esc(eftDetails)}</div>`
    : '<p>Reply to this email and we will send you our banking details.</p>';
  const html = layout(`
<p>Hi ${esc(b.ownerName)},</p>
<p>Here is your invoice for <strong>${esc(invoice.description)}</strong>.</p>
<table style="border-collapse:collapse;margin:8px 0">
${row('Invoice', invoice.invoice_number)}${row('Customer number', invoice.customer_number)}${row('Amount due', money(invoice.amount))}${row('Due by', dateLong(invoice.due_at))}
</table>
<p><strong>How to pay</strong><br>Pay by EFT and use <strong>${esc(invoice.invoice_number)}</strong> as your payment reference.</p>
${payHtml}
<p>Your subscription is activated as soon as we confirm the payment, and you will get a receipt by email.</p>
${appUrl ? button(appUrl, 'View in your client area') : ''}`);
  const text = `Hi ${b.ownerName},

Here is your invoice for ${invoice.description}.

Invoice: ${invoice.invoice_number}
Customer number: ${invoice.customer_number}
Amount due: ${money(invoice.amount)}
Due by: ${dateLong(invoice.due_at)}

How to pay: pay by EFT and use ${invoice.invoice_number} as your payment reference.
${eftDetails ? `\n${eftDetails}\n` : '\nReply to this email and we will send you our banking details.\n'}
Your subscription is activated as soon as we confirm the payment, and you will get a receipt by email.
${appUrl ? `\nClient area: ${appUrl}` : ''}`;
  return { subject, html, text };
}

export function receiptEmail({ invoice, payment, planName, periodEnd, appUrl }) {
  const b = invoice.bill_to || {};
  const subject = `Payment received for ${invoice.invoice_number}. Thank you`;
  const html = layout(`
<p>Hi ${esc(b.ownerName)},</p>
<p>We received your payment. Thank you.</p>
<table style="border-collapse:collapse;margin:8px 0">
${row('Invoice', invoice.invoice_number)}${row('Customer number', invoice.customer_number)}${row('Amount received', money(payment.amount))}${row('Received on', dateLong(payment.received_at))}
</table>
${periodEnd ? `<p>Your <strong>${esc(planName)}</strong> plan is active until <strong>${esc(dateLong(periodEnd))}</strong>.</p>` : ''}
${appUrl ? button(appUrl, 'Open Orutumbo') : ''}`);
  const text = `Hi ${b.ownerName},

We received your payment. Thank you.

Invoice: ${invoice.invoice_number}
Customer number: ${invoice.customer_number}
Amount received: ${money(payment.amount)}
Received on: ${dateLong(payment.received_at)}
${periodEnd ? `\nYour ${planName} plan is active until ${dateLong(periodEnd)}.` : ''}
${appUrl ? `\nOpen Orutumbo: ${appUrl}` : ''}`;
  return { subject, html, text };
}
