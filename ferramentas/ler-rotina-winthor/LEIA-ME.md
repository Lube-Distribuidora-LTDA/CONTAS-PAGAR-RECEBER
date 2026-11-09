# Ler as colunas, abas e SQL de uma rotina do WinThor (só leitura)

Usado em 2026-11-09 para copiar a 717 e a 1240 "assim como está no relatório" (ver o cérebro: Projetos/CONTAS A PAGAR E RECEBER).

1. Peça ao Júlio para **abrir a rotina uma vez** no WinThor desta máquina: o lançador deixa o programa em
   `C:\WinThor\Spool\Executaveis\PCSISnnnn.EXE` (o `.PC` de `C:\WinThor\Prod` é um pacote protegido por senha da
   TOTVS: **não abrir**). Algumas rotinas também gravam os SQLs no `C:\WinThor\Spool\*.SQL`.
2. `python -I -X utf8 dfm.py C:\WinThor\Spool\Executaveis\PCSIS717.EXE saida.txt` — despeja os formulários Delphi
   (DFM binário, assinatura TPF0) em texto. Nada é executado.
3. `python resumo_form.py saida.txt frmPCINFnnn resumo.txt` — abas, grades (colunas com título e campo), caixas de
   marcar, grupos de opção e SQL do formulário principal (o nome sai da lista de formulários do passo 2).
4. Os títulos de coluna vazios vêm dos campos da consulta: `python campos2.py saida.txt <linha do TOraQuery>`.
5. As abas de uma tela de detalhe com rótulo e campo: `python abas_titulo.py saida.txt frmDadosTitulo`.
6. O SQL montado no código (condições que a tela acrescenta): `strings.py` acha o trecho pelas palavras e
   `faixa.py` lê o trecho inteiro, na ordem.
7. O layout da grade de cada usuário (ordem, largura, visível) fica na tabela `PCFORMCONFIG` (`.grd`, só índices) e
   os últimos filtros usados no `.ini`: `grd.py`.