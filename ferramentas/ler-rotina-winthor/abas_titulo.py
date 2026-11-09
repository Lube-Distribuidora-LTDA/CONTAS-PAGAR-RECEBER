"""Para cada aba do formulario, lista rotulos (Caption) e campos ligados (DataField/DataBinding) na ordem visual (Top, Left)."""
import re
import sys

linhas = open(sys.argv[1], encoding="utf-8").read().splitlines()
alvo = sys.argv[2]
ini = next(i for i, l in enumerate(linhas) if l.startswith(alvo + ":"))
fim = next((i for i in range(ini + 1, len(linhas)) if re.match(r"^\S", linhas[i])), len(linhas))
objs = []
for l in linhas[ini:fim]:
    m = re.match(r"^( *)(\w+): (\w+)$", l)
    if m:
        objs.append({"n": len(m.group(1)) // 2, "nome": m.group(2), "cls": m.group(3), "p": {}})
        continue
    m = re.match(r"^ *\.([\w.]+) = (.*)$", l)
    if m and objs:
        objs[-1]["p"][m.group(1)] = m.group(2).strip("'")

aba = None
nivel_aba = None
itens = {}
ordem = []
pilha = []
for o in objs:
    while pilha and pilha[-1]["n"] >= o["n"]:
        pilha.pop()
    pilha.append(o)
    if o["cls"] in ("TcxTabSheet", "TTabSheet"):
        aba = o["p"].get("Caption", o["nome"])
        nivel_aba = o["n"]
        ordem.append(aba)
        itens[aba] = []
        continue
    if aba is None or o["n"] <= nivel_aba:
        if aba is not None and o["n"] <= nivel_aba:
            aba = None
        continue
    # posicao absoluta aproximada: soma Top/Left dos pais dentro da aba
    top = sum(int(p["p"].get("Top", 0) or 0) for p in pilha if p["n"] > nivel_aba)
    left = sum(int(p["p"].get("Left", 0) or 0) for p in pilha if p["n"] > nivel_aba)
    cap = o["p"].get("Caption")
    campo = o["p"].get("DataBinding.DataField") or o["p"].get("DataField")
    if o["cls"] in ("TLabel", "TcxLabel", "TcxGroupBox", "TGroupBox", "TcxCheckBox", "TCheckBox", "TcxDBCheckBox", "TDBCheckBox") and cap:
        itens[aba].append((top, left, "rot" if "Label" in o["cls"] else o["cls"], cap, campo or ""))
    elif campo:
        itens[aba].append((top, left, "campo", o["nome"], campo))
for a in ordem:
    print(f"\n=== ABA {a}")
    for t, l, k, c, f in sorted(itens[a]):
        print(f"   ({t:>4},{l:>4}) {k:<14} {c:<40} {f}")
