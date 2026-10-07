import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EmpresasService } from '../../../services/empresas.service';
import {
  EmpresaPersistidaInput,
  EmpresaProvisionamentoInput,
  Empresas,
} from '../../../interfaces/empresas';

export interface EmpresaDialogResult {
  changed: boolean;
  empresaId?: string;
}

@Component({
    selector: 'app-companies-form',
    templateUrl: './modal-form-empresas.component.html',
    styleUrls: ['./modal-form-empresas.component.scss'],
    standalone: false
})
export class ModalEmpresasFormComponent implements OnInit {
  formCompany!: FormGroup;
  isEditMode = false;
  isSaving = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ModalEmpresasFormComponent, EmpresaDialogResult>,
    private empresasService: EmpresasService,
    @Inject(MAT_DIALOG_DATA) public data: Empresas | null,
  ) { }

  ngOnInit(): void {
    this.formCompany = this.fb.group({
      razaoSocial: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
      nomeFantasia: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      cnpj: ['', [Validators.required, Validators.pattern(/^(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      telefone: ['', [Validators.required, Validators.pattern(/^(\d{10,11}|\(\d{2}\)\s?\d{4,5}-\d{4})$/)]],
      endereco: ['', [Validators.required, Validators.maxLength(180)]],
      bairro: ['', [Validators.required, Validators.maxLength(100)]],
      cidade: ['', [Validators.required, Validators.maxLength(100)]],
      cep: ['', [Validators.required, Validators.pattern(/^(\d{8}|\d{5}-\d{3})$/)]],
      complemento: ['', Validators.maxLength(120)],
      emailAdmin: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      senhaAdmin: [''],
    });

    if (this.data) {
      this.isEditMode = true;
      this.formCompany.patchValue(this.data);
    } else {
      this.formCompany.controls['senhaAdmin'].setValidators([
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
      ]);
      this.formCompany.controls['senhaAdmin'].updateValueAndValidity();
    }
  }

  closeModal(): void {
    this.dialogRef.close({ changed: false });
  }

  async saveCompany(): Promise<void> {
    this.errorMessage = '';
    if (this.formCompany.invalid || this.isSaving) {
      this.formCompany.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const rawValue = this.formCompany.getRawValue() as EmpresaProvisionamentoInput;
    const { senhaAdmin, ...rawEmpresaData } = rawValue;
    const empresaData: EmpresaPersistidaInput = {
      ...rawEmpresaData,
      cnpj: rawEmpresaData.cnpj.replace(/\D/g, ''),
      telefone: rawEmpresaData.telefone.replace(/\D/g, ''),
      cep: rawEmpresaData.cep?.replace(/\D/g, ''),
      razaoSocial: rawEmpresaData.razaoSocial.trim(),
      nomeFantasia: rawEmpresaData.nomeFantasia.trim(),
      email: rawEmpresaData.email.trim().toLowerCase(),
      endereco: rawEmpresaData.endereco.trim(),
      bairro: rawEmpresaData.bairro?.trim(),
      cidade: rawEmpresaData.cidade?.trim(),
      complemento: rawEmpresaData.complemento?.trim(),
      emailAdmin: rawEmpresaData.emailAdmin.trim().toLowerCase(),
    };

    try {
      if (this.isEditMode) {
        await this.empresasService.updateEmpresa(
          this.data!.firebaseId,
          empresaData,
        );
        this.dialogRef.close({ changed: true });
      } else {
        const empresaId = await this.empresasService.addEmpresa({ ...empresaData, senhaAdmin });
        this.dialogRef.close({ changed: true, empresaId });
      }
    } catch (error: unknown) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Não foi possível salvar a empresa.';
    } finally {
      this.isSaving = false;
    }
  }
}
