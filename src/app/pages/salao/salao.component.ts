import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ComandasService } from '../../services/comandas.service';
import { ElementoSalao, Mesa, ModeloMesa, SALAO_VAZIO, Salao, limitarElemento, limitarMesa } from '../../interfaces/comanda';
import { PwaService } from '../../services/pwa.service';
import { MesaPersonalizadaDialogComponent } from './mesa-personalizada-dialog.component';

type DragItem = { tipo: 'mesa'; item: Mesa } | { tipo: 'elemento'; item: ElementoSalao };

@Component({ selector: 'app-salao', standalone: false, templateUrl: './salao.component.html', styleUrl: './salao.component.scss' })
export class SalaoComponent implements OnInit {
  private readonly service = inject(ComandasService);
  private readonly destroy = inject(DestroyRef);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  readonly pwa = inject(PwaService);
  readonly mesas = signal<Mesa[]>([]);
  readonly elementos = signal<ElementoSalao[]>([]);
  readonly modelos = signal<ModeloMesa[]>([]);
  readonly selecionadaId = signal('');
  readonly elementoSelecionadoId = signal('');
  readonly selecionada = computed(() => this.mesas().find(mesa => mesa.id === this.selecionadaId()));
  readonly elementoSelecionado = computed(() => this.elementos().find(elemento => elemento.id === this.elementoSelecionadoId()));
  readonly lugares = computed(() => this.mesas().reduce((total, mesa) => total + mesa.lugares, 0));
  readonly alterado = signal(false);
  readonly carregando = signal(true);
  readonly salvando = signal(false);
  readonly erro = signal('');
  readonly atualizadoRemoto = signal(false);
  private original: Salao = SALAO_VAZIO;
  private versao = 0;
  private drag: { tipo: DragItem['tipo']; id: string; clientX: number; clientY: number; item: Mesa | ElementoSalao; scale: number; resize: boolean } | null = null;
  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(24)]], lugares: [4, [Validators.required, Validators.min(1), Validators.max(30)]],
    largura: [140, [Validators.required, Validators.min(80), Validators.max(320)]], altura: [120, [Validators.required, Validators.min(80), Validators.max(320)]],
    x: [0, [Validators.required, Validators.min(0)]], y: [0, [Validators.required, Validators.min(0)]],
    formato: ['retangular' as Mesa['formato']], rotacao: [0, [Validators.required, Validators.min(0), Validators.max(359)]],
  });
  readonly elementoForm = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(32)]], largura: [180, [Validators.required, Validators.min(20), Validators.max(600)]],
    altura: [70, [Validators.required, Validators.min(10), Validators.max(500)]], x: [0, [Validators.required, Validators.min(0)]],
    y: [0, [Validators.required, Validators.min(0)]], rotacao: [0, [Validators.required, Validators.min(0), Validators.max(359)]],
  });

  ngOnInit(): void {
    this.service.salao().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: value => {
        this.original = this.clonar(value);
        if (!this.alterado()) this.carregarValor(value);
        else if (value.versao !== this.versao) this.atualizadoRemoto.set(true);
        this.carregando.set(false);
      }, error: () => { this.erro.set('Não foi possível carregar a configuração. Reabra esta página para tentar novamente.'); this.carregando.set(false); },
    });
  }
  adicionar(): void {
    if (this.mesas().length >= 80 || this.salvando()) return;
    const mesa: Mesa = { id: crypto.randomUUID(), nome: this.nomeMesa('Mesa'), lugares: 4,
      ...this.proximaPosicao(), largura: 140, altura: 120, formato: 'retangular', rotacao: 0 };
    this.mesas.update(mesas => [...mesas, mesa]); this.marcarAlterado(); this.selecionar(mesa);
  }
  adicionarModelo(modelo: ModeloMesa): void {
    if (this.mesas().length >= 80 || this.salvando()) return;
    const mesa: Mesa = { id: crypto.randomUUID(), nome: this.nomeMesa(modelo.nome), lugares: modelo.lugares,
      ...this.proximaPosicao(), largura: modelo.largura, altura: modelo.altura, formato: 'personalizada', rotacao: 0,
      vertices: modelo.vertices.map(point => ({ ...point })), modeloId: modelo.id };
    this.mesas.update(mesas => [...mesas, mesa]); this.marcarAlterado(); this.selecionar(mesa);
  }
  async desenharModelo(modelo?: ModeloMesa): Promise<void> {
    const result = await firstValueFrom(this.dialog.open<MesaPersonalizadaDialogComponent, ModeloMesa | null, ModeloMesa>(MesaPersonalizadaDialogComponent, {
      width: '900px', maxWidth: '96vw', data: modelo ?? null, disableClose: true,
    }).afterClosed());
    if (!result) return;
    if (modelo) {
      this.modelos.update(modelos => modelos.map(item => item.id === result.id ? result : item));
      this.mesas.update(mesas => mesas.map(mesa => mesa.modeloId === result.id ? { ...mesa, vertices: result.vertices.map(point => ({ ...point })) } : mesa));
      this.marcarAlterado();
    } else {
      this.modelos.update(modelos => [...modelos, result]); this.marcarAlterado(); this.adicionarModelo(result);
    }
  }
  adicionarElemento(tipo: ElementoSalao['tipo']): void {
    if (this.elementos().length >= 120 || this.salvando()) return;
    if (tipo === 'entrada') {
      const existente = this.elementos().find(item => item.tipo === 'entrada');
      if (existente) { this.selecionarElemento(existente); return; }
    }
    const defaults: Record<ElementoSalao['tipo'], Pick<ElementoSalao, 'nome' | 'largura' | 'altura'>> = {
      entrada: { nome: 'Entrada', largura: 160, altura: 40 },
      balcao: { nome: 'Balcão', largura: 260, altura: 80 }, caixa: { nome: 'Caixa', largura: 120, altura: 90 },
      parede: { nome: 'Parede', largura: 320, altura: 20 }, decoracao: { nome: 'Ambiente', largura: 140, altura: 120 },
    };
    const count = this.elementos().filter(item => item.tipo === tipo).length;
    const base = defaults[tipo]; const item = limitarElemento({ id: crypto.randomUUID(), tipo, nome: `${base.nome} ${count + 1}`,
      x: 80 + (count % 5) * 150, y: 90 + (Math.floor(count / 5) % 4) * 130, largura: base.largura, altura: base.altura, rotacao: 0 });
    this.elementos.update(elementos => [...elementos, item]); this.marcarAlterado(); this.selecionarElemento(item);
  }
  selecionar(mesa: Mesa): void { this.elementoSelecionadoId.set(''); this.selecionadaId.set(mesa.id); this.form.patchValue(mesa); }
  selecionarElemento(elemento: ElementoSalao): void { this.selecionadaId.set(''); this.elementoSelecionadoId.set(elemento.id); this.elementoForm.patchValue(elemento); }
  aplicar(): void {
    const mesa = this.selecionada(); if (!mesa || this.form.invalid || this.salvando()) return;
    const value = this.form.getRawValue();
    if (!Number.isInteger(value.lugares) || this.mesas().some(item => item.id !== mesa.id && item.nome.toLowerCase() === value.nome.trim().toLowerCase())) {
      this.snack.open('Use um nome único e um número inteiro de lugares.', 'Fechar', { duration: 4000 }); return;
    }
    const updated = limitarMesa({ ...mesa, ...value, nome: value.nome.trim(), formato: mesa.formato === 'personalizada' ? 'personalizada' : value.formato });
    this.atualizarMesa(updated); this.form.patchValue(updated);
  }
  aplicarElemento(): void {
    const elemento = this.elementoSelecionado(); if (!elemento || this.elementoForm.invalid || this.salvando()) return;
    const updated = limitarElemento({ ...elemento, ...this.elementoForm.getRawValue(), nome: this.elementoForm.controls.nome.value.trim() });
    this.atualizarElemento(updated); this.elementoForm.patchValue(updated);
  }
  girar(delta: number): void {
    const mesa = this.selecionada(); const elemento = this.elementoSelecionado();
    if (mesa) { const updated = limitarMesa({ ...mesa, rotacao: mesa.rotacao + delta }); this.atualizarMesa(updated); this.form.patchValue(updated); }
    else if (elemento) { const updated = limitarElemento({ ...elemento, rotacao: elemento.rotacao + delta }); this.atualizarElemento(updated); this.elementoForm.patchValue(updated); }
  }
  redimensionar(delta: number): void {
    const mesa = this.selecionada(); const elemento = this.elementoSelecionado();
    if (mesa) {
      const updated = limitarMesa({ ...mesa, largura: mesa.largura + delta, altura: mesa.altura + delta });
      this.atualizarMesa(updated); this.form.patchValue(updated);
    } else if (elemento) {
      const updated = limitarElemento({ ...elemento, largura: elemento.largura + delta, altura: elemento.altura + delta });
      this.atualizarElemento(updated); this.elementoForm.patchValue(updated);
    }
  }
  remover(): void {
    if (this.salvando()) return;
    if (this.selecionadaId()) this.mesas.update(mesas => mesas.filter(mesa => mesa.id !== this.selecionadaId()));
    else if (this.elementoSelecionadoId()) this.elementos.update(elementos => elementos.filter(elemento => elemento.id !== this.elementoSelecionadoId()));
    this.selecionadaId.set(''); this.elementoSelecionadoId.set(''); this.marcarAlterado();
  }
  iniciar(event: PointerEvent, selection: DragItem, board: HTMLElement, resize = false): void {
    if (event.button !== 0 || this.salvando()) return;
    event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (selection.tipo === 'mesa') this.selecionar(selection.item); else this.selecionarElemento(selection.item);
    this.drag = { tipo: selection.tipo, id: selection.item.id, clientX: event.clientX, clientY: event.clientY,
      item: { ...selection.item }, scale: board.getBoundingClientRect().width / 1200, resize };
  }
  mover(event: PointerEvent): void {
    const drag = this.drag; if (!drag) return;
    const dx = Math.round((event.clientX - drag.clientX) / drag.scale / 10) * 10;
    const dy = Math.round((event.clientY - drag.clientY) / drag.scale / 10) * 10;
    if (drag.tipo === 'mesa') {
      const item = drag.item as Mesa; const updated = limitarMesa(drag.resize ? { ...item, largura: item.largura + dx, altura: item.altura + dy } : { ...item, x: item.x + dx, y: item.y + dy });
      this.atualizarMesa(updated); this.form.patchValue(updated);
    } else {
      const item = drag.item as ElementoSalao; const updated = limitarElemento(drag.resize ? { ...item, largura: item.largura + dx, altura: item.altura + dy } : { ...item, x: item.x + dx, y: item.y + dy });
      this.atualizarElemento(updated); this.elementoForm.patchValue(updated);
    }
  }
  terminar(): void { this.drag = null; }
  teclado(event: KeyboardEvent, selection: DragItem): void {
    const changes: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    const delta = changes[event.key]; if (!delta || this.salvando()) return; event.preventDefault();
    if (selection.tipo === 'mesa') { const updated = limitarMesa({ ...selection.item, x: selection.item.x + delta[0], y: selection.item.y + delta[1] }); this.atualizarMesa(updated); this.selecionar(updated); }
    else { const updated = limitarElemento({ ...selection.item, x: selection.item.x + delta[0], y: selection.item.y + delta[1] }); this.atualizarElemento(updated); this.selecionarElemento(updated); }
  }
  poligono(mesa: Mesa): string | null { return mesa.formato === 'personalizada' && mesa.vertices?.length ? `polygon(${mesa.vertices.map(point => `${point.x}% ${point.y}%`).join(',')})` : null; }
  poligonoModelo(modelo: ModeloMesa): string { return `polygon(${modelo.vertices.map(point => `${point.x}% ${point.y}%`).join(',')})`; }
  modeloDaMesa(mesa: Mesa): ModeloMesa | undefined { return this.modelos().find(modelo => modelo.id === mesa.modeloId); }
  iconeElemento(tipo: ElementoSalao['tipo']): string { return { entrada: 'meeting_room', balcao: 'countertops', caixa: 'point_of_sale', parede: 'horizontal_rule', decoracao: 'weekend' }[tipo]; }
  descartar(): void { this.carregarValor(this.original); this.alterado.set(false); this.atualizadoRemoto.set(false); this.selecionadaId.set(''); this.elementoSelecionadoId.set(''); }
  async salvar(): Promise<void> {
    if (this.salvando() || !this.pwa.online() || this.atualizadoRemoto()) return;
    this.salvando.set(true);
    try { const result = await this.service.salvarSalao({ mesas: this.mesas(), elementos: this.elementos(), modelos: this.modelos() }, this.versao);
      this.versao = result.versao; this.alterado.set(false); this.atualizadoRemoto.set(false);
      this.snack.open('Salão salvo. A planta já está disponível no atendimento.', 'Fechar', { duration: 4000 }); }
    catch (error: unknown) { this.snack.open(error instanceof Error ? error.message : 'Não foi possível salvar.', 'Fechar', { duration: 6000 }); }
    finally { this.salvando.set(false); }
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void { if (this.alterado()) event.preventDefault(); }
  private marcarAlterado(): void { this.alterado.set(true); }
  private atualizarMesa(mesa: Mesa): void { this.mesas.update(mesas => mesas.map(item => item.id === mesa.id ? mesa : item)); this.marcarAlterado(); }
  private atualizarElemento(elemento: ElementoSalao): void { this.elementos.update(elementos => elementos.map(item => item.id === elemento.id ? elemento : item)); this.marcarAlterado(); }
  private nomeMesa(base: string): string { let index = 1; let nome = base; while (this.mesas().some(item => item.nome.toLowerCase() === nome.toLowerCase())) nome = `${base} ${++index}`; return nome; }
  private proximaPosicao(): Pick<Mesa, 'x' | 'y'> { const count = this.mesas().length; return { x: 40 + (count % 6) * 185, y: 40 + (Math.floor(count / 6) % 4) * 185 }; }
  private clonar(value: Salao): Salao { return structuredClone(value); }
  private carregarValor(value: Salao): void {
    const copy = this.clonar(value);
    if (!copy.elementos.some(item => item.tipo === 'entrada')) {
      copy.elementos.push({ id: crypto.randomUUID(), tipo: 'entrada', nome: 'Entrada', x: 520, y: 740, largura: 160, altura: 40, rotacao: 0 });
    }
    this.mesas.set(copy.mesas); this.elementos.set(copy.elementos); this.modelos.set(copy.modelos); this.versao = copy.versao;
  }
}
