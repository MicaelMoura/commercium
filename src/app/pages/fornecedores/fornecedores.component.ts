import { configurarTabela } from '../../components/management-table';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { Fornecedor } from '../../interfaces/fornecedor';
import { AuthService } from '../../services/auth.services';
import { FornecedoresService } from '../../services/fornecedores.service';
import { ModalFormFornecedorComponent } from './modal-form/modal-form-fornecedor.component';
import { ModalViewFornecedorComponent } from './modal-view/modal-view-fornecedor.component';

@Component({ selector: 'app-fornecedores', templateUrl: './fornecedores.component.html', styleUrls: ['./fornecedores.component.scss'], standalone: false })
export class FornecedoresComponent implements OnInit, AfterViewInit {
  readonly displayedColumns = ['fantasyName', 'cnpj', 'email', 'action'];
  readonly dataSource = new MatTableDataSource<Fornecedor>([]);
  readonly empresaIdAtual = this.authService.activeTenantId;
  isLoading = true;
  errorMessage = '';
  filterValue = '';
  deletingId: string | null = null;
  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginatorView(value: MatPaginator) { this.paginator = value; this.dataSource.paginator = value; }
  sort!: MatSort;
  @ViewChild(MatSort) set sortView(value: MatSort) { this.sort = value; this.dataSource.sort = value; }

  constructor(public dialog: MatDialog, private authService: AuthService, private fornecedoresService: FornecedoresService,
    private snackBar: MatSnackBar, paginatorIntl: MatPaginatorIntl, private destroyRef: DestroyRef) {
    paginatorIntl.itemsPerPageLabel = 'Itens por página';
  }

  ngOnInit(): void {
    configurarTabela(this.dataSource, {});
    const empresaId = this.empresaIdAtual();
    if (!empresaId) { this.isLoading = false; this.errorMessage = 'Nenhuma empresa ativa foi encontrada.'; return; }
    this.fornecedoresService.getAllFornecedores(empresaId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (suppliers) => { this.dataSource.data = suppliers; this.isLoading = false; },
      error: (error: unknown) => { console.error('Não foi possível carregar os fornecedores.', error); this.errorMessage = 'Não foi possível carregar os fornecedores. Tente novamente.'; this.isLoading = false; },
    });
  }

  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }
  applyFilter(event: Event): void { this.filterValue = (event.target as HTMLInputElement).value.trim(); this.dataSource.filter = this.filterValue.toLowerCase(); this.dataSource.paginator?.firstPage(); }

  openFornecedorFormModal(fornecedor: Fornecedor | null = null): void {
    const empresaId = this.empresaIdAtual();
    if (!empresaId) { this.snackBar.open('Nenhuma empresa ativa foi encontrada.', 'Fechar', { duration: 5000 }); return; }
    this.dialog.open(ModalFormFornecedorComponent, { width: 'min(94vw, 800px)', maxHeight: '90vh', data: { fornecedor, empresaId } });
  }

  openModalViewFornecedor(fornecedor: Fornecedor): void { this.dialog.open(ModalViewFornecedorComponent, { width: 'min(94vw, 760px)', maxHeight: '90vh', data: fornecedor }); }

  deleteFornecedor(fornecedor: Fornecedor): void {
    if (!fornecedor.id || this.deletingId) return;
    this.dialog.open(ConfirmationDialogComponent, { width: 'min(92vw, 440px)', data: { title: 'Excluir fornecedor', message: `Deseja excluir o fornecedor ${fornecedor.fantasyName}?`, confirmLabel: 'Excluir fornecedor', destructive: true } })
      .afterClosed().subscribe((confirmed: boolean) => { if (confirmed) void this.removeFornecedor(fornecedor); });
  }

  private async removeFornecedor(fornecedor: Fornecedor): Promise<void> {
    const empresaId = this.empresaIdAtual();
    if (!empresaId || !fornecedor.id) return;
    this.deletingId = fornecedor.id;
    try { await this.fornecedoresService.deleteFornecedor(empresaId, fornecedor.id); this.snackBar.open('Fornecedor excluído com sucesso.', 'Fechar', { duration: 4000 }); }
    catch (error: unknown) { console.error('Não foi possível excluir o fornecedor.', error); this.snackBar.open('Não foi possível excluir o fornecedor.', 'Fechar', { duration: 6000 }); }
    finally { this.deletingId = null; }
  }
}
