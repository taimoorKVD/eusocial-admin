import { Component } from '@angular/core';

@Component({
  selector: 'app-setup-items',
  standalone: false,
  templateUrl: './setup-items.html',
  styleUrl: './setup-items.scss',
})
export class SetupItems {
  chooseItems = null; // selected value

  items = [
    { label: 'John Doe', value: 1 },
    { label: 'Ali Khan', value: 2 },
    { label: 'Umar', value: 3 }
  ];

 categories = [
    {
      name: 'Product Specific',
      options: ['Produce', 'Paper Product', 'Meat', 'Plumbing']
    },
    {
      name: 'General Items',
      options: ['Cleaning', 'Stationery', 'Packaging']
    },
    {
      name: 'Professional Services',
      options: ['Consulting', 'Maintenance', 'Support']
    }
  ];

selectedCategoryName: string = '';
selectedCategory: any = null;
selectedOptions: string[] = [];

onCategoryChange() {
  const found = this.categories.find(
    c => c.name === this.selectedCategoryName
  );

  // Only assign if valid category exists
  this.selectedCategory = found ? found : null;

  // reset checkboxes
  this.selectedOptions = [];
}

  toggleOption(option: string) {
    if (this.selectedOptions.includes(option)) {
      this.selectedOptions = this.selectedOptions.filter(o => o !== option);
    } else {
      this.selectedOptions.push(option);
    }
  }
}
