import { Component } from '@angular/core';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

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
  message = '';
  page = 1;
  lastPage = 1;

  constructor(private productService: ProductService, private router: Router) { }

  ngOnInit(): void {
    this.loadProducts();
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
        this.message = 'Failed to load products ❌';
        this.loading = false;
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
        this.message = 'Product deleted successfully ✅';
        this.loadProducts(this.page);
      },
      error: () => {
        this.message = 'Failed to delete product ❌';
      },
    });
  }

  prevPage(): void {
    if (this.page > 1) this.loadProducts(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.lastPage) this.loadProducts(this.page + 1);
  }

}
