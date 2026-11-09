/* =============================================================================
 * titulo.js — a tela de um título (gaveta lateral), lida na hora do banco (api/titulo):
 *   · 1240: as abas da tela do título da rotina (frmDadosTitulo), na ordem dela: Faturamento, Acerto, Dados
 *     cheque, Custódia CH, Dados BK, Histórico BK, Prorrogação, Comissão, Hist. desdobr., Observações, Itens da
 *     Nota e Hist. Alt. Bancário, com os mesmos rótulos;
 *   · 717: o lançamento inteiro (as 64 colunas da grade, agrupadas) e o desdobramento dele.
 * "Buscar no WinThor" pede ao AGENTE LUBE uma leitura agora e relê o título.
 * ========================================================================== */
(function () {
"use strict";
var L = window.L;
var aberto = null;   // { def, t, aba }

function data(v) { if (v == null || v === "") return ""; var s = String(v); return s.length >= 10 ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : s; }
function dataHora(v) { if (!v) return ""; var d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR"); }
function moeda(v) { return v == null || v === "" ? "" : L.fBRL(Number(v)); }
function num(v, d) { return v == null || v === "" ? "" : L.fNum(Number(v), d || 0); }
function cod(c, n) { return c == null || c === "" ? (n || "") : n ? c + " - " + n : String(c); }
function dias(a, b) { if (!a || !b) return ""; return String(Math.round((Date.parse(a) - Date.parse(b)) / 864e5)); }
function sn(v) { return v === "S" ? "Sim" : v === "N" ? "Não" : v || ""; }

/* ficha: linhas de campos [rótulo, valor, { largo, calc, dica }] */
function ficha(linhas) {
  var box = L.h("div", { class: "ficha" });
  linhas.forEach(function (lin) {
    var l = L.h("div", { class: "f-lin" });
    lin.forEach(function (c) {
      if (!c) return;
      var o = c[2] || {}, v = c[1] == null || c[1] === "" ? "" : String(c[1]);
      l.appendChild(L.h("div", { class: "f-item" + (o.largo ? " largo" : "") + (o.calc ? " calc" : ""), title: o.dica || "" },
        L.h("label", { text: c[0] }), L.h("div", { class: "f-val" + (v ? "" : " vazio") + (o.num ? " num" : ""), text: v || "—" })));
    });
    box.appendChild(l);
  });
  return box;
}
/* grade simples com totais, para as abas que são lista */
function grade(cols, linhas, vazio) {
  if (!linhas.length) return L.h("div", { class: "vazio", html: "<b>Nada nesta aba</b>" + L.esc(vazio || "") });
  var tab = L.h("table", { class: "tabela mini" }), tr = L.h("tr");
  cols.forEach(function (c) { tr.appendChild(L.h("th", { class: c.d ? "d" : "", text: c.t })); });
  tab.appendChild(L.h("thead", null, tr));
  var tb = L.h("tbody"), soma = cols.map(function () { return 0; });
  linhas.forEach(function (r) {
    var l = L.h("tr", { class: c0(r) });
    cols.forEach(function (c, i) { var v = c.v(r); if (c.soma) soma[i] += Number(c.bruto ? c.bruto(r) : v) || 0; l.appendChild(L.h("td", { class: c.d ? "d" : "", text: c.f ? c.f(v, r) : v == null ? "" : String(v) })); });
    tb.appendChild(l);
  });
  tab.appendChild(tb);
  if (cols.some(function (c) { return c.soma; })) {
    var tf = L.h("tr");
    cols.forEach(function (c, i) { tf.appendChild(L.h("td", { class: c.d ? "d" : "", text: i === 0 ? "Total · " + L.fInt(linhas.length) : c.soma ? (c.fs ? c.fs(soma[i]) : L.fBRL(soma[i])) : "" })); });
    tab.appendChild(L.h("tfoot", null, tf));
  }
  return L.h("div", { class: "tb-wrap livre" }, tab);
  function c0(r) { return r._classe || ""; }
}

/* ------------------------------ 1240: as abas da tela do título ------------------------------ */
var ABAS_1240 = [
  ["fat", "Faturamento"], ["acerto", "Acerto"], ["cheque", "Dados cheque"], ["custodia", "Custódia CH"], ["bk", "Dados BK"], ["histbk", "Histórico BK"],
  ["prorrog", "Prorrogação"], ["comissao", "Comissão"], ["desd", "Hist. desdobr."], ["obs", "Observações"], ["itens", "Itens da Nota"], ["banco", "Hist. Alt. Bancário"],
];
function abaReceber(id, j) {
  var t = j.t || {}, nf = L.ROTINA_RECEBER.nomeFilial;
  if (id === "fat") return ficha([
    [["Cód. filial venda", nf(t.codfilial)], ["Cód. filial NF.", t.codfilialnf ? nf(t.codfilialnf) : ""]],
    [["Supervisor", cod(t.codsupervisor, t.supervisor), { largo: 1 }]],
    [["RCA", cod(t.codusur, t.rca), { largo: 1 }]],
    [["Cliente", cod(t.codcli, t.cliente), { largo: 1 }]],
    [["Data emissão", data(t.dtemissao)], ["Data vencimento", data(t.dtvenc)], ["Prazo", dias(t.dtvenc, t.dtemissao), { calc: 1, dica: "Data vencimento − Data emissão" }]],
    [["Índice", t.status], ["Data venc. orig.", data(t.dtvencorig)], ["Num. car.", t.numcar]],
    [["Valor duplicata", moeda(t.valor), { num: 1 }], ["Valor dupl. ori.", moeda(t.valororig), { num: 1 }], ["Juros recebido", moeda(t.txperm), { num: 1 }]],
    [["Juros devido", moeda(t.txpermprevisto), { num: 1 }], ["Data prevista", data(t.dtrecebimentoprevisto)]],
    [["Cobrança", cod(t.codcob, t.cobranca), { largo: 1 }]],
    [["Motorista", cod(t.codmotorista, t.motorista), { largo: 1 }]],
    [["Nota fiscal", t.numnota], ["Pedido", t.numped], ["Func. geração", t.funcgeracao]],
  ]);
  if (id === "acerto") return ficha([
    [["Data caixa motorista", data(t.dtcxmot)]],
    [["Funcionário caixa motorista", cod(t.codfunccxmot, t.funcacerto), { largo: 1 }]],
    [["Data Fechamento", data(t.dtfecha)]],
    [["Funcionário fechamento", cod(t.codfuncfecha, t.funcfecha), { largo: 1 }]],
    [["Data pagamento", data(t.dtpag)], ["Valor pagamento", moeda(t.vpago), { num: 1 }]],
    [["Valor desconto", moeda(t.valordesc), { num: 1 }], ["Percentual de desconto", t.perdesc == null ? "" : num(t.perdesc, 2) + " %"]],
    [["Taxa de juros", t.txjuros == null ? "" : num(t.txjuros, 2) + " % a.m."], ["Valor juros", moeda(t.txperm), { num: 1 }]],
    [["Juros (a.d.)", "", { calc: 1, dica: "Calculado pela tela da rotina na hora (não fica gravado no WinThor)" }], ["Prazo protesto", t.numdiasprazoprotesto == null ? "" : num(t.numdiasprazoprotesto) + " dias"]],
    [["Data baixa", data(t.dtbaixa)], ["Rem. cartório", t.cartorio === "S" ? "Sim" : "", { dica: "Título marcado para cartório (PCPREST.CARTORIO)" }]],
    [["Enviado ao Serasa", t.dtenvioserasa ? "Sim, em " + data(t.dtenvioserasa) : "Não"], ["Retirado do Serasa", t.dtretiradaserasa ? "Sim, em " + data(t.dtretiradaserasa) : "Não"]],
    [["Funcionário baixa", cod(t.codbaixa, t.funcbaixa), { largo: 1 }]],
    [["Banco baixa", t.codbanco], ["Moeda baixa", t.codcobbanco], ["Num. trans. baixa", t.numtrans]],
  ]);
  if (id === "cheque") return ficha([
    [["Número banco", t.numbanco], ["Número agência", t.numagencia]],
    [["Número cheque", t.numcheque], ["Data lançamento cheque", data(t.dtlancch)]],
    [["Cód. barra", t.codbarra, { largo: 1 }]],
    [["Observações", t.obs, { largo: 1 }]],
    [["", t.obs2, { largo: 1 }]],
    [["Alínea", t.alinea]],
  ]);
  if (id === "custodia") return ficha([
    [["Banco custódia", t.codbancocustodia], ["Data de custódia", data(t.dtcustodia)]],
    [["Número da custódia", t.numcustodia], ["Número do lote", t.numlotecustodia]],
  ]);
  if (id === "bk") return ficha([
    [["Nosso núm. banco", t.nossonumbco], ["Tipo lançamento", t.tipo]],
    [["Valor taxa boleto", moeda(t.vltxboleto), { num: 1 }]],
    [["Código barra", t.codbarra, { largo: 1 }]],
    [["Linha digitável", t.linhadig, { largo: 1 }]],
    [["Título env. cób. magnética", sn(t.operacao)], ["Arquivo / remessa", [t.nomearquivo, t.numremessa].filter(Boolean).join(" · ")]],
  ]);
  if (id === "histbk") return grade([
    { t: "Data", v: function (r) { return r.data; }, f: function (v) { return dataHora(v); } },
    { t: "Código", v: function (r) { return r.codocorrencia; } },
    { t: "Ocorrência", v: function (r) { return r.ocorrencia; } },
    { t: "Código", v: function (r) { return r.codsubocorrencia; } },
    { t: "sub ocorrência", v: function (r) { return r.descricao; } },
    { t: "Vl. despesas", v: function (r) { return r.vldespesas; }, f: moeda, d: 1, soma: 1 },
    { t: "Vl. custas cartório", v: function (r) { return r.vlcustas; }, f: moeda, d: 1, soma: 1 },
    { t: "Nome arquivo", v: function () { return t.nomearquivo; } },
    { t: "Núm. remessa", v: function () { return t.numremessa; } },
    { t: "Usuário", v: function (r) { return r.usuario; } },
    { t: "Máquina", v: function (r) { return r.maquina; } },
    { t: "Arq. retorno", v: function (r) { return r.arqretorno; } },
    { t: "Rotina", v: function (r) { return r.rotinalanc; } },
  ], j.bk || [], "Sem ocorrência do banco para este título.");
  if (id === "prorrog") return ficha([
    [["Tipo prorrogação", t.tipoprorrog]],
    [["Data lanc. prorrogação", data(t.dtlancprorrog)]],
    [["Nº de Dias Prorrogados", dias(t.dtvenc, t.dtvencorig), { calc: 1, dica: "Data vencimento − Data venc. original" }]],
    [["Data venc. original", data(t.dtvencorig)]],
    [["Valor original", moeda(t.valororig), { num: 1 }]],
    [["Cód. cob. original", cod(t.codcoborig, t.cobrancaorig), { largo: 1 }]],
  ]);
  if (id === "comissao") return ficha([
    [["Percentual comissão", t.percom == null ? "" : num(t.percom, 2) + " %"]],
    [["Valor líquido com.", moeda(t.valorliqcom), { num: 1 }]],
    [["Valor comissão", t.percom != null && t.valorliqcom != null ? moeda(t.valorliqcom * t.percom / 100) : "", { calc: 1, num: 1, dica: "Valor líquido com. × Percentual comissão" }]],
  ]);
  if (id === "desd") {
    var lin = (j.desd || []).map(function (r) {
      r._tipo = r.tipo_rel === "O" ? "Origem" : r.dtpag == null ? "Aberto" : String(r.codcob || "").trim().toUpperCase() === "DESD" ? "Desdobrado" : "Baixado";
      r._classe = "desd-" + (r.tipo_rel === "O" ? "origem" : r.dtpag == null ? "aberto" : String(r.codcob || "").trim().toUpperCase() === "DESD" ? "desdobrado" : "baixado");
      if (r.numtransvenda === t.numtransvenda && r.prest === t.prest) r._classe += " este";
      return r;
    });
    var box = L.h("div");
    box.appendChild(L.h("div", { class: "legenda-desd" }, L.h("span", { class: "d-aberto", text: "Titulos Abertos" }), L.h("span", { class: "d-desdobrado", text: "Titulos Desdobrados" }), L.h("span", { class: "d-baixado", text: "Titulos baixados" }), L.h("span", { class: "d-origem", text: "Título de origem" })));
    box.appendChild(grade([
      { t: "Tipo título", v: function (r) { return r._tipo; } },
      { t: "Cód. cob.", v: function (r) { return r.codcob; } },
      { t: "Cód. cob. orig.", v: function (r) { return r.codcoborig; } },
      { t: "Duplic", v: function (r) { return r.duplic; } },
      { t: "Prest", v: function (r) { return r.prest; } },
      { t: "Núm. trans. venda", v: function (r) { return r.numtransvenda; } },
      { t: "Valor", v: function (r) { return r.valor; }, f: moeda, d: 1 },
      { t: "Juros", v: function (r) { return r.txperm; }, f: moeda, d: 1 },
      { t: "Vl. devol.", v: function (r) { return r.vldevol; }, f: moeda, d: 1 },
      { t: "Valor desc.", v: function (r) { return r.valordesc; }, f: moeda, d: 1 },
      { t: "Vl. pago", v: function (r) { return r.vpago; }, f: moeda, d: 1 },
      { t: "Dt. desd.", v: function (r) { return r.dtdesd; }, f: function (v, r) { return v ? data(v) + " " + String(r.horadesd || 0).padStart(2, "0") + ":" + String(r.minutodesd || 0).padStart(2, "0") : ""; } },
      { t: "Dt. devol.", v: function (r) { return r.dtdevol; }, f: data },
      { t: "Dt. venc.", v: function (r) { return r.dtvenc; }, f: data },
      { t: "Valor orig.", v: function (r) { return r.valororig; }, f: moeda, d: 1 },
      { t: "Dt. emissão", v: function (r) { return r.dtemissao; }, f: data },
      { t: "Cód. filial", v: function (r) { return r.codfilial; } },
      { t: "Cod. func. últ. alteração", v: function (r) { return r.codfuncultalter; } },
      { t: "Nome func. últ. alteração", v: function (r) { return r.nomefuncultalter; } },
      { t: "Dt. últ. alter.", v: function (r) { return r.dtultalter; }, f: data },
      { t: "Cód. func. baixa", v: function (r) { return r.codbaixa; } },
      { t: "Dt. pag.", v: function (r) { return r.dtpag; }, f: data },
      { t: "Nome func. baixa", v: function (r) { return r.nomefuncbaixa; } },
      { t: "Dt. recebimento previsto", v: function (r) { return r.dtrecebimentoprevisto; }, f: data },
      { t: "RCA", v: function (r) { return cod(r.codusur, r.rca); } },
    ], lin, "Este título não veio de desdobramento."));
    return box;
  }
  if (id === "obs") {
    var o = j.obs || {};
    return ficha([
      [["Observações", o.obsgerais, { largo: 1 }]],
      [["Observações do título no acerto", o.obsacerto, { largo: 1 }]],
      [["Observações (título)", [t.obs, t.obs2].filter(Boolean).join(" · "), { largo: 1, dica: "PCPREST.OBS e OBS2 (as da aba Dados cheque)" }]],
    ]);
  }
  if (id === "itens") return grade([
    { t: "Código", v: function (r) { return r.codprod; } },
    { t: "Descrição", v: function (r) { return r.descricao; } },
    { t: "Qt.", v: function (r) { return r.qt; }, f: function (v) { return num(v, 0); }, d: 1, soma: 1, fs: function (s) { return L.fNum(s, 0); } },
    { t: "P. unit.", v: function (r) { return r.punit; }, f: function (v) { return v == null ? "" : L.fBRL(Number(v), 4); }, d: 1 },
    { t: "Vl. total", v: function (r) { return r.vltotger; }, f: moeda, d: 1, soma: 1 },
  ], j.itens || [], "Sem itens de nota (título manual ou sem transação de venda).");
  if (id === "banco") return grade([
    { t: "Data", v: function (r) { return r.data; }, f: function (v) { return dataHora(v); } },
    { t: "Filial", v: function () { return nf(t.codfilial); } },
    { t: "Usuário WinThor", v: function (r) { return r.usuario; } },
    { t: "Núm. trans. venda", v: function (r) { return r.numtransvenda; } },
    { t: "Duplic", v: function () { return t.duplic; } },
    { t: "Prest", v: function (r) { return r.prest; } },
    { t: "Valor atual 1", v: function (r) { return r.valor_atual1; } },
    { t: "Valor anterior 1", v: function (r) { return r.valor_anterior1; } },
    { t: "Valor atual 2", v: function (r) { return r.valor_atual2; } },
    { t: "Valor anterior 2", v: function (r) { return r.valor_anterior2; } },
    { t: "Cliente", v: function () { return cod(t.codcli, t.cliente); } },
    { t: "Banco", v: function (r) { return cod(r.codbanco, r.banco); } },
    { t: "Máquina", v: function (r) { return r.maquina; } },
    { t: "Rotina", v: function (r) { return r.rotina; } },
  ], j.banco || [], "Sem alteração do nosso número.");
  return L.h("div");
}

/* ------------------------------ 717: o lançamento ------------------------------ */
function fichaPagar(j) {
  var t = j.t || {}, P = L.ROTINA_PAGAR, vp = (t.valor || 0) + (t.txperm || 0) - (t.descontofin || 0) - (t.valordev || 0) + (t.vlvariacaocambial || 0);
  var box = L.h("div");
  function sec(tit, linhas) { box.appendChild(L.h("h4", { class: "f-sec", text: tit })); box.appendChild(ficha(linhas)); }
  sec("Título", [
    [["Cód. Filial", P.nomeFilial(t.codfilial)], ["Núm. Lanc.", t.recnum], ["Núm. Lanc. Principal", t.recnumprinc]],
    [["Núm. Nota", t.numnota], ["Pr.", t.duplic], ["Núm. Parcela", t.parcela]],
    [["Dt. Lanc.", data(t.dtlanc)], ["Dt. Emissão", data(t.dtemissao)], ["Dt. Competência", data(t.dtcompetencia)]],
    [["Dt. Venc.", data(t.dtvenc)], ["Dt. Venc. Origem", data(t.dtvencorigem)], ["Prorrog.", t.prorrog]],
    [["Histórico", t.historico, { largo: 1 }]],
    [["Histórico 2", t.historico2, { largo: 1 }]],
  ]);
  sec("Parceiro e conta", [
    [["Tipo Parceiro", t.tipoparceiro ? t.tipoparceiro + " - " + (P.TIPOS_PARC[t.tipoparceiro] || "") : ""], ["Cód. Parceiro", t.codfornec], ["UF", t.estado]],
    [["Parceiro", t.parceiro, { largo: 1 }]],
    [["Prazo", t.prazo], ["Prazo Mín.", t.prazomin], ["Comprador", cod(t.codcomprador, t.comprador)]],
    [["Conta", cod(t.codconta, t.conta), { largo: 1 }]],
    [["Grupo", cod(t.grupoconta, (t.grupo || "").trim()), { largo: 1 }]],
    [["Conta master", t.codcontamaster], ["Rateio", cod(t.codrateioconta, t.rateioconta)]],
  ]);
  sec("Valores", [
    [["Valor Dup.", moeda(t.valor), { num: 1 }], ["Vlr Desc. Fin.", moeda(t.descontofin), { num: 1 }], ["Valor Dev.", moeda(t.valordev), { num: 1 }]],
    [["Juros", moeda(t.txperm), { num: 1 }], ["Vl. Variação Cambial", moeda(t.vlvariacaocambial), { num: 1 }], ["Valor a Pagar", moeda(vp), { num: 1, calc: 1, dica: "Valor Dup. + Juros − Desc. Fin. − Valor Dev. + Variação cambial" }]],
    [["Valor Pago", moeda(t.vpago), { num: 1 }], ["Vl. Pago Bordero", moeda(t.vpagobordero), { num: 1 }], ["Moeda", t.moeda]],
    [["ISS", moeda(t.vliss), { num: 1 }], ["INSS", moeda(t.vlinss), { num: 1 }], ["IRRF", moeda(t.vlirrf), { num: 1 }]],
    [["PIS", moeda(t.vlpis), { num: 1 }], ["COFINS", moeda(t.vlcofins), { num: 1 }], ["CSRF", moeda(t.vlcsrf), { num: 1 }]],
  ]);
  sec("Pagamento", [
    [["Localização", t.localizacao], ["Boleto", sn(t.boleto)], ["Dt. Bloqueio", data(t.dtbloq)]],
    [["Banco", t.numbanco], ["Núm. Cheque", t.numcheque], ["Dt. Cheque", data(t.dtcheq)]],
    [["Núm. Borderô", t.numbordero], ["Núm. Seq. Borderô", t.numseqbordero], ["Dt. Bordero", data(t.dtborder)]],
    [["Dt. Estorno Baixa", data(t.dtestornobaixa)], ["Núm. Trans. Adiant. For.", t.numtransadiantfor], ["Núm. Negociação", t.numnegociacao]],
  ]);
  sec("Outros", [
    [["Usuário", t.nomefunc], ["Tipo lanç.", t.tipolanc === "P" ? "Provisionado" : "Confirmado"], ["Indice", t.indice]],
    [["Núm. Trans. Ent.", t.numtransent], ["Núm. nota dev.", t.numnotadev], ["NF de serviço", sn(t.nfservico)]],
    [["Projeto", t.codprojeto], ["Num. Prestação de Contas", cod(t.numprestacaoconta, t.statusprestacaoconta ? P.ST_PREST[t.statusprestacaoconta] : "")], ["Num. Adiantamento", cod(t.numadiantamento, t.statusadiantamento ? P.ST_ADIANT[t.statusadiantamento] : "")]],
    [["Títulos agrupados", t.codagrupamento], ["Cód. receita", t.codreceita], ["Contrato de câmbio", t.numcontratocambio]],
  ]);
  var desd = j.desd || [];
  if (desd.length || t.recnumprinc) {
    box.appendChild(L.h("h4", { class: "f-sec", text: "Desdobramento (em aberto)" }));
    box.appendChild(grade([
      { t: "Núm. Lanc.", v: function (r) { return r.r; } },
      { t: "Núm. Lanc. Principal", v: function (r) { return r.rp; } },
      { t: "Filial", v: function (r) { return r.fi; } },
      { t: "Pr.", v: function (r) { return r.du; } },
      { t: "Núm. Parcela", v: function (r) { return r.pc; } },
      { t: "Dt. Venc.", v: function (r) { return r.dv; }, f: data },
      { t: "Valor Dup.", v: function (r) { return r.vl; }, f: moeda, d: 1, soma: 1 },
    ], desd, t.recnumprinc ? "O principal (" + t.recnumprinc + ") já foi baixado; nenhuma outra parcela em aberto." : "Nenhuma outra parcela em aberto."));
  }
  return box;
}

/* ------------------------------ pagos e recebidos (do histórico desde 2011) ------------------------------ */
function fichaPagarPago(j) {
  var t = j.t || {}, P = L.ROTINA_PAGAR, box = L.h("div");
  function sec(tit, linhas) { box.appendChild(L.h("h4", { class: "f-sec", text: tit })); box.appendChild(ficha(linhas)); }
  sec("Título", [
    [["Cód. Filial", P.nomeFilial(t.codfilial)], ["Núm. Lanc.", t.recnum], ["Núm. Lanc. Principal", t.recnumprinc]],
    [["Núm. Nota", t.numnota], ["Pr.", t.duplic], ["Núm. Parcela", t.parcela]],
    [["Dt. Lanc.", data(t.dtlanc)], ["Dt. Emissão", data(t.dtemissao)], ["Dt. Competência", data(t.dtcompetencia)]],
    [["Histórico", t.historico, { largo: 1 }]],
  ]);
  sec("Parceiro e conta", [
    [["Tipo Parceiro", t.tipoparceiro ? t.tipoparceiro + " - " + (P.TIPOS_PARC[t.tipoparceiro] || "") : ""], ["Cód. Parceiro", t.codfornec], ["UF", t.estado]],
    [["Parceiro", t.parceiro, { largo: 1 }]],
    [["Conta", cod(t.codconta, t.conta), { largo: 1 }]],
    [["Grupo", cod(t.grupoconta, (t.grupo || "").trim()), { largo: 1 }]],
    [["Comprador", cod(t.codcomprador, t.comprador)]],
  ]);
  sec("Pagamento", [
    [["Dt. Venc.", data(t.dtvenc)], ["Dt. Pagamento", data(t.dtpagto)], ["Dias de atraso", t.atraso ? String(t.atraso) : "0", { calc: 1, dica: "Data do pagamento − vencimento" }]],
    [["Valor Dup.", moeda(t.valor), { num: 1 }], ["Vlr Desc. Fin.", moeda(t.descontofin), { num: 1 }], ["Valor Dev.", moeda(t.valordev), { num: 1 }]],
    [["Juros", moeda(t.txperm), { num: 1 }], ["Vl. Variação Cambial", moeda(t.vlvariacaocambial), { num: 1 }], ["Valor Pago", moeda(t.vpago), { num: 1 }]],
    [["Banco", t.numbanco], ["Usuário", t.nomefunc]],
  ]);
  box.appendChild(L.nota("Lançamento já pago: a ficha mostra o que fica guardado do pagamento (desde 2011). O título completo, com cheque, borderô e impostos, está na rotina 717 do WinThor."));
  return box;
}
function abaParcelas(j) {
  var t = j.t || {}, lin = (j.parcelas || []).map(function (p) { p._classe = p.prest === t.prest ? "este" : ""; return p; });
  return grade([
    { t: "Pr.", v: function (r) { return r.prest; } },
    { t: "Situação", v: function (r) { return String(r.codcob || "").trim() === "DESD" ? "Desdobrado" : r.st === "A" ? "A receber" : "Recebido"; } },
    { t: "Cobrança", v: function (r) { return r.codcob; } },
    { t: "Vencimento", v: function (r) { return r.dtvenc; }, f: data },
    { t: "Pagamento", v: function (r) { return r.dtpag; }, f: data },
    { t: "Valor", v: function (r) { return r.valor; }, f: moeda, d: 1, soma: 1 },
    { t: "Valor pago", v: function (r) { return r.st === "P" ? r.vpago : null; }, f: moeda, d: 1, soma: 1 },
  ], lin, "Sem outras parcelas desta venda.");
}
function fichaReceberPago(j) {
  var t = j.t || {}, nf = L.ROTINA_RECEBER.nomeFilial;
  return ficha([
    [["Cód. filial venda", nf(t.codfilial)], ["Duplicata", t.duplic], ["Prest.", t.prest]],
    [["Num. trans. venda", t.numtransvenda], ["Cobrança", cod(t.codcob, t.cobranca), { largo: 1 }]],
    [["Cliente", cod(t.codcli, t.cliente), { largo: 1 }]],
    [["RCA", cod(t.codusur, t.rca), { largo: 1 }]],
    [["Supervisor", cod(t.codsupervisor, t.supervisor), { largo: 1 }]],
    [["Data emissão", data(t.dtemissao)], ["Data vencimento", data(t.dtvenc)], ["Data pagamento", data(t.dtpag)]],
    [["Valor duplicata", moeda(t.valor), { num: 1 }], ["Juros recebido", moeda(t.txperm), { num: 1 }], ["Valor desconto", moeda(t.valordesc), { num: 1 }]],
    [["Valor pagamento", moeda(t.vpago), { num: 1 }], ["Dias de atraso", t.atraso ? String(t.atraso) : "0", { calc: 1, dica: "Data do pagamento − vencimento" }], ["Data cancelamento", data(t.dtcancel)]],
    [["Banco baixa", t.codbanco], ["Nosso núm. banco", t.nossonumbco]],
  ]);
}

/* ------------------------------ a gaveta ------------------------------ */
function fechar() {
  aberto = null;
  L.$("dossie").classList.remove("on"); L.$("dossie-fundo").classList.remove("on");
  if (/^#t=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search + "#" + (L.paginaAtiva || "pagar"));
}
L.fecharTitulo = fechar;
L.tituloAberto = function () { return !!aberto; };
L.$ && document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && aberto && !document.querySelector(".pop")) fechar(); });

function chave(def, t) { return def.rot === "pagar" ? String(t.recnum) : t.numtransvenda + "-" + t.prest; }
function cabecalho(def, t) {
  var pg = def.rot === "pagar", pago = t.st === "P";
  var titulo = pg ? "Lançamento " + t.recnum : "Duplicata " + (t.duplic != null ? t.duplic : t.numtransvenda) + "-" + t.prest;
  var nome = pg ? t.parceiro : t.cliente;
  var valor = pago ? t.vpago : pg ? t.valorpagar : t.valor;
  var tag = t.st == null ? null : pago ? L.tag((pg ? "Pago em " : "Recebido em ") + L.fData(pg ? t.dtpagto : t.dtpag), "ok")
    : t.atraso > 0 ? L.tag("Vencido há " + t.atraso + " dia" + (t.atraso === 1 ? "" : "s"), "perigo") : L.tag(pg ? "A pagar" : "A receber", "atencao");
  return L.h("div", { style: { flex: 1, minWidth: 0 } },
    L.h("div", { class: "olho", html: L.ic(pg ? "dinheiro" : "carteira") + "Rotina " + def.numero + " · " + L.esc(def.titulo) }),
    L.h("h2", { text: titulo }),
    L.h("div", { class: "sub" },
      nome != null ? L.h("span", { html: L.ic(pg ? "caixa" : "loja") + L.esc(nome || "(sem cadastro)") }) : null,
      t.dtvenc ? L.h("span", { html: L.ic("calendario") + "Venc. " + L.fData(t.dtvenc) }) : null,
      valor != null ? L.h("span", { class: "num", html: L.ic("dinheiro") + L.esc(L.fBRL(Number(valor))) }) : null,
      tag ? L.h("span", { html: tag }) : null));
}

L.abrirTitulo = function (def, t, aba) {
  aberto = { def: def, t: t, aba: aba || (aberto && aberto.def === def ? aberto.aba : null) || (def.rot === "receber" ? "fat" : null) };
  history.replaceState(null, "", "#t=" + def.rot + ":" + encodeURIComponent(chave(def, t)));
  var d = L.$("dossie"), fundo = L.$("dossie-fundo");
  fundo.onclick = fechar;
  L.limpar(d);
  d.appendChild(L.h("div", { class: "dos-cab", id: "dos-cab" }, cabecalho(def, t),
    L.h("div", { class: "dos-acoes" },
      L.h("button", { class: "btn", type: "button", id: "dos-winthor", html: L.ic("relogio") + " Buscar no WinThor", title: "Pede ao agente uma leitura do WinThor agora e relê o título", onclick: buscarWinthor }),
      L.h("button", { class: "btn-ic fechar", type: "button", title: "Fechar (Esc)", html: L.ic("x"), onclick: fechar }))));
  var st = L.h("div", { class: "dos-status", id: "dos-status" }, L.h("i"), L.h("b", { text: "Lendo o título…" }));
  d.appendChild(st);
  var corpo = L.h("div", { class: "dos-corpo", id: "dos-corpo" }, L.h("div", { class: "esq-dos" }, L.h("div", { class: "esqueleto" }), L.h("div", { class: "esqueleto" })));
  d.appendChild(corpo);
  d.classList.add("on"); fundo.classList.add("on");
  carregar();
};

var ABAS_PAGO = [["fat", "Recebimento"], ["parcelas", "Parcelas"]];
function carregar() {
  var a = aberto; if (!a) return;
  var st = L.$("dos-status"), corpo = L.$("dos-corpo");
  return L.lerTitulo(a.def.rot, a.t).then(function (j) {
    if (aberto !== a) return;
    // o cabeçalho com o que o banco tem agora (status, valor, nome)
    var t = Object.assign({}, a.t, j.t || {}, { st: j.st });
    if (a.def.rot === "pagar" && j.st === "A") t.valorpagar = (t.valor || 0) + (t.txperm || 0) - (t.descontofin || 0) - (t.valordev || 0) + (t.vlvariacaocambial || 0);
    if (j.st === "A" && t.dtvenc) { var dd = Math.round((Date.parse(L.isoHoje()) - Date.parse(t.dtvenc)) / 864e5); t.atraso = Math.max(0, dd); }
    a.t = t;
    var cab = L.$("dos-cab"); if (cab) cab.replaceChild(cabecalho(a.def, t), cab.firstChild);
    st.className = "dos-status ok";
    var lido = j.lido || {}, rec = a.def.rot === "receber";
    var tit = rec ? lido[j.st === "P" ? "contas.receber_pago" : "contas.receber"] || {} : lido, ab = lido["contas.receber_bk"] || {};
    st.innerHTML = "<i></i><b>" + (j.st === "P" ? (rec ? "Recebido" : "Pago") + " · lido no WinThor às " : "Título lido no WinThor às ") + L.esc(L.fHora(tit.lido_em)) + "</b>" +
      (rec && j.st === "A" ? "<small>Abas de histórico, itens e observações lidas às " + L.esc(L.fHora(ab.lido_em)) + " (de 10 em 10 min)</small>" : "<small>Pelo AGENTE LUBE, de minuto em minuto</small>");
    L.limpar(corpo);
    if (!rec) { corpo.appendChild(j.st === "P" ? fichaPagarPago(j) : fichaPagar(j)); return; }
    var abas = j.st === "P" ? ABAS_PAGO : ABAS_1240.concat([["parcelas", "Parcelas"]]);
    if (!abas.some(function (x) { return x[0] === a.aba; })) a.aba = "fat";
    var barra = L.h("div", { class: "dos-abas abas-titulo" });
    var cont = { histbk: (j.bk || []).length, desd: (j.desd || []).length, itens: (j.itens || []).length, banco: (j.banco || []).length, parcelas: (j.parcelas || []).length };
    abas.forEach(function (x) {
      barra.appendChild(L.h("button", { type: "button", class: a.aba === x[0] ? "on" : "", onclick: function () { a.aba = x[0]; carregarAba(j, abas); } },
        x[1], cont[x[0]] ? L.h("small", { class: "num", text: String(cont[x[0]]) }) : null));
    });
    corpo.appendChild(barra);
    corpo.appendChild(L.h("div", { id: "dos-aba" }));
    carregarAba(j, abas);
  }).catch(function (e) {
    if (aberto !== a) return;
    st.className = "dos-status erro"; st.innerHTML = "<i></i><b>" + L.esc(e.message || e) + "</b>";
    L.limpar(corpo).appendChild(L.h("div", { class: "vazio", html: "<b>Não foi possível abrir o título</b>" + L.esc(e.message || e) }));
  });
}
function carregarAba(j, abas) {
  var a = aberto; if (!a) return;
  var barra = document.querySelector(".abas-titulo");
  if (barra) Array.prototype.forEach.call(barra.children, function (b, i) { b.classList.toggle("on", abas[i][0] === a.aba); });
  var box = L.limpar(L.$("dos-aba"));
  if (a.aba === "parcelas") { box.appendChild(abaParcelas(j)); return; }
  box.appendChild(j.st === "P" ? fichaReceberPago(j) : abaReceber(a.aba, j));
}
L.recarregarTitulo = function () { if (aberto) carregar(); };

function buscarWinthor() {
  var b = L.$("dos-winthor"), st = L.$("dos-status");
  if (!b || b.classList.contains("girando")) return;
  b.classList.add("girando");
  st.className = "dos-status lendo"; st.innerHTML = "<i></i><b>Lendo o WinThor agora…</b>";
  var t0 = performance.now();
  L.pedirAtualizacao().then(function (r) {
    if (!r || !r.agente) throw new Error((r && r.mensagem) || "O agente do WinThor não está ligado agora.");
    return L.esperarPedido(r.pedido, 45000);
  }).then(function (v) {
    L.ULTIMA_VERSAO = v;
    if (L.recarregarRotina && L.paginaAtiva) L.recarregarRotina(L.rotinas[L.paginaAtiva]);
    var p = v.pedido || {};
    L.toast(p.status === "atendido" ? "WinThor lido em " + L.fNum((performance.now() - t0) / 1000, 1) + " s: " + L.textoMudancas(p) + "." : "O agente ainda está lendo; a tela muda sozinha assim que terminar.", p.status === "atendido" ? "ok" : "erro");
    return carregar();
  }).catch(function (e) { st.className = "dos-status erro"; st.innerHTML = "<i></i><b>" + L.esc(e.message || e) + "</b>"; })
    .then(function () { b.classList.remove("girando"); });
}

})();
