import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IDENTIDADE_PADRAO } from '../../interfaces/branding';
import { BrandingService } from '../../services/branding.service';
import { PwaService } from '../../services/pwa.service';

@Component({ selector: 'app-personalizacao', standalone: false, templateUrl: './personalizacao.component.html', styleUrl: './personalizacao.component.scss' })
export class PersonalizacaoComponent {
  readonly branding = inject(BrandingService);
  readonly pwa = inject(PwaService);
  private readonly snack = inject(MatSnackBar);
  readonly salvando = signal(false);
  readonly lendoLogo = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(40)]], slogan: ['', [Validators.required, Validators.maxLength(100)]],
    corPrimaria: ['#ffca28', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    corSecundaria: ['#302e27', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    corFundo: ['#f8f7f3', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]], logo: ['assets/brand.svg', Validators.required],
  });
  constructor() { effect(() => this.form.patchValue(this.branding.config(), { emitEvent: false })); }
  async escolherLogo(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 500_000) {
      this.snack.open('Use PNG, JPEG ou WebP com no máximo 500 KB.', 'Fechar', { duration: 5000 }); return;
    }
    this.lendoLogo.set(true);
    try { this.form.controls.logo.setValue(await this.dataUrl(file)); this.form.markAsDirty(); }
    finally { this.lendoLogo.set(false); }
  }
  restaurar(): void { this.form.setValue(IDENTIDADE_PADRAO); this.form.markAsDirty(); }
  async salvar(): Promise<void> {
    if (this.form.invalid || this.salvando() || !this.pwa.online()) { this.form.markAllAsTouched(); return; }
    this.salvando.set(true);
    try { await this.branding.salvar(this.form.getRawValue()); this.form.markAsPristine(); this.snack.open('Identidade visual salva para esta empresa.', 'Fechar', { duration: 3500 }); }
    catch (error: unknown) { this.snack.open(error instanceof Error ? error.message : 'Não foi possível salvar a identidade visual.', 'Fechar', { duration: 6000 }); }
    finally { this.salvando.set(false); }
  }
  private dataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
}
