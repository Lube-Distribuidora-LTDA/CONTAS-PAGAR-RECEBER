# CONTAS A PAGAR E RECEBER — rotinas 717 e 1240 do WinThor, para o controller

Pedido do Júlio (2026-11-09): o controller quer a visão de **Contas a Pagar** (rotina **717**) e de **Contas a
Receber** (rotina **1240**) "assim como está no relatório", **nada consolidado**; filtros e busca ágeis; **Excel
formatado** com os filtros, tudo centralizado; e o **AGENTE LUBE** mantendo o dado ao vivo, como nos outros sistemas.

Depois de ver a primeira versão (mesmo dia), o Júlio pediu:
- **o que já foi pago também**, com status **A PAGAR / PAGO** (na 1240, A RECEBER / RECEBIDO), **desde 01/01/2011**
  e atualizando todo dia; quando o pagamento é feito no WinThor, a tela mostra PAGO;
- **tela limpa**, só as colunas importantes, e filtros "bastante nichados" (status, período e o resto);
- na 1240, o **número de PARCELAS**;
- **filtro em cada coluna como no Excel**: "clico pra filtrar escrevendo e marcando, auto seleção para aquele que
  escrever e quando for marcar manualmente".

## Como o dado chega

WinThor (Oracle) → **AGENTE LUBE** na `SRV-IA` (19 fluxos, `fluxos/contas.toml` no repositório do agente) →
schema `contas` do DATA WAREHOUSE → **a tela consulta o banco** (`contas.consulta`, por `api/consulta`).

| Fluxo | A cada | O quê |
|---|---|---|
| `contas.pagar` | 60 s | 717 em aberto: PCLANC com `DTPAGTO` nulo (≈20 mil) |
| `contas.receber` | 60 s | 1240 em aberto: PCPREST com `DTPAG` nulo (≈39 mil) |
| `contas.pagar_pago` | 60 s | 717 **pagos** dos últimos 7 dias (o pagamento aparece como PAGO em ~1 min) |
| `contas.pagar_pago_60d` | 1 h | 717 pagos dos últimos 60 dias (estorno e correção) |
| `contas.receber_pago` | 60 s | 1240 **recebidos** dos últimos 7 dias |
| `contas.receber_pago_60d` | 1 h | 1240 recebidos dos últimos 60 dias |
| `contas.receber_bk`, `_desd`, `_item`, `_banco`, `_obs` | 10 min | as abas da tela do título da 1240 (só em aberto) |
| `contas.cliente`, `rca`, `supervisor`, `cobranca`, `conta`, `fornecedor`, `funcionario` | 1 h | nomes para os pagos |
| `contas.filial` | 10 min | nomes das filiais |

O histórico mais velho que 60 dias entrou **uma vez** por `conferencia\carga_historico.py` (2026-11-09, ~4 min):
**1,15 mi pagos** (717) e **3,08 mi recebidos** (1240), de 01/01/2011 a 09/09/2026. Um título que aparece nos dois
lados (estorno que chegou antes da janela) vale o em aberto.

**Por que a tela consulta o banco:** com milhões de pagos, baixar tudo para o navegador (o desenho da primeira
versão, `contas.pacote`) não cabe. Cada clique pede ao banco só a página, os totais do recorte e, no filtro de uma
coluna, a lista de valores daquela coluna já filtrada pelas outras. Medido: em aberto ~0,3 s; pagos do mês ~0,1 s;
título por número ~0,1 s; o histórico inteiro sem período ~5 s ("Somando no banco…"). Por isso "Pago" abre no mês
corrente pela data de pagamento, e "Tudo" fica a um clique. Ao vivo: a tela pergunta `api/versao` de 15 em 15 s
(a versão do sistema `contas`, que o agente troca a cada gravação) e refaz a consulta que está na tela.

## As regras (saíram do programa das rotinas)

- **717 Contas a Pagar** (`frmPCINF241`, `dmRelat.qCtasPagar`): em aberto = `PCLANC.DTPAGTO IS NULL`, a conta
  existe na `PCCONTA` e **não** é `CODCONTANTPAG`, `CODCONTRECJUR` nem `CODCONTPAGJUR` do `PCCONSUM`. **Pagos** = a
  regra "contas pagas" da mesma rotina (`qCtasPagas`): `DTPAGTO` preenchido, `VPAGO <> 0`, as mesmas contas fora.
  A Pagar = Valor + Juros − Desc. Fin. − Valor Dev. + Variação cambial. Parceiro = o `DECODE` da rotina.
- **1240** (`frmPCINF820`, `qryPCPREST`): em aberto = `DTPAG IS NULL`; **recebidos** = `DTPAG` preenchido.
  **Parcela "2 de 3"**: os títulos da mesma venda (`NUMTRANSVENDA`), em aberto e recebidos, fora os desdobrados
  (`DESD`), por vencimento. O WinThor renumera a prestação no desdobramento (a venda 89769 tem as prestações 2, 4,
  6, 8, 10 e 11: a 11 é a 6ª de 6), então a tela mostra "6 de 6 · Pr. 11".

**Fora da soma, com "mostrar"** (uma linha azul acima da tabela diz quantos e quanto):
717: em aberto com cheque/borderô já emitido (como a rotina), em aberto vencidos antes de 2011, pagos de valor
negativo (créditos e estornos) e o lançamento **3462463** (27/06/2025, valor fora de qualquer escala, provável erro de digitação;
`contas.excluido`). 1240: cobrança DESD e sem cliente/RCA no cadastro (como a rotina),
recebidos por cancelamento e em aberto vencidos antes de 2011.

## Conferência

`conferencia\conferir_pagos.py` (só leitura): pagos e recebidos **ano a ano** (quantidade, valor, valor pago) e os
em aberto como a rotina, WinThor contra o banco no mesmo instante. **2026-11-09 ~14:25: tudo igual ao centavo** —
717 pagos 1,16 mi em 16 anos; 1240 recebidos 3,03 mi; em aberto, quantidade e valor iguais aos da rotina (os
valores ficam no cérebro, não no repositório). Achado: 56 duplicatas com data de pagamento futura digitada errado no
WinThor (anos 2027 a 3170).

## Na máquina

`INICIAR.bat` → `http://localhost:3113` (lê o banco com o `ENV` do agente ou do Inventário; só esta máquina acessa).

## Arquivos

| Caminho | O que é |
|---|---|
| `web/js/rotinas.js` | as duas telas: status, período, filial, pílulas, totais, o que fica fora, colunas e o Excel |
| `web/js/grade.js` | a tabela do banco com o filtro do Excel em cada coluna, colunas, páginas e exportação |
| `web/js/titulo.js` | a tela do título (abas da 1240 e Parcelas; lançamento da 717; pagos e recebidos) |
| `web/js/dados.js` | a conversa com o servidor e a ponte com o agente |
| `web/planilha.js` | o Excel formatado (.xlsx feito à mão, comprimido pelo navegador) |
| `web/api/*.js` | consulta, versão, título, atualizar (funções da Vercel; o navegador nunca fala com o banco) |
| `web/db/01` a `05` | schema `contas` (migrações `contas_01` a `contas_05c`) |
| `conferencia/` | `carga_historico.py` (carga única de 2011 até 60 dias atrás) e `conferir_pagos.py` |

## Publicação

**Ainda não publicado** (projeto grande: o Júlio vê antes). Quando for: repositório `CONTAS-PAGAR-RECEBER`,
projeto Vercel `contas-pagar-receber` (Root `web`, `gru1`), Sentinela antes do primeiro deploy (o
`middleware.ts` já está fechado para `contas-pagar-receber`), Guardião e as variáveis `SUPABASE_DB_*` (a senha,
o Júlio cadastra).
