"""Smoke tests for compare.py noise data extraction (feat/noise-display)."""
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, AsyncMock
from backend.routers.compare import _build_spec_row


class TestBuildSpecRowNoiseExtraction:
    """Test that _build_spec_row extracts noise from agg_data['environment']."""

    def _make_prop(self, agg_data: dict) -> MagicMock:
        """Build a mock PropertyORM with given agg_data."""
        prop = MagicMock()
        prop.id = 1
        prop.external_id = "test-123"
        prop.address_display = "123 Main St"
        prop.city = "San Jose"
        prop.state = "CA"
        prop.zip_code = "95110"
        prop.latitude = 37.7749
        prop.longitude = -122.4194
        prop.list_price = 500_000
        prop.sqft = 1500
        prop.beds = 3
        prop.baths = 2.0
        prop.lot_sqft = None
        prop.year_built = 1990
        prop.property_type = "condo"
        prop.hoa_fee = None
        prop.property_tax = None
        prop.photo_url = None
        prop.agg_data = agg_data
        return prop

    def test_noise_from_environment_section(self):
        """noise_score and noise_label must come from agg_data['environment']."""
        agg_data = {
            "environment": {
                "noise_db": 52.0,
                "noise_label": "Quiet",
            },
            "rental": {},
            "scores": {},
            "schools": [],
            "lifestyle": {"noise_db": 99.0, "noise_label": "Loud"},  # wrong path
            "crime": {},
        }
        prop = self._make_prop(agg_data)
        row = _build_spec_row(prop)

        assert row["noise_score"] == 52.0, f"Expected 52.0, got {row['noise_score']}"
        assert row["noise_label"] == "Quiet", f"Expected 'Quiet', got {row['noise_label']}"

    def test_noise_null_no_crash(self):
        """When env.noise_db is None, noise_score must be None — no crash."""
        agg_data = {
            "environment": {
                "noise_db": None,
                "noise_label": None,
            },
            "rental": {},
            "scores": {},
            "schools": [],
            "crime": {},
        }
        prop = self._make_prop(agg_data)
        row = _build_spec_row(prop)

        assert row["noise_score"] is None
        assert row["noise_label"] is None

    def test_environment_key_missing_no_crash(self):
        """When 'environment' key is absent, must not raise — noise fields None."""
        agg_data = {
            "rental": {},
            "scores": {},
            "schools": [],
        }
        prop = self._make_prop(agg_data)
        row = _build_spec_row(prop)

        assert row["noise_score"] is None
        assert row["noise_label"] is None

    def test_lifestyle_noise_ignored(self):
        """Noise from lifestyle dict must be ignored — only environment matters."""
        agg_data = {
            "environment": {
                "noise_db": 45.0,
                "noise_label": "Very Quiet",
            },
            "lifestyle": {
                "noise_db": 85.0,
                "noise_label": "Very Loud",
            },
            "rental": {},
            "scores": {},
            "schools": [],
            "crime": {},
        }
        prop = self._make_prop(agg_data)
        row = _build_spec_row(prop)

        assert row["noise_score"] == 45.0
        assert row["noise_label"] == "Very Quiet"

    def test_noise_score_is_float(self):
        """noise_score from environment must be a float, not a string."""
        agg_data = {
            "environment": {
                "noise_db": 67.5,
                "noise_label": "Moderate",
            },
            "rental": {},
            "scores": {},
            "schools": [],
            "crime": {},
        }
        prop = self._make_prop(agg_data)
        row = _build_spec_row(prop)

        assert isinstance(row["noise_score"], float)
        assert isinstance(row["noise_label"], str)