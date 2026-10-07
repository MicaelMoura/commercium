import { configurarTabela } from '../../components/management-table';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { Empresas } from '../../interfaces/empresas';
import { AuthService } from '../../services/auth.services';
import { EmpresasService } from '../../services/empresas.service';
import { ModalEmpresasFormComponent } from './modal-form-empresas/modal-form-empresas.component';
import { ModalViewEmpresasComponent } from './modal-view-empresas/modal-view-empresas.component';

@Component({ selector: 'app-empresas', templateUrl: './empresas.component.html', styleUrls: ['./empresas.component.scss'], standalone: false })
export class EmpresasComponent implements OnInit, AfterViewInit {
  readonly displayedColumns = ['name', 'cnpj', 'action'];
  readonly dataSource = new MatTableDataSource<Empresas>([]);
  readonly empresaIdAtual = this.authService.activeTenantId;
  isLoading = true;
  errorMessage = '';
  filterValue = '';
  deletingId: string | null = null;
  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginatorView(value: MatPaginator) { this.paginator = value; this.dataSource.paginator = value; }
  sort!: MatSort;
  @ViewChild(MatSort) set sortView(value: MatSort) { this.sort = value; this.dataSource.sort = value; }

  constructor(public dialog: MatDialog, private empresasService: EmpresasService, private authService: AuthService,
    private snackBar: MatSnackBar, paginatorIntl: MatPaginatorIntl, private destroyRef: DestroyRef) {
    paginatorIntl.itemsPerPageLabel = 'Itens por página';
  }

  ngOnInit(): void {
    configurarTabela(this.dataSource, { name: 'nomeFantasia' });
    this.empresasService.getEmpresas().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (companies) => { this.dataSource.data = companies; this.isLoading = false; },
      error: (error: unknown) => {
        console.error('Não foi possível carregar as empresas.', error);
        this.errorMessage = 'Não foi possível carregar as empresas. Tente novamente.';
        this.isLoading = false;
      },
    });
  }

  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }

  applyFilter(event: Event): void {
    this.filterValue = (event.target as HTMLInputElement).value.trim();
    this.dataSource.filter = this.filterValue.toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  openCompanyFormModal(company: Empresas | null = null): void {
    this.dialog.open(ModalEmpresasFormComponent, { width: 'min(94vw, 900px)', maxHeight: '90vh', data: company });
  }

  openModalViewCompany(company: Empresas): void {
    this.dialog.open(ModalViewEmpresasComponent, { width: 'min(94vw, 900px)', maxHeight: '90vh', data: company });
  }

  deleteCompany(company: Empresas): void {
    if (!company.firebaseId || this.deletingId || company.firebaseId === this.empresaIdAtual()) return;
    this.dialog.open(ConfirmationDialogComponent, {
      width: 'min(92vw, 440px)',
      data: { title: 'Excluir empresa', message: `Deseja excluir a empresa ${company.nomeFantasia}? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir empresa', destructive: true },
    }).afterClosed().subscribe((confirmed: boolean) => { if (confirmed) void this.removeCompany(company); });
  }

  private async removeCompany(company: Empresas): Promise<void> {
    this.deletingId = company.firebaseId;
    try {
      await this.empresasService.deleteEmpresa(company.firebaseId);
      this.snackBar.open('Empresa excluída com sucesso.', 'Fechar', { duration: 4000 });
    } catch (error: unknown) {
      console.error('Não foi possível excluir a empresa.', error);
      this.snackBar.open('Não foi possível excluir a empresa.', 'Fechar', { duration: 6000 });
    } finally { this.deletingId = null; }
  }
}
