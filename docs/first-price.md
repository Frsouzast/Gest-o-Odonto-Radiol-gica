# Primeira configuração e conferência de preços

O início agora tem um guia de quatro etapas: custos mensais, capacidade de atendimento, procedimento e primeiro preço. Os estados são conferidos a partir dos dados cadastrados, sem substituir ou apagar registros existentes. Preenchido não significa auditado: a clínica precisa revisar os valores, materiais, taxas e duração usados na sugestão. Falha de consulta aparece como falha, não como custo zero ou etapa concluída.

O guia só é montado para dono/financeiro; a recepção continua sem consultar custos, capacidade ou equipamentos. A tela Nova clínica explica que cria o dono e que membros de uma clínica existente são cadastrados pelo dono em Usuários → Adicionar → Tipo de acesso.

## Regras verificadas

- Resumo de custos, cálculo individual e saúde dos procedimentos recusam capacidade ausente/inválida, ocupação zero e ausência de custos cadastrados. Ocupação zero continua podendo ser salva, mas não produz sugestão de preço. Valores explicitamente cadastrados como zero não são confundidos com registro ausente.
- Duração zero, custos/materiais inválidos e soma de lucro com taxas de 100% ou mais impedem o cálculo, inclusive para registros legados. A mensagem explica o ajuste necessário; não retorna preço zero como se estivesse correto.
- Custos mensais são somados em centavos; depreciação mensal de cada equipamento é arredondada ao centavo. Cálculo de rateio/material mantém precisão intermediária. Preço sugerido e equilíbrio são arredondados para cima ao centavo, sem acrescentar centavo a um resultado já exato.
- Retrabalho incide sobre materiais e tempo rateado tanto na sugestão quanto na margem. A margem antiga considerava apenas materiais nessa parcela, superestimando o resultado. A correção pode mudar margens exibidas para procedimentos com retrabalho; preços finais salvos não são alterados.
- Sugestões não são garantia de lucro nem substituem custos reais. Equilíbrio significa cobrir os custos e taxas informados, não todos os gastos que a pessoa possa ter omitido.

## Exemplo fictício reproduzível

Custos de R$ 7.200/mês; 20 dias × 8 horas × 1 unidade × 75% de ocupação = 120 horas, ou R$ 1 por minuto. Procedimento de 20 minutos, duas unidades de material a R$ 2,50 e laudo de R$ 10. Retrabalho de 10% sobre tempo + materiais: R$ 2,50. Custo direto: R$ 37,50.

Comissão 5%, inadimplência 2%, impostos 8%, cartão 3%, lucro desejado 30%: preço sugerido R$ 72,12 e equilíbrio R$ 45,74. Ao usar R$ 72,12 como preço final, a margem calculada fica pelo menos em 30%, incluindo o mesmo retrabalho. Isso é um exemplo matemático, não uma recomendação de preço ou alíquota para uma clínica.

Testes de unidade e HTTP com Next.js/SQLite fictício verificam os bloqueios, as três respostas da API, cálculo coerente e preservação do preço final salvo. Revisão visual no navegador: guia vazio, tamanho de celular, navegação para custos e explicações da capacidade, sem salvar alterações da clínica de teste.

## Limites desta entrega

Não migra valores monetários armazenados no banco, não comprova todos os relatórios financeiros e não conclui cadastro por convite/recuperação de senha, infraestrutura, backup externo ou validação de mercado. Ainda precisa de conferência por responsável da clínica com exemplos autorizados antes do uso real. Não houve atualização do banco remoto nem envio ao GitHub.
