import { NgModule, isDevMode, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ServiceWorkerModule } from '@angular/service-worker';
import { A11yModule } from '@angular/cdk/a11y';
import { ComandasComponent } from './pages/comandas/comandas.component';
import { SalaoComponent } from './pages/salao/salao.component';
import { DispositivosComponent } from './pages/dispositivos/dispositivos.component';
import { SenhasComponent } from './pages/senhas/senhas.component';
import { MesaPersonalizadaDialogComponent } from './pages/salao/mesa-personalizada-dialog.component';
import { PersonalizacaoComponent } from './pages/personalizacao/personalizacao.component';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ButtonComponent } from './components/button/button.component';
import { LoginComponent } from './pages/login/login.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HomeComponent } from './pages/home/home.component';
import { MenuComponent } from './components/menu/menu.component';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UsersComponent } from './pages/users/users.component';
import { ModalFormUserComponent } from './pages/users/modal-form-user/modal-form-user.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { EmpresasComponent } from './pages/empresas/empresas.component';
import { NgxMaskDirective, NgxMaskPipe, provideNgxMask  } from 'ngx-mask';
import { ModalEmpresasFormComponent} from './pages/empresas/modal-form-empresas/modal-form-empresas.component';
import { ModalViewEmpresasComponent} from './pages/empresas/modal-view-empresas/modal-view-empresas.component';
import { FornecedoresComponent } from './pages/fornecedores/fornecedores.component';
import { ModalFormFornecedorComponent } from './pages/fornecedores/modal-form/modal-form-fornecedor.component';
import { ModalViewFornecedorComponent } from './pages/fornecedores/modal-view/modal-view-fornecedor.component';
import { ProdutosComponent } from './pages/produtos/produtos.component';
import { ModalFormProdutoComponent } from './pages/produtos/modal-form/modal-form-produto.component';
import { ModalViewProdutoComponent } from './pages/produtos/modal-view/modal-view-produto.component';
import { StockComponent } from './pages/stock/stock.component';
import { ModalViewStockComponent } from './pages/stock/modal-view/modal-view-stock.component';
import { ModalFormStockComponent } from './pages/stock/modal-cadastro/modal-form-stock.component';
import { CashierComponent } from './pages/cashier/cashier.component';
import { ModalEntradaComponent } from './pages/cashier/entradas/modal-entrada.component';
import { ModalSaidaComponent } from './pages/cashier/saidas/modal-saida.component';
import { ModalFechamentoCaixaComponent } from './pages/cashier/fechamento-caixa/modal-fechamento-caixa.component';
import { ModalAberturaCaixaComponent } from './pages/cashier/abertura-caixa/modal-abertura-caixa.component';
import { SalesComponent } from './pages/sales/sales.component';
import { SalesModalComponent } from './pages/sales/sales-modal-finalizar-venda/sales-modal-finalizar.component';

import { MatInputModule } from '@angular/material/input';
import { MatTableModule} from '@angular/material/table';
import { MatSortModule} from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { paginacaoPortugues } from './components/management-table';
import { ModalViewUserComponent } from './pages/users/modal-view-user/modal-view-user.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatIcon } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatMomentDateModule, MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ConfirmationDialogComponent } from './components/confirmation-dialog/confirmation-dialog.component';
import { PdvActionCardComponent } from './components/pdv-action-card/pdv-action-card.component';
import { PdvProductCardComponent } from './components/pdv-product-card/pdv-product-card.component';
import { PdvProductHistoryComponent } from './components/pdv-product-history/pdv-product-history.component';
import { SaleSummaryComponent } from './components/sale-summary/sale-summary.component';
import { PdvSearchModeToggleComponent } from './components/pdv-search-mode-toggle/pdv-search-mode-toggle.component';


registerLocaleData(localePt);
const BR_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};


@NgModule({
  declarations: [
    ComandasComponent, SalaoComponent, DispositivosComponent, SenhasComponent, MesaPersonalizadaDialogComponent, PersonalizacaoComponent,
    AppComponent,
    ButtonComponent,
    LoginComponent,
    HomeComponent,
    MenuComponent,
    UsersComponent,
    ModalViewUserComponent,
    ModalFormUserComponent,
    EmpresasComponent,
    ModalEmpresasFormComponent,
    ModalViewEmpresasComponent,
    FornecedoresComponent,
    ModalFormFornecedorComponent,
    ModalViewFornecedorComponent,
    ProdutosComponent,
    ModalFormProdutoComponent,
    ModalViewProdutoComponent,
    StockComponent,
    ModalViewStockComponent,
    ModalFormStockComponent,
    CashierComponent,
    ModalEntradaComponent,
    ModalSaidaComponent,
    ModalFechamentoCaixaComponent,
    ModalAberturaCaixaComponent,
    SalesComponent,
    SalesModalComponent,
    PdvActionCardComponent,
    PdvProductCardComponent,
    PdvProductHistoryComponent,
    SaleSummaryComponent,
    PdvSearchModeToggleComponent,
    ConfirmationDialogComponent
  ],
  imports: [
    A11yModule,
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatInputModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatDialogModule,
    MatSelectModule,
    MatIcon,
    MatCardModule,
    MatMomentDateModule,
    MatDatepickerModule,
    MatProgressBarModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTabsModule,

    NoopAnimationsModule,
    NgxMaskDirective, 
    NgxMaskPipe, 
  ],
  providers: [
    { provide: MatPaginatorIntl, useFactory: paginacaoPortugues },
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideNgxMask(),
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },
    { provide: MAT_DATE_FORMATS, useValue: BR_DATE_FORMATS },
  ],
  
  bootstrap: [AppComponent]
})
export class AppModule { }
