import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductCardComponent } from '../../product-card/product-card.component';

type FeaturedProduct = {
  name: string;
  price: string;
  description: string;
  badge?: string;
};

@Component({
  selector: 'app-featured-products',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './featured-products.component.html',
  styleUrl: './featured-products.component.css'
})
export class FeaturedProductsComponent {
  protected products: FeaturedProduct[] = [
    {
      name: 'Recycled Canvas Tote',
      price: '$48.00',
      description: 'Spacious carry-all crafted with reinforced seams and water-resistant lining.',
      badge: 'New'
    },
    {
      name: 'Bamboo Utility Backpack',
      price: '$92.00',
      description: 'Lightweight daypack with breathable mesh back panel and modular pockets.'
    },
    {
      name: 'Everyday Ceramic Mug',
      price: '$22.00',
      description: 'Double-walled stoneware that keeps beverages warm without burning your hands.',
      badge: 'Staff pick'
    }
  ];
}
