"""SO LEITURA. Le os formularios Delphi (DFM binario, assinatura TPF0) de dentro de um executavel do WinThor
e despeja a arvore em texto: classe, nome e propriedades. Nao executa nada.
Uso: python -I -X utf8 dfm.py <arquivo> <saida.txt>"""
import struct
import sys


class Leitor:
    def __init__(self, b, p):
        self.b, self.p = b, p

    def u8(self):
        v = self.b[self.p]
        self.p += 1
        return v

    def take(self, n):
        v = self.b[self.p:self.p + n]
        self.p += n
        return v

    def sstr(self):
        n = self.u8()
        return self.take(n).decode("cp1252", "replace")

    def valor(self, t=None):
        if t is None:
            t = self.u8()
        if t == 0:
            return None
        if t == 1:  # lista
            out = []
            while self.b[self.p] != 0:
                out.append(self.valor())
            self.p += 1
            return out
        if t == 2:
            return struct.unpack("<b", self.take(1))[0]
        if t == 3:
            return struct.unpack("<h", self.take(2))[0]
        if t == 4:
            return struct.unpack("<i", self.take(4))[0]
        if t == 5:
            self.take(10)
            return "<ext>"
        if t in (6, 7):
            return self.sstr()
        if t == 8:
            return False
        if t == 9:
            return True
        if t == 10:
            n = struct.unpack("<i", self.take(4))[0]
            self.take(n)
            return f"<bin {n}>"
        if t == 11:
            out = []
            while True:
                s = self.sstr()
                if not s:
                    break
                out.append(s)
            return "[" + ",".join(out) + "]"
        if t == 12:
            n = struct.unpack("<i", self.take(4))[0]
            return self.take(n).decode("cp1252", "replace")
        if t == 13:
            return "nil"
        if t == 14:  # colecao
            itens = []
            while self.b[self.p] != 0:
                ordem = None
                if self.b[self.p] in (2, 3, 4):
                    ordem = self.valor()
                assert self.u8() == 1, "item de colecao sem vaList"
                props = {}
                while self.b[self.p] != 0:
                    k = self.sstr()
                    props[k] = self.valor()
                self.p += 1
                itens.append(props)
            self.p += 1
            return itens
        if t == 15:
            return struct.unpack("<f", self.take(4))[0]
        if t in (16, 17, 21):
            return struct.unpack("<d", self.take(8))[0]
        if t == 18:
            n = struct.unpack("<i", self.take(4))[0]
            return self.take(n * 2).decode("utf-16-le", "replace")
        if t == 19:
            return struct.unpack("<q", self.take(8))[0]
        if t == 20:
            n = struct.unpack("<i", self.take(4))[0]
            return self.take(n).decode("utf-8", "replace")
        raise ValueError(f"tipo {t} em {self.p}")

    def objeto(self, nivel, out):
        b = self.b[self.p]
        if b & 0xF0 == 0xF0:
            flags = self.u8() & 0x0F
            if flags & 2:
                self.valor()
        classe = self.sstr()
        nome = self.sstr()
        out.append("  " * nivel + f"{nome}: {classe}")
        while self.b[self.p] != 0:
            k = self.sstr()
            v = self.valor()
            if isinstance(v, list) and v and isinstance(v[0], dict):
                out.append("  " * nivel + f"  .{k} = [colecao {len(v)}]")
                for i, it in enumerate(v):
                    out.append("  " * nivel + f"    [{i}] " + "; ".join(f"{a}={b2!r}" for a, b2 in it.items()))
            elif isinstance(v, list):
                out.append("  " * nivel + f"  .{k} =")
                for x in v:
                    out.append("  " * nivel + f"      | {x}")
            else:
                out.append("  " * nivel + f"  .{k} = {v!r}")
        self.p += 1
        while self.b[self.p] != 0:
            self.objeto(nivel + 1, out)
        self.p += 1


def main():
    dados = open(sys.argv[1], "rb").read()
    out = []
    i = 0
    n = 0
    while True:
        i = dados.find(b"TPF0", i)
        if i < 0:
            break
        try:
            r = Leitor(dados, i + 4)
            bloco = []
            r.objeto(0, bloco)
            out.append(f"#### DFM em {i} ({r.p - i} bytes)")
            out.extend(bloco)
            n += 1
            i = r.p
        except Exception as e:
            i += 4
    open(sys.argv[2], "w", encoding="utf-8").write("\n".join(out))
    print(n, "formularios")


main()
