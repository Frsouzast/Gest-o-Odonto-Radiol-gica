# Preparação para uso real

Objetivo: executar todas as melhorias sugeridas na avaliação de MVP. Esta lista não declara o app pronto; registra o trabalho e o que ainda deve ser comprovado.

## Já implementado

- Credencial Turso removida do código. A revogação da credencial antiga na conta externa ainda está pendente.
- JWT/Bearer removido do login e das rotas. Credencial aleatória em cookie HttpOnly e apenas hashes no banco; produção exige configuração própria de origem e chave dos contadores.
- Build exige verificação de TypeScript; erros originais corrigidos. Modo estrito do React reativado.
- Proteção por clínica nas rotas de glosas, preços de convênios e insumos de procedimentos; referências de contas a receber também verificadas.
- Dependências atualizadas e pacotes sem uso removidos; auditoria de produção sem vulnerabilidades conhecidas na execução local.
- Validação central de login, cadastro, convite, criação de contas e atualização de contas/glosas. Valores negativos, status desconhecidos e datas inexistentes são recusados.
- Pagamentos parciais considerados no saldo a receber, histórico e projeções. Somas desses relatórios feitas em centavos.
- Primeiros testes de cálculos, autenticação, validação, contratos HTTP e schema SQLite em memória. Contratos HTTP usam banco simulado; ainda faltam testes de ponta a ponta com banco real isolado.
- SQL inicial versionado, sem executar nenhuma mudança no banco remoto.
- Verificação automática preparada para GitHub. Esta pasta não é um repositório Git; pipeline ainda não foi executado no GitHub nem configurado como regra de aprovação.
- Texto incorreto de armazenamento local corrigido; zoom acessível liberado.
- Dados temporários das consultas são limpos ao trocar usuário ou clínica. Respostas de sessão inválida encerram a sessão local.
- Referência de equipamento em procedimento exige a mesma clínica. Alteração de preço e seu histórico gravados juntos em transação.
- Agenda: cadastro, edição e remarcação validam datas reais, horário de 00:00 a 23:59, nomes e booleanos; consulta exige dia ou período ordenado, sem misturar os filtros. Atualizações reforçam o filtro da clínica.
- Capacidade produtiva exige dias inteiros entre 1 e 31, horas acima de zero até 24, unidades inteiras positivas e ocupação entre 0% e 100%. Ocupação zero preservada por compatibilidade; formulário avisa e APIs de precificação recusam o cálculo sem produção.
- Procedimentos recusam tempos/custos negativos e percentuais fora de 0% a 100%. A alteração confere a soma de comissão, lucro, inadimplência, impostos, cartão e outros contra os valores já salvos; soma deve ficar abaixo de 100%. Retrabalho não entra nessa soma, conforme o motor atual.
- Mensagens de erro nos formulários incluem até três orientações de validação, em vez de mostrar só um aviso genérico.
- Login/cadastro têm limites por origem e e-mail, contador Redis compartilhado obrigatório em produção, respostas 429 com tempo de espera e recusa temporária 503 se o contador estiver indisponível. Desenvolvimento usa memória limitada. Configuração externa ainda pendente; não declarar proteção de produção comprovada. Ver [auth-rate-limits.md](auth-rate-limits.md).
- IP só é considerado quando um proxy confiável foi explicitamente configurado; cabeçalhos forjados são ignorados por padrão. Chaves de contagem são pseudonimizadas com HMAC e expiram em 15 minutos.
- Logs internos de login/cadastro e limite não incluem exceção bruta, senha, token, endereço ou e-mail. Comparação de senha também ocorre para conta inexistente, reduzindo a diferença óbvia de tempo de resposta.
- Leitura de JSON nas rotas que usam `readBody` limitada a 16 KiB reais, mesmo sem Content-Length ou com cabeçalho falso. Outras rotas e o limite na borda de rede ainda precisam ser revisados.
- Script de backup em JSON substituído por snapshot lógico criptografado/autenticado, com falha total se consulta ou integridade falhar. Recuperação exclusivamente em arquivo SQLite novo, com transação, contagens, integridade e referências verificadas. Ensaios automatizados com dados fictícios nas 20 tabelas e comandos reais; origem Turso real não acessada. Operação em [backups.md](backups.md).
- Ensaio de baseline restaura backup em arquivo novo, compara estrutura/integridade e usa Prisma CLI para registrar a migration inicial sem recriar tabelas. Inspeção local explícita e sem alteração; diferenças de SQL, colunas, índices, referências ou histórico bloqueiam aprovação. Fluxo em [database-updates.md](database-updates.md).
- Migration aditiva e sessões revogáveis integradas no login/cadastro, rotas, restauração e saída: apenas hashes no banco, expiração, revogação, função atual, cookies HttpOnly e proteção Origin/CSRF. Cliente não persiste credencial; respostas atrasadas não repovoam outra sessão. Tabela ainda não criada no banco real; implantação e navegador pendentes. Ver [server-sessions.md](server-sessions.md).
- Verificador acompanha prefixos e checksums das migrations e informa pendências. Ensaio de atualização em cópia nova aplica sessions e confere preservação dos dados legados, sem executar atualização remota.
- Dono pode alterar função de membros e desativar/reativar acesso; alteração e revogação de todas as sessões são atômicas. Donos protegidos, clínica alheia recusada, reativação não recupera credenciais encerradas. Lista de usuários restrita ao dono. Login confere novamente estado/função/hash na transação; código e tabela ainda não implantados no real. Ver [user-access.md](user-access.md).

## Próximas entregas necessárias

1. Concluir revisão de todas as rotas: referências de equipamentos, regras de alteração, validação de corpo e filtros. Leitura por função agora protegida no servidor; recepção recebe preços sem custos/margens e busca sem informações financeiras. Ver [permissions.md](permissions.md).
2. Validar sessões integradas em navegador real, desktop/móvel, duas abas e instalação HTTPS; sincronizar identidade entre abas, conferir alterações em andamento e limpeza de sessões expiradas. Não declarar produção pronta com base apenas em testes locais.
3. Recuperação de senha, confirmação de e-mail e convites com aceitação. Alteração de função/desativação integradas e testadas localmente, lista/janela revisadas visualmente; ainda precisam de auditoria permanente e implantação. Configuração do serviço de e-mail e URLs da instalação.
4. Configurar e verificar limites distribuídos de login/cadastro no ambiente final; conferir proxy, expiração e falha real do serviço. Ampliar logs seguros e alertas para os demais fluxos de autenticação.
5. Armazenamento monetário em centavos, migração de dados com ensaio de restauração, registros de recebimentos, auditoria, cancelamento preservando histórico e regras de concorrência/idempotência.
6. DRE e caixa coerentes, histórico de custos e receitas por período; cálculos e arredondamentos cobertos por testes.
7. Conferir baseline no banco real, ensaiar migrations posteriores e preparar aplicação controlada no Turso com bloqueio de escrita/concorrência e recuperação. Baseline já validada em cópia SQLite fictícia; não aplicada no remoto. O SQL inicial não deve ser executado sobre tabelas já existentes.
8. Configurar chave e cópia externa de backup, agendamento, alertas de falha/atraso, retenção e ensaio com cópia autorizada do banco real. Criptografia e restauração já testadas em banco local fictício; ensaio Turso e promoção de recuperação pendentes. Os backups legados em JSON permanecem locais até uma substituição real verificada.
9. Testes de ponta a ponta dos fluxos completos e permissões, desktop e móvel; execução automática e aprovação obrigatória das verificações.
10. Onboarding com passos de configuração, estados vazios úteis, importação/exportação e relatório de precificação revisados.
11. Configuração de escopo por funcionalidades, mantendo acesso ao que já existe; definir lançamento simples e piloto controlado.
12. Monitoramento de disponibilidade/erros, deploy documentado, HTTPS, recuperação e política de retenção/exportação/exclusão. Privacidade precisa refletir a operação real.
13. Desempenho: carregamento sob demanda, paginação de glosas e busca limitada no banco. PWA/offline com política segura para dados de pacientes, testes e expectativas explícitas.
14. Rotação/revogação da credencial Turso exposta e configuração externa de produção. Publicação e teste do ambiente final.

## Critério de conclusão

Nenhum item acima pode ser considerado concluído só por existir código. Exigir testes proporcionais, build com tipos, auditoria sem falhas críticas/altas, restauração comprovada, experiência dos fluxos completos revisada e configuração externa verificada. Não modificar nem apagar dados reais durante ensaios.

## Primeira configuração e precificação — verificação mais recente, 11/10/2026

- Guia no início com quatro etapas e explicações de custos, capacidade, procedimentos e primeiro preço; só disponível para dono/financeiro. Cadastro inicial explica como membros da equipe entram numa clínica existente. Dados já cadastrados preservados.
- Resumo, cálculo individual e saúde dos procedimentos recusam ocupação zero, capacidade inválida e custos ausentes. Motor recusa duração zero e percentuais/materiais inválidos; preço sugerido e equilíbrio arredondados para cima ao centavo. Margem inclui o mesmo retrabalho da sugestão; preços finais salvos não alterados. Ver [first-price.md](first-price.md).
- `bun run check` na cópia separada sincronizada: lint, tipos, 121 testes (106 de unidade/integração e 15 de cliente/HTTP) e build aprovados. Auditoria: nenhuma vulnerabilidade conhecida entre 256 pacotes. Testes usam dados fictícios; prévia original do usuário permanece disponível, sem conflito de servidor.
- Revisão visual do guia vazio, navegação e explicações, desktop e celular. Sem salvar dados pela interface, sem erros de console observados. Isso não equivale a validação clínica dos custos, auditoria financeira integral ou conclusão do MVP.
- Ainda faltam os fluxos de e-mail, infraestrutura, backups externos, revisão de exemplos autorizados, validação com clínicas e demais pendências abaixo. Nada enviado ao GitHub ou alterado no banco remoto.

## Permissões e revisão visual — verificação anterior, 11/10/2026

- `bun run check`: lint, TypeScript, 115 testes (101 de unidade/integração e 14 de cliente/HTTP) e build aprovados. Auditoria de produção sem vulnerabilidades conhecidas entre 256 pacotes.
- Recepção recusada no servidor em todos os métodos financeiros/de equipe inventariados; consulta operacional e agenda preservadas. Procedimentos retornam somente nome, duração, preço e identificador; busca não consulta tabelas financeiras. Ver [permissions.md](permissions.md).
- Revisão em navegador com banco local fictício: consulta com/sem preço, restauração, saída, novo login e gestão de usuários. Tamanho de celular conferido; janela sem alteração mantém salvar desabilitado. Revisão encontrou e removeu cartão indevido de custo no início da recepção. Sem erros de console observados nesses fluxos.
- GitHub informado conferido: público, somente README na versão principal, nenhuma execução automática. Usuário autorizou preparar o envio; nenhuma publicação nesta etapa. Ver [github-preparation.md](github-preparation.md).
- Nenhuma alteração no banco real. Permanecem pendentes implantação, revisão completa dos fluxos, duas abas, e-mail, auditoria permanente e os demais 14 itens acima.

## Gestão de acesso — verificação anterior, 11/10/2026

- `bun run check`: lint, TypeScript, 111 testes (98 de unidade/integração e 13 de cliente/HTTP) e build aprovados. Auditoria de produção sem vulnerabilidades conhecidas entre 256 pacotes.
- Ensaio oficial em cópia nova: 22 tabelas do app e três migrations aplicadas, sem pendências, todos os registros/tabelas legados idênticos e backup preservado.
- Gerência testada por HTTP com app real e banco fictício: dono protegido, usuários externos recusados, perfis sem autorização bloqueados, função nova exige login, desativação impede acesso, reativação não revive sessões antigas.
- Prisma isolado comprova rollback quando revogação falha, rechecagem de responsável na transação, repetição sem mudança e proteção adicional do estado desativado. Contratos simulam desativação e troca de hash durante login; nenhuma sessão é criada nesse caso.
- A tela tem ação Gerenciar acesso, explicações e estado desativado; ainda falta revisão visual em navegador. Cadastro legado informa que não envia convite e não promete troca automática de senha.
- Banco real não alterado. Aplicação controlada das tabelas de sessões/acesso continua obrigatória antes da publicação. Permissões de leitura financeira, auditoria permanente e fluxos de e-mail continuam pendentes.

## Integração de sessões — verificação anterior, 11/10/2026

- `bun run check`: lint, TypeScript, 102 testes (91 de unidade/integração e 11 de cliente/HTTP) e build aprovados. Testes HTTP usam instância Next.js e banco fictício isolados; testes do cliente simulam rede e armazenamento.
- `bun audit --production`: nenhuma vulnerabilidade conhecida entre 256 pacotes conferidos; biblioteca JWT removida.
- Login não devolve credencial no JSON. Sair revoga no banco e o acesso antigo recebe 401. Expiração e alteração de função foram conferidas na próxima requisição HTTP.
- Escritas sem CSRF ou com origem indevida recebem 403; clínicas ficam isoladas; cadastro duplicado não deixa clínica órfã. Respostas atrasadas não contaminam nova sessão, e falha de saída não finge sucesso.
- Não houve alteração no Turso real. Antes de executar esta versão contra o banco legado, é obrigatório ensaiar e aplicar a migration de sessões, configurar origem HTTPS e contador Redis. Ainda falta validação visual em navegador e na instalação final.

## Evidências anteriores — 11/10/2026

- `bun run check`: lint, TypeScript, 91 testes e build Next.js 16.3.8 aprovados.
- `bun audit --production`: nenhuma vulnerabilidade conhecida entre 270 pacotes conferidos.
- A migration inicial cria 20 tabelas em SQLite em memória; integridade e chaves estrangeiras conferidas.
- Busca por chave Turso embutida e segredo JWT público em código, scripts e schema sem ocorrências.
- A confirmação não cobre implantação de sessões, e-mail, migração de dados reais, restauração operacional, navegador autenticado ou deploy. Esses itens continuam pendentes.
- As novas regras de agenda/capacidade/procedimentos têm testes de schema e contratos HTTP com banco simulado. Ainda faltam revisão visual dos formulários, concorrência de remarcações e preservação consistente de histórico ao editar/excluir agenda. Nenhum banco real foi alterado nesta etapa.
- Limites testados localmente: expiração, concorrência em memória, isolamento de chaves, saturação, IP não confiável, HTTP 429/503, configuração ausente em produção, mensagens/logs sem segredo e login válido/bloqueado com banco simulado. REST Redis foi simulado; ainda não há prova de execução Lua em Redis real nem de duas instâncias de produção.
- Recuperação comprovada localmente em arquivo novo: 20 tabelas, 22 registros fictícios, comparação exata de dados/schema, adulteração e chave errada recusadas, banco existente preservado, rollback de referência inválida e comandos reais testados. Ainda faltam cópia externa, chave operacional, agendamento, alertas e ensaio autorizado do banco real.
- Baseline testada em cópias SQLite: registro oficial preserva dados/schema e origem, diferenças e checksum errado são recusados. `migrate deploy` sem pendências não recria tabelas e cliente Prisma lê clínica/usuário recuperados. Ainda não cobre migrations posteriores, escrita concorrente durante atualização ou Turso remoto.
- Migration de sessões ensaiada via comando real em cópia fictícia: 21 tabelas do app, duas migrations registradas, sem pendências e dados legados idênticos. Serviço integrado ao login e às rotas; testes HTTP usam processo separado do Next.js com SQLite fictício, não os mocks dos contratos antigos. Testes visuais de navegador e implantação continuam pendentes.
