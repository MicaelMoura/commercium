import { Injectable } from '@angular/core';
import { combineLatest, firstValueFrom, map, Observable, of, switchMap } from 'rxjs';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Produto } from '../interfaces/produto';
import { Stock } from '../interfaces/stock';
import { AuthService } from './auth.services';
import { collectionData$, FirebaseService } from './firebase.service';
import { PlataformService } from './plataform.service';

type ProdutoComEstoque = Produto & { stockId?: string | null };

@Injectable({ providedIn: 'root' })
export class ProdutosService {
  constructor(
    private firebase: FirebaseService,
    private authService: AuthService,
    private plataformService: PlataformService,
  ) {}

  private productsCollection(empresaId: string) {
    if (!empresaId) throw new Error('Selecione uma empresa.');
    return collection(this.firebase.firestore, 'business', empresaId, 'products');
  }

  private stockCollection(empresaId: string) {
    if (!empresaId) throw new Error('Selecione uma empresa.');
    return collection(this.firebase.firestore, 'business', empresaId, 'stock');
  }

  buscarProdutosComEstoque(termo: string): Observable<ProdutoComEstoque[]> {
    const empresaId = this.authService.activeTenantId();
    if (!empresaId) {
      return of([]);
    }

    const busca = termo.toUpperCase();
    const productsQuery = query(
      this.productsCollection(empresaId),
      orderBy('nome'),
      startAt(busca),
      endAt(`${busca}\uf8ff`),
      limit(5),
    );

    return collectionData$<Produto>(productsQuery, 'firebaseId').pipe(
      switchMap((produtos) => {
        if (produtos.length === 0) {
          return of([]);
        }

        const stockQueries = produtos.map((produto) => {
          const stockQuery = query(
            this.stockCollection(empresaId),
            where('produtoId', '==', produto.firebaseId),
          );
          return collectionData$<Stock>(stockQuery, 'id').pipe(
            map((stocks) => ({
              ...produto,
              estoqueQtd: stocks.reduce((total, stock) => total + Number(stock.quantidade || 0), 0),
              stockId: stocks[0]?.id ?? null,
            })),
          );
        });

        return combineLatest(stockQueries);
      }),
    );
  }

  getAllProdutos(empresaId: string): Observable<Produto[]> {
    return collectionData$<Produto>(this.productsCollection(empresaId), 'firebaseId');
  }

  addProduto(empresaId: string, produto: Produto) {
    return addDoc(this.productsCollection(empresaId), {
      ...produto,
      nome: produto.nome.toUpperCase(),
    });
  }

  updateProduto(empresaId: string, produtoId: string, data: Partial<Produto>): Promise<void> {
    const payload = {
      ...data,
      ...(data.nome ? { nome: data.nome.toUpperCase() } : {}),
    };
    return updateDoc(doc(this.productsCollection(empresaId), produtoId), payload);
  }

  deleteProduto(empresaId: string, produtoId: string): Promise<void> {
    return deleteDoc(doc(this.productsCollection(empresaId), produtoId));
  }

  async getProdutoByBarcode(empresaId: string, barcode: string): Promise<Produto | null> {
    const productQuery = query(
      this.productsCollection(empresaId),
      where('codigoDeBarras', '==', barcode),
      limit(1),
    );
    const snapshot = await getDocs(productQuery);

    if (snapshot.empty) {
      return null;
    }

    const productDocument = snapshot.docs[0];
    return { ...productDocument.data(), firebaseId: productDocument.id } as Produto;
  }

  async getNomeUnidadeMedida(codigo: string): Promise<string> {
    const units = await firstValueFrom(this.plataformService.getUnits());
    return units.find((unit) => unit.id === codigo)?.name ?? 'Desconhecida';
  }
}
