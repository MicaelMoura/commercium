import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { ConfirmationDialogComponent } from '../components/confirmation-dialog/confirmation-dialog.component';
interface PendingPage { alterado?: () => boolean; itensVenda?: () => unknown[]; pendente?: () => unknown; }
export const pendingChangesGuard: CanDeactivateFn<PendingPage> = component => {
  if (component.pendente?.()) return true; // A solicitação já está preservada na sessão e pode ser verificada no PDV.
  if (!component.alterado?.() && !component.itensVenda?.().length) return true;
  return inject(MatDialog).open(ConfirmationDialogComponent, { width: '430px', maxWidth: '94vw', data: {
    title: 'Sair sem salvar?', message: 'Há alterações nesta tela que ainda não foram salvas. Ao sair, elas serão descartadas.', confirmLabel: 'Sair sem salvar', destructive: true,
  } }).afterClosed().pipe(map(Boolean));
};
