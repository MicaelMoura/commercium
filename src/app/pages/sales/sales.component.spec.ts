import { FormBuilder } from '@angular/forms';
import { ModalViewProdutoComponent } from '../produtos/modal-view/modal-view-produto.component';
import { Produto } from '../../interfaces/produto';
import { SalesComponent } from './sales.component';

describe('SalesComponent - modos de pesquisa', () => {
  let component: SalesComponent;
  let dialog: { open: jasmine.Spy };

  const produto: Produto = {
    firebaseId: 'produto-1',
    nome: 'Produto teste',
    marca: 'Marca',
    fornecedorId: 'fornecedor-1',
    fornecedorNome: 'Fornecedor',
    valorUnitarioCompra: 5,
    valorUnitarioVenda: 10,
    codigoDeBarras: '7891234567895',
    quantidadeMinima: 1,
    unidadeDeMedida: 'UN',
    pesoNoCodigo: false,
    ncm: '00000000',
    cfop: '5102',
    origem: 0,
    csosn: '102',
  };

  beforeEach(() => {
    dialog = { open: jasmine.createSpy('open') };
    component = new SalesComponent(
      new FormBuilder(),
      { open: jasmine.createSpy('snackBar.open') } as never,
      {} as never,
      { activeTenantId: () => 'tenant-1', userUid: () => 'user-1' } as never,
      {} as never,
      {} as never,
      dialog as never,
      {} as never,
      {} as never,
      {} as never,
      { online: () => true } as never,
    );
  });

  it('adiciona o produto ao carrinho no modo venda', () => {
    component.modoPesquisa.set('venda');
    component.onProdutoSelecionado(produto);

    expect(component.itensVenda().length).toBe(1);
    expect(component.itensVenda()[0].produtoId).toBe('produto-1');
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('abre os detalhes sem alterar o carrinho no modo consulta', () => {
    component.modoPesquisa.set('consulta');
    component.onProdutoSelecionado(produto);

    expect(component.itensVenda()).toEqual([]);
    expect(dialog.open).toHaveBeenCalledOnceWith(
      ModalViewProdutoComponent,
      jasmine.objectContaining({ data: produto }),
    );
  });
});
