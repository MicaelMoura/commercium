import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormBuilder, FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ItemVenda, ResultadoPagamento, VendaInput } from '../../interfaces/sales';
import { ProdutosService } from '../../services/produtos.service';
import { AuthService } from '../../services/auth.services';
import { VendasService } from '../../services/sales.service';
import { CashFlowService } from '../../services/cashflow.service';
import { MatDialog } from '@angular/material/dialog';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { SalesModalComponent, arredondar } from './sales-modal-finalizar-venda/sales-modal-finalizar.component';
import { catchError, debounceTime, distinctUntilChanged, firstValueFrom, Observable, of, shareReplay, switchMap } from 'rxjs';
import { Produto } from '../../interfaces/produto';
import { StockService } from '../../services/stock.service';
import { SalesModalCupomComponent } from './sales-modal-cupom/sales-modal-cupom.component';
import { UsersService } from '../../services/users.service';
import { ModalViewProdutoComponent } from '../produtos/modal-view/modal-view-produto.component';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { PerifericosService } from '../../services/perifericos.service';
import { PwaService } from '../../services/pwa.service';

@Component({ selector: 'app-sales', templateUrl: './sales.component.html', styleUrls: ['./sales.component.scss'], standalone: false })
export class SalesComponent implements OnInit {
  @ViewChild('productSearch') productSearch?: ElementRef<HTMLInputElement>;
  @ViewChild(MatAutocompleteTrigger) autocompleteTrigger?: MatAutocompleteTrigger;
  searchControl = new FormControl<string | Produto>('');
  produtosFiltrados$: Observable<Produto[]>;
  produtosRecentes = signal<Produto[]>([]);
  historicoLeituras = signal<Produto[]>([]);
  painelHistorico = signal<'recentes' | 'historico' | null>(null);
  modoPesquisa = signal<'venda' | 'consulta'>('venda');
  idVenda = signal<string>(crypto.randomUUID());
  inicioVenda = signal(new Date());
  itensVenda = signal<ItemVenda[]>([]);
  carregando = signal(false);
  erroBusca = signal('');
  pendente = signal<VendaInput | null>(null);
  usarPeso = signal(false);
  nomeEmpresa = '';
  enderecoEmpresa = '';
  nomeOperador = 'Operador autenticado';
  textoDigitadoBusca = '';
  totalVenda = computed(() => arredondar(this.itensVenda().reduce((acc, item) => acc + item.subtotal, 0)));
  private modalAberto = false;
  constructor(
    _fb: FormBuilder, private snackBar: MatSnackBar, private produtosService: ProdutosService,
    private authService: AuthService, private vendasService: VendasService, _cashFlowService: CashFlowService,
    private dialog: MatDialog, _estoqueService: StockService, private usersService: UsersService,
    public devices: PerifericosService, public pwa: PwaService,
  ) {
    this.produtosFiltrados$ = this.searchControl.valueChanges.pipe(debounceTime(220), distinctUntilChanged(), switchMap(value => {
      this.erroBusca.set('');
      if (typeof value !== 'string') return of([]);
      const termo = this.extrairTermoEQuantidade(value).termo;
      return termo.length >= 2 ? this.produtosService.buscarProdutosComEstoque(termo).pipe(catchError(() => {
        this.erroBusca.set('Não foi possível buscar produtos. Verifique a conexão e tente novamente.'); return of([]);
      })) : of([]);
    }), shareReplay({ bufferSize: 1, refCount: true }));
  }
  async ngOnInit(): Promise<void> {
    const empresaId = this.authService.activeTenantId(); const uid = this.authService.userUid();
    if (!empresaId || !uid) return;
    const pending = this.vendasService.recuperar(empresaId);
    if (pending) { this.pendente.set(pending); this.idVenda.set(pending.vendaId); }
    this.nomeEmpresa = empresaId;
    try {
      const [operador, empresa] = await Promise.all([this.usersService.getUserById(empresaId, uid), this.vendasService.empresa(empresaId)]);
      this.nomeOperador = operador?.nome || this.nomeOperador; this.nomeEmpresa = empresa.nome; this.enderecoEmpresa = empresa.endereco;
    } catch { this.snackBar.open('Não foi possível carregar todos os dados do estabelecimento.', 'Fechar', { duration: 4000 }); }
  }
  @HostListener('window:keydown', ['$event']) handleGlobalKeyDown(event: KeyboardEvent): void {
    if (this.modalAberto || this.dialog.openDialogs?.length || this.carregando()) return;
    if (event.key === 'F2') { event.preventDefault(); void this.exibirPagamentoModal(); }
    else if (event.key === 'F3') { event.preventDefault(); void this.limparVenda(); }
    else if (event.key === 'F4') { event.preventDefault(); this.productSearch?.nativeElement.focus(); }
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void { if (this.itensVenda().length || this.pendente()) event.preventDefault(); }
  async exibirPagamentoModal(): Promise<void> {
    if (this.carregando() || this.modalAberto || !this.pwa.online()) return;
    if (this.pendente()) { await this.finalizarVenda(); return; }
    if (!this.itensVenda().length) { this.snackBar.open('Adicione ao menos um produto.', 'Fechar', { duration: 3000 }); return; }
    this.modalAberto = true;
    try {
      const result = await firstValueFrom(this.dialog.open<SalesModalComponent, { total: number }, ResultadoPagamento>(SalesModalComponent, {
        width: '480px', maxWidth: '95vw', data: { total: this.totalVenda() },
      }).afterClosed());
      if (!result) return;
      this.pendente.set({ vendaId: this.idVenda(), itens: this.itensVenda().map(i => ({ produtoId: i.produtoId, quantidade: i.quantidade })), total: this.totalVenda(), pagamentos: result.pagamentos });
      await this.finalizarVenda();
    } finally { this.modalAberto = false; }
  }
  async finalizarVenda(): Promise<void> {
    const empresaId = this.authService.activeTenantId(); const pending = this.pendente();
    if (!empresaId || !pending || this.carregando()) return;
    this.carregando.set(true);
    try {
      const result = await this.vendasService.concluir(empresaId, pending);
      const itens = this.itensVenda();
      this.pendente.set(null); this.limparPDV();
      if (itens.length) this.dialog.open(SalesModalCupomComponent, { width: '380px', maxWidth: '95vw', data: {
        empresaNome: this.nomeEmpresa, empresaEndereco: this.enderecoEmpresa, operadorNome: this.nomeOperador, itens, valorTotal: result.total,
        pagamentos: pending.pagamentos, troco: result.troco, dataHora: new Date(), vendaId: result.vendaId,
      } });
      this.snackBar.open('Venda registrada com sucesso. Estoque e caixa atualizados.', 'Fechar', { duration: 4500 });
    } catch (error: unknown) {
      if (!this.vendasService.recuperar(empresaId)) this.pendente.set(null);
      this.snackBar.open(error instanceof Error ? error.message : 'Confirmação pendente. Verifique a mesma venda para evitar duplicidade.', 'Fechar', { duration: 7000 });
    } finally { this.carregando.set(false); }
  }
  limparPDV(): void { this.itensVenda.set([]); this.searchControl.setValue(''); this.idVenda.set(crypto.randomUUID()); this.inicioVenda.set(new Date()); }
  async limparVenda(): Promise<void> {
    if (this.carregando() || this.pendente() || !this.itensVenda().length) return;
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmationDialogComponent, { width: '420px', maxWidth: '94vw', data: {
      title: 'Limpar venda?', message: 'Os itens desta venda serão removidos do carrinho.', confirmLabel: 'Limpar venda', destructive: true,
    } }).afterClosed());
    if (confirmed) this.limparPDV();
  }
  selecionarModoPesquisa(modo: 'venda' | 'consulta'): void { this.modoPesquisa.set(modo); this.painelHistorico.set(null); this.productSearch?.nativeElement.focus(); }
  mostrarUltimosItens(): void { this.painelHistorico.set('recentes'); }
  mostrarHistorico(): void { this.painelHistorico.set('historico'); }
  fecharHistorico(): void { this.painelHistorico.set(null); }
  async processarBuscaAtual(): Promise<void> {
    if (this.autocompleteTrigger?.panelOpen && this.autocompleteTrigger.activeOption) return;
    const value = this.searchControl.value;
    if (typeof value !== 'string' || !value.trim() || this.carregando() || this.pendente()) return;
    const { termo, quantidade } = this.extrairTermoEQuantidade(this.devices.leitor.normalizar(value));
    this.carregando.set(true);
    try {
      if (/^\d+$/.test(termo)) {
        const found = await this.processarCodigoBarras(termo);
        if (!found?.produto) { this.snackBar.open('Produto não encontrado.', 'Fechar', { duration: 3000 }); return; }
        this.executarAcaoProduto(found.produto, found.quantidade * quantidade, found.balanca);
      } else {
        const produtos = await firstValueFrom(this.produtosService.buscarProdutosComEstoque(termo));
        if (produtos.length === 1) this.executarAcaoProduto(produtos[0], quantidade);
        else this.snackBar.open(produtos.length ? 'Selecione o produto desejado na lista.' : 'Produto não encontrado.', 'Fechar', { duration: 3000 });
      }
    } catch (error: unknown) { this.snackBar.open(error instanceof Error ? error.message : 'Não foi possível consultar o produto.', 'Fechar', { duration: 4000 }); }
    finally { this.carregando.set(false); }
  }
  validarCodigoDeBarras(codigo: string): boolean {
    if (!/^\d+$/.test(codigo) || ![8, 12, 13, 14].includes(codigo.length)) return false;
    const sum = codigo.slice(0, -1).split('').reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
    return (10 - sum % 10) % 10 === Number(codigo.at(-1));
  }
  async processarCodigoBarras(codigo: string): Promise<{ produto: Produto | null; quantidade: number; balanca: boolean } | null> {
    const tenant = this.authService.activeTenantId(); if (!tenant) return null;
    if (!this.validarCodigoDeBarras(codigo)) throw new Error('Código de barras inválido. Confira a leitura.');
    if (codigo.startsWith('2') && codigo.length === 13) {
      const base = codigo.substring(1, 6).replace(/^0+/, '') || '0';
      const produto = await this.produtosService.getProdutoByBarcode(tenant, base);
      const raw = Number(codigo.substring(7, 12));
      const quantidade = produto?.pesoNoCodigo ? raw / 1000 : raw / 100 / (produto?.valorUnitarioVenda || 1);
      return { produto, quantidade: Math.round(quantidade * 1000) / 1000, balanca: true };
    }
    return { produto: await this.produtosService.getProdutoByBarcode(tenant, codigo), quantidade: 1, balanca: false };
  }
  removerItem(index: number): void { if (!this.carregando() && !this.pendente()) this.itensVenda.update(itens => itens.filter((_, i) => i !== index)); }
  onProdutoSelecionado(produto: Produto): void {
    if (this.carregando() || this.pendente()) return;
    try { this.executarAcaoProduto(produto, this.extrairTermoEQuantidade(this.textoDigitadoBusca).quantidade); }
    catch (error: unknown) { this.snackBar.open(error instanceof Error ? error.message : 'Não foi possível adicionar.', 'Fechar', { duration: 4000 }); }
  }
  private executarAcaoProduto(produto: Produto, quantidade: number, etiqueta = false): void {
    if (this.modoPesquisa() === 'consulta') this.dialog.open(ModalViewProdutoComponent, { data: produto, width: '620px', maxWidth: '94vw' });
    else {
      if (this.usarPeso() && !etiqueta) {
        if (!/^(kg|quilograma|quilogramas)$/i.test(produto.nomeUnidadeMedida ?? produto.unidadeDeMedida)) throw new Error('Selecione um produto cadastrado em quilogramas para usar a balança.');
        quantidade = this.devices.pesoAtual();
      }
      this.adicionarItemAoCupom(produto, quantidade);
    }
    this.searchControl.setValue(''); this.textoDigitadoBusca = ''; this.productSearch?.nativeElement.focus();
  }
  private adicionarItemAoCupom(produto: Produto, quantidade: number): void {
    if (!produto.firebaseId || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 99999 || !Number.isFinite(produto.valorUnitarioVenda) || produto.valorUnitarioVenda <= 0) throw new Error('Confira preço e quantidade do produto.');
    const atual = this.itensVenda().find(i => i.produtoId === produto.firebaseId);
    const qtd = Math.round(((atual?.quantidade ?? 0) + quantidade) * 1000) / 1000;
    if (produto.estoqueQtd !== undefined && qtd > produto.estoqueQtd) throw new Error('Quantidade superior ao estoque disponível.');
    const item: ItemVenda = { produtoId: produto.firebaseId, descricao: produto.nome, codigoBarras: produto.codigoDeBarras, quantidade: qtd, valorUnitario: produto.valorUnitarioVenda, subtotal: arredondar(produto.valorUnitarioVenda * qtd) };
    this.itensVenda.update(itens => atual ? itens.map(i => i.produtoId === item.produtoId ? item : i) : [item, ...itens]);
    this.historicoLeituras.update(produtos => [produto, ...produtos].slice(0, 100));
    this.produtosRecentes.update(produtos => [produto, ...produtos.filter(p => p.firebaseId !== produto.firebaseId)].slice(0, 4));
  }
  private extrairTermoEQuantidade(value: string): { termo: string; quantidade: number } {
    const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*[xX]\s*(.+)$/);
    return match ? { quantidade: Number(match[1].replace(',', '.')), termo: match[2].trim() } : { termo: value.trim(), quantidade: 1 };
  }
}
