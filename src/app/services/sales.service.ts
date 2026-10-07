import { Injectable } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { VendaInput } from '../interfaces/sales';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class VendasService {
  constructor(private firebase: FirebaseService) {}
  private readonly pendentes = new Map<string, VendaInput>();
  recuperar(empresaId: string): VendaInput | null {
    const memory = this.pendentes.get(empresaId); if (memory) return memory;
    if (typeof sessionStorage === 'undefined') return null;
    try { const raw = sessionStorage.getItem(`commercium.checkout.${empresaId}`); return raw ? JSON.parse(raw) as VendaInput : null; } catch { return null; }
  }
  private guardar(empresaId: string, venda: VendaInput | null): void {
    if (venda) this.pendentes.set(empresaId, venda); else this.pendentes.delete(empresaId);
    if (typeof sessionStorage === 'undefined') return;
    if (venda) sessionStorage.setItem(`commercium.checkout.${empresaId}`, JSON.stringify(venda));
    else sessionStorage.removeItem(`commercium.checkout.${empresaId}`);
  }

  async concluir(empresaId: string, venda: VendaInput): Promise<{ vendaId: string; total: number; troco: number }> {
    if (!empresaId) throw new Error('Selecione uma empresa.');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Sem conexão. A venda não foi enviada.');
    const pending = this.recuperar(empresaId);
    if (pending && pending.vendaId !== venda.vendaId) throw new Error('Existe um pagamento pendente nesta estação. Verifique-o na frente de caixa.');
    try { this.guardar(empresaId, venda); } catch { throw new Error('Permita o armazenamento desta sessão antes de receber pagamentos.'); }
    try {
      const result = await httpsCallable<object, { vendaId: string; total: number; troco: number }>(this.firebase.functions, 'concluirVenda')({ empresaId, ...venda });
      this.guardar(empresaId, null);
      return result.data;
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (['functions/failed-precondition', 'functions/invalid-argument', 'functions/permission-denied', 'functions/unauthenticated'].includes(code ?? '')) this.guardar(empresaId, null);
      throw error;
    }
  }

  async empresa(empresaId: string): Promise<{ nome: string; endereco: string }> {
    if (!empresaId) throw new Error('Selecione uma empresa.');
    const data = (await getDoc(doc(this.firebase.firestore, 'business', empresaId))).data();
    return { nome: String(data?.['nomeFantasia'] || data?.['razaoSocial'] || empresaId), endereco: String(data?.['endereco'] || '') };
  }
}
