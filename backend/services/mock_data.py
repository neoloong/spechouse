"""Mock property data for development/demo when no API key is available."""

MOCK_PROPERTIES = [
    {
        "external_id": "mock-austin-001",
        "address_display": "1204 Barton Hills Dr, Austin, TX 78704",
        "city": "Austin", "state": "TX", "zip_code": "78704",
        "beds": 3, "baths": 2.0, "sqft": 1850, "lot_sqft": 7200,
        "year_built": 1978, "hoa_fee": None, "property_tax": 8400.0,
        "list_price": 685000.0, "property_type": "Single Family",
        "latitude": 30.2383, "longitude": -97.7722,
    },
    {
        "external_id": "mock-austin-002",
        "address_display": "3312 Speedway, Austin, TX 78705",
        "city": "Austin", "state": "TX", "zip_code": "78705",
        "beds": 4, "baths": 3.0, "sqft": 2400, "lot_sqft": 6000,
        "year_built": 2005, "hoa_fee": 150.0, "property_tax": 11200.0,
        "list_price": 920000.0, "property_type": "Single Family",
        "latitude": 30.2888, "longitude": -97.7404,
    },
    {
        "external_id": "mock-austin-003",
        "address_display": "800 W 5th St #1102, Austin, TX 78703",
        "city": "Austin", "state": "TX", "zip_code": "78703",
        "beds": 2, "baths": 2.0, "sqft": 1100, "lot_sqft": None,
        "year_built": 2012, "hoa_fee": 620.0, "property_tax": 9800.0,
        "list_price": 550000.0, "property_type": "Condo",
        "latitude": 30.2680, "longitude": -97.7520,
    },
    {
        "external_id": "mock-austin-004",
        "address_display": "4500 Duval St, Austin, TX 78751",
        "city": "Austin", "state": "TX", "zip_code": "78751",
        "beds": 3, "baths": 2.0, "sqft": 1620, "lot_sqft": 5800,
        "year_built": 1962, "hoa_fee": None, "property_tax": 7200.0,
        "list_price": 595000.0, "property_type": "Single Family",
        "latitude": 30.3072, "longitude": -97.7290,
    },
    {
        "external_id": "mock-austin-005",
        "address_display": "2215 S Lamar Blvd #3, Austin, TX 78704",
        "city": "Austin", "state": "TX", "zip_code": "78704",
        "beds": 1, "baths": 1.0, "sqft": 720, "lot_sqft": None,
        "year_built": 2018, "hoa_fee": 280.0, "property_tax": 5100.0,
        "list_price": 310000.0, "property_type": "Condo",
        "latitude": 30.2500, "longitude": -97.7651,
    },
    {
        "external_id": "mock-austin-006",
        "address_display": "7823 Shoal Creek Blvd, Austin, TX 78757",
        "city": "Austin", "state": "TX", "zip_code": "78757",
        "beds": 4, "baths": 2.5, "sqft": 2800, "lot_sqft": 9500,
        "year_built": 1988, "hoa_fee": None, "property_tax": 12500.0,
        "list_price": 1050000.0, "property_type": "Single Family",
        "latitude": 30.3542, "longitude": -97.7290,
    },
]

MOCK_AGG = {
    "mock-austin-001": {
        "rental": {"estimate": 3200.0, "yield_pct": 5.6, "cap_rate": 5.6},
        "environment": {"noise_db": 52.0, "noise_label": "Quiet", "crime_score": 38.0},
        "scores": {"overall": 71.0, "value": 68.0, "investment": 74.0},
    },
    "mock-austin-002": {
        "rental": {"estimate": 4100.0, "yield_pct": 5.35, "cap_rate": 5.35},
        "environment": {"noise_db": 64.0, "noise_label": "Moderate", "crime_score": 45.0},
        "scores": {"overall": 62.0, "value": 58.0, "investment": 65.0},
    },
    "mock-austin-003": {
        "rental": {"estimate": 2800.0, "yield_pct": 6.11, "cap_rate": 6.11},
        "environment": {"noise_db": 71.0, "noise_label": "Loud", "crime_score": 52.0},
        "scores": {"overall": 58.0, "value": 64.0, "investment": 70.0},
    },
    "mock-austin-004": {
        "rental": {"estimate": 2950.0, "yield_pct": 5.95, "cap_rate": 5.95},
        "environment": {"noise_db": 48.0, "noise_label": "Quiet", "crime_score": 33.0},
        "scores": {"overall": 76.0, "value": 72.0, "investment": 78.0},
    },
    "mock-austin-005": {
        "rental": {"estimate": 1750.0, "yield_pct": 6.77, "cap_rate": 6.77},
        "environment": {"noise_db": 67.0, "noise_label": "Moderate", "crime_score": 48.0},
        "scores": {"overall": 65.0, "value": 70.0, "investment": 73.0},
    },
    "mock-austin-006": {
        "rental": {"estimate": 4800.0, "yield_pct": 5.49, "cap_rate": 5.49},
        "environment": {"noise_db": 44.0, "noise_label": "Very Quiet", "crime_score": 25.0},
        "scores": {"overall": 79.0, "value": 74.0, "investment": 72.0},
    },
}
