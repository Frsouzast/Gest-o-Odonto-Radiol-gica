# Precificação Clínica — versão para instalar no computador

Isto é a mesma calculadora de precificação, só que empacotada como um
programa comum de Windows (ícone, atalho no menu Iniciar, instalador
`.exe`) em vez de precisar de Docker, Postgres ou terminal aberto o
tempo todo.

## O que mudou em relação à versão anterior (backend + frontend web)

- **Banco de dados**: trocou Postgres por **SQLite** — um arquivo só,
  guardado dentro da pasta de dados do próprio programa. Nada pra
  instalar ou configurar.
- **Servidor**: continua sendo a mesma API Express por baixo, só que
  ela sobe sozinha quando você abre o programa (dentro do
  [Electron](https://www.electronjs.org/)), numa porta local que o
  próprio Windows escolhe.
- **Multi-clínica continua igual**: o banco ainda separa tudo por
  `clinica_id`, então se um dia você quiser voltar a hospedar isso
  numa nuvem pra várias clínicas ao mesmo tempo, a estrutura de dados
  já está pronta — só trocaria o `server/db.js` de volta pro adaptador
  Postgres.
- **Login continua igual**: dono/financeiro/recepção, senha
  criptografada, tudo do jeito que já estava.

## Como gerar o instalador

Você vai precisar do Node.js instalado (você já tem, do processo
anterior). Não precisa mais de Docker nem de Postgres pra nada aqui.

```powershell
# 1. Entre na pasta do projeto
cd caminho\para\desktop-app

# 2. Instale as dependências (só na primeira vez)
npm install

# 3. Gere o instalador
npm run dist
```

O terceiro comando faz tudo sozinho: builda o frontend, empacota o
Electron, e gera o instalador em:

```
dist\PrecificacaoClinica-Setup-1.0.0.exe
```

Esse é o arquivo que você distribui/instala. Dá duplo clique nele como
qualquer instalador — ele cria um atalho no menu Iniciar e (se você
deixar marcado) na área de trabalho.

## Onde ficam os seus dados

O banco de dados fica em:

```
%APPDATA%\precificacao-clinica\dados.sqlite
```

(`%APPDATA%` normalmente é algo como
`C:\Users\SeuUsuario\AppData\Roaming`). Fazer backup desse arquivo é
fazer backup de tudo — despesas, insumos, procedimentos, usuários,
histórico de preço. Copiar esse arquivo pra outro computador com o
mesmo programa instalado também funciona como forma simples de
"migrar" os dados.

## Testando sem gerar o instalador (mais rápido, pra conferir antes)

```powershell
npm run start
```

Isso builda o frontend e abre o programa direto, sem passar pela etapa
de empacotamento — útil pra testar rapidinho antes de gerar o `.exe`
de verdade.

## Novidades desta versão

- **Depreciação de equipamentos** — nova seção "Equipamentos e móveis" dentro da aba "Custos & capacidade". Cadastre cada equipamento com valor pago e vida útil em anos; a depreciação mensal calculada entra automaticamente no custo fixo total.
- **Lembrar último e-mail no login** — o campo de e-mail já vem preenchido da próxima vez (só o e-mail, nunca a senha).
- **Agenda de pacientes** — nova aba com nome, telefone, exame, Plano/Particular e os 5 status pedidos (Aguardando chegar, Atendido, Faltou, Desmarcou, Remarcado). Ao remarcar, o sistema cria o agendamento no novo dia e deixa um link no original apontando pra ele.
- **Relatório de impressão e Dashboard** (já estavam na versão anterior).
- **Modo servidor / cliente** — a mudança mais importante desta versão, explicada abaixo.

## Modo servidor / cliente (rede local)

Na primeira vez que o programa abre (em cada computador), ele pergunta:

- **"Este computador é o Servidor"** — os dados ficam aqui, num arquivo local. Escolha isso no computador principal da clínica (ex: o do gestor/financeiro).
- **"Conectar a um Servidor existente"** — escolha isso nos outros computadores (ex: recepção), informando o endereço de rede do computador Servidor.

**Importante sobre a sua instalação atual**: como você já vinha usando a versão anterior (sem esse conceito de servidor/cliente), na primeira vez que abrir esta versão nova ele vai perguntar de novo — escolha **"Servidor"** pra manter exatamente os dados que você já tinha (nada é apagado).

### Como descobrir o endereço do Servidor

Depois de escolher "Servidor" e abrir o programa, aparece uma faixa verde no topo da tela: *"Nos computadores clientes, informe o endereço: 192.168.x.x:3344"*. É esse endereço que você digita na tela de configuração dos outros computadores.

Os dois computadores precisam estar na **mesma rede Wi-Fi/cabo** (mesmo roteador). Se o computador Servidor tiver o Firewall do Windows ativo, na primeira conexão de um cliente ele pode perguntar "Permitir que o Node.js/Electron se comunique em redes públicas ou privadas?" — marque **redes privadas** e permita.

### O que cada lado enxerga

- **Servidor**: acesso total (todas as abas), de acordo com o papel de quem logou (dono/financeiro veem e editam tudo; recepção só consulta).
- **Cliente**: só as abas **Insumos** (pode cadastrar/editar) e **Precificação** (só consulta — os campos ficam travados mesmo pra quem loga como dono, porque a restrição aqui é do computador, não do usuário).

Ambos os lados fazem login normalmente (e-mail/senha) — é a mesma conta e os mesmos dados; o computador Cliente não guarda nada localmente, tudo passa pela rede até o Servidor.

### Testando isso sem dois computadores

Se quiser conferir o modo cliente sem ter uma segunda máquina à mão: abra o programa (modo Servidor) num computador, anote o endereço mostrado na faixa verde, e instale uma segunda cópia num outro Windows (ou numa segunda pasta no mesmo PC, apontando pra esse mesmo endereço) escolhendo "Cliente" e digitando esse IP.

## Módulo Financeiro avançado (baseado no mapa mestre)

Nova aba **Financeiro**, com sub-navegação própria (Dashboard, Contas a receber, Contas a pagar, Convênios, Glosas, DRE gerencial, Rentabilidade), seguindo os módulos 07 e 08 do `MAPA_MESTRE_SUITE_GESTÃO_RADIOLOGIA`:

- **Convênios**: cadastro + tabela de preços por procedimento **com vigência** — ao lançar uma conta a receber pra um convênio, o sistema busca automaticamente o preço que estava valendo na data do exame (nunca o mais recente), exatamente como o mapa pede: "congelar a regra comercial daquele momento".
- **Contas a receber / a pagar**: lançamentos com status (aberto/recebido/vencido/parcial/cancelado e aberto/pago/vencido/cancelado). Despesas recorrentes geram os lançamentos do mês com um clique (idempotente — rodar duas vezes no mesmo mês não duplica).
- **Glosas**: vinculadas ao lançamento exato que as originou (não só "o convênio X glosou Y"), com o fluxo Glosada → Em recurso → Recuperada/Perdida.
- **DRE gerencial**: Receita bruta − Glosas − Impostos = Receita líquida − Custos variáveis = Margem de contribuição − Despesas fixas = Resultado operacional.
- **Rentabilidade**: por exame ou por convênio, com receita, custo, resultado, margem e ticket médio.

### O que ficou de fora da primeira etapa — e já foi completado agora

O mapa mestre também descreve, dentro desses mesmos módulos, um workflow completo de lotes de faturamento, conciliação bancária, e rentabilidade por dentista/equipamento. Isso tudo já foi implementado nesta versão:

- **Lotes de faturamento**: seleciona convênio + período, o sistema mostra a produção pendente já separando o que está pronto pra faturar do que tem pendência (paciente/procedimento/valor faltando), e fecha o lote com um clique — os exames incluídos ficam marcados e não entram em outro lote por engano.
- **Rentabilidade por dentista solicitante**: mesmo motor de agrupamento, só que agrupando pelo campo "dentista solicitante" do lançamento.
- **Rentabilidade por hora de equipamento**: vincule um equipamento (cadastrado em "Custos & capacidade → Equipamentos") a cada procedimento, na própria aba "Procedimentos", e o Financeiro calcula receita/hora e lucro/hora daquele equipamento no mês — validado contra os exemplos do próprio mapa (40min a R$150 → R$450/hora).
- **Conciliação bancária**: lançamento manual do extrato (entrada/saída) e comparação automática contra o que o sistema registrou como recebido/pago no mês. Importação de arquivo (OFX/CNAB) fica pra uma etapa futura — o próprio mapa recomenda não inventar esse formato sem definir exatamente qual banco/arquivo primeiro.

Ainda ficam de fora, porque dependem de módulos inteiros que não existem (CRM de dentistas, Estoque com NF-e, Pacientes/Exames completos): alertas inteligentes automáticos, e a integração desses relatórios com o restante do mapa (módulos 2, 3, 4, 9, 11 em diante).



## Rodando os testes de cálculo (motor de precificação + financeiro)

```powershell
npm test
```

Mesmos testes de sempre, comparando os cálculos com os valores reais
da sua planilha original — não mudou nada aqui, o motor é o mesmo
arquivo, sem dependência de banco. Agora inclui também os testes do
módulo financeiro (DRE, rentabilidade, fluxo de caixa), validados
contra os próprios exemplos numéricos do mapa mestre.

## Limitações desta versão (de propósito, por enquanto)

- **Um computador, um banco de dados.** Se você usa em dois
  computadores diferentes, são dois bancos separados — não sincroniza
  sozinho. Se no futuro você quiser acessar de vários lugares ao mesmo
  tempo, a arquitetura de rede (a versão com Postgres + deploy na
  nuvem, dos passos anteriores) é o caminho — o banco já foi desenhado
  pra suportar isso.
- **Sessão não persiste.** Fechou o programa, precisa logar de novo
  na próxima vez que abrir.
- **Sem atualização automática.** Uma nova versão significa gerar um
  novo instalador e reinstalar por cima (os dados em `%APPDATA%` não
  são apagados nesse processo).
