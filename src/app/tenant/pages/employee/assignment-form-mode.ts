/**
 * Presentation-only fill modes for employee assignments.
 * Not a second form data store — FormGroup remains the source of truth.
 */
export type AssignmentFormMode = 'manual' | 'normal';

/** Alias used by the assignment page; same set of modes. */
export type EmployeeInteractionMode = AssignmentFormMode;
