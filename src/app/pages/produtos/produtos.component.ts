import { configurarTabela } from '../../components/management-table';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { combineLatest } from 'rxjs';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { Produto } from '../../interfaces/produto';
import { AuthService } from '../../services/auth.services';
import { PlataformService } from '../../services/plataform.service';
import { ProdutosService } from '../../services/produtos.service';
import { ModalFormProdutoComponent } from './modal-form/modal-form-produto.component';
import { ModalViewProdutoComponent } from './modal-view/modal-view-produto.component';

@Component({ selector: 'app-produtos', templateUrl: './produtos.component.html', styleUrl: './produtos.component.scss', standalone: false })
export class ProdutosComponent implements OnInit, AfterViewInit {
  readonly displayedColumns = ['nome', 'marca', 'unidadeMedida', 'venda', 'action'];
  readonly dataSource = new MatTableDataSource<Produto>([]);
  readonly empresaIdAtual = this.authService.activeTenantId;
  isLoading = true;
  errorMessage = '';
  filterValue = '';
  deletingId: string | null = null;
  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginatorView(value: MatPaginator) { this.paginator = value; this.dataSource.paginator = value; }
  sort!: MatSort;
  @ViewChild(MatSort) set sortView(value: MatSort) { this.sort = value; this.dataSource.sort = value; }

  constructor(public dialog: MatDialog, private produtosService: ProdutosService, private plataformService: PlataformService,
    private authService: AuthService, private snackBar: MatSnackBar, paginatorIntl: MatPaginatorIntl, private destroyRef: DestroyRef) {
    paginatorIntl.itemsPerPageLabel = 'Itens por página';
  }

  ngOnInit(): void {
    configurarTabela(this.dataSource, { venda: 'valorUnitarioVenda', unidadeMedida: 'nomeUnidadeMedida' });
    const empresaId = this.empresaIdAtual();
    if (!empresaId) { this.isLoading = false; this.errorMessage = 'Nenhuma empresa ativa foi encontrada.'; return; }
    combineLatest([this.produtosService.getAllProdutos(empresaId), this.plataformService.getUnits()])
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ([products, units]) => {
          const unitNames = new Map(units.map((unit) => [unit.id, unit.name]));
          this.dataSource.data = products.map((product) => ({ ...product, nomeUnidadeMedida: unitNames.get(product.unidadeDeMedida) ?? product.unidadeDeMedida }));
          this.isLoading = false;
        },
        error: (error: unknown) => { console.error('Não foi possível carregar os produtos.', error); this.errorMessage = 'Não foi possível carregar os produtos. Tente novamente.'; this.isLoading = false; },
      });
  }

  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }
  applyFilter(event: Event): void { this.filterValue = (event.target as HTMLInputElement).value.trim(); this.dataSource.filter = this.filterValue.toLowerCase(); this.dataSource.paginator?.firstPage(); }
  openModalViewProduto(produto: Produto): void { this.dialog.open(ModalViewProdutoComponent, { width: 'min(94vw, 980px)', maxHeight: '90vh', data: produto }); }

  openModalFormProduto(produto: Produto | null = null): void {
    const empresaId = this.empresaIdAtual();
    if (!empresaId) { this.snackBar.open('Nenhuma empresa ativa foi encontrada.', 'Fechar', { duration: 5000 }); return; }
    this.dialog.open(ModalFormProdutoComponent, { width: 'min(94vw, 1000px)', maxHeight: '90vh', data: { produto, empresaId } });
  }

  deleteProduto(produto: Produto): void {
    if (!produto.firebaseId || this.deletingId) return;
    this.dialog.open(ConfirmationDialogComponent, { width: 'min(92vw, 440px)', data: { title: 'Excluir produto', message: `Deseja excluir o produto ${produto.nome}?`, confirmLabel: 'Excluir produto', destructive: true } })
      .afterClosed().subscribe((confirmed: boolean) => { if (confirmed) void this.removeProduto(produto); });
  }

  private async removeProduto(produto: Produto): Promise<void> {
    const empresaId = this.empresaIdAtual();
    if (!empresaId || !produto.firebaseId) return;
    this.deletingId = produto.firebaseId;
    try { await this.produtosService.deleteProduto(empresaId, produto.firebaseId); this.snackBar.open('Produto excluído com sucesso.', 'Fechar', { duration: 4000 }); }
    catch (error: unknown) { console.error('Não foi possível excluir o produto.', error); this.snackBar.open('Não foi possível excluir o produto. Verifique se há estoque vinculado.', 'Fechar', { duration: 6000 }); }
    finally { this.deletingId = null; }
  }
}
