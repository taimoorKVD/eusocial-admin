import { Component, OnInit } from '@angular/core';
import { Auth } from '../../services/auth';
import { User } from '../../interfaces/user';

@Component({
  selector: 'app-navbar',
  standalone: false,
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit {
  user: User = null;
  constructor(private auth: Auth) { }

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(user => this.user = user);
  }

  logout(): void {
    this.auth.logout();
  }

}
