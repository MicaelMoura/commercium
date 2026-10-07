import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
// import { HomeComponent } from './pages/home/home.component';
import { UsersComponent } from './pages/users/users.component';
import { EmpresasComponent } from './pages/empresas/empresas.component';
import { ProdutosComponent } from './pages/produtos/produtos.component';
import { FornecedoresComponent } from './pages/fornecedores/fornecedores.component';
import { StockComponent } from './pages/stock/stock.component';
import { CashierComponent } from './pages/cashier/cashier.component';
import { SalesComponent } from './pages/sales/sales.component';
import { authGuard } from './guards/auth.guard';
import { authorizationGuard } from './guards/authorization.guard';
import { ComandasComponent } from './pages/comandas/comandas.component';
import { SalaoComponent } from './pages/salao/salao.component';
import { DispositivosComponent } from './pages/dispositivos/dispositivos.component';
import { SenhasComponent } from './pages/senhas/senhas.component';
import { pendingChangesGuard } from './guards/pending-changes.guard';
import { PersonalizacaoComponent } from './pages/personalizacao/personalizacao.component';

const tenantAccess = {
  canActivate: [authGuard, authorizationGuard],
  data: { roles: ['usuario', 'administrador'] },
};

const routes: Routes = [
  {path: '', redirectTo: 'login', pathMatch: 'full' },
  {path: 'login', component: LoginComponent},
  {path: 'login/:business', component: LoginComponent },
  // {path: 'home', component: HomeComponent},
  {
    path: 'users',
    component: UsersComponent,
    canActivate: [authGuard, authorizationGuard],
    data: { roles: ['administrador'] },
  },
  {
    path: 'empresas',
    component: EmpresasComponent,
    canActivate: [authGuard, authorizationGuard],
    data: { roles: ['administrador'], systemTenantOnly: true },
  },
  {path: 'produtos', component: ProdutosComponent, ...tenantAccess},
  {path: 'fornecedores', component: FornecedoresComponent, ...tenantAccess},
  {path: 'stock', component: StockComponent, ...tenantAccess},
  {path: 'cashier', component: CashierComponent, ...tenantAccess},
  {path: 'vendas', component: SalesComponent, canDeactivate: [pendingChangesGuard], ...tenantAccess},
  {path: 'comandas', component: ComandasComponent, ...tenantAccess},
  {path: 'dispositivos', component: DispositivosComponent, ...tenantAccess},
  {path: 'senhas', component: SenhasComponent, ...tenantAccess},
  {path: 'salao', component: SalaoComponent, canActivate: [authGuard, authorizationGuard], canDeactivate: [pendingChangesGuard], data: { roles: ['administrador'] }},
  {path: 'personalizacao', component: PersonalizacaoComponent, canActivate: [authGuard, authorizationGuard], data: { roles: ['administrador'] }},
  {path: '**', redirectTo: 'login'},
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes)
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
