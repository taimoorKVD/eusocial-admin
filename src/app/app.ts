import { Component, OnInit, signal } from '@angular/core';
import { Auth } from './services/auth';
import { PortalService } from './services/portal.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('eusocial-admin');

  constructor(
    public auth: Auth,
    private portal: PortalService,
  ) {
    this.portal.applyDocumentTitle();
  }

  ngOnInit(): void {
    // Restore session (local + cookie check)
    // this.auth.initUser();
  }
}
