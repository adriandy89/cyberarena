"""Generate three RE challenge binaries (pure stdlib).

  level1.sh   — flag base64'd inside; strings + base64 -d solves it
  level2.py   — runs fine, prints a taunt; the flag is zlib-compressed
  level3.bin  — fake-but-plausible ELF; flag XORed with 0x5A
"""
import base64
import os
import struct
import zlib

OUT = os.environ.get('BINS_DIR', '/bins')

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{strings_baseline_re}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{zlib_layer_peeled}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{xor_key_0x5a}')


def build_level1() -> None:
    b64 = base64.b64encode(FLAG_1.encode()).decode()
    script = f"""#!/bin/sh
# /usr/local/bin/healthcheck — v2.3.1
# (c) CorpOps. Do not modify.

CONFIG_HASH="{b64}"

check_disk() {{ df -h / | tail -1; }}
check_mem() {{ free -m | head -2; }}

main() {{
    check_disk
    check_mem
    echo "health: OK (build {b64[:6]})"
}}
main "$@"
"""
    path = os.path.join(OUT, 'level1.sh')
    with open(path, 'w') as fh:
        fh.write(script)
    os.chmod(path, 0o755)
    print(f'[re] level1.sh: {len(script)} bytes')


def build_level2() -> None:
    blob = base64.b64encode(zlib.compress(f'The flag you seek: {FLAG_2}'.encode())).decode()
    script = f"""#!/usr/bin/env python3
'''telemetry-sync v1.8 — pushes metrics upstream.'''
import base64 as _b

_PAYLOAD = "{blob}"

def push():
    # v1.8: payload encrypted in transit (the "encryption" is the exercise)
    return _b.b64decode(_PAYLOAD)

if __name__ == '__main__':
    print('telemetry queue: 0 pending (nothing to see here)')
    print('upstream: offline')
"""
    path = os.path.join(OUT, 'level2.py')
    with open(path, 'w') as fh:
        fh.write(script)
    os.chmod(path, 0o755)
    print(f'[re] level2.py: {len(script)} bytes')


def build_level3() -> None:
    """Fake ELF: valid magic/class header, section table, XORed flag string."""
    xor = bytes(b ^ 0x5A for b in FLAG_3.encode())
    # e_ident: magic, 64-bit, little endian, current version
    e_ident = b'\x7fELF\x02\x01\x01\x00' + b'\x00' * 8
    # Elf64_Ehdr (stub values — plausible enough for `file` and readelf headers)
    ehdr = e_ident + struct.pack('<HHIQQQIHHHHHH',
                                 2,            # e_type ET_EXEC
                                 0x3E,         # e_machine x86-64
                                 1,            # e_version
                                 0x400000,     # e_entry
                                 64,           # e_phoff
                                 0,            # e_shoff (patched later)
                                 0,            # e_flags
                                 64,           # e_ehsize
                                 56, 1,        # phentsize, phnum
                                 64, 5, 3)      # shentsize, shnum, shstrndx
    # program header: PT_LOAD R-X covering the file
    phdr = struct.pack('<IIQQQQQQ', 1, 5, 0, 0x400000, 0x400000, 0x1000, 0x1000, 0)
    filler = b'# CorpOps keygen - do not distribute\n' + b'\x90' * 48
    # section headers: NULL, .text, .data (flag lives in .data)
    sh_null = b'\x00' * 64
    sh_text = struct.pack('<IIQQQQIIQQ', 1, 6, 0, 0x400078, 0x78, len(filler), 0, 0, 1, 0)
    sh_data = struct.pack('<IIQQQQIIQQ', 1, 3, 2, 0x400100, 0x100, len(xor), 0, 0, 1, 0)
    sh_strtab = struct.pack('<IIQQQQIIQQ', 1, 3, 0, 0x400200, 0x200, 40, 0, 0, 1, 0)
    strtab = b'\x00.text\x00.data\x00.shstrtab\x00'
    sections = sh_null + sh_text + sh_data + sh_strtab
    shoff = 64 + 56 + len(filler) + len(xor) + len(strtab)
    ehdr = ehdr[:0x28] + struct.pack('<Q', shoff) + ehdr[0x30:]
    path = os.path.join(OUT, 'level3.bin')
    with open(path, 'wb') as fh:
        fh.write(ehdr + phdr + filler + xor + strtab.ljust(40, b'\x00') + sections)
    os.chmod(path, 0o755)
    print(f'[re] level3.bin: {shoff + len(sections)} bytes')


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    build_level1()
    build_level2()
    build_level3()


if __name__ == '__main__':
    main()
