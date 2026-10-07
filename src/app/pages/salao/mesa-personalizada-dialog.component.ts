import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ModeloMesa, PontoSalao } from '../../interfaces/comanda';

@Component({
  selector: 'app-mesa-personalizada-dialog',
  standalone: false,
  templateUrl: './mesa-personalizada-dialog.component.html',
  styleUrl: './mesa-personalizada-dialog.component.scss',
})
export class MesaPersonalizadaDialogComponent {
  private readonly ref = inject(MatDialogRef<MesaPersonalizadaDialogComponent, ModeloMesa | undefined>);
  readonly data = inject<ModeloMesa | null>(MAT_DIALOG_DATA, { optional: true });
  readonly vertices = signal<PontoSalao[]>(this.data?.vertices.map(point => ({ ...point })) ?? this.iniciais());
  readonly selecionado = signal(0);
  private arrastando: number | null = null;
  readonly form = inject(FormBuilder).nonNullable.group({
    nome: [this.data?.nome ?? 'Mesa personalizada', [Validators.required, Validators.maxLength(32)]],
    lugares: [this.data?.lugares ?? 4, [Validators.required, Validators.min(1), Validators.max(30)]],
    largura: [this.data?.largura ?? 180, [Validators.required, Validators.min(80), Validators.max(320)]],
    altura: [this.data?.altura ?? 140, [Validators.required, Validators.min(80), Validators.max(320)]],
  });

  pontos(): string { return this.vertices().map(point => `${point.x},${point.y}`).join(' '); }
  adicionarVertice(): void {
    const vertices = this.vertices(); if (vertices.length >= 12) return;
    let edge = 0; let distance = -1;
    vertices.forEach((point, index) => {
      const next = vertices[(index + 1) % vertices.length];
      const current = Math.hypot(next.x - point.x, next.y - point.y);
      if (current > distance) { distance = current; edge = index; }
    });
    const start = vertices[edge]; const end = vertices[(edge + 1) % vertices.length];
    const point = { x: Math.round((start.x + end.x) / 2), y: Math.round((start.y + end.y) / 2) };
    this.vertices.set([...vertices.slice(0, edge + 1), point, ...vertices.slice(edge + 1)]); this.selecionado.set(edge + 1);
  }
  removerVertice(): void {
    if (this.vertices().length <= 3) return;
    this.vertices.update(vertices => vertices.filter((_, index) => index !== this.selecionado()));
    this.selecionado.set(Math.max(0, this.selecionado() - 1));
  }
  restaurar(): void { this.vertices.set(this.iniciais()); this.selecionado.set(0); }
  iniciar(event: PointerEvent, index: number): void {
    event.preventDefault(); (event.currentTarget as SVGCircleElement).setPointerCapture(event.pointerId);
    this.arrastando = index; this.selecionado.set(index);
  }
  mover(event: PointerEvent, svg: Element): void {
    if (this.arrastando === null) return;
    const rect = svg.getBoundingClientRect();
    const point = { x: this.clamp((event.clientX - rect.left) / rect.width * 100), y: this.clamp((event.clientY - rect.top) / rect.height * 100) };
    this.vertices.update(vertices => vertices.map((value, index) => index === this.arrastando ? point : value));
  }
  terminar(): void { this.arrastando = null; }
  salvar(): void {
    if (this.form.invalid || this.vertices().length < 3) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.ref.close({ id: this.data?.id ?? crypto.randomUUID(), nome: value.nome.trim(), lugares: value.lugares,
      largura: value.largura, altura: value.altura, vertices: this.vertices().map(point => ({ ...point })) });
  }
  private clamp(value: number): number { return Math.round(Math.max(2, Math.min(98, value)) * 10) / 10; }
  private iniciais(): PontoSalao[] { return [{ x: 18, y: 15 }, { x: 82, y: 15 }, { x: 92, y: 72 }, { x: 62, y: 90 }, { x: 20, y: 78 }]; }
}
