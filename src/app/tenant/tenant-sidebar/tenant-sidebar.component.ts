import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-tenant-sidebar',
  standalone: false,

  templateUrl: './tenant-sidebar.component.html',
  styleUrl: './tenant-sidebar.component.scss'
})
export class TenantSidebarComponent {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  constructor(private route: ActivatedRoute) {}

  openSetup = false;
  openTraining = false;
  slug: string = '';

  ngOnInit() {
  this.slug = this.route.snapshot.paramMap.get('slug') || '';
}

  toggleSetup() {
    this.openSetup = !this.openSetup;
  }

  toggleTraining() {
    this.openTraining = !this.openTraining;
  }
}
