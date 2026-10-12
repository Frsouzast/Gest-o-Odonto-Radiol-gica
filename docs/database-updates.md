# Atualizações do banco sem recriar os dados existentes

Uma migration é um registro versionado de alteração do banco. Baseline é o registro do ponto de partida: reconhece que as tabelas iniciais já existem, para não tentar criá-las novamente. Esta etapa prepara a adoção desse histórico; não executa a atualização do banco real.

## Ensaio implementado

Executar os comandos na pasta do projeto, com Bun e dependências instaladas.

1. Obter um backup `.gobak` autorizado e configurar sua `BACKUP_ENCRYPTION_KEY`. Os testes usam apenas dados fictícios.
2. `bun run db:baseline-copy -- arquivo.gobak CAMINHO_ABSOLUTO_NOVO.db`: recupera em um arquivo local novo, confere estrutura/integridade e registra `202610110001_baseline` usando o Prisma CLI instalado. Não executa o SQL inicial sobre tabelas existentes. Não aceita destino remoto nem sobrescrita.
3. `bun run db:inspect-copy -- CAMINHO_ABSOLUTO_EXISTENTE.db`: inspeciona sem aplicar atualizações. Retorna 0 se compatível, 2 se há diferença e 1 se a verificação não pôde concluir. Não usa DATABASE_URL como alvo implícito.
4. `bun run db:rehearse-updates -- arquivo.gobak CAMINHO_ABSOLUTO_NOVO.db`: restaura/baselina uma cópia nova, aplica migrations com Prisma CLI somente nessa cópia e exige histórico/estrutura atuais e preservação dos dados existentes. Ensaio local, não publicação.

A comparação inclui tabelas, índices, views/gatilhos, texto SQL, colunas, valores padrão, chaves primárias/estrangeiras e detalhes de índices. Também exige integridade e referências válidas. Quando existe `_prisma_migrations`, confere nome da migration, checksum do SQL, conclusão e ausência de rollback. Não marca novamente um histórico válido já existente.

O ensaio compara a impressão digital da estrutura antes/depois: apenas o histórico de migrations deve ser acrescentado. Uma diferença bloqueia a marcação; não tenta corrigir, apagar ou recriar automaticamente. Comparação do texto SQL é deliberadamente conservadora: diferenças equivalentes de formatação podem exigir revisão manual, nunca aprovação automática.

O verificador carrega todas as migrations versionadas, confere checksums e sequência e compara o schema ao prefixo registrado. `pending` lista alterações ainda não aplicadas. `compatible: true` com `pending` não vazio significa estado antigo conhecido, não banco atualizado. Histórico incompleto, desconhecido, alterado ou schema incompatível impede aprovação.

As migrations de sessões e controle de acesso são aditivas e foram ensaiadas em cópia fictícia: tabelas `sessao` e `usuario_acesso` criadas, três migrations registradas e dados legados preservados. O comando de ensaio atualmente exige que colunas e dados das tabelas existentes permaneçam idênticos, exceto o histórico de migrations. Transformações monetárias futuras precisam de invariantes específicos antes de serem liberadas: este ensaio não pode aprová-las automaticamente.

## Evidências locais

Testes usam arquivos novos e dados fictícios. Comprovam preservação da origem e do backup; estrutura e registros do app idênticos na cópia; rejeição de coluna/índice alterado, CHECK SQL diferente e checksum adulterado; recusa de destino existente, remoto ou chave errada. Os comandos documentados são executados em processos reais.

O Prisma `migrate deploy` foi executado somente na cópia fictícia com baseline registrada: acrescentou sessões sem recriar as tabelas do app. O cliente Prisma utilizado pelo app conseguiu ler clínica e usuário dessa cópia. Isso não comprova migrações futuras, compatibilidade do Turso remoto nem todos os fluxos do aplicativo.

## O que falta antes de atualizar produção

- Conferir o schema real e resolver diferenças com revisão, sem assumir que ele coincide com o SQL inicial.
- Fazer ensaio com cópia autorizada do banco real, backup externo recuperável e chave acessível aos responsáveis.
- Desenvolver e testar as migrations financeiras, de sessões e demais alterações pendentes; verificar valores/relações antes e depois e testar retorno em caso de falha.
- Definir manutenção, bloqueio de escrita concorrente, execução única, alerta e responsável pela aprovação.
- Preparar caminho de aplicação controlada no Turso: o Prisma CLI SQLite local não é prova de suporte à conexão `libsql://` usada pelo app. Não foi aplicado nem marcado histórico no banco remoto.
- Revisar promoção da cópia recuperada ou atualização do banco de produção, com plano de recuperação. Os comandos deste documento não fazem essa promoção.

Não usar `db:push`, `migrate reset` ou o SQL completo inicial como atalho para atualizar um banco com dados. Em caso de falha do ensaio, pode existir uma cópia local não aprovada; não usar como produção.

Referência: [baselining com Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining). A implementação usa a versão 6 instalada no projeto; documentação de outras versões não deve substituir a verificação local.
