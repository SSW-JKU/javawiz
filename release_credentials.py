YOUTRACK_USERNAME_ENV = "YOUTRACK_USERNAME"
YOUTRACK_PASSWORD_ENV = "YOUTRACK_PASSWORD"


def require_youtrack_credentials(environ):
    username = environ.get(YOUTRACK_USERNAME_ENV, "").strip()
    password = environ.get(YOUTRACK_PASSWORD_ENV, "").strip()
    missing = [
        name
        for name, value in (
            (YOUTRACK_USERNAME_ENV, username),
            (YOUTRACK_PASSWORD_ENV, password),
        )
        if not value
    ]
    if missing:
        print(
            "Error: missing required YouTrack environment variable(s): "
            + ", ".join(missing)
        )
        return None
    return username, password
