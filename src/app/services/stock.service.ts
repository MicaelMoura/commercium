import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Stock } from '../interfaces/stock';
import { collectionData$, FirebaseService } from './firebase.service';

export function calculateRemainingStock(currentQuantity: number, requestedQuantity: number): number {
  if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error('A quantidade da baixa deve ser maior que zero.');
  }
  if (!Number.isFinite(currentQuantity) || currentQuantity < requestedQuantity) {
    throw new Error('Estoque insuficiente para concluir a baixa.');
  }
  return currentQuantity - requestedQuantity;
}

@Injectable({ providedIn: 'root' })
export class StockService {
  constructor(private firebase: FirebaseService) {}

  private collectionPath(empresaId: string) {
    if (!empresaId) throw new Error('Selecione uma empresa.');
    return collection(this.firebase.firestore, 'business', empresaId, 'stock');
  }

  getAllStockEntries(empresaId: string): Observable<Stock[]> {
    return collectionData$<Stock>(this.collectionPath(empresaId), 'id');
  }

  addStockEntry(empresaId: string, stockEntry: Omit<Stock, 'id'>) {
    return addDoc(this.collectionPath(empresaId), stockEntry);
  }

  updateStockEntry(empresaId: string, stockEntryId: string, data: Partial<Stock>): Promise<void> {
    return updateDoc(doc(this.collectionPath(empresaId), stockEntryId), data);
  }

  deleteStockEntry(empresaId: string, stockEntryId: string): Promise<void> {
    return deleteDoc(doc(this.collectionPath(empresaId), stockEntryId));
  }

  async diminuirEstoque(empresaId: string, produtoId: string, quantidade: number): Promise<void> {
    calculateRemainingStock(Number.MAX_SAFE_INTEGER, quantidade);
    const stockQuery = query(
      this.collectionPath(empresaId),
      where('produtoId', '==', produtoId),
      limit(1),
    );
    const snapshot = await getDocs(stockQuery);

    if (snapshot.empty) {
      throw new Error('Estoque não localizado.');
    }

    const stockReference = snapshot.docs[0].ref;
    await runTransaction(this.firebase.firestore, async (transaction) => {
      const currentSnapshot = await transaction.get(stockReference);
      if (!currentSnapshot.exists()) {
        throw new Error('Estoque não localizado.');
      }
      const currentQuantity = Number(currentSnapshot.data()['quantidade'] ?? 0);
      transaction.update(stockReference, { quantidade: calculateRemainingStock(currentQuantity, quantidade) });
    });
  }

  async getQuantidadeEmEstoque(empresaId: string, produtoId: string): Promise<number> {
    const stockQuery = query(
      this.collectionPath(empresaId),
      where('produtoId', '==', produtoId),
      limit(1),
    );
    const snapshot = await getDocs(stockQuery);

    if (snapshot.empty) {
      return 0;
    }

    return Number(snapshot.docs[0].data()['quantidade'] ?? 0);
  }
}
