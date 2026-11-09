/* =============================================================================
 * grade.js — a tabela da tela, com os dados no banco (api/consulta), no jeito do Excel:
 *   · clicar no cabeçalho abre o filtro da coluna: ordenar, limpar, pesquisar escrevendo (o que bate com o texto já
 *     vem marcado, "Selecionar todos os resultados da pesquisa"), marcar e desmarcar à mão, "Adicionar seleção
 *     atual ao filtro" e, em número e data, uma faixa de/até; a lista de valores vem do banco, já filtrada pelas
 *     outras colunas, com a quantidade de títulos de cada valor (pedido do Júlio, 2026-11-09: "assim como no excel,
 *     clico pra filtrar escrevendo e marcando, auto seleção para aquele que escrever e quando for marcar manualmente");
 *   · botão Colunas (as importantes de saída, o resto à mão; guardado neste navegador), páginas, Exportar Excel
 *     (todas as linhas do filtro, só as colunas visíveis, com os filtros escritos e os totais).
 * Filtro de coluna (cf[coluna]) = lista de condições em OU: {m:"em",v}, {m:"fora",v}, {m:"contem",t,fora}, {m:"faixa",de,ate}.
 * ========================================================================== */
(function () {
"use strict";
var L = window.L;

var FMT = {
  moeda: function (v) { return v == null ? "" : L.fBRL(Number(v), 2); },
  inteiro: function (v) { return v == null ? "" : L.fInt(Number(v)); },
  dias: function (v) { return v == null ? "" : L.fInt(Number(v)); },
  codigo: function (v) { return v == null ? "" : String(v); },
  data: function (v) { return v ? L.fData(String(v)) : ""; },
  texto: function (v) { return v == null ? "" : String(v); },
};
var EXPORT = { moeda: "moeda", inteiro: "inteiro", dias: "inteiro", codigo: "codigo", data: "data", texto: "texto", status: "texto" };
var DIREITA = { moeda: 1, inteiro: 1, dias: 1 };
var NUMERO = { moeda: 1, inteiro: 1, dias: 1, codigo: 1 };

/* número escrito em pt-BR ("1.234,56", "-10") -> "1234.56" para o banco; vazio -> null */
function numBR(s) {
  s = String(s || "").trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? s : undefined;
}
L.numBR = numBR;

/* ------------------------------ popover único (filtro ou colunas) ------------------------------ */
var popAtual = null;
function fecharPop() { if (popAtual) { var p = popAtual; popAtual = null; p.remove(); if (p._fechou) p._fechou(); } }
L.fecharPopover = fecharPop;
document.addEventListener("mousedown", function (ev) { if (popAtual && !popAtual.contains(ev.target) && !(popAtual._ancora && popAtual._ancora.contains(ev.target))) fecharPop(); });
document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && popAtual) { ev.stopPropagation(); fecharPop(); } }, true);
window.addEventListener("resize", fecharPop);
/* abre colado no botão (ou no cabeçalho da coluna): embaixo dele, ou em cima se não couber; o lado e a altura ficam
   fixos enquanto estiver aberto */
function posicionar(pop, ancora, larg) {
  var r = ancora.getBoundingClientRect(), w = Math.min(larg, innerWidth - 16);
  pop.style.width = w + "px";
  var topo = r.bottom + 4, alt = innerHeight - topo - 10;
  if (alt < 320 && r.top > innerHeight / 2) { pop._cima = true; pop.style.maxHeight = (r.top - 14) + "px"; }
  else { pop._cima = false; pop.style.maxHeight = Math.max(260, alt) + "px"; }
  seguir(pop);
}
/* preso ao que abriu (Júlio, 2026-11-09: "precisa ficar presa no filtro e não descer junto com a tela"): rolou a
   página ou a tabela, o filtro vai junto com o cabeçalho; o cabeçalho sumiu da tela (outra tela, tabela redesenhada), fecha */
function seguir(pop) {
  var a = pop._ancora;
  if (!a || !a.isConnected) { if (pop === popAtual) fecharPop(); return; }
  var r = a.getBoundingClientRect(), w = pop.offsetWidth || parseFloat(pop.style.width) || 320;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, pop._direita ? r.right - w : r.left)) + "px";
  if (pop._cima) { pop.style.top = ""; pop.style.bottom = (innerHeight - r.top + 4) + "px"; }
  else { pop.style.bottom = ""; pop.style.top = (r.bottom + 4) + "px"; }
}
window.addEventListener("scroll", function (ev) {
  // a rolagem da própria lista do filtro não mexe nele; o navegador já manda no máximo um evento por quadro
  if (!popAtual || (ev.target instanceof Node && popAtual.contains(ev.target))) return;
  seguir(popAtual);
}, true);
L.posicionarPop = posicionar;
/* opc.direita: alinha pela borda direita do botão (o botão Colunas fica no canto) */
L.abrirPop = function (pop, ancora, larg, opc) {
  fecharPop(); pop._ancora = ancora; pop._direita = !!(opc && opc.direita);
  document.body.appendChild(pop); posicionar(pop, ancora, larg || 320); popAtual = pop; return pop;
};

/* ------------------------------ descrição de um filtro de coluna (pílula e Excel) ------------------------------ */
L.descreverFiltro = function (col, conds) {
  var partes = (conds || []).map(function (cl) {
    var rot = function (v, i) {
      if (v == null) return "(Vazias)";
      var r = cl.r && cl.r[i] != null ? cl.r[i] : null;
      if (col.rotuloValor) return col.rotuloValor(v, r);
      if (col.tipo === "data") return L.fData(v);
      if (col.tipo === "moeda") return L.fBRL(Number(v));
      return r != null ? r : v;
    };
    if (cl.m === "em") return cl.v.length <= 3 ? cl.v.map(rot).join(", ") : L.fInt(cl.v.length) + " marcados";
    if (cl.m === "fora") return "todos menos " + (cl.v.length <= 2 ? cl.v.map(rot).join(", ") : L.fInt(cl.v.length));
    if (cl.m === "contem") return "contém “" + cl.t + "”" + (cl.fora && cl.fora.length ? " (menos " + L.fInt(cl.fora.length) + ")" : "");
    if (cl.m === "faixa") {
      var f = function (x) { return col.tipo === "data" ? L.fData(x) : col.tipo === "moeda" ? L.fBRL(Number(x)) : L.fNum(Number(x), x.indexOf(".") >= 0 ? 2 : 0); };
      return cl.de != null && cl.ate != null ? "de " + f(cl.de) + " a " + f(cl.ate) : cl.de != null ? "a partir de " + f(cl.de) : "até " + f(cl.ate);
    }
    return "";
  });
  return partes.join(" ou ");
};

/* o valor (texto, como o banco devolve) está dentro deste filtro? — para marcar a lista ao abrir */
function dentro(conds, v, r, col) {
  if (!conds || !conds.length) return true;
  return conds.some(function (cl) {
    if (cl.m === "em") return cl.v.indexOf(v) >= 0;
    if (cl.m === "fora") return cl.v.indexOf(v) < 0;
    if (cl.m === "contem") return String(r == null ? "" : r).toLowerCase().indexOf(String(cl.t).toLowerCase()) >= 0 && (cl.fora || []).indexOf(v) < 0;
    if (cl.m === "faixa") {
      if (v == null) return false;
      if (col.tipo === "data") return (cl.de == null || v >= cl.de) && (cl.ate == null || v <= cl.ate);
      var n = Number(v); return (cl.de == null || n >= Number(cl.de)) && (cl.ate == null || n <= Number(cl.ate));
    }
    return true;
  });
}

/* =============================================================================
 * L.gradeBanco(cfg)
 *   cfg.rot, cfg.arquivo, cfg.colunas [{ id, titulo, tipo, padrao, filtro, ord, campos, valor(r), mostrar(r), classe(r),
 *          dica, rotuloValor(v) }], cfg.params() (status, período, busca, mostrar), cfg.cf (objeto compartilhado),
 *   cfg.ordem {id, desc}, cfg.aoCarregar(tot, resposta), cfg.aoMudarFiltro(), cfg.aoClicar(linha),
 *   cfg.excel() -> { titulo, subtitulo, filtros: [[rot, txt]], resumo: [[rot, num, tipo]], rodape }
 * ========================================================================== */
L.gradeBanco = function (cfg) {
  var cols = cfg.colunas, cf = cfg.cf;
  var est = { pag: 0, porPag: 50, ord: cfg.ordem || { id: cols[0].id, desc: false } };
  var chaveCols = "cpr-cols2-" + cfg.rot, colsSel = null;
  try { colsSel = JSON.parse(localStorage.getItem(chaveCols) || "null"); } catch (e) {}
  try { var pp = +localStorage.getItem("cpr-porpag"); if ([25, 50, 100, 200, 500].indexOf(pp) >= 0) est.porPag = pp; } catch (e) {}
  var raiz = L.h("div", { class: "grade-banco" }), barra = L.h("div", { class: "tb-topo" }), wrap = L.h("div", { class: "tb-wrap" }), pe = L.h("div", { class: "tb-pe" });
  raiz.appendChild(barra); raiz.appendChild(wrap); raiz.appendChild(pe);
  var linhas = [], tot = null, tok = 0, carregando = false, erro = null;

  function visivel(c) { return colsSel && colsSel[c.id] != null ? !!colsSel[c.id] : c.padrao !== false; }
  function visiveis() { return cols.filter(visivel); }
  function salvarCols() { try { if (colsSel) localStorage.setItem(chaveCols, JSON.stringify(colsSel)); else localStorage.removeItem(chaveCols); } catch (e) {} }
  function params() { return Object.assign({ rot: cfg.rot, cf: cf }, cfg.params()); }

  /* ---------------- buscar no banco ---------------- */
  function buscar(comTotais) {
    var meu = ++tok;
    carregando = true; erro = null; raiz.classList.add("carregando");
    var lento = setTimeout(function () { if (meu === tok) raiz.classList.add("demorando"); }, 900);
    var p = Object.assign(params(), { acao: "lista", ordem: est.ord.id, desc: !!est.ord.desc, offset: est.pag * est.porPag, limite: est.porPag, sem_totais: !comTotais && !!tot });
    return L.api(p).then(function (j) {
      if (meu !== tok) return;
      if (j.tot) tot = j.tot;
      linhas = j.linhas || [];
      if (!linhas.length && est.pag > 0 && tot && est.pag * est.porPag >= tot.n) { est.pag = Math.max(0, Math.ceil(tot.n / est.porPag) - 1); return buscar(false); }
      desenhar();
      if (cfg.aoCarregar) cfg.aoCarregar(tot, j);
    }).catch(function (e) {
      if (meu !== tok) return;
      erro = e; desenhar();
    }).then(function () { if (meu === tok) { clearTimeout(lento); carregando = false; raiz.classList.remove("carregando", "demorando"); } });
  }

  /* ---------------- desenhar ---------------- */
  function desenharBarra() {
    L.limpar(barra);
    if (cfg.extraTopo) L.add(barra, cfg.extraTopo());
    barra.appendChild(L.h("span", { style: { flex: 1 } }));
    var nv = visiveis().length;
    barra.appendChild(L.h("span", { class: "tb-ncols", text: nv + " de " + cols.length + " colunas" }));
    barra.appendChild(L.h("button", { class: "mini-btn" + (colsSel ? " ativo" : ""), type: "button", html: L.ic("tabela") + " Colunas", title: "Escolher as colunas que aparecem", onclick: function (ev) { abrirColunas(ev.currentTarget); } }));
    barra.appendChild(L.h("button", { class: "btn pri btn-excel", type: "button", html: L.ic("baixar") + " Exportar Excel", title: "Baixa em Excel todas as linhas do filtro, com as colunas visíveis, os filtros escritos e os totais", onclick: function (ev) { exportar(ev.currentTarget); } }));
  }
  function alinhaDir(c) { return !!DIREITA[c.tipo]; }
  function desenhar() {
    desenharBarra();
    L.limpar(wrap);
    var vis = visiveis();
    var tab = L.h("table", { class: "tabela tabela-excel" }), tr = L.h("tr");
    vis.forEach(function (c) {
      var ativo = cf[c.id] && cf[c.id].length, ordAqui = est.ord.id === c.id;
      var th = L.h("th", { class: (alinhaDir(c) ? "d " : "") + (c.filtro === false ? "" : "fl ") + (ativo ? "filtrado" : ""), title: c.dica || (c.filtro === false ? "" : "Clique para filtrar ou ordenar") });
      var dentroTh = L.h("span", { class: "th-in" }, L.h("span", { class: "th-tx", text: c.titulo }));
      if (ordAqui) dentroTh.appendChild(L.h("span", { class: "seta", text: est.ord.desc ? "▼" : "▲" }));
      if (c.filtro !== false) dentroTh.appendChild(L.h("span", { class: "th-fl", html: L.ic(ativo ? "filtro" : "baixo") }));
      th.appendChild(dentroTh);
      if (c.filtro !== false) th.addEventListener("click", function () { abrirFiltro(c, th); });
      tr.appendChild(th);
    });
    tab.appendChild(L.h("thead", null, tr));
    var tb = L.h("tbody");
    if (erro) {
      tb.appendChild(L.h("tr", null, L.h("td", { colspan: vis.length, class: "vazio-td", html: "<b>Não foi possível carregar</b>" + L.esc(erro.message || erro) })));
    } else if (!linhas.length && !carregando) {
      tb.appendChild(L.h("tr", null, L.h("td", { colspan: vis.length, class: "vazio-td", html: "<b>Nenhum título com estes filtros</b>Mude o status, o período ou tire um filtro de coluna." })));
    }
    linhas.forEach(function (r) {
      var lin = L.h("tr", { class: "click " + (cfg.classeLinha ? cfg.classeLinha(r) || "" : "") });
      vis.forEach(function (c) {
        var v = c.valor(r), td = L.h("td", { class: (alinhaDir(c) ? "d" : "") + (c.classe ? " " + (c.classe(v, r) || "") : "") });
        var txt = c.mostrar ? c.mostrar(v, r) : (FMT[c.tipo] || FMT.texto)(v);
        if (txt && typeof txt === "object" && txt.html != null) td.innerHTML = txt.html; else td.textContent = txt;
        if (c.tipo === "moeda" && Number(v) < 0) td.classList.add("neg");
        if (typeof txt === "string" && txt.length > 24) td.title = txt;
        lin.appendChild(td);
      });
      if (cfg.aoClicar) lin.addEventListener("click", function () { cfg.aoClicar(r); });
      tb.appendChild(lin);
    });
    tab.appendChild(tb);
    wrap.appendChild(tab);
    rodape();
  }
  function rodape() {
    L.limpar(pe);
    var n = tot ? tot.n : 0, off = est.pag * est.porPag, nPag = Math.max(1, Math.ceil(n / est.porPag));
    pe.appendChild(L.h("span", { text: n ? (off + 1) + "–" + Math.min(n, off + est.porPag) + " de " + L.fInt(n) + " título" + (n === 1 ? "" : "s") : "0 títulos" }));
    var pg = L.h("div", { class: "pg" });
    if (nPag > 1) {
      pg.appendChild(L.h("button", { class: "mini-btn", text: "«", title: "Primeira página", disabled: est.pag === 0, onclick: function () { est.pag = 0; buscar(false); } }));
      pg.appendChild(L.h("button", { class: "mini-btn", text: "‹", title: "Página anterior", disabled: est.pag === 0, onclick: function () { est.pag--; buscar(false); } }));
      pg.appendChild(L.h("span", { class: "mono", text: L.fInt(est.pag + 1) + " / " + L.fInt(nPag) }));
      pg.appendChild(L.h("button", { class: "mini-btn", text: "›", title: "Próxima página", disabled: est.pag >= nPag - 1, onclick: function () { est.pag++; buscar(false); } }));
      pg.appendChild(L.h("button", { class: "mini-btn", text: "»", title: "Última página", disabled: est.pag >= nPag - 1, onclick: function () { est.pag = nPag - 1; buscar(false); } }));
    }
    var sel = L.h("select", { title: "Linhas por página", onchange: function () { est.porPag = +sel.value; est.pag = 0; try { localStorage.setItem("cpr-porpag", sel.value); } catch (e) {} buscar(false); } });
    [25, 50, 100, 200, 500].forEach(function (o) { var op = L.h("option", { value: o, text: o + " linhas" }); if (o === est.porPag) op.selected = true; sel.appendChild(op); });
    pg.appendChild(sel);
    pe.appendChild(pg);
  }

  /* ---------------- o filtro da coluna, no jeito do Excel ---------------- */
  function abrirFiltro(c, th) {
    var atual = cf[c.id] || null, ehNum = !!NUMERO[c.tipo] && c.tipo !== "codigo", ehData = c.tipo === "data";
    var pop = L.h("div", { class: "pop pop-filtro" });
    var est2 = { vals: [], mais: false, marc: new Map(), busca: "", adicionar: false, mexeu: false, tok: 0, carregando: true };
    var txAsc = ehData ? "Do mais antigo para o mais novo" : ehNum || c.tipo === "codigo" ? "Do menor para o maior" : "De A a Z";
    var txDesc = ehData ? "Do mais novo para o mais antigo" : ehNum || c.tipo === "codigo" ? "Do maior para o menor" : "De Z a A";
    function ordenar(desc) { est.ord = { id: c.id, desc: desc }; est.pag = 0; fecharPop(); buscar(false); }
    var ordAqui = est.ord.id === c.id;
    pop.appendChild(L.h("div", { class: "pf-cab" }, L.h("b", { text: c.titulo }), c.dica ? L.h("small", { text: c.dica }) : null));
    pop.appendChild(L.h("div", { class: "pf-acoes" },
      L.h("button", { type: "button", class: "pf-acao" + (ordAqui && !est.ord.desc ? " on" : ""), onclick: function () { ordenar(false); } }, L.icEl("setaCima"), L.h("span", { text: "Classificar: " + txAsc })),
      L.h("button", { type: "button", class: "pf-acao" + (ordAqui && est.ord.desc ? " on" : ""), onclick: function () { ordenar(true); } }, L.icEl("setaBaixo"), L.h("span", { text: "Classificar: " + txDesc })),
      L.h("button", { type: "button", class: "pf-acao", disabled: !atual, onclick: function () { delete cf[c.id]; fecharPop(); mudouFiltro(); } }, L.icEl("x"), L.h("span", { text: "Limpar filtro de “" + c.titulo + "”" }))));

    // faixa de/até (número e data)
    if (ehNum || ehData) {
      var fx = (atual || []).filter(function (x) { return x.m === "faixa"; })[0] || {};
      var mostra = function (x) { return x == null ? "" : ehData ? x : String(x).replace(".", ","); };
      var de = L.h("input", { type: ehData ? "date" : "text", inputmode: ehData ? null : "decimal", placeholder: ehData ? "" : "de", value: mostra(fx.de) });
      var ate = L.h("input", { type: ehData ? "date" : "text", inputmode: ehData ? null : "decimal", placeholder: ehData ? "" : "até", value: mostra(fx.ate) });
      var aplicaFaixa = function () {
        var a = ehData ? de.value || null : numBR(de.value), b = ehData ? ate.value || null : numBR(ate.value);
        if (a === undefined || b === undefined) { L.toast("Escreva o número assim: 1.234,56", "erro"); return; }
        if (a == null && b == null) { delete cf[c.id]; } else cf[c.id] = [{ m: "faixa", de: a, ate: b }];
        fecharPop(); mudouFiltro();
      };
      [de, ate].forEach(function (i) { i.addEventListener("keydown", function (ev) { if (ev.key === "Enter") aplicaFaixa(); }); });
      pop.appendChild(L.h("div", { class: "pf-faixa" },
        L.h("label", { text: ehData ? "Entre as datas" : "Entre os valores" }),
        L.h("div", { class: "pf-faixa-l" }, de, L.h("span", { text: "a" }), ate,
          L.h("button", { type: "button", class: "mini-btn", text: "Filtrar", onclick: aplicaFaixa }))));
    }

    // pesquisa + lista
    var inp = L.h("input", { type: "search", placeholder: "Pesquisar", autocomplete: "off", spellcheck: "false" });
    pop.appendChild(L.h("div", { class: "pop-topo" }, L.h("span", { class: "pf-lupa", html: L.ic("busca") }), inp));
    var lista = L.h("div", { class: "pop-lista pf-lista" });
    pop.appendChild(lista);
    var info = L.h("span", { class: "pf-info" });
    var btOk = L.h("button", { type: "button", class: "btn pri pf-ok", text: "OK", onclick: aplicar });
    pop.appendChild(L.h("div", { class: "pop-rodape" }, info, L.h("span", { class: "pop-acoes" },
      btOk, L.h("button", { type: "button", class: "btn pf-cancelar", text: "Cancelar", onclick: fecharPop }))));

    var itens = [], itTodos = null, itAdd = null;
    function rotulo(x) {
      if (x.v == null) return "(Vazias)";
      if (c.rotuloValor) return c.rotuloValor(x.v, x.r);
      if (c.tipo === "moeda") return L.fBRL(Number(x.v));
      return x.r == null ? String(x.v) : String(x.r);
    }
    function marcarVisual() {
      var n = 0; est2.vals.forEach(function (x) { if (est2.marc.get(x.v)) n++; });
      itens.forEach(function (it) { it.el.classList.toggle("on", !!est2.marc.get(it.x.v)); });
      if (itTodos) { itTodos.classList.toggle("on", n === est2.vals.length && n > 0); itTodos.classList.toggle("meio", n > 0 && n < est2.vals.length); }
      if (itAdd) itAdd.classList.toggle("on", est2.adicionar);
      btOk.disabled = !n && !(est2.busca === "" && !est2.vals.length);
      info.textContent = est2.carregando ? "" : (n === est2.vals.length ? "Todos" : L.fInt(n) + " de " + L.fInt(est2.vals.length)) + (est2.mais ? " (primeiros " + L.fInt(est2.vals.length) + ")" : "");
    }
    function item(texto, cls, fn, n) {
      var el = L.h("button", { type: "button", class: "pop-item " + (cls || ""), onclick: fn },
        L.h("span", { class: "cx" }), L.h("span", { class: "tx pf-tx", title: texto, html: est2.busca ? L.destacar(texto, [L.norm(est2.busca)]) : L.esc(texto) }),
        n != null ? L.h("span", { class: "cn", text: L.fInt(n) }) : null);
      return el;
    }
    function desenharLista() {
      L.limpar(lista); itens = []; itTodos = itAdd = null;
      if (est2.carregando) { lista.appendChild(L.h("div", { class: "pop-vazio pf-carregando", html: '<i class="giro"></i> Procurando os valores…' })); marcarVisual(); return; }
      if (est2.erro) { lista.appendChild(L.h("div", { class: "pop-vazio", text: est2.erro })); marcarVisual(); return; }
      if (!est2.vals.length) { lista.appendChild(L.h("div", { class: "pop-vazio", text: est2.busca ? "Nada com “" + est2.busca + "”" : "Sem valores com os outros filtros" })); marcarVisual(); return; }
      itTodos = item(est2.busca ? "(Selecionar todos os resultados da pesquisa)" : "(Selecionar tudo)", "pf-todos", function () {
        var todos = est2.vals.every(function (x) { return est2.marc.get(x.v); });
        est2.vals.forEach(function (x) { est2.marc.set(x.v, !todos); }); est2.mexeu = true; marcarVisual();
      });
      lista.appendChild(itTodos);
      if (est2.busca && atual) {
        itAdd = item("Adicionar seleção atual ao filtro", "pf-add", function () { est2.adicionar = !est2.adicionar; marcarVisual(); });
        lista.appendChild(itAdd);
      }
      est2.vals.forEach(function (x) {
        var el = item(rotulo(x), "", function () { est2.marc.set(x.v, !est2.marc.get(x.v)); est2.mexeu = true; marcarVisual(); }, x.n);
        itens.push({ el: el, x: x }); lista.appendChild(el);
      });
      if (est2.mais) lista.appendChild(L.h("div", { class: "pf-mais", text: "Mostrando os primeiros " + L.fInt(est2.vals.length) + " valores. Escreva na pesquisa para achar os outros." }));
      marcarVisual();
    }
    function carregar() {
      var meu = ++est2.tok; est2.carregando = true; est2.erro = null; desenharLista();
      L.api(Object.assign(params(), { acao: "valores", col: c.id, busca: est2.busca, limite: 500 }), "os valores da coluna").then(function (j) {
        if (meu !== est2.tok) return;
        var vs = j.valores || {}; est2.vals = vs.vals || []; est2.mais = !!vs.mais; est2.carregando = false;
        est2.marc = new Map();
        est2.vals.forEach(function (x) { est2.marc.set(x.v, est2.busca ? true : dentro(atual, x.v, x.r, c)); });
        est2.mexeu = !!est2.busca;
        desenharLista();
      }).catch(function (e) { if (meu !== est2.tok) return; est2.carregando = false; est2.erro = e.message || String(e); desenharLista(); });
    }
    function aplicar() {
      if (est2.carregando) return;
      if (!est2.mexeu) { fecharPop(); return; }
      var marc = [], desm = [], marcR = [], desmR = [];
      est2.vals.forEach(function (x) { if (est2.marc.get(x.v)) { marc.push(x.v); marcR.push(x.r); } else { desm.push(x.v); desmR.push(x.r); } });
      if (!marc.length) return;
      var EM = { m: "em", v: marc, r: marcR }, FORA = { m: "fora", v: desm, r: desmR };   // r: só para escrever a pílula
      var novas;
      if (est2.busca) {
        // escrevendo: o que contém o texto (todos, mesmo os que não couberam na lista), menos o que foi desmarcado;
        // se sobrou pouco marcado, vale a lista do que foi marcado
        var cl = marc.length < desm.length ? EM : { m: "contem", t: est2.busca, fora: desm };
        novas = est2.adicionar && atual ? atual.concat([cl]) : [cl];
      } else if (!desm.length && !est2.mais) {
        novas = null;                                   // tudo marcado = sem filtro
      } else if (est2.mais) {
        novas = [marc.length < desm.length ? EM : FORA];
      } else {
        novas = [marc.length <= desm.length ? EM : FORA];
      }
      if (novas) cf[c.id] = novas; else delete cf[c.id];
      fecharPop(); mudouFiltro();
    }
    inp.addEventListener("input", L.debounce(function () { est2.busca = inp.value.trim(); est2.adicionar = false; carregar(); }, 260));
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); if (!est2.carregando) aplicar(); } });
    L.abrirPop(pop, th, 380);
    carregar();
    setTimeout(function () { inp.focus(); }, 0);
  }
  function mudouFiltro() { est.pag = 0; if (cfg.aoMudarFiltro) cfg.aoMudarFiltro(); buscar(true); }

  /* ---------------- colunas ---------------- */
  function abrirColunas(ancora) {
    var pop = L.h("div", { class: "pop pop-cols" }), lista = L.h("div", { class: "pop-lista" });
    var inp = L.h("input", { type: "search", placeholder: "Procurar coluna…", autocomplete: "off" });
    function marcar() {
      L.limpar(lista);
      var q = L.norm(inp.value).split(/\s+/).filter(Boolean);
      cols.forEach(function (c) {
        if (q.length && !q.every(function (x) { return L.norm(c.titulo + " " + (c.dica || "")).indexOf(x) >= 0; })) return;
        var on = visivel(c);
        lista.appendChild(L.h("button", { class: "pop-item" + (on ? " on" : ""), type: "button", title: c.dica || "", onclick: function () {
          colsSel = colsSel || {}; cols.forEach(function (x) { if (colsSel[x.id] == null) colsSel[x.id] = visivel(x); });
          colsSel[c.id] = !on; salvarCols(); marcar(); desenhar();
        } }, L.h("span", { class: "cx" }), L.h("span", { class: "tx", text: c.titulo }), c.padrao === false ? L.h("span", { class: "cn", text: "extra" }) : null));
      });
    }
    inp.addEventListener("input", marcar);
    marcar();
    pop.appendChild(L.h("div", { class: "pop-topo" }, inp));
    pop.appendChild(lista);
    pop.appendChild(L.h("div", { class: "pop-rodape" },
      L.h("span", { text: cols.length + " colunas" }),
      L.h("span", { class: "pop-acoes" },
        L.h("button", { class: "mini-btn", type: "button", text: "Só as importantes", onclick: function () { colsSel = null; salvarCols(); marcar(); desenhar(); } }),
        L.h("button", { class: "mini-btn", type: "button", text: "Todas", onclick: function () { colsSel = {}; cols.forEach(function (x) { colsSel[x.id] = true; }); salvarCols(); marcar(); desenhar(); } }))));
    L.abrirPop(pop, ancora, 320, { direita: true });
    setTimeout(function () { inp.focus(); }, 0);
  }

  /* ---------------- Excel: todas as linhas do filtro, em lotes, só as colunas visíveis ---------------- */
  var LOTE = 10000, MAX_EXCEL = 300000;
  function exportar(btn) {
    var n = tot ? tot.n : 0;
    if (!n) { L.toast("Nada para exportar com estes filtros.", "erro"); return; }
    if (n > MAX_EXCEL) { L.toast("São " + L.fInt(n) + " títulos: filtre até " + L.fInt(MAX_EXCEL) + " para exportar (por exemplo, por período).", "erro"); return; }
    if (btn.classList.contains("girando")) return;
    btn.classList.add("girando");
    var vis = visiveis(), campos = [];
    vis.forEach(function (c) { (c.campos || [c.id]).forEach(function (k) { if (campos.indexOf(k) < 0) campos.push(k); }); });
    var todas = [], base = Object.assign(params(), { acao: "lista", sem_totais: true, ordem: est.ord.id, desc: !!est.ord.desc, campos: campos, limite: LOTE });
    if (n > LOTE) L.toast("Preparando " + L.fInt(n) + " linhas para o Excel…", "ok");
    function lote(off) {
      return L.api(Object.assign({}, base, { offset: off }), "as linhas para o Excel").then(function (j) {
        (j.linhas || []).forEach(function (a) { var o = {}; campos.forEach(function (k, i) { o[k] = a[i]; }); todas.push(o); });
        if ((j.linhas || []).length === LOTE && todas.length < n) return lote(off + LOTE);
      });
    }
    lote(0).then(function () {
      var x = cfg.excel ? cfg.excel(tot) : {};
      var filtros = (x.filtros || []).slice();
      vis.forEach(function (c) { if (cf[c.id] && cf[c.id].length) filtros.push(["Coluna " + c.titulo, L.descreverFiltro(c, cf[c.id])]); });
      cols.forEach(function (c) { if (!visivel(c) && cf[c.id] && cf[c.id].length) filtros.push(["Coluna " + c.titulo + " (oculta)", L.descreverFiltro(c, cf[c.id])]); });
      return Planilha.baixar({
        arquivo: cfg.arquivo + "-" + L.isoHoje() + ".xlsx",
        titulo: x.titulo || cfg.arquivo, subtitulo: x.subtitulo || "", aba: x.aba || "Títulos",
        filtros: filtros, resumo: x.resumo || [],
        colunas: vis.map(function (c) {
          var tipo = EXPORT[c.tipo] || "texto";
          return { titulo: c.tituloExp || c.titulo, tipo: tipo, somar: c.tipo === "moeda",
                   valor: function (r) { var v = c.exp ? c.exp(r) : c.valor(r); if (v == null) return null; return tipo === "moeda" || tipo === "inteiro" ? Number(v) : tipo === "data" ? String(v).slice(0, 10) : v; } };
        }),
        linhas: todas,
        rodape: x.rodape || "",
      }).then(function () { L.toast("Excel gerado: " + L.fInt(todas.length) + " linhas, " + vis.length + " colunas", "ok"); });
    }).catch(function (e) { L.toast("Não foi possível gerar o Excel: " + (e.message || e), "erro"); })
      .then(function () { btn.classList.remove("girando"); });
  }

  raiz.recarregar = function (zerar) { if (zerar) est.pag = 0; return buscar(true); };
  raiz.redesenhar = desenhar;
  raiz.estado = est;
  raiz.totais = function () { return tot; };
  desenharBarra();
  return raiz;
};

})();
