import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ComandasService } from '../../services/comandas.service';
import { PerifericosService } from '../../services/perifericos.service';
import { PwaService } from '../../services/pwa.service';
import { PainelSenha } from '../../interfaces/comanda';
@Component({selector:'app-senhas', standalone:false, templateUrl:'./senhas.component.html', styleUrl:'./senhas.component.scss'})
export class SenhasComponent implements OnInit {
  private readonly service = inject(ComandasService);
  private readonly devices = inject(PerifericosService);
  private readonly destroy = inject(DestroyRef);
  private readonly snack = inject(MatSnackBar);
  readonly pwa = inject(PwaService);
  readonly somentePainel = inject(ActivatedRoute).snapshot.queryParamMap.get('painel') === '1';
  readonly painel = signal<PainelSenha | null>(null);
  readonly erro = signal(''); readonly carregando = signal(true); readonly chamando = signal(false); readonly som = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({ numero: [1, [Validators.required, Validators.min(1), Validators.max(9999), Validators.pattern(/^\d+$/)]], guiche: ['', [Validators.maxLength(24)]] });
  private ultimo = '';
  ngOnInit(): void {
    this.service.painel().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: value => {
      const changed = this.ultimo && value && value.requestId !== this.ultimo;
      this.painel.set(value); this.carregando.set(false);
      if (changed && this.som()) this.anunciar();
      this.ultimo = value?.requestId ?? '';
    }, error: () => { this.erro.set('Sem comunicação com o painel. Reabra a página para reconectar.'); this.carregando.set(false); } });
    this.destroy.onDestroy(() => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); });
  }
  async chamar(): Promise<void> {
    if (this.form.invalid || this.chamando() || !this.pwa.online()) return;
    this.chamando.set(true);
    try { const data = this.form.getRawValue(); await this.devices.exibidor.exibir(data.numero, data.guiche); this.snack.open('Senha chamada.', 'Fechar', { duration: 2500 }); }
    catch (error: unknown) { this.snack.open(error instanceof Error ? error.message : 'Não foi possível chamar.', 'Fechar', { duration: 5000 }); }
    finally { this.chamando.set(false); }
  }
  anunciar(): void {
    const value = this.painel(); if (!value || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const destino = value.guiche.trim() ? ` ${value.guiche}.` : '';
    const utterance = new SpeechSynthesisUtterance(`Senha ${value.numero}.${destino}`);
    utterance.lang = 'pt-BR'; speechSynthesis.speak(utterance);
  }
  ativarSom(): void { this.som.set(!this.som()); if (this.som()) this.anunciar(); }
  async telaCheia(): Promise<void> { try { await document.documentElement.requestFullscreen(); } catch { this.snack.open('Use o modo de tela cheia do navegador.', 'Fechar', { duration: 4000 }); } }
}
