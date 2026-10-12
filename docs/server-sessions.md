# Sessões revogáveis: integradas no código, implantação pendente

Uma sessão identifica um acesso que já passou pelo login. Revogá-la significa impedir que aquela credencial seja usada nas próximas requisições. Cookie HttpOnly é um armazenamento que o navegador envia ao servidor, mas o JavaScript da página não consegue ler diretamente. CSRF é uma proteção contra outro site tentar executar uma ação usando uma sessão que já está aberta.

## Implementado nesta etapa

- Migration aditiva `202610110002_sessions`, acrescentando a tabela `sessao`, sem modificar registros de pacientes, clínica ou usuários existentes.
- Serviço `ServerSessions`: credenciais aleatórias de 32 bytes; banco recebe apenas SHA-256 da credencial e da proteção CSRF. Validade absoluta de sete dias, sem renovação silenciosa.
- Resolução consulta usuário, função e estado ativo atuais no banco; não confia em permissões antigas embutidas no navegador. Função desconhecida ou usuário desativado não autentica. Controle de equipe em [user-access.md](user-access.md).
- Revogação individual e de todas as sessões de um usuário; a revogação de um usuário não afeta outro. Requisições já iniciadas podem terminar; a recusa vale para a próxima autenticação no servidor.
- Cookies de produção com prefixo `__Host-`, Secure, SameSite=Lax, caminho `/` e sem Domain. Credencial HttpOnly; proteção CSRF é um cookie separado, legível pelo cliente, sem poder autenticar sozinha.
- Requisições de alteração exigem Origin exato configurado e cabeçalho X-CSRF-Token da própria sessão. Host/X-Forwarded-Host não são usados para decidir origem confiável. Cookie duplicado é recusado.
- Autorização exige origem de configuração válida; em produção ela precisa ser HTTPS, inclusive para leitura. Configuração inválida recusa acesso com 503.

Testes usam Prisma com SQLite em arquivo isolado: criação, hashes, revogação, expiração no limite, alteração de função, isolamento entre usuários, cookies e recusa de origem/CSRF inválidos. Isso não equivale a teste do fluxo do navegador.

## Integração no app

Login e cadastro criam sessões e retornam apenas identidade no JSON. Todas as chamadas de `authRequired` consultam a sessão no banco; não há alternativa JWT/Bearer. `/api/auth/me` restaura identidade e `/api/auth/logout` revoga a sessão antes de limpar cookies. Cadastro grava clínica, usuário e sessão na mesma transação.

O cliente mantém identidade apenas em memória e remove o armazenamento antigo ao iniciar. Alterações enviam CSRF; respostas atrasadas não repovoam outra sessão. Saída com falha mantém a identidade e mostra erro, sem fingir revogação. Dados de consultas são limpos ao mudar a versão da sessão. Respostas da API não devem ser armazenadas em cache.

Testes HTTP iniciam Next.js em processo separado com SQLite fictício: cadastro, login, restauração, saída e recusa de credencial revogada, expiração, função atual, isolamento entre clínicas, Origin/CSRF, recusa de Bearer e rollback de cadastro duplicado. Testes do cliente usam rede e navegador simulados para conferir cabeçalhos, remoção de armazenamento antigo, falhas e respostas atrasadas. Navegador conferido com contas fictícias: login da recepção, restauração ao atualizar a página, saída e novo login como dono. Essa revisão pontual não cobre HTTPS de produção, duas abas ou duas instâncias de implantação.

Próxima integração precisa:

1. Aplicar a migration em ambiente de desenvolvimento/teste isolado e ensaiar o banco real autorizado antes de publicação.
2. Conferir integração em navegador real e ambiente final, sem reintroduzir Bearer antigo como caminho alternativo.
3. Conferir duas abas, troca de usuário e respostas em andamento; falta sincronização explícita entre abas e atualização da identidade ao voltar à página.
4. Configurar APP_ORIGIN exato com HTTPS em produção e conferir proxy/cookies no navegador. Não inferir origem confiável a partir de Host.
5. Estado ativo e revogação na desativação/mudança de função estão integrados. Faltam recuperação/troca de senha e revogação nesses processos; definir limpeza de sessões expiradas.
6. Testar login, refresh, expiração, logout, troca de função e acesso negado em navegador desktop/móvel e em duas instâncias.
7. Antes de promover banco recuperado de backup, invalidar todas as sessões recuperadas e exigir novo login. Não ressuscitar credenciais que haviam sido revogadas depois da data da cópia.

Não foi criada ou alterada a tabela de sessões no Turso real. A existência de código/testes locais não substitui a configuração e os ensaios acima.
