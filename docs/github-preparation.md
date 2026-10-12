# Preparação do código para o GitHub

GitHub guarda os arquivos e o histórico do projeto. Enviar código não significa instalar o app na internet nem atualizar o banco da clínica.

Em 11/10/2026, o projeto informado foi conferido pelo conector do GitHub: `Frsouzast/Gest-o-Odonto-Radiol-gica`, público, branch principal `main`, apenas README na raiz e nenhuma execução de GitHub Actions. Esta pasta de trabalho não tinha histórico Git nem ligação com esse projeto. O usuário autorizou preparar o envio, sem publicação nesta etapa.

## Seleção para preparação

Somente código em `src`, scripts TypeScript, testes TypeScript, migrations/schema Prisma, documentação de operação, arquivos estáticos de `public`, workflow e configurações necessárias. Incluir `.env.example` com exemplos; nunca `.env` real.

Excluir banco local, backups, arquivos de ambiente reais, dependências instaladas, builds, logs, resultados de ferramentas, anotações de trabalhos anteriores, configuração local de servidor e capturas de tela. Os diretórios excluídos permanecem no computador; não foram apagados. A seleção deve conferir também se nenhuma credencial real do ambiente está embutida no conteúdo dos arquivos destinados ao envio, sem imprimir os valores.

Preparar em cópia separada ligada ao histórico existente do GitHub. Não inicializar nem sobrescrever o trabalho original. Não criar commit, enviar arquivos ou alterar configuração do GitHub automaticamente nesta etapa. A preparação não é garantia de ausência de todo dado sensível: revisar o conjunto selecionado antes da publicação pública e não usar `git add .` sobre a pasta original sem inspeção.

Cópia local criada em pasta vizinha `gestao-odonto-github-preparado-20261011`, a partir do histórico remoto `b68d728` (Initial commit), com 195 arquivos selecionados. O README original do GitHub continua preservado no histórico dessa cópia. Comparação dos conteúdos com os três valores sensíveis configurados localmente sem ocorrências; busca adicional por chaves privadas e formatos de tokens GitHub sem ocorrências. Esses resultados não representam uma auditoria geral de segredos/dados pessoais. `.env` real, bancos, backups e capturas não foram copiados. Nenhum commit ou envio realizado.

## Antes de publicar

1. Conferir arquivos selecionados e autorizar o envio público. Senhas/chaves/bancos não entram no conjunto.
2. Registrar a versão no histórico e enviar por branch separada para revisão. A verificação automática só poderá ser comprovada depois do envio e execução no GitHub.
3. Não tratar envio como implantação. A instalação ainda exige migrations controladas, contador Redis, HTTPS, backups externos, rotação da credencial Turso exposta e os demais itens de [mvp-progress.md](mvp-progress.md).

Nenhum teste local comprova funcionamento de e-mail, infraestrutura ou banco de produção.

## Evidências da cópia separada

`bun install --frozen-lockfile` concluído na cópia, com geração do Prisma Client, sem copiar dependências da pasta original. Auditoria de produção: nenhuma vulnerabilidade conhecida entre 256 pacotes.

Primeira execução completa nessa cópia passou lint, tipos e 101 testes, mas falhou no início da preparação HTTP (cadastro fictício respondeu 500 sem corpo). Causa ainda não determinada. Repetição dos oito testes HTTP com registros de diagnóstico passou. `APP_HTTP_TEST_LOGS=1` permite observar somente a instância de testes fictícios, sem alterar logs do app de produção. Não tratar a repetição bem-sucedida como prova de correção da falha inicial; acompanhar inicialização limpa e execução Linux no GitHub antes de liberar.

Nova execução completa de `bun run check` na cópia separada: lint, tipos, 115 testes e build aprovados. Arquivos selecionados comparados à origem por SHA-256, sem diferenças nessa conferência; dependências e arquivos gerados continuam ignorados. Esse resultado não encerra a investigação da primeira falha de inicialização.
