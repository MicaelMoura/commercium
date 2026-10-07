import { NAME_SOFTWARE, SLOGAN } from '../../constants';

export interface IdentidadeVisual {
  nome: string;
  slogan: string;
  corPrimaria: string;
  corSecundaria: string;
  corFundo: string;
  logo: string;
}

export const IDENTIDADE_PADRAO: IdentidadeVisual = {
  nome: NAME_SOFTWARE,
  slogan: SLOGAN,
  corPrimaria: '#ffca28',
  corSecundaria: '#302e27',
  corFundo: '#f8f7f3',
  logo: 'assets/brand.svg',
};
