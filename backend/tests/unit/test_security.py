import pytest
from datetime import timedelta
from fastapi import HTTPException
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
)


def test_password_hash_and_verify():
    password = "SuperSecretPassword@123"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_token_encode_decode():
    payload = {"sub": "user-12345", "role": "participant", "email": "test@hackflow.local"}
    token = create_access_token(payload, expires_delta=timedelta(minutes=15))

    decoded = decode_token(token)
    assert decoded["sub"] == "user-12345"
    assert decoded["role"] == "participant"
    assert decoded["email"] == "test@hackflow.local"
    assert "exp" in decoded


def test_jwt_token_expired():
    payload = {"sub": "user-expired"}
    token = create_access_token(payload, expires_delta=timedelta(seconds=-1))

    with pytest.raises(HTTPException) as exc_info:
        decode_token(token)
    assert exc_info.value.status_code == 401
