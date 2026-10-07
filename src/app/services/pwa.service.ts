import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }>; }
@Injectable({ providedIn: 'root' })
export class PwaService {
  readonly online = signal(typeof navigator === 'undefined' || navigator.onLine);
  readonly instalavel = signal(false);
  readonly atualizacao = signal(false);
  private prompt: InstallPrompt | null = null;
  constructor() {
    const destroy = inject(DestroyRef);
    const updates = inject(SwUpdate, { optional: true });
    if (updates?.isEnabled) updates.versionUpdates.pipe(takeUntilDestroyed(destroy)).subscribe(event => {
      if (event.type === 'VERSION_READY') this.atualizacao.set(true);
    });
    if (typeof window === 'undefined') return;
    const online = () => this.online.set(navigator.onLine);
    const install = (event: Event) => { event.preventDefault(); this.prompt = event as InstallPrompt; this.instalavel.set(true); };
    const installed = () => { this.prompt = null; this.instalavel.set(false); };
    window.addEventListener('online', online); window.addEventListener('offline', online);
    window.addEventListener('beforeinstallprompt', install); window.addEventListener('appinstalled', installed);
    destroy.onDestroy(() => {
      window.removeEventListener('online', online); window.removeEventListener('offline', online);
      window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', installed);
    });
  }
  async instalar(): Promise<void> {
    if (!this.prompt) return;
    await this.prompt.prompt(); await this.prompt.userChoice;
    this.prompt = null; this.instalavel.set(false);
  }
}
