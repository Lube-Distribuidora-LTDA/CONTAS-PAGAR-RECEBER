"""Campos persistentes de um dataset do despejo: python campos2.py dfm.txt <linha do dataset (1-based)>"""
import re
import sys

linhas = open(sys.argv[1], encoding="utf-8").read().splitlines()
i = int(sys.argv[2]) - 1
nivel_ds = (len(linhas[i]) - len(linhas[i].lstrip())) // 2
print(linhas[i].strip())
sql, campos, atual, em_sql = [], [], None, False
for l in linhas[i + 1:]:
    n = (len(l) - len(l.lstrip())) // 2
    m = re.match(r"^( *)(\w+): (\w+)$", l)
    if m and len(m.group(1)) // 2 <= nivel_ds:
        break
    if m:
        atual = {"obj": m.group(2), "tipo": m.group(3), "p": {}}
        campos.append(atual)
        em_sql = False
        continue
    m3 = re.match(r"^ *\.([\w.]+) = (.*)$", l)
    if m3:
        (atual["p"] if atual else {}).update({m3.group(1): m3.group(2)})
        em_sql = False
        continue
    if re.match(r"^ *\.SQL\.Strings =$", l) and atual is None:
        em_sql = True
        continue
    m4 = re.match(r"^ *\| (.*)$", l)
    if m4 and em_sql:
        sql.append(m4.group(1))
for c in campos:
    p = c["p"]
    print(f"  {p.get('FieldName', '').strip(chr(39)):<30} | {p.get('DisplayLabel', '').strip(chr(39)):<38} | {c['tipo']:<15} | {p.get('DisplayFormat', '')} {p.get('FieldKind', '')} {p.get('Size', '')}")
if len(sys.argv) > 3:
    print("\n".join(sql))
