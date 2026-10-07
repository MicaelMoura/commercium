import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

export { salvarSalao, abrirComanda, atualizarComanda, concluirVenda, chamarSenha, salvarIdentidade } from './pos.js';

const SYSTEM_TENANT_ID = 'tecmhaicky';

interface EmpresaProvisionamento {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  cidade: string;
  bairro: string;
  cep: string;
  complemento: string;
  emailAdmin: string;
  senhaAdmin: string;
}

type UserAccess = 'visitante' | 'usuario' | 'administrador';

export interface UsuarioProvisionamentoInput {
  empresaId: string;
  nome: string;
  email: string;
  senha: string;
  acesso: UserAccess;
}

export interface UsuarioAtualizacaoInput {
  empresaId: string;
  userId: string;
  nome: string;
  email: string;
  acesso: UserAccess;
}

export interface UsuarioRemocaoInput {
  empresaId: string;
  userId: string;
}

export const provisionarEmpresa = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação obrigatória.');
  }

  const firestore = getFirestore();
  const systemMembership = await firestore
    .doc(`business/${SYSTEM_TENANT_ID}/users/${request.auth.uid}`)
    .get();
  if (systemMembership.data()?.['acesso'] !== 'administrador') {
    throw new HttpsError('permission-denied', 'Acesso administrativo obrigatório.');
  }

  const input = parseProvisioningInput(request.data);
  const auth = getAuth();
  let createdUserUid: string | null = null;

  try {
    const user = await auth.createUser({
      email: input.emailAdmin,
      password: input.senhaAdmin,
      displayName: input.nomeFantasia,
      emailVerified: false,
    });
    createdUserUid = user.uid;

    const companyId = firestore.collection('business').doc().id.toLowerCase();
    const companyReference = firestore.collection('business').doc(companyId);
    const batch = firestore.batch();
    const { senhaAdmin: _transientPassword, ...companyData } = input;

    batch.set(companyReference, {
      ...companyData,
      firebaseId: companyReference.id,
    });
    batch.set(companyReference.collection('users').doc(user.uid), {
      id: user.uid,
      nome: input.nomeFantasia,
      email: input.emailAdmin,
      acesso: 'administrador',
      perfilId: 'administrador',
    });
    await batch.commit();

    return { empresaId: companyReference.id };
  } catch (error: unknown) {
    if (createdUserUid) {
      await auth.deleteUser(createdUserUid).catch(() => undefined);
    }

    const code = getErrorCode(error);
    logger.error('Falha ao provisionar empresa.', { code });
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'O e-mail administrativo já está em uso.');
    }
    throw new HttpsError('internal', 'Não foi possível provisionar a empresa.');
  }
});

export const provisionarUsuario = onCall(async (request) => {
  const callerUid = requireAuthenticatedUid(request.auth?.uid);
  const input = parseUsuarioProvisionamentoInput(request.data);
  const firestore = getFirestore();
  await requireTenantAdmin(firestore, input.empresaId, callerUid);

  const auth = getAuth();
  let createdUserUid: string | null = null;
  try {
    const user = await auth.createUser({
      displayName: input.nome,
      email: input.email,
      emailVerified: false,
      password: input.senha,
    });
    createdUserUid = user.uid;
    await firestore.doc(`business/${input.empresaId}/users/${user.uid}`).create({
      id: user.uid,
      nome: input.nome,
      email: input.email,
      acesso: input.acesso,
      perfilId: input.acesso,
    });
    return { userId: user.uid };
  } catch (error: unknown) {
    if (createdUserUid) {
      await auth.deleteUser(createdUserUid).catch((rollbackError: unknown) => {
        logger.error('Falha ao reverter conta após erro no provisionamento do usuário.', {
          code: getErrorCode(rollbackError),
        });
      });
    }
    throw toUserAdministrationError(error, 'Não foi possível cadastrar o usuário.');
  }
});

export const atualizarUsuario = onCall(async (request) => {
  const callerUid = requireAuthenticatedUid(request.auth?.uid);
  const input = parseUsuarioAtualizacaoInput(request.data);
  const firestore = getFirestore();
  await requireTenantAdmin(firestore, input.empresaId, callerUid);

  const membershipReference = firestore.doc(
    `business/${input.empresaId}/users/${input.userId}`,
  );
  const membership = await membershipReference.get();
  if (!membership.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado nesta empresa.');
  }
  if (callerUid === input.userId && input.acesso !== 'administrador') {
    throw new HttpsError('failed-precondition', 'Você não pode remover o próprio perfil de administrador.');
  }
  if (membership.data()?.['acesso'] === 'administrador' && input.acesso !== 'administrador') {
    await requireAnotherTenantAdmin(firestore, input.empresaId, input.userId);
  }

  const auth = getAuth();
  const previousAuthUser = await auth.getUser(input.userId).catch((error: unknown) => {
    throw toUserAdministrationError(error, 'Conta de autenticação não encontrada.');
  });
  let authUpdated = false;
  try {
    await auth.updateUser(input.userId, {
      displayName: input.nome,
      email: input.email,
    });
    authUpdated = true;
    await membershipReference.update({
      nome: input.nome,
      email: input.email,
      acesso: input.acesso,
      perfilId: input.acesso,
    });
    return { userId: input.userId };
  } catch (error: unknown) {
    if (authUpdated) {
      await auth.updateUser(input.userId, {
        displayName: previousAuthUser.displayName ?? undefined,
        email: previousAuthUser.email,
      }).catch((rollbackError: unknown) => {
        logger.error('Falha ao reverter dados de autenticação do usuário.', {
          code: getErrorCode(rollbackError),
          userId: input.userId,
        });
      });
    }
    throw toUserAdministrationError(error, 'Não foi possível atualizar o usuário.');
  }
});

export const removerAcessoUsuario = onCall(async (request) => {
  const callerUid = requireAuthenticatedUid(request.auth?.uid);
  const input = parseUsuarioRemocaoInput(request.data);
  const firestore = getFirestore();
  await requireTenantAdmin(firestore, input.empresaId, callerUid);

  if (callerUid === input.userId) {
    throw new HttpsError('failed-precondition', 'Você não pode remover o próprio acesso.');
  }

  const membershipReference = firestore.doc(
    `business/${input.empresaId}/users/${input.userId}`,
  );
  const membership = await membershipReference.get();
  if (!membership.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado nesta empresa.');
  }
  if (membership.data()?.['acesso'] === 'administrador') {
    await requireAnotherTenantAdmin(firestore, input.empresaId, input.userId);
  }

  await membershipReference.delete();
  return { userId: input.userId };
});

export function parseUsuarioProvisionamentoInput(value: unknown): UsuarioProvisionamentoInput {
  const data = requiredObject(value);
  return {
    empresaId: requiredTenantId(data['empresaId']),
    nome: requiredString(data['nome'], 'nome', 3, 120),
    email: requiredEmail(data['email'], 'email'),
    senha: requiredString(data['senha'], 'senha', 12, 128),
    acesso: requiredUserAccess(data['acesso']),
  };
}

export function parseUsuarioAtualizacaoInput(value: unknown): UsuarioAtualizacaoInput {
  const data = requiredObject(value);
  return {
    empresaId: requiredTenantId(data['empresaId']),
    userId: requiredUserId(data['userId']),
    nome: requiredString(data['nome'], 'nome', 3, 120),
    email: requiredEmail(data['email'], 'email'),
    acesso: requiredUserAccess(data['acesso']),
  };
}

export function parseUsuarioRemocaoInput(value: unknown): UsuarioRemocaoInput {
  const data = requiredObject(value);
  return {
    empresaId: requiredTenantId(data['empresaId']),
    userId: requiredUserId(data['userId']),
  };
}

function requireAuthenticatedUid(uid: string | undefined): string {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Autenticação obrigatória.');
  }
  return uid;
}

async function requireTenantAdmin(
  firestore: ReturnType<typeof getFirestore>,
  empresaId: string,
  callerUid: string,
): Promise<void> {
  const membership = await firestore.doc(`business/${empresaId}/users/${callerUid}`).get();
  if (membership.data()?.['acesso'] !== 'administrador') {
    throw new HttpsError('permission-denied', 'Acesso administrativo obrigatório.');
  }
}

async function requireAnotherTenantAdmin(
  firestore: ReturnType<typeof getFirestore>,
  empresaId: string,
  excludedUserId: string,
): Promise<void> {
  const administrators = await firestore
    .collection(`business/${empresaId}/users`)
    .where('acesso', '==', 'administrador')
    .limit(2)
    .get();
  if (!administrators.docs.some((document) => document.id !== excludedUserId)) {
    throw new HttpsError('failed-precondition', 'A empresa precisa manter ao menos um administrador.');
  }
}

function requiredObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Dados do usuário inválidos.');
  }
  return value as Record<string, unknown>;
}

function requiredTenantId(value: unknown): string {
  const tenantId = requiredString(value, 'empresaId', 2, 128).toLowerCase();
  if (!/^[a-z0-9_-]{2,128}$/.test(tenantId)) {
    throw new HttpsError('invalid-argument', 'Identificador da empresa inválido.');
  }
  return tenantId;
}

function requiredUserId(value: unknown): string {
  const userId = requiredString(value, 'userId', 1, 128);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) {
    throw new HttpsError('invalid-argument', 'Identificador do usuário inválido.');
  }
  return userId;
}

function requiredUserAccess(value: unknown): UserAccess {
  if (value === 'visitante' || value === 'usuario' || value === 'administrador') {
    return value;
  }
  throw new HttpsError('invalid-argument', 'Perfil de acesso inválido.');
}

function toUserAdministrationError(error: unknown, fallbackMessage: string): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }
  const code = getErrorCode(error);
  logger.error(fallbackMessage, { code });
  if (code === 'auth/email-already-exists') {
    return new HttpsError('already-exists', 'Este e-mail já está cadastrado.');
  }
  if (code === 'auth/user-not-found') {
    return new HttpsError('not-found', 'Conta de autenticação não encontrada.');
  }
  if (code === 'auth/invalid-email') {
    return new HttpsError('invalid-argument', 'E-mail inválido.');
  }
  return new HttpsError('internal', fallbackMessage);
}

function parseProvisioningInput(value: unknown): EmpresaProvisionamento {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Dados de provisionamento inválidos.');
  }

  const data = value as Record<string, unknown>;
  const emailAdmin = requiredEmail(data['emailAdmin'], 'emailAdmin');
  const senhaAdmin = requiredString(data['senhaAdmin'], 'senhaAdmin', 12, 128);

  return {
    razaoSocial: requiredString(data['razaoSocial'], 'razaoSocial', 2, 160),
    nomeFantasia: requiredString(data['nomeFantasia'], 'nomeFantasia', 2, 120),
    cnpj: requiredString(data['cnpj'], 'cnpj', 14, 24),
    endereco: requiredString(data['endereco'], 'endereco', 3, 200),
    telefone: requiredString(data['telefone'], 'telefone', 8, 24),
    email: requiredEmail(data['email'], 'email'),
    cidade: requiredString(data['cidade'], 'cidade', 2, 120),
    bairro: requiredString(data['bairro'], 'bairro', 2, 120),
    cep: requiredString(data['cep'], 'cep', 8, 12),
    complemento: optionalString(data['complemento'], 120),
    emailAdmin,
    senhaAdmin,
  };
}

function requiredString(
  value: unknown,
  field: string,
  minimumLength: number,
  maximumLength: number,
): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `Campo ${field} inválido.`);
  }
  const normalized = value.trim();
  if (normalized.length < minimumLength || normalized.length > maximumLength) {
    throw new HttpsError('invalid-argument', `Campo ${field} inválido.`);
  }
  return normalized;
}

function optionalString(value: unknown, maximumLength: number): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string' || value.trim().length > maximumLength) {
    throw new HttpsError('invalid-argument', 'Campo opcional inválido.');
  }
  return value.trim();
}

function requiredEmail(value: unknown, field: string): string {
  const email = requiredString(value, field, 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', `Campo ${field} inválido.`);
  }
  return email;
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'unknown';
  }
  return 'unknown';
}
