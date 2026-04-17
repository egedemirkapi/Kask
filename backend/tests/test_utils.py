from utils import generate_room_code, generate_qr


def test_room_code_is_6_chars():
    assert len(generate_room_code()) == 6


def test_room_code_is_uppercase_alphanumeric():
    code = generate_room_code()
    assert code.isalnum() and code == code.upper()


def test_room_codes_are_unique():
    codes = {generate_room_code() for _ in range(100)}
    assert len(codes) > 90


def test_qr_returns_png_data_url():
    result = generate_qr("https://classcontrol.app/join?code=ABC123")
    assert result.startswith("data:image/png;base64,")
    assert len(result) > 100
