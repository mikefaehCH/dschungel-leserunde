#!/usr/bin/env python3
"""Encrypt or decrypt the parent studio and the voice bundle.

The password is read from an environment variable and never written anywhere.
Every encryption run draws a new random salt (shared by all files of the run, so
the login derives the key once) and a new random nonce per file. Both are stored
in the file header, not in the code:

    b"EJC1" | salt (16 bytes) | nonce (12 bytes) | AES-256-GCM ciphertext

Encrypt (new password in CAMP_PASSWORD):
    CAMP_PASSWORD=… python tools/encrypt.py encrypt studio.html:studio.bin bundle.json:voice-bundle.bin

Decrypt, e.g. before a password change (old password in CAMP_PASSWORD):
    CAMP_PASSWORD=… python tools/encrypt.py decrypt studio.bin studio.html
    CAMP_PASSWORD=… python tools/encrypt.py decrypt voice-bundle.bin bundle.json --legacy-nonce 7,185,44,245,7,72,27,177,142,137,76,173

Keep decrypted files outside the repository and delete them afterwards.
"""

import argparse
import hashlib
import os
import secrets
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"EJC1"
ITERATIONS = 600_000
# Salt used by files written before the header format (voice-bundle.bin of 23.11.2026).
LEGACY_SALT = bytes([176, 48, 72, 24, 204, 232, 60, 218, 168, 14, 107, 230, 249, 0, 141, 18])


def password(env):
    value = os.environ.get(env)
    if not value:
        sys.exit(f"Bitte das Passwort in der Umgebungsvariablen {env} setzen.")
    return value.encode()


def derive(secret, salt):
    return hashlib.pbkdf2_hmac("sha256", secret, salt, ITERATIONS, 32)


def encrypt(pairs, secret):
    salt = secrets.token_bytes(16)
    key = derive(secret, salt)
    for pair in pairs:
        source, target = pair.split(":", 1)
        nonce = secrets.token_bytes(12)
        with open(source, "rb") as f:
            plain = f.read()
        with open(target, "wb") as f:
            f.write(MAGIC + salt + nonce + AESGCM(key).encrypt(nonce, plain, None))
        print(f"{target}: neu verschlüsselt ({len(plain)} Bytes)")


def decrypt(source, target, secret, legacy_nonce):
    with open(source, "rb") as f:
        data = f.read()
    if data.startswith(MAGIC):
        salt, nonce, body = data[4:20], data[20:32], data[32:]
    else:
        if not legacy_nonce:
            sys.exit("Altes Format: bitte --legacy-nonce angeben (aus eltern.html).")
        salt, nonce, body = LEGACY_SALT, bytes(int(n) for n in legacy_nonce.split(",")), data
    with open(target, "wb") as f:
        f.write(AESGCM(derive(secret, salt)).decrypt(nonce, body, None))
    print(f"{target}: entschlüsselt. Ausserhalb des Repositorys halten und danach löschen.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--password-env", default="CAMP_PASSWORD")
    sub = parser.add_subparsers(dest="command", required=True)
    enc = sub.add_parser("encrypt")
    enc.add_argument("pairs", nargs="+", metavar="KLARTEXT:ZIEL")
    dec = sub.add_parser("decrypt")
    dec.add_argument("source")
    dec.add_argument("target")
    dec.add_argument("--legacy-nonce")
    args = parser.parse_args()
    secret = password(args.password_env)
    if args.command == "encrypt":
        encrypt(args.pairs, secret)
    else:
        decrypt(args.source, args.target, secret, args.legacy_nonce)


if __name__ == "__main__":
    main()
