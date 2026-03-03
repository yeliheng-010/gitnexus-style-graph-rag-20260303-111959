from app.repo import save_order


def compute_total(items: list[float]) -> str:
    total = sum(items)
    return save_order(total)
