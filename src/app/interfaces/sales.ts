export type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito';

export interface Pagamento { forma: FormaPagamento; valor: number; }
export interface ResultadoPagamento { pagamentos: Pagamento[]; troco: number; }
export interface VendaInput {
  vendaId: string; itens?: { produtoId: string; quantidade: number }[];
  comandaId?: string; versao?: number; total: number; pagamentos: Pagamento[];
}

export interface ItemVenda {
  id?: string;
  produtoId: string;
  descricao: string;
  codigoBarras: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

export interface Venda {
  id?: string;
  data: Date;
  itens: ItemVenda[];
  total: number;
  status: 'ABERTA' | 'CONCLUIDA' | 'CANCELADA';
  formaPagamento: FormaPagamento;

  nfeSefaz?: {
    chaveAcesso: string;
    protocolo: string;
    urlDanfe: string; 
    xmlString?: string;
    statusSefaz: 'AUTORIZADA' | 'REJEITADA' | 'PENDENTE';
  };
}
