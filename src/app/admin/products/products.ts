import { Component } from '@angular/core';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { BulkSelectionState } from '../../shared/dynamic-listing/bulk-selection.state';

@Component({
  selector: 'app-products',
  standalone: false,
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products {
  baseUrl = environment.apiUrl;
  products: Product[] = [];
  total = 0;
  loading = true;
  page = 1;
  lastPage = 1;
  showBulkDeleteConfirmModal = false;
  bulkDeleting = false;

  bulkSelection = new BulkSelectionState();

  constructor(
    private productService: ProductService,
    private router: Router,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.loadProducts();
  }

  get bulkDeleteConfirmDescription(): string {
    const count = this.bulkSelection.count();
    return `Delete ${count} selected product${count === 1 ? '' : 's'}? This action cannot be undone.`;
  }

  selectableProductIds(): number[] {
    return this.products.map((p) => p.id).filter((id) => id != null);
  }

  isSelected(product: Product): boolean {
    return this.bulkSelection.isSelected(product.id);
  }

  toggleSelect(product: Product): void {
    if (product?.id == null) return;
    this.bulkSelection.toggle(product.id);
  }

  isAllSelected(): boolean {
    return this.bulkSelection.isAllSelected(this.selectableProductIds());
  }

  isIndeterminate(): boolean {
    return this.bulkSelection.isIndeterminate(this.selectableProductIds());
  }

  toggleSelectAll(): void {
    this.bulkSelection.toggleAll(this.selectableProductIds());
  }

  openBulkDeleteConfirm(): void {
    if (!this.bulkSelection.hasSelection()) return;
    this.showBulkDeleteConfirmModal = true;
  }

  closeBulkDeleteConfirmModal(): void {
    this.showBulkDeleteConfirmModal = false;
  }

  onConfirmBulkDelete(): void {
    const ids = [...this.bulkSelection.selectedIds()];
    if (!ids.length) return;

    const allVisibleSelected =
      this.products.length > 0 && this.bulkSelection.count() === this.products.length;

    this.closeBulkDeleteConfirmModal();
    this.bulkDeleting = true;

    this.productService.bulkDeleteProducts(ids).subscribe({
      next: () => {
        this.toastr.success('Products deleted successfully');
        this.bulkSelection.clear();
        this.bulkDeleting = false;
        if (allVisibleSelected && this.page > 1) {
          this.loadProducts(this.page - 1);
        } else {
          this.loadProducts(this.page);
        }
      },
      error: (err) => {
        this.bulkDeleting = false;
        this.toastr.error(err?.error?.message || 'Failed to delete products');
      },
    });
  }

  loadProducts(page: number = 1): void {
    this.loading = true;
    this.productService.getProducts(page).subscribe({
      next: (res) => {
        this.products = res.data;
        this.total = res.meta?.total || this.products.length;
        this.lastPage = res.meta?.lastPage || 1;
        this.page = res.meta?.page || 1;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load products');
        this.loading = false;
        this.bulkSelection.clear();
      },
    });
  }

  addProduct() {
    this.router.navigate(['/products/create']);
  }

  deleteProduct(id: number): void {
    if (!confirm('Are you sure you want to delete this product?')) return;
    this.productService.deleteProduct(id).subscribe({
      next: () => {
        this.toastr.success('Product deleted successfully');
        this.bulkSelection.clear();
        this.loadProducts(this.page);
      },
      error: () => {
        this.toastr.error('Failed to delete product');
      },
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.bulkSelection.clear();
      this.loadProducts(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.lastPage) {
      this.bulkSelection.clear();
      this.loadProducts(this.page + 1);
    }
  }

}
