import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService } from '../../../services/product.service';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-product-form',
  standalone: false,
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductForm {
  baseUrl = environment.apiUrl;
  form!: FormGroup;
  isEditMode = false;
  productId!: number;
  message = '';
  loading = false;
  imagePreview: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      image: [null],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.productId = +id;
      this.loadProduct();
    }
  }

  loadProduct(): void {
    this.loading = true;
    this.productService.getProduct(this.productId).subscribe({
      next: (res) => {
        this.form.patchValue({
          name: res.name,
          description: res.description,
          price: res.price,
        });
        if (res.image) {
          this.imagePreview = res.image.startsWith('/')
            ? `${this.baseUrl}${res.image}`
            : res.image;
        }
        this.loading = false;
      },
      error: () => {
        this.message = 'Failed to load product ❌';
        this.loading = false;
      },
    });
  }

  saveProduct(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // console.log('Submitting form with values:', this.form.value);

    const formData = new FormData();
    formData.append('name', this.form.value.name);
    formData.append('description', this.form.value.description || '');
    formData.append('price', this.form.value.price.toString());
    if (this.selectedFile) formData.append('image', this.selectedFile);

    this.loading = true;
    const req$ = this.isEditMode
      ? this.productService.updateProduct(this.productId, formData)
      : this.productService.createProduct(formData);

    req$.subscribe({
      next: () => {
        this.message = this.isEditMode
          ? 'Product updated successfully ✅'
          : 'Product created successfully ✅';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/products']), 1000);
      },
      error: () => {
        this.message = 'Failed to save product ❌';
        this.loading = false;
      },
    });
  }


  onFileChange(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    this.selectedFile = file;
    this.form.patchValue({ image: file });

    const reader = new FileReader();
    reader.onload = () => (this.imagePreview = reader.result);
    reader.readAsDataURL(file);
  }

  backToList(): void {
    this.router.navigate(['/products']);
  }

  get f() {
    return this.form.controls;
  }

}
