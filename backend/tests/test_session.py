from session_manager import SessionManager


def test_create_and_find_session():
    sm = SessionManager()
    sm.create("ABC123")
    assert sm.exists("ABC123")


def test_missing_session():
    sm = SessionManager()
    assert not sm.exists("NOTEXIST")


def test_delete_session():
    sm = SessionManager()
    sm.create("ABC123")
    sm.delete("ABC123")
    assert not sm.exists("ABC123")


def test_get_session_returns_students_dict():
    sm = SessionManager()
    sm.create("ABC123")
    session = sm.get("ABC123")
    assert "students" in session
    assert "rules" in session
    assert "teacher_ws" in session
