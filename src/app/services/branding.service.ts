import { Injectable, effect, signal } from '@angular/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AuthService } from './auth.services';
import { FirebaseService } from './firebase.service';
import { IDENTIDADE_PADRAO, IdentidadeVisual } from '../interfaces/branding';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  readonly config = signal<IdentidadeVisual>(IDENTIDADE_PADRAO);
  private unsubscribe?: () => void;
  constructor(private firebase: FirebaseService, private auth: AuthService) {
    effect(() => {
      const tenant = this.auth.activeTenantId(); this.unsubscribe?.(); this.unsubscribe = undefined;
      if (!tenant) { this.aplicar(IDENTIDADE_PADRAO); return; }
      this.carregarCache(tenant);
      this.unsubscribe = onSnapshot(doc(this.firebase.firestore, 'business', tenant, 'settings', 'branding'), snapshot => {
        const value = snapshot.exists() ? this.normalizar(snapshot.data()) : IDENTIDADE_PADRAO;
        this.aplicar(value); try { localStorage.setItem(`commercium.branding.${tenant}`, JSON.stringify(value)); } catch { /* Cache opcional. */ }
      });
    });
  }
  async salvar(value: IdentidadeVisual): Promise<void> {
    const empresaId = this.auth.activeTenantId(); if (!empresaId) throw new Error('Selecione uma empresa.');
    await httpsCallable(this.firebase.functions, 'salvarIdentidade')({ empresaId, ...value });
  }
  private carregarCache(tenant: string): void {
    try { const cached = JSON.parse(localStorage.getItem(`commercium.branding.${tenant}`) ?? 'null') as Partial<IdentidadeVisual> | null; if (cached) this.aplicar(this.normalizar(cached)); }
    catch { this.aplicar(IDENTIDADE_PADRAO); }
  }
  private normalizar(value: Partial<IdentidadeVisual>): IdentidadeVisual { return { ...IDENTIDADE_PADRAO, ...value }; }
  private aplicar(value: IdentidadeVisual): void {
    this.config.set(value);
    if (typeof document === 'undefined') return;
    const root = document.documentElement; root.style.setProperty('--primary-color', value.corPrimaria);
    root.style.setProperty('--brand-secondary', value.corSecundaria); root.style.setProperty('--brand-background', value.corFundo);
    root.style.setProperty('--text-button-color', this.contraste(value.corPrimaria)); document.title = `${value.nome} · Gestão e ponto de venda`;
  }
  private contraste(color: string): string {
    const red = parseInt(color.slice(1, 3), 16); const green = parseInt(color.slice(3, 5), 16); const blue = parseInt(color.slice(5, 7), 16);
    return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? '#302e27' : '#ffffff';
  }
}
