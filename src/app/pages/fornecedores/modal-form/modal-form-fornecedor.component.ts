import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Fornecedor } from '../../../interfaces/fornecedor';
import { FornecedoresService } from '../../../services/fornecedores.service';

export interface FornecedorFormDialogData { fornecedor: Fornecedor | null; empresaId: string; }

@Component({ selector: 'app-modal-form-fornecedor', templateUrl: './modal-form-fornecedor.component.html', styleUrls: ['./modal-form-fornecedor.component.scss'], standalone: false })
export class ModalFormFornecedorComponent implements OnInit {
  formFornecedor!: FormGroup;
  isEditMode = false;
  isSaving = false;
  errorMessage = '';
  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<ModalFormFornecedorComponent, boolean>, private fornecedoresService: FornecedoresService,
    private snackBar: MatSnackBar, @Inject(MAT_DIALOG_DATA) public data: FornecedorFormDialogData) {}

  ngOnInit(): void {
    this.formFornecedor = this.fb.group({
      corporate: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
      fantasyName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      cnpj: ['', [Validators.required, Validators.pattern(/^(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      phone: ['', [Validators.required, Validators.pattern(/^(\d{10,11}|\(\d{2}\)\s?\d{4,5}-\d{4})$/)]],
      salesRep: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      observations: ['', Validators.maxLength(500)],
    });
    if (this.data.fornecedor) { this.isEditMode = true; this.formFornecedor.patchValue(this.data.fornecedor); }
  }

  closeModal(): void { if (!this.isSaving) this.dialogRef.close(false); }
  async saveFornecedor(): Promise<void> {
    this.errorMessage = '';
    if (this.formFornecedor.invalid || this.isSaving || !this.data.empresaId) { this.formFornecedor.markAllAsTouched(); return; }
    this.isSaving = true;
    const raw = this.formFornecedor.getRawValue();
    const payload: Omit<Fornecedor, 'id'> = { corporate: raw.corporate.trim(), fantasyName: raw.fantasyName.trim(), cnpj: raw.cnpj.replace(/\D/g, ''),
      email: raw.email.trim().toLowerCase(), phone: raw.phone.replace(/\D/g, ''), salesRep: raw.salesRep.trim(), observations: raw.observations.trim() };
    try {
      if (this.isEditMode) { if (!this.data.fornecedor?.id) throw new Error('Identificador do fornecedor não encontrado.'); await this.fornecedoresService.updateFornecedor(this.data.empresaId, this.data.fornecedor.id, payload); }
      else { await this.fornecedoresService.addFornecedor(this.data.empresaId, payload); }
      this.snackBar.open(`Fornecedor ${this.isEditMode ? 'atualizado' : 'cadastrado'} com sucesso.`, 'Fechar', { duration: 4000 }); this.dialogRef.close(true);
    } catch (error: unknown) { console.error('Não foi possível salvar o fornecedor.', error); this.errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar o fornecedor.'; }
    finally { this.isSaving = false; }
  }
}
