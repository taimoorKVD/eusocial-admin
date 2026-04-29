import { Component, HostListener, OnInit } from '@angular/core';
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
  dropdownOpen = false;

  constructor(private auth: Auth) { }

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(user => this.user = user);
  }

  logout(): void {
    this.closeDropdown();
    this.auth.logout();
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown(): void {
    this.dropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.profile-dropdown')) {
      this.closeDropdown();
    }
  }

}
