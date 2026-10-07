# COMMERCIUM

Sistema web multiempresa de gestão e ponto de venda, desenvolvido com Angular, Angular Material, Firebase Authentication e Cloud Firestore.

O acesso aos dados é isolado por tenant em `business/{empresaId}`. A autenticação valida a associação do usuário ao tenant antes de liberar as rotas internas, e as regras do Firestore repetem essa autorização no servidor.

## Requisitos

- Node.js `>=22.12.0 <23`
- npm 11 ou compatível
- Projeto Firebase configurado nos arquivos de environment
- Java 21 ou superior para executar o emulador do Firestore
- Application Default Credentials somente para executar migrações administrativas

## Desenvolvimento

```powershell
npm ci
npm --prefix functions ci
npm start
```

A aplicação fica disponível em `http://localhost:4200`.

### Demonstração local sem dados de produção

Use três terminais, depois de instalar as dependências acima:

```powershell
# 1. Firebase local (Auth, Firestore e Functions)
npm run emulators

# 2. Com os emuladores prontos, preencher dados fictícios
npm run seed:emulator

# 3. Abrir a aplicação conectada exclusivamente aos emuladores
npm run start:emulator
```

Acesse `http://127.0.0.1:4200`, empresa `demo-restaurante`, e-mail `demo@example.test`, senha `demo-local-123`. São credenciais fictícias exclusivas da demonstração. O seed repõe os documentos demonstrativos; não o use para preservar uma sessão de testes. O ambiente `environment.emulator.ts` usa o projeto `demo-commercium-functions`. O comando `npm start` continua usando a configuração de desenvolvimento existente e **não** ativa os emuladores.

## Operação do PDV

- **Frente de caixa:** busque por descrição ou código, use um leitor em modo teclado com sufixo Enter e informe multiplicadores como `2x7891234567895`. A busca por descrição apresenta as opções encontradas. F2 abre o pagamento, F3 solicita a limpeza da venda e F4 posiciona a busca.
- **Pagamento:** combine dinheiro, Pix, crédito e débito. Troco é permitido apenas até o valor entregue em dinheiro. Cartão e Pix são registrados após conferência externa; o aplicativo ainda não cobra na operadora nem confirma Pix automaticamente.
- **Confirmação:** `concluirVenda` recalcula os preços no servidor e grava venda, consumo dos lotes de estoque e entradas de caixa em uma única transação. Falta de estoque ou mudança de preço impede a operação inteira. Quantidades aceitam até três casas decimais.
- **Falha de comunicação:** a solicitação fica guardada em memória e no `sessionStorage`, por empresa, para consulta/reenvio com o mesmo identificador. Use a ação de verificar pagamento pendente na frente de caixa antes de iniciar outro recebimento. Essa recuperação depende da sessão do navegador; não é uma fila offline nem um histórico recuperável após fechar definitivamente a sessão.
- **Cupom:** o comprovante visual usa dados da empresa e do operador e permite impressão explícita. Não é documento fiscal.
- **Caixa:** lançamentos vinculados a vendas não podem ser editados ou excluídos isoladamente. Estorno de venda ainda não foi implementado.

## Comandas e mesas

Em **Comandas e mesas**, abra um atendimento avulso ou vinculado a uma mesa, adicione produtos, registre observações, transfira para uma mesa livre e receba o pagamento dividido. Há uma comanda ativa por mesa. Encerrar por pagamento libera a mesa na mesma transação da venda; cancelar preserva o registro com status de cancelamento.

Alterne entre a grade de quadradinhos com quebra automática de linha e a planta do ambiente. Administradores acessam **Configurar salão** para posicionar mesas, a entrada, balcões, caixas, paredes e outros elementos. Mesas e elementos podem ser arrastados; ao selecionar um objeto, os pontos sobre ele diminuem, giram ou aumentam, e a alça do canto permite redimensionamento livre. As mesas também aceitam ajuste de lugares. As setas do teclado movimentam o item selecionado. Salve para publicar o desenho para os demais operadores. Alterações simultâneas exigem recarregar a versão atual; mesas ocupadas não podem ser removidas.

Além dos formatos quadrado, retangular e circular, **Desenhar mesa** abre um editor de polígono. Cada vértice pode ser arrastado, adicionado ou removido. O desenho salvo entra na biblioteca do salão e pode ser inserido quantas vezes forem necessárias; editar o modelo atualiza as cópias que ainda estão vinculadas a ele.

O salão tem coordenadas lógicas de 1200 × 800, até 80 mesas e de 1 a 30 lugares por mesa. Em telas pequenas, a planta mantém rolagem interna para preservar as posições. Comandas guardam consumo, mas **não reservam estoque**: a disponibilidade é validada no pagamento. Mesas de ambientes/andares diferentes, agrupamento de mesas e divisão dos itens de uma comanda em contas distintas são evoluções futuras.

## Equipamentos e adaptadores

Os contratos ficam em `src/app/interfaces/perifericos.ts` e os tokens de injeção em `src/app/services/perifericos.service.ts`. Para trocar uma implementação, registre um provider Angular como `{ provide: BALANCA_ADAPTER, useClass: MinhaBalancaAdapter }` no módulo, mantendo o contrato correspondente.

| Equipamento | Implementação incluída | Próxima integração |
| --- | --- | --- |
| Leitor de código | `LEITOR_CODIGO_ADAPTER`: USB/Bluetooth em modo teclado; normalização e validação de EAN no PDV | Adaptar normalização ou adicionar transporte para leitores proprietários |
| Balança | `BALANCA_ADAPTER`: Web Serial, texto CR/LF `ST,1.250 kg` / `US,1250 g`, velocidade e unidade configuráveis | Implementar o protocolo do modelo escolhido; homologar peso, estabilidade e unidade no equipamento |
| Cartão | `CARTAO_ADAPTER`: contrato de cobrança/consulta com identificador da operação; implementação manual sem cobrança | Integrar SDK/TEF e conectar o resultado ao recebimento, incluindo reconciliação, cancelamento e idempotência do provedor |
| Senhas | `EXIBIDOR_ADAPTER`: chamada pelo backend, painel ao vivo no navegador, histórico e voz opcional | Implementar saída para um painel físico proprietário |

A tela **Dispositivos e aplicativo** separa leitor, balança, pagamentos, senhas e PWA em abas. As abas de balança e pagamentos incluem simuladores locais para testar a interface sem equipamento físico. O simulador de cartão representa aprovação, recusa ou cancelamento, mas não conversa com uma adquirente nem substitui a homologação TEF. Para integração real, use o simulador/SDK fornecido pelo fabricante ou adquirente e implemente o contrato do adaptador correspondente.

A balança exige navegador com Web Serial, contexto seguro e seleção da porta pelo operador. Apenas leituras estáveis, positivas e recebidas nos últimos três segundos são aceitas no PDV. Celulares e navegadores sem essa API precisam de um adaptador/ponte compatível com o dispositivo. Nenhum equipamento físico foi homologado nesta implementação. Chaves secretas de adquirentes devem permanecer no backend.

Na **Central de senhas**, informe o número e, se necessário, o local de atendimento; depois abra o exibidor em outra aba, monitor ou TV com navegador. A sessão do exibidor precisa estar autenticada na mesma empresa. Ative a voz no próprio dispositivo, se desejado. O painel não concede acesso público aos dados do tenant.

## PWA e conexão

O build de produção gera manifest, ícones instaláveis e service worker Angular. Fontes, ícones e arquivos da interface são locais e entram no cache da aplicação. O Hosting configura revalidação do service worker. A instalação depende de HTTPS (ou localhost) e do suporte do navegador; a tela **Dispositivos e aplicativo** mostra a ação quando disponível. O servidor de desenvolvimento não registra service worker.

Após o primeiro acesso completo, a estrutura da interface pode abrir sem internet. Escritas de comandas e pagamentos exigem conexão; respostas de APIs financeiras não entram no cache do service worker. A aplicação mostra falta de conexão e disponibilidade de atualização, sem recarregar automaticamente durante o atendimento. Não há venda offline, sincronização posterior de estoque ou garantia de acesso autenticado offline. A instalação e os fluxos reais devem ser homologados nos navegadores e dispositivos de destino.

## Marca própria por empresa

Administradores acessam **Marca e cores** para alterar nome, slogan, logotipo e as cores principal, secundária e de fundo do tenant. A tela mostra uma prévia antes de salvar. A identidade fica em `business/{empresaId}/settings/branding`, é aplicada por variáveis CSS e usa cache local apenas para reduzir a troca visual durante o carregamento. O logotipo aceita um asset do aplicativo, uma URL HTTPS ou uma imagem PNG/JPEG/WebP pequena enviada pela tela. Segredos e configurações de integração não fazem parte dessa identidade.

## Arquitetura de atendimento

Novos documentos dentro de `business/{empresaId}`:

```text
settings/salao              mesas, elementos, modelos personalizados e versão
settings/painel             senha atual e últimas chamadas
settings/branding           identidade visual do tenant
orders/{comandaId}          itens, mesa, pessoas, status e versão
table_sessions/{mesaId}     vínculo exclusivo da mesa ocupada
sales/{vendaId}             venda concluída e fingerprint da solicitação
cashflow/{vendaId}_{indice} recebimentos líquidos de troco
```

As callables `salvarSalao`, `salvarIdentidade`, `abrirComanda`, `atualizarComanda`, `concluirVenda` e `chamarSenha` validam autenticação, associação à empresa e dados de entrada. Apenas administradores editam o salão e a identidade visual. As regras bloqueiam escrita direta em vendas, comandas, configuração e ocupação; movimentos manuais de caixa continuam separados. Os contratos novos preservam as coleções existentes. Consumidores antigos que gravam vendas diretamente precisam migrar junto com o frontend.

## Validação

```powershell
npm run build
npm run build:functions
npx ng test --watch=false --browsers=ChromeHeadless
npm run test:rules
npm --prefix functions test
npm run test:functions
npm audit --omit=dev
npm --prefix functions audit --omit=dev
```

Validação local em 07/10/2026: build de produção aprovado; 56 testes Angular, 8 testes puros das Functions, 9 cenários de regras e 15 cenários integrados de usuários, PDV e comandas aprovados. A revisão visual cobriu fluxos principais em desktop e celular, incluindo o login local, a entrada móvel, elementos girados e os controles sobre as mesas. Permanecem avisos de orçamento do bundle/estilos e Moment; a auditoria de produção de 10/09/2026 apontou 3 alertas moderados no frontend e 1 nas Functions na dependência transitiva `qs`/cadeia Express.

## Firebase e segurança

- `firestore.rules` protege dados operacionais por tenant e papel.
- `/users` exige papel `administrador` no tenant.
- `/empresas` exige `administrador` no tenant de sistema `tecmhaicky`.
- O provisionamento de empresas ocorre na callable Function `provisionarEmpresa`, na região `southamerica-east1`.
- O cadastro, a edição e a remoção de acesso de usuários passam pelas callable Functions `provisionarUsuario`, `atualizarUsuario` e `removerAcessoUsuario`. O UID do Authentication é também o ID da associação no tenant ativo.
- A remoção retira a associação da empresa atual e preserva a conta global do Authentication, pois um mesmo usuário pode pertencer a mais de um tenant.
- Escritas diretas em `business/{empresaId}/users` são rejeitadas pelas regras; somente as Functions administrativas mantêm Authentication e Firestore sincronizados.
- A senha inicial do administrador é transitória: segue para a Function e nunca entra no documento da empresa.

Confirme primeiro o alias/projeto Firebase. Publique a Function e o novo frontend antes da migração:

```powershell
npx firebase-tools@15.28.1 deploy --only functions --project prod
npm run deploy
```

### Remoção de senhas legadas

O script administrativo opera em modo de simulação por padrão. Ele usa Application Default Credentials e não aceita arquivos de credencial versionados.

```powershell
npm run migrate:senha-admin -- --project=curso-angular-8e009
```

Após revisar os totais, a execução real exige o ID repetido como confirmação:

```powershell
npm run migrate:senha-admin -- --project=curso-angular-8e009 --apply --confirm-project=curso-angular-8e009
```

A execução remove `senhaAdmin`, substitui senhas potencialmente expostas por valores aleatórios não exibidos, revoga sessões e normaliza o papel do administrador. Os administradores afetados devem usar **Recuperar senha** no próximo acesso.

Depois da migração, publique as regras:

```powershell
npx firebase-tools@15.28.1 deploy --only firestore:rules --project prod
```

Essa ordem garante que os documentos de associação recebam o campo `acesso` antes de as regras passarem a exigi-lo.

## Deploy

Esta revisão foi validada localmente e **não foi publicada**. As novas rotas dependem das novas Functions e regras; publicar somente o Hosting não basta. Após aprovação explícita do destino e planejamento da atualização das estações antigas, publique Functions e regras compatíveis e depois o frontend. Mantenha a migração administrativa de senhas como operação separada, conforme descrito acima.

```powershell
npm run deploy
```

O deploy publica `dist/simple/browser` no Firebase Hosting configurado pelo alias `prod`. Confirme o projeto de destino antes de executar o comando.

Consulte `AGENTS.md` para a arquitetura, os padrões de desenvolvimento e as lacunas conhecidas.

## Pendências de operação

- Homologação de TEF/adquirente, confirmação de Pix e protocolos dos equipamentos físicos.
- Emissão fiscal (NFC-e), estornos e conciliação de recebimentos.
- Concorrência na abertura de caixa e revisão completa dos períodos de fechamento.
- Execução administrativa da migração de senhas legadas, antes de considerar aquela exposição remediada.
- Redução dos avisos de orçamento de bundle/estilos e substituição futura do Moment CommonJS.
