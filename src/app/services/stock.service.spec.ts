import { calculateRemainingStock } from './stock.service';

describe('calculateRemainingStock', () => {
  it('calcula o saldo restante sem permitir valor negativo', () => {
    expect(calculateRemainingStock(10, 4)).toBe(6);
  });

  it('rejeita baixa maior que o estoque disponível', () => {
    expect(() => calculateRemainingStock(3, 4)).toThrowError('Estoque insuficiente para concluir a baixa.');
  });

  it('rejeita quantidade de baixa inválida', () => {
    expect(() => calculateRemainingStock(10, 0)).toThrowError('A quantidade da baixa deve ser maior que zero.');
    expect(() => calculateRemainingStock(10, Number.NaN)).toThrowError('A quantidade da baixa deve ser maior que zero.');
  });
});
