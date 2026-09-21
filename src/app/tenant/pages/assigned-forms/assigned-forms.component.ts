import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AssignedFormPriority = 'High' | 'Medium' | 'Low';
export type AssignedFormStatus =
  | 'Completed'
  | 'In Progress'
  | 'Overdue'
  | 'Not Started';

export interface AssignedFormRowItem {
  id: number;
  formName: string;
  assignedTo: string;
  dueDate: string;
  priority: AssignedFormPriority;
  status: AssignedFormStatus;
}

export interface AssignedFormsSummaryCard {
  key: string;
  label: string;
  value: number;
  iconTone: 'blue' | 'green' | 'amber' | 'red';
}

@Component({
  selector: 'app-assigned-forms',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assigned-forms.component.html',
  styleUrl: './assigned-forms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignedFormsComponent {
  readonly summaryCards: AssignedFormsSummaryCard[] = [
    { key: 'total', label: 'Total Assigned', value: 24, iconTone: 'blue' },
    { key: 'completed', label: 'Completed', value: 16, iconTone: 'green' },
    { key: 'in-progress', label: 'In Progress', value: 5, iconTone: 'amber' },
    { key: 'overdue', label: 'Overdue', value: 3, iconTone: 'red' },
  ];

  readonly rows: AssignedFormRowItem[] = [
    {
      id: 1,
      formName: 'Daily Kitchen Checklist',
      assignedTo: 'Sarah Johnson',
      dueDate: 'Sep 16, 2026',
      priority: 'High',
      status: 'Completed',
    },
    {
      id: 2,
      formName: 'Hygiene Inspection',
      assignedTo: 'Mike Chen',
      dueDate: 'Sep 17, 2026',
      priority: 'Medium',
      status: 'In Progress',
    },
    {
      id: 3,
      formName: 'Food Safety Audit',
      assignedTo: 'Emily Davis',
      dueDate: 'Sep 15, 2026',
      priority: 'High',
      status: 'Overdue',
    },
    {
      id: 4,
      formName: 'Stock Inventory Count',
      assignedTo: 'James Wilson',
      dueDate: 'Sep 20, 2026',
      priority: 'Low',
      status: 'Not Started',
    },
    {
      id: 5,
      formName: 'Opening Shift Report',
      assignedTo: 'Ava Martinez',
      dueDate: 'Sep 21, 2026',
      priority: 'Medium',
      status: 'In Progress',
    },
  ];

  readonly filterUsers = [
    'All Users',
    'Sarah Johnson',
    'Mike Chen',
    'Emily Davis',
    'James Wilson',
    'Ava Martinez',
  ];

  readonly filterStatuses = [
    'All Statuses',
    'Completed',
    'In Progress',
    'Overdue',
    'Not Started',
  ];

  readonly filterPriorities = ['All Priorities', 'High', 'Medium', 'Low'];

  readonly pageNumbers = [1, 2, 3, 4, 5];
  readonly currentPage = 1;

  priorityClass(priority: AssignedFormPriority): string {
    switch (priority) {
      case 'High':
        return 'bg-[#FEE2E2] text-[#B91C1C]';
      case 'Medium':
        return 'bg-[#FFEDD5] text-[#C2410C]';
      case 'Low':
        return 'bg-[#DCFCE7] text-[#15803D]';
    }
  }

  statusClass(status: AssignedFormStatus): string {
    switch (status) {
      case 'Completed':
        return 'bg-[#16A34A] text-white';
      case 'In Progress':
        return 'bg-[#F59E0B] text-white';
      case 'Overdue':
        return 'bg-[#DC2626] text-white';
      case 'Not Started':
        return 'bg-[#E5E7EB] text-[#4B5563]';
    }
  }

  cardToneClass(tone: AssignedFormsSummaryCard['iconTone']): string {
    switch (tone) {
      case 'blue':
        return 'bg-[#DBEAFE] text-[#2563EB]';
      case 'green':
        return 'bg-[#DCFCE7] text-[#16A34A]';
      case 'amber':
        return 'bg-[#FEF3C7] text-[#D97706]';
      case 'red':
        return 'bg-[#FEE2E2] text-[#DC2626]';
    }
  }
}
