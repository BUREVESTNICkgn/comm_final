import { Component } from '@angular/core';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { HeroBannerComponent } from './layout/hero-banner/hero-banner.component';
import { FeaturedProductsComponent } from './layout/featured-products/featured-products.component';
import { ProductDetailComponent } from './product-detail/product-detail.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent, FooterComponent, HeroBannerComponent, FeaturedProductsComponent, ProductDetailComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
