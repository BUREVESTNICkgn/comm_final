import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  template: `
    <section>
      <h1>Product Detail</h1>
      <p>Viewing details for product ID: {{ route.snapshot.paramMap.get('id') }}</p>
    </section>
  `
})
export class ProductDetailComponent {
  constructor(protected route: ActivatedRoute) {}
}
