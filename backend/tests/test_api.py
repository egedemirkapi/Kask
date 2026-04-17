def test_create_session(client):
    response = client.post("/session/create")
    assert response.status_code == 200
    data = response.json()
    assert len(data["room_code"]) == 6
    assert data["qr_data_url"].startswith("data:image/png")


def test_session_exists_after_create(client):
    code = client.post("/session/create").json()["room_code"]
    response = client.get(f"/session/{code}/exists")
    assert response.json()["exists"] is True


def test_unknown_session_does_not_exist(client):
    response = client.get("/session/ZZZZZZ/exists")
    assert response.json()["exists"] is False
