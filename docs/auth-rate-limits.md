# Proteção contra tentativas repetidas

Login: até 60 tentativas por origem e 10 por e-mail em 15 minutos. Cadastro: até 10 por origem e 3 por e-mail em 15 minutos. Tentativas bem-sucedidas também contam; mudar a senha não reinicia o contador. Requisições inválidas contam para o limite por origem. Há bloqueio temporário, nunca bloqueio permanente da conta.

## Desenvolvimento

Sem configurar Redis, usa memória local limitada a 10.000 chaves; reiniciar o processo perde os contadores. Esse modo é exclusivo de desenvolvimento/testes. Não comprova proteção distribuída.

## Produção

Configurar `AUTH_RATE_LIMIT_REDIS_URL` com um endpoint HTTPS de Redis compatível com a API REST Upstash e `AUTH_RATE_LIMIT_REDIS_TOKEN` com uma credencial de escrita que permita EVAL, INCR, TTL e EXPIRE. Não há configuração automática, criação de conta ou contratação de serviço. O contador compartilhado usa script Lua atômico para incrementar e garantir expiração. Documentação de referência: [API REST oficial](https://upstash.com/docs/redis/features/restapi).

Se o serviço estiver ausente, indisponível, mal configurado ou retornar resposta inválida, login/cadastro respondem 503. Não há fallback em memória em produção. Testar isso no ambiente final antes da publicação.

Por padrão, cabeçalhos de endereço enviados pelo navegador são ignorados e há uma origem compartilhada. Só definir `AUTH_RATE_LIMIT_TRUST_PROXY=true` quando o proxy sobrescrever `X-Real-IP` com o IP real e o servidor Next.js não puder ser acessado diretamente pela internet. Não confiar nesse cabeçalho se o cliente puder defini-lo. O Caddyfile legado ainda não é configuração de produção aprovada.

E-mails e endereços são convertidos em identificadores HMAC com `AUTH_SECRET` do ambiente; Redis recebe apenas identificadores, ação e contagem. As entradas expiram em 15 minutos. Logs de limite registram apenas tipo de evento e ação, nunca senha, token, endereço ou e-mail. Essa pseudonimização não dispensa incluir o provedor na análise de privacidade.

## Verificação pendente de publicação

- Confirmar contagem entre duas instâncias reais, expiração do Redis, resposta 429 e retomada após a janela.
- Confirmar 503 quando o Redis está indisponível e que não existe caminho alternativo sem limite.
- Tentar forjar `X-Real-IP` externamente e confirmar que o proxy o substitui.
- Revisar limites com o volume do piloto e a possibilidade de bloquear temporariamente um e-mail conhecido. Uma etapa adicional de desafio pode ser necessária conforme o abuso observado.
- Integrar alertas para indisponibilidade. O limitador não substitui proteção de rede, sessões revogáveis ou recuperação de senha. O leitor de JSON usado em login/cadastro agora limita o corpo a 16 KiB reais; ainda é necessário limitar tráfego e tamanho das requisições no proxy e revisar as outras rotas.

Os testes atuais cobrem lógica local, contratos REST simulados e respostas de bloqueio; não foram executados contra um serviço Redis real.
