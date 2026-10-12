# Cópia de segurança e recuperação

Backup é uma cópia para recuperar dados perdidos. Restauração é abrir essa cópia em um banco utilizável. Criar um arquivo, sozinho, não comprova que a recuperação funciona.

## Implementado e testado

`bun run backup` substitui o script legado: captura tabelas, índices, views, gatilhos e sequências em uma transação de leitura, confere integridade/referências e gera um arquivo `.gobak` criptografado e autenticado com AES-256-GCM. Não grava JSON legível. Falha de qualquer consulta interrompe o backup inteiro. O arquivo só recebe a extensão final depois de gravado e sincronizado; uma falha de escrita pode deixar `.partial`, que não deve ser tratado como backup concluído.

`bun run backup:restore -- arquivo.gobak CAMINHO_ABSOLUTO_NOVO.db` autentica/descriptografa o arquivo antes de criar o destino. Aceita exclusivamente um novo arquivo SQLite local; não sobrescreve arquivo existente e não restaura diretamente em Turso ou no banco usado pelo app. Todas as tabelas/dados são criados em transação. A verificação exige integridade, referências válidas e contagem idêntica por tabela antes de confirmar. A recuperação cria dados legíveis no destino: proteger a pasta com permissões adequadas.

Testes automatizados usam dados fictícios nas 20 tabelas legadas. Conferem valores e schema exatamente após a recuperação, dados de duas clínicas, remarcação, recebimento parcial, glosa, índices únicos, chaves estrangeiras, blobs, inteiros grandes, valores nulos, autoincremento e gatilhos. Também executam os comandos reais em processos separados. Nunca usam a conexão do `.env` da clínica nesses testes.

## Configuração necessária

- `DATABASE_URL` e, para Turso, `TURSO_AUTH_TOKEN`: conexão da origem.
- Para SQLite, caminhos relativos como `file:./local.db` são resolvidos dentro de `prisma`, assim como no Prisma. O arquivo precisa existir e conter todas as tabelas do app; conexão errada/incompleta falha em vez de publicar um backup vazio. Um URL `file:///...` aponta para caminho absoluto. URLs locais com parâmetros precisam ser substituídos pelo caminho absoluto do arquivo físico para este comando.
- `BACKUP_ENCRYPTION_KEY`: chave própria com 32 bytes aleatórios, representada por 64 caracteres hexadecimais. Não usar a chave JWT, senha de usuário ou exemplo fixo. Guardar a chave em um cofre de senhas/secrets separado dos backups e testar acesso de recuperação. Sem a chave, o backup é irrecuperável.
- `BACKUP_DIRECTORY`: diretório de destino, por padrão `backup`. Deve ter espaço livre, acesso restrito e nunca ser publicado pelo servidor web.

Os comandos retornam código 0 somente após concluir, ou 1 em falha. Logs não mostram senha, token ou registros. O comando de backup registra o caminho do arquivo; o de recuperação registra contagens e SHA-256 do arquivo criptografado.

Em sistemas POSIX, arquivos são solicitados com permissão 0600 e pasta 0700. No Windows, essas opções não substituem ACLs: restringir permissões da pasta à conta do serviço e aos responsáveis pela recuperação.

## Operação ainda pendente

1. Escolher armazenamento fora do computador/servidor principal e definir quem pode recuperar a chave. Arquivo e chave no mesmo disco não protegem contra perda daquele disco.
2. Configurar execução diária no agendador do ambiente de produção com a conta de serviço e variáveis protegidas. Considerar execução adicional antes de atualização de dados. Não foi criado agendamento sobre a conexão real.
3. Monitorar último backup concluído, espaço livre e falhas. Não considerar a presença de um `.partial` como sucesso. Configurar alerta quando passar mais de 24 horas sem sucesso.
4. Definir retenção após revisar necessidades da clínica e privacidade; não apagar cópias antigas automaticamente antes dessa decisão.
5. Fazer ensaio com cópia autorizada do banco real em ambiente isolado, validar fluxos de login/agenda/financeiro e medir tempo de recuperação. O teste com dados fictícios não substitui esse ensaio.
6. Preparar e testar promoção do banco recuperado para o ambiente final, com interrupção controlada e plano de retorno. Não há restauração automática sobre produção.

Os arquivos JSON legados não foram apagados: continuam sensíveis e devem permanecer restritos até existir substituição real verificada. Depois disso, planejar descarte seguro, sem excluir a única cópia recuperável.

## Limitações explícitas

Esta versão tem limite de 200.000 registros no total e 100 MiB de conteúdo JSON antes da criptografia; usa memória para montar o arquivo. Bancos maiores exigem fluxo de backup dedicado. Tabelas virtuais/FTS não são suportadas e provocam falha explícita, nunca omissão silenciosa. Dependências de extensões/custom functions precisam de estratégia própria. O backup lógico preserva colunas do app, não configurações de implantação, arquivos externos, permissões de conta nem o rowid implícito de tabelas sem chave explícita.

Transações locais SQLite foram testadas, incluindo paginação de 1.001 registros com escrita concorrente: a captura mantém os valores do mesmo snapshot. Snapshot, limites e tempo de transação no Turso remoto ainda precisam de ensaio. Referência de implementação: [cliente libSQL oficial](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html).

Se a restauração falhar depois de criar o arquivo de destino, o rollback impede confirmação dos dados; ainda pode sobrar um arquivo vazio/inválido. O comando avisa a falha e não remove esse arquivo automaticamente. Não usá-lo sem nova verificação. A correção não altera backups legados nem dados da origem.
