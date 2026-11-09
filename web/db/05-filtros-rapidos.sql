-- =============================================================================
-- CONTAS A PAGAR E RECEBER — filtros rápidos sobre o histórico (migração contas_05_filtros_rapidos, 2026-11-09)
--
-- Continua a contas_04: com 1,16 mi pagos (717) e 3,08 mi recebidos (1240) no banco, nenhum filtro pode depender
-- de procurar o nome de cada título um por um.
--   · Colunas de código + nome (parceiro, conta, grupo, comprador, cliente, RCA, supervisor, cobrança): a lista do
--     filtro agrupa pelo código (sem nome) e só depois busca o nome de cada código no cadastro (lk); o "escrevendo"
--     acha os códigos no cadastro (ks) e filtra por eles. A busca geral também procura o nome no cadastro.
--   · A página ordena só a chave do título e busca as linhas inteiras depois (página de 50 = 50 buscas pela chave).
--   · Índices para achar um título por nota e filtrar por emissão sem ler o histórico inteiro.
--   · A consulta roda com mais memória de trabalho (ordenação sem disco) e até 2 processos em paralelo.
-- O parceiro "Outros" (tipo O da 717) não tem cadastro: o valor do filtro é o próprio nome escrito no lançamento.
-- =============================================================================

create index if not exists pagar_pago_numnota on contas.pagar_pago (numnota);
create index if not exists pagar_pago_dtemissao on contas.pagar_pago (dtemissao);
create index if not exists receber_pago_dtemissao on contas.receber_pago (dtemissao);

-- v = o valor (filtro e lista de valores), t = o tipo, r = o rótulo na linha, o = 'r' (lista em ordem de nome),
-- ord = a ordem da tabela, lk = o rótulo de um valor (vv, texto) pelo cadastro, ks = os valores cujo rótulo contém
-- %1$L (pelo cadastro), kx = condição a mais na linha para o mesmo "contém" (o que não tem cadastro)
create or replace function contas.colunas(rot text) returns jsonb language sql immutable parallel safe as $$
select case rot when 'pagar' then jsonb_build_object(
  'st',            jsonb_build_object('v', 'st', 't', 'text', 'r', $r$case st when 'A' then 'A PAGAR' else 'PAGO' end$r$),
  'codfilial',     jsonb_build_object('v', 'codfilial', 't', 'text', 'ord', $r$lpad(codfilial, 3, '0')$r$),
  'recnum',        jsonb_build_object('v', 'recnum', 't', 'bigint'),
  'recnumprinc',   jsonb_build_object('v', 'recnumprinc', 't', 'bigint'),
  'parceiro',      jsonb_build_object(
                     'v', $r$case when ptxt is null then tipoparceiro || ':' || codfornec else 'O:' || ptxt end$r$, 't', 'text',
                     'r', $r$case when ptxt is null then codfornec || ' - ' || coalesce(parceiro, '') else ptxt end$r$, 'o', 'r', 'ord', 'parceiro',
                     'lk', $r$case when left(vv, 2) = 'O:' then substr(vv, 3) else split_part(vv, ':', 2) || ' - ' || coalesce(case split_part(vv, ':', 1)
                             when 'F' then (select x.fornecedor from contas.fornecedor x where x.codfornec = split_part(vv, ':', 2)::bigint)
                             when 'C' then (select x.cliente from contas.cliente x where x.codcli = split_part(vv, ':', 2)::bigint)
                             when 'R' then (select x.nome from contas.rca x where x.codusur = split_part(vv, ':', 2)::bigint)
                             else (select x.nome from contas.funcionario x where x.matricula = split_part(vv, ':', 2)::bigint) end, '') end$r$,
                     'ks', $r$select 'F:' || codfornec from contas.fornecedor where (codfornec || ' - ' || coalesce(fornecedor, '')) ilike %1$L
                             union all select 'C:' || codcli from contas.cliente where (codcli || ' - ' || coalesce(cliente, '')) ilike %1$L
                             union all select 'R:' || codusur from contas.rca where (codusur || ' - ' || coalesce(nome, '')) ilike %1$L
                             union all select t.t || ':' || matricula from contas.funcionario, (values ('M'), ('L')) t(t) where (matricula || ' - ' || coalesce(nome, '')) ilike %1$L$r$,
                     'kx', $r$ptxt ilike %1$L$r$),
  'codfornec',     jsonb_build_object('v', 'codfornec', 't', 'bigint'),
  'tipoparceiro',  jsonb_build_object('v', 'tipoparceiro', 't', 'text', 'r', $r$case tipoparceiro when 'F' then 'Fornecedor' when 'R' then 'RCA' when 'C' then 'Cliente' when 'M' then 'Motorista' when 'L' then 'Colaborador' else 'Outros' end$r$, 'o', 'r'),
  'estado',        jsonb_build_object('v', 'estado', 't', 'text'),
  'conta',         jsonb_build_object('v', 'codconta', 't', 'bigint', 'r', $r$codconta || ' - ' || coalesce(conta, '')$r$, 'o', 'r', 'ord', 'conta',
                     'lk', $r$vv || ' - ' || coalesce((select x.conta from contas.conta x where x.codconta = vv::bigint), '')$r$,
                     'ks', $r$select codconta::text from contas.conta where (codconta || ' - ' || coalesce(conta, '')) ilike %1$L$r$),
  'grupo',         jsonb_build_object('v', 'grupoconta', 't', 'bigint', 'r', $r$grupoconta || ' - ' || coalesce(grupo, '')$r$, 'o', 'r', 'ord', 'grupo',
                     'lk', $r$vv || ' - ' || coalesce((select max(x.grupo) from contas.conta x where x.grupoconta = vv::bigint), '')$r$,
                     'ks', $r$select distinct grupoconta::text from contas.conta where (grupoconta || ' - ' || coalesce(grupo, '')) ilike %1$L$r$),
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
  'comprador',     jsonb_build_object('v', 'codcomprador', 't', 'bigint', 'r', $r$codcomprador || ' - ' || coalesce(comprador, '')$r$, 'o', 'r', 'ord', 'comprador',
                     'lk', $r$vv || ' - ' || coalesce((select coalesce(x.guerra, x.nome) from contas.funcionario x where x.matricula = vv::bigint), '')$r$,
                     'ks', $r$select matricula::text from contas.funcionario where (matricula || ' - ' || coalesce(guerra, nome, '')) ilike %1$L$r$),
  'boleto',        jsonb_build_object('v', 'boleto', 't', 'text'),
  'nfservico',     jsonb_build_object('v', 'nfservico', 't', 'text'),
  'tipolanc',      jsonb_build_object('v', 'tipolanc', 't', 'text', 'r', $r$case tipolanc when 'C' then 'Confirmado' when 'P' then 'Provisionado' else tipolanc end$r$))
else jsonb_build_object(
  'st',            jsonb_build_object('v', 'st', 't', 'text', 'r', $r$case st when 'A' then 'A RECEBER' else 'RECEBIDO' end$r$),
  'codfilial',     jsonb_build_object('v', 'codfilial', 't', 'text', 'ord', $r$lpad(codfilial, 3, '0')$r$),
  'duplic',        jsonb_build_object('v', 'duplic', 't', 'bigint'),
  'numtransvenda', jsonb_build_object('v', 'numtransvenda', 't', 'bigint'),
  'prest',         jsonb_build_object('v', 'prest', 't', 'text', 'ord', $r$lpad(prest, 4, '0')$r$),
  'cliente',       jsonb_build_object('v', 'codcli', 't', 'bigint', 'r', $r$codcli || ' - ' || coalesce(cliente, '')$r$, 'o', 'r', 'ord', 'cliente',
                     'lk', $r$vv || ' - ' || coalesce((select x.cliente from contas.cliente x where x.codcli = vv::bigint), '')$r$,
                     'ks', $r$select codcli::text from contas.cliente where (codcli || ' - ' || coalesce(cliente, '')) ilike %1$L$r$),
  'fantasia',      jsonb_build_object('v', 'fantasia', 't', 'text'),
  'cnpj',          jsonb_build_object('v', 'cnpj', 't', 'text'),
  'rca',           jsonb_build_object('v', 'codusur', 't', 'bigint', 'r', $r$codusur || ' - ' || coalesce(rca, '')$r$, 'o', 'r', 'ord', 'rca',
                     'lk', $r$vv || ' - ' || coalesce((select x.nome from contas.rca x where x.codusur = vv::bigint), '')$r$,
                     'ks', $r$select codusur::text from contas.rca where (codusur || ' - ' || coalesce(nome, '')) ilike %1$L$r$),
  'supervisor',    jsonb_build_object('v', 'codsupervisor', 't', 'bigint', 'r', $r$codsupervisor || ' - ' || coalesce(supervisor, '')$r$, 'o', 'r', 'ord', 'supervisor',
                     'lk', $r$vv || ' - ' || coalesce((select x.nome from contas.supervisor x where x.codsupervisor = vv::bigint), '')$r$,
                     'ks', $r$select codsupervisor::text from contas.supervisor where (codsupervisor || ' - ' || coalesce(nome, '')) ilike %1$L$r$),
  'cobranca',      jsonb_build_object('v', 'codcob', 't', 'text', 'r', $r$codcob || ' - ' || coalesce(cobranca, '')$r$, 'o', 'r',
                     'lk', $r$vv || ' - ' || coalesce((select x.cobranca from contas.cobranca x where x.codcob = vv), '')$r$,
                     'ks', $r$select codcob from contas.cobranca where (codcob || ' - ' || coalesce(cobranca, '')) ilike %1$L$r$),
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

-- o "%texto%" do ilike, com \ % _ escritos pelo usuário valendo como letra
create or replace function contas.padrao(t text) returns text language sql immutable parallel safe as
$$ select '%' || replace(replace(replace(coalesce(t, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' $$;

-- o filtro de uma coluna, no jeito do Excel: lista de condições (OU), cada uma
--   {"m":"em","v":[...]}       os valores marcados (null = "(Vazias)")
--   {"m":"fora","v":[...]}     tudo menos os desmarcados (a lista começou toda marcada)
--   {"m":"contem","t":"abc","fora":[...]}   o que foi escrito na busca (todos os que contêm), menos os desmarcados
--   {"m":"faixa","de":"...","ate":"..."}      número ou data entre de e até (as duas pontas incluídas)
create or replace function contas.filtro_coluna(c jsonb, conds jsonb) returns text language plpgsql immutable parallel safe as $$
declare
  partes text[] := '{}';
  x jsonb; v text := c->>'v'; t text := c->>'t'; r text := contas.rotulo(c);
  vals text[]; tem_nulo boolean; fora text[]; fora_nulo boolean; p text; pad text;
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
      p := concat_ws(' and ',
             case when nullif(x->>'de', '') is not null then format('(%s) >= %L::%s', v, x->>'de', t) end,
             case when nullif(x->>'ate', '') is not null then format('(%s) <= %L::%s', v, x->>'ate', t) end);
      if p is null or p = '' then continue; end if;
      p := '(' || p || ')';
    elsif x->>'m' = 'contem' then
      pad := contas.padrao(x->>'t');
      if c ? 'ks' then
        -- código + nome: os códigos cujo nome contém o texto, achados no cadastro (não título a título)
        p := format('((%s)::text in (%s)%s)', v, format(c->>'ks', pad), case when c ? 'kx' then ' or ' || format(c->>'kx', pad) else '' end);
      else
        p := format('(%s) ilike %L', r, pad);
      end if;
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
returns json language plpgsql stable set search_path = contas, pg_temp set work_mem = '48MB' set max_parallel_workers_per_gather = 2 as $$
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
  c     jsonb; k text; f text; dcol jsonb; ord text; dir text; busca text; extra text; sel text; ok boolean; pad text; dig text;
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

  /* busca geral: número = o título pela chave ou pela nota; texto = nome no cadastro, histórico */
  if qtxt is not null then
    pad := contas.padrao(qtxt);
    if ehpg then
      if qtxt ~ '^\d{1,15}$' then
        w := w || format('(recnum = %1$L::bigint or numnota = %1$L::bigint or codfornec = %1$L::bigint)', qtxt);
      else
        w := w || format('(historico ilike %1$L or ptxt ilike %1$L or (case when ptxt is null then tipoparceiro || '':'' || codfornec end) in (%2$s) or codconta in (select codconta from contas.conta where conta ilike %1$L))',
                         pad, format(cols->'parceiro'->>'ks', pad));
      end if;
    else
      dig := regexp_replace(qtxt, '\D', '', 'g');
      if qtxt ~ '^\d{1,15}$' then
        w := w || format('(duplic = %1$L::bigint or numtransvenda = %1$L::bigint or codcli = %1$L::bigint)', qtxt);
      else
        w := w || format('(codcli in (select codcli from contas.cliente where cliente ilike %1$L or fantasia ilike %1$L%2$s) or nossonumbco ilike %1$L)',
                         pad, case when length(dig) >= 7 then format(' or regexp_replace(coalesce(cnpj, ''''), ''\D'', '''', ''g'') like %L', '%' || dig || '%') else '' end);
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
    lim := least(greatest(coalesce((p->>'limite')::int, 500), 10), 2000);
    if c ? 'lk' then
      -- código + nome: agrupa pelo código (sem ler nome nenhum) e busca o nome de cada código no cadastro
      execute format($q$
        select json_build_object('vals', coalesce(json_agg(json_build_object('v', vv, 'r', rr, 'n', n) order by rr nulls first), '[]'), 'tem', count(*))
          from (select vv, rr, n from (select vv, (%s) as rr, n from (select (%s)::text as vv, count(*) as n from %s b where %s and (%s) group by 1) g) h
                 where %s order by rr nulls first limit %s) x$q$,
        c->>'lk', c->>'v', vw, f, inc, case when busca is null then 'true' else format('rr ilike %L', contas.padrao(busca)) end, lim + 1) into r_val;
    elsif c ? 'r' then
      -- rótulo que só depende do próprio valor (status, tipo): agrupa e escreve
      if busca is not null then f := f || format(' and (%s) ilike %L', c->>'r', contas.padrao(busca)); end if;
      execute format($q$
        select json_build_object('vals', coalesce(json_agg(json_build_object('v', vv, 'r', rr, 'n', n) order by %s), '[]'), 'tem', count(*))
          from (select (%s)::text as vv, min(%s) as rr, min(%s) as oo, count(*) as n
                  from %s b where %s and (%s) group by (%s) order by %s nulls first limit %s) x$q$,
        case when c->>'o' = 'r' then 'rr' else 'oo' end, c->>'v', c->>'r', c->>'v', vw, f, inc, c->>'v',
        case when c->>'o' = 'r' then 'rr' else 'oo' end, lim + 1) into r_val;
    else
      -- valor simples: agrupa e formata só o grupo (barato mesmo com milhões de títulos)
      if busca is not null then f := f || format(' and (%s) ilike %L', contas.rotulo(c), contas.padrao(busca)); end if;
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
          from (select b.st, b.valor, b.descontofin, b.valordev, b.txperm, b.valorpagar, b.vpago, b.emitido, b.dtvenc, (%s) as i,
                       b.recnum in (select chave::bigint from contas.excluido where rot = 'pagar') as ex from %s b where %s) z$q$,
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
          from (select b.st, b.valor, b.txperm, b.valordesc, b.vpago, b.codcob, b.tem_cad, b.dtcancel, b.dtvenc, (%s) as i from %s b where %s) z$q$,
        inc, vw, f) into r_tot;
    end if;
  end if;

  /* a página (ou o lote do Excel): primeiro só a chave, na ordem pedida; depois as linhas inteiras dessa chave */
  c := cols->(p->>'ordem');
  ord := coalesce(c->>'ord', c->>'v', 'dtvenc');
  dir := case when coalesce((p->>'desc')::boolean, false) then 'desc' else 'asc' end;
  -- campos calculados: as parcelas da venda (1240: n = os títulos da mesma transação de venda, fora a cobrança DESD,
  -- em aberto e recebidos; i = a posição deste título entre eles, por vencimento: "2 de 3". O WinThor renumera a
  -- prestação no desdobramento: a venda 89769 tem as prestações 2, 4, 6, 8, 10 e 11, e a 11 é a 6ª de 6)
  -- e o lançamento que está fora das somas (717)
  extra := case when ehpg then 'b.recnum in (select chave::bigint from contas.excluido where rot = ''pagar'')'
                else '(select json_build_object(''n'', count(*), ''i'', count(*) filter (where (x.dtvenc, lpad(x.prest, 4, ''0'')) <= (b.dtvenc, lpad(b.prest, 4, ''0'')))) from (select prest, dtvenc from contas.receber where numtransvenda = b.numtransvenda and codcob is distinct from ''DESD'' union select prest, dtvenc from contas.receber_pago where numtransvenda = b.numtransvenda and codcob is distinct from ''DESD'') x)' end;
  if jsonb_typeof(p->'campos') = 'array' then
    -- Excel: só as colunas pedidas, cada linha uma lista na ordem pedida (cabe muito mais linha por chamada)
    select string_agg(case when x in ('parcelas', 'excluido') then extra else 'b.' || quote_ident(x) end, ', ' order by i),
           bool_and(x in ('parcelas', 'excluido') or x in (select attname from pg_attribute where attrelid = vw::regclass and attnum > 0 and not attisdropped))
      into sel, ok
      from jsonb_array_elements_text(p->'campos') with ordinality a(x, i);
    if not coalesce(ok, false) then raise exception 'campo desconhecido em campos'; end if;
    sel := 'json_build_array(' || sel || ')';
  else
    sel := 'to_jsonb(b) || jsonb_build_object(' || case when ehpg then '''excluido''' else '''parcelas''' end || ', ' || extra || ')';
  end if;
  if ehpg then
    execute format($q$
      select coalesce(json_agg(%s order by z.k), '[]')
        from (select x.*, row_number() over () as k from (
                select b.st, b.recnum from %s b where %s and (%s) order by %s %s nulls last, b.recnum %s limit %s offset %s) x) z
        cross join lateral (select * from %s b where b.recnum = z.recnum and b.st = z.st limit 1) b$q$,
      sel, vw, f, inc, ord, dir, dir, lim, off, vw) into r_lin;
  else
    execute format($q$
      select coalesce(json_agg(%s order by z.k), '[]')
        from (select x.*, row_number() over () as k from (
                select b.st, b.numtransvenda, b.prest from %s b where %s and (%s) order by %s %s nulls last, b.numtransvenda %s, b.prest %s limit %s offset %s) x) z
        cross join lateral (select * from %s b where b.numtransvenda = z.numtransvenda and b.prest = z.prest and b.st = z.st limit 1) b$q$,
      sel, vw, f, inc, ord, dir, dir, dir, lim, off, vw) into r_lin;
  end if;

  return json_build_object('tot', r_tot, 'linhas', r_lin, 'ms', (extract(epoch from (clock_timestamp() - ini)) * 1000)::int, 'hoje', contas.hoje());
end $$;
comment on function contas.consulta(jsonb) is
  'A consulta da tela do Contas a Pagar e Receber: página, totais, o que os filtros de saída deixam fora e a lista de valores de cada coluna (filtro do Excel), sobre os em aberto e os pagos desde 2011. Colunas de uma lista fixa (contas.colunas); valor do usuário só entre aspas.';

revoke all on all functions in schema contas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all functions in schema contas from anon, authenticated;
  end if;
end $$;
