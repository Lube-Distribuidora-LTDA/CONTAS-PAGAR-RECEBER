-- =============================================================================
-- CONTAS A PAGAR E RECEBER — schema `contas` no DATA WAREHOUSE (migração contas_01_schema)
-- 2026-11-09. Pedido do Júlio, para o controller: "CONTAS A PAGAR" da rotina 717 e "CONTAS A RECEBER"
-- da rotina 1240 do WinThor, "assim como está no relatório, todas as abas", nada consolidado, com o
-- AGENTE LUBE mantendo o dado ao vivo.
--
--   contas.pagar        717 "Contas a Pagar": PCLANC em aberto (DTPAGTO nulo), fora as contas de
--                       adiantamento e de juros do PCCONSUM, todas as filiais. As colunas são as 64 da
--                       grade da rotina (frmPCINF241, dmRelat.qCtasPagar).
--   contas.receber      1240 "Consultar Duplicata Contas a Receber": PCPREST em aberto (DTPAG nulo),
--                       todas as filiais, com os campos das abas da tela do título (frmDadosTitulo).
--   contas.receber_*    as abas da tela do título que têm tabela própria: Histórico BK, Hist. desdobr.,
--                       Itens da Nota, Hist. Alt. Bancário e Observações (só dos títulos em aberto).
--   contas.filial       nomes das filiais (PCFILIAL).
--
-- Onde o dado nasce: o AGENTE LUBE (Desktop\BI\22. AGENTE LUBE, fluxos/contas.toml). Depois de gravar
-- ele roda contas.atualizar_pacote() (agente.sistema.apos_gravar): refaz o pacote de cada lado que mudou
-- (os gatilhos marcam), e só troca a versão quando o conteúdo mudou. O painel não lê as tabelas ao
-- abrir: lê o pacote pronto; o detalhe de um título é lido na hora (contas.detalhe_pagar / _receber).
-- =============================================================================

create schema if not exists contas;
comment on schema contas is
  'CONTAS A PAGAR E RECEBER (rotinas 717 e 1240 do WinThor), para o controller. Gravado pelo AGENTE LUBE; painel em Desktop\BI\29. CONTAS A PAGAR E RECEBER.';

-- ----------------------------------------------------------------------------- 717: contas a pagar
create table if not exists contas.pagar (
  recnum               bigint primary key,   -- Núm. Lanc.
  recnumprinc          bigint,               -- Núm. Lanc. Principal (desdobramento)
  codfilial            text,
  dtlanc               date,
  dtemissao            date,
  dtvenc               date,
  dtcompetencia        date,
  dtvencorigem         date,
  codfornec            bigint,               -- Cód. Parceiro
  tipoparceiro         text,                 -- F fornecedor, R RCA, C cliente, M motorista, L colaborador, O outros
  parceiro             text,                 -- o DECODE da rotina
  estado               text,                 -- UF: PCFORNEC.ESTADO pelo CODFORNEC (como a rotina, qualquer tipo)
  prazomin             numeric,              -- PCFORNEC.PRAZOMIN
  prazo                numeric,              -- PCFORNEC.PRAZOENTREGA se fornecedor, senão 0
  codconta             bigint,
  conta                text,
  grupoconta           bigint,
  grupo                text,
  codcontamaster       bigint,
  historico            text,
  historico2           text,
  numnota              bigint,
  duplic               text,
  parcela              text,
  valor                numeric,              -- Valor Dup.
  descontofin          numeric,
  valordev             numeric,
  txperm               numeric,              -- Juros
  vlvariacaocambial    numeric,
  vpago                numeric,
  vpagobordero         numeric,
  dtborder             date,
  numseqbordero        bigint,
  numbordero           bigint,
  numbanco             bigint,
  numcheque            text,
  dtcheq               date,
  localizacao          text,
  moeda                text,
  dtmoeda              text,
  indice               text,
  numnegociacao        bigint,
  dtestornobaixa       date,
  numtransadiantfor    bigint,
  numtransent          bigint,
  prorrog              numeric,
  dtbloq               date,
  boleto               text,
  nomefunc             text,                 -- Usuário
  tipolanc             text,                 -- C confirmado, P provisionado
  codcomprador         bigint,
  comprador            text,
  nfservico            text,
  codprojeto           bigint,
  numnotadev           bigint,
  numprestacaoconta    bigint,
  statusprestacaoconta text,
  numadiantamento      bigint,
  statusadiantamento   text,
  valoradiantamento    numeric,
  codagrupamento       bigint,
  codreceita           bigint,
  vliss                numeric,
  vlinss               numeric,
  vlirrf               numeric,
  vlpis                numeric,
  vlcofins             numeric,
  vlcsrf               numeric,
  codrateioconta       bigint,
  rateioconta          text,
  numcontratocambio    text,
  moedaestrangeira     bigint,
  numdiimportacao      text,
  dtultalter           date
);
create index if not exists ix_pagar_princ on contas.pagar (recnumprinc) where recnumprinc is not null;
alter table contas.pagar enable row level security;
comment on table contas.pagar is
  'Rotina 717 Contas a Pagar: títulos em aberto da PCLANC (DTPAGTO nulo, conta na PCCONTA e fora de CODCONTANTPAG/CODCONTRECJUR/CODCONTPAGJUR do PCCONSUM), todas as filiais. Valor a Pagar = valor + juros − desc. fin. − devolução + variação cambial. Gravado pelo AGENTE LUBE.';

-- ----------------------------------------------------------------------------- 1240: contas a receber
create table if not exists contas.receber (
  numtransvenda          bigint not null,
  prest                  text   not null,
  codfilial              text,
  codfilialnf            text,
  duplic                 bigint,
  dtemissao              date,
  dtvenc                 date,
  dtvencorig             date,
  codcli                 bigint,
  cliente                text,
  fantasia               text,
  cnpj                   text,
  valor                  numeric,
  valororig              numeric,
  txperm                 numeric,            -- Juros (TXMPERM na grade)
  txpermprevisto         numeric,            -- Juros devido
  dtrecebimentoprevisto  date,
  valordesc              numeric,
  perdesc                numeric,
  vpago                  numeric,
  dtpag                  date,
  vldevol                numeric,
  dtdevol                date,
  codusur                bigint,
  rca                    text,
  codsupervisor          bigint,             -- gravado no título (a rotina mostra este)
  supervisor             text,
  codcob                 text,
  cobranca               text,
  codcoborig             text,
  cobrancaorig           text,
  txjuros                numeric,            -- PCCOB.TXJUROS (% a.m.)
  dtcxmot                date,
  dtcancel               date,
  codfunccxmot           bigint,
  funcacerto             text,
  codbaixa               bigint,
  funcbaixa              text,
  funcgeracao            text,               -- PCNFSAID.FUNCLANC
  dtfecha                date,
  codfuncfecha           bigint,
  funcfecha              text,
  dtbaixa                date,
  numtrans               bigint,
  codbanco               bigint,
  codcobbanco            text,
  status                 text,
  numcar                 bigint,
  codmotorista           bigint,
  motorista              text,
  numbanco               bigint,
  numagencia             bigint,
  numcheque              bigint,
  dtlancch               date,
  codbarra               text,
  obs                    text,
  obs2                   text,
  alinea                 bigint,
  codbancocustodia       bigint,
  dtcustodia             date,
  numcustodia            bigint,
  numlotecustodia        bigint,
  nossonumbco            text,
  tipo                   text,
  vltxboleto             numeric,
  linhadig               text,
  operacao               text,
  tipoprorrog            text,
  dtlancprorrog          date,
  percom                 numeric,
  valorliqcom            numeric,
  numdiasprazoprotesto   numeric,
  dtenvioserasa          date,
  dtretiradaserasa       date,
  dtdesd                 date,
  numped                 bigint,
  numnota                bigint,
  nomearquivo            text,
  numremessa             bigint,
  dtultalter             date,
  codfuncultalter        bigint,
  cartorio               text,
  tem_cliente            text,               -- S/N: a 1240 só mostra o título com cliente e RCA no cadastro
  tem_rca                text,
  primary key (numtransvenda, prest)
);
create index if not exists ix_receber_cli on contas.receber (codcli);
alter table contas.receber enable row level security;
comment on table contas.receber is
  'Rotina 1240 Consultar Duplicata Contas a Receber: duplicatas em aberto da PCPREST (DTPAG nulo), todas as filiais, inclusive DESD (o painel esconde por padrão, como a rotina) e as sem cliente/RCA no cadastro (a rotina não mostra; o painel mostra à parte). Gravado pelo AGENTE LUBE.';

create table if not exists contas.receber_bk (
  rid              text primary key,         -- ROWID da PCLOGCOBMAG (a tabela não tem chave)
  numtransvenda    bigint,
  prest            text,
  data             timestamp,
  codocorrencia    text,
  ocorrencia       text,
  codsubocorrencia text,
  descricao        text,
  vldespesas       numeric,
  vlcustas         numeric,
  usuario          text,
  maquina          text,
  arqretorno       text,
  rotinalanc       text
);
create index if not exists ix_receber_bk_tit on contas.receber_bk (numtransvenda, prest);
alter table contas.receber_bk enable row level security;
comment on table contas.receber_bk is 'Rotina 1240, aba Histórico BK (PCLOGCOBMAG + ocorrências do banco), só dos títulos em aberto. Gravado pelo AGENTE LUBE.';

create table if not exists contas.receber_desd (
  tipo_rel              text   not null,     -- O = o título de origem, D = um dos títulos desdobrados dele
  nt_orig               bigint not null,
  prest_orig            text   not null,
  numtransvenda         bigint not null,
  prest                 text   not null,
  codcob                text,
  codcoborig            text,
  duplic                bigint,
  valor                 numeric,
  valororig             numeric,
  txperm                numeric,
  vldevol               numeric,
  dtdevol               date,
  valordesc             numeric,
  vpago                 numeric,
  dtdesd                date,
  horadesd              integer,
  minutodesd            integer,
  dtvenc                date,
  dtemissao             date,
  codfilial             text,
  codfuncultalter       bigint,
  nomefuncultalter      text,
  dtultalter            date,
  codbaixa              bigint,
  nomefuncbaixa         text,
  dtpag                 date,
  dtrecebimentoprevisto date,
  codusur               bigint,
  rca                   text,
  primary key (tipo_rel, nt_orig, prest_orig, numtransvenda, prest)
);
create index if not exists ix_receber_desd_tit on contas.receber_desd (numtransvenda, prest);
alter table contas.receber_desd enable row level security;
comment on table contas.receber_desd is 'Rotina 1240, aba Hist. desdobr. (PCDESD): a origem de cada título em aberto que veio de desdobramento e todos os desdobrados dela. Gravado pelo AGENTE LUBE.';

create table if not exists contas.receber_item (
  rid           text primary key,            -- ROWID da PCMOV
  numtransvenda bigint,
  numnota       bigint,
  codprod       bigint,
  descricao     text,
  dtmov         date,
  qt            numeric,
  punit         numeric,
  vltotger      numeric
);
create index if not exists ix_receber_item_nt on contas.receber_item (numtransvenda);
alter table contas.receber_item enable row level security;
comment on table contas.receber_item is 'Rotina 1240, aba Itens da Nota (PCMOV: QTCONT × PUNIT, como a rotina), das notas dos títulos em aberto. Gravado pelo AGENTE LUBE.';

create table if not exists contas.receber_banco (
  rid             text primary key,          -- ROWID da PCHISTNOSSONUMEROBCO
  numtransvenda   bigint,
  prest           text,
  data            timestamp,
  valor_atual1    text,
  valor_anterior1 text,
  valor_atual2    text,
  valor_anterior2 text,
  usuario         text,
  maquina         text,
  rotina          text,
  codbanco        bigint,
  banco           text
);
create index if not exists ix_receber_banco_tit on contas.receber_banco (numtransvenda, prest);
alter table contas.receber_banco enable row level security;
comment on table contas.receber_banco is 'Rotina 1240, aba Hist. Alt. Bancário (PCHISTNOSSONUMEROBCO), só dos títulos em aberto. Gravado pelo AGENTE LUBE.';

create table if not exists contas.receber_obs (
  numtransvenda bigint not null,
  prest         text   not null,
  obsgerais     text,
  obsacerto     text,
  primary key (numtransvenda, prest)
);
alter table contas.receber_obs enable row level security;
comment on table contas.receber_obs is 'Rotina 1240, aba Observações (PCPRESTOBS), só dos títulos em aberto. Gravado pelo AGENTE LUBE.';

create table if not exists contas.filial (
  codfilial   text primary key,
  razaosocial text,
  fantasia    text,
  cidade      text,
  uf          text
);
alter table contas.filial enable row level security;

-- ----------------------------------------------------------------------------- pacote do painel
create table if not exists contas.pacote (
  nome       text primary key check (nome in ('pagar', 'receber')),
  versao     text not null,
  hash       text not null,
  gerado_em  timestamptz not null default now(),
  linhas     integer,
  bytes_json integer,
  ms         integer,
  payload    text not null
);
alter table contas.pacote enable row level security;
comment on table contas.pacote is 'Pacote pronto do painel, um por rotina (pagar = 717, receber = 1240): os títulos em colunas (JSON em texto; a API comprime ao entregar).';

-- qual pacote precisa ser refeito (os gatilhos marcam; contas.atualizar_pacote() desmarca)
create table if not exists contas.marca (
  nome      text primary key check (nome in ('pagar', 'receber')),
  sujo      boolean not null default true,
  marcado_em timestamptz not null default now()
);
alter table contas.marca enable row level security;
insert into contas.marca (nome) values ('pagar'), ('receber') on conflict (nome) do nothing;

create or replace function contas.marcar_sujo()
returns trigger language plpgsql set search_path = contas, pg_temp as $$
begin
  update contas.marca set sujo = true, marcado_em = now()
   where nome = any (case tg_table_name when 'pagar' then array['pagar']
                                       when 'receber' then array['receber']
                                       else array['pagar', 'receber'] end)
     and not sujo;
  return null;
end $$;

drop trigger if exists tg_pagar_sujo on contas.pagar;
create trigger tg_pagar_sujo after insert or update or delete on contas.pagar for each statement execute function contas.marcar_sujo();
drop trigger if exists tg_receber_sujo on contas.receber;
create trigger tg_receber_sujo after insert or update or delete on contas.receber for each statement execute function contas.marcar_sujo();
drop trigger if exists tg_filial_sujo on contas.filial;
create trigger tg_filial_sujo after insert or update or delete on contas.filial for each statement execute function contas.marcar_sujo();

-- datas viram dias desde 2000-01-01 (inteiro) no pacote: 39 mil títulos × várias datas, em texto curto
create or replace function contas.dia(d date) returns integer language sql immutable as $$ select d - date '2000-01-01' $$;
create or replace function contas.num(v numeric) returns numeric language sql immutable as $$ select trim_scale(round(v, 6)) $$;

-- 717: um título por posição, em colunas. Valores cheios; arredondar só na tela.
create or replace function contas.montar_pagar()
returns json language sql stable set search_path = contas, pg_temp as $$
with x as (select p.*, row_number() over (order by dtvenc, parceiro, recnum) as rn from contas.pagar p)
select json_build_object(
  'meta', json_build_object(
     'hoje', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
     'ep', '2000-01-01',
     'n', (select count(*) from x),
     'filiais', (select coalesce(json_agg(json_build_object('c', codfilial, 'n', coalesce(fantasia, razaosocial), 'r', razaosocial, 'ci', cidade, 'uf', uf)
                                 order by lpad(codfilial, 3, '0')), '[]') from contas.filial)),
  'r', (select json_build_object(
     'r',   coalesce(json_agg(recnum order by rn), '[]'),
     'rp',  coalesce(json_agg(recnumprinc order by rn), '[]'),
     'fi',  coalesce(json_agg(codfilial order by rn), '[]'),
     'dl',  coalesce(json_agg(contas.dia(dtlanc) order by rn), '[]'),
     'de',  coalesce(json_agg(contas.dia(dtemissao) order by rn), '[]'),
     'dv',  coalesce(json_agg(contas.dia(dtvenc) order by rn), '[]'),
     'dc',  coalesce(json_agg(contas.dia(dtcompetencia) order by rn), '[]'),
     'dvo', coalesce(json_agg(contas.dia(dtvencorigem) order by rn), '[]'),
     'cf',  coalesce(json_agg(codfornec order by rn), '[]'),
     'tp',  coalesce(json_agg(tipoparceiro order by rn), '[]'),
     'pn',  coalesce(json_agg(parceiro order by rn), '[]'),
     'uf',  coalesce(json_agg(estado order by rn), '[]'),
     'pm',  coalesce(json_agg(contas.num(prazomin) order by rn), '[]'),
     'pz',  coalesce(json_agg(contas.num(prazo) order by rn), '[]'),
     'cc',  coalesce(json_agg(codconta order by rn), '[]'),
     'cn',  coalesce(json_agg(conta order by rn), '[]'),
     'gc',  coalesce(json_agg(grupoconta order by rn), '[]'),
     'gn',  coalesce(json_agg(grupo order by rn), '[]'),
     'cm',  coalesce(json_agg(codcontamaster order by rn), '[]'),
     'hi',  coalesce(json_agg(historico order by rn), '[]'),
     'h2',  coalesce(json_agg(historico2 order by rn), '[]'),
     'nn',  coalesce(json_agg(numnota order by rn), '[]'),
     'du',  coalesce(json_agg(duplic order by rn), '[]'),
     'pc',  coalesce(json_agg(parcela order by rn), '[]'),
     'vl',  coalesce(json_agg(contas.num(valor) order by rn), '[]'),
     'df',  coalesce(json_agg(contas.num(descontofin) order by rn), '[]'),
     'vd',  coalesce(json_agg(contas.num(valordev) order by rn), '[]'),
     'tx',  coalesce(json_agg(contas.num(txperm) order by rn), '[]'),
     'vc',  coalesce(json_agg(contas.num(vlvariacaocambial) order by rn), '[]'),
     'vp',  coalesce(json_agg(contas.num(vpago) order by rn), '[]'),
     'vb',  coalesce(json_agg(contas.num(vpagobordero) order by rn), '[]'),
     'db',  coalesce(json_agg(contas.dia(dtborder) order by rn), '[]'),
     'sb',  coalesce(json_agg(numseqbordero order by rn), '[]'),
     'nb',  coalesce(json_agg(numbordero order by rn), '[]'),
     'bc',  coalesce(json_agg(numbanco order by rn), '[]'),
     'ch',  coalesce(json_agg(numcheque order by rn), '[]'),
     'dq',  coalesce(json_agg(contas.dia(dtcheq) order by rn), '[]'),
     'lo',  coalesce(json_agg(localizacao order by rn), '[]')
   ) from x),
  -- json_build_object aceita até 100 argumentos: as colunas seguem num segundo bloco (o navegador junta os dois)
  'r2', (select json_build_object(
     'mo',  coalesce(json_agg(moeda order by rn), '[]'),
     'dm',  coalesce(json_agg(dtmoeda order by rn), '[]'),
     'ix',  coalesce(json_agg(indice order by rn), '[]'),
     'ng',  coalesce(json_agg(numnegociacao order by rn), '[]'),
     'eb',  coalesce(json_agg(contas.dia(dtestornobaixa) order by rn), '[]'),
     'ta',  coalesce(json_agg(numtransadiantfor order by rn), '[]'),
     'te',  coalesce(json_agg(numtransent order by rn), '[]'),
     'pr',  coalesce(json_agg(contas.num(prorrog) order by rn), '[]'),
     'bq',  coalesce(json_agg(contas.dia(dtbloq) order by rn), '[]'),
     'bo',  coalesce(json_agg(boleto order by rn), '[]'),
     'us',  coalesce(json_agg(nomefunc order by rn), '[]'),
     'tl',  coalesce(json_agg(tipolanc order by rn), '[]'),
     'cp',  coalesce(json_agg(codcomprador order by rn), '[]'),
     'cpn', coalesce(json_agg(comprador order by rn), '[]'),
     'ns',  coalesce(json_agg(nfservico order by rn), '[]'),
     'pj',  coalesce(json_agg(codprojeto order by rn), '[]'),
     'nd',  coalesce(json_agg(numnotadev order by rn), '[]'),
     'npc', coalesce(json_agg(numprestacaoconta order by rn), '[]'),
     'spc', coalesce(json_agg(statusprestacaoconta order by rn), '[]'),
     'nad', coalesce(json_agg(numadiantamento order by rn), '[]'),
     'sad', coalesce(json_agg(statusadiantamento order by rn), '[]'),
     'vad', coalesce(json_agg(contas.num(valoradiantamento) order by rn), '[]'),
     'ag',  coalesce(json_agg(codagrupamento order by rn), '[]'),
     'cr',  coalesce(json_agg(codreceita order by rn), '[]'),
     'iss', coalesce(json_agg(contas.num(vliss) order by rn), '[]'),
     'ins', coalesce(json_agg(contas.num(vlinss) order by rn), '[]'),
     'irf', coalesce(json_agg(contas.num(vlirrf) order by rn), '[]'),
     'pis', coalesce(json_agg(contas.num(vlpis) order by rn), '[]'),
     'cof', coalesce(json_agg(contas.num(vlcofins) order by rn), '[]'),
     'csr', coalesce(json_agg(contas.num(vlcsrf) order by rn), '[]'),
     'rt',  coalesce(json_agg(codrateioconta order by rn), '[]'),
     'rtn', coalesce(json_agg(rateioconta order by rn), '[]'),
     'cb',  coalesce(json_agg(numcontratocambio order by rn), '[]'),
     'me',  coalesce(json_agg(moedaestrangeira order by rn), '[]'),
     'di',  coalesce(json_agg(numdiimportacao order by rn), '[]')
   ) from x)
);
$$;

-- 1240: uma duplicata por posição, em colunas (o que a grade, os filtros e a busca usam; o resto das abas
-- vem na hora pelo contas.detalhe_receber).
create or replace function contas.montar_receber()
returns json language sql stable set search_path = contas, pg_temp as $$
with x as (select p.*, row_number() over (order by dtemissao, codfilial, duplic, prest, numtransvenda) as rn from contas.receber p)
select json_build_object(
  'meta', json_build_object(
     'hoje', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
     'ep', '2000-01-01',
     'n', (select count(*) from x),
     'filiais', (select coalesce(json_agg(json_build_object('c', codfilial, 'n', coalesce(fantasia, razaosocial), 'r', razaosocial, 'ci', cidade, 'uf', uf)
                                 order by lpad(codfilial, 3, '0')), '[]') from contas.filial)),
  'r', (select json_build_object(
     'nt',  coalesce(json_agg(numtransvenda order by rn), '[]'),
     'p',   coalesce(json_agg(prest order by rn), '[]'),
     'fi',  coalesce(json_agg(codfilial order by rn), '[]'),
     'fnf', coalesce(json_agg(codfilialnf order by rn), '[]'),
     'du',  coalesce(json_agg(duplic order by rn), '[]'),
     'de',  coalesce(json_agg(contas.dia(dtemissao) order by rn), '[]'),
     'dv',  coalesce(json_agg(contas.dia(dtvenc) order by rn), '[]'),
     'dvo', coalesce(json_agg(contas.dia(dtvencorig) order by rn), '[]'),
     'cl',  coalesce(json_agg(codcli order by rn), '[]'),
     'cn',  coalesce(json_agg(cliente order by rn), '[]'),
     'fa',  coalesce(json_agg(fantasia order by rn), '[]'),
     'cj',  coalesce(json_agg(cnpj order by rn), '[]'),
     'vl',  coalesce(json_agg(contas.num(valor) order by rn), '[]'),
     'tx',  coalesce(json_agg(contas.num(txperm) order by rn), '[]'),
     'ds',  coalesce(json_agg(contas.num(valordesc) order by rn), '[]'),
     'vp',  coalesce(json_agg(contas.num(vpago) order by rn), '[]'),
     'dp',  coalesce(json_agg(contas.dia(dtpag) order by rn), '[]'),
     'ru',  coalesce(json_agg(codusur order by rn), '[]'),
     'rn',  coalesce(json_agg(rca order by rn), '[]'),
     'su',  coalesce(json_agg(codsupervisor order by rn), '[]'),
     'sn',  coalesce(json_agg(supervisor order by rn), '[]'),
     'cb',  coalesce(json_agg(codcob order by rn), '[]'),
     'cbn', coalesce(json_agg(cobranca order by rn), '[]'),
     'cx',  coalesce(json_agg(contas.dia(dtcxmot) order by rn), '[]'),
     'dca', coalesce(json_agg(contas.dia(dtcancel) order by rn), '[]'),
     'fcx', coalesce(json_agg(codfunccxmot order by rn), '[]'),
     'fca', coalesce(json_agg(funcacerto order by rn), '[]'),
     'bx',  coalesce(json_agg(codbaixa order by rn), '[]'),
     'fbx', coalesce(json_agg(funcbaixa order by rn), '[]'),
     'fg',  coalesce(json_agg(funcgeracao order by rn), '[]'),
     'bk',  coalesce(json_agg(codbanco order by rn), '[]'),
     'bcu', coalesce(json_agg(codbancocustodia order by rn), '[]'),
     'dcu', coalesce(json_agg(contas.dia(dtcustodia) order by rn), '[]'),
     'ncu', coalesce(json_agg(numcustodia order by rn), '[]'),
     'lcu', coalesce(json_agg(numlotecustodia order by rn), '[]'),
     'nb',  coalesce(json_agg(nossonumbco order by rn), '[]'),
     'st',  coalesce(json_agg(status order by rn), '[]'),
     'nn',  coalesce(json_agg(numnota order by rn), '[]'),
     'car', coalesce(json_agg(numcar order by rn), '[]'),
     'ca',  coalesce(json_agg(cartorio order by rn), '[]'),
     'dd',  coalesce(json_agg(contas.dia(dtdesd) order by rn), '[]'),
     'tc',  coalesce(json_agg(case when tem_cliente = 'S' then 1 else 0 end order by rn), '[]'),
     'tr',  coalesce(json_agg(case when tem_rca = 'S' then 1 else 0 end order by rn), '[]')
   ) from x)
);
$$;

-- Quem chama: o AGENTE LUBE depois de gravar (agente.sistema.apos_gravar) e o botão Atualizar.
-- Refaz só o lado marcado (ou sem pacote); a versão só muda se o conteúdo mudou.
create or replace function contas.atualizar_pacote()
returns text language plpgsql set search_path = contas, pg_temp as $$
declare
  v_nome text;
  v_ini  timestamptz;
  v_json text;
  v_hash text;
  v_out  text := '';
begin
  for v_nome in
    select m.nome from contas.marca m
     where m.sujo or not exists (select 1 from contas.pacote p where p.nome = m.nome)
     order by m.nome
  loop
    v_ini := clock_timestamp();
    update contas.marca set sujo = false where nome = v_nome;
    v_json := case v_nome when 'pagar' then contas.montar_pagar()::text else contas.montar_receber()::text end;
    v_hash := md5(v_json);
    if exists (select 1 from contas.pacote where nome = v_nome and hash = v_hash) then
      v_out := v_out || v_nome || ' igual; ';
      continue;
    end if;
    insert into contas.pacote (nome, versao, hash, gerado_em, linhas, bytes_json, ms, payload)
    values (v_nome, to_char(clock_timestamp() at time zone 'America/Sao_Paulo', 'YYYYMMDD-HH24MISS-MS'), v_hash, now(),
            (v_json::json -> 'meta' ->> 'n')::int, octet_length(v_json),
            (extract(epoch from (clock_timestamp() - v_ini)) * 1000)::int, v_json)
    on conflict (nome) do update set versao = excluded.versao, hash = excluded.hash, gerado_em = excluded.gerado_em,
           linhas = excluded.linhas, bytes_json = excluded.bytes_json, ms = excluded.ms, payload = excluded.payload;
    v_out := v_out || v_nome || ' refeito; ';
  end loop;
  return coalesce(nullif(v_out, ''), 'nada mudou');
end $$;
comment on function contas.atualizar_pacote() is
  'Remonta o pacote do painel Contas a Pagar e Receber (pagar = 717, receber = 1240) do lado que mudou. Quem chama: o AGENTE LUBE depois de gravar no schema contas.';

-- ----------------------------------------------------------------------------- detalhe de um título (na hora)
create or replace function contas.detalhe_pagar(p_recnum bigint)
returns json language sql stable set search_path = contas, pg_temp as $$
select json_build_object(
  't', (select row_to_json(p) from contas.pagar p where p.recnum = p_recnum),
  -- o mesmo desdobramento: o principal e os outros lançamentos dele que estão em aberto
  'desd', (select coalesce(json_agg(json_build_object('r', q.recnum, 'rp', q.recnumprinc, 'dv', q.dtvenc, 'vl', q.valor,
                    'du', q.duplic, 'pc', q.parcela, 'fi', q.codfilial) order by q.dtvenc, q.recnum), '[]')
             from contas.pagar q, contas.pagar p
            where p.recnum = p_recnum and q.recnum <> p.recnum
              and (q.recnumprinc = coalesce(p.recnumprinc, p.recnum) or q.recnum = p.recnumprinc)),
  'lido', (select json_build_object('lido_em', lido_em, 'mudou_em', mudou_em, 'status', status) from agente.estado where fluxo = 'contas.pagar')
);
$$;

create or replace function contas.detalhe_receber(p_nt bigint, p_prest text)
returns json language sql stable set search_path = contas, pg_temp as $$
with origens as (
  select distinct d.nt_orig, d.prest_orig from contas.receber_desd d
   where d.tipo_rel = 'D' and d.numtransvenda = p_nt and d.prest = p_prest
)
select json_build_object(
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
  'lido', (select coalesce(json_object_agg(fluxo, json_build_object('lido_em', lido_em, 'mudou_em', mudou_em, 'status', status)), '{}')
             from agente.estado where fluxo like 'contas.receber%')
);
$$;

-- ----------------------------------------------------------------------------- acesso: só o servidor
revoke all on all tables in schema contas from public;
revoke all on all functions in schema contas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema contas from anon, authenticated;
    revoke all on all tables in schema contas from anon, authenticated;
    revoke all on all functions in schema contas from anon, authenticated;
  end if;
end $$;

-- ----------------------------------------------------------------------------- o agente monta depois de gravar
insert into agente.sistema (sistema, versao, apos_gravar, apos_gravar_s)
values ('contas', '', 'select contas.atualizar_pacote()', 20)
on conflict (sistema) do update set apos_gravar = excluded.apos_gravar, apos_gravar_s = excluded.apos_gravar_s;
