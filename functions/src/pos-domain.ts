import { HttpsError } from 'firebase-functions/v2/https';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Dados inválidos.');
  return value as Record<string, unknown>;
}
export function fail(message: string): never { throw new HttpsError('invalid-argument', message); }
export function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) fail('Identificador inválido.');
  return value;
}
export function label(value: unknown, max = 80): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail('Preencha um nome válido.');
  return value.trim();
}
export function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail('Valor numérico inválido.');
  return value;
}
export const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
export interface Line { produtoId: string; quantidade: number; }
export interface Payment { forma: 'dinheiro' | 'pix' | 'debito' | 'credito'; valor: number; }
export function lines(value: unknown): Line[] {
  if (!Array.isArray(value) || value.length > 80) fail('Limite de 80 produtos por atendimento.');
  const seen = new Set<string>();
  return value.map(raw => {
    const item = record(raw);
    const produtoId = id(item['produtoId']);
    if (seen.has(produtoId)) fail('Produtos repetidos devem ser agrupados.');
    seen.add(produtoId);
    const quantidade = number(item['quantidade'], 0.001, 99999);
    if (Math.abs(quantidade * 1000 - Math.round(quantidade * 1000)) > 0.000001) fail('Use até três casas decimais na quantidade.');
    return { produtoId, quantidade: Math.round(quantidade * 1000) / 1000 };
  });
}
export function payments(value: unknown, total: number): { pagamentos: Payment[]; troco: number } {
  if (!Array.isArray(value) || !value.length || value.length > 20) fail('Informe os pagamentos.');
  const pagamentos = value.map(raw => {
    const p = record(raw);
    if (!['dinheiro', 'pix', 'debito', 'credito'].includes(String(p['forma']))) fail('Forma de pagamento inválida.');
    return { forma: p['forma'] as Payment['forma'], valor: money(number(p['valor'], 0.01, 99999999)) };
  });
  const pago = money(pagamentos.reduce((sum, p) => sum + p.valor, 0));
  const dinheiro = money(pagamentos.filter(p => p.forma === 'dinheiro').reduce((sum, p) => sum + p.valor, 0));
  const troco = money(pago - total);
  if (troco < 0 || troco > dinheiro) fail('Pagamento insuficiente ou troco superior ao valor em dinheiro.');
  return { pagamentos, troco };
}
export interface Point { x: number; y: number; }
export interface Table { id: string; nome: string; lugares: number; x: number; y: number; largura: number; altura: number; formato: 'retangular' | 'redonda' | 'personalizada'; rotacao: number; vertices?: Point[]; modeloId?: string; }
function rotation(value: unknown): number { return number(value ?? 0, 0, 359, true); }
function points(value: unknown): Point[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 12) fail('Uma forma livre precisa de 3 a 12 vértices.');
  return value.map(raw => { const point = record(raw); return { x: number(point['x'], 0, 100), y: number(point['y'], 0, 100) }; });
}
export function tables(value: unknown): Table[] {
  if (!Array.isArray(value) || value.length > 80) fail('O salão suporta até 80 mesas.');
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.map(raw => {
    const t = record(raw);
    const formato = t['formato'] === 'redonda' ? 'redonda' : t['formato'] === 'personalizada' ? 'personalizada' : 'retangular';
    const mesa: Table = {
      id: id(t['id']), nome: label(t['nome'], 24), lugares: number(t['lugares'], 1, 30, true),
      x: number(t['x'], 0, 1080), y: number(t['y'], 0, 680),
      largura: number(t['largura'], 80, 320), altura: number(t['altura'], 80, 320),
      formato, rotacao: rotation(t['rotacao']),
    };
    if (formato === 'personalizada') mesa.vertices = points(t['vertices']);
    if (t['modeloId'] !== undefined) mesa.modeloId = id(t['modeloId']);
    if (mesa.x + mesa.largura > 1200 || mesa.y + mesa.altura > 800) fail('A mesa deve ficar dentro do salão.');
    if (ids.has(mesa.id) || names.has(mesa.nome.toLowerCase())) fail('Use nomes diferentes para as mesas.');
    ids.add(mesa.id); names.add(mesa.nome.toLowerCase());
    return mesa;
  });
}
export interface RoomElement { id: string; tipo: 'entrada' | 'balcao' | 'caixa' | 'parede' | 'decoracao'; nome: string; x: number; y: number; largura: number; altura: number; rotacao: number; }
export function roomElements(value: unknown): RoomElement[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 120) fail('O salão suporta até 120 elementos estruturais.');
  const ids = new Set<string>();
  return value.map(raw => {
    const item = record(raw); const tipo = String(item['tipo']);
    if (!['entrada', 'balcao', 'caixa', 'parede', 'decoracao'].includes(tipo)) fail('Tipo de elemento inválido.');
    const element: RoomElement = { id: id(item['id']), tipo: tipo as RoomElement['tipo'], nome: label(item['nome'], 32),
      x: number(item['x'], 0, 1180), y: number(item['y'], 0, 790), largura: number(item['largura'], 20, 600),
      altura: number(item['altura'], 10, 500), rotacao: rotation(item['rotacao']) };
    if (element.x + element.largura > 1200 || element.y + element.altura > 800) fail('O elemento deve ficar dentro do salão.');
    if (ids.has(element.id)) fail('Identificador de elemento repetido.'); ids.add(element.id); return element;
  });
}
export interface TableModel { id: string; nome: string; lugares: number; largura: number; altura: number; vertices: Point[]; }
export function tableModels(value: unknown): TableModel[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) fail('A biblioteca suporta até 30 modelos de mesa.');
  const ids = new Set<string>();
  return value.map(raw => { const item = record(raw); const model: TableModel = { id: id(item['id']), nome: label(item['nome'], 32),
    lugares: number(item['lugares'], 1, 30, true), largura: number(item['largura'], 80, 320), altura: number(item['altura'], 80, 320), vertices: points(item['vertices']) };
    if (ids.has(model.id)) fail('Identificador de modelo repetido.'); ids.add(model.id); return model;
  });
}
