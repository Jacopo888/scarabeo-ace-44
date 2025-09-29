from __future__ import annotations
import os
import threading
import time
from collections import deque
from typing import Any, Dict, Optional
import importlib

_LOCK = threading.Lock()
_SAMPLES = deque(maxlen=int(os.getenv("QUACKLE_METRICS_BUFFER", "512")))

# Lazy OTel setup (optional). If opentelemetry SDK is not installed, we silently no-op.
_OTEL_READY = False
_OTEL_HISTO = None  # type: ignore[var-annotated]


def _setup_otel_once() -> None:
    global _OTEL_READY, _OTEL_HISTO
    if _OTEL_READY or os.getenv("QUACKLE_OTEL_METRICS", "").lower() not in {"1", "true", "yes", "on"}:
        # Either already ready or disabled by env
        return
    try:
        # Dynamic import to keep dependency optional and avoid static warnings
        sdk_metrics = importlib.import_module("opentelemetry.sdk.metrics")
        export_mod = importlib.import_module("opentelemetry.sdk.metrics.export")
        MeterProvider = getattr(sdk_metrics, "MeterProvider")
        PeriodicExportingMetricReader = getattr(export_mod, "PeriodicExportingMetricReader")

        # Optional exporters
        exporter = None
        try:
            grpc_mod = importlib.import_module(
                "opentelemetry.exporter.otlp.proto.grpc.metric_exporter"
            )
            exporter = getattr(grpc_mod, "OTLPMetricExporter")()
        except Exception:
            try:
                http_mod = importlib.import_module(
                    "opentelemetry.exporter.otlp.proto.http.metric_exporter"
                )
                exporter = getattr(http_mod, "OTLPMetricExporter")()
            except Exception:
                exporter = None

        readers = []
        if exporter is not None:
            readers.append(PeriodicExportingMetricReader(exporter))
        provider = MeterProvider(metric_readers=readers)

        api_metrics = importlib.import_module("opentelemetry.metrics")
        api_metrics.set_meter_provider(provider)
        meter = api_metrics.get_meter("quackle_service")
        _OTEL_HISTO = meter.create_histogram(
            name="best_move_latency_ms",
            unit="ms",
            description="Latency of /best-move handler including engine",
        )
        _OTEL_READY = True
    except Exception:
        # Missing SDK or exporter; keep no-op
        _OTEL_READY = False
        _OTEL_HISTO = None


def record_best_move_latency_ms(value_ms: float, attributes: Optional[Dict[str, Any]] = None) -> None:
    """Record a latency sample for /best-move.

    - Always stores in a small local ring buffer for quick debug/percentiles.
    - If OTel is enabled and available (QUACKLE_OTEL_METRICS=1), also emits a Histogram metric.
    """
    try:
        v = float(value_ms)
    except Exception:
        return
    with _LOCK:
        _SAMPLES.append(v)

    # Optional OTel emit
    try:
        if not _OTEL_READY and os.getenv("QUACKLE_OTEL_METRICS", "").lower() in {"1", "true", "yes", "on"}:
            # Attempt lazy setup if enabled
            _setup_otel_once()
        if _OTEL_READY and _OTEL_HISTO is not None:
            # Avoid passing non-hashable attribute values
            attrs = {}
            if attributes:
                for k, val in attributes.items():
                    try:
                        # Normalize to primitives
                        if isinstance(val, (str, int, float, bool)) or val is None:
                            attrs[k] = val
                        else:
                            attrs[k] = str(val)
                    except Exception:
                        continue
            _OTEL_HISTO.record(v, attributes=attrs)  # type: ignore[attr-defined]
    except Exception:
        # Do not raise from metrics path
        pass


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    if p <= 0:
        return float(s[0])
    if p >= 100:
        return float(s[-1])
    k = (len(s) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return float(s[f])
    d0 = s[f] * (c - k)
    d1 = s[c] * (k - f)
    return float(d0 + d1)


def local_latency_snapshot() -> Dict[str, Any]:
    """Return a snapshot of local latency buffer with basic percentiles.

    This is intended for quick CI/debugging without requiring an OTel backend.
    """
    with _LOCK:
        vals = list(_SAMPLES)
    count = len(vals)
    if count == 0:
        return {"count": 0, "p50": 0.0, "p95": 0.0, "p99": 0.0, "min": 0.0, "max": 0.0}
    return {
        "count": count,
        "p50": _percentile(vals, 50),
        "p95": _percentile(vals, 95),
        "p99": _percentile(vals, 99),
        "min": float(min(vals)),
        "max": float(max(vals)),
    }
