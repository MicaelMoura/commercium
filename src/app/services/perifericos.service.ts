import { Injectable, InjectionToken, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BalancaAdapter, ConfiguracaoBalanca, ExibidorSenhaAdapter, LeitorCodigoAdapter, LeituraPeso, PagamentoCartaoAdapter } from '../interfaces/perifericos';
import { ComandasService } from './comandas.service';
interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}
interface SerialApi { requestPort(): Promise<SerialPort>; }
function serial(): SerialApi | undefined { return typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { serial?: SerialApi }).serial; }

// Protocolo de texto delimitado por CR/LF: "ST,1.250 kg" ou "US,1250 g".
// Quadros sem indicador explícito de estabilidade nunca autorizam inclusão no PDV.
export function interpretarPeso(frame: string, unidade: 'kg' | 'g'): LeituraPeso | null {
  const match = frame.trim().match(/^(ST|US)[,;\s]+([+-]?\d+(?:[.,]\d+)?)\s*(kg|g)?$/i);
  if (!match) return null;
  const peso = Number(match[2].replace(',', '.')) / ((match[3]?.toLowerCase() || unidade) === 'g' ? 1000 : 1);
  if (!Number.isFinite(peso) || peso < 0 || peso > 99999) return null;
  return { quilogramas: peso, estavel: match[1].toUpperCase() === 'ST', lidaEm: Date.now() };
}
@Injectable({ providedIn: 'root' })
export class SerialTextBalancaAdapter implements BalancaAdapter, OnDestroy {
  readonly nome = 'Serial · texto ST/US';
  private readonly subject = new Subject<LeituraPeso>();
  readonly leituras$ = this.subject.asObservable();
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private loop: Promise<void> | null = null;
  suportado(): boolean { return Boolean(serial()); }
  async conectar(config: ConfiguracaoBalanca): Promise<void> {
    const api = serial(); if (!api) throw new Error('Este navegador não oferece conexão serial. Use Chrome ou Edge no computador.');
    await this.desconectar();
    const port = await api.requestPort();
    await port.open({ baudRate: config.baudRate }); this.port = port;
    this.loop = this.ler(port, config);
  }
  private async ler(port: SerialPort, config: ConfiguracaoBalanca): Promise<void> {
    if (!port.readable) return;
    const reader = port.readable.getReader(); this.reader = reader;
    const decoder = new TextDecoder(); let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/[\r\n]+/); buffer = frames.pop() ?? '';
        if (buffer.length > 512) buffer = '';
        for (const frame of frames) { const leitura = interpretarPeso(frame, config.unidade); if (leitura) this.subject.next(leitura); }
      }
    } catch { this.subject.next({ quilogramas: 0, estavel: false, lidaEm: 0 }); }
    finally { reader.releaseLock(); this.reader = null; }
  }
  async desconectar(): Promise<void> {
    await this.reader?.cancel().catch(() => undefined); await this.loop;
    await this.port?.close().catch(() => undefined); this.port = null; this.loop = null;
  }
  ngOnDestroy(): void { void this.desconectar(); }
}
export const BALANCA_ADAPTER = new InjectionToken<BalancaAdapter>('BALANCA_ADAPTER', { providedIn: 'root', factory: () => inject(SerialTextBalancaAdapter) });
export const LEITOR_CODIGO_ADAPTER = new InjectionToken<LeitorCodigoAdapter>('LEITOR_CODIGO_ADAPTER', { providedIn: 'root', factory: () => ({ nome: 'USB / Bluetooth · teclado', normalizar: value => value.replace(/[\r\n\t]/g, '').trim() }) });
export const CARTAO_ADAPTER = new InjectionToken<PagamentoCartaoAdapter>('CARTAO_ADAPTER', { providedIn: 'root', factory: () => ({
  nome: 'Conferência manual na maquininha', automatico: false,
  cobrar: async () => { throw new Error('Configure um adaptador TEF ou da operadora para cobrar automaticamente.'); },
  consultar: async () => ({ status: 'pendente' }),
}) });
export const EXIBIDOR_ADAPTER = new InjectionToken<ExibidorSenhaAdapter>('EXIBIDOR_ADAPTER', { providedIn: 'root', factory: () => {
  const service = inject(ComandasService);
  return { exibir: (numero, guiche) => service.chamar(numero, guiche, crypto.randomUUID()) };
} });
@Injectable({ providedIn: 'root' })
export class PerifericosService {
  readonly balanca = inject(BALANCA_ADAPTER);
  readonly cartao = inject(CARTAO_ADAPTER);
  readonly leitor = inject(LEITOR_CODIGO_ADAPTER);
  readonly exibidor = inject(EXIBIDOR_ADAPTER);
  readonly peso = signal<LeituraPeso | null>(null);
  constructor() { this.balanca.leituras$.pipe(takeUntilDestroyed()).subscribe(value => this.peso.set(value)); }
  pesoAtual(): number {
    const value = this.peso();
    if (!value || !value.estavel || value.quilogramas <= 0 || Date.now() - value.lidaEm > 3000) throw new Error('Aguarde uma leitura estável e recente da balança.');
    return value.quilogramas;
  }
  simularPeso(quilogramas: number, estavel: boolean): void {
    if (!Number.isFinite(quilogramas) || quilogramas < 0 || quilogramas > 99999) throw new Error('Informe um peso válido.');
    this.peso.set({ quilogramas, estavel, lidaEm: Date.now() });
  }
}
