"""Smoke tests for howloud mock mode."""
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.howloud import _mock_noise_score


class TestDeterminism:
    """Same lat/lng must always return the same score."""

    def test_same_coords_returns_same_score(self):
        lat, lng = 34.0522, -118.2437
        result1 = _mock_noise_score(lat, lng)
        result2 = _mock_noise_score(lat, lng)
        result3 = _mock_noise_score(lat, lng)
        assert result1 == result2 == result3

    def test_same_coords_different_precision(self):
        """Truncated to 6 decimal places, so these should match."""
        lat1, lng1 = 34.052200, -118.243700
        lat2, lng2 = 34.0522, -118.2437
        result1 = _mock_noise_score(lat1, lng1)
        result2 = _mock_noise_score(lat2, lng2)
        assert result1 == result2


class TestRequiredFields:
    """Mock must return all required fields."""

    def test_returns_all_required_fields(self):
        result = _mock_noise_score(34.0522, -118.2437)
        assert "noise_db" in result
        assert "noise_label" in result
        assert "noise_detail" in result

    def test_noise_detail_has_sub_fields(self):
        result = _mock_noise_score(34.0522, -118.2437)
        detail = result["noise_detail"]
        assert "traffic" in detail
        assert "local" in detail
        assert "airports" in detail
        assert "scoretext" in detail


class TestScoreRange:
    """Score should be in plausible range."""

    def test_noise_db_in_range(self):
        """noise_db should be in [45, 85] per implementation."""
        for _ in range(20):
            lat = 34.0 + (_ - 10) * 0.1
            lng = -118.0 + (_ - 10) * 0.1
            result = _mock_noise_score(lat, lng)
            assert 45.0 <= result["noise_db"] <= 85.0, f"noise_db out of range: {result['noise_db']}"

    def test_noise_label_valid(self):
        valid_labels = {"Very Quiet", "Quiet", "Moderate", "Loud", "Very Loud"}
        for _ in range(20):
            lat = 34.0 + (_ - 10) * 0.05
            lng = -118.0 + (_ - 10) * 0.05
            result = _mock_noise_score(lat, lng)
            assert result["noise_label"] in valid_labels


class TestEdgeCases:
    """Edge case coordinates."""

    def test_zero_coords(self):
        result = _mock_noise_score(0.0, 0.0)
        assert "noise_db" in result
        assert "noise_label" in result
        assert "noise_detail" in result

    def test_extreme_coords(self):
        result = _mock_noise_score(90.0, 180.0)
        assert "noise_db" in result
        assert 45.0 <= result["noise_db"] <= 85.0

    def test_negative_extreme_coords(self):
        result = _mock_noise_score(-90.0, -180.0)
        assert "noise_db" in result
        assert 45.0 <= result["noise_db"] <= 85.0

    def test_none_lat_raises(self):
        with pytest.raises((TypeError, AttributeError)):
            _mock_noise_score(None, -118.2437)

    def test_none_lng_raises(self):
        with pytest.raises((TypeError, AttributeError)):
            _mock_noise_score(34.0522, None)

    def test_none_both_raises(self):
        with pytest.raises((TypeError, AttributeError)):
            _mock_noise_score(None, None)
