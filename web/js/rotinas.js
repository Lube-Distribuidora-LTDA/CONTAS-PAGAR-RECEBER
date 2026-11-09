/* =============================================================================
 * rotinas.js — as duas telas (717 Contas a Pagar e 1240 Contas a Receber), limpas (Júlio, 2026-11-09: "preciso tá
 * tela limpa"; "bastante nichado para conseguir achar alguns números com velocidade e precisão"):
 *   · uma faixa só: Status (A pagar / Pago / Todos), Período (qual data + atalhos + de/até), Filial; a busca é a do
 *     topo; o resto se filtra no cabeçalho de cada coluna, como no Excel (grade.js);
 *   · pílulas com cada filtro ligado (o × tira só ele) e "Limpar tudo";
 *   · totais do recorte inteiro (não só da página), e uma linha com o que fica fora da soma, com "mostrar";
 *   · colunas importantes de saída (o resto no botão Colunas) e, na 1240, a parcela "2 de 3" (pedido do Júlio).
 * Os títulos pagos e recebidos vêm desde 01/01/2011 (contas.pagar_pago, contas.receber_pago).
 * ========================================================================== */
(function () {
"use strict";
var L = window.L;
L.rotinas = {};
L.FILIAIS = new Map();
function nomeFilial(c) { var f = L.FILIAIS.get(String(c)); return c == null ? "" : f ? c + " - " + f.n : String(c); }
L.nomeFilial = nomeFilial;

var TIPOS_PARC = { F: "Fornecedor", R: "RCA", C: "Cliente", O: "Outros", M: "Motorista", L: "Colaborador" };
var ST_PREST = { AP: "Aprovado", AB: "Aberta", RE: "Rejeitado", CA: "Cancelado", LP: "Liberado Pagamento", FI: "Finalizado", EN: "Encerrado" };
var ST_ADIANT = { S: "Solicitado", A: "Aprovado", R: "Rejeitado", C: "Cancelado", L: "Liberado Pagamento", F: "Finalizado" };
L.ROTINA_PAGAR = { TIPOS_PARC: TIPOS_PARC, ST_PREST: ST_PREST, ST_ADIANT: ST_ADIANT, nomeFilial: nomeFilial };
L.ROTINA_RECEBER = { nomeFilial: nomeFilial };

/* ------------------------------ peças das colunas ------------------------------ */
function codNome(cod, nome) { return { html: cod == null ? L.esc(nome || "") : '<span class="cod-n">' + L.esc(cod) + "</span>" + L.esc(nome || "(sem cadastro)") }; }
function txtCodNome(cod, nome) { return cod == null ? nome || "" : cod + " - " + (nome || ""); }
function statusTag(pg) {
  return function (v, r) {
    var pago = v === "P";
    var t = pago ? (pg ? "Pago" : "Recebido") : (pg ? "A pagar" : "A receber");
    var vencido = !pago && r.atraso > 0;
    return { html: '<span class="st ' + (pago ? "st-pago" : vencido ? "st-vencido" : "st-aberto") + '">' + t + "</span>" };
  };
}
function zeroVazio(v, r) { return r.st === "A" && Number(v) === 0 ? "" : L.fBRL(Number(v)); }
function classeVenc(v, r) { return r.st === "A" && r.atraso > 0 ? "vencido" : r.st === "A" && r.atraso === 0 && v === L.isoHoje() ? "vence-hoje" : ""; }
function atrasoTxt(v, r) { return !v ? "" : L.fInt(v) + (r.st === "P" ? " (pago)" : ""); }

var COLS_PAGAR = [
  { id: "st", titulo: "Status", tipo: "status", valor: function (r) { return r.st; }, mostrar: statusTag(true), rotuloValor: function (v) { return v === "A" ? "A pagar" : "Pago"; }, exp: function (r) { return r.st === "A" ? "A PAGAR" : "PAGO"; } },
  { id: "codfilial", titulo: "Filial", tipo: "codigo", valor: function (r) { return r.codfilial; }, rotuloValor: nomeFilial, dica: "Filial do lançamento" },
  { id: "recnum", titulo: "Núm. Lanc.", tipo: "codigo", valor: function (r) { return r.recnum; }, classe: function () { return "cod"; } },
  { id: "parceiro", titulo: "Parceiro", tipo: "texto", valor: function (r) { return r.parceiro; }, campos: ["codfornec", "parceiro"],
    mostrar: function (v, r) { return codNome(r.codfornec, r.parceiro); }, exp: function (r) { return txtCodNome(r.codfornec, r.parceiro); },
    rotuloValor: function (v, rr) { return rr || String(v).replace(/^\w:/, ""); }, dica: "Fornecedor, cliente, RCA, colaborador ou outro (o tipo está na coluna Tipo parceiro)" },
  { id: "conta", titulo: "Conta", tipo: "texto", valor: function (r) { return r.conta; }, campos: ["codconta", "conta"],
    mostrar: function (v, r) { return codNome(r.codconta, r.conta); }, exp: function (r) { return txtCodNome(r.codconta, r.conta); } },
  { id: "historico", titulo: "Histórico", tipo: "texto", valor: function (r) { return r.historico; } },
  { id: "numnota", titulo: "Nota", tipo: "codigo", valor: function (r) { return r.numnota; } },
  { id: "dtemissao", titulo: "Emissão", tipo: "data", valor: function (r) { return r.dtemissao; } },
  { id: "dtvenc", titulo: "Vencimento", tipo: "data", valor: function (r) { return r.dtvenc; }, classe: classeVenc },
  { id: "dtpagto", titulo: "Pagamento", tipo: "data", valor: function (r) { return r.dtpagto; } },
  { id: "valor", titulo: "Valor", tipo: "moeda", valor: function (r) { return r.valor; }, dica: "Valor do título (Valor Dup. na rotina)" },
  { id: "valorpagar", titulo: "A Pagar", tipo: "moeda", valor: function (r) { return r.valorpagar; }, dica: "Valor + Juros − Desc. fin. − Devolução + Variação cambial, como a rotina 717 (só nos em aberto)" },
  { id: "vpago", titulo: "Valor Pago", tipo: "moeda", valor: function (r) { return r.vpago; }, mostrar: zeroVazio },
  { id: "atraso", titulo: "Atraso", tipo: "dias", valor: function (r) { return r.atraso; }, mostrar: atrasoTxt, classe: function (v, r) { return r.st === "A" && v > 0 ? "vencido" : ""; }, dica: "Dias de atraso: em aberto, de hoje contra o vencimento; pago, do pagamento contra o vencimento" },
  // extras (botão Colunas)
  { id: "tipoparceiro", titulo: "Tipo parceiro", tipo: "texto", padrao: false, valor: function (r) { return r.tipoparceiro; }, mostrar: function (v) { return v ? v + " - " + (TIPOS_PARC[v] || "") : ""; }, rotuloValor: function (v, rr) { return rr || TIPOS_PARC[v] || v; } },
  { id: "codfornec", titulo: "Cód. parceiro", tipo: "codigo", padrao: false, valor: function (r) { return r.codfornec; } },
  { id: "estado", titulo: "UF", tipo: "texto", padrao: false, valor: function (r) { return r.estado; } },
  { id: "grupo", titulo: "Grupo de contas", tipo: "texto", padrao: false, valor: function (r) { return r.grupo; }, campos: ["grupoconta", "grupo"],
    mostrar: function (v, r) { return codNome(r.grupoconta, (r.grupo || "").trim()); }, exp: function (r) { return txtCodNome(r.grupoconta, (r.grupo || "").trim()); } },
  { id: "dtlanc", titulo: "Lançamento", tipo: "data", padrao: false, valor: function (r) { return r.dtlanc; } },
  { id: "dtcompetencia", titulo: "Competência", tipo: "data", padrao: false, valor: function (r) { return r.dtcompetencia; } },
  { id: "duplic", titulo: "Pr.", tipo: "texto", padrao: false, valor: function (r) { return r.duplic; } },
  { id: "parcela", titulo: "Núm. Parcela", tipo: "texto", padrao: false, valor: function (r) { return r.parcela; } },
  { id: "recnumprinc", titulo: "Lanc. principal", tipo: "codigo", padrao: false, valor: function (r) { return r.recnumprinc; } },
  { id: "descontofin", titulo: "Desc. fin.", tipo: "moeda", padrao: false, valor: function (r) { return r.descontofin; } },
  { id: "valordev", titulo: "Devolução", tipo: "moeda", padrao: false, valor: function (r) { return r.valordev; } },
  { id: "txperm", titulo: "Juros", tipo: "moeda", padrao: false, valor: function (r) { return r.txperm; } },
  { id: "vlvariacaocambial", titulo: "Variação cambial", tipo: "moeda", padrao: false, valor: function (r) { return r.vlvariacaocambial; } },
  { id: "numbanco", titulo: "Banco", tipo: "codigo", padrao: false, valor: function (r) { return r.numbanco; } },
  { id: "nomefunc", titulo: "Usuário", tipo: "texto", padrao: false, valor: function (r) { return r.nomefunc; }, dica: "Quem lançou (PCLANC.NOMEFUNC)" },
  { id: "comprador", titulo: "Comprador", tipo: "texto", padrao: false, valor: function (r) { return r.comprador; }, campos: ["codcomprador", "comprador"],
    mostrar: function (v, r) { return r.codcomprador == null ? "" : codNome(r.codcomprador, r.comprador); }, exp: function (r) { return r.codcomprador == null ? "" : txtCodNome(r.codcomprador, r.comprador); } },
  { id: "boleto", titulo: "Boleto", tipo: "texto", padrao: false, valor: function (r) { return r.boleto; }, dica: "Só nos em aberto" },
  { id: "nfservico", titulo: "NF de serviço", tipo: "texto", padrao: false, valor: function (r) { return r.nfservico; }, dica: "Só nos em aberto" },
  { id: "tipolanc", titulo: "Tipo lanç.", tipo: "texto", padrao: false, valor: function (r) { return r.tipolanc; }, mostrar: function (v) { return v === "P" ? "Provisionado" : v === "C" ? "Confirmado" : v || ""; }, dica: "Só nos em aberto" },
];

var COLS_RECEBER = [
  { id: "st", titulo: "Status", tipo: "status", valor: function (r) { return r.st; }, mostrar: statusTag(false), rotuloValor: function (v) { return v === "A" ? "A receber" : "Recebido"; }, exp: function (r) { return r.st === "A" ? "A RECEBER" : "RECEBIDO"; } },
  { id: "codfilial", titulo: "Filial", tipo: "codigo", valor: function (r) { return r.codfilial; }, rotuloValor: nomeFilial },
  { id: "duplic", titulo: "Duplicata", tipo: "codigo", valor: function (r) { return r.duplic; }, classe: function () { return "cod"; } },
  { id: "prest", titulo: "Parcela", tipo: "texto", valor: function (r) { return r.prest; }, campos: ["prest", "parcelas", "codcob"],
    mostrar: function (v, r) {
      var p = r.parcelas || {};
      if (r.codcob === "DESD" || !p.n) return { html: '<span class="de-n">Pr. ' + L.esc(v) + (r.codcob === "DESD" ? " (desdobrado)" : "") + "</span>" };
      return { html: "<b>" + p.i + "</b> de " + p.n + (String(p.i) !== String(v) ? ' <span class="de-n">· Pr. ' + L.esc(v) + "</span>" : "") };
    },
    exp: function (r) { var p = r.parcelas || {}; return r.codcob === "DESD" || !p.n ? "Pr. " + r.prest + (r.codcob === "DESD" ? " (desdobrado)" : "") : p.i + " de " + p.n + (String(p.i) !== String(r.prest) ? " (Pr. " + r.prest + ")" : ""); },
    rotuloValor: function (v) { return "Pr. " + v; },
    dica: "Qual parcela da venda e quantas são (os títulos da mesma venda, em aberto e recebidos, fora os desdobrados), por vencimento. O filtro e a ordem usam a prestação do WinThor (Pr.), que muda no desdobramento" },
  { id: "cliente", titulo: "Cliente", tipo: "texto", valor: function (r) { return r.cliente; }, campos: ["codcli", "cliente"],
    mostrar: function (v, r) { return codNome(r.codcli, r.cliente); }, exp: function (r) { return txtCodNome(r.codcli, r.cliente); } },
  { id: "rca", titulo: "RCA", tipo: "texto", valor: function (r) { return r.rca; }, campos: ["codusur", "rca"],
    mostrar: function (v, r) { return codNome(r.codusur, r.rca); }, exp: function (r) { return txtCodNome(r.codusur, r.rca); } },
  { id: "cobranca", titulo: "Cobrança", tipo: "texto", valor: function (r) { return r.cobranca; }, campos: ["codcob", "cobranca"],
    mostrar: function (v, r) { return codNome(r.codcob, r.cobranca); }, exp: function (r) { return txtCodNome(r.codcob, r.cobranca); } },
  { id: "dtemissao", titulo: "Emissão", tipo: "data", valor: function (r) { return r.dtemissao; } },
  { id: "dtvenc", titulo: "Vencimento", tipo: "data", valor: function (r) { return r.dtvenc; }, classe: classeVenc },
  { id: "dtpag", titulo: "Pagamento", tipo: "data", valor: function (r) { return r.dtpag; } },
  { id: "valor", titulo: "Valor", tipo: "moeda", valor: function (r) { return r.valor; } },
  { id: "vpago", titulo: "Valor Pago", tipo: "moeda", valor: function (r) { return r.vpago; }, mostrar: zeroVazio },
  { id: "atraso", titulo: "Atraso", tipo: "dias", valor: function (r) { return r.atraso; }, mostrar: atrasoTxt, classe: function (v, r) { return r.st === "A" && v > 0 ? "vencido" : ""; }, dica: "Dias de atraso: em aberto, de hoje contra o vencimento; recebido, do pagamento contra o vencimento" },
  // extras
  { id: "numtransvenda", titulo: "Num.Trans.Venda", tipo: "codigo", padrao: false, valor: function (r) { return r.numtransvenda; } },
  { id: "fantasia", titulo: "Fantasia", tipo: "texto", padrao: false, valor: function (r) { return r.fantasia; } },
  { id: "cnpj", titulo: "CNPJ/CPF", tipo: "texto", padrao: false, valor: function (r) { return r.cnpj; } },
  { id: "supervisor", titulo: "Supervisor", tipo: "texto", padrao: false, valor: function (r) { return r.supervisor; }, campos: ["codsupervisor", "supervisor"],
    mostrar: function (v, r) { return r.codsupervisor == null ? "" : codNome(r.codsupervisor, r.supervisor); }, exp: function (r) { return r.codsupervisor == null ? "" : txtCodNome(r.codsupervisor, r.supervisor); } },
  { id: "txperm", titulo: "Juros", tipo: "moeda", padrao: false, valor: function (r) { return r.txperm; } },
  { id: "valordesc", titulo: "Desconto", tipo: "moeda", padrao: false, valor: function (r) { return r.valordesc; } },
  { id: "dtcancel", titulo: "Cancelamento", tipo: "data", padrao: false, valor: function (r) { return r.dtcancel; } },
  { id: "codbanco", titulo: "Banco", tipo: "codigo", padrao: false, valor: function (r) { return r.codbanco; } },
  { id: "nossonumbco", titulo: "Nosso número", tipo: "texto", padrao: false, valor: function (r) { return r.nossonumbco; } },
];

/* ------------------------------ o que fica fora da soma (cada um com "mostrar") ------------------------------ */
var FORA = {
  pagar: [
    { k: "cheque", txt: "em aberto com cheque ou borderô já emitido", dica: "A rotina 717 mostra de saída só cheque/borderô não emitidos" },
    { k: "antigos", txt: "em aberto vencidos antes de 2011" },
    { k: "creditos", txt: "pagos de valor negativo (créditos e estornos)", dica: "Lançamentos pagos com valor negativo: entram no Pago só se você pedir" },
    { k: "excluidos", txt: "lançamento 3462463 (provável erro de digitação, aguardando o financeiro)", dica: "Lançamento de 27/06/2025 (filial 1, conta 208006, baixa pela 1301) com valor fora de qualquer escala: fica fora da soma até o financeiro conferir; \"mostrar\" inclui" },
  ],
  receber: [
    { k: "desd", txt: "com a cobrança DESD (desdobrados)", dica: "A rotina 1240 esconde de saída (\"Exibir cobrança DESD\")" },
    { k: "semcad", txt: "sem cliente ou RCA no cadastro", dica: "A rotina 1240 não mostra" },
    { k: "cancelados", txt: "recebidos por cancelamento", dica: "Baixa por cancelamento (DTCANCEL): não é dinheiro recebido" },
    { k: "antigos", txt: "em aberto vencidos antes de 2011" },
  ],
};

/* ------------------------------ período ------------------------------ */
var PERIODOS = [
  ["tudo", "Tudo"], ["vencidos", "Vencidos (até ontem)"], ["hoje", "Hoje"], ["d7", "Próximos 7 dias"], ["d30", "Próximos 30 dias"],
  ["semana", "Esta semana"], ["mes", "Este mês"], ["mes_ant", "Mês passado"], ["ano", "Este ano"], ["ano_ant", "Ano passado"], ["m12", "Últimos 12 meses"],
];
function faixaPeriodo(per) {
  var h = L.isoHoje(), a = +h.slice(0, 4), m = +h.slice(5, 7);
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var fimMes = function (ano, mes) { return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10); };
  switch (per.r) {
    case "vencidos": return { de: null, ate: L.isoSomar(h, -1) };
    case "hoje": return { de: h, ate: h };
    case "d7": return { de: h, ate: L.isoSomar(h, 7) };
    case "d30": return { de: h, ate: L.isoSomar(h, 30) };
    case "semana": var dw = (new Date(h + "T12:00:00Z").getUTCDay() + 6) % 7; return { de: L.isoSomar(h, -dw), ate: L.isoSomar(h, 6 - dw) };
    case "mes": return { de: a + "-" + pad(m) + "-01", ate: fimMes(a, m) };
    case "mes_ant": var am = m === 1 ? a - 1 : a, mm = m === 1 ? 12 : m - 1; return { de: am + "-" + pad(mm) + "-01", ate: fimMes(am, mm) };
    case "ano": return { de: a + "-01-01", ate: a + "-12-31" };
    case "ano_ant": return { de: (a - 1) + "-01-01", ate: (a - 1) + "-12-31" };
    case "m12": return { de: L.isoSomar(h, -364), ate: h };
    case "livre": return { de: per.de || null, ate: per.ate || null };
    default: return { de: null, ate: null };
  }
}
function textoPeriodo(per) {
  if (per.r === "livre") { var f = faixaPeriodo(per); return (f.de ? L.fData(f.de) : "início") + " a " + (f.ate ? L.fData(f.ate) : "hoje"); }
  var p = PERIODOS.filter(function (x) { return x[0] === per.r; })[0];
  return p ? p[1] : "Tudo";
}

/* ------------------------------ as duas definições ------------------------------ */
function def(id) {
  var pg = id === "pagar";
  return {
    id: id, rot: id, numero: pg ? "717" : "1240", titulo: pg ? "Contas a Pagar" : "Contas a Receber",
    olho: pg ? "Rotina 717 · Contas a Pagar" : "Rotina 1240 · Consultar Duplicata Contas a Receber",
    buscaDica: pg ? "Buscar: lançamento, nota, parceiro, conta ou histórico…" : "Buscar: duplicata, transação, cliente, CNPJ ou nosso número…",
    st: pg ? ["A pagar", "Pago"] : ["A receber", "Recebido"],
    campos: pg ? [["dtvenc", "Vencimento"], ["dtpagto", "Pagamento"], ["dtemissao", "Emissão"], ["dtlanc", "Lançamento"], ["dtcompetencia", "Competência"]]
               : [["dtvenc", "Vencimento"], ["dtpag", "Pagamento"], ["dtemissao", "Emissão"]],
    campoPag: pg ? "dtpagto" : "dtpag",
    cols: pg ? COLS_PAGAR : COLS_RECEBER,
    fora: FORA[id],
    F: { status: "aberto", campo: "dtvenc", per: { r: "tudo" }, q: "", mostrar: {}, cf: {} },
    grade: null, ultimoTot: null,
  };
}
L.rotinas.pagar = def("pagar");
L.rotinas.receber = def("receber");

function paramsDe(d) {
  var F = d.F, fx = faixaPeriodo(F.per);
  return { status: F.status, campo: F.campo, de: fx.de, ate: fx.ate, q: F.q, mostrar: F.mostrar };
}
L.paramsRotina = paramsDe;

/* ------------------------------ a tela ------------------------------ */
var faixaEl, pilEl, totEl, foraEl;
L.desenharRotina = function (d) {
  var cont = L.limpar(L.$("conteudo")), faixa = L.limpar(L.$("faixa-filtros"));
  faixaEl = L.h("div", { class: "fx-linha" }); pilEl = L.h("div", { class: "pilulas" });
  faixa.appendChild(faixaEl); faixa.appendChild(pilEl);
  totEl = L.h("div", { class: "tot-cards" });
  foraEl = L.h("div", { class: "fora-linha" });
  var corpo = L.h("section", { class: "painel c-12 lista-rot" });
  cont.appendChild(totEl); cont.appendChild(foraEl); cont.appendChild(corpo);
  if (!d.grade) {
    d.grade = L.gradeBanco({
      rot: d.rot, arquivo: d.rot === "pagar" ? "contas-a-pagar-717" : "contas-a-receber-1240",
      colunas: d.cols, cf: d.F.cf, ordem: { id: "dtvenc", desc: false },
      params: function () { return paramsDe(d); },
      aoCarregar: function (tot) { d.ultimoTot = tot; desenharTotais(d, tot); desenharFora(d, tot); },
      aoMudarFiltro: function () { desenharFaixa(d); },
      aoClicar: function (r) { L.abrirTitulo(d, r); },
      classeLinha: function (r) { return r.excluido ? "excluido" : r.tem_cad === "N" ? "sem-cadastro" : r.codcob === "DESD" ? "desd" : ""; },
      excel: function (tot) { return excelDe(d, tot); },
    });
    corpo.appendChild(d.grade);
    d.grade.recarregar(true);
  } else {
    corpo.appendChild(d.grade);
    if (d.ultimoTot) { desenharTotais(d, d.ultimoTot); desenharFora(d, d.ultimoTot); }
  }
  desenharFaixa(d);
};

function recarregar(d) { desenharFaixa(d); d.grade.recarregar(true); }
L.recarregarRotina = function (d) { if (d && d.grade) d.grade.recarregar(false); };
L.buscarNaRotina = function (d, q) { d.F.q = q; recarregar(d); };

function desenharFaixa(d) {
  var F = d.F;
  L.limpar(faixaEl);
  // status
  var seg = L.h("div", { class: "seg seg-st", role: "group", "aria-label": "Status" });
  [["aberto", d.st[0]], ["pago", d.st[1]], ["todos", "Todos"]].forEach(function (o) {
    seg.appendChild(L.h("button", { type: "button", class: F.status === o[0] ? "on" : "", text: o[1], onclick: function () { mudarStatus(d, o[0]); } }));
  });
  faixaEl.appendChild(seg);
  // período
  var nomeCampo = (d.campos.filter(function (c) { return c[0] === F.campo; })[0] || d.campos[0])[1];
  var temPer = F.per.r !== "tudo";
  var btPer = L.h("button", { class: "fx-btn" + (temPer ? " on" : ""), type: "button", title: "Período: qual data e de quando a quando" },
    L.h("span", { html: L.ic("calendario") }), L.h("span", { class: "tx", text: nomeCampo + ": " + textoPeriodo(F.per) }), L.h("span", { html: L.ic("baixo") }));
  btPer.addEventListener("click", function () { abrirPeriodo(d, btPer); });
  faixaEl.appendChild(btPer);
  // filial
  var fil = (F.cf.codfilial || [])[0], selFil = fil && fil.m === "em" && F.cf.codfilial.length === 1 ? fil.v : null;
  var btFil = L.h("button", { class: "fx-btn" + (F.cf.codfilial ? " on" : ""), type: "button", title: "Filial" },
    L.h("span", { html: L.ic("loja") }),
    L.h("span", { class: "tx", text: !F.cf.codfilial ? "Todas as filiais" : selFil && selFil.length === 1 ? nomeFilial(selFil[0]) : selFil ? L.fInt(selFil.length) + " filiais" : "Filial (filtro da coluna)" }),
    L.h("span", { html: L.ic("baixo") }));
  btFil.addEventListener("click", function () { abrirFiliais(d, btFil); });
  faixaEl.appendChild(btFil);
  // limpar
  var algo = F.status !== "aberto" || temPer || F.q || Object.keys(F.cf).length || Object.keys(F.mostrar).some(function (k) { return F.mostrar[k]; });
  if (algo) faixaEl.appendChild(L.h("button", { class: "mini-btn limpar-tudo", type: "button", html: L.ic("x") + " Limpar tudo", title: "Volta para os em aberto, sem período nem filtros", onclick: function () {
    F.status = "aberto"; F.campo = "dtvenc"; F.per = { r: "tudo" }; F.q = ""; F.mostrar = {};
    Object.keys(F.cf).forEach(function (k) { delete F.cf[k]; });
    L.$("busca-global").value = "";
    recarregar(d);
  } }));
  desenharPilulas(d);
}

function desenharPilulas(d) {
  var F = d.F;
  L.limpar(pilEl);
  function pil(rot, txt, tirar, cls) {
    pilEl.appendChild(L.h("span", { class: "pilula " + (cls || "") }, L.h("b", { text: rot }), L.h("span", { text: txt, title: txt }),
      L.h("button", { type: "button", title: "Tirar", html: L.ic("x"), onclick: function () { tirar(); recarregar(d); } })));
  }
  if (F.q) pil("Busca", "“" + F.q + "”", function () { F.q = ""; L.$("busca-global").value = ""; });
  d.cols.forEach(function (c) {
    if (F.cf[c.id] && F.cf[c.id].length) pil(c.titulo, L.descreverFiltro(c, F.cf[c.id]), function () { delete F.cf[c.id]; });
  });
  d.fora.forEach(function (f) { if (F.mostrar[f.k]) pil("Incluindo", f.txt, function () { delete F.mostrar[f.k]; }, "fora"); });
  pilEl.style.display = pilEl.children.length ? "" : "none";
}

function mudarStatus(d, st) {
  var F = d.F;
  if (F.status === st) return;
  F.status = st;
  if (st === "pago" && F.per.r === "tudo") {
    // o histórico pago é grande (desde 2011): abre no mês, pela data de pagamento; "Tudo" continua a um clique
    F.campo = d.campoPag; F.per = { r: "mes" };
    L.toast(d.st[1] + ": este mês, pela data de pagamento. Mude o período para ver mais (desde 2011).", "ok");
  }
  if (st === "aberto" && F.campo === d.campoPag) { F.campo = "dtvenc"; F.per = { r: "tudo" }; }
  recarregar(d);
}

function abrirPeriodo(d, ancora) {
  var F = d.F, pop = L.h("div", { class: "pop pop-periodo" });
  var campo = F.campo;
  var segC = L.h("div", { class: "seg seg-campo" });
  function desenharCampos() {
    L.limpar(segC);
    d.campos.forEach(function (c) {
      var off = F.status === "aberto" && c[0] === d.campoPag;
      segC.appendChild(L.h("button", { type: "button", class: (campo === c[0] ? "on" : ""), disabled: off, title: off ? "Em aberto ainda não tem data de pagamento" : "", text: c[1], onclick: function () { campo = c[0]; desenharCampos(); } }));
    });
  }
  desenharCampos();
  pop.appendChild(L.h("div", { class: "pp-bloco" }, L.h("label", { text: "Data" }), segC));
  var grade = L.h("div", { class: "pp-atalhos" });
  PERIODOS.forEach(function (p) {
    grade.appendChild(L.h("button", { type: "button", class: "mini-btn" + (F.per.r === p[0] && F.campo === campo ? " ativo" : ""), text: p[1], onclick: function () {
      F.campo = campo; F.per = { r: p[0] }; L.fecharPopover(); recarregar(d);
    } }));
  });
  pop.appendChild(L.h("div", { class: "pp-bloco" }, L.h("label", { text: "Atalhos" }), grade));
  var fx = faixaPeriodo(F.per);
  var de = L.h("input", { type: "date", value: fx.de || "" }), ate = L.h("input", { type: "date", value: fx.ate || "" });
  var aplicar = function () { F.campo = campo; F.per = de.value || ate.value ? { r: "livre", de: de.value || null, ate: ate.value || null } : { r: "tudo" }; L.fecharPopover(); recarregar(d); };
  [de, ate].forEach(function (i) { i.addEventListener("keydown", function (ev) { if (ev.key === "Enter") aplicar(); }); });
  pop.appendChild(L.h("div", { class: "pp-bloco" }, L.h("label", { text: "De / até" }),
    L.h("div", { class: "pp-livre" }, de, L.h("span", { text: "a" }), ate, L.h("button", { type: "button", class: "btn pri", text: "Aplicar", onclick: aplicar }))));
  L.abrirPop(pop, ancora, 430);
}

function abrirFiliais(d, ancora) {
  var F = d.F, atual = F.cf.codfilial && F.cf.codfilial.length === 1 && F.cf.codfilial[0].m === "em" ? F.cf.codfilial[0].v.slice() : [];
  var pop = L.h("div", { class: "pop" }), lista = L.h("div", { class: "pop-lista" });
  var fil = Array.from(L.FILIAIS.values());
  function desenhar() {
    L.limpar(lista);
    lista.appendChild(L.h("button", { type: "button", class: "pop-item" + (!atual.length ? " on" : ""), onclick: function () { atual = []; aplicar(); } },
      L.h("span", { class: "cx" }), L.h("span", { class: "tx", text: "Todas as filiais" })));
    fil.forEach(function (f) {
      var on = atual.indexOf(String(f.id)) >= 0;
      lista.appendChild(L.h("button", { type: "button", class: "pop-item" + (on ? " on" : ""), onclick: function () {
        var i = atual.indexOf(String(f.id)); if (i >= 0) atual.splice(i, 1); else atual.push(String(f.id));
        desenhar();
      } }, L.h("span", { class: "cx" }), L.h("span", { class: "tx" }, L.h("span", { html: '<b class="cd">' + L.esc(f.id) + "</b> " + L.esc(f.n || "") }), f.sub ? L.h("small", { text: f.sub }) : null)));
    });
  }
  function aplicar() {
    if (atual.length && atual.length < fil.length) F.cf.codfilial = [{ m: "em", v: atual.slice(), r: atual.map(nomeFilial) }]; else delete F.cf.codfilial;
    L.fecharPopover(); recarregar(d);
  }
  desenhar();
  pop.appendChild(lista);
  pop.appendChild(L.h("div", { class: "pop-rodape" }, L.h("span", { text: "Marque uma ou mais" }), L.h("button", { type: "button", class: "btn pri", text: "OK", onclick: aplicar })));
  L.abrirPop(pop, ancora, 360);
}

/* ------------------------------ totais e o que ficou fora ------------------------------ */
function desenharTotais(d, t) {
  L.limpar(totEl);
  if (!t) return;
  var pg = d.rot === "pagar", F = d.F;
  function card(rot, v, opt) {
    opt = opt || {};
    var b = L.h("b", { class: "num" + (opt.neg || v < 0 ? " neg" : "") });
    var el = L.h("div", { class: "tc" + (opt.pri ? " pri" : "") + (opt.cls ? " " + opt.cls : ""), title: opt.dica || "" }, L.h("small", { text: rot }), b, opt.sub ? L.h("span", { class: "tc-sub", text: opt.sub }) : null);
    L.contar(b, v, opt.int ? L.fInt : function (x) { return L.fBRL(x); }, 500);
    totEl.appendChild(el);
  }
  var sub = F.status === "todos" ? L.fInt(t.n_aberto) + " " + d.st[0].toLowerCase() + " · " + L.fInt(t.n_pago) + " " + (pg ? "pagos" : "recebidos") : "";
  card("Títulos", t.n, { int: 1, sub: sub });
  card("Valor", t.valor, { dica: "Soma da coluna Valor de todos os títulos do filtro (não só da página)" });
  if (F.status !== "pago") card(pg ? "A pagar" : "A receber", pg ? t.valorpagar : t.areceber, { pri: 1, cls: "c-aberto", dica: pg ? "Valor a Pagar da rotina 717: Valor + Juros − Desc. fin. − Devolução + Variação cambial" : "Valor dos títulos em aberto" });
  if (F.status !== "aberto") card(pg ? "Pago" : "Recebido", t.vpago, { pri: 1, cls: "c-pago", dica: "Soma do valor pago (VPAGO) dos títulos baixados no filtro" });
  if (pg) { card("Juros", t.txperm); card("Desc. fin.", t.descontofin); card("Devolução", t.valordev); }
  else { card("Juros", t.txperm); card("Desconto", t.valordesc); }
}
function desenharFora(d, t) {
  L.limpar(foraEl);
  if (!t || !t.fora) return;
  var F = d.F, itens = d.fora.filter(function (f) { var x = t.fora[f.k]; return x && x.n > 0 && !F.mostrar[f.k]; });
  if (!itens.length) { foraEl.style.display = "none"; return; }
  foraEl.style.display = "";
  foraEl.appendChild(L.h("span", { class: "fl-rot", html: L.ic("info") + "Fora da soma:" }));
  itens.forEach(function (f) {
    var x = t.fora[f.k];
    foraEl.appendChild(L.h("span", { class: "fl-item", title: f.dica || "" },
      L.h("b", { text: L.fInt(x.n) }), " " + f.txt + " (" + L.fAbrev(x.v, true) + ") ",
      L.h("button", { type: "button", class: "link-mini", text: "mostrar", onclick: function () { F.mostrar[f.k] = true; recarregar(d); } })));
  });
}

/* ------------------------------ o Excel: filtros escritos e os totais ------------------------------ */
function excelDe(d, t) {
  var F = d.F, pg = d.rot === "pagar", fx = faixaPeriodo(F.per);
  var nomeCampo = (d.campos.filter(function (c) { return c[0] === F.campo; })[0] || d.campos[0])[1];
  var filtros = [["Status", F.status === "aberto" ? d.st[0] : F.status === "pago" ? d.st[1] : "Todos (" + d.st[0].toLowerCase() + " e " + d.st[1].toLowerCase() + ")"]];
  filtros.push(["Período", F.per.r === "tudo" ? "Tudo" : nomeCampo + ": " + textoPeriodo(F.per) + (fx.de || fx.ate ? " (" + (fx.de ? L.fData(fx.de) : "início") + " a " + (fx.ate ? L.fData(fx.ate) : "hoje") + ")" : "")]);
  if (F.q) filtros.push(["Busca", F.q]);
  d.fora.forEach(function (f) { filtros.push([f.txt.charAt(0).toUpperCase() + f.txt.slice(1), F.mostrar[f.k] ? "Incluídos" : "Fora (como na tela)"]); });
  var resumo = [["Títulos", t.n, "inteiro"], ["Valor", t.valor, "moeda"]];
  if (F.status !== "pago") resumo.push([pg ? "A pagar" : "A receber", pg ? t.valorpagar : t.areceber, "moeda"]);
  if (F.status !== "aberto") resumo.push([pg ? "Pago" : "Recebido", t.vpago, "moeda"]);
  resumo.push(["Juros", t.txperm, "moeda"]);
  if (pg) { resumo.push(["Desc. fin.", t.descontofin, "moeda"]); resumo.push(["Devolução", t.valordev, "moeda"]); }
  else resumo.push(["Desconto", t.valordesc, "moeda"]);
  return {
    titulo: (pg ? "Contas a Pagar" : "Contas a Receber") + " · rotina " + d.numero,
    subtitulo: "Lube Distribuidora · gerado em " + new Date().toLocaleString("pt-BR") + " · dados do WinThor pelo AGENTE LUBE",
    aba: pg ? "Contas a Pagar" : "Contas a Receber",
    filtros: filtros, resumo: resumo,
    rodape: "Pagos e recebidos desde 01/01/2011. " + (pg ? "Regra da rotina 717 (PCLANC)." : "Regra da rotina 1240 (PCPREST)."),
  };
}

})();
