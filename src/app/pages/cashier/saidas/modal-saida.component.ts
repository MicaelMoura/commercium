import { Component, DestroyRef, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Timestamp } from 'firebase/firestore';
import { CashFlow } from '../../../interfaces/cashflow';
import { Payment } from '../../../interfaces/payment';
import { CashFlowService } from '../../../services/cashflow.service';
import { PlataformService } from '../../../services/plataform.service';
import { CashFlowDialogData } from '../entradas/modal-entrada.component';

@Component({ selector: 'app-modal-form-saida', templateUrl: './modal-saida.component.html', styleUrls: ['./modal-saida.component.scss'], standalone: false })
export class ModalSaidaComponent implements OnInit {
  formCashFlow!: FormGroup;
  listPayments: Payment[] = [];
  isEditMode = false;
  isSaving = false;
  errorMessage = '';
  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<ModalSaidaComponent, boolean>, private cashFlowService: CashFlowService,
    private plataformService: PlataformService, private snackBar: MatSnackBar, private destroyRef: DestroyRef,
    @Inject(MAT_DIALOG_DATA) public data: CashFlowDialogData) {}

  ngOnInit(): void {
    this.formCashFlow = this.fb.group({ descricao: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
      valor: [null, [Validators.required, Validators.min(0.01)]], dataMovimento: [new Date(), Validators.required], formaPagamento: ['dinheiro', Validators.required], entidadeId: [null] });
    if (this.data.cashFlow) { this.isEditMode = true; this.formCashFlow.patchValue({ ...this.data.cashFlow, dataMovimento: this.data.cashFlow.dataMovimento instanceof Timestamp ? this.data.cashFlow.dataMovimento.toDate() : this.data.cashFlow.dataMovimento }); }
    this.plataformService.getPayments().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (payments) => { this.listPayments = payments; }, error: (error: unknown) => { console.error('Não foi possível carregar as formas de pagamento.', error); this.errorMessage = 'Não foi possível carregar as formas de pagamento.'; } });
  }

  closeModal(): void { if (!this.isSaving) this.dialogRef.close(false); }
  async saveCashFlow(): Promise<void> {
    this.errorMessage = '';
    if (this.formCashFlow.invalid || this.isSaving || !this.data.empresaId) { this.formCashFlow.markAllAsTouched(); return; }
    const raw = this.formCashFlow.getRawValue();
    const payload: Omit<CashFlow, 'id'> = { tipo: 'SAÍDA', descricao: raw.descricao.trim(), valor: Number(raw.valor), dataMovimento: raw.dataMovimento, formaPagamento: raw.formaPagamento, entidadeId: raw.entidadeId };
    this.isSaving = true;
    try {
      if (this.isEditMode) { if (!this.data.cashFlow?.id) throw new Error('Identificador da saída não encontrado.'); await this.cashFlowService.updateCashFlow(this.data.empresaId, this.data.cashFlow.id, payload); }
      else { await this.cashFlowService.addCashFlow(this.data.empresaId, payload); }
      this.snackBar.open(`Saída ${this.isEditMode ? 'atualizada' : 'registrada'} com sucesso.`, 'Fechar', { duration: 4000 }); this.dialogRef.close(true);
    } catch (error: unknown) { console.error('Não foi possível salvar a saída.', error); this.errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar a saída.'; }
    finally { this.isSaving = false; }
  }
}
