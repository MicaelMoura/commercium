import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const app = initializeApp({ projectId: 'demo-commercium-functions' });
const db = getFirestore(app); const auth = getAuth(app);
const uid = 'demo-operador'; const tenant = 'demo-restaurante';
try { await auth.getUser(uid); } catch { await auth.createUser({ uid, email: 'demo@example.test', password: 'demo-local-123', displayName: 'Operador Demo' }); }
const root = db.doc(`business/${tenant}`);
await root.set({ nomeFantasia: 'Casa do Jardim', razaoSocial: 'Restaurante de demonstração', endereco: 'Ambiente local de demonstração' });
await root.collection('users').doc(uid).set({ id: uid, nome: 'Operador Demo', email: 'demo@example.test', acesso: 'administrador', perfilId: 'administrador' });
const produtos = [['cafe','CAFÉ ESPRESSO',8.5,'7891234567895'],['suco','SUCO DE LARANJA',12,'7891234567901'],['pao','PÃO NA CHAPA',9,'7891234567918'],['bolo','BOLO DE CENOURA',14,'7891234567925'],['agua','ÁGUA MINERAL',5,'7891234567932'],['almoco','ALMOÇO POR QUILO',59.9,'7891234567949']];
for(const [id,nome,preco,barcode] of produtos){await root.collection('products').doc(id).set({nome,marca:'Casa do Jardim',fornecedorId:'casa',fornecedorNome:'Produção própria',valorUnitarioCompra:preco/2,valorUnitarioVenda:preco,codigoDeBarras:barcode,quantidadeMinima:10,unidadeDeMedida:id==='almoco'?'kg':'un',pesoNoCodigo:false,ncm:'00000000',cfop:'5102',origem:0,csosn:'102'});await root.collection('stock').doc(id).set({produtoId:id,produtoNome:nome,fornecedorId:'casa',fornecedorNome:'Produção própria',quantidade:100,tipoMovimento:'ENTRADA',validade:'',dataMovimento:Timestamp.now()});}
await db.doc('plataform/vOyNkQyF32YgFkc1ijyy/units/un').set({name:'Unidade'});await db.doc('plataform/vOyNkQyF32YgFkc1ijyy/units/kg').set({name:'Quilograma'});
const mesas = Array.from({length:12},(_,i)=>({id:`mesa-${i+1}`,nome:`Mesa ${String(i+1).padStart(2,'0')}`,lugares:i%4===0?6:4,x:45+(i%4)*285,y:45+Math.floor(i/4)*235,largura:150,altura:140,formato:i%3===0?'redonda':'retangular'}));
await root.collection('settings').doc('salao').set({mesas,versao:1});
for(const i of [1,4,6,9]){const mesa=mesas[i];const orderId=`demo-order-${i}`;await root.collection('orders').doc(orderId).set({nome:mesa.nome,mesaId:mesa.id,pessoas:2,status:'ABERTA',itens:[{produtoId:'cafe',descricao:'CAFÉ ESPRESSO',codigoBarras:'7891234567895',quantidade:2,valorUnitario:8.5,subtotal:17}],total:17,observacao:'',versao:1,abertaEm:Timestamp.now(),operadorId:uid});await root.collection('table_sessions').doc(mesa.id).set({comandaId:orderId});}
await db.terminate(); await deleteApp(app); console.log('Ambiente local de demonstração preparado. Empresa: demo-restaurante.');
