# Flux-X Odonto

Aplicação Next.js para agenda, precificação, equipe e financeiro de clínicas de radiologia odontológica. Está em preparação para uso real. O andamento completo está em [docs/mvp-progress.md](docs/mvp-progress.md).

## Identidade visual

A marca, as cores e as regras de uso estão em [docs/identidade-visual-flux-x.md](docs/identidade-visual-flux-x.md). Os arquivos vetoriais ficam em `public/`. Se `public/icon.svg` mudar, execute `bun run brand:icons` para atualizar os ícones PNG usados na instalação do app.

## Desenvolvimento

Requer Bun 1.4.2. Execute `bun install --frozen-lockfile`. Configure `.env` a partir de `.env.example`, com conexão de desenvolvimento, `AUTH_SECRET` aleatório e `APP_ORIGIN` igual ao endereço do app. Execute `bun run dev` e abra `http://localhost:3000`.

Para SQLite local, o exemplo usa `file:./local.db`. Para Turso, use `DATABASE_URL=libsql://...` e `TURSO_AUTH_TOKEN` da sua conta. Nunca envie `.env`, bancos ou backups para repositórios.

`bun run check` executa lint, TypeScript, testes e build. `bun audit --production` confere dependências de produção. Os testes usam banco simulado ou SQLite isolado e não alteram a clínica real. Os testes HTTP iniciam uma instância local do app com banco fictício; isso ainda não substitui a revisão visual em navegador.

## Banco existente e produção

A migration inicial representa o schema legado. Não execute esse SQL em um banco que já contenha as tabelas. O procedimento de baseline, migração monetária e recuperação está em preparação. `db:push` deixou de autorizar perda de dados automaticamente e não deve ser usado como estratégia de atualização de produção.

O ensaio de baseline em arquivo local novo e a inspeção sem alteração estão disponíveis em `db:baseline-copy` e `db:inspect-copy`. Consulte [docs/database-updates.md](docs/database-updates.md). Aplicação no Turso real e migrations posteriores ainda estão pendentes.

`db:rehearse-updates` aplica e verifica as migrations somente em uma cópia local nova do backup. Login, cadastro, rotas e saída agora usam sessões revogáveis. Essa versão exige a tabela `sessao`: ela não foi criada no banco real. Não publicar sem ensaiar e aplicar a atualização controlada. Veja [docs/server-sessions.md](docs/server-sessions.md).

Produção exige `AUTH_SECRET` aleatório com pelo menos 32 caracteres para os contadores e `APP_ORIGIN` com o endereço HTTPS exato, sem caminho. A chave local não é uma chave de publicação. A credencial Turso anteriormente presente no código precisa ser revogada na conta externa, mesmo já tendo sido removida do código.

O workflow de GitHub está preparado; ativação e regras de aprovação dependem de colocar este projeto em um repositório. O app ainda não foi liberado para uso com dados reais.

Login e cadastro têm limites de tentativas. Produção exige configurar o contador Redis compartilhado; sem ele, essas rotas respondem indisponibilidade (503). Instruções e limites da verificação em [docs/auth-rate-limits.md](docs/auth-rate-limits.md).

Dono pode alterar função e desativar/reativar membros sem apagar seus registros. Alterações invalidam os acessos anteriores. A tabela `usuario_acesso` também é obrigatória nesta versão; implantação real ainda pendente. Limites e testes em [docs/user-access.md](docs/user-access.md).

`bun run backup` cria backup criptografado com chave própria. `bun run backup:restore -- arquivo.gobak CAMINHO_ABSOLUTO_NOVO.db` recupera exclusivamente em banco local novo. Configuração, proteção da chave e pendências operacionais em [docs/backups.md](docs/backups.md). Não executar contra dados reais antes do ensaio e da configuração adequada.
