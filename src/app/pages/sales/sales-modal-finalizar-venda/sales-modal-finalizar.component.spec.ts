import { SalesModalComponent } from './sales-modal-finalizar.component';
describe('Pagamento dividido', () => {
  it('retorna todas as formas e o troco sem confirmar duas vezes', () => {
    const close = jasmine.createSpy('close');
    const component = new SalesModalComponent({ close } as never, { total: 60 });
    component.valor.setValue(20); component.adicionarPagamento('credito');
    component.valor.setValue(50); component.adicionarPagamento('dinheiro');
    expect(component.troco()).toBe(10); component.confirmar(); component.confirmar();
    expect(close).toHaveBeenCalledOnceWith({ pagamentos: [{ forma: 'credito', valor: 20 }, { forma: 'dinheiro', valor: 50 }], troco: 10 });
  });
  it('não aceita excedente em Pix nem confirma saldo incompleto', () => {
    const close = jasmine.createSpy('close');
    const component = new SalesModalComponent({ close } as never, { total: 60 });
    component.valor.setValue(80); component.adicionarPagamento('pix');
    expect(component.pagamentosRealizados()).toEqual([]); component.confirmar();
    expect(close).not.toHaveBeenCalled();
  });
  it('retirada de pagamento reabre o saldo e bloqueia a confirmação', () => {
    const component = new SalesModalComponent({ close: jasmine.createSpy() } as never, { total: 0.3 });
    component.valor.setValue(0.1); component.adicionarPagamento('pix');
    component.valor.setValue(0.2); component.adicionarPagamento('debito');
    expect(component.saldoRestante()).toBe(0); component.removerPagamento(0);
    expect(component.saldoRestante()).toBe(0.1); expect(component.podeConfirmar()).toBeFalse();
  });
});
