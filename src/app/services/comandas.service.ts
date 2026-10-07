import { Injectable } from '@angular/core';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Observable, map } from 'rxjs';
import { Comanda, Mesa, PainelSenha, Salao, SALAO_VAZIO } from '../interfaces/comanda';
import { AuthService } from './auth.services';
import { collectionData$, FirebaseService } from './firebase.service';
@Injectable({ providedIn: 'root' })
export class ComandasService {
  constructor(private firebase: FirebaseService, private auth: AuthService) {}
  private tenant(): string {
    const empresaId = this.auth.activeTenantId();
    if (!empresaId) throw new Error('Selecione uma empresa para continuar.');
    return empresaId;
  }
  abertas(): Observable<Comanda[]> {
    return collectionData$<Comanda>(query(collection(this.firebase.firestore, 'business', this.tenant(), 'orders'), where('status', '==', 'ABERTA')), 'id');
  }
  private config<T>(key: string, fallback: T): Observable<T> {
    const ref = doc(this.firebase.firestore, 'business', this.tenant(), 'settings', key);
    return new Observable(sub => onSnapshot(ref, snap => sub.next(snap.exists() ? snap.data() as T : fallback), error => sub.error(error)));
  }
  salao(): Observable<Salao> {
    return this.config<Salao>('salao', SALAO_VAZIO).pipe(map(value => ({
      mesas: (value.mesas ?? []).map(mesa => ({ ...mesa, rotacao: mesa.rotacao ?? 0 })),
      elementos: value.elementos ?? [], modelos: value.modelos ?? [], versao: value.versao ?? 0,
    })));
  }
  painel(): Observable<PainelSenha | null> { return this.config<PainelSenha | null>('painel', null); }
  private async call<T>(name: string, data: object): Promise<T> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Sem conexão. Reconecte para salvar com segurança.');
    const result = await httpsCallable<object, T>(this.firebase.functions, name)({ ...data, empresaId: this.tenant() });
    return result.data;
  }
  salvarSalao(salao: Pick<Salao, 'mesas' | 'elementos' | 'modelos'>, versao: number): Promise<{ versao: number }> {
    return this.call('salvarSalao', { ...salao, versao });
  }
  abrir(nome: string, pessoas: number, mesaId: string | null, comandaId: string): Promise<{ comandaId: string }> {
    return this.call('abrirComanda', { nome, pessoas, mesaId, comandaId });
  }
  atualizar(comanda: Comanda, acao: 'itens' | 'cancelar' | 'transferir', data: object = {}): Promise<void> {
    return this.call('atualizarComanda', { comandaId: comanda.id, versao: comanda.versao, acao, ...data });
  }
  chamar(numero: number, guiche: string | undefined, requestId: string): Promise<void> { return this.call('chamarSenha', { numero, guiche, requestId }); }
}
