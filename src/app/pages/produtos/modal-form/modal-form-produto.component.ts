import { Component, DestroyRef, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest } from 'rxjs';
import { Fornecedor } from '../../../interfaces/fornecedor';
import { Produto } from '../../../interfaces/produto';
import { Unit } from '../../../interfaces/units';
import { FornecedoresService } from '../../../services/fornecedores.service';
import { PlataformService } from '../../../services/plataform.service';
import { ProdutosService } from '../../../services/produtos.service';

export interface ProdutoFormDialogData { produto: Produto | null; empresaId: string; }

@Component({ selector: 'app-modal-form-produto', templateUrl: './modal-form-produto.component.html', styleUrls: ['./modal-form-produto.component.scss'], standalone: false })
export class ModalFormProdutoComponent implements OnInit {
  formProduto!: FormGroup;
  isEditMode = false;
  isSaving = false;
  isLoadingOptions = true;
  errorMessage = '';
  listUnits: Unit[] = [];
  listFornecedores: Fornecedor[] = [];

  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<ModalFormProdutoComponent, boolean>, private produtosService: ProdutosService,
    private plataformService: PlataformService, private fornecedorService: FornecedoresService, private snackBar: MatSnackBar,
    private destroyRef: DestroyRef, @Inject(MAT_DIALOG_DATA) public data: ProdutoFormDialogData) {}

  ngOnInit(): void {
    this.formProduto = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      marca: ['', [Validators.required, Validators.maxLength(80)]],
      codigoDeBarras: ['', [Validators.required, Validators.pattern(/^\d{8,14}$/)]],
      unidadeDeMedida: ['', Validators.required], fornecedorId: ['', Validators.required],
      valorUnitarioCompra: [0, [Validators.required, Validators.min(0)]], valorUnitarioVenda: [0, [Validators.required, Validators.min(0.01)]],
      quantidadeMinima: [0, [Validators.required, Validators.min(0)]], pesoNoCodigo: [false],
      ncm: ['00000000', [Validators.required, Validators.pattern(/^\d{8}$/)]], cfop: ['5102', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      origem: [0, [Validators.required, Validators.min(0), Validators.max(8)]], csosn: ['102', [Validators.required, Validators.pattern(/^\d{3}$/)]],
    });
    if (this.data.produto) { this.isEditMode = true; this.formProduto.patchValue(this.data.produto); }
    if (!this.data.empresaId) { this.errorMessage = 'Nenhuma empresa ativa foi encontrada.'; this.isLoadingOptions = false; return; }
    combineLatest([this.fornecedorService.getAllFornecedores(this.data.empresaId), this.plataformService.getUnits()])
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ([suppliers, units]) => { this.listFornecedores = suppliers; this.listUnits = units; this.isLoadingOptions = false; },
        error: (error: unknown) => { console.error('Não foi possível carregar as opções do produto.', error); this.errorMessage = 'Não foi possível carregar fornecedores e unidades.'; this.isLoadingOptions = false; },
      });
  }

  closeModal(result = false): void { if (!this.isSaving) this.dialogRef.close(result); }

  async saveProduto(): Promise<void> {
    this.errorMessage = '';
    if (this.formProduto.invalid || this.isSaving || this.isLoadingOptions) { this.formProduto.markAllAsTouched(); return; }
    const raw = this.formProduto.getRawValue();
    const supplier = this.listFornecedores.find((item) => item.id === raw.fornecedorId);
    if (!supplier) { this.formProduto.controls['fornecedorId'].setErrors({ invalidSupplier: true }); return; }
    const payload: Produto = { nome: raw.nome.trim(), marca: raw.marca.trim(), fornecedorId: raw.fornecedorId, fornecedorNome: supplier.fantasyName,
      valorUnitarioCompra: Number(raw.valorUnitarioCompra), valorUnitarioVenda: Number(raw.valorUnitarioVenda), codigoDeBarras: raw.codigoDeBarras,
      quantidadeMinima: Number(raw.quantidadeMinima), unidadeDeMedida: raw.unidadeDeMedida, pesoNoCodigo: Boolean(raw.pesoNoCodigo),
      ncm: raw.ncm, cfop: raw.cfop, origem: Number(raw.origem), csosn: raw.csosn };
    this.isSaving = true;
    try {
      if (this.isEditMode) { if (!this.data.produto?.firebaseId) throw new Error('Identificador do produto não encontrado.'); await this.produtosService.updateProduto(this.data.empresaId, this.data.produto.firebaseId, payload); }
      else { await this.produtosService.addProduto(this.data.empresaId, payload); }
      this.snackBar.open(`Produto ${this.isEditMode ? 'atualizado' : 'cadastrado'} com sucesso.`, 'Fechar', { duration: 4000 }); this.dialogRef.close(true);
    } catch (error: unknown) { console.error('Não foi possível salvar o produto.', error); this.errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar o produto.'; }
    finally { this.isSaving = false; }
  }
}
