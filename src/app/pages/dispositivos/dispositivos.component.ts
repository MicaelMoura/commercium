import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PerifericosService } from '../../services/perifericos.service';
import { PwaService } from '../../services/pwa.service';
import { AuthService } from '../../services/auth.services';
@Component({ selector: 'app-dispositivos', standalone: false, templateUrl: './dispositivos.component.html', styleUrl: './dispositivos.component.scss' })
export class DispositivosComponent {
  readonly devices = inject(PerifericosService);
  readonly pwa = inject(PwaService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  readonly ocupado = signal(false);
  readonly conectado = signal(false);
  readonly leitorTeste = signal('');
  readonly resultadoCartao = signal('Nenhuma transação simulada.');
  readonly form = inject(FormBuilder).nonNullable.group({ baudRate: [9600, Validators.required], unidade: ['kg' as 'kg' | 'g'] });
  readonly simuladorBalanca = inject(FormBuilder).nonNullable.group({ peso: [1.25, [Validators.required, Validators.min(0), Validators.max(99999)]], estavel: [true] });
  readonly simuladorCartao = inject(FormBuilder).nonNullable.group({
    valor: [25, [Validators.required, Validators.min(.01), Validators.max(999999)]], modalidade: ['credito' as 'credito' | 'debito'],
    resposta: ['aprovado' as 'aprovado' | 'recusado' | 'pendente'],
  });
  constructor() {
    try { const value = JSON.parse(localStorage.getItem(this.key()) ?? 'null') as { baudRate: number; unidade: 'kg' | 'g' } | null;
      if (value && [1200, 2400, 4800, 9600, 19200, 38400, 115200].includes(value.baudRate) && ['kg', 'g'].includes(value.unidade)) this.form.patchValue(value);
    } catch { /* Preferências locais indisponíveis: manter os valores padrão. */ }
  }
  private key(): string { const tenant = this.auth.activeTenantId(); if (!tenant) throw new Error('Selecione uma empresa.'); return `commercium.devices.${tenant}`; }
  async conectar(): Promise<void> {
    this.ocupado.set(true);
    try { await this.devices.balanca.conectar(this.form.getRawValue()); this.conectado.set(true);
      try { localStorage.setItem(this.key(), JSON.stringify(this.form.getRawValue())); } catch { /* A conexão não depende de armazenamento local. */ }
      this.snack.open('Porta aberta. Aguardando uma leitura compatível.', 'Fechar', { duration: 4000 });
    } catch (error: unknown) { this.snack.open(error instanceof Error ? error.message : 'Não foi possível conectar.', 'Fechar', { duration: 6000 }); }
    finally { this.ocupado.set(false); }
  }
  async desconectar(): Promise<void> { await this.devices.balanca.desconectar(); this.devices.peso.set(null); this.conectado.set(false); }
  testar(event: Event): void { this.leitorTeste.set(this.devices.leitor.normalizar((event.target as HTMLInputElement).value)); }
  simularLeitura(): void {
    if (this.simuladorBalanca.invalid) return;
    const value = this.simuladorBalanca.getRawValue(); this.devices.simularPeso(value.peso, value.estavel);
    this.snack.open('Leitura simulada enviada ao PDV desta estação.', 'Fechar', { duration: 3000 });
  }
  simularPagamento(): void {
    if (this.simuladorCartao.invalid) return;
    const value = this.simuladorCartao.getRawValue();
    const labels = { aprovado: 'APROVADA', recusado: 'RECUSADA', pendente: 'PENDENTE' };
    this.resultadoCartao.set(`${labels[value.resposta]} · ${value.modalidade === 'credito' ? 'Crédito' : 'Débito'} · R$ ${value.valor.toFixed(2).replace('.', ',')}`);
  }
}
