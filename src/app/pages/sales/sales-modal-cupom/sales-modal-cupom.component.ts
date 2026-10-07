import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { ItemVenda, Pagamento, FormaPagamento } from '../../../interfaces/sales';
interface Cupom { empresaNome: string; empresaEndereco: string; operadorNome?: string; itens: ItemVenda[]; valorTotal: number; pagamentos: Pagamento[]; troco: number; dataHora: Date; vendaId: string; }
@Component({ selector: 'app-sales-modal-cupom', imports: [CommonModule, MatDialogModule, MatButtonModule], templateUrl: './sales-modal-cupom.component.html', styleUrl: './sales-modal-cupom.component.scss' })
export class SalesModalCupomComponent {
  readonly labels: Record<FormaPagamento, string> = { dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', pix: 'Pix' };
  constructor(public dialogRef: MatDialogRef<SalesModalCupomComponent>, @Inject(MAT_DIALOG_DATA) public data: Cupom) {}
  imprimir(): void { window.print(); }
  fechar(): void { this.dialogRef.close(); }
}
