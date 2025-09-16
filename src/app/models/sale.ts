export interface SaleRecord {
  id: string;
  customerName: string;
  productName: string;
  region: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  saleDate: string; // ISO string for ease of formatting
  status: 'Completed' | 'Pending' | 'Cancelled';
}