import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  templateUrl: './hero-banner.component.html',
  styleUrl: './hero-banner.component.css'
})
export class HeroBannerComponent {
  @Input({ required: true }) heading!: string;
  @Input({ required: true }) subheading!: string;
  @Input() ctaLabel = 'Shop now';
}
