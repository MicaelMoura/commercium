import { limitarMesa } from './comanda';
describe('Planta do salão', () => {
  it('mantém uma mesa redimensionada dentro dos limites em qualquer tela', () => {
    const mesa = limitarMesa({ id: 'm1', nome: 'Mesa', lugares: 4, x: 1190, y: 790, largura: 500, altura: 500, formato: 'retangular', rotacao: 450 });
    expect(mesa.x + mesa.largura).toBe(1200); expect(mesa.y + mesa.altura).toBe(800);
    expect(mesa.largura).toBe(320);
    expect(mesa.rotacao).toBe(90);
  });
});
