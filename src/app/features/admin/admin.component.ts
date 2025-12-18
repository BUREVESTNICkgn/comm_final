import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <section>
      <h1>Admin Area</h1>
      <nav>
        <a routerLink="products">Products</a> |
        <a routerLink="orders">Orders</a> |
        <a routerLink="users">Users</a>
      </nav>
      <router-outlet />
    </section>
  `
})
export class AdminComponent {}
