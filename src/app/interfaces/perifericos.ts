import { Observable } from 'rxjs';
export interface LeituraPeso { quilogramas: number; estavel: boolean; lidaEm: number; }
export interface ConfiguracaoBalanca { baudRate: number; unidade: 'kg' | 'g'; }
export interface BalancaAdapter {
  readonly nome: string; suportado(): boolean;
  conectar(config: ConfiguracaoBalanca): Promise<void>;
  desconectar(): Promise<void>; readonly leituras$: Observable<LeituraPeso>;
}
export interface LeitorCodigoAdapter { readonly nome: string; normalizar(entrada: string): string; }
export interface SolicitacaoCartao { operacaoId: string; centavos: number; modalidade: 'credito' | 'debito'; }
export interface ResultadoCartao { status: 'aprovado' | 'recusado' | 'pendente'; referencia?: string; }
export interface PagamentoCartaoAdapter {
  readonly nome: string; readonly automatico: boolean;
  cobrar(solicitacao: SolicitacaoCartao): Promise<ResultadoCartao>;
  consultar(operacaoId: string): Promise<ResultadoCartao>;
}
export interface ExibidorSenhaAdapter { exibir(numero: number, guiche?: string): Promise<void>; }
