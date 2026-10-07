import { interpretarPeso } from './perifericos.service';
describe('Balança serial', () => {
  it('converte gramas e vírgula decimal sem tratar peso instável como estável', () => {
    expect(interpretarPeso('ST,1250 g', 'kg')?.quilogramas).toBe(1.25);
    expect(interpretarPeso('ST;1,250 kg', 'g')?.quilogramas).toBe(1.25);
    expect(interpretarPeso('US,1.250 kg', 'kg')?.estavel).toBeFalse();
  });
  it('rejeita peso sem status, negativo e quadros desconhecidos', () => {
    expect(interpretarPeso('1.250 kg', 'kg')).toBeNull();
    expect(interpretarPeso('ST,-1.250 kg', 'kg')).toBeNull();
    expect(interpretarPeso('OVERLOAD', 'kg')).toBeNull();
  });
});
