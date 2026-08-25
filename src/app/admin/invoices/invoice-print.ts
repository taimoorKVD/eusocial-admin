import { MasterInvoice } from '../../interfaces/master-billing';
import { displayMoney } from '../../shared/utils/money.util';

export function formatInvoiceDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatInvoiceStatus(status?: string | null): string {
  const raw = (status || '—').toString().trim().replace(/[_-]+/g, ' ');
  if (!raw || raw === '—') return '—';
  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function invoiceFileName(invoice: MasterInvoice): string {
  const number = (invoice.invoiceNumber || `invoice-${invoice.id}`).replace(/[^\w.-]+/g, '-');
  return `${number}.pdf`;
}

export function isPdfBlob(blob: Blob): boolean {
  const type = (blob.type || '').toLowerCase();
  return type.includes('pdf') || type === 'application/octet-stream';
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printSystemInvoice(invoice: MasterInvoice): void {
  const html = buildSystemInvoiceHtml(invoice);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => iframe.remove();
  frameWindow.addEventListener('afterprint', cleanup);
  setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 250);
  setTimeout(cleanup, 60_000);
}

export function buildSystemInvoiceHtml(invoice: MasterInvoice): string {
  const number = escapeHtml(invoice.invoiceNumber || `INV-${invoice.id}`);
  const org = escapeHtml(invoice.tenant?.name || '—');
  const domain = escapeHtml(invoice.tenant?.subdomain || '');
  const status = escapeHtml(formatInvoiceStatus(invoice.status));
  const amount = escapeHtml(displayMoney(invoice.formattedAmount, invoice.amount));
  const invoiceDate = escapeHtml(formatInvoiceDate(invoice.invoiceDate));
  const dueDate = escapeHtml(formatInvoiceDate(invoice.dueDate));
  const paidAt = escapeHtml(formatInvoiceDate(invoice.paidAt));
  const createdAt = escapeHtml(formatInvoiceDate(invoice.createdAt));
  const currency = escapeHtml((invoice.currency || 'USD').toUpperCase());

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${number}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
    .sheet { max-width: 800px; margin: 0 auto; }
    .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #ea580c; padding-bottom: 16px; }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #ea580c; }
    h1 { margin: 6px 0 0; font-size: 28px; }
    .meta { text-align: right; font-size: 14px; color: #475569; }
    .meta strong { display: block; color: #0f172a; font-size: 18px; margin-bottom: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 32px; margin: 28px 0; }
    .label { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
    .value { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 8px 0; }
    td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    td.amount, th.amount { text-align: right; }
    .total { display: flex; justify-content: flex-end; margin-top: 16px; }
    .total div { min-width: 220px; display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; }
    .note { margin-top: 36px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">Eusocial</div>
        <h1>Invoice</h1>
      </div>
      <div class="meta">
        <strong>${number}</strong>
        Status: ${status}
      </div>
    </div>
    <div class="grid">
      <div>
        <div class="label">Bill To</div>
        <div class="value">${org}${domain ? `<br/>${domain}` : ''}</div>
      </div>
      <div>
        <div class="label">Invoice Date</div>
        <div class="value">${invoiceDate}</div>
      </div>
      <div>
        <div class="label">Due Date</div>
        <div class="value">${dueDate}</div>
      </div>
      <div>
        <div class="label">Paid At</div>
        <div class="value">${paidAt}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Platform subscription${currency ? ` (${currency})` : ''}</td>
          <td class="amount">${amount}</td>
        </tr>
      </tbody>
    </table>
    <div class="total"><div><span>Total</span><span>${amount}</span></div></div>
    <p class="note">Generated by Eusocial on ${createdAt}. This is a system invoice, not a Stripe receipt.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
