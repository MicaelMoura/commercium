import { configurarTabela } from '../../components/management-table';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Timestamp } from 'firebase/firestore';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { CashFlow } from '../../interfaces/cashflow';
import { FechamentoCaixa } from '../../interfaces/fechamento-caixa';
import { AuthService } from '../../services/auth.services';
import { CashFlowService } from '../../services/cashflow.service';
import { ModalAberturaCaixaComponent } from './abertura-caixa/modal-abertura-caixa.component';
import { ModalEntradaComponent } from './entradas/modal-entrada.component';
import { ModalFechamentoCaixaComponent } from './fechamento-caixa/modal-fechamento-caixa.component';
import { ModalSaidaComponent } from './saidas/modal-saida.component';

@Component({ selector: 'app-caixa', templateUrl: './cashier.component.html', styleUrls: ['./cashier.component.scss'], standalone: false })
export class CashierComponent implements OnInit, AfterViewInit {
  readonly caixaStatus = signal<'ABERTO' | 'FECHADO'>('FECHADO');
  readonly lastFechamento = signal<FechamentoCaixa | null>(null);
  readonly displayedColumns = ['data', 'tipo', 'descricao', 'valor', 'action'];
  readonly dataSource = new MatTableDataSource<CashFlow>([]);
  readonly empresaIdAtual = this.authService.activeTenantId;
  isLoading = true;
  errorMessage = '';
  filterValue = '';
  saldoAtual = 0;
  deletingId: string | null = null;
  changingStatus = false;
  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginatorView(value: MatPaginator) { this.paginator = value; this.dataSource.paginator = value; }
  sort!: MatSort;
  @ViewChild(MatSort) set sortView(value: MatSort) { this.sort = value; this.dataSource.sort = value; }

  constructor(public dialog: MatDialog, private cashFlowService: CashFlowService, private authService: AuthService,
    private snackBar: MatSnackBar, paginatorIntl: MatPaginatorIntl, private destroyRef: DestroyRef) {
    paginatorIntl.itemsPerPageLabel = 'Itens por página';
  }

  ngOnInit(): void {
    configurarTabela(this.dataSource, { data: 'dataMovimento' });
    const empresaId = this.empresaIdAtual();
    if (!empresaId) { this.isLoading = false; this.errorMessage = 'Nenhuma empresa ativa foi encontrada.'; return; }
    this.cashFlowService.getAllCashFlow(empresaId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.dataSource.data = items.map((item) => ({ ...item, dataMovimento: item.dataMovimento instanceof Timestamp ? item.dataMovimento.toDate() : item.dataMovimento }));
        this.saldoAtual = this.dataSource.data.reduce((balance, item) => balance + (item.tipo === 'ENTRADA' ? item.valor : -item.valor), 0);
        this.isLoading = false;
      },
      error: (error: unknown) => { console.error('Não foi possível carregar o caixa.', error); this.errorMessage = 'Não foi possível carregar as movimentações. Tente novamente.'; this.isLoading = false; },
    });
    void this.checkCaixaStatus();
  }

  ngAfterViewInit(): void { this.dataSource.paginator = this.paginator; this.dataSource.sort = this.sort; }

  async checkCaixaStatus(): Promise<void> {
    const empresaId = this.empresaIdAtual();
    if (!empresaId) return;
    try { const last = await this.cashFlowService.getLastFechamento(empresaId); this.lastFechamento.set(last); this.caixaStatus.set(last?.status === 'ABERTO' ? 'ABERTO' : 'FECHADO'); }
    catch (error: unknown) { console.error('Não foi possível verificar o status do caixa.', error); this.snackBar.open('Não foi possível verificar o status do caixa.', 'Fechar', { duration: 5000 }); }
  }

  abrirCaixa(): void {
    if (this.changingStatus) return;
    const empresaId = this.empresaIdAtual(); const operadorUid = this.authService.userUid();
    if (!empresaId || !operadorUid) { this.snackBar.open('Empresa ou operador não identificado.', 'Fechar', { duration: 5000 }); return; }
    this.dialog.open(ModalAberturaCaixaComponent, { width: 'min(92vw, 440px)', disableClose: true }).afterClosed().subscribe((trocoInicial: number | null) => {
      if (trocoInicial !== null && trocoInicial !== undefined) void this.confirmarAbertura(empresaId, operadorUid, trocoInicial);
    });
  }

  private async confirmarAbertura(empresaId: string, operadorUid: string, trocoInicial: number): Promise<void> {
    this.changingStatus = true;
    try {
      const latest = await this.cashFlowService.getLastFechamento(empresaId);
      if (latest?.status === 'ABERTO') { this.lastFechamento.set(latest); this.caixaStatus.set('ABERTO'); this.snackBar.open('Já existe um caixa aberto para esta empresa.', 'Fechar', { duration: 5000 }); return; }
      const now = new Date();
      const opening: FechamentoCaixa = { empresaId, operadorUid, dataAbertura: now, dataFechamento: now, status: 'ABERTO', valorInicialTroco: trocoInicial,
        totalSuprimentos: 0, totalSangrias: 0, totalVendasDinheiro: 0, totalVendasCartaoDebito: 0, totalVendasCartaoCredito: 0, totalVendasPix: 0,
        totalOutrasEntradas: 0, totalEntradasLiquidas: 0, totalEsperado: trocoInicial, valorContado: 0, diferenca: 0 };
      await this.cashFlowService.saveFechamento(empresaId, opening);
      this.snackBar.open(`Caixa aberto com ${trocoInicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de troco.`, 'Fechar', { duration: 4000 });
      await this.checkCaixaStatus();
    } catch (error: unknown) { console.error('Não foi possível abrir o caixa.', error); this.snackBar.open('Não foi possível abrir o caixa.', 'Fechar', { duration: 5000 }); }
    finally { this.changingStatus = false; }
  }

  openFechamentoModal(): void {
    const empresaId = this.empresaIdAtual(); const opening = this.lastFechamento();
    if (!empresaId || !opening || this.caixaStatus() !== 'ABERTO' || this.changingStatus) return;
    this.dialog.open(ModalFechamentoCaixaComponent, { width: 'min(92vw, 560px)', maxHeight: '90vh', disableClose: true,
      data: { empresaId, dataAbertura: opening.dataAbertura, valorTrocoInicial: opening.valorInicialTroco } })
      .afterClosed().subscribe((result: { fechamentoConcluido?: boolean } | undefined) => { if (result?.fechamentoConcluido) void this.checkCaixaStatus(); });
  }

  openModalEntrada(cashFlow: CashFlow | null = null): void { if (this.caixaStatus() === 'ABERTO') this.dialog.open(ModalEntradaComponent, { width: 'min(92vw, 620px)', maxHeight: '90vh', data: { cashFlow, empresaId: this.empresaIdAtual() } }); }
  openModalSaida(cashFlow: CashFlow | null = null): void { if (this.caixaStatus() === 'ABERTO') this.dialog.open(ModalSaidaComponent, { width: 'min(92vw, 620px)', maxHeight: '90vh', data: { cashFlow, empresaId: this.empresaIdAtual() } }); }

  deleteCashFlow(item: CashFlow): void {
    if (!item.id || item.vendaId || this.deletingId || this.caixaStatus() !== 'ABERTO') return;
    this.dialog.open(ConfirmationDialogComponent, { width: 'min(92vw, 440px)', data: { title: 'Excluir movimentação', message: `Deseja excluir a movimentação “${item.descricao}”?`, confirmLabel: 'Excluir movimentação', destructive: true } })
      .afterClosed().subscribe((confirmed: boolean) => { if (confirmed) void this.removeCashFlow(item); });
  }

  private async removeCashFlow(item: CashFlow): Promise<void> {
    const empresaId = this.empresaIdAtual(); if (!empresaId || !item.id) return;
    this.deletingId = item.id;
    try { await this.cashFlowService.deleteCashFlow(empresaId, item.id); this.snackBar.open('Movimentação excluída com sucesso.', 'Fechar', { duration: 4000 }); }
    catch (error: unknown) { console.error('Não foi possível excluir a movimentação.', error); this.snackBar.open('Não foi possível excluir a movimentação.', 'Fechar', { duration: 5000 }); }
    finally { this.deletingId = null; }
  }

  applyFilter(event: Event): void { this.filterValue = (event.target as HTMLInputElement).value.trim(); this.dataSource.filter = this.filterValue.toLowerCase(); this.dataSource.paginator?.firstPage(); }
}
