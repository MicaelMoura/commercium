# AGENTS.md

## Escopo

Estas instruções valem para todo o repositório. Antes de alterar código, leia este arquivo, `package.json`, `angular.json`, `src/app/app.module.ts`, `src/app/app-routing.module.ts` e os arquivos diretamente relacionados à tarefa.

## Visão do produto

O projeto é o **COMMERCIUM**, um sistema web de gestão e ponto de venda multiempresa. Cada empresa funciona como um tenant. O sistema reúne autenticação, usuários, empresas, fornecedores, produtos, estoque, vendas e fluxo/abertura/fechamento de caixa.

O repositório ainda usa o nome técnico Angular `simple`; não renomeie projeto, diretórios de build ou scripts sem ajustar todas as referências em `angular.json`, `package.json`, `firebase.json` e SSR.

## Tecnologias e decisões existentes

- Angular 21 com TypeScript 5.9 em modo estrito. O projeto requer Node.js 22.12 ou superior dentro da linha 22.x.
- Arquitetura baseada em `NgModule`; componentes não são standalone.
- Angular Material para tabelas, diálogos, formulários, snackbars, datas e ícones.
- SCSS por componente e estilos globais em `src/styles.scss`.
- Reactive Forms como padrão para formulários; há uso pontual de FormsModule.
- Signals e `computed` para estado local e estado de autenticação; RxJS para streams do Firestore e eventos de formulário.
- Firebase Authentication e Cloud Firestore pela API modular do Firebase JavaScript SDK 12.
- Cloud Functions callable em Node.js 22 para operações administrativas que exigem o Firebase Admin SDK.
- Firebase Hosting para a SPA gerada em `dist/simple/browser`.
- Estrutura SSR/Express gerada pelo Angular presente, embora o deploy configurado seja de SPA estática.
- Karma + Jasmine para testes unitários.
- Locale de datas `pt-BR`, adapter Moment e formato `DD/MM/YYYY`.
- `ngx-mask` para máscaras de entrada e Bootstrap 5 para parte do layout.

Não reintroduza `@angular/fire/compat`, namespaces `firebase/compat` ou a antiga API encadeada `AngularFirestore`. Preserve a API modular de `firebase/auth` e `firebase/firestore`; a inicialização compartilhada e o adapter Observable ficam em `src/app/services/firebase.service.ts`.

## Organização do código

- `src/app/pages/`: páginas e diálogos específicos de cada domínio.
- `src/app/components/`: componentes compartilhados, atualmente menu e botão.
- `src/app/services/`: autenticação e acesso ao Firestore.
- `src/app/interfaces/`: contratos persistidos ou usados pela UI.
- `src/environments/`: configuração Firebase por ambiente.
- `src/constants.ts`: nome e slogan do produto e identificador da empresa administradora do sistema.
- `src/assets/`: imagens da aplicação.

Ao criar uma funcionalidade de domínio, mantenha página, template, SCSS e modais dentro da mesma pasta em `pages`. Mantenha acesso ao Firebase nos serviços; componentes devem coordenar UI, validação e mensagens, não montar caminhos do banco diretamente.

## Modelo multiempresa e Firestore

O tenant ativo é mantido em `AuthService.activeTenantId`. Nunca execute leitura ou escrita de dados de negócio sem um `empresaId` válido. Não use um ID fixo de empresa e não faça fallback silencioso para string vazia.

Estrutura atualmente usada:

```text
business/{empresaId}
  users/{userId}
  supplier/{fornecedorId}
  products/{produtoId}
  stock/{stockId}
  sales/{vendaId}
  cashflow/{movimentoId}
  caixa_fechamento/{registroId}
  orders/{comandaId}
  table_sessions/{mesaId}
  settings/salao
  settings/painel
  settings/branding

plataform/vOyNkQyF32YgFkc1ijyy
  units/{unitId}
  payments/{paymentId}
```

Preserve os nomes efetivamente persistidos, inclusive os nomes em inglês e `caixa_fechamento`. Uma mudança de coleção ou campo exige estratégia explícita de migração e compatibilidade com dados existentes.

Use os IDs retornados por `valueChanges({ idField: ... })` de acordo com cada interface. Há inconsistência histórica entre `id` e `firebaseId`; não amplie essa inconsistência. Ao modificar um domínio, normalize o contrato dentro daquele domínio e ajuste template, componente, serviço e testes juntos.

Datas gravadas no Firestore devem ser tratadas como `Timestamp` na leitura e convertidas para `Date` apenas na borda da UI. Valores monetários e quantidades devem permanecer numéricos; formatação brasileira pertence à apresentação.

## Funcionalidades já implementadas

- Login por empresa, e-mail e senha e recuperação de senha.
- Estado de usuário, tenant e papel por Signals no `AuthService`.
- CRUD de empresas, usuários, fornecedores e produtos. Usuários são provisionados e atualizados por callable Functions no tenant ativo; a remoção exclui somente a associação daquele tenant.
- Cadastro, ajuste, consulta e baixa de estoque.
- PDV com busca de produtos, leitura e validação de EAN, multiplicador de quantidade, etiquetas de balança, seleção de pagamento, registro da venda, baixa do estoque, lançamento no caixa e cupom visual.
- Entradas, saídas, saldo, abertura e fechamento de caixa.
- Tabelas Material com filtro, ordenação e paginação em várias páginas.
- Build de produção e configuração de deploy no Firebase Hosting.
- Comandas avulsas ou vinculadas a mesas, transferência, observações, cancelamento e pagamento dividido; uma comanda ativa por mesa.
- Grade responsiva e planta do salão, com mesas poligonais reutilizáveis, entrada móvel, balcões, caixas, paredes e outros elementos; o editor usa controles visuais para posição, rotação e tamanho, além de lugares, versão e proteção de mesas ocupadas.
- Finalização idempotente no backend: venda, baixa de múltiplos lotes, entradas de caixa e encerramento/liberação da mesa em uma transação. Preços e disponibilidade são validados no servidor.
- Interfaces substituíveis para periféricos, leitor em modo teclado, balança serial de texto ST/US, simuladores locais de balança/cartão e painel de senhas autenticado em tempo real. Cartão permanece com conferência manual, sem cobrança automática.
- Identidade visual por tenant, com edição administrativa de nome, slogan, logotipo e cores e aplicação global por variáveis CSS.
- Manifest, ícones, fontes locais e service worker de produção para PWA. Apenas a estrutura da interface é armazenada em cache; atendimento e pagamentos exigem conexão.
- Ambiente de emuladores e seed com dados fictícios para revisão local, documentados no README.

## Lacunas conhecidas e prioridades

Trate esta lista como dívida já existente. Atualize-a quando uma lacuna for realmente resolvida.

### Prioridade crítica

- A transação de venda está implementada, validada nos emuladores e publicada com PDV, comandas e PWA no alias `prod` em 07/10/2026. Estações antigas que gravavam vendas diretamente precisam ser atualizadas para o frontend compatível com as novas regras.

### Implantação de segurança pendente

- Guards, autorização por papel, restauração segura do tenant e logout Firebase estão implementados no código.
- Os bloqueios de escrita direta em vendas, comandas e mesas e de alteração de lançamentos vinculados a vendas foram publicados no projeto `curso-angular-8e009` em 07/10/2026.
- `senhaAdmin` não integra mais o contrato persistido. O provisionamento usa a callable Function `provisionarEmpresa`, publicada no projeto `curso-angular-8e009` em 21/08/2026.
- O gerenciamento de usuários usa `provisionarUsuario`, `atualizarUsuario` e `removerAcessoUsuario`. As Functions, as regras que bloqueiam escrita direta e o frontend correspondente foram publicados no projeto `curso-angular-8e009` em 21/08/2026.
- A migração `functions/scripts/migrate-remove-senha-admin.mjs` precisa ser executada com credenciais administrativas para remover campos legados, invalidar senhas potencialmente expostas e revogar sessões. Não considere a exposição remediada antes dessa execução.

### Prioridade alta

- Comandas não reservam estoque; a disponibilidade é validada no pagamento. Estorno e conciliação de vendas ainda precisam de fluxo próprio.
- `getQuantidadeEmEstoque` trata resultado vazio, mas ainda consulta um único lote; o checkout novo usa todos os lotes no backend.
- A abertura/fechamento de caixa usa registros na coleção `caixa_fechamento`; revisar o período usado no fechamento e impedir mais de um caixa aberto por empresa/operador.
- A emissão de NFC-e não está implementada. O stub de URL de exemplo foi removido; o cupom visual usa dados reais da empresa/operador e permanece não fiscal.
- Integração automática de cartão/Pix e protocolos proprietários de balança/painel dependem do fornecedor e de homologação física. Os contratos de adaptadores não equivalem a uma integração TEF concluída.
- PWA não implementa vendas offline; instalação e compatibilidade de hardware precisam de homologação nos dispositivos de destino.

### Qualidade e manutenção

- A suíte ainda contém smoke tests gerados; foram acrescentados testes de regras de pagamento, peso, geometria, estoque e integração transacional do PDV.
- Na linha de base de 21/08/2026, a suíte headless executa 47 testes, as regras do Firestore executam 7 cenários, as validações puras das Functions executam 4 testes e o fluxo integrado de usuários executa 3 cenários nos emuladores de Auth, Firestore e Functions. A cobertura ainda inclui smoke tests e deve crescer junto das demais regras de negócio.
- Na revisão local de 10/09/2026 passaram 56 testes Angular, 7 testes puros das Functions e 22 cenários integrados (9 de regras, 3 de usuários e 10 de PDV/comandas). Foram conferidos fluxos principais em desktop e celular, incluindo abertura/pagamento de comanda, arraste/edição de mesa, chamada de senha e cupom. O shell PWA abriu pelo cache com o servidor local desligado; isso não valida operação de negócio offline.
- Na revisão local de 06/10/2026 passaram o build de produção, 56 testes Angular e 8 testes puros das Functions. Antes do ajuste final da entrada móvel, também passaram 12 cenários integrados de PDV/comandas; a nova asserção de persistência da entrada não pôde ser repetida porque o Firestore Emulator falhou ao abrir o loopback nesta estação, mesmo com JDK 21 portátil. A interface final foi conferida em desktop e em 390 × 844, incluindo os controles de aumentar, girar e a entrada móvel.
- Na revisão local de 07/10/2026 passaram o build de produção, 56 testes Angular, 8 testes puros das Functions, 9 cenários de regras e 15 cenários integrados de usuários, PDV e comandas. O Firestore Emulator voltou a operar com Java 21 e `jdk.net.unixdomain.tmpdir` apontando para um diretório temporário nativo do Windows; a persistência da entrada, elementos girados, mesas personalizadas, chamadas de senha, identidade visual e o login local foram retestados.
- Há subscriptions sem estratégia uniforme de descarte, uso frequente de `any`, logs de depuração e mensagens com `alert`/`confirm` misturadas a snackbars.
- Não há lint configurado no `package.json`.
- O README documenta instalação, emuladores, arquitetura, operação, PWA, adaptadores e pendências de publicação.
- O build de 10/09/2026 passa com avisos de bundle inicial (2,27 MB), estilos de menu/login/PDV/resumo/comandas/salão e Moment CommonJS. Os limites de erro e checks estritos foram preservados.
- Auditorias `--omit=dev` de 10/09/2026 apontam três alertas moderados no frontend (cadeia Express/body-parser/qs) e um moderado nas Functions (qs). A auditoria completa também tem pendências do toolchain. Não aplicar correção forçada ou migração principal silenciosa; revisar atualização compatível separadamente.

## Padrões para alterações

- Preserve `strict`, `strictTemplates`, `noImplicitReturns` e os demais checks do `tsconfig.json`; não enfraqueça o compilador para contornar erros.
- Prefira tipos explícitos e interfaces do domínio. Evite novos `any`, non-null assertions e casts de `Timestamp` espalhados.
- Use Reactive Forms com validators e bloqueie persistência quando o formulário estiver inválido.
- Normalize nomes de métodos em português conforme o domínio atual, mas mantenha nomes de coleções/campos persistidos compatíveis.
- Em operações assíncronas, apresente estado de carregamento, trate erro para o usuário e preserve a causa técnica no log sem expor credenciais ou dados pessoais.
- Não deixe `subscribe` aninhado. Prefira composição RxJS, `async` pipe ou descarte com `takeUntilDestroyed`; subscriptions mantidas pelo componente devem ser encerradas.
- Para diálogos, tipar `MAT_DIALOG_DATA` e `MatDialogRef`, retornar um resultado explícito e recarregar dados somente quando houver alteração confirmada.
- Para tabelas, use `MatTableDataSource<T>` em vez de `any` e conecte paginator/sort após a view estar pronta.
- Não faça mutações silenciosas no objeto recebido pelo componente antes de persistir; monte payloads tipados.
- Regras críticas de estoque, caixa, autorização e fiscalidade precisam de testes unitários. Fluxos que atravessam múltiplas coleções também precisam de teste de integração com Firebase Emulator ou backend equivalente.
- Não registre senhas, tokens, configuração sensível, dados pessoais ou payloads completos no console, em fixtures ou documentação.

## Comandos de trabalho

Use a versão travada no `package-lock.json`:

```powershell
npm ci
npm start
npm run build
npm run build:functions
npx ng test --watch=false --browsers=ChromeHeadless
npm run test:rules
npm audit --omit=dev
npm --prefix functions audit --omit=dev
npm run deploy
```

`npm run deploy` altera o ambiente Firebase remoto. Execute somente quando o usuário pedir explicitamente e após confirmar o projeto/alias de destino. Não use `npm audit fix --force` sem autorização e uma tarefa dedicada de atualização.

O script `npm run deploy` publica somente o Hosting. O deploy de `firestore.rules` e Functions é uma operação separada e também exige confirmação explícita do projeto `prod`. A migração de `senhaAdmin` exige `--project`, `--apply` e `--confirm-project` e nunca deve ser executada por suposição.

## Validação obrigatória

Para qualquer alteração de código:

1. Execute `npm run build`.
2. Execute os testes relevantes e, quando possível, a suíte headless completa.
3. Compare falhas com a linha de base descrita acima e informe claramente falhas preexistentes.
4. Para mudanças de UI, verifique a página afetada em largura desktop e móvel, estados vazio/carregando/erro e abertura/fechamento de diálogos.
5. Para mudanças Firebase, valide tenant, caminho, ID do documento, conversão de datas e comportamento em erro/resultado vazio.
6. Para venda, estoque ou caixa, valide falha parcial e consistência entre coleções.

Não afirme que uma alteração está concluída sem relatar os comandos executados e seus resultados. Não corrija dívidas fora do escopo silenciosamente; se uma dívida bloquear a tarefa, explique o bloqueio e proponha uma mudança separada.

## Arquivos gerados e configuração

- Não edite `dist/` nem `node_modules/`.
- Não versione artefatos locais, logs ou resultados de teste.
- Preserve os dois arquivos de environment e o file replacement de desenvolvimento.
- Antes de tocar em configuração Firebase, confirme se o valor pode ser público. Nunca introduza credenciais administrativas, service-account JSON, tokens ou chaves privadas no frontend.
- O deploy atual usa o alias Firebase `prod`; confirme o destino antes de qualquer publicação.

## Checklist de entrega

- A mudança respeita o isolamento por `empresaId`.
- Nenhum segredo ou senha foi persistido/logado.
- Interfaces, serviço, componente e template continuam coerentes.
- Estados de sucesso, vazio, carregamento e erro foram considerados.
- Build e testes relevantes foram executados.
- Pendências conhecidas não foram apresentadas como funcionalidade pronta.
- README e esta lista de lacunas foram atualizados quando a arquitetura ou o estado do produto mudou.
