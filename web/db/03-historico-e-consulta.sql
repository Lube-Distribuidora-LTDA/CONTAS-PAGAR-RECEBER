-- =============================================================================
-- CONTAS A PAGAR E RECEBER — pagos desde 01/01/2011, cadastros e a consulta no banco
-- (migração contas_03_historico_e_consulta, 2026-11-09)
--
-- Pedidos do Júlio (2026-11-09):
--   "não tenha apenas o que será pago... eu preciso saber o que já pagou também... com um status de 'A PAGAR' ou
--    'PAGO'... desde 01/01/2011 e atualizando todos os dias"
--   "na 1240 tenha o numero de PARCELAS"; "filtros... status de pago ou não, a data de período... bastante nichado
--    para conseguir achar alguns números com velocidade e precisão... tela limpa"
--   "nos filtros das abas, assim como no excel... clico pra filtrar escrevendo e marcando, auto seleção para aquele
--    que escrever e quando for marcar manualmente"
--
--   contas.pagar_pago     717 PAGOS: a regra "contas pagas" da própria 717 (dmRelat.qCtasPagas): PCLANC com DTPAGTO,
--                         VPAGO <> 0, conta na PCCONTA fora das de adiantamento e juros do PCCONSUM; DTPAGTO desde 2011.
--   contas.receber_pago   1240 RECEBIDOS: PCPREST com DTPAG desde 2011.
--   Os em aberto continuam em contas.pagar e contas.receber (fluxos de 60 s, que apagam o que foi pago). Os pagos
--   chegam pelos fluxos *_pago (7 dias, 60 s) e *_pago_60d (60 dias, de hora em hora), que também apagam, na janela,
--   o que foi estornado. O histórico até 60 dias atrás entrou uma vez (conferencia\carga_historico.py).
--   Um título que aparece nos dois lados (o estorno chegou antes da janela) vale o em aberto (v_pagar, v_receber).
--
-- A tela não baixa milhões de títulos: pede ao banco a página, os totais e a lista de valores de cada coluna
-- (contas.consulta). Colunas e expressões vêm de uma lista fixa (contas.colunas); valor do usuário só entra entre
-- aspas (format %L).
-- =============================================================================

-- ----------------------------------------------------------------------------- cadastros (agente, de hora em hora)
create table if not exists contas.cliente (codcli bigint primary key, cliente text, fantasia text, cnpj text, cidade text, uf text);
create table if not exists contas.rca (codusur bigint primary key, nome text, codsupervisor bigint);
create table if not exists contas.supervisor (codsupervisor bigint primary key, nome text);
create table if not exists contas.cobranca (codcob text primary key, cobranca text);
create table if not exists contas.conta (codconta bigint primary key, conta text, grupoconta bigint, grupo text);
create table if not exists contas.fornecedor (codfornec bigint primary key, fornecedor text, fantasia text, cnpj text, uf text);
create table if not exists contas.funcionario (matricula bigint primary key, nome text, guerra text);
alter table contas.cliente enable row level security;
alter table contas.rca enable row level security;
alter table contas.supervisor enable row level security;
alter table contas.cobranca enable row level security;
alter table contas.conta enable row level security;
alter table contas.fornecedor enable row level security;
alter table contas.funcionario enable row level security;

create table if not exists contas.excluido (
  rot text not null check (rot in ('pagar', 'receber')), chave text not null, motivo text not null,
  desde timestamptz not null default now(), primary key (rot, chave)
);
alter table contas.excluido enable row level security;
comment on table contas.excluido is 'Lançamento impossível que fica fora das somas da tela (com aviso e "mostrar") até o financeiro conferir. Tirar daqui = volta a somar.';
insert into contas.excluido (rot, chave, motivo) values
  ('pagar', '3462463', 'Lançamento 3462463 (27/06/2025, filial 1, conta 208006, baixa pela 1301): valor fora de qualquer escala, provável erro de digitação')
on conflict do nothing;

-- ----------------------------------------------------------------------------- os pagos
create table if not exists contas.pagar_pago (
  recnum bigint primary key, recnumprinc bigint, codfilial text, dtlanc date, dtemissao date, dtvenc date, dtpagto date,
  dtcompetencia date, codfornec bigint, tipoparceiro text, parceiro_txt text, codconta bigint, historico text, numnota bigint,
  duplic text, parcela text, valor numeric, descontofin numeric, valordev numeric, txperm numeric, vlvariacaocambial numeric,
  vpago numeric, numbanco bigint, nomefunc text, codcomprador bigint, codrotinabaixa bigint
);
alter table contas.pagar_pago enable row level security;
comment on table contas.pagar_pago is
  'Rotina 717, PAGOS desde 01/01/2011: PCLANC com DTPAGTO, VPAGO <> 0, conta na PCCONTA fora das de adiantamento e juros do PCCONSUM (a regra "contas pagas" da 717). parceiro_txt só para o tipo O (os outros, pelo cadastro). Gravado pela carga do histórico e pelo AGENTE LUBE.';
create index if not exists pagar_pago_dtpagto on contas.pagar_pago (dtpagto);
create index if not exists pagar_pago_dtvenc on contas.pagar_pago (dtvenc);
create index if not exists pagar_pago_codfornec on contas.pagar_pago (codfornec);

create table if not exists contas.receber_pago (
  numtransvenda bigint not null, prest text not null, codfilial text, duplic bigint, dtemissao date, dtvenc date, dtpag date,
  dtcancel date, codcli bigint, codusur bigint, codsupervisor bigint, codcob text, valor numeric, txperm numeric,
  valordesc numeric, vpago numeric, codbanco bigint, nossonumbco text, tem_cad text,
  primary key (numtransvenda, prest)
);
alter table contas.receber_pago enable row level security;
comment on table contas.receber_pago is
  'Rotina 1240, RECEBIDOS desde 01/01/2011: PCPREST com DTPAG. tem_cad = S quando o cliente e o RCA existem no cadastro (a rotina só mostra esses). Gravado pela carga do histórico e pelo AGENTE LUBE.';
create index if not exists receber_pago_dtpag on contas.receber_pago (dtpag);
create index if not exists receber_pago_dtvenc on contas.receber_pago (dtvenc);
create index if not exists receber_pago_codcli on contas.receber_pago (codcli);
create index if not exists receber_pago_duplic on contas.receber_pago (duplic);

-- ----------------------------------------------------------------------------- utilidades
create or replace function contas.hoje() returns date language sql stable as
$$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function contas.br(n numeric) returns text language sql immutable as
$$ select translate(to_char(n, 'FM999,999,999,999,990.00'), ',.', '.,') $$;

-- ----------------------------------------------------------------------------- em aberto + pagos, com os nomes
create or replace view contas.v_parceiro as
  select 'F'::text as tipo, codfornec as cod, fornecedor as nome from contas.fornecedor
  union all select 'C', codcli, cliente from contas.cliente
  union all select 'R', codusur, nome from contas.rca
  union all select 'M', matricula, nome from contas.funcionario
  union all select 'L', matricula, nome from contas.funcionario;

create or replace view contas.v_pagar as
select 'A'::text as st, p.recnum, p.recnumprinc, p.codfilial, p.dtlanc, p.dtemissao, p.dtvenc, null::date as dtpagto,
       p.dtcompetencia, p.codfornec, p.tipoparceiro, p.parceiro, p.estado, p.codconta, p.conta, p.grupoconta, p.grupo,
       p.historico, p.numnota, p.duplic, p.parcela, p.valor, p.descontofin, p.valordev, p.txperm, p.vlvariacaocambial,
       p.valor + p.txperm - p.descontofin - p.valordev + p.vlvariacaocambial as valorpagar, p.vpago,
       greatest(0, contas.hoje() - p.dtvenc) as atraso, p.numbanco, p.nomefunc, p.codcomprador, p.comprador,
       p.boleto, p.nfservico, p.tipolanc, (p.dtcheq is not null or p.dtborder is not null) as emitido
  from contas.pagar p
union all
select 'P', g.recnum, g.recnumprinc, g.codfilial, g.dtlanc, g.dtemissao, g.dtvenc, g.dtpagto,
       g.dtcompetencia, g.codfornec, g.tipoparceiro, coalesce(vp.nome, g.parceiro_txt), f.uf, g.codconta, c.conta, c.grupoconta, c.grupo,
       g.historico, g.numnota, g.duplic, g.parcela, g.valor, g.descontofin, g.valordev, g.txperm, g.vlvariacaocambial,
       null::numeric, g.vpago,
       greatest(0, g.dtpagto - g.dtvenc), g.numbanco, g.nomefunc, g.codcomprador, coalesce(e.guerra, e.nome),
       null::text, null::text, null::text, false
  from contas.pagar_pago g
  left join contas.v_parceiro vp on vp.tipo = g.tipoparceiro and vp.cod = g.codfornec
  left join contas.fornecedor f on f.codfornec = g.codfornec
  left join contas.conta c on c.codconta = g.codconta
  left join contas.funcionario e on e.matricula = g.codcomprador
 where not exists (select 1 from contas.pagar a where a.recnum = g.recnum);

create or replace view contas.v_receber as
select 'A'::text as st, r.numtransvenda, r.prest, r.codfilial, r.duplic, r.dtemissao, r.dtvenc, r.dtpag, r.dtcancel,
       r.codcli, r.cliente, r.fantasia, r.cnpj, r.codusur, r.rca, r.codsupervisor, r.supervisor, r.codcob, r.cobranca,
       r.valor, r.txperm, r.valordesc, r.valor as areceber, r.vpago,
       greatest(0, contas.hoje() - r.dtvenc) as atraso, r.codbanco, r.nossonumbco,
       case when r.tem_cliente = 'S' and r.tem_rca = 'S' then 'S' else 'N' end as tem_cad
  from contas.receber r
union all
select 'P', g.numtransvenda, g.prest, g.codfilial, g.duplic, g.dtemissao, g.dtvenc, g.dtpag, g.dtcancel,
       g.codcli, cl.cliente, cl.fantasia, cl.cnpj, g.codusur, u.nome, g.codsupervisor, s.nome, g.codcob, b.cobranca,
       g.valor, g.txperm, g.valordesc, null::numeric, g.vpago,
       greatest(0, g.dtpag - g.dtvenc), g.codbanco, g.nossonumbco, g.tem_cad
  from contas.receber_pago g
  left join contas.cliente cl on cl.codcli = g.codcli
  left join contas.rca u on u.codusur = g.codusur
  left join contas.supervisor s on s.codsupervisor = g.codsupervisor
  left join contas.cobranca b on b.codcob = g.codcob
 where not exists (select 1 from contas.receber a where a.numtransvenda = g.numtransvenda and a.prest = g.prest);

-- ----------------------------------------------------------------------------- as colunas que a tela filtra e ordena
-- v = o valor (filtro e lista de valores), t = o tipo, r = o rótulo quando não é só o valor formatado (o que a lista
-- mostra e o "escrevendo" procura), o = 'r' quando a lista vai em ordem de nome, ord = a ordem da tabela
create or replace function contas.colunas(rot text) returns jsonb language sql immutable as $$
select case rot when 'pagar' then jsonb_build_object(
  'st',            jsonb_build_object('v', 'st', 't', 'text', 'r', $r$case st when 'A' then 'A PAGAR' else 'PAGO' end$r$),
  'codfilial',     jsonb_build_object('v', 'codfilial', 't', 'text', 'ord', $r$lpad(codfilial, 3, '0')$r$),
  'recnum',        jsonb_build_object('v', 'recnum', 't', 'bigint'),
  'recnumprinc',   jsonb_build_object('v', 'recnumprinc', 't', 'bigint'),
  'parceiro',      jsonb_build_object('v', $r$tipoparceiro || ':' || codfornec$r$, 't', 'text', 'r', $r$codfornec || ' - ' || coalesce(parceiro, '')$r$, 'o', 'r', 'ord', 'parceiro'),
  'codfornec',     jsonb_build_object('v', 'codfornec', 't', 'bigint'),
  'tipoparceiro',  jsonb_build_object('v', 'tipoparceiro', 't', 'text', 'r', $r$case tipoparceiro when 'F' then 'Fornecedor' when 'R' then 'RCA' when 'C' then 'Cliente' when 'M' then 'Motorista' when 'L' then 'Colaborador' else 'Outros' end$r$, 'o', 'r'),
  'estado',        jsonb_build_object('v', 'estado', 't', 'text'),
  'conta',         jsonb_build_object('v', 'codconta', 't', 'bigint', 'r', $r$codconta || ' - ' || coalesce(conta, '')$r$, 'o', 'r', 'ord', 'conta'),
  'grupo',         jsonb_build_object('v', 'grupoconta', 't', 'bigint', 'r', $r$grupoconta || ' - ' || coalesce(grupo, '')$r$, 'o', 'r', 'ord', 'grupo'),
  'historico',     jsonb_build_object('v', 'historico', 't', 'text'),
  'numnota',       jsonb_build_object('v', 'numnota', 't', 'bigint'),
  'duplic',        jsonb_build_object('v', 'duplic', 't', 'text'),
  'parcela',       jsonb_build_object('v', 'parcela', 't', 'text'),
  'dtlanc',        jsonb_build_object('v', 'dtlanc', 't', 'date'),
  'dtemissao',     jsonb_build_object('v', 'dtemissao', 't', 'date'),
  'dtvenc',        jsonb_build_object('v', 'dtvenc', 't', 'date'),
  'dtpagto',       jsonb_build_object('v', 'dtpagto', 't', 'date'),
  'dtcompetencia', jsonb_build_object('v', 'dtcompetencia', 't', 'date'),
  'valor',         jsonb_build_object('v', 'valor', 't', 'numeric'),
  'descontofin',   jsonb_build_object('v', 'descontofin', 't', 'numeric'),
  'valordev',      jsonb_build_object('v', 'valordev', 't', 'numeric'),
  'txperm',        jsonb_build_object('v', 'txperm', 't', 'numeric'),
  'vlvariacaocambial', jsonb_build_object('v', 'vlvariacaocambial', 't', 'numeric'),
  'valorpagar',    jsonb_build_object('v', 'valorpagar', 't', 'numeric'),
  'vpago',         jsonb_build_object('v', 'vpago', 't', 'numeric'),
  'atraso',        jsonb_build_object('v', 'atraso', 't', 'integer'),
  'numbanco',      jsonb_build_object('v', 'numbanco', 't', 'bigint'),
  'nomefunc',      jsonb_build_object('v', 'nomefunc', 't', 'text'),
  'comprador',     jsonb_build_object('v', 'codcomprador', 't', 'bigint', 'r', $r$codcomprador || ' - ' || coalesce(comprador, '')$r$, 'o', 'r', 'ord', 'comprador'),
  'boleto',        jsonb_build_object('v', 'boleto', 't', 'text'),
  'nfservico',     jsonb_build_object('v', 'nfservico', 't', 'text'),
  'tipolanc',      jsonb_build_object('v', 'tipolanc', 't', 'text', 'r', $r$case tipolanc when 'C' then 'Confirmado' when 'P' then 'Provisionado' else tipolanc end$r$))
else jsonb_build_object(
  'st',            jsonb_build_object('v', 'st', 't', 'text', 'r', $r$case st when 'A' then 'A RECEBER' else 'RECEBIDO' end$r$),
  'codfilial',     jsonb_build_object('v', 'codfilial', 't', 'text', 'ord', $r$lpad(codfilial, 3, '0')$r$),
  'duplic',        jsonb_build_object('v', 'duplic', 't', 'bigint'),
  'numtransvenda', jsonb_build_object('v', 'numtransvenda', 't', 'bigint'),
  'prest',         jsonb_build_object('v', 'prest', 't', 'text', 'ord', $r$lpad(prest, 4, '0')$r$),
  'cliente',       jsonb_build_object('v', 'codcli', 't', 'bigint', 'r', $r$codcli || ' - ' || coalesce(cliente, '')$r$, 'o', 'r', 'ord', 'cliente'),
  'fantasia',      jsonb_build_object('v', 'fantasia', 't', 'text'),
  'cnpj',          jsonb_build_object('v', 'cnpj', 't', 'text'),
  'rca',           jsonb_build_object('v', 'codusur', 't', 'bigint', 'r', $r$codusur || ' - ' || coalesce(rca, '')$r$, 'o', 'r', 'ord', 'rca'),
  'supervisor',    jsonb_build_object('v', 'codsupervisor', 't', 'bigint', 'r', $r$codsupervisor || ' - ' || coalesce(supervisor, '')$r$, 'o', 'r', 'ord', 'supervisor'),
  'cobranca',      jsonb_build_object('v', 'codcob', 't', 'text', 'r', $r$codcob || ' - ' || coalesce(cobranca, '')$r$, 'o', 'r'),
  'dtemissao',     jsonb_build_object('v', 'dtemissao', 't', 'date'),
  'dtvenc',        jsonb_build_object('v', 'dtvenc', 't', 'date'),
  'dtpag',         jsonb_build_object('v', 'dtpag', 't', 'date'),
  'dtcancel',      jsonb_build_object('v', 'dtcancel', 't', 'date'),
  'valor',         jsonb_build_object('v', 'valor', 't', 'numeric'),
  'txperm',        jsonb_build_object('v', 'txperm', 't', 'numeric'),
  'valordesc',     jsonb_build_object('v', 'valordesc', 't', 'numeric'),
  'areceber',      jsonb_build_object('v', 'areceber', 't', 'numeric'),
  'vpago',         jsonb_build_object('v', 'vpago', 't', 'numeric'),
  'atraso',        jsonb_build_object('v', 'atraso', 't', 'integer'),
  'codbanco',      jsonb_build_object('v', 'codbanco', 't', 'bigint'),
  'nossonumbco',   jsonb_build_object('v', 'nossonumbco', 't', 'text'))
end $$;

-- o valor formatado como a tela mostra (o que a busca da lista procura): data dd/mm/aaaa, número 1.234,56
create or replace function contas.formato(expr text, tipo text) returns text language sql immutable as $$
select case tipo when 'date' then format('to_char(%s, ''DD/MM/YYYY'')', expr)
                 when 'numeric' then format('contas.br(%s)', expr)
                 else format('(%s)::text', expr) end $$;

create or replace function contas.rotulo(c jsonb) returns text language sql immutable as $$
select coalesce(c->>'r', contas.formato(c->>'v', c->>'t')) $$;

-- o filtro de uma coluna, no jeito do Excel: lista de condições (OU), cada uma
--   {"m":"em","v":[...]}       os valores marcados (null = "(Vazias)")
--   {"m":"fora","v":[...]}     tudo menos os desmarcados (a lista começou toda marcada)
--   {"m":"contem","t":"abc","fora":[...]}   o que foi escrito na busca (todos os que contêm), menos os desmarcados
--   {"m":"faixa","de":"...","ate":"..."}      número ou data entre de e até (as duas pontas incluídas)
create or replace function contas.filtro_coluna(c jsonb, conds jsonb) returns text language plpgsql immutable as $$
declare
  partes text[] := '{}';
  x jsonb; v text := c->>'v'; t text := c->>'t'; r text := contas.rotulo(c);
  vals text[]; tem_nulo boolean; fora text[]; fora_nulo boolean; p text;
begin
  if t not in ('text', 'bigint', 'integer', 'date', 'numeric') then raise exception 'tipo de coluna inválido'; end if;
  if jsonb_typeof(conds) <> 'array' then return null; end if;
  for x in select * from jsonb_array_elements(conds) loop
    if x->>'m' in ('em', 'fora') then
      vals := array(select e from jsonb_array_elements_text(coalesce(x->'v', '[]')) e where e is not null);
      tem_nulo := exists (select 1 from jsonb_array_elements(coalesce(x->'v', '[]')) e where e = 'null'::jsonb);
      if x->>'m' = 'em' then
        p := format('(%s) = any(%L::%s[])', v, vals, t);
        if tem_nulo then p := format('(%s or (%s) is null)', p, v); end if;
      else
        p := format('not coalesce((%s) = any(%L::%s[]), false)', v, vals, t);
        if tem_nulo then p := format('(%s and (%s) is not null)', p, v); end if;
      end if;
    elsif x->>'m' = 'faixa' then
      -- de/até (número ou data), as duas pontas incluídas
      p := concat_ws(' and ',
             case when nullif(x->>'de', '') is not null then format('(%s) >= %L::%s', v, x->>'de', t) end,
             case when nullif(x->>'ate', '') is not null then format('(%s) <= %L::%s', v, x->>'ate', t) end);
      if p is null or p = '' then continue; end if;
      p := '(' || p || ')';
    elsif x->>'m' = 'contem' then
      p := format('(%s) ilike %L', r, '%' || replace(replace(replace(coalesce(x->>'t', ''), '\', '\\'), '%', '\%'), '_', '\_') || '%');
      fora := array(select e from jsonb_array_elements_text(coalesce(x->'fora', '[]')) e where e is not null);
      fora_nulo := exists (select 1 from jsonb_array_elements(coalesce(x->'fora', '[]')) e where e = 'null'::jsonb);
      if cardinality(fora) > 0 then p := format('(%s and not coalesce((%s) = any(%L::%s[]), false))', p, v, fora, t); end if;
      if fora_nulo then p := format('(%s and (%s) is not null)', p, v); end if;
    else
      continue;
    end if;
    partes := partes || p;
  end loop;
  if cardinality(partes) = 0 then return null; end if;
  return '(' || array_to_string(partes, ' or ') || ')';
end $$;

-- ----------------------------------------------------------------------------- a consulta da tela
-- p: { rot: pagar|receber, acao: lista|valores|opcoes, status: aberto|pago|todos, campo: <coluna de data>, de, ate,
--      q (busca geral), cf: {coluna: [condições]} (filtros das colunas), col + busca (acao valores),
--      ordem (coluna), desc, offset, limite, sem_totais, campos (Excel: só estas colunas, cada linha uma lista),
--      mostrar: { 717: creditos, excluidos, cheque, antigos · 1240: desd, semcad, cancelados, antigos } }
create or replace function contas.consulta(p jsonb)
returns json language plpgsql stable set search_path = contas, pg_temp as $$
declare
  rot   text := case when p->>'rot' = 'receber' then 'receber' else 'pagar' end;
  ehpg  boolean := rot = 'pagar';
  vw    text := case when ehpg then 'contas.v_pagar' else 'contas.v_receber' end;
  cols  jsonb := contas.colunas(rot);
  acao  text := coalesce(p->>'acao', 'lista');
  st    text := coalesce(p->>'status', 'aberto');
  most  jsonb := coalesce(p->'mostrar', '{}'::jsonb);
  w     text[] := array['true'];
  wcol  jsonb := '{}'::jsonb;   -- coluna -> sql do filtro dela (fica fora da lista de valores da própria coluna)
  inc   text;
  qtxt  text := nullif(btrim(coalesce(p->>'q', '')), '');
  lim   int := least(greatest(coalesce((p->>'limite')::int, 50), 1), 20000);
  off   int := greatest(coalesce((p->>'offset')::int, 0), 0);
  c     jsonb; k text; f text; dcol jsonb; ord text; dir text; busca text; extra text; sel text; ok boolean;
  r_tot json; r_lin json; r_val json; ini timestamptz := clock_timestamp();
begin
  if acao = 'opcoes' then
    return json_build_object('filiais', (select coalesce(json_agg(json_build_object('id', codfilial, 'n', coalesce(fantasia, razaosocial), 'sub', concat_ws(' / ', cidade, uf)) order by lpad(codfilial, 3, '0')), '[]') from contas.filial));
  end if;

  /* status e período */
  if st = 'aberto' then w := w || 'st = ''A'''::text; elsif st = 'pago' then w := w || 'st = ''P'''::text; end if;
  dcol := cols->(p->>'campo');
  if dcol is not null and dcol->>'t' = 'date' then
    if nullif(p->>'de', '') is not null then w := w || format('%s >= %L::date', dcol->>'v', p->>'de'); end if;
    if nullif(p->>'ate', '') is not null then w := w || format('%s <= %L::date', dcol->>'v', p->>'ate'); end if;
  end if;

  /* busca geral */
  if qtxt is not null then
    if ehpg then
      if qtxt ~ '^\d{1,15}$' then
        w := w || format('(recnum = %1$L::bigint or numnota = %1$L::bigint or codfornec = %1$L::bigint or duplic = %1$L)', qtxt);
      else
        w := w || format('(parceiro ilike %1$L or historico ilike %1$L or conta ilike %1$L)', '%' || qtxt || '%');
      end if;
    else
      if qtxt ~ '^\d{1,15}$' then
        w := w || format('(duplic = %1$L::bigint or numtransvenda = %1$L::bigint or codcli = %1$L::bigint or nossonumbco = %1$L)', qtxt);
      else
        w := w || format('(cliente ilike %1$L or fantasia ilike %1$L or nossonumbco ilike %1$L or (length(%2$L) >= 7 and regexp_replace(coalesce(cnpj, ''''), ''\D'', '''', ''g'') like ''%%'' || %2$L || ''%%''))',
                         '%' || qtxt || '%', regexp_replace(qtxt, '\D', '', 'g'));
      end if;
    end if;
  end if;

  /* filtros das colunas */
  if jsonb_typeof(p->'cf') = 'object' then
    for k, c in select key, value from jsonb_each(p->'cf') loop
      if cols ? k then
        f := contas.filtro_coluna(cols->k, c);
        if f is not null then wcol := wcol || jsonb_build_object(k, f); end if;
      end if;
    end loop;
  end if;

  /* o que fica fora das somas de saída (cada um com "mostrar" na tela) */
  if ehpg then
    inc := format('(st <> ''P'' or valor >= 0 or %L::boolean) and (%L::boolean or recnum not in (select chave::bigint from contas.excluido where rot = ''pagar'')) and (st <> ''A'' or not emitido or %L::boolean) and (st <> ''A'' or dtvenc >= date ''2011-01-01'' or %L::boolean)',
                  coalesce((most->>'creditos')::boolean, false), coalesce((most->>'excluidos')::boolean, false),
                  coalesce((most->>'cheque')::boolean, false), coalesce((most->>'antigos')::boolean, false));
  else
    inc := format('(codcob is distinct from ''DESD'' or %L::boolean) and (tem_cad = ''S'' or %L::boolean) and (st <> ''P'' or dtcancel is null or %L::boolean) and (st <> ''A'' or dtvenc >= date ''2011-01-01'' or %L::boolean)',
                  coalesce((most->>'desd')::boolean, false), coalesce((most->>'semcad')::boolean, false),
                  coalesce((most->>'cancelados')::boolean, false), coalesce((most->>'antigos')::boolean, false));
  end if;

  /* lista de valores de uma coluna (o filtro do Excel): tudo filtrado menos a própria coluna */
  if acao = 'valores' then
    k := p->>'col';
    c := cols->k;
    if c is null then raise exception 'coluna desconhecida: %', k; end if;
    f := array_to_string(w || array(select value from jsonb_each_text(wcol) where key <> k), ' and ');
    busca := nullif(btrim(coalesce(p->>'busca', '')), '');
    if busca is not null then
      f := f || format(' and (%s) ilike %L', contas.rotulo(c),
                       '%' || replace(replace(replace(busca, '\', '\\'), '%', '\%'), '_', '\_') || '%');
    end if;
    lim := least(greatest(coalesce((p->>'limite')::int, 500), 10), 2000);
    if c->>'o' = 'r' or c ? 'r' then
      -- código + nome (ou rótulo próprio): agrupa pelo valor e mostra o rótulo
      execute format($q$
        select json_build_object('vals', coalesce(json_agg(json_build_object('v', vv, 'r', rr, 'n', n) order by %s), '[]'), 'tem', count(*))
          from (select (%s)::text as vv, min(%s) as rr, min(%s) as oo, count(*) as n
                  from %s b where %s and (%s) group by (%s)
                 order by %s nulls first limit %s) x$q$,
        case when c->>'o' = 'r' then 'rr' else 'oo' end,
        c->>'v', c->>'r', c->>'v', vw, f, inc, c->>'v',
        case when c->>'o' = 'r' then 'min(' || (c->>'r') || ')' else 'min(' || (c->>'v') || ')' end, lim + 1) into r_val;
    else
      -- valor simples: agrupa e formata só o grupo (barato mesmo com milhões de títulos)
      execute format($q$
        select json_build_object('vals', coalesce(json_agg(json_build_object('v', vv::text, 'r', %s, 'n', n) order by vv nulls first), '[]'), 'tem', count(*))
          from (select (%s) as vv, count(*) as n from %s b where %s and (%s) group by 1 order by 1 nulls first limit %s) x$q$,
        contas.formato('vv', c->>'t'), c->>'v', vw, f, inc, lim + 1) into r_val;
    end if;
    -- a linha a mais (limit + 1) só diz que tem mais: sai da lista
    if (r_val->>'tem')::int > lim then
      r_val := json_build_object('vals', (select json_agg(e order by i) from json_array_elements(r_val->'vals') with ordinality a(e, i) where i <= lim), 'mais', true);
    else
      r_val := json_build_object('vals', r_val->'vals', 'mais', false);
    end if;
    return json_build_object('valores', r_val, 'ms', (extract(epoch from (clock_timestamp() - ini)) * 1000)::int);
  end if;

  f := array_to_string(w || array(select value from jsonb_each_text(wcol)), ' and ');

  /* totais do recorte e o que ficou fora, numa passada só */
  if not coalesce((p->>'sem_totais')::boolean, false) then
    if ehpg then
      execute format($q$
        select json_build_object(
          'n', count(*) filter (where i), 'n_aberto', count(*) filter (where i and st = 'A'), 'n_pago', count(*) filter (where i and st = 'P'),
          'valor', coalesce(sum(valor) filter (where i), 0), 'descontofin', coalesce(sum(descontofin) filter (where i), 0),
          'valordev', coalesce(sum(valordev) filter (where i), 0), 'txperm', coalesce(sum(txperm) filter (where i), 0),
          'valorpagar', coalesce(sum(valorpagar) filter (where i and st = 'A'), 0), 'vpago', coalesce(sum(vpago) filter (where i and st = 'P'), 0),
          'fora', json_build_object(
            'creditos', json_build_object('n', count(*) filter (where st = 'P' and valor < 0 and not ex), 'v', coalesce(sum(vpago) filter (where st = 'P' and valor < 0 and not ex), 0)),
            'excluidos', json_build_object('n', count(*) filter (where ex), 'v', coalesce(sum(valor) filter (where ex), 0)),
            'cheque', json_build_object('n', count(*) filter (where st = 'A' and emitido), 'v', coalesce(sum(valorpagar) filter (where st = 'A' and emitido), 0)),
            'antigos', json_build_object('n', count(*) filter (where st = 'A' and dtvenc < date '2011-01-01'), 'v', coalesce(sum(valorpagar) filter (where st = 'A' and dtvenc < date '2011-01-01'), 0))))
          from (select b.*, (%s) as i, recnum in (select chave::bigint from contas.excluido where rot = 'pagar') as ex from %s b where %s) z$q$,
        inc, vw, f) into r_tot;
    else
      execute format($q$
        select json_build_object(
          'n', count(*) filter (where i), 'n_aberto', count(*) filter (where i and st = 'A'), 'n_pago', count(*) filter (where i and st = 'P'),
          'valor', coalesce(sum(valor) filter (where i), 0), 'txperm', coalesce(sum(txperm) filter (where i), 0),
          'valordesc', coalesce(sum(valordesc) filter (where i), 0),
          'areceber', coalesce(sum(valor) filter (where i and st = 'A'), 0), 'vpago', coalesce(sum(vpago) filter (where i and st = 'P'), 0),
          'fora', json_build_object(
            'desd', json_build_object('n', count(*) filter (where codcob = 'DESD'), 'v', coalesce(sum(valor) filter (where codcob = 'DESD'), 0)),
            'semcad', json_build_object('n', count(*) filter (where tem_cad <> 'S'), 'v', coalesce(sum(valor) filter (where tem_cad <> 'S'), 0)),
            'cancelados', json_build_object('n', count(*) filter (where st = 'P' and dtcancel is not null), 'v', coalesce(sum(valor) filter (where st = 'P' and dtcancel is not null), 0)),
            'antigos', json_build_object('n', count(*) filter (where st = 'A' and dtvenc < date '2011-01-01'), 'v', coalesce(sum(valor) filter (where st = 'A' and dtvenc < date '2011-01-01'), 0))))
          from (select b.*, (%s) as i from %s b where %s) z$q$,
        inc, vw, f) into r_tot;
    end if;
  end if;

  /* a página (ou o lote do Excel) */
  c := cols->(p->>'ordem');
  ord := coalesce(c->>'ord', c->>'v', 'dtvenc');
  dir := case when coalesce((p->>'desc')::boolean, false) then 'desc' else 'asc' end;
  -- campos calculados: o número de parcelas da nota (1240: os títulos da mesma transação de venda, fora a cobrança
  -- DESD, em aberto e recebidos) e o lançamento que está fora das somas (717)
  extra := case when ehpg then 'b.recnum in (select chave::bigint from contas.excluido where rot = ''pagar'')'
                else '(select count(distinct x.prest) from (select prest from contas.receber where numtransvenda = b.numtransvenda and codcob is distinct from ''DESD'' union all select prest from contas.receber_pago where numtransvenda = b.numtransvenda and codcob is distinct from ''DESD'') x)' end;
  if jsonb_typeof(p->'campos') = 'array' then
    -- Excel: só as colunas pedidas, cada linha uma lista na ordem pedida (cabe muito mais linha por chamada)
    select string_agg(case when x in ('parcelas', 'excluido') then extra else 'b.' || quote_ident(x) end, ', ' order by i),
           bool_and(x in ('parcelas', 'excluido') or x in (select attname from pg_attribute where attrelid = vw::regclass and attnum > 0 and not attisdropped))
      into sel, ok
      from jsonb_array_elements_text(p->'campos') with ordinality a(x, i);
    if not coalesce(ok, false) then raise exception 'campo desconhecido em campos'; end if;
    sel := 'json_build_array(' || sel || ')';
  else
    sel := 'to_jsonb(b) - ''k'' || jsonb_build_object(' || case when ehpg then '''excluido''' else '''parcelas''' end || ', ' || extra || ')';
  end if;
  execute format($q$
    select coalesce(json_agg(%s order by k), '[]')
      from (select b.*, row_number() over () as k from (select * from %s b where %s and (%s) order by %s %s nulls last, %s limit %s offset %s) b) b$q$,
    sel, vw, f, inc, ord, dir,
    case when ehpg then 'recnum ' || dir else 'numtransvenda ' || dir || ', prest ' || dir end, lim, off) into r_lin;

  return json_build_object('tot', r_tot, 'linhas', r_lin, 'ms', (extract(epoch from (clock_timestamp() - ini)) * 1000)::int, 'hoje', contas.hoje());
end $$;
comment on function contas.consulta(jsonb) is
  'A consulta da tela do Contas a Pagar e Receber: página, totais, o que os filtros de saída deixam fora e a lista de valores de cada coluna (filtro do Excel), sobre os em aberto e os pagos desde 2011. Colunas de uma lista fixa (contas.colunas); valor do usuário só entre aspas.';

-- ----------------------------------------------------------------------------- tela do título também para os pagos
create or replace function contas.detalhe_pagar(p_recnum bigint)
returns json language sql stable set search_path = contas, pg_temp as $$
select case when exists (select 1 from contas.pagar where recnum = p_recnum) then
  json_build_object(
    'st', 'A',
    't', (select row_to_json(p) from contas.pagar p where p.recnum = p_recnum),
    'desd', (select coalesce(json_agg(json_build_object('r', q.recnum, 'rp', q.recnumprinc, 'dv', q.dtvenc, 'vl', q.valor,
                      'du', q.duplic, 'pc', q.parcela, 'fi', q.codfilial) order by q.dtvenc, q.recnum), '[]')
               from contas.pagar q, contas.pagar p
              where p.recnum = p_recnum and q.recnum <> p.recnum
                and (q.recnumprinc = coalesce(p.recnumprinc, p.recnum) or q.recnum = p.recnumprinc)),
    'lido', (select json_build_object('lido_em', lido_em, 'mudou_em', mudou_em, 'status', status) from agente.estado where fluxo = 'contas.pagar'))
else
  json_build_object(
    'st', 'P',
    't', (select to_jsonb(v) from contas.v_pagar v where v.recnum = p_recnum and v.st = 'P'),
    'desd', '[]'::json,
    'lido', (select json_build_object('lido_em', lido_em, 'mudou_em', mudou_em, 'status', status) from agente.estado where fluxo = 'contas.pagar_pago'))
end;
$$;

create or replace function contas.detalhe_receber(p_nt bigint, p_prest text)
returns json language sql stable set search_path = contas, pg_temp as $$
with origens as (
  select distinct d.nt_orig, d.prest_orig from contas.receber_desd d
   where d.tipo_rel = 'D' and d.numtransvenda = p_nt and d.prest = p_prest
), parcelas as (
  select coalesce(json_agg(json_build_object('st', x.st, 'prest', x.prest, 'dtvenc', x.dtvenc, 'dtpag', x.dtpag, 'valor', x.valor,
                                             'vpago', x.vpago, 'codcob', x.codcob) order by x.dtvenc, x.prest), '[]') as j
    from (select 'A' st, prest, dtvenc, dtpag, valor, vpago, codcob from contas.receber where numtransvenda = p_nt
          union all
          select 'P', g.prest, g.dtvenc, g.dtpag, g.valor, g.vpago, g.codcob from contas.receber_pago g
           where g.numtransvenda = p_nt and not exists (select 1 from contas.receber a where a.numtransvenda = g.numtransvenda and a.prest = g.prest)) x
)
select case when exists (select 1 from contas.receber where numtransvenda = p_nt and prest = p_prest) then
  json_build_object(
    'st', 'A',
    't', (select row_to_json(r) from contas.receber r where r.numtransvenda = p_nt and r.prest = p_prest),
    'obs', (select row_to_json(o) from contas.receber_obs o where o.numtransvenda = p_nt and o.prest = p_prest),
    'bk', (select coalesce(json_agg(row_to_json(b) order by b.data desc, b.rid), '[]')
             from contas.receber_bk b where b.numtransvenda = p_nt and b.prest = p_prest),
    'desd', (select coalesce(json_agg(row_to_json(d) order by d.nt_orig, d.prest_orig, d.tipo_rel desc, d.numtransvenda, d.prest), '[]')
               from contas.receber_desd d join origens o on o.nt_orig = d.nt_orig and o.prest_orig = d.prest_orig),
    'itens', (select coalesce(json_agg(row_to_json(i) order by i.codprod, i.rid), '[]')
                from contas.receber_item i where i.numtransvenda = p_nt),
    'banco', (select coalesce(json_agg(row_to_json(b) order by b.data desc, b.rid), '[]')
                from contas.receber_banco b where b.numtransvenda = p_nt and b.prest = p_prest),
    'parcelas', (select j from parcelas),
    'lido', (select coalesce(json_object_agg(fluxo, json_build_object('lido_em', lido_em, 'mudou_em', mudou_em, 'status', status)), '{}')
               from agente.estado where fluxo like 'contas.receber%'))
else
  json_build_object(
    'st', 'P',
    't', (select to_jsonb(v) from contas.v_receber v where v.numtransvenda = p_nt and v.prest = p_prest and v.st = 'P'),
    'parcelas', (select j from parcelas),
    'lido', (select coalesce(json_object_agg(fluxo, json_build_object('lido_em', lido_em, 'mudou_em', mudou_em, 'status', status)), '{}')
               from agente.estado where fluxo like 'contas.receber%'))
end;
$$;

-- ----------------------------------------------------------------------------- acesso: só o servidor
revoke all on all tables in schema contas from public;
revoke all on all functions in schema contas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema contas from anon, authenticated;
    revoke all on all functions in schema contas from anon, authenticated;
  end if;
end $$;

-- o pacote da lista não é mais usado (a tela consulta o banco): o agente não precisa refazer nada depois de gravar
update agente.sistema set apos_gravar = null where sistema = 'contas';
