import { Component, OnInit, signal } from '@angular/core';
import { Auth } from './services/auth';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('eusocial-admin');

  constructor(public auth: Auth) { }

  ngOnInit(): void {
    // Restore session (local + cookie check)
    // this.auth.initUser();
  }
}
