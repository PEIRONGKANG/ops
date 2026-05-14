from __future__ import annotations

import base64
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


PASSWORD_PREFIX = "enc:v1:"
DEFAULT_PASSWORD_VIEW_PASSPHRASE = "p8952122"
PASSWORD_VIEW_PASSPHRASE = os.environ.get("OPS_PASSWORD_VIEW_PASSPHRASE", DEFAULT_PASSWORD_VIEW_PASSPHRASE)


def _derive_key(passphrase: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=390_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(passphrase.encode("utf-8")))


def is_encrypted_password(value: str | None) -> bool:
    return isinstance(value, str) and value.startswith(PASSWORD_PREFIX)


def encrypt_password(plain_password: str | None) -> str:
    value = str(plain_password or "")
    if is_encrypted_password(value):
        return value
    salt = os.urandom(16)
    token = Fernet(_derive_key(PASSWORD_VIEW_PASSPHRASE, salt)).encrypt(value.encode("utf-8"))
    return f"{PASSWORD_PREFIX}{base64.urlsafe_b64encode(salt).decode('ascii')}:{token.decode('ascii')}"


def decrypt_password(encrypted_password: str | None, passphrase: str | None = None) -> str:
    value = str(encrypted_password or "")
    if not value:
        return ""
    if not is_encrypted_password(value):
        return value
    try:
        _, _, salt_b64, token = value.split(":", 3)
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        key = _derive_key(passphrase or PASSWORD_VIEW_PASSPHRASE, salt)
        return Fernet(key).decrypt(token.encode("ascii")).decode("utf-8")
    except (ValueError, InvalidToken, UnicodeDecodeError):
        return ""


def verify_password_view_passphrase(passphrase: str | None) -> bool:
    return str(passphrase or "") == PASSWORD_VIEW_PASSPHRASE
