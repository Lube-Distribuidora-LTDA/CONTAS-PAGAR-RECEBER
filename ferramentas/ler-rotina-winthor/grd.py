"""Le os layouts .grd (cxGrid StoreToIni) e mostra as colunas: indice, posicao, campo, visivel, largura; e os totais."""
import glob
import os
import re
import sys
from collections import Counter, defaultdict

PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "formconfig")


def ler(arq):
    t = open(arq, encoding="utf-8-sig", errors="replace").read()
    secoes, atual = {}, None
    for linha in t.splitlines():
        m = re.match(r"^\[(.+)\]$", linha)
        if m:
            atual = m.group(1)
            secoes[atual] = {}
            continue
        if atual and "=" in linha:
            k, v = linha.split("=", 1)
            secoes[atual][k] = v.strip('"')
    return secoes


modo = sys.argv[1] if len(sys.argv) > 1 else "resumo"
padrao = sys.argv[2] if len(sys.argv) > 2 else "*.grd"
arqs = sorted(glob.glob(os.path.join(PASTA, padrao)))
if modo == "campos":
    tem = Counter()
    for a in arqs:
        s = ler(a)
        if any("FieldName" in v for v in s.values()):
            tem[os.path.basename(a).split("_", 3)[3]] += 1
    print(tem)
elif modo == "detalhe":
    for a in arqs:
        s = ler(a)
        print("==", os.path.basename(a))
        cols = []
        for nome, v in s.items():
            m = re.match(r".+/(\d+): TcxGridDBColumn", nome)
            if m:
                cols.append((int(v.get("Index", m.group(1))), int(m.group(1)), v.get("FieldName", "?"), v.get("Visible"), v.get("Width"), v.get("SortOrder"), v.get("GroupIndex")))
        for c in sorted(cols):
            print(f"  pos {c[0]:>2} | col {c[1]:>2} | {c[2]:<28} | vis {c[3]:<5} | larg {c[4]} | {c[5]} | grupo {c[6]}")
        for nome, v in s.items():
            if "SummaryItem" in nome:
                print("  TOTAL", nome.split("/")[1].split(":")[0], {k: v.get(k) for k in ("Column", "FieldName", "Kind", "Format", "Position", "DisplayText")})
