import { Component, DestroyRef, OnInit, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CashFlowService } from '../../../services/cashflow.service';
import { ResumoCaixa } from '../../../interfaces/resumo-caixa';
import { FechamentoCaixa } from '../../../interfaces/fechamento-caixa';
import { AuthService } from '../../../services/auth.services';
import { Timestamp } from 'firebase/firestore';

@Component({
    selector: 'app-modal-fechamento-caixa',
    templateUrl: './modal-fechamento-caixa.component.html',
    styleUrls: ['./modal-fechamento-caixa.component.scss'],
    standalone: false
})
export class ModalFechamentoCaixaComponent implements OnInit {

  fechamentoForm!: FormGroup;
  resumoCaixa!: ResumoCaixa;
  valorEsperado: number = 0;
  carregando: boolean = true;
  diferenca: number = 0; // Sobra ou Falta
  
  // Dados injetados pelo CaixaComponent
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ModalFechamentoCaixaComponent>,
    private cashFlowService: CashFlowService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private destroyRef: DestroyRef,
    @Inject(MAT_DIALOG_DATA) public data: { empresaId: string, dataAbertura: Date | Timestamp, valorTrocoInicial: number }
  ) { }

  ngOnInit(): void {
    this.buildForm();
    this.loadCaixaSummary();
    
    // Assina as mudanças do valor contado para calcular a diferença em tempo real
    this.fechamentoForm.controls['valorContado'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(valor => {
      this.calculateDiferenca(valor);
    });
  }

  buildForm(): void {
    this.fechamentoForm = this.fb.group({
      valorContado: [0, [Validators.required, Validators.min(0)]],
      observacoes: ['']
    });
  }
  
  // -----------------------------------------------------
  // 1. CARREGAR RESUMO E CALCULAR VALOR ESPERADO (Passos 1 e 3)
  // -----------------------------------------------------
  async loadCaixaSummary(): Promise<void> {
    this.carregando = true;
    try {

      const dataAbertura = this.data.dataAbertura instanceof Timestamp ? this.data.dataAbertura.toDate() : this.data.dataAbertura;
      // Obtém o resumo de movimentações desde a abertura
      this.resumoCaixa = await this.cashFlowService.getCashFlowSummary(
        this.data.empresaId, 
        dataAbertura
      );

      // Total esperado no caixa (Apenas dinheiro, troco e entradas/saídas de dinheiro)
      // O valor contado pelo operador é sempre em dinheiro.
      const totalMovDinheiro = 
        this.resumoCaixa.totalVendasDinheiro + 
        this.resumoCaixa.totalSuprimentos -
        this.resumoCaixa.totalSangrias;
        
      this.valorEsperado = this.data.valorTrocoInicial + totalMovDinheiro;

    } catch (error) {
      console.error('Erro ao carregar resumo de caixa:', error);
      this.snackBar.open('Erro ao carregar resumo de caixa.', 'Fechar', { duration: 3000 });
      this.closeModal();
    } finally {
      this.carregando = false;
    }
  }

  // -----------------------------------------------------
  // 2. CALCULAR DIFERENÇA (Passos 4 e 5)
  // -----------------------------------------------------
  calculateDiferenca(valorContado: number): void {
    this.diferenca = valorContado - this.valorEsperado;
  }

  // -----------------------------------------------------
  // 3. FINALIZAR FECHAMENTO (Passos 6 e 7)
  // -----------------------------------------------------
  async finalizeFechamento(): Promise<void> {
    if (this.fechamentoForm.invalid) {
      this.fechamentoForm.markAllAsTouched();
      return;
    }

    const operadorUid = this.authService.userUid(); // Quem está fechando
    if (!operadorUid) {
        this.snackBar.open('Operador não identificado.', 'Fechar', { duration: 3000 });
        return;
    }

    this.carregando = true;
    const valorContado = this.fechamentoForm.value.valorContado;
    this.calculateDiferenca(valorContado); // Recalcula a diferença final

    // Prepara o objeto de Fechamento de Caixa
    const fechamentoData: FechamentoCaixa = {
      empresaId: this.data.empresaId,
      operadorUid: operadorUid,
      dataAbertura: this.data.dataAbertura instanceof Timestamp ? this.data.dataAbertura.toDate() : this.data.dataAbertura,
      dataFechamento: new Date(),
      status: 'FECHADO',
      valorInicialTroco: this.data.valorTrocoInicial,
      totalSuprimentos: this.resumoCaixa.totalSuprimentos,
      totalSangrias: this.resumoCaixa.totalSangrias,
      totalVendasDinheiro: this.resumoCaixa.totalVendasDinheiro,
      totalVendasCartaoDebito: this.resumoCaixa.totalVendasCartaoDebito,
      totalVendasCartaoCredito: this.resumoCaixa.totalVendasCartaoCredito,
      totalVendasPix: this.resumoCaixa.totalVendasPix,
      totalOutrasEntradas: 0, // Ajuste conforme seu ResumoCaixa
      totalEntradasLiquidas: this.resumoCaixa.totalVendasDinheiro + this.resumoCaixa.totalSuprimentos,
      totalEsperado: this.valorEsperado,
      valorContado: valorContado,
      diferenca: this.diferenca,
      observacoes: this.fechamentoForm.value.observacoes
    };

    try {
      await this.cashFlowService.saveFechamento(this.data.empresaId, fechamentoData);
      
      // 💡 Retorna para o componente pai para que ele possa atualizar o status
      this.dialogRef.close({ fechamentoConcluido: true }); 
      
      this.snackBar.open('Fechamento de Caixa concluído com sucesso!', 'Fechar', { duration: 4000 });
    } catch (error) {
      console.error('Erro ao fechar caixa:', error);
      this.snackBar.open('Erro ao salvar fechamento.', 'Fechar', { duration: 4000 });
    } finally {
      this.carregando = false;
    }
  }

  closeModal(): void {
    this.dialogRef.close();
  }
}
