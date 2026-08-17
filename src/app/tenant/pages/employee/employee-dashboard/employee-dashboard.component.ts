import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  EmployeeDashboardData,
  EmployeeStatValue,
  TodaysAssignment,
} from '../../../../interfaces/dashboard';

interface EmployeeStatCardView {
  key: string;
  title: string;
  stat: EmployeeStatValue;
  icon: 'clipboard' | 'clock' | 'check' | 'alert';
}

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-dashboard.component.html',
})
export class EmployeeDashboardComponent {
  private readonly router = inject(Router);

  @Input({ required: true }) data!: EmployeeDashboardData;

  get statCards(): EmployeeStatCardView[] {
    const stats = this.data.stats;
    return [
      {
        key: 'myAssignments',
        title: 'My Assignments',
        stat: stats.myAssignments,
        icon: 'clipboard',
      },
      {
        key: 'inProgress',
        title: 'In Progress',
        stat: stats.inProgress,
        icon: 'clock',
      },
      {
        key: 'completed',
        title: 'Completed',
        stat: stats.completed,
        icon: 'check',
      },
      {
        key: 'overdue',
        title: 'Overdue',
        stat: stats.overdue,
        icon: 'alert',
      },
    ];
  }

  get welcomeHeading(): string {
    const firstName = this.data.welcome.firstName;
    if (firstName) {
      return `Welcome Back, ${firstName}!`;
    }

    const fullName = this.data.welcome.fullName;
    if (fullName) {
      return `Welcome Back, ${fullName}!`;
    }

    return this.data.welcome.message || 'Welcome Back!';
  }

  get welcomeSubtitle(): string {
    const message = this.data.welcome.message.trim();
    const name = this.data.welcome.firstName || this.data.welcome.fullName;
    if (!message) {
      return '';
    }
    if (!name) {
      return message === this.welcomeHeading ? '' : message;
    }

    const stripped = message
      .replace(new RegExp(`^Welcome Back,?\\s*${this.escapeRegExp(name)}!?\\s*`, 'i'), '')
      .trim();
    return stripped === this.welcomeHeading ? '' : stripped;
  }

  goToMyForms(): void {
    this.router.navigate(['/my-forms']);
  }

  goToHistory(): void {
    this.router.navigate(['/history']);
  }

  openAssignment(item: TodaysAssignment): void {
    if (!item.id) {
      return;
    }
    this.router.navigate(['/my-forms', item.id]);
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  }

  priorityLabel(priority: string): string {
    if (!priority) {
      return '';
    }
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  }

  priorityDotClass(priority: string): string {
    switch (priority) {
      case 'high':
        return 'bg-[#EF4444]';
      case 'low':
        return 'bg-[#22C55E]';
      default:
        return 'bg-[#FF9015]';
    }
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
