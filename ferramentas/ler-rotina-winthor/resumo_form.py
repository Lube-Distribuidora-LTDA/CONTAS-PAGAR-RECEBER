"""Resume um formulario do despejo do dfm.py: abas, grades (colunas com titulo e campo), caixas de marcar,
grupos de opcoes, campos de filtro e consultas SQL. Uso: python resumo_form.py dfm.txt NomeDoForm [saida]"""
import re
import sys

linhas = open(sys.argv[1], encoding="utf-8").read().splitlines()
alvo = sys.argv[2]
ini = next(i for i, l in enumerate(linhas) if l.startswith(alvo + ":"))
fim = next((i for i in range(ini + 1, len(linhas)) if re.match(r"^\S", linhas[i])), len(linhas))
bloco = linhas[ini:fim]

objs = []  # (nivel, nome, classe, props{}, listas{})
for l in bloco:
    m = re.match(r"^( *)(\w+): (\w+)$", l)
    if m:
        objs.append({"n": len(m.group(1)) // 2, "nome": m.group(2), "cls": m.group(3), "p": {}, "lst": {}, "_k": None})
        continue
    m = re.match(r"^ *\.([\w.]+) = (.*)$", l)
    if m and objs:
        objs[-1]["p"][m.group(1)] = m.group(2)
        objs[-1]["_k"] = None
        continue
    m = re.match(r"^ *\.([\w.]+) =$", l)
    if m and objs:
        objs[-1]["_k"] = m.group(1)
        objs[-1]["lst"][m.group(1)] = []
        continue
    m = re.match(r"^ *\| (.*)$", l)
    if m and objs and objs[-1]["_k"]:
        objs[-1]["lst"][objs[-1]["_k"]].append(m.group(1))
        continue
    m = re.match(r"^ *\[(\d+)\] (.*)$", l)
    if m and objs:
        objs[-1]["lst"].setdefault("_colecao", []).append(m.group(2))

out = []
def cap(o):
    return o["p"].get("Caption", "").strip("'")

pilha = []
for o in objs:
    while pilha and pilha[-1]["n"] >= o["n"]:
        pilha.pop()
    caminho = " > ".join(cap(p) or p["nome"] for p in pilha if p["cls"] in ("TcxTabSheet", "TTabSheet", "TcxGroupBox", "TGroupBox", "TPageControl", "TcxPageControl"))
    pilha.append(o)
    c = o["cls"]
    if c in ("TcxTabSheet", "TTabSheet"):
        out.append(f"\nABA  '{cap(o)}'  ({o['nome']})  vis={o['p'].get('TabVisible', 'True')}  [{caminho}]")
    elif c in ("TcxGridDBTableView", "TcxGridDBBandedTableView", "TcxGridTableView"):
        out.append(f"\n  GRADE {o['nome']} (dados: {o['p'].get('DataController.DataSource', '?')})  [{caminho}]")
        for x in o["lst"].get("_colecao", []):
            out.append(f"      total: {x}")
    elif c in ("TcxGridDBColumn", "TcxGridDBBandedColumn", "TcxGridColumn"):
        out.append(f"     col {o['nome'].split('View1')[-1]:<28} | {cap(o):<34} | {o['p'].get('DataBinding.FieldName', '').strip(chr(39)):<24} | vis={o['p'].get('Visible', 'True'):<5} | larg={o['p'].get('Width', '')} | {o['p'].get('PropertiesClassName', '').strip(chr(39))} {o['p'].get('Properties.DisplayFormat', '')}")
    elif c in ("TCheckBox", "TcxCheckBox", "TRadioButton", "TcxRadioButton"):
        out.append(f"  [x] {o['nome']}: '{cap(o) or o['p'].get('Properties.Caption', '')}' marcado={o['p'].get('Checked', o['p'].get('State', ''))}  [{caminho}]")
    elif c in ("TRadioGroup", "TcxRadioGroup"):
        itens = o["lst"].get("Items.Strings") or o["lst"].get("_colecao") or []
        out.append(f"  (o) {o['nome']}: '{cap(o)}' itens={itens} indice={o['p'].get('ItemIndex', '')}  [{caminho}]")
    elif c in ("TOraQuery", "TQuery", "TOraSQL", "TSQLQuery", "TClientDataSet"):
        sql = o["lst"].get("SQL.Strings")
        if sql:
            out.append(f"\n  SQL {o['nome']} ({c}):")
            out.extend("      " + s for s in sql)
    elif c in ("TLabel", "TcxLabel") and cap(o):
        out.append(f"  rotulo: '{cap(o)}'  [{caminho}]")

txt = "\n".join(out)
if len(sys.argv) > 3:
    open(sys.argv[3], "w", encoding="utf-8").write(txt)
    print(len(out), "linhas em", sys.argv[3])
else:
    print(txt)
