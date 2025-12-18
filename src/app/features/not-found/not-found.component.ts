import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section>
      <h1>Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a routerLink="/catalog">Return to catalog</a>
    </section>
  `
})
export class NotFoundComponent {}
