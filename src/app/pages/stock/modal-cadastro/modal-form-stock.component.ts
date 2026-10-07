import { Component, DestroyRef, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest } from 'rxjs';
import { Fornecedor } from '../../../interfaces/fornecedor';
import { Produto } from '../../../interfaces/produto';
import { Stock } from '../../../interfaces/stock';
import { FornecedoresService } from '../../../services/fornecedores.service';
import { ProdutosService } from '../../../services/produtos.service';
import { StockService } from '../../../services/stock.service';

export interface StockFormDialogData { stockEntry: Stock | null; empresaId: string; }
interface StockFormValue { produtoId: string; fornecedorId: string; quantidade: number; validade: string | null; tipoMovimento: 'ENTRADA' | 'AJUSTE'; motivoAjuste: string | null; }

@Component({ selector: 'app-modal-form-stock', templateUrl: './modal-form-stock.component.html', styleUrls: ['./modal-form-stock.component.scss'], standalone: false })
export class ModalFormStockComponent implements OnInit {
  formStock!: FormGroup;
  readonly motivosAjuste = ['Perda', 'Estragado', 'Vencimento', 'Inventário'];
  isEditMode = false;
  isSaving = false;
  isLoadingOptions = true;
  errorMessage = '';
  listFornecedores: Fornecedor[] = [];
  listProdutos: Produto[] = [];

  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<ModalFormStockComponent, boolean>, private stockService: StockService,
    private fornecedoresService: FornecedoresService, private produtosService: ProdutosService, private snackBar: MatSnackBar,
    private destroyRef: DestroyRef, @Inject(MAT_DIALOG_DATA) public data: StockFormDialogData) {}

  ngOnInit(): void {
    this.formStock = this.fb.group({ produtoId: ['', Validators.required], fornecedorId: ['', Validators.required],
      quantidade: [null, [Validators.required, Validators.min(0.001)]], validade: [null], tipoMovimento: ['ENTRADA', Validators.required], motivoAjuste: [null] });
    if (this.data.stockEntry) { this.isEditMode = true; this.formStock.patchValue(this.data.stockEntry); }
    this.toggleAdjustmentField(this.formStock.controls['tipoMovimento'].value);
    this.formStock.controls['tipoMovimento'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.toggleAdjustmentField(value));
    if (!this.data.empresaId) { this.isLoadingOptions = false; this.errorMessage = 'Nenhuma empresa ativa foi encontrada.'; return; }
    combineLatest([this.fornecedoresService.getAllFornecedores(this.data.empresaId), this.produtosService.getAllProdutos(this.data.empresaId)])
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ([suppliers, products]) => { this.listFornecedores = suppliers; this.listProdutos = products; this.isLoadingOptions = false; },
        error: (error: unknown) => { console.error('Não foi possível carregar as opções de estoque.', error); this.errorMessage = 'Não foi possível carregar produtos e fornecedores.'; this.isLoadingOptions = false; },
      });
  }

  private toggleAdjustmentField(tipo: string | null): void {
    const control = this.formStock.controls['motivoAjuste'];
    if (tipo === 'AJUSTE') control.setValidators(Validators.required); else { control.clearValidators(); control.setValue(null, { emitEvent: false }); }
    control.updateValueAndValidity({ emitEvent: false });
  }

  async saveStockEntry(): Promise<void> {
    this.errorMessage = '';
    if (this.formStock.invalid || this.isSaving || this.isLoadingOptions) { this.formStock.markAllAsTouched(); return; }
    const raw = this.formStock.getRawValue() as StockFormValue;
    const product = this.listProdutos.find((item) => item.firebaseId === raw.produtoId);
    const supplier = this.listFornecedores.find((item) => item.id === raw.fornecedorId);
    if (!product || !supplier) { this.errorMessage = 'Selecione um produto e um fornecedor válidos.'; return; }
    const payload: Omit<Stock, 'id'> = { produtoId: raw.produtoId, produtoNome: product.nome, fornecedorId: raw.fornecedorId,
      fornecedorNome: supplier.fantasyName, quantidade: Number(raw.quantidade), validade: raw.validade ?? '', tipoMovimento: raw.tipoMovimento,
      motivoAjuste: raw.motivoAjuste ?? undefined, dataMovimento: this.data.stockEntry?.dataMovimento ?? new Date() };
    this.isSaving = true;
    try {
      if (this.isEditMode) { if (!this.data.stockEntry?.id) throw new Error('Identificador da movimentação não encontrado.'); await this.stockService.updateStockEntry(this.data.empresaId, this.data.stockEntry.id, payload); }
      else { await this.stockService.addStockEntry(this.data.empresaId, payload); }
      this.snackBar.open(`Movimentação ${this.isEditMode ? 'atualizada' : 'cadastrada'} com sucesso.`, 'Fechar', { duration: 4000 }); this.dialogRef.close(true);
    } catch (error: unknown) { console.error('Não foi possível salvar a movimentação.', error); this.errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar a movimentação.'; }
    finally { this.isSaving = false; }
  }

  closeModal(): void { if (!this.isSaving) this.dialogRef.close(false); }
}
