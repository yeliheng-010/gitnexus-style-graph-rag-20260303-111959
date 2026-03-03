from app.logic import compute_total


def handle_request() -> str:
    return compute_total([10.0, 30.0])
