import { Injectable, NgZone, OnDestroy } from '@angular/core';

interface RegisteredDropdownPanel {
  root: HTMLElement;
  notifyChange: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class DropdownOverlayService implements OnDestroy {
  private panels = new Map<string, RegisteredDropdownPanel>();
  private activeKey: string | null = null;
  private listenersAttached = false;

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (!this.activeKey || !this.activeRoot) {
      return;
    }

    const target = event.target as Node;
    if (this.activeRoot.contains(target)) {
      return;
    }

    this.ngZone.run(() => this.close());
  };

  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.activeKey) {
      return;
    }

    event.preventDefault();
    this.ngZone.run(() => this.close());
  };

  constructor(private ngZone: NgZone) {}

  ngOnDestroy(): void {
    this.detachListeners();
  }

  register(group: string, id: string, panel: RegisteredDropdownPanel): void {
    this.panels.set(this.makeKey(group, id), panel);
    this.attachListeners();
  }

  unregister(group: string, id: string): void {
    const key = this.makeKey(group, id);

    if (this.activeKey === key) {
      this.close();
    }

    this.panels.delete(key);

    if (!this.panels.size) {
      this.detachListeners();
    }
  }

  isOpen(group: string, id: string): boolean {
    return this.activeKey === this.makeKey(group, id);
  }

  toggle(group: string, id: string, root: HTMLElement): void {
    if (this.isOpen(group, id)) {
      this.close();
      return;
    }

    this.open(group, id, root);
  }

  open(group: string, id: string, root: HTMLElement): void {
    const key = this.makeKey(group, id);

    if (this.activeKey && this.activeKey !== key) {
      const previousKey = this.activeKey;
      this.activeKey = null;
      this.activeRoot = null;
      this.notifyPanel(previousKey);
    }

    this.activeKey = key;
    this.activeRoot = root;
    this.notifyPanel(key);
  }

  close(): void {
    if (!this.activeKey) {
      return;
    }

    const previousKey = this.activeKey;
    this.activeKey = null;
    this.activeRoot = null;
    this.notifyPanel(previousKey);
  }

  private activeRoot: HTMLElement | null = null;

  private notifyPanel(key: string): void {
    this.panels.get(key)?.notifyChange();
  }

  private makeKey(group: string, id: string): string {
    return `${group}:${id}`;
  }

  private attachListeners(): void {
    if (this.listenersAttached) {
      return;
    }

    this.listenersAttached = true;
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('click', this.onDocumentClick);
      document.addEventListener('keydown', this.onDocumentKeydown);
    });
  }

  private detachListeners(): void {
    if (!this.listenersAttached) {
      return;
    }

    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onDocumentKeydown);
    this.listenersAttached = false;
  }
}
