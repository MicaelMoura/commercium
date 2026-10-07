import { Timestamp } from 'firebase/firestore';
import { ItemVenda } from './sales';
export interface Mesa {
  id: string; nome: string; lugares: number;
  x: number; y: number; largura: number; altura: number;
  formato: 'retangular' | 'redonda' | 'personalizada';
  rotacao: number;
  vertices?: PontoSalao[];
  modeloId?: string;
}
export interface PontoSalao { x: number; y: number; }
export interface ModeloMesa {
  id: string; nome: string; lugares: number;
  largura: number; altura: number; vertices: PontoSalao[];
}
export interface ElementoSalao {
  id: string; tipo: 'entrada' | 'balcao' | 'caixa' | 'parede' | 'decoracao'; nome: string;
  x: number; y: number; largura: number; altura: number; rotacao: number;
}
export interface Salao { mesas: Mesa[]; elementos: ElementoSalao[]; modelos: ModeloMesa[]; versao: number; }
export interface Comanda {
  id: string; nome: string; pessoas: number; mesaId: string | null;
  status: 'ABERTA' | 'CONCLUIDA' | 'CANCELADA';
  itens: ItemVenda[]; total: number; observacao: string; versao: number;
  abertaEm: Timestamp; encerradaEm?: Timestamp; vendaId?: string;
}
export interface PainelSenha {
  numero: number; guiche: string; requestId: string; chamadaEm: Timestamp;
  historico: { numero: number; guiche: string }[];
}
export const SALAO_VAZIO: Salao = { mesas: [], elementos: [], modelos: [], versao: 0 };
export function limitarMesa(mesa: Mesa): Mesa {
  const largura = Math.max(80, Math.min(320, mesa.largura));
  const altura = Math.max(80, Math.min(320, mesa.altura));
  const rotacao = ((Math.round(mesa.rotacao || 0) % 360) + 360) % 360;
  return { ...mesa, largura, altura, rotacao, x: Math.max(0, Math.min(1200 - largura, mesa.x)), y: Math.max(0, Math.min(800 - altura, mesa.y)) };
}
export function limitarElemento(elemento: ElementoSalao): ElementoSalao {
  const largura = Math.max(20, Math.min(600, elemento.largura));
  const altura = Math.max(10, Math.min(500, elemento.altura));
  const rotacao = ((Math.round(elemento.rotacao || 0) % 360) + 360) % 360;
  return { ...elemento, largura, altura, rotacao, x: Math.max(0, Math.min(1200 - largura, elemento.x)), y: Math.max(0, Math.min(800 - altura, elemento.y)) };
}
