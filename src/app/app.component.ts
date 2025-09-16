import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaleRecord } from './models/sale';
import { SalesService } from './services/sales.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly title = 'MCP - Ventas demo';
  readonly sales: SaleRecord[];

  constructor(private readonly salesService: SalesService) {
    // Pre-generate the dataset so every unauthenticated visit sees 100 rows.
    this.sales = this.salesService.getSales(100);
  }
}