import { createHash } from 'node:crypto';
import { getFirestore, Timestamp, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onCall, CallableRequest } from 'firebase-functions/v2/https';
import { id, label, record, number, money, lines, payments, tables, roomElements, tableModels, Line } from './pos-domain.js';

async function context(request: CallableRequest, admin = false) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre novamente para continuar.');
  const input = record(request.data);
  const empresaId = id(input['empresaId']);
  const db = getFirestore();
  const business = db.collection('business').doc(empresaId);
  const member = await business.collection('users').doc(request.auth.uid).get();
  const role = member.data()?.['acesso'];
  if (admin ? role !== 'administrador' : !['usuario', 'administrador'].includes(role)) {
    throw new HttpsError('permission-denied', 'Você não possui acesso a esta operação nesta empresa.');
  }
  return { input, db, business, uid: request.auth.uid };
}
function conflict(message = 'Este atendimento mudou em outro dispositivo. Recarregue e tente novamente.'): never {
  throw new HttpsError('failed-precondition', message);
}
async function pricedLines(tx: Transaction, business: DocumentReference, input: Line[]) {
  return Promise.all(input.map(async line => {
    const product = await tx.get(business.collection('products').doc(line.produtoId));
    if (!product.exists) conflict('Um dos produtos não está mais disponível.');
    const data = product.data();
    const price = number(data?.['valorUnitarioVenda'], 0.01, 9999999);
    return { ...line, descricao: String(data?.['nome'] ?? ''), codigoBarras: String(data?.['codigoDeBarras'] ?? ''),
      valorUnitario: price, subtotal: money(price * line.quantidade) };
  }));
}

export const salvarSalao = onCall(async request => {
  const { input, db, business } = await context(request, true);
  const mesas = tables(input['mesas']);
  const elementos = roomElements(input['elementos']);
  const modelos = tableModels(input['modelos']);
  const versao = number(input['versao'], 0, Number.MAX_SAFE_INTEGER, true);
  const ref = business.collection('settings').doc('salao');
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    const sessions = await tx.get(business.collection('table_sessions'));
    if ((current.data()?.['versao'] ?? 0) !== versao) conflict('O salão foi alterado por outro administrador. Recarregue antes de salvar.');
    if (sessions.docs.some(s => s.data()['comandaId'] && !mesas.some(m => m.id === s.id))) conflict('Não é possível excluir uma mesa ocupada.');
    tx.set(ref, { mesas, elementos, modelos, versao: versao + 1, atualizadoEm: Timestamp.now() });
  });
  return { versao: versao + 1 };
});

export const abrirComanda = onCall(async request => {
  const { input, db, business, uid } = await context(request);
  const comandaId = id(input['comandaId']);
  const mesaId = input['mesaId'] ? id(input['mesaId']) : null;
  const nome = label(input['nome']);
  const pessoas = number(input['pessoas'], 1, 30, true);
  const ref = business.collection('orders').doc(comandaId);
  await db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    if (previous.exists) {
      if (previous.data()?.['operadorId'] !== uid || previous.data()?.['nome'] !== nome || previous.data()?.['mesaId'] !== mesaId) conflict();
      return;
    }
    if (mesaId) {
      const layout = await tx.get(business.collection('settings').doc('salao'));
      const mesas = tables(layout.data()?.['mesas'] ?? []);
      const mesa = mesas.find(m => m.id === mesaId);
      if (!mesa || pessoas > mesa.lugares) conflict('Verifique a mesa e a quantidade de lugares.');
      const session = business.collection('table_sessions').doc(mesaId);
      const occupied = await tx.get(session);
      if (occupied.data()?.['comandaId']) conflict('Esta mesa já está ocupada.');
      tx.set(session, { comandaId });
    }
    tx.create(ref, { nome, pessoas, mesaId, operadorId: uid, status: 'ABERTA', itens: [], total: 0,
      observacao: '', versao: 1, abertaEm: Timestamp.now(), atualizadaEm: Timestamp.now() });
  });
  return { comandaId };
});

export const atualizarComanda = onCall(async request => {
  const { input, db, business } = await context(request);
  const ref = business.collection('orders').doc(id(input['comandaId']));
  const versao = number(input['versao'], 1, Number.MAX_SAFE_INTEGER, true);
  const action = String(input['acao']);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const current = snapshot.data();
    if (!current || current['status'] !== 'ABERTA' || current['versao'] !== versao) conflict();
    const update = { versao: versao + 1, atualizadaEm: Timestamp.now() };
    if (action === 'itens') {
      const itens = await pricedLines(tx, business, lines(input['itens']));
      const observacao = typeof input['observacao'] === 'string' ? input['observacao'].trim().slice(0, 500) : '';
      tx.update(ref, { ...update, itens, observacao, total: money(itens.reduce((sum, i) => sum + i.subtotal, 0)) });
    } else if (action === 'transferir') {
      const mesaId = input['mesaId'] ? id(input['mesaId']) : null;
      const layout = await tx.get(business.collection('settings').doc('salao'));
      const mesa = tables(layout.data()?.['mesas'] ?? []).find(m => m.id === mesaId);
      if (mesaId && (!mesa || current['pessoas'] > mesa.lugares)) conflict('A mesa não tem lugares suficientes.');
      const target = mesaId ? business.collection('table_sessions').doc(mesaId) : null;
      if (target) {
        const session = await tx.get(target);
        if (session.data()?.['comandaId'] && session.data()?.['comandaId'] !== ref.id) conflict('Esta mesa já está ocupada.');
      }
      if (current['mesaId']) tx.delete(business.collection('table_sessions').doc(id(current['mesaId'])));
      if (target) tx.set(target, { comandaId: ref.id });
      tx.update(ref, { ...update, mesaId });
    } else if (action === 'cancelar') {
      if (current['mesaId']) tx.delete(business.collection('table_sessions').doc(id(current['mesaId'])));
      tx.update(ref, { ...update, status: 'CANCELADA', encerradaEm: Timestamp.now() });
    } else {
      throw new HttpsError('invalid-argument', 'Operação de comanda inválida.');
    }
  });
  return { sucesso: true };
});

export const concluirVenda = onCall(async request => {
  const { input, db, business, uid } = await context(request);
  const vendaId = id(input['vendaId']);
  const ref = business.collection('sales').doc(vendaId);
  const fingerprint = createHash('sha256').update(JSON.stringify({
    uid, itens: input['itens'] ?? null, comandaId: input['comandaId'] ?? null,
    versao: input['versao'] ?? null, total: input['total'], pagamentos: input['pagamentos'],
  })).digest('hex');
  return db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()?.['fingerprint'] !== fingerprint) conflict('Esta venda já foi registrada com outros dados.');
      return { vendaId, total: existing.data()?.['total'], troco: existing.data()?.['troco'] };
    }
    const orderRef = input['comandaId'] ? business.collection('orders').doc(id(input['comandaId'])) : null;
    const order = orderRef ? (await tx.get(orderRef)).data() : null;
    if (orderRef && (!order || order['status'] !== 'ABERTA' || order['versao'] !== input['versao'])) conflict();
    const requested = lines(order ? order['itens'] : input['itens']);
    if (!requested.length) conflict('Adicione ao menos um produto.');
    const itens = await pricedLines(tx, business, requested);
    const total = money(itens.reduce((sum, i) => sum + i.subtotal, 0));
    if (money(number(input['total'], 0.01, 99999999)) !== total) conflict('O preço de um produto mudou. Atualize os itens e revise o pagamento.');
    const { pagamentos, troco } = payments(input['pagamentos'], total);
    const reductions: { ref: DocumentReference; quantidade: number }[] = [];
    for (const item of itens) {
      const stock = await tx.get(business.collection('stock').where('produtoId', '==', item.produtoId));
      let restante = item.quantidade;
      for (const entry of stock.docs) {
        const available = number(entry.data()['quantidade'], 0, 999999999);
        const used = Math.min(available, restante);
        if (used > 0) reductions.push({ ref: entry.ref, quantidade: Math.round((available - used) * 1000) / 1000 });
        restante = Math.round((restante - used) * 1000) / 1000;
        if (restante <= 0) break;
      }
      if (restante > 0) conflict(`Estoque insuficiente: ${item.descricao}. Nenhum lançamento foi feito.`);
    }
    if (reductions.length > 350) conflict('Muitos lotes envolvidos. Consolide o estoque antes de continuar.');
    const now = Timestamp.now();
    for (const reduction of reductions) tx.update(reduction.ref, { quantidade: reduction.quantidade });
    tx.create(ref, { itens, total, pagamentos, troco, formaPagamento: pagamentos[0].forma, status: 'CONCLUIDA',
      data: now, operadorId: uid, comandaId: orderRef?.id ?? null, fingerprint });
    let change = troco;
    pagamentos.forEach((payment, index) => {
      const deduced = payment.forma === 'dinheiro' ? Math.min(change, payment.valor) : 0;
      change = money(change - deduced);
      const valor = money(payment.valor - deduced);
      if (valor > 0) tx.create(business.collection('cashflow').doc(`${vendaId}_${index}`), {
        dataMovimento: now, tipo: 'ENTRADA', descricao: 'Venda PDV', valor,
        formaPagamento: payment.forma, vendaId, operadorId: uid,
      });
    });
    if (orderRef && order) {
      tx.update(orderRef, { status: 'CONCLUIDA', vendaId, encerradaEm: now, versao: order['versao'] + 1 });
      if (order['mesaId']) tx.delete(business.collection('table_sessions').doc(id(order['mesaId'])));
    }
    return { vendaId, total, troco };
  });
});

export const chamarSenha = onCall(async request => {
  const { input, business, db } = await context(request);
  const requestId = id(input['requestId']);
  const numero = number(input['numero'], 1, 9999, true);
  const guicheInput = input['guiche'];
  const guiche = guicheInput === undefined || guicheInput === null || (typeof guicheInput === 'string' && !guicheInput.trim())
    ? ''
    : label(guicheInput, 24);
  const ref = business.collection('settings').doc('painel');
  await db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (data?.['requestId'] === requestId) return;
    const historico = Array.isArray(data?.['historico']) ? data['historico'].slice(0, 4) : [];
    tx.set(ref, { requestId, numero, guiche, chamadaEm: Timestamp.now(), historico: [{ numero, guiche }, ...historico] });
  });
  return { sucesso: true };
});

export const salvarIdentidade = onCall(async request => {
  const { input, business } = await context(request, true);
  const nome = label(input['nome'], 40);
  const slogan = label(input['slogan'], 100);
  const color = (value: unknown): string => {
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new HttpsError('invalid-argument', 'Informe uma cor hexadecimal válida.');
    return value.toLowerCase();
  };
  const logo = String(input['logo'] ?? '');
  const validLogo = logo === 'assets/brand.svg' || /^https:\/\/.{1,500}$/.test(logo) || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]{1,700000}$/.test(logo);
  if (!validLogo) throw new HttpsError('invalid-argument', 'Use uma imagem PNG, JPEG ou WebP, ou uma URL HTTPS válida.');
  await business.collection('settings').doc('branding').set({ nome, slogan, corPrimaria: color(input['corPrimaria']),
    corSecundaria: color(input['corSecundaria']), corFundo: color(input['corFundo']), logo, atualizadoEm: Timestamp.now() });
  return { sucesso: true };
});
