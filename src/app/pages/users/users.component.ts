import { configurarTabela } from '../../components/management-table';
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UsersService } from '../../services/users.service';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { User } from '../../interfaces/user';
import { AuthService } from '../../services/auth.services';

import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ModalViewUserComponent } from './modal-view-user/modal-view-user.component';
import { ModalFormUserComponent } from './modal-form-user/modal-form-user.component';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrl: './users.component.scss',
    standalone: false
})

export class UsersComponent implements OnInit, AfterViewInit {
  readonly displayedColumns = ['name', 'email', 'access', 'action'];
  readonly dataSource = new MatTableDataSource<User>([]);
  isLoading = true;
  errorMessage = '';
  filterValue = '';
  deletingUserId: string | null = null;
  paginator!: MatPaginator;
  @ViewChild(MatPaginator) set paginatorView(value: MatPaginator) { this.paginator = value; this.dataSource.paginator = value; }
  sort!: MatSort;
  @ViewChild(MatSort) set sortView(value: MatSort) { this.sort = value; this.dataSource.sort = value; }

  constructor(
    public dialog: MatDialog,
    private usersService: UsersService,
    readonly authService: AuthService,
    private snackBar: MatSnackBar,
    private paginatorIntl: MatPaginatorIntl,
    private destroyRef: DestroyRef,
  ) {
    this.paginatorIntl.itemsPerPageLabel = 'Itens por página';
  }

  readonly empresaIdAtual = this.authService.activeTenantId;

  ngOnInit(): void {
    configurarTabela(this.dataSource, { name: 'nome', email: 'email', access: 'acesso' });
    const empresaId = this.empresaIdAtual();
    if (!empresaId) {
      this.isLoading = false;
      this.errorMessage = 'Nenhuma empresa ativa foi encontrada.';
      return;
    }
    this.getListUsers(empresaId);
  }

  getListUsers(empresaId: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.usersService.getAllUsers(empresaId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (users) => {
        this.dataSource.data = users;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Não foi possível carregar os usuários.', error);
        this.errorMessage = 'Não foi possível carregar os usuários. Tente novamente.';
        this.isLoading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event): void {
    this.filterValue = (event.target as HTMLInputElement).value.trim();
    this.dataSource.filter = this.filterValue.toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  openModalViewUser(user: User): void {
    this.dialog.open(ModalViewUserComponent, {
      width: 'min(92vw, 680px)',
      maxHeight: '90vh',
      data: user
    });
  }

  deleteUser(user: User): void {
    if (!user.id || this.deletingUserId || user.id === this.authService.userUid()) {
      return;
    }
    this.dialog.open(ConfirmationDialogComponent, {
      width: 'min(92vw, 440px)',
      data: {
        title: 'Remover acesso',
        message: `Deseja remover o acesso de ${user.nome} a esta empresa?`,
        confirmLabel: 'Remover acesso',
        destructive: true,
      },
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        void this.removeUser(user);
      }
    });
  }

  openModalAddUser(user: User | null = null): void {
    const empresaId = this.empresaIdAtual();
    if (!empresaId) {
      this.snackBar.open('Nenhuma empresa ativa foi encontrada.', 'Fechar', { duration: 5000 });
      return;
    }
    this.dialog.open(ModalFormUserComponent, {
      width: 'min(92vw, 720px)',
      maxHeight: '90vh',
      data: { user, empresaId },
    });
  }

  accessLabel(access: User['acesso']): string {
    return {
      administrador: 'Administrador',
      usuario: 'Usuário',
      visitante: 'Visitante',
    }[access] ?? 'Não informado';
  }

  private async removeUser(user: User): Promise<void> {
    const empresaId = this.empresaIdAtual();
    if (!empresaId || !user.id) {
      return;
    }
    this.deletingUserId = user.id;
    try {
      await this.usersService.deleteUser(empresaId, user.id);
      this.snackBar.open('Acesso removido com sucesso.', 'Fechar', { duration: 4000 });
    } catch (error: unknown) {
      console.error('Não foi possível remover o acesso do usuário.', error);
      this.snackBar.open(this.errorText(error, 'Não foi possível remover o acesso.'), 'Fechar', {
        duration: 6000,
      });
    } finally {
      this.deletingUserId = null;
    }
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
