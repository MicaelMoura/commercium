import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lines, payments, roomElements, tableModels, tables } from '../lib/pos-domain.js';

test('pagamento dividido preserva métodos e permite troco apenas do dinheiro', () => {
  assert.deepEqual(payments([{ forma: 'credito', valor: 20 }, { forma: 'dinheiro', valor: 50 }], 60), {
    pagamentos: [{ forma: 'credito', valor: 20 }, { forma: 'dinheiro', valor: 50 }], troco: 10,
  });
  assert.throws(() => payments([{ forma: 'pix', valor: 70 }], 60));
  assert.throws(() => payments([{ forma: 'dinheiro', valor: 5 }], 60));
  assert.throws(() => payments([{ forma: 'dinheiro', valor: NaN }], 60));
});
test('quantidades inválidas e produtos duplicados são rejeitados', () => {
  assert.throws(() => lines([{ produtoId: 'p', quantidade: -1 }]));
  assert.throws(() => lines([{ produtoId: 'p', quantidade: 1 }, { produtoId: 'p', quantidade: 2 }]));
  assert.throws(() => lines([{ produtoId: '../other', quantidade: 1 }]));
  assert.throws(() => lines([{ produtoId: 'p', quantidade: .1234 }]));
  assert.equal(lines([{ produtoId: 'p', quantidade: .1 + .2 }])[0].quantidade, .3);
  assert.equal(lines([{ produtoId: 'p', quantidade: .125 }])[0].quantidade, .125);
});
test('salão rejeita mesas fora da planta, lugares fracionários e nomes repetidos', () => {
  const mesa = { id: 'm1', nome: 'Mesa 1', lugares: 4, x: 10, y: 10, largura: 140, altura: 120, formato: 'retangular', rotacao: 0 };
  assert.equal(tables([mesa]).length, 1);
  assert.throws(() => tables([{ ...mesa, x: 1100 }]));
  assert.throws(() => tables([{ ...mesa, lugares: 2.5 }]));
  assert.throws(() => tables([mesa, { ...mesa, id: 'm2' }]));
});
test('salão aceita formas livres e elementos girados dentro da planta', () => {
  const vertices = [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 70, y: 90 }, { x: 20, y: 80 }];
  const mesa = { id: 'livre', nome: 'Mesa livre', lugares: 6, x: 10, y: 10, largura: 180, altura: 140, formato: 'personalizada', rotacao: 45, vertices };
  assert.equal(tables([mesa])[0].vertices.length, 4);
  const elements = roomElements([
    { id: 'parede1', tipo: 'parede', nome: 'Parede', x: 10, y: 10, largura: 300, altura: 20, rotacao: 90 },
    { id: 'entrada1', tipo: 'entrada', nome: 'Entrada', x: 520, y: 740, largura: 160, altura: 40, rotacao: 0 },
  ]);
  assert.equal(elements[0].rotacao, 90);
  assert.equal(elements[1].tipo, 'entrada');
  assert.equal(tableModels([{ id: 'modelo1', nome: 'Trapézio', lugares: 6, largura: 180, altura: 140, vertices }]).length, 1);
  assert.throws(() => tables([{ ...mesa, vertices: vertices.slice(0, 2) }]));
});
