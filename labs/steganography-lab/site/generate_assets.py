"""Generate steganography challenge files with pure stdlib.

Three hiding techniques, one flag each:
  1. bmp-lago.bmp  — LSB steganography in uncompressed pixel data
  2. vacaciones.jpg — flag inside a JPEG COM (comment) segment
  3. logo-corp.png — data appended after the PNG IEND chunk (zip)
"""
import base64
import io
import os
import struct
import zipfile
import zlib

OUT = os.environ.get('ASSETS_DIR', '/assets')

FLAG_LSB = os.environ.get('FLAG_1', 'FLAG{lsb_pixels_dont_lie}')
FLAG_EXIF = os.environ.get('FLAG_2', 'FLAG{jpeg_comment_segment}')
FLAG_APPEND = os.environ.get('FLAG_3', 'FLAG{data_after_iend}')


def build_bmp_lsb() -> None:
    """Uncompressed 24-bit BMP, message bits spread over pixel LSBs."""
    width, height = 64, 64
    # deterministic pseudo-random-ish pixel data (smooth gradient + noise)
    pixels = bytearray()
    for y in range(height):
        for x in range(width):
            pixels += bytes([(x * 4) % 256, (y * 4) % 256, ((x + y) * 2) % 256])

    # embed: 32-bit little-endian length + message bytes, 1 bit per channel LSB
    message = FLAG_LSB.encode()
    bitstream = []
    for byte in struct.pack('<I', len(message)) + message:
        for i in range(7, -1, -1):
            bitstream.append((byte >> i) & 1)

    row_stride = width * 3
    pixel_array_size = row_stride * height
    file_header = struct.pack('<2sIHHI', b'BM', 14 + 40 + pixel_array_size, 0, 0, 14 + 40)
    info_header = struct.pack('<IiiHHIIiiII', 40, width, height, 1, 24, 0,
                              pixel_array_size, 2835, 2835, 0, 0)
    # BMP rows are stored bottom-up and padded to 4 bytes (64*3=192 divisible by 4)
    rows = []
    for y in range(height - 1, -1, -1):
        rows.append(bytearray(pixels[y * row_stride:(y + 1) * row_stride]))
    flat = bytearray(b''.join(rows))
    # embed into the FINAL on-disk layout so a linear reader finds the bits
    for i, bit in enumerate(bitstream):
        flat[i] = (flat[i] & 0xFE) | bit
    with open(os.path.join(OUT, 'bmp-lago.bmp'), 'wb') as fh:
        fh.write(file_header + info_header + bytes(flat))

    # sanity: decode back from the final layout
    decoded_bits = [flat[i] & 1 for i in range(len(bitstream))]
    out = bytearray()
    for i in range(0, len(decoded_bits), 8):
        byte = 0
        for b in decoded_bits[i:i + 8]:
            byte = (byte << 1) | b
        out.append(byte)
    length = struct.unpack('<I', bytes(out[:4]))[0]
    assert bytes(out[4:4 + length]) == message, 'LSB roundtrip failed'
    print(f'[stego] bmp-lago.bmp: {14 + 40 + pixel_array_size} bytes (LSB ok)')


def build_jpeg_comment() -> None:
    """Minimal valid JPEG (all-gray 8x8) with the flag in a COM segment."""
    def marker(m: int, payload: bytes = b'') -> bytes:
        return bytes([0xFF, m]) + struct.pack('>H', len(payload) + 2) + payload

    jpeg = bytearray()
    jpeg += b'\xFF\xD8'                                # SOI
    jpeg += marker(0xE0, b'JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00')  # APP0
    jpeg += marker(0xFE, f'secret: {FLAG_EXIF}'.encode())  # COM — the flag
    jpeg += marker(0xDB, b'\x00' + bytes([1] + [i for i in range(16)]))    # DQT (id 1)
    jpeg += marker(0xC0, struct.pack('>BHHB', 8, 8, 8, 1) + bytes([1, 0x11, 0, 0, 0, 0]))  # SOF0
    jpeg += marker(0xC4, b'\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
                         b'\x00' * 16 + b'\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
                         b'\x00\x00\x00\x00\x00')  # DHT placeholder-ish (browsers tolerate)
    jpeg += marker(0xDA, b'\x01\x01\x00\x00\x3F\x00')  # SOS
    jpeg += b'\x00' * 64                                # entropy data (dummy)
    jpeg += b'\xFF\xD9'                                 # EOI
    with open(os.path.join(OUT, 'vacaciones.jpg'), 'wb') as fh:
        fh.write(bytes(jpeg))
    print(f'[stego] vacaciones.jpg: {len(jpeg)} bytes (COM segment)')


def build_png_appended() -> None:
    """Valid PNG with a zip archive appended after IEND (classic trick)."""
    width, height = 32, 32
    raw = b''
    for y in range(height):
        raw += b'\x00'                                  # filter byte per row
        for x in range(width):
            raw += bytes([x * 8 % 256, y * 8 % 256, 128])

    def chunk(ctype: bytes, data: bytes) -> bytes:
        return (struct.pack('>I', len(data)) + ctype + data
                + struct.pack('>I', zlib.crc32(ctype + data) & 0xFFFFFFFF))

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw))
           + chunk(b'IEND', b''))

    secret_zip = io.BytesIO()
    with zipfile.ZipFile(secret_zip, 'w') as zf:
        zf.writestr('notas-secretas.txt',
                    'Reunión movida al jueves.\nContraseña del vault: '
                    + FLAG_APPEND + '\n')
    with open(os.path.join(OUT, 'logo-corp.png'), 'wb') as fh:
        fh.write(png + secret_zip.getvalue())
    print(f'[stego] logo-corp.png: {len(png) + secret_zip.tell()} bytes (zip after IEND)')


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    build_bmp_lsb()
    build_jpeg_comment()
    build_png_appended()


if __name__ == '__main__':
    main()
