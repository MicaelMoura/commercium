import { Component, Inject } from '@angular/core';
import { Empresas } from '../../../interfaces/empresas';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-modal-view-empresas',
    templateUrl: './modal-view-empresas.component.html',
    styleUrl: './modal-view-empresas.component.scss',
    standalone: false
})
export class ModalViewEmpresasComponent {
  
  empresas: Empresas;

  constructor(
    public dialogRef: MatDialogRef<ModalViewEmpresasComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Empresas
  ) {
    this.empresas = data;
  }

  closeModal(): void {
    this.dialogRef.close();
  }
}
