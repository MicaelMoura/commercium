import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ItemVenda } from '../../interfaces/sales';

@Component({
  selector: 'app-sale-summary',
  templateUrl: './sale-summary.component.html',
  styleUrl: './sale-summary.component.scss',
  standalone: false,
})
export class SaleSummaryComponent {
  @Input() items: ItemVenda[] = [];
  @Input() total = 0;
  @Input() saleId = '';
  @Input() startedAt = new Date();
  @Input() loading = false;
  @Input() locked = false;
  @Input() offline = false;

  @Output() removeItem = new EventEmitter<number>();
  @Output() clearSale = new EventEmitter<void>();
  @Output() finalizeSale = new EventEmitter<void>();
}
