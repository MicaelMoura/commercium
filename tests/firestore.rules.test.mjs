import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-commercium-rules';
let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await Promise.all([
      setDoc(doc(firestore, 'business/tecmhaicky'), { nomeFantasia: 'Sistema' }),
      setDoc(doc(firestore, 'business/tecmhaicky/users/system-admin'), { acesso: 'administrador' }),
      setDoc(doc(firestore, 'business/tenant-a'), { nomeFantasia: 'Tenant A' }),
      setDoc(doc(firestore, 'business/tenant-a/users/user-a'), { acesso: 'usuario' }),
      setDoc(doc(firestore, 'business/tenant-a/users/admin-a'), { acesso: 'administrador' }),
      setDoc(doc(firestore, 'business/tenant-a/users/visitor-a'), { acesso: 'visitante' }),
      setDoc(doc(firestore, 'business/tenant-a/products/product-a'), { nome: 'Produto A' }),
      setDoc(doc(firestore, 'business/tenant-b'), { nomeFantasia: 'Tenant B' }),
      setDoc(doc(firestore, 'business/tenant-b/users/user-b'), { acesso: 'usuario' }),
      setDoc(doc(firestore, 'business/tenant-b/products/product-b'), { nome: 'Produto B' }),
      setDoc(doc(firestore, 'plataform/vOyNkQyF32YgFkc1ijyy/units/un'), { name: 'Unidade' }),
    ]);
  });
});

after(async () => {
  await testEnvironment.cleanup();
});

test('nega dados de negócio para usuário não autenticado', async () => {
  const firestore = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(firestore, 'business/tenant-a/products/product-a')));
});

test('isola leitura e escrita entre tenants', async () => {
  const firestore = testEnvironment.authenticatedContext('user-a').firestore();
  await assertSucceeds(getDoc(doc(firestore, 'business/tenant-a/products/product-a')));
  await assertSucceeds(setDoc(doc(firestore, 'business/tenant-a/products/new-product'), { nome: 'Novo' }));
  await assertFails(getDoc(doc(firestore, 'business/tenant-b/products/product-b')));
  await assertFails(setDoc(doc(firestore, 'business/tenant-b/products/intrusion'), { nome: 'Negado' }));
});

test('visitante não altera dados operacionais', async () => {
  const firestore = testEnvironment.authenticatedContext('visitor-a').firestore();
  await assertSucceeds(getDoc(doc(firestore, 'business/tenant-a/products/product-a')));
  await assertFails(updateDoc(doc(firestore, 'business/tenant-a/products/product-a'), { nome: 'Alteração' }));
});

test('usuário consulta a própria associação, mas não lista usuários', async () => {
  const firestore = testEnvironment.authenticatedContext('user-a').firestore();
  await assertSucceeds(getDoc(doc(firestore, 'business/tenant-a/users/user-a')));
  await assertFails(getDocs(collection(firestore, 'business/tenant-a/users')));
});

test('administrador lista usuários, mas alterações exigem a Function administrativa', async () => {
  const firestore = testEnvironment.authenticatedContext('admin-a').firestore();
  const snapshot = await assertSucceeds(getDocs(collection(firestore, 'business/tenant-a/users')));
  assert.equal(snapshot.empty, false);
  await assertFails(setDoc(doc(firestore, 'business/tenant-a/users/new-user'), { acesso: 'usuario' }));
  await assertFails(updateDoc(doc(firestore, 'business/tenant-a/users/user-a'), { acesso: 'administrador' }));
  await assertFails(setDoc(doc(firestore, 'business/tenant-b/users/intrusion'), { acesso: 'administrador' }));
});

test('somente administrador do sistema lista empresas e senhaAdmin é sempre rejeitada', async () => {
  const regularFirestore = testEnvironment.authenticatedContext('admin-a').firestore();
  await assertFails(getDocs(collection(regularFirestore, 'business')));

  const systemFirestore = testEnvironment.authenticatedContext('system-admin').firestore();
  await assertSucceeds(getDocs(collection(systemFirestore, 'business')));
  await assertSucceeds(updateDoc(doc(systemFirestore, 'business/tenant-a'), { nomeFantasia: 'Tenant A atualizado' }));
  await assertFails(updateDoc(doc(systemFirestore, 'business/tenant-a'), { senhaAdmin: 'nunca-persistir' }));
});

test('dados de plataforma exigem autenticação e escrita administrativa', async () => {
  const anonymousFirestore = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymousFirestore, 'plataform/vOyNkQyF32YgFkc1ijyy/units/un')));

  const userFirestore = testEnvironment.authenticatedContext('user-a').firestore();
  await assertSucceeds(getDoc(doc(userFirestore, 'plataform/vOyNkQyF32YgFkc1ijyy/units/un')));
  await assertFails(setDoc(doc(userFirestore, 'plataform/vOyNkQyF32YgFkc1ijyy/units/kg'), { name: 'Quilo' }));
});

test('comandas, mesas, configurações e vendas isolam tenants e bloqueiam escrita direta', async () => {
  for (const collectionName of ['orders', 'table_sessions', 'settings', 'sales']) {
    const own = testEnvironment.authenticatedContext('user-a').firestore();
    const other = testEnvironment.authenticatedContext('user-b').firestore();
    await assertSucceeds(getDoc(doc(own, `business/tenant-a/${collectionName}/test`)));
    await assertFails(getDoc(doc(other, `business/tenant-a/${collectionName}/test`)));
    await assertFails(setDoc(doc(own, `business/tenant-a/${collectionName}/test`), { status: 'CONCLUIDA' }));
    const admin = testEnvironment.authenticatedContext('admin-a').firestore();
    await assertFails(setDoc(doc(admin, `business/tenant-a/${collectionName}/test`), { total: 0 }));
  }
});

test('movimentações geradas por vendas não podem ser alteradas diretamente', async () => {
  await testEnvironment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'business/tenant-a/cashflow/sale-flow'), { vendaId: 'sale-1', valor: 20 }));
  const firestore = testEnvironment.authenticatedContext('admin-a').firestore();
  await assertFails(updateDoc(doc(firestore, 'business/tenant-a/cashflow/sale-flow'), { valor: 1 }));
  await assertFails(setDoc(doc(firestore, 'business/tenant-a/cashflow/fake-flow'), { vendaId: 'sale-1', valor: 1 }));
  await assertSucceeds(setDoc(doc(firestore, 'business/tenant-a/cashflow/manual'), { tipo: 'ENTRADA', valor: 20 }));
});
