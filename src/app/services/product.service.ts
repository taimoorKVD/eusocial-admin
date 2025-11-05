import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../interfaces/product';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private baseUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  getProducts(page: number = 1): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}?page=${page}`);
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  /** ✅ Allow FormData or object */
  createProduct(data: Partial<Product> | FormData): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, data);
  }

  /** ✅ Allow FormData or object */
  updateProduct(id: number, data: Partial<Product> | FormData): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/${id}`, data);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
