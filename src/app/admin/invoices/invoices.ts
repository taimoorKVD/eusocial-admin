import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { InvoiceStats, InvoiceStatus, MasterInvoice } from '../../interfaces/master-billing';
import { MasterInvoiceService } from '../../services/master-invoice.service';
import { environment } from '../../../environments/environment';
import { displayMoney } from '../../shared/utils/money.util';
import {
  downloadGeneratedInvoice,
  saveRemoteOrGeneratedInvoice,
} from './invoice-print';

@Component({
  selector: 'app-invoices',
  standalone: false,
  templateUrl: './invoices.html',
  styleUrl: './invoices.scss',
})
export class Invoices implements OnInit {
  loading = true;
  stats: InvoiceStats | null = null;
  invoices: MasterInvoice[] = [];
  page = 1;
  lastPage = 1;
  total = 0;
  limit = environment.limit || 15;

  search = '';
  status: InvoiceStatus | '' = '';
  from = '';
  to = '';
  openMenuId: number | null = null;

  readonly statusOptions: { value: InvoiceStatus | ''; label: string }[] = [
    { value: '', label: 'All Status' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'draft', label: 'Draft' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'failed', label: 'Failed' },
  ];

  constructor(
    private invoiceService: MasterInvoiceService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.bootstrap();
  }

  bootstrap(): void {
    this.loading = true;
    forkJoin({
      stats: this.invoiceService.getStats(),
      list: this.invoiceService.getInvoices({ page: this.page, limit: this.limit }),
    }).subscribe({
      next: ({ stats, list }) => {
        this.stats = stats.data;
        this.applyList(list);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.error?.message || 'Failed to load invoices');
      },
    });
  }

  loadList(page = 1): void {
    this.page = page;
    this.loading = true;
    this.invoiceService
      .getInvoices({
        page: this.page,
        limit: this.limit,
        tenant: this.search.trim() || undefined,
        status: this.status || undefined,
        from: this.from || undefined,
        to: this.to || undefined,
      })
      .subscribe({
        next: (res) => {
          this.applyList(res);
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.toastr.error(err?.error?.message || 'Failed to load invoices');
        },
      });
  }

  applyFilters(): void {
    this.loadList(1);
  }

  clearFilters(): void {
    this.search = '';
    this.status = '';
    this.from = '';
    this.to = '';
    this.loadList(1);
  }

  toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  closeMenus(): void {
    this.openMenuId = null;
  }

  viewInvoice(invoice: MasterInvoice): void {
    this.closeMenus();
    this.router.navigate(['/invoices', invoice.id, 'view']);
  }

  downloadInvoice(invoice: MasterInvoice): void {
    this.closeMenus();
    this.invoiceService.downloadPdf(invoice.id).subscribe({
      next: (blob) => saveRemoteOrGeneratedInvoice(blob, invoice),
      error: () => downloadGeneratedInvoice(invoice),
    });
  }

  canViewStripe(invoice: MasterInvoice): boolean {
    return !!(invoice.hostedInvoiceUrl || invoice.stripeInvoiceId);
  }

  canDownloadStripe(invoice: MasterInvoice): boolean {
    return !!(invoice.invoicePdfUrl || invoice.stripeInvoiceId);
  }

  viewStripeInvoice(invoice: MasterInvoice): void {
    this.closeMenus();
    if (invoice.hostedInvoiceUrl) {
      window.open(invoice.hostedInvoiceUrl, '_blank', 'noopener');
      return;
    }
    this.invoiceService.getInvoice(invoice.id).subscribe({
      next: (res) => {
        const url = res?.data?.hostedInvoiceUrl;
        if (url) window.open(url, '_blank', 'noopener');
        else this.toastr.error('Stripe invoice is not available');
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to open Stripe invoice'),
    });
  }

  downloadStripeInvoice(invoice: MasterInvoice): void {
    this.closeMenus();
    if (invoice.invoicePdfUrl) {
      window.open(invoice.invoicePdfUrl, '_blank', 'noopener');
      return;
    }
    this.invoiceService.getInvoice(invoice.id).subscribe({
      next: (res) => {
        const url = res?.data?.invoicePdfUrl;
        if (url) window.open(url, '_blank', 'noopener');
        else this.toastr.error('Stripe invoice PDF is not available');
      },
      error: (err) => this.toastr.error(err?.error?.message || 'Failed to download Stripe invoice'),
    });
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  money(formatted?: string | null, amount?: number | null): string {
    return displayMoney(formatted, amount);
  }

  formatStatus(status?: string | null): string {
    const raw = (status || '—').toString().trim().replace(/[_-]+/g, ' ');
    if (!raw || raw === '—') return '—';
    return raw
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  statusClass(status: string): string {
    return `is-${(status || 'draft').toLowerCase()}`;
  }

  pages(): number[] {
    const max = Math.min(this.lastPage, 5);
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  private applyList(res: { data: MasterInvoice[]; meta?: any }): void {
    this.invoices = res?.data || [];
    this.total = res?.meta?.total ?? this.invoices.length;
    this.page = res?.meta?.page ?? this.page;
    this.lastPage = res?.meta?.lastPage ?? 1;
  }
}
