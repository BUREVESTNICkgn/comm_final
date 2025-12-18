import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) price!: string;
  @Input() description = '';
  @Input() highlights: string[] = [];
}
