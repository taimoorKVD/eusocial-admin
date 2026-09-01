import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MasterInvoice } from '../../../interfaces/master-billing';
import { MasterInvoiceService } from '../../../services/master-invoice.service';
import { displayMoney } from '../../../shared/utils/money.util';
import {
  downloadGeneratedInvoice,
  formatInvoiceDate,
  formatInvoiceStatus,
  saveRemoteOrGeneratedInvoice,
} from '../invoice-print';

@Component({
  selector: 'app-invoice-view',
  standalone: false,
  templateUrl: './invoice-view.html',
  styleUrl: './invoice-view.scss',
})
export class InvoiceView implements OnInit {
  loading = true;
  downloading = false;
  invoice: MasterInvoice | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invoiceService: MasterInvoiceService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.toastr.error('Invalid invoice');
      this.back();
      return;
    }
    this.load(id);
  }

  load(id: number): void {
    this.loading = true;
    this.invoiceService.getInvoice(id).subscribe({
      next: (res) => {
        this.invoice = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err?.error?.message || 'Failed to load invoice');
        this.back();
      },
    });
  }

  back(): void {
    this.router.navigate(['/invoices']);
  }

  download(): void {
    if (!this.invoice || this.downloading) return;
    const invoice = this.invoice;
    this.downloading = true;
    this.invoiceService.downloadPdf(invoice.id).subscribe({
      next: (blob) => {
        this.downloading = false;
        saveRemoteOrGeneratedInvoice(blob, invoice);
      },
      error: () => {
        this.downloading = false;
        downloadGeneratedInvoice(invoice);
      },
    });
  }

  money(formatted?: string | null, amount?: number | null): string {
    return displayMoney(formatted, amount);
  }

  formatDate(value?: string | null): string {
    return formatInvoiceDate(value);
  }

  formatStatus(status?: string | null): string {
    return formatInvoiceStatus(status);
  }

  statusClass(status?: string | null): string {
    return `is-${(status || 'draft').toLowerCase()}`;
  }
}
