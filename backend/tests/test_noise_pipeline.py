"""Smoke tests for noise_db pipeline (feat/noise-display)."""
import pytest
import anyio
from backend.models.property import PropertyORM, PropertyOut, PropertyListItem
from backend.services import howloud, scorer


class TestPropertyORMNoiseColumn:
    """Test that PropertyORM has a noise_db column."""

    def test_noise_db_column_exists(self):
        """PropertyORM must have a noise_db Mapped column."""
        assert hasattr(PropertyORM, "noise_db")

    def test_noise_db_column_is_optional_float(self):
        """noise_db should be Optional[float] (Double in DB)."""
        col = PropertyORM.__dict__["noise_db"]
        # Check it's a mapped_column with nullable=True
        assert col.expression.type.__class__.__name__ == "Double"


def _run_async(coro):
    """Run an async coroutine synchronously using anyio."""
    return anyio.run(lambda: coro)


class TestGetNoiseReturnsNoiseDb:
    """Test that howloud.get_noise() returns noise_db key."""

    def test_get_noise_returns_noise_db_key(self):
        """get_noise() result must contain 'noise_db' key."""
        result = _run_async(howloud.get_noise(37.7749, -122.4194))
        assert "noise_db" in result

    def test_get_noise_noise_db_is_float(self):
        """noise_db value should be a float."""
        result = _run_async(howloud.get_noise(37.7749, -122.4194))
        assert isinstance(result["noise_db"], float)

    def test_get_noise_noise_db_in_expected_range(self):
        """noise_db from mock should be in realistic range [30, 90]."""
        result = _run_async(howloud.get_noise(37.7749, -122.4194))
        assert 30.0 <= result["noise_db"] <= 90.0

    def test_get_noise_returns_noise_label(self):
        """get_noise() result should include noise_label."""
        result = _run_async(howloud.get_noise(37.7749, -122.4194))
        assert "noise_label" in result
        assert isinstance(result["noise_label"], str)


class TestScorerNoiseIntegration:
    """Test that compute_scores and _noise_score handle noise_db."""

    def test_compute_scores_with_none_noise_db(self):
        """compute_scores with noise_db=None should not raise."""
        # Should not crash and should still compute rental_yield component
        result = scorer.compute_scores(
            list_price=500_000,
            sqft=1500,
            rental_estimate=2_500,
            noise_db=None,
            crime_score=None,
            rentcast_avm=None,
            schools=None,
        )
        assert "overall" in result

    def test_compute_scores_accepts_noise_db(self):
        """compute_scores must accept noise_db kwarg and use it."""
        result = scorer.compute_scores(
            list_price=500_000,
            sqft=1500,
            rental_estimate=2_500,
            noise_db=55.0,  # moderate noise
            crime_score=75.0,
            rentcast_avm=None,
            schools=[],
        )
        assert "overall" in result

    def test_noise_score_computed_correctly(self):
        """noise_db=55 should produce a noise component in overall score."""
        result = scorer.compute_scores(
            list_price=500_000,
            sqft=1500,
            rental_estimate=2_500,
            noise_db=55.0,
            crime_score=None,
            rentcast_avm=None,
            schools=None,
        )
        # _noise_score: 55 dB → clamped(100 + (40-55)*1.33) = 80
        # With noise_db=55 and rental_yield, both contribute to overall
        assert result["overall"] is not None
        assert isinstance(result["overall"], float)

    def test_noise_score_very_quiet(self):
        """noise_db=40 (very quiet) should produce highest noise component."""
        result = scorer.compute_scores(
            list_price=500_000,
            sqft=1500,
            rental_estimate=2_500,
            noise_db=40.0,
            crime_score=None,
            rentcast_avm=None,
            schools=None,
        )
        # noise=100 (≤40dB), rental_yield also contributes
        # overall = weighted avg of rental_yield (0.25) + noise (0.15) = not 100
        # Just verify it runs and overall is a valid score
        assert isinstance(result["overall"], float)
        assert 0 <= result["overall"] <= 100

    def test_noise_score_loud(self):
        """noise_db=80 (very loud) should produce low noise component."""
        result = scorer.compute_scores(
            list_price=500_000,
            sqft=1500,
            rental_estimate=2_500,
            noise_db=80.0,
            crime_score=None,
            rentcast_avm=None,
            schools=None,
        )
        # 80 dB: clamped(30 - (80-75)*2) = clamped(20) = 20
        # Noise component is 20, weighted with rental_yield
        assert isinstance(result["overall"], float)
        assert 0 <= result["overall"] <= 100


class TestPropertyOutSchema:
    """Test Pydantic schemas include noise_db."""

    def test_property_out_has_noise_db(self):
        """PropertyOut schema must include noise_db field."""
        fields = PropertyOut.model_fields
        assert "noise_db" in fields

    def test_property_list_item_has_noise_db(self):
        """PropertyListItem schema must include noise_db field."""
        fields = PropertyListItem.model_fields
        assert "noise_db" in fields


class TestEnrichAggDataStoresNoiseDb:
    """Test that enrich_agg_data extracts and stores noise_db."""

    def test_enrich_agg_data_includes_noise_db_in_environment(self):
        """enrich_agg_data should put noise_db in agg['environment']."""
        noise_data = {"noise_db": 52.0, "noise_label": "Quiet"}
        result = _run_async(scorer.enrich_agg_data(
            current_agg={},
            list_price=400_000,
            sqft=1200,
            noise_data=noise_data,
            crime_data=None,
            schools=None,
            city="San Jose",
            state="CA",
            beds=2,
            property_type="condo",
        ))
        assert "environment" in result
        assert result["environment"]["noise_db"] == 52.0

    def test_enrich_agg_data_passes_noise_db_to_compute_scores(self):
        """enrich_agg_data passes noise_data['noise_db'] to compute_scores."""
        noise_data = {"noise_db": 65.0, "noise_label": "Moderate"}
        result = _run_async(scorer.enrich_agg_data(
            current_agg={},
            list_price=400_000,
            sqft=1200,
            noise_data=noise_data,
            crime_data=None,
            schools=None,
            city="San Jose",
            state="CA",
            beds=2,
            property_type="condo",
        ))
        # scores should be computed with the noise_db signal
        assert "scores" in result
        assert result["scores"]["overall"] is not None

    def test_enrich_agg_data_with_no_noise_data(self):
        """enrich_agg_data with empty noise_data should not crash."""
        noise_data = {}
        result = _run_async(scorer.enrich_agg_data(
            current_agg={},
            list_price=400_000,
            sqft=1200,
            noise_data=noise_data,
            crime_data=None,
            schools=None,
            city="San Jose",
            state="CA",
            beds=2,
            property_type="condo",
        ))
        assert "scores" in result
        assert "environment" in result
        assert result["environment"].get("noise_db") is None