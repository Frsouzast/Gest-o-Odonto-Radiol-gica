# Funções e desativação da equipe

Desativar significa impedir acesso, sem apagar a pessoa ou os registros que ela ajudou a criar. Reativar libera um novo login, mas não torna válida nenhuma credencial encerrada anteriormente.

## Implementação

- Só o dono consulta a lista de usuários e gerencia acesso. `/api/usuarios` retorna apenas identidade, função, data de cadastro e estado ativo; nunca senha ou credenciais.
- `PATCH /api/usuarios/[id]` permite mudar função entre financeiro e recepção e/ou mudar o estado ativo. Exige sessão, origem e CSRF; conteúdo desconhecido, função dono, booleano textual e alteração vazia são recusados.
- Usuário precisa pertencer à clínica do dono. A resposta para usuário externo/inexistente é a mesma (404). Outro perfil recebe 403.
- Esta tela não altera nem desativa donos. Transferência de propriedade exigirá processo próprio com aceitação; não é feita por esta rota.
- Transação confere novamente sessão, estado e função atuais do responsável. Alteração de função/estado e revogação de todas as sessões do membro são atômicas: falha em qualquer parte desfaz tudo.
- Uma repetição sem mudança retorna `alterado: false` sem revogar novos acessos. O cliente envia apenas os campos que a pessoa editou e informa quando nenhuma alteração foi necessária.
- Toda resolução de sessão confere o estado ativo. O login compara senha inclusive de usuário desativado, retorna erro genérico e confere estado, função e hash novamente na transação de criação da sessão. Mudança de senha/desativação durante a comparação não cria acesso com valores antigos.
- Tabela adicional `usuario_acesso`, migration `202610110003_user_access`. Ausência de registro mantém um usuário legado ativo; a atualização não modifica nem apaga usuários existentes. Prisma atualiza a data ao gravar o estado.
- Operações já autenticadas podem estar em andamento; revogação vale para a próxima autenticação. Não representa cancelamento retroativo de requisições iniciadas.

## Evidências e limites

Testes com Next.js em processo separado e SQLite fictício conferem desativação, reativação, função nova, duas credenciais encerradas, preservação do usuário, proteção do dono, outra clínica, funções sem autorização e conteúdo inválido. Testes Prisma isolados conferem rollback em falha de revogação, permissão/sessão atuais dentro da transação, repetição sem mudança e recusa do estado desativado mesmo se existir sessão não revogada. O ensaio aplica as três migrations em uma cópia nova e confere dados legados idênticos.

Lista e janela de gestão conferidas visualmente no navegador, inclusive em tamanho de celular, com contas fictícias e sem salvar alterações pela interface. Ainda faltam sincronização entre abas, auditoria permanente das alterações, convites com aceitação, recuperação de senha e confirmação de e-mail. A descrição antiga de senha temporária trocada automaticamente foi retirada: esse processo ainda não existe. O cadastro atual cria usuário diretamente, sem enviar e-mail, e agora informa isso na tela.

Leitura financeira passou a exigir dono/financeiro no servidor; recepção recebe consulta reduzida de procedimentos e busca sem categorias financeiras. Ver regras e evidências em [permissions.md](permissions.md). Isso não substitui a revisão integral das validações, isolamento, concorrência e implantação.

Nenhuma migration foi aplicada no Turso real. Não publicar esta versão contra banco legado antes de ensaiar e aplicar as atualizações controladas. Não usar `db:push` ou SQL inicial para atualizar tabelas existentes.
