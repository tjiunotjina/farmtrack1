// Builds a standalone, printable invoice page. Pure string-in, string-out so
// it can be tested without a browser. Everything that came from a customer or
// from the environment is HTML-escaped.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const money = (n) => 'N$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Windhoek' });

export function invoiceHtml(invoice, company = {}) {
  const b = invoice.bill_to || {};
  const status = invoice.status === 'paid' ? 'PAID' : invoice.status === 'void' ? 'VOID' : 'UNPAID';
  const payBlock = invoice.status === 'open'
    ? `<h3>How to pay</h3>
       <p>Pay by EFT and use <strong>${esc(invoice.invoice_number)}</strong> as your payment reference.</p>
       ${company.eftDetails ? `<pre>${esc(company.eftDetails)}</pre>` : '<p>Contact us for our banking details.</p>'}
       <p>Your subscription is activated once we confirm the payment.</p>`
    : invoice.status === 'paid'
      ? `<p>Paid on ${esc(date(invoice.paid_at))}. Thank you.</p>`
      : `<p>This invoice was cancelled${invoice.void_reason ? `: ${esc(invoice.void_reason)}` : ''}.</p>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(invoice.invoice_number)}</title>
<style>
body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#26281F;max-width:720px;margin:32px auto;padding:0 20px}
h1{font-size:26px;margin:0 0 4px}h3{margin:24px 0 6px;font-size:15px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:3px solid #3F5232;padding-bottom:14px}
.status{font-weight:bold;border:2px solid #3F5232;color:#3F5232;border-radius:6px;padding:4px 10px}
.status.UNPAID{border-color:#9C3B2E;color:#9C3B2E}.status.VOID{border-color:#8A8570;color:#8A8570}
.cols{display:flex;gap:40px;margin:20px 0;flex-wrap:wrap}.cols div{min-width:200px}
.label{font-size:12px;color:#5B5744}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{text-align:left;padding:8px 0;border-bottom:1px solid #D3CAB1}
th:last-child,td:last-child{text-align:right}.total td{font-weight:bold;font-size:16px;border-bottom:0}
pre{background:#F8F5EC;border-radius:6px;padding:10px 12px;white-space:pre-wrap;font:inherit}
.foot{margin-top:36px;font-size:12px;color:#5B5744}
@media print{body{margin:0}}
</style></head><body>
<div class="top">
  <div><h1>Invoice</h1><div>${esc(invoice.invoice_number)}</div></div>
  <div style="text-align:right"><strong>${esc(company.name || 'Orutumbo')}</strong>
    ${company.address ? `<div style="white-space:pre-line">${esc(company.address)}</div>` : ''}
    ${company.vatNumber ? `<div>VAT no. ${esc(company.vatNumber)}</div>` : ''}
    ${company.supportEmail ? `<div>${esc(company.supportEmail)}</div>` : ''}
    <div class="status ${status}" style="display:inline-block;margin-top:8px">${status}</div></div>
</div>
<div class="cols">
  <div><div class="label">Billed to</div><strong>${esc(b.farmName)}</strong><br>${esc(b.ownerName)}<br>${esc(b.email)}${b.village ? `<br>${esc(b.village)}` : ''}</div>
  <div><div class="label">Customer number</div><strong>${esc(invoice.customer_number)}</strong>
    <div class="label" style="margin-top:8px">Issued</div>${esc(date(invoice.issued_at))}
    <div class="label" style="margin-top:8px">Due</div>${esc(date(invoice.due_at))}</div>
</div>
<table><tr><th>Description</th><th>Amount (${esc(invoice.currency || 'NAD')})</th></tr>
<tr><td>${esc(invoice.description)}</td><td>${esc(money(invoice.amount))}</td></tr>
<tr class="total"><td>Total</td><td>${esc(money(invoice.amount))}</td></tr></table>
${payBlock}
<div class="foot">&copy; ${new Date().getFullYear()} ${esc(company.name || 'Tjiunotjina Mureti Tech')}. All rights reserved.</div>
</body></html>`;
}

// Opens the invoice in a new tab and starts the print dialog, where "Save as
// PDF" is an option. Returns false if the browser blocked the new tab.
export function printInvoice(invoice, company) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(invoiceHtml(invoice, company));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
  return true;
}
