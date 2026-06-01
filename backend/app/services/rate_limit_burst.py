from __future__ import annotations


def resolve_burst_limit(
    *,
    sustained_limit: int,
    window_seconds: int,
    burst_window_seconds: int,
) -> int:
    """Short-window cap derived from the sustained quota (anti-hammer)."""
    if sustained_limit <= 0:
        return 0
    if window_seconds <= burst_window_seconds:
        return sustained_limit

    ratio = burst_window_seconds / window_seconds
    # ~2× average rate for the burst window, at least 3, never above sustained cap.
    burst = int(sustained_limit * ratio * 2.0)
    return max(3, min(sustained_limit, burst))
