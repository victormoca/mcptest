import { Injectable } from '@angular/core';
import { SaleRecord } from '../models/sale';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly customers = [
    'Acme Corp',
    'Globex',
    'Initech',
    'Soylent',
    'Umbrella',
    'Stark Industries',
    'Wayne Enterprises',
    'Wonka Industries',
    'Oscorp',
    'Tyrell Corp'
  ];

  private readonly products = [
    'MCP Gateway',
    'MCP Analytics Suite',
    'MCP Pro License',
    'MCP Starter Pack',
    'MCP Monitoring',
    'MCP Security Add-on',
    'MCP Mobile',
    'MCP Integrations Bundle'
  ];

  private readonly regions = [
    'Norte',
    'Sur',
    'Este',
    'Oeste',
    'Centro'
  ];

  private readonly statuses: SaleRecord['status'][] = ['Completed', 'Pending', 'Cancelled'];

  getSales(count = 100): SaleRecord[] {
    return Array.from({ length: count }, (_, index) => this.createRecord(index));
  }

  private createRecord(index: number): SaleRecord {
    const quantity = this.randomInt(1, 25);
    const unitPrice = this.randomInt(50, 750);
    const saleDate = this.randomDateWithinDays(120);
    const status = this.statuses[this.randomInt(0, this.statuses.length - 1)];

    return {
      id: `SALE-${(index + 1).toString().padStart(4, '0')}`,
      customerName: this.randomItem(this.customers),
      productName: this.randomItem(this.products),
      region: this.randomItem(this.regions),
      quantity,
      unitPrice,
      totalAmount: Number((quantity * unitPrice).toFixed(2)),
      saleDate: saleDate.toISOString(),
      status
    };
  }

  private randomItem<T>(items: readonly T[]): T {
    return items[this.randomInt(0, items.length - 1)];
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomDateWithinDays(days: number): Date {
    const now = new Date();
    const pastOffset = this.randomInt(0, days);
    const date = new Date(now);
    date.setDate(now.getDate() - pastOffset);
    date.setHours(this.randomInt(0, 23), this.randomInt(0, 59), this.randomInt(0, 59), 0);
    return date;
  }
}