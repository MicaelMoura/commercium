import { configurarTabela } from '../../components/management-table';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Timestamp } from 'firebase/firestore';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { Stock } from '../../interfaces/stock';
import { AuthService } from '../../services/auth.services';
import { StockService } from '../../services/stock.service';
import { ModalFormStockComponent } from './modal-cadastro/modal-form-stock.component';
import { ModalViewStockComponent } from './modal-view/modal-view-stock.component';

@Component({ selector: 'app-stock', templateUrl: './stock.component.html', styleUrl: './stock.component.scss', standalone: false })
export class StockComponent implements OnInit, AfterViewInit {
  readonly displayedColumns = ['produto', 'fornecedor', 'quantidade', 'validade', 'tipoMovimento', 'dataMovimento', 'action'];
  readonly dataSource = new MatTableDataSource<Stock>([]);
  readonly empresaIdAtual = this.authService.activeTenantId;
  isLoading = true;
  errorMessage = '';
  filterValue = '';
  deletingId: string | null = null;
  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginatorView(value: MatPaginator) { this.paginator = value; this.dataSource.paginator = value; }
  sort!: MatSort;
  @ViewChild(MatSort) set sortView(value: MatSort) { this.sort = value; this.dataSource.sort = value; }

  constructor(public dialog: MatDialog, private stockService: StockService, private authService: AuthService,
    private snackBar: MatSnackBar, paginatorIntl: MatPaginatorIntl, private destroyRef: DestroyRef) {
    paginatorIntl.itemsPerPageLabel = 'Itens por página';
  }

  ngOnInit(): void {
    configurarTabela(this.dataSource, { produto: 'produtoNome', fornecedor: 'fornecedorNome' });
    const empresaId = this.empresaIdAtual();
    if (!empresaId) { this.isLoading = false; this.errorMessage = 'Nenhuma empresa ativa foi encontrada.'; return; }
    this.stockService.getAllStockEntries(empresaId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (entries) => { this.dataSource.data = entries.map((entry) => ({ ...entry, dataMovimento: entry.dataMovimento instanceof Timestamp ? entry.dataMovimento.toDate() : entry.dataMovimento })); this.isLoading = false; },
      error: (error: unknown) => { console.error('Não foi possível carregar o estoque.', error); this.errorMessage = 'Não foi possível carregar o estoque. Tente novamente.'; this.isLoading = false; },
    });
  }

  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }
  applyFilter(event: Event): void { this.filterValue = (event.target as HTMLInputElement).value.trim(); this.dataSource.filter = this.filterValue.toLowerCase(); this.dataSource.paginator?.firstPage(); }

  openStockFormModal(stockEntry: Stock | null = null): void {
    const empresaId = this.empresaIdAtual();
    if (!empresaId) { this.snackBar.open('Nenhuma empresa ativa foi encontrada.', 'Fechar', { duration: 5000 }); return; }
    this.dialog.open(ModalFormStockComponent, { width: 'min(94vw, 900px)', maxHeight: '90vh', data: { stockEntry, empresaId } });
  }

  openModalViewStock(stock: Stock): void { this.dialog.open(ModalViewStockComponent, { width: 'min(94vw, 850px)', maxHeight: '90vh', data: stock }); }
  deleteStock(stock: Stock): void {
    if (!stock.id || this.deletingId) return;
    this.dialog.open(ConfirmationDialogComponent, { width: 'min(92vw, 440px)', data: { title: 'Excluir movimentação', message: `Deseja excluir a movimentação de ${stock.produtoNome}? Esta ação altera o histórico de estoque.`, confirmLabel: 'Excluir movimentação', destructive: true } })
      .afterClosed().subscribe((confirmed: boolean) => { if (confirmed) void this.removeStock(stock); });
  }

  private async removeStock(stock: Stock): Promise<void> {
    const empresaId = this.empresaIdAtual();
    if (!empresaId || !stock.id) return;
    this.deletingId = stock.id;
    try { await this.stockService.deleteStockEntry(empresaId, stock.id); this.snackBar.open('Movimentação excluída com sucesso.', 'Fechar', { duration: 4000 }); }
    catch (error: unknown) { console.error('Não foi possível excluir a movimentação.', error); this.snackBar.open('Não foi possível excluir a movimentação.', 'Fechar', { duration: 6000 }); }
    finally { this.deletingId = null; }
  }
}
