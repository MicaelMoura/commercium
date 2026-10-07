import { Timestamp } from 'firebase/firestore';

export interface CashFlow {
    id?: string; 
    vendaId?: string;
    tipo: 'ENTRADA' | 'SAÍDA';
    descricao: string;
    valor: number;
    dataMovimento: Date | Timestamp;
    formaPagamento: string;
    entidadeId?: string | null; 
}
