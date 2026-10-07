import { Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { combineLatest, firstValueFrom, Subscription } from 'rxjs';
import { Comanda, ElementoSalao, Mesa, Salao, SALAO_VAZIO } from '../../interfaces/comanda';
import { Produto } from '../../interfaces/produto';
import { ResultadoPagamento, VendaInput } from '../../interfaces/sales';
import { ComandasService } from '../../services/comandas.service';
import { AuthService } from '../../services/auth.services';
import { ProdutosService } from '../../services/produtos.service';
import { VendasService } from '../../services/sales.service';
import { PwaService } from '../../services/pwa.service';
import { SalesModalComponent } from '../sales/sales-modal-finalizar-venda/sales-modal-finalizar.component';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';

@Component({ selector: 'app-comandas', templateUrl: './comandas.component.html', styleUrl: './comandas.component.scss', standalone: false })
export class ComandasComponent implements OnInit {
  private readonly service = inject(ComandasService);
  private readonly products = inject(ProdutosService);
  private readonly sales = inject(VendasService);
  private readonly destroy = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly pwa = inject(PwaService);
  readonly salao = signal<Salao>(SALAO_VAZIO);
  readonly comandas = signal<Comanda[]>([]);
  readonly produtos = signal<Produto[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal('');
  readonly ocupado = signal(false);
  readonly vista = signal<'grade' | 'planta'>('grade');
  readonly filtro = signal<'todas' | 'livres' | 'ocupadas'>('todas');
  readonly busca = signal('');
  readonly selecionadaId = signal<string | null>(null);
  readonly selecionada = computed(() => this.comandas().find(c => c.id === this.selecionadaId()) ?? null);
  readonly mesasOcupadas = computed(() => this.comandas().filter(c => c.mesaId).length);
  readonly totalAberto = computed(() => this.comandas().reduce((sum, c) => sum + c.total, 0));
  readonly mesasVisiveis = computed(() => this.salao().mesas.filter(m => {
    const order = this.comandaMesa(m.id);
    return (this.filtro() === 'todas' || (this.filtro() === 'ocupadas') === Boolean(order)) &&
      `${m.nome} ${order?.nome ?? ''}`.toLowerCase().includes(this.busca().toLowerCase());
  }));
  readonly avulsas = computed(() => this.comandas().filter(c => !c.mesaId && c.nome.toLowerCase().includes(this.busca().toLowerCase())));
  readonly produtoBusca = signal('');
  readonly catalogo = computed(() => this.produtos().filter(p => `${p.nome} ${p.codigoDeBarras}`.toLowerCase().includes(this.produtoBusca().toLowerCase())).slice(0, 12));
  readonly nova = signal(false);
  readonly novaForm = this.fb.nonNullable.group({ nome: ['', [Validators.required, Validators.maxLength(80)]], pessoas: [1, [Validators.required, Validators.min(1), Validators.max(30)]], mesaId: [''] });
  readonly itemForm = this.fb.nonNullable.group({ quantidade: [1, [Validators.required, Validators.min(.001), Validators.max(99999)]] });
  readonly observacao = this.fb.nonNullable.control('', Validators.maxLength(500));
  readonly destino = this.fb.nonNullable.control('');
  private subscription?: Subscription;
  private aberturaId = '';
  private panel?: ElementRef<HTMLElement>;
  @ViewChild('orderPanel') set orderPanel(value: ElementRef<HTMLElement> | undefined) { this.panel = value; if (value) this.focarPainel(); }
  private focarPainel(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 1250) setTimeout(() => this.panel?.nativeElement.scrollIntoView({ block: 'start' }));
  }
  readonly pendente = signal<VendaInput | null>(null);
  ngOnInit(): void { this.carregar(); }
  carregar(): void {
    this.subscription?.unsubscribe(); this.carregando.set(true); this.erro.set('');
    const tenant = this.auth.activeTenantId();
    if (!tenant) { this.erro.set('Selecione uma empresa.'); this.carregando.set(false); return; }
    this.pendente.set(this.sales.recuperar(tenant));
    this.subscription = combineLatest([this.service.salao(), this.service.abertas(), this.products.getAllProdutos(tenant)])
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: ([salao, comandas, produtos]) => { this.salao.set(salao); this.comandas.set(comandas); this.produtos.set(produtos); this.carregando.set(false); },
        error: () => { this.erro.set('Não foi possível carregar o atendimento. Verifique sua conexão e tente novamente.'); this.carregando.set(false); },
      });
  }
  comandaMesa(id: string): Comanda | undefined { return this.comandas().find(c => c.mesaId === id); }
  mesaNome(id: string | null): string { return this.salao().mesas.find(m => m.id === id)?.nome ?? 'Sem mesa'; }
  poligono(mesa: Mesa): string | null { return mesa.formato === 'personalizada' && mesa.vertices?.length ? `polygon(${mesa.vertices.map(point => `${point.x}% ${point.y}%`).join(',')})` : null; }
  iconeElemento(tipo: ElementoSalao['tipo']): string { return { entrada: 'meeting_room', balcao: 'countertops', caixa: 'point_of_sale', parede: 'horizontal_rule', decoracao: 'weekend' }[tipo]; }
  selecionar(comanda: Comanda): void {
    if (this.pendente() || this.ocupado()) return;
    this.selecionadaId.set(comanda.id); this.observacao.setValue(comanda.observacao); this.destino.setValue(comanda.mesaId ?? '');
    this.focarPainel();
  }
  mesaClick(mesa: Mesa): void {
    const order = this.comandaMesa(mesa.id);
    if (order) this.selecionar(order); else this.abrirFormulario(mesa);
  }
  abrirFormulario(mesa?: Mesa): void {
    if (this.pendente() || this.ocupado()) return;
    this.aberturaId = crypto.randomUUID();
    this.novaForm.reset({ nome: mesa?.nome ?? '', pessoas: 1, mesaId: mesa?.id ?? '' }); this.nova.set(true);
  }
  async criar(): Promise<void> {
    if (this.novaForm.invalid) { this.novaForm.markAllAsTouched(); return; }
    const value = this.novaForm.getRawValue();
    await this.executar(async () => { const result = await this.service.abrir(value.nome, value.pessoas, value.mesaId || null, this.aberturaId); this.selecionadaId.set(result.comandaId); this.nova.set(false); this.observacao.reset(); this.destino.setValue(value.mesaId); });
  }
  async adicionar(produto: Produto): Promise<void> {
    const order = this.selecionada();
    if (!order || !produto.firebaseId || this.itemForm.invalid || this.pendente()) return;
    const itens = order.itens.map(i => ({ produtoId: i.produtoId, quantidade: i.quantidade }));
    const existing = itens.find(i => i.produtoId === produto.firebaseId);
    if (existing) existing.quantidade += this.itemForm.getRawValue().quantidade;
    else itens.push({ produtoId: produto.firebaseId, quantidade: this.itemForm.getRawValue().quantidade });
    await this.executar(() => this.service.atualizar(order, 'itens', { itens, observacao: this.observacao.value }));
  }
  async remover(produtoId: string): Promise<void> {
    const order = this.selecionada(); if (!order || this.pendente()) return;
    await this.executar(() => this.service.atualizar(order, 'itens', { itens: order.itens.filter(i => i.produtoId !== produtoId), observacao: this.observacao.value }));
  }
  async anotar(): Promise<void> {
    const order = this.selecionada(); if (!order || this.observacao.invalid || this.pendente()) return;
    await this.executar(() => this.service.atualizar(order, 'itens', { itens: order.itens, observacao: this.observacao.value }));
  }
  async transferir(): Promise<void> {
    const order = this.selecionada(); if (!order || this.pendente()) return;
    await this.executar(() => this.service.atualizar(order, 'transferir', { mesaId: this.destino.value || null }));
  }
  async cancelar(): Promise<void> {
    const order = this.selecionada(); if (!order || this.pendente() || this.ocupado()) return;
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmationDialogComponent, { width: '420px', maxWidth: '94vw', data: {
      title: 'Cancelar comanda?', message: 'Os itens serão descartados e a mesa será liberada. Nenhuma venda será registrada.', confirmLabel: 'Cancelar comanda', destructive: true,
    } }).afterClosed());
    if (confirmed) await this.executar(async () => { await this.service.atualizar(order, 'cancelar'); this.selecionadaId.set(null); });
  }
  async pagar(): Promise<void> {
    const order = this.selecionada(); if (!order?.itens.length || this.ocupado() || this.dialog.openDialogs.length || !this.pwa.online()) return;
    if (!this.pendente()) {
      const result = await firstValueFrom(this.dialog.open<SalesModalComponent, { total: number }, ResultadoPagamento>(SalesModalComponent, { width: '480px', maxWidth: '95vw', data: { total: order.total } }).afterClosed());
      if (!result) return;
      this.pendente.set({ vendaId: crypto.randomUUID(), comandaId: order.id, versao: order.versao, total: order.total, pagamentos: result.pagamentos });
    }
    const pending = this.pendente(); const tenant = this.auth.activeTenantId(); if (!pending || !tenant) return;
    await this.executar(async () => {
      try { await this.sales.concluir(tenant, pending); }
      catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'functions/failed-precondition' || code === 'functions/invalid-argument' || code === 'functions/permission-denied') this.pendente.set(null);
        throw error;
      }
      this.pendente.set(null); this.selecionadaId.set(null); this.snack.open('Comanda paga. Mesa liberada.', 'Fechar', { duration: 4000 });
    });
  }
  private async executar(action: () => Promise<unknown>): Promise<void> {
    if (this.ocupado() || !this.pwa.online()) return;
    this.ocupado.set(true);
    try { await action(); }
    catch (error: unknown) { this.snack.open(error instanceof Error ? error.message : 'Não foi possível salvar.', 'Fechar', { duration: 6500 }); }
    finally { this.ocupado.set(false); }
  }
}
