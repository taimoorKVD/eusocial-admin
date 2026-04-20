import { Component } from '@angular/core';
interface Item {
  id: number;
  name: string;
  editing?: boolean;
}

interface Category {
  name: string;
  items: Item[];
  newItem: string;
}

@Component({
  selector: 'app-setup-reporting-group',
  standalone: false,
  templateUrl: './setup-reporting-group.html',
  styleUrl: './setup-reporting-group.scss',
})
export class SetupReportingGroup {
STORAGE_KEY = 'setup_items_data';

  categories: Category[] = [
    { name: 'Product Specific Items', items: [], newItem: '' },
    { name: 'General Items', items: [], newItem: '' },
    { name: 'Professional Services', items: [], newItem: '' },
    { name: 'Labor', items: [], newItem: '' }
  ];

  ngOnInit() {
    this.loadData();
  }

  // ======================
  // LOCAL STORAGE
  // ======================
  saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.categories));
  }

  loadData() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      this.categories = JSON.parse(data);
    }
  }

  // ======================
  // ADD (Enter + Button)
  // ======================
  addItem(category: Category) {
    if (!category.newItem.trim()) return;

    category.items.push({
      id: Date.now(),
      name: category.newItem
    });

    category.newItem = '';
    this.saveToStorage();
  }

  // ======================
  // DELETE
  // ======================
  deleteItem(category: Category, itemId: number) {
    category.items = category.items.filter(i => i.id !== itemId);
    this.saveToStorage();
  }

  // ======================
  // EDIT
  // ======================
  enableEdit(item: Item) {
    item.editing = true;
  }

  saveEdit(item: Item) {
    item.editing = false;
    this.saveToStorage();
  }

  // ENTER KEY HANDLER
  handleEnter(category: Category, item?: Item) {
    if (item) {
      this.saveEdit(item);
    } else {
      this.addItem(category);
    }
  }

  // FINAL SAVE BUTTON
  onSave() {
    this.saveToStorage();
    alert('Saved successfully');
  }
}
