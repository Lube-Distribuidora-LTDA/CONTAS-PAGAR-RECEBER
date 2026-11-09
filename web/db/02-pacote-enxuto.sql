-- =============================================================================
-- CONTAS A PAGAR E RECEBER — pacote enxuto (migração contas_02_pacote_enxuto, 2026-11-09)
-- A primeira montagem (contas_01) deu 11 MB (717) e 13,8 MB (1240) de texto: o nome do cliente, do RCA,
-- da cobrança e da conta repetido em cada título, e colunas quase sempre vazias escritas como null.
-- Agora:
--   dic  dicionários: cada nome uma vez, pelo código (cliente, RCA, supervisor, cobrança, funcionário;
--        parceiro, conta, comprador);
--   r    colunas cheias, uma posição por título (arrays);
--   s    colunas quase vazias: só as posições com valor ({"posição": valor}; o resto é nulo);
--   z    valores quase sempre zero: só as posições diferentes de zero (o resto é 0);
--   sc/sr (1240) posições dos títulos sem cliente / sem RCA no cadastro.
-- O navegador remonta os títulos (js/dados.js). Valores cheios; arredondar só na tela.
-- =============================================================================

create or replace function contas.montar_pagar()
returns json language sql stable set search_path = contas, pg_temp as $$
with x as (select p.*, (row_number() over (order by dtvenc, parceiro, recnum)) - 1 as i from contas.pagar p)
select json_build_object(
  'meta', json_build_object(
     'hoje', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
     'ep', '2000-01-01',
     'n', (select count(*) from x),
     'filiais', (select coalesce(json_agg(json_build_object('c', codfilial, 'n', coalesce(fantasia, razaosocial), 'r', razaosocial, 'ci', cidade, 'uf', uf)
                                 order by lpad(codfilial, 3, '0')), '[]') from contas.filial)),
  'dic', json_build_object(
     'pa', (select coalesce(json_object_agg(k, json_build_array(parceiro, estado, contas.num(prazo), contas.num(prazomin))), '{}')
              from (select distinct on (tipoparceiro, codfornec) coalesce(tipoparceiro, '') || ':' || coalesce(codfornec::text, '') as k,
                           parceiro, estado, prazo, prazomin
                      from contas.pagar order by tipoparceiro, codfornec) d),
     'co', (select coalesce(json_object_agg(codconta, json_build_array(conta, grupoconta, grupo, codcontamaster)), '{}')
              from (select distinct on (codconta) codconta, conta, grupoconta, grupo, codcontamaster
                      from contas.pagar where codconta is not null order by codconta) d),
     'cp', (select coalesce(json_object_agg(codcomprador, comprador), '{}')
              from (select distinct on (codcomprador) codcomprador, comprador
                      from contas.pagar where codcomprador is not null order by codcomprador) d)),
  'r', (select json_build_object(
     'r',  coalesce(json_agg(recnum order by i), '[]'),
     'fi', coalesce(json_agg(codfilial order by i), '[]'),
     'dl', coalesce(json_agg(contas.dia(dtlanc) order by i), '[]'),
     'de', coalesce(json_agg(contas.dia(dtemissao) order by i), '[]'),
     'dv', coalesce(json_agg(contas.dia(dtvenc) order by i), '[]'),
     'dc', coalesce(json_agg(contas.dia(dtcompetencia) order by i), '[]'),
     'cf', coalesce(json_agg(codfornec order by i), '[]'),
     'tp', coalesce(json_agg(tipoparceiro order by i), '[]'),
     'cc', coalesce(json_agg(codconta order by i), '[]'),
     'hi', coalesce(json_agg(historico order by i), '[]'),
     'nn', coalesce(json_agg(numnota order by i), '[]'),
     'du', coalesce(json_agg(duplic order by i), '[]'),
     'pc', coalesce(json_agg(parcela order by i), '[]'),
     'vl', coalesce(json_agg(contas.num(valor) order by i), '[]'),
     'te', coalesce(json_agg(numtransent order by i), '[]'),
     'mo', coalesce(json_agg(moeda order by i), '[]'),
     'ix', coalesce(json_agg(indice order by i), '[]'),
     'us', coalesce(json_agg(nomefunc order by i), '[]'),
     'tl', coalesce(json_agg(tipolanc order by i), '[]'),
     'cp', coalesce(json_agg(codcomprador order by i), '[]')
   ) from x),
  's', (select json_build_object(
     'rp',  coalesce(json_object_agg(i, recnumprinc) filter (where recnumprinc is not null), '{}'),
     'dvo', coalesce(json_object_agg(i, contas.dia(dtvencorigem)) filter (where dtvencorigem is not null), '{}'),
     'h2',  coalesce(json_object_agg(i, historico2) filter (where historico2 is not null), '{}'),
     'db',  coalesce(json_object_agg(i, contas.dia(dtborder)) filter (where dtborder is not null), '{}'),
     'sb',  coalesce(json_object_agg(i, numseqbordero) filter (where numseqbordero is not null), '{}'),
     'nb',  coalesce(json_object_agg(i, numbordero) filter (where numbordero is not null), '{}'),
     'bc',  coalesce(json_object_agg(i, numbanco) filter (where numbanco is not null), '{}'),
     'ch',  coalesce(json_object_agg(i, numcheque) filter (where numcheque is not null), '{}'),
     'dq',  coalesce(json_object_agg(i, contas.dia(dtcheq)) filter (where dtcheq is not null), '{}'),
     'lo',  coalesce(json_object_agg(i, localizacao) filter (where localizacao is not null), '{}'),
     'dm',  coalesce(json_object_agg(i, dtmoeda) filter (where dtmoeda is not null), '{}'),
     'ng',  coalesce(json_object_agg(i, numnegociacao) filter (where numnegociacao is not null), '{}'),
     'eb',  coalesce(json_object_agg(i, contas.dia(dtestornobaixa)) filter (where dtestornobaixa is not null), '{}'),
     'ta',  coalesce(json_object_agg(i, numtransadiantfor) filter (where numtransadiantfor is not null), '{}'),
     'bq',  coalesce(json_object_agg(i, contas.dia(dtbloq)) filter (where dtbloq is not null), '{}'),
     'bo',  coalesce(json_object_agg(i, boleto) filter (where boleto is not null), '{}'),
     'ns',  coalesce(json_object_agg(i, nfservico) filter (where nfservico is not null), '{}'),
     'pj',  coalesce(json_object_agg(i, codprojeto) filter (where codprojeto is not null), '{}'),
     'nd',  coalesce(json_object_agg(i, numnotadev) filter (where numnotadev is not null), '{}'),
     'npc', coalesce(json_object_agg(i, numprestacaoconta) filter (where numprestacaoconta is not null), '{}'),
     'spc', coalesce(json_object_agg(i, statusprestacaoconta) filter (where statusprestacaoconta is not null), '{}'),
     'nad', coalesce(json_object_agg(i, numadiantamento) filter (where numadiantamento is not null), '{}'),
     'sad', coalesce(json_object_agg(i, statusadiantamento) filter (where statusadiantamento is not null), '{}'),
     'vad', coalesce(json_object_agg(i, contas.num(valoradiantamento)) filter (where valoradiantamento is not null), '{}'),
     'ag',  coalesce(json_object_agg(i, codagrupamento) filter (where codagrupamento is not null), '{}'),
     'cr',  coalesce(json_object_agg(i, codreceita) filter (where codreceita is not null), '{}'),
     'iss', coalesce(json_object_agg(i, contas.num(vliss)) filter (where vliss is not null), '{}'),
     'ins', coalesce(json_object_agg(i, contas.num(vlinss)) filter (where vlinss is not null), '{}'),
     'irf', coalesce(json_object_agg(i, contas.num(vlirrf)) filter (where vlirrf is not null), '{}'),
     'pis', coalesce(json_object_agg(i, contas.num(vlpis)) filter (where vlpis is not null), '{}'),
     'cof', coalesce(json_object_agg(i, contas.num(vlcofins)) filter (where vlcofins is not null), '{}'),
     'csr', coalesce(json_object_agg(i, contas.num(vlcsrf)) filter (where vlcsrf is not null), '{}'),
     'rt',  coalesce(json_object_agg(i, codrateioconta) filter (where codrateioconta is not null), '{}'),
     'rtn', coalesce(json_object_agg(i, rateioconta) filter (where rateioconta is not null), '{}'),
     'cb',  coalesce(json_object_agg(i, numcontratocambio) filter (where numcontratocambio is not null), '{}'),
     'me',  coalesce(json_object_agg(i, moedaestrangeira) filter (where moedaestrangeira is not null), '{}'),
     'di',  coalesce(json_object_agg(i, numdiimportacao) filter (where numdiimportacao is not null), '{}')
   ) from x),
  'z', (select json_build_object(
     'df', coalesce(json_object_agg(i, contas.num(descontofin)) filter (where descontofin <> 0), '{}'),
     'vd', coalesce(json_object_agg(i, contas.num(valordev)) filter (where valordev <> 0), '{}'),
     'tx', coalesce(json_object_agg(i, contas.num(txperm)) filter (where txperm <> 0), '{}'),
     'vc', coalesce(json_object_agg(i, contas.num(vlvariacaocambial)) filter (where vlvariacaocambial <> 0), '{}'),
     'vp', coalesce(json_object_agg(i, contas.num(vpago)) filter (where vpago <> 0), '{}'),
     'vb', coalesce(json_object_agg(i, contas.num(vpagobordero)) filter (where vpagobordero <> 0), '{}'),
     'pr', coalesce(json_object_agg(i, contas.num(prorrog)) filter (where prorrog <> 0), '{}')
   ) from x)
);
$$;

create or replace function contas.montar_receber()
returns json language sql stable set search_path = contas, pg_temp as $$
with x as (select p.*, (row_number() over (order by dtemissao, codfilial, duplic, prest, numtransvenda)) - 1 as i from contas.receber p)
select json_build_object(
  'meta', json_build_object(
     'hoje', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
     'ep', '2000-01-01',
     'n', (select count(*) from x),
     'filiais', (select coalesce(json_agg(json_build_object('c', codfilial, 'n', coalesce(fantasia, razaosocial), 'r', razaosocial, 'ci', cidade, 'uf', uf)
                                 order by lpad(codfilial, 3, '0')), '[]') from contas.filial)),
  'dic', json_build_object(
     'cl', (select coalesce(json_object_agg(codcli, json_build_array(cliente, fantasia, cnpj)), '{}')
              from (select distinct on (codcli) codcli, cliente, fantasia, cnpj from contas.receber where codcli is not null order by codcli) d),
     'ru', (select coalesce(json_object_agg(codusur, rca), '{}')
              from (select distinct on (codusur) codusur, rca from contas.receber where codusur is not null order by codusur) d),
     'su', (select coalesce(json_object_agg(codsupervisor, supervisor), '{}')
              from (select distinct on (codsupervisor) codsupervisor, supervisor from contas.receber where codsupervisor is not null order by codsupervisor) d),
     'cb', (select coalesce(json_object_agg(codcob, cobranca), '{}')
              from (select distinct on (codcob) codcob, cobranca from contas.receber where codcob is not null order by codcob) d),
     'fu', (select coalesce(json_object_agg(m, nome), '{}')
              from (select distinct on (m) m, nome from (
                      select codfunccxmot as m, funcacerto as nome from contas.receber where codfunccxmot is not null
                      union all
                      select codbaixa, funcbaixa from contas.receber where codbaixa is not null) u
                    order by m, nome nulls last) d)),
  'r', (select json_build_object(
     'nt',  coalesce(json_agg(numtransvenda order by i), '[]'),
     'p',   coalesce(json_agg(prest order by i), '[]'),
     'fi',  coalesce(json_agg(codfilial order by i), '[]'),
     'fnf', coalesce(json_agg(codfilialnf order by i), '[]'),
     'du',  coalesce(json_agg(duplic order by i), '[]'),
     'de',  coalesce(json_agg(contas.dia(dtemissao) order by i), '[]'),
     'dv',  coalesce(json_agg(contas.dia(dtvenc) order by i), '[]'),
     'dvo', coalesce(json_agg(contas.dia(dtvencorig) order by i), '[]'),
     'cl',  coalesce(json_agg(codcli order by i), '[]'),
     'vl',  coalesce(json_agg(contas.num(valor) order by i), '[]'),
     'ru',  coalesce(json_agg(codusur order by i), '[]'),
     'su',  coalesce(json_agg(codsupervisor order by i), '[]'),
     'cb',  coalesce(json_agg(codcob order by i), '[]'),
     'cx',  coalesce(json_agg(contas.dia(dtcxmot) order by i), '[]'),
     'fcx', coalesce(json_agg(codfunccxmot order by i), '[]'),
     'fg',  coalesce(json_agg(funcgeracao order by i), '[]'),
     'nb',  coalesce(json_agg(nossonumbco order by i), '[]'),
     'st',  coalesce(json_agg(status order by i), '[]'),
     'nn',  coalesce(json_agg(numnota order by i), '[]'),
     'car', coalesce(json_agg(numcar order by i), '[]'),
     'ca',  coalesce(json_agg(cartorio order by i), '[]')
   ) from x),
  's', (select json_build_object(
     'dp',  coalesce(json_object_agg(i, contas.dia(dtpag)) filter (where dtpag is not null), '{}'),
     'dca', coalesce(json_object_agg(i, contas.dia(dtcancel)) filter (where dtcancel is not null), '{}'),
     'bx',  coalesce(json_object_agg(i, codbaixa) filter (where codbaixa is not null), '{}'),
     'bk',  coalesce(json_object_agg(i, codbanco) filter (where codbanco is not null), '{}'),
     'bcu', coalesce(json_object_agg(i, codbancocustodia) filter (where codbancocustodia is not null), '{}'),
     'dcu', coalesce(json_object_agg(i, contas.dia(dtcustodia)) filter (where dtcustodia is not null), '{}'),
     'ncu', coalesce(json_object_agg(i, numcustodia) filter (where numcustodia is not null), '{}'),
     'lcu', coalesce(json_object_agg(i, numlotecustodia) filter (where numlotecustodia is not null), '{}'),
     'dd',  coalesce(json_object_agg(i, contas.dia(dtdesd)) filter (where dtdesd is not null), '{}')
   ) from x),
  'z', (select json_build_object(
     'tx', coalesce(json_object_agg(i, contas.num(txperm)) filter (where txperm <> 0), '{}'),
     'ds', coalesce(json_object_agg(i, contas.num(valordesc)) filter (where valordesc <> 0), '{}'),
     'vp', coalesce(json_object_agg(i, contas.num(vpago)) filter (where vpago <> 0), '{}')
   ) from x),
  'sc', (select coalesce(json_agg(i order by i), '[]') from x where tem_cliente <> 'S'),
  'sr', (select coalesce(json_agg(i order by i), '[]') from x where tem_rca <> 'S')
);
$$;

-- refaz os dois pacotes no formato novo
update contas.marca set sujo = true;
select contas.atualizar_pacote();
