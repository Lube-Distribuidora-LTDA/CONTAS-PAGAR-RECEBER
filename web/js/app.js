/* =============================================================================
 * app.js — a casca: menu das duas rotinas (717 e 1240), a troca de tela, a busca do topo (filtra a tela da rotina),
 * o tema, o ao vivo (AGENTE LUBE) e o botão Atualizar. A tela de cada rotina é rotinas.js + grade.js; o clique
 * num título abre a tela dele (titulo.js).
 * ========================================================================== */
(function () {
"use strict";
var L = window.L;
var ORDEM = ["pagar", "receber"];
var MENU = { pagar: { ic: "dinheiro", rot: "Contas a Pagar", n: "717" }, receber: { ic: "carteira", rot: "Contas a Receber", n: "1240" } };

function def() { return L.rotinas[L.paginaAtiva]; }
function irPara(id, semRolar) {
  if (!L.rotinas[id]) id = "pagar";
  L.fecharPopover();
  L.paginaAtiva = id;
  try { localStorage.setItem("cpr-pagina", id); } catch (e) {}
  if (!/^#t=/.test(location.hash)) history.replaceState(null, "", "#" + id);
  var d = def();
  L.$("olho").textContent = d.olho;
  L.$("titulo").textContent = d.titulo;
  var inp = L.$("busca-global");
  inp.placeholder = d.buscaDica; inp.value = d.F.q || "";
  document.title = d.titulo + " (" + d.numero + ") — Lube Distribuidora";
  construirMenu();
  L.desenharRotina(d);
  mostrarVivo();
  if (!semRolar) window.scrollTo({ top: 0 });
}
L.irPara = irPara;

/* ------------------------------ menu e rodapé ------------------------------ */
function construirMenu() {
  var nav = L.limpar(L.$("menu-itens"));
  nav.appendChild(L.h("div", { class: "grupo-menu", text: "Controladoria" }));
  ORDEM.forEach(function (id) {
    var m = MENU[id];
    nav.appendChild(L.h("button", { class: "item-menu" + (L.paginaAtiva === id ? " ativo" : ""), type: "button",
      onclick: function () { L.fecharTitulo(); document.body.classList.remove("menu-aberto"); irPara(id); } },
      L.h("span", { html: L.ic(m.ic) }), L.h("span", { class: "im-tx" }, L.h("b", { text: m.rot }), L.h("small", { text: "Rotina " + m.n + " · em aberto e " + (id === "pagar" ? "pagos" : "recebidos") }))));
  });
  rodape();
}
function rodape() {
  var a = (L.ULTIMA_VERSAO || {}).agente || {}, lido = a.lido || {};
  L.$("menu-rodape").innerHTML =
    '<div><span class="vivo' + (a.vivo ? "" : " parado") + '"></span><b>' + (a.vivo ? "Ao vivo pelo AGENTE LUBE" : "Agente parado") + "</b></div>" +
    "<div>717 lida no WinThor às " + L.esc(L.fHora(lido.pagar)) + "</div>" +
    "<div>1240 lida no WinThor às " + L.esc(L.fHora(lido.receber)) + "</div>" +
    "<div>Pagos e recebidos desde 01/01/2011</div>" +
    '<div class="versao">versão ' + L.esc(window.VERSAO || "") + "</div>";
}

/* ------------------------------ a busca do topo: filtra a tela da rotina ------------------------------ */
function iniciarBusca() {
  var inp = L.$("busca-global");
  var aplicar = function () { var d = def(), q = inp.value.trim(); if (q === (d.F.q || "")) return; L.buscarNaRotina(d, q); };
  inp.addEventListener("input", L.debounce(aplicar, 450));
  inp.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") aplicar();
    if (ev.key === "Escape") { inp.value = ""; aplicar(); inp.blur(); }
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { ev.preventDefault(); inp.focus(); inp.select(); } });
}

/* ------------------------------ tema ------------------------------ */
function aplicarTema(t) {
  document.documentElement.setAttribute("data-tema", t);
  try { localStorage.setItem("cpr-tema", t); } catch (e) {}
  L.estado.tema = t;
  L.$("btn-tema").innerHTML = L.ic(t === "escuro" ? "sol" : "lua");
}

/* ------------------------------ ao vivo (AGENTE LUBE) ------------------------------ */
var AO_VIVO_MS = 15000, vivoOcupado = false;
function mostrarVivo() {
  var el = L.$("ao-vivo"); if (!el) return;
  var a = (L.ULTIMA_VERSAO || {}).agente || {}, vivo = !!a.vivo, lido = (a.lido || {})[L.paginaAtiva];
  el.classList.toggle("on", vivo);
  el.querySelector("b").textContent = vivo ? "Ao vivo · " + L.fHora(lido) : "Agente parado · " + L.fHora(lido);
  el.title = vivo
    ? "O AGENTE LUBE lê a rotina no WinThor de minuto em minuto (em aberto e pagos), e a tela muda sozinha. Última leitura às " + L.fHora(lido) + "."
    : "O agente do WinThor não está ligado: o painel mostra o que ele leu por último (" + L.fHora(lido) + ") e volta a mudar sozinho quando ele voltar.";
}
/* dado novo do agente: refaz a consulta da tela, no mesmo filtro, página e ordem */
L.aoMudarDados = function () {
  L.semAnimar = true;
  var algumPop = document.querySelector(".pop");
  if (!algumPop) L.recarregarRotina(def());
  else L.pendenteRecarregar = true;
  if (L.tituloAberto()) L.recarregarTitulo();
  mostrarVivo(); rodape();
  setTimeout(function () { L.semAnimar = false; }, 1500);
};
function receberVersao(v) {
  var antes = L.ULTIMA_VERSAO && L.ULTIMA_VERSAO.versao;
  L.ULTIMA_VERSAO = v;
  if (antes && v.versao && v.versao !== antes) { L.aoMudarDados(); return true; }
  if (L.pendenteRecarregar && !document.querySelector(".pop")) { L.pendenteRecarregar = false; L.recarregarRotina(def()); }
  mostrarVivo(); rodape();
  return false;
}
function cicloAoVivo() {
  if (vivoOcupado || document.hidden || L.$("btn-atualizar").classList.contains("girando")) return;
  vivoOcupado = true;
  L.versaoNoBanco().then(receberVersao).catch(function (e) {
    console.warn("Ao vivo: não consegui perguntar a versão", e);
    var el = L.$("ao-vivo"); if (el) { el.classList.remove("on"); el.querySelector("b").textContent = "Sem conexão"; }
  }).then(function () { vivoOcupado = false; });
}

/* ------------------------------ botão Atualizar: pede ao agente uma leitura agora ------------------------------ */
function atualizarDados() {
  var b = L.$("btn-atualizar");
  if (b.classList.contains("girando")) return;
  b.classList.add("girando");
  var fim = function () { b.classList.remove("girando"); }, t0 = performance.now();
  L.pedirAtualizacao().then(function (r) {
    if (!r || !r.agente) {
      return L.versaoNoBanco().then(function (v) {
        if (!receberVersao(v)) L.recarregarRotina(def());
        fim(); L.toast((r && r.mensagem ? r.mensagem + " " : "") + "O painel mostra a última leitura.", "erro");
      });
    }
    L.toast("Lendo o WinThor agora…", "ok");
    return L.esperarPedido(r.pedido, 45000).then(function (v) {
      if (!receberVersao(v)) { mostrarVivo(); rodape(); }
      fim();
      var p = v.pedido || {};
      L.toast(p.status === "atendido" ? "WinThor lido agora (" + L.fNum((performance.now() - t0) / 1000, 1) + " s): " + L.textoMudancas(p) + "."
        : p.status === "demorou" ? "O agente ainda está lendo o WinThor; a tela muda sozinha assim que terminar."
        : "O agente não conseguiu ler o WinThor agora" + (p.mensagem ? ": " + p.mensagem : "."), p.status === "atendido" ? "ok" : "erro");
    });
  }).catch(function (e) { fim(); L.toast("Não foi possível atualizar: " + (e.message || e), "erro"); });
}

/* ------------------------------ link direto para um título: #t=pagar:<lançamento> ou #t=receber:<transação>-<prest> ------------------------------ */
function tituloDoHash(h) {
  var m = /^#t=(pagar|receber):(.+)$/.exec(h || "");
  if (!m) return null;
  var k = decodeURIComponent(m[2]);
  if (m[1] === "pagar") return /^\d+$/.test(k) ? { rot: "pagar", t: { recnum: +k } } : null;
  var p = /^(-?\d+)-(.+)$/.exec(k);
  return p ? { rot: "receber", t: { numtransvenda: +p[1], prest: p[2] } } : null;
}

/* ------------------------------ início ------------------------------ */
function iniciar() {
  L.$("ic-busca").innerHTML = L.ic("busca");
  L.$("btn-menu").innerHTML = L.ic("menu");
  L.$("btn-atualizar").innerHTML = L.ic("relogio");
  aplicarTema(document.documentElement.getAttribute("data-tema") || "escuro");
  L.$("btn-tema").addEventListener("click", function () { aplicarTema(L.estado.tema === "escuro" ? "claro" : "escuro"); L.redesenharTudo(); });
  L.$("btn-menu").addEventListener("click", function () { document.body.classList.toggle("menu-aberto"); });
  L.$("btn-atualizar").addEventListener("click", atualizarDados);

  var cont = L.$("conteudo"), espera = L.espera("Abrindo as contas a pagar e a receber…");
  L.limpar(cont).appendChild(espera);
  Promise.all([L.api({ rot: "pagar", acao: "opcoes" }, "as filiais"), L.versaoNoBanco().catch(function () { return null; })]).then(function (r) {
    (r[0].filiais || []).forEach(function (f) { L.FILIAIS.set(String(f.id), { id: String(f.id), n: f.n, sub: f.sub }); });
    if (r[1]) L.ULTIMA_VERSAO = r[1];
    iniciarBusca();
    var h = location.hash || "", tt = tituloDoHash(h), salvo = null;
    try { salvo = localStorage.getItem("cpr-pagina"); } catch (e) {}
    var pag = tt ? tt.rot : /^#(pagar|receber)$/.test(h) ? h.slice(1) : salvo || "pagar";
    irPara(pag);
    if (tt) L.abrirTitulo(L.rotinas[tt.rot], tt.t);
    window.addEventListener("hashchange", function () {
      var hh = location.hash || "", t2 = tituloDoHash(hh);
      if (t2) { if (t2.rot !== L.paginaAtiva) irPara(t2.rot, true); if (!L.tituloAberto()) L.abrirTitulo(L.rotinas[t2.rot], t2.t); return; }
      if (/^#(pagar|receber)$/.test(hh)) { if (L.tituloAberto()) L.fecharTitulo(); if (hh.slice(1) !== L.paginaAtiva) irPara(hh.slice(1)); }
    });
    setInterval(cicloAoVivo, AO_VIVO_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) cicloAoVivo(); });
  }).catch(function (e) {
    console.error(e);
    L.limpar(cont).appendChild(L.erroTela("Não foi possível abrir o painel", (e && e.message) || String(e)));
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
