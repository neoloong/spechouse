"""Persistent Rentcast API call quota tracker — survives server restarts."""
import json
import os
from datetime import datetime
from pathlib import Path

QUOTA_FILE = Path(__file__).parent.parent / ".api_quota.json"
MONTHLY_LIMIT = 50


def _load() -> dict:
    if QUOTA_FILE.exists():
        try:
            return json.loads(QUOTA_FILE.read_text())
        except Exception:
            pass
    return {"month": _current_month(), "calls": 0}


def _save(data: dict) -> None:
    QUOTA_FILE.write_text(json.dumps(data, indent=2))


def _current_month() -> str:
    return datetime.now().strftime("%Y-%m")


def get_status() -> dict:
    data = _load()
    # Auto-reset at the start of a new calendar month
    if data["month"] != _current_month():
        data = {"month": _current_month(), "calls": 0}
        _save(data)
    remaining = max(0, MONTHLY_LIMIT - data["calls"])
    return {
        "month": data["month"],
        "calls_used": data["calls"],
        "calls_remaining": remaining,
        "limit": MONTHLY_LIMIT,
        "blocked": remaining == 0,
    }


def consume() -> bool:
    """
    Attempt to consume 1 API call from the quota.
    Returns True if allowed, False if limit reached.
    """
    data = _load()
    if data["month"] != _current_month():
        data = {"month": _current_month(), "calls": 0}

    if data["calls"] >= MONTHLY_LIMIT:
        return False

    data["calls"] += 1
    _save(data)
    print(f"[Rentcast quota] Call #{data['calls']}/{MONTHLY_LIMIT} — {MONTHLY_LIMIT - data['calls']} remaining")
    return True
