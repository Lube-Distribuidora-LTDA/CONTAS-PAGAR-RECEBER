-- =============================================================================
-- CONTAS A PAGAR E RECEBER — consulta rápida sobre milhões de pagos (migração contas_04_consulta_rapida, 2026-11-09)
--
-- Medido logo depois da carga do histórico (1,16 mi pagos na 717, 3,08 mi recebidos na 1240): "pagos, sem período"
-- levava 23 s (717) e 30 s (1240). O que pesava:
--   · o nome do parceiro vinha de uma visão em UNION (v_parceiro): o Postgres não consegue tirar essa junção quando
--     a consulta não usa o nome (os totais), e fazia 1,16 mi buscas; agora são junções simples pela chave de cada
--     cadastro, que o planejador descarta sozinho quando o nome não é usado;
--   · "o mesmo título nos dois lados vale o em aberto" era um NOT EXISTS que percorria o índice inteiro; agora é
--     NOT IN sobre a lista pequena dos em aberto (vira uma tabela de dispersão na memória);
--   · a página ordenava as linhas inteiras (com todos os nomes) para mostrar 50: agora ordena só a chave e busca as
--     50 linhas depois;
--   · contas.hoje() e contas.br() não eram marcadas como seguras para consulta paralela, o que proibia o paralelismo.
-- =============================================================================

alter function contas.hoje() parallel safe;
alter function contas.br(numeric) parallel safe;
alter function contas.formato(text, text) parallel safe;
alter function contas.rotulo(jsonb) parallel safe;

create or replace view contas.v_pagar as
select 'A'::text as st, p.recnum, p.recnumprinc, p.codfilial, p.dtlanc, p.dtemissao, p.dtvenc, null::date as dtpagto,
       p.dtcompetencia, p.codfornec, p.tipoparceiro, p.parceiro, p.estado, p.codconta, p.conta, p.grupoconta, p.grupo,
       p.historico, p.numnota, p.duplic, p.parcela, p.valor, p.descontofin, p.valordev, p.txperm, p.vlvariacaocambial,
       p.valor + p.txperm - p.descontofin - p.valordev + p.vlvariacaocambial as valorpagar, p.vpago,
       greatest(0, contas.hoje() - p.dtvenc) as atraso, p.numbanco, p.nomefunc, p.codcomprador, p.comprador,
       p.boleto, p.nfservico, p.tipolanc, (p.dtcheq is not null or p.dtborder is not null) as emitido,
       case when p.tipoparceiro in ('F', 'R', 'C', 'M', 'L') then null else p.parceiro end as ptxt
  from contas.pagar p
union all
select 'P', g.recnum, g.recnumprinc, g.codfilial, g.dtlanc, g.dtemissao, g.dtvenc, g.dtpagto,
       g.dtcompetencia, g.codfornec, g.tipoparceiro,
       coalesce(case g.tipoparceiro when 'F' then pf.fornecedor when 'C' then pc.cliente when 'R' then pr.nome
                                    when 'M' then pe.nome when 'L' then pe.nome end, g.parceiro_txt),
       f.uf, g.codconta, c.conta, c.grupoconta, c.grupo,
       g.historico, g.numnota, g.duplic, g.parcela, g.valor, g.descontofin, g.valordev, g.txperm, g.vlvariacaocambial,
       null::numeric, g.vpago,
       greatest(0, g.dtpagto - g.dtvenc), g.numbanco, g.nomefunc, g.codcomprador, coalesce(e.guerra, e.nome),
       null::text, null::text, null::text, false,
       case when g.tipoparceiro in ('F', 'R', 'C', 'M', 'L') then null else g.parceiro_txt end
  from contas.pagar_pago g
  left join contas.fornecedor pf on g.tipoparceiro = 'F' and pf.codfornec = g.codfornec
  left join contas.cliente pc on g.tipoparceiro = 'C' and pc.codcli = g.codfornec
  left join contas.rca pr on g.tipoparceiro = 'R' and pr.codusur = g.codfornec
  left join contas.funcionario pe on g.tipoparceiro in ('M', 'L') and pe.matricula = g.codfornec
  left join contas.fornecedor f on f.codfornec = g.codfornec
  left join contas.conta c on c.codconta = g.codconta
  left join contas.funcionario e on e.matricula = g.codcomprador
 where g.recnum not in (select a.recnum from contas.pagar a);

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
 where (g.numtransvenda, g.prest) not in (select a.numtransvenda, a.prest from contas.receber a);

