import { MatTableDataSource } from '@angular/material/table';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { Timestamp } from 'firebase/firestore';
export function configurarTabela<T extends object>(source: MatTableDataSource<T>, columns: Partial<Record<string, keyof T>> = {}): void {
  source.sortingDataAccessor = (row, column) => {
    const value = row[(columns[column] ?? column) as keyof T];
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return typeof value === 'number' ? value : String(value ?? '').toLocaleLowerCase('pt-BR');
  };
}
export function paginacaoPortugues(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Itens por página'; intl.nextPageLabel = 'Próxima página'; intl.previousPageLabel = 'Página anterior';
  intl.firstPageLabel = 'Primeira página'; intl.lastPageLabel = 'Última página';
  intl.getRangeLabel = (page, size, length) => length ? `${page * size + 1} – ${Math.min((page + 1) * size, length)} de ${length}` : 'Nenhum item';
  return intl;
}
