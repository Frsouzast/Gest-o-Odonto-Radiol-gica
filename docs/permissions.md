# Quem pode acessar cada informação

Permissões são as regras que definem o que cada pessoa pode consultar ou alterar. Esconder uma aba não protege seus dados: a regra também precisa ser aplicada no servidor.

| Informação ou ação | Dono | Financeiro | Recepção |
| --- | --- | --- | --- |
| Consultar clínica e agenda; cadastrar, editar e remarcar agenda | Sim | Sim | Sim |
| Consultar nome, duração e preço final de procedimentos | Sim | Sim | Sim |
| Consultar custos, margens, relatórios financeiros e motor de preços | Sim | Sim | Não |
| Alterar preços, procedimentos, custos e configuração da clínica | Sim | Sim | Não |
| Consultar equipe, cadastrar membro, mudar função ou desativar acesso | Sim | Não | Não |

`authRequired` exige perfil financeiro/dono por padrão. O acesso operacional precisa ser declarado explicitamente nas rotas de agenda, consulta da clínica, consulta de procedimentos e busca. Funções desconhecidas são recusadas. Sessão, clínica, origem e CSRF continuam sendo verificados; permissão por função não substitui essas verificações.

Para recepção, a consulta de procedimentos seleciona apenas `id`, `nome`, `tempoMinutos` e `precoFinal` no banco. A busca nem consulta as tabelas de convênios e contas a receber. A tela de consulta não monta o editor nem solicita custos, insumos ou motor de preços. O início não solicita relatórios financeiros nem exibe o cartão de custo por minuto. Sem preço definido, informa isso claramente em vez de mostrar zero.

## Verificação local

Testes com Next.js e SQLite fictício inventariam todos os métodos exportados pelas rotas e conferem recusa de mais de 50 operações para recepção, preservando agenda e consultas permitidas. Conferem também respostas reduzidas e manutenção dos dados completos para dono. Testes de contratos verificam os campos selecionados e a ausência de consultas financeiras na busca da recepção.

Navegador conferido com dados fictícios: login da recepção, consulta com e sem preço, atualização da página, saída e novo login como dono; lista de usuários e janela Gerenciar acesso em tamanho de celular (390 × 844). Sem salvar alterações de acesso pela interface. Essa revisão não cobre todos os fluxos, duas abas, concorrência, HTTPS ou publicação real.

Para repetir uma revisão visual sem acessar o banco real: `bun run preview:fixture`. O comando cria banco local temporário, aplica as migrations e fornece endereço local e contas inteiramente fictícias. Nunca usa o banco definido no `.env`; sobrescreve a configuração do processo de teste. Não usar essas contas/senha em produção. Encerre a prévia antes dos testes automáticos: ambos usam `.next-runtime-test`. No Windows, arquivos fictícios podem permanecer temporariamente se o sistema retiver uma conexão aberta.

Antes de publicar, aplicar as migrations de sessões/acesso de forma controlada e conferir configuração de produção. Permanecem pendentes validação integral das rotas, auditoria permanente, sincronização entre abas, limpeza de sessões e fluxos de e-mail.
