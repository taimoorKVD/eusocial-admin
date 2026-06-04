import { Component, OnInit } from '@angular/core';
import { FormModuleListItem } from '../models/form-module.model';
import { FormsService } from '../services/forms.service';

@Component({
  selector: 'app-forms-list',
  standalone: false,
  templateUrl: './forms-list.component.html',
  styleUrl: './forms-list.component.scss',
})
export class FormsListComponent implements OnInit {
  modules: FormModuleListItem[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private formsService: FormsService) {}

  ngOnInit(): void {
    this.loadForms();
    console.log(this.modules);
  }

  loadForms(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.formsService.getForms().subscribe({
      next: (response) => {
        this.modules = response.data ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.modules = [];
        this.errorMessage = 'Failed to load forms. Please try again.';
        this.isLoading = false;
      },
    });
  }
}
