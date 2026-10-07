import { Component, Inject, computed, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormaPagamento, Pagamento, ResultadoPagamento } from '../../../interfaces/sales';
export const arredondar = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
@Component({ selector: 'app-sales-modal', templateUrl: './sales-modal-finalizar.component.html', styleUrls: ['./sales-modal-finalizar.component.scss'], standalone: false })
export class SalesModalComponent {
  readonly valor = new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(.01), Validators.max(99999999)] });
  readonly pagamentosRealizados = signal<Pagamento[]>([]);
  readonly erro = signal('');
  readonly confirmado = signal(false);
  readonly totalPago = computed(() => arredondar(this.pagamentosRealizados().reduce((acc, p) => acc + p.valor, 0)));
  readonly saldoRestante = computed(() => Math.max(0, arredondar(this.data.total - this.totalPago())));
  readonly troco = computed(() => Math.max(0, arredondar(this.totalPago() - this.data.total)));
  readonly podeConfirmar = computed(() => this.data.total > 0 && this.totalPago() >= this.data.total && !this.confirmado() &&
    this.troco() <= arredondar(this.pagamentosRealizados().filter(p => p.forma === 'dinheiro').reduce((sum, p) => sum + p.valor, 0)));
  readonly labels: Record<FormaPagamento, string> = { dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', pix: 'Pix' };
  constructor(public dialogRef: MatDialogRef<SalesModalComponent, ResultadoPagamento | undefined>, @Inject(MAT_DIALOG_DATA) public data: { total: number }) { this.valor.setValue(data.total); }
  adicionarPagamento(forma: FormaPagamento): void {
    this.erro.set('');
    const valor = arredondar(this.valor.value);
    if (this.valor.invalid || !Number.isFinite(valor) || valor <= 0 || this.pagamentosRealizados().length >= 20 || this.confirmado()) return;
    if (forma !== 'dinheiro' && valor > this.saldoRestante()) { this.erro.set('Cartão e Pix não podem ultrapassar o saldo restante.'); return; }
    this.pagamentosRealizados.update(atual => [...atual, { forma, valor }]);
    this.valor.setValue(this.saldoRestante());
  }
  removerPagamento(index: number): void { this.pagamentosRealizados.update(atual => atual.filter((_, i) => i !== index)); this.valor.setValue(this.saldoRestante()); }
  confirmar(): void { if (!this.podeConfirmar()) return; this.confirmado.set(true); this.dialogRef.close({ pagamentos: this.pagamentosRealizados(), troco: this.troco() }); }
  cancelar(): void { this.dialogRef.close(); }
}
