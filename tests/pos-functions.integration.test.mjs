import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const projectId = 'demo-commercium-functions';
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:') && !process.env.FIRESTORE_EMULATOR_HOST?.startsWith('localhost:')) throw new Error('Este teste exige o emulador local.');
const app = initializeApp({ projectId }, 'pos-tests');
const db = getFirestore(app);
const base = `http://127.0.0.1:5001/${projectId}/southamerica-east1`;
let token; let uid; let tenant; let root; let sequence = 0;
async function call(name, data, customToken = token) {
  const response = await fetch(`${base}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${customToken}` }, body: JSON.stringify({ data: { empresaId: tenant, ...data } }) });
  const body = await response.json(); return { ok: response.ok, ...body };
}
function success(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.result ?? result.data; }
function sale(vendaId = crypto.randomUUID(), quantidade = 1) { return { vendaId, itens: [{ produtoId: 'cafe', quantidade }], total: quantidade * 10, pagamentos: [{ forma: 'dinheiro', valor: quantidade * 10 }] }; }
const mesa = (id = 'm1') => ({ id, nome: id, lugares: 4, x: 40, y: 40, largura: 140, altura: 120, formato: 'retangular' });
before(async () => {
  const result = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `pos-${Date.now()}@example.test`, password: 'local-emulator-only', returnSecureToken: true }),
  });
  const data = await result.json(); assert.ok(data.idToken); token = data.idToken; uid = data.localId;
});
beforeEach(async () => {
  tenant = `pos-${Date.now()}-${sequence++}`; root = db.doc(`business/${tenant}`);
  await Promise.all([root.set({ nomeFantasia: 'Loja de teste' }), root.collection('users').doc(uid).set({ acesso: 'administrador' }),
    root.collection('products').doc('cafe').set({ nome: 'CAFÉ', valorUnitarioVenda: 10, codigoDeBarras: '7891234567895' }),
    root.collection('stock').doc('lote1').set({ produtoId: 'cafe', quantidade: 2 }), root.collection('stock').doc('lote2').set({ produtoId: 'cafe', quantidade: 3 })]);
});
after(async () => { await db.terminate(); await deleteApp(app); });
test('venda, múltiplos lotes e pagamentos são atômicos e repetição é idempotente', async () => {
  const input = { ...sale('repeat-sale', 4), pagamentos: [{ forma: 'credito', valor: 25 }, { forma: 'dinheiro', valor: 20 }] };
  const results = await Promise.all([call('concluirVenda', input), call('concluirVenda', input)]); results.forEach(success);
  assert.equal((await root.collection('sales').get()).size, 1);
  const stock = await root.collection('stock').get(); assert.equal(stock.docs.reduce((n, d) => n + d.data().quantidade, 0), 1);
  const cash = await root.collection('cashflow').get(); assert.equal(cash.docs.reduce((n, d) => n + d.data().valor, 0), 40);
  assert.equal((await root.collection('sales').doc('repeat-sale').get()).data().troco, 5);
  assert.equal((await call('concluirVenda', { ...input, total: 20 })).ok, false);
});
test('estoque insuficiente não grava venda nem caixa e não baixa parcialmente', async () => {
  const result = await call('concluirVenda', sale('insufficient', 6)); assert.equal(result.ok, false);
  assert.equal((await root.collection('sales').get()).size, 0); assert.equal((await root.collection('cashflow').get()).size, 0);
  assert.equal((await root.collection('stock').doc('lote1').get()).data().quantidade, 2);
});
test('falha no segundo produto reverte todos os produtos da venda', async () => {
  await root.collection('products').doc('pao').set({ nome: 'PÃO', valorUnitarioVenda: 2 });
  const result = await call('concluirVenda', { ...sale('partial'), itens: [{ produtoId: 'cafe', quantidade: 1 }, { produtoId: 'pao', quantidade: 1 }], total: 12, pagamentos: [{ forma: 'pix', valor: 12 }] });
  assert.equal(result.ok, false); assert.equal((await root.collection('stock').doc('lote1').get()).data().quantidade, 2);
  assert.equal((await root.collection('sales').get()).size, 0); assert.equal((await root.collection('cashflow').get()).size, 0);
});
test('duas vendas concorrentes não consomem o mesmo saldo de estoque', async () => {
  const results = await Promise.all([call('concluirVenda', sale('race1', 4)), call('concluirVenda', sale('race2', 4))]);
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal((await root.collection('sales').get()).size, 1);
});
test('preço manipulado, quantidade negativa e tenant alheio são rejeitados', async () => {
  assert.equal((await call('concluirVenda', { ...sale(), total: 1 })).ok, false);
  assert.equal((await call('concluirVenda', sale('negative', -1))).ok, false);
  assert.equal((await call('concluirVenda', { ...sale(), empresaId: 'tenant-alheio' })).ok, false);
});
test('mesas evitam dupla ocupação e transferência libera a origem', async () => {
  success(await call('salvarSalao', { mesas: [mesa('m1'), mesa('m2')], versao: 0 }));
  const results = await Promise.all(['o1','o2'].map(comandaId => call('abrirComanda', { comandaId, nome: comandaId, pessoas: 2, mesaId: 'm1' })));
  assert.equal(results.filter(r => r.ok).length, 1);
  const comandaId = (await root.collection('table_sessions').doc('m1').get()).data().comandaId;
  success(await call('atualizarComanda', { comandaId, versao: 1, acao: 'transferir', mesaId: 'm2' }));
  assert.equal((await root.collection('table_sessions').doc('m1').get()).exists, false);
  assert.equal((await root.collection('table_sessions').doc('m2').get()).data().comandaId, comandaId);
  assert.equal((await call('atualizarComanda', { comandaId, versao: 1, acao: 'cancelar' })).ok, false);
});
test('fechar comanda paga estoque e caixa e libera a mesa na mesma transação', async () => {
  success(await call('salvarSalao', { mesas: [mesa()], versao: 0 }));
  success(await call('abrirComanda', { comandaId: 'o1', nome: 'Mesa', pessoas: 2, mesaId: 'm1' }));
  success(await call('atualizarComanda', { comandaId: 'o1', versao: 1, acao: 'itens', itens: [{ produtoId: 'cafe', quantidade: 2 }] }));
  const input = { vendaId: 'order-sale', comandaId: 'o1', versao: 2, total: 20, pagamentos: [{ forma: 'pix', valor: 20 }] };
  success(await call('concluirVenda', input)); success(await call('concluirVenda', input));
  assert.equal((await root.collection('orders').doc('o1').get()).data().status, 'CONCLUIDA');
  assert.equal((await root.collection('table_sessions').doc('m1').get()).exists, false);
  assert.equal((await root.collection('cashflow').get()).size, 1);
});
test('edição concorrente, mesa ocupada removida e perfil comum não alteram layout', async () => {
  success(await call('salvarSalao', { mesas: [mesa()], versao: 0 }));
  success(await call('abrirComanda', { comandaId: 'o1', nome: 'Mesa', pessoas: 1, mesaId: 'm1' }));
  assert.equal((await call('salvarSalao', { mesas: [], versao: 1 })).ok, false);
  assert.equal((await call('salvarSalao', { mesas: [mesa()], versao: 0 })).ok, false);
  await root.collection('users').doc(uid).update({ acesso: 'usuario' });
  assert.equal((await call('salvarSalao', { mesas: [mesa()], versao: 1 })).ok, false);
});
test('salão persiste elementos girados e modelos de mesa personalizados', async () => {
  const vertices = [{ x: 8, y: 15 }, { x: 86, y: 5 }, { x: 96, y: 72 }, { x: 42, y: 96 }, { x: 4, y: 70 }];
  const modelo = { id: 'modelo-l', nome: 'Mesa em L', lugares: 6, largura: 190, altura: 150, vertices };
  const personalizada = { ...mesa('m-custom'), nome: 'Mesa especial', formato: 'personalizada', modeloId: modelo.id, vertices, rotacao: 35 };
  const elementos = [
    { id: 'parede-1', tipo: 'parede', nome: 'Divisória', x: 120, y: 80, largura: 260, altura: 20, rotacao: 18 },
    { id: 'caixa-1', tipo: 'caixa', nome: 'Caixa', x: 500, y: 110, largura: 130, altura: 90, rotacao: 270 },
    { id: 'entrada-1', tipo: 'entrada', nome: 'Entrada principal', x: 680, y: 720, largura: 160, altura: 40, rotacao: 15 },
  ];

  success(await call('salvarSalao', { mesas: [personalizada], elementos, modelos: [modelo], versao: 0 }));

  const salao = (await root.collection('settings').doc('salao').get()).data();
  assert.equal(salao.mesas[0].rotacao, 35);
  assert.deepEqual(salao.mesas[0].vertices, vertices);
  assert.equal(salao.elementos[0].tipo, 'parede');
  assert.equal(salao.elementos[1].rotacao, 270);
  assert.equal(salao.elementos[2].tipo, 'entrada');
  assert.equal(salao.modelos[0].nome, 'Mesa em L');
});
test('cancelamento mantém histórico e libera a mesa sem movimento financeiro', async () => {
  success(await call('salvarSalao', { mesas: [mesa()], versao: 0 }));
  success(await call('abrirComanda', { comandaId: 'o1', nome: 'Mesa', pessoas: 1, mesaId: 'm1' }));
  success(await call('atualizarComanda', { comandaId: 'o1', versao: 1, acao: 'cancelar' }));
  assert.equal((await root.collection('orders').doc('o1').get()).data().status, 'CANCELADA');
  assert.equal((await root.collection('table_sessions').doc('m1').get()).exists, false);
  assert.equal((await root.collection('cashflow').get()).size, 0);
});
test('chamada de senha preserva histórico sem repetir a mesma requisição', async () => {
  success(await call('chamarSenha', { requestId: 'q1', numero: 10 }));
  success(await call('chamarSenha', { requestId: 'q1', numero: 10 }));
  success(await call('chamarSenha', { requestId: 'q2', numero: 11, guiche: 'Retirada' }));
  const data = (await root.collection('settings').doc('painel').get()).data();
  assert.equal(data.numero, 11); assert.equal(data.historico.length, 2);
  assert.equal(data.historico[1].guiche, '');
});
test('identidade visual é isolada por empresa e exige administrador', async () => {
  const input = { nome: 'Marca Teste', slogan: 'Atendimento simples', corPrimaria: '#ffca28', corSecundaria: '#302e27', corFundo: '#f8f7f3', logo: 'assets/brand.svg' };
  success(await call('salvarIdentidade', input));
  assert.equal((await root.collection('settings').doc('branding').get()).data().nome, 'Marca Teste');
  await root.collection('users').doc(uid).update({ acesso: 'usuario' });
  assert.equal((await call('salvarIdentidade', { ...input, nome: 'Bloqueada' })).ok, false);
});
