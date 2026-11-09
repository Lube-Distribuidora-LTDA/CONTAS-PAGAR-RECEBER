/* =============================================================================
 * dados.js — a conversa com o servidor:
 *   · api/consulta  a página, os totais, a lista de valores de cada coluna (filtro do Excel) e o lote do Excel,
 *                   tudo feito no banco (contas.consulta) sobre os em aberto e os pagos desde 2011;
 *   · api/versao    o ao vivo: a versão do sistema muda quando o AGENTE LUBE grava algo novo do WinThor;
 *   · api/atualizar o botão Atualizar (o agente lê o WinThor na hora) e api/titulo, a tela de um título.
 * Desde 2026-11-09 o navegador não baixa mais os títulos: com milhões de pagos, quem filtra e soma é o banco.
 * ========================================================================== */
(function () {
"use strict";
var L = window.L;

L.fHora = function (iso) { return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"; };
L.fCnpj = function (s) {
  var d = String(s || "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : String(s || "");
};
L.destacar = function (texto, termos) {
  var t = String(texto == null ? "" : texto), nt = L.norm(t), marcas = [];
  termos.forEach(function (q) { var i = nt.indexOf(q); if (q && i >= 0) marcas.push([i, i + q.length]); });
  if (!marcas.length) return L.esc(t);
  marcas.sort(function (a, b) { return a[0] - b[0]; });
  var out = "", pos = 0;
  marcas.forEach(function (m) { if (m[0] < pos) return; out += L.esc(t.slice(pos, m[0])) + "<mark>" + L.esc(t.slice(m[0], m[1])) + "</mark>"; pos = m[1]; });
  return out + L.esc(t.slice(pos));
};

/* datas em AAAA-MM-DD (dia de Brasília) */
L.isoHoje = function () { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); };
L.isoSomar = function (iso, dias) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

function erroHttp(r, oque) {
  return r.json().catch(function () { return {}; }).then(function (j) {
    if (r.status === 401) throw new Error("Sua sessão do Painel Lube expirou. Entre de novo pelo portal.");
    throw new Error("Não foi possível ler " + oque + " (" + r.status + (j && j.mensagem ? ": " + j.mensagem : j && j.erro ? ": " + j.erro : "") + ").");
  });
}
L.erroHttp = erroHttp;

/* a consulta da tela (contas.consulta): p = { rot, acao, status, campo, de, ate, q, cf, mostrar, ordem, desc, offset, limite, ... } */
L.api = function (p, oque) {
  return fetch("api/consulta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p), cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : erroHttp(r, oque || "os títulos"); });
};
L.versaoNoBanco = function () { return fetch("api/versao?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : erroHttp(r, "a versão dos dados"); }); };

/* ------------------------------ a ponte até o agente ------------------------------ */
L.pedirAtualizacao = function () {
  return fetch("api/atualizar", { method: "POST", cache: "no-store" }).then(function (r) {
    if (r.status === 404) return { agente: false, mensagem: "Este painel ainda não tem a ponte com o agente." };
    return r.ok ? r.json() : erroHttp(r, "o pedido de leitura do WinThor");
  });
};
L.esperarPedido = function (id, limiteMs) {
  var fim = Date.now() + (limiteMs || 45000);
  return new Promise(function (ok, falha) {
    (function olhar() {
      fetch("api/versao?pedido=" + encodeURIComponent(id) + "&_=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : erroHttp(r, "o pedido de leitura do WinThor"); })
        .then(function (v) {
          var p = v.pedido;
          if (p && /^(atendido|erro|expirado)$/.test(p.status)) return ok(v);
          if (Date.now() > fim) { v.pedido = Object.assign({}, p || {}, { status: "demorou" }); return ok(v); }
          setTimeout(olhar, 600);
        }, falha);
    })();
  });
};
// [singular, plural, "nova(s)" ou "novo(s)"]
var NOMES_FLUXO = {
  "contas.pagar": ["título a pagar", "títulos a pagar", "o"], "contas.receber": ["título a receber", "títulos a receber", "o"],
  "contas.pagar_pago": ["pagamento", "pagamentos", "o"], "contas.receber_pago": ["recebimento", "recebimentos", "o"],
  "contas.receber_bk": ["ocorrência do banco", "ocorrências do banco", "a"], "contas.receber_desd": ["linha de desdobramento", "linhas de desdobramento", "a"],
  "contas.receber_item": ["item de nota", "itens de nota", "o"], "contas.receber_banco": ["alteração bancária", "alterações bancárias", "a"],
  "contas.receber_obs": ["observação", "observações", "a"],
};
L.textoMudancas = function (p) {
  var d = (p && p.detalhe) || {}, partes = [];
  Object.keys(NOMES_FLUXO).forEach(function (k) {
    var x = d[k]; if (!x) return;
    var n = NOMES_FLUXO[k], q = function (v) { return L.fInt(v) + " " + (v === 1 ? n[0] : n[1]); };
    var aberto = k === "contas.pagar" || k === "contas.receber";
    if (x.novas) partes.push(q(x.novas) + " nov" + n[2] + (x.novas === 1 ? "" : "s"));
    if (x.alteradas) partes.push(q(x.alteradas) + (x.alteradas === 1 ? " mudou" : " mudaram"));
    if (x.apagadas) partes.push(q(x.apagadas) + (aberto ? (x.apagadas === 1 ? " saiu do em aberto (pago ou baixado)" : " saíram do em aberto (pagos ou baixados)") : (x.apagadas === 1 ? " estornado" : " estornados")));
  });
  return partes.length ? partes.join(", ") : "nada mudou desde a última leitura";
};

/* ------------------------------ a tela de um título (lida na hora) ------------------------------ */
L.lerTitulo = function (rot, t) {
  var url = rot === "pagar" ? "api/titulo?t=p&r=" + encodeURIComponent(t.recnum) : "api/titulo?t=r&nt=" + encodeURIComponent(t.numtransvenda) + "&p=" + encodeURIComponent(t.prest);
  return fetch(url + "&_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : erroHttp(r, "o título"); });
};

})();
