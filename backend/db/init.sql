CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(100) UNIQUE,
    address_display TEXT NOT NULL,
    city VARCHAR(50),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    beds INT,
    baths DECIMAL(3,1),
    sqft INT,
    lot_sqft INT,
    year_built INT,
    hoa_fee DECIMAL(10,2),
    property_tax DECIMAL(10,2),
    list_price DECIMAL(15,2),
    property_type VARCHAR(50),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    photo_url TEXT,
    photos JSONB NOT NULL DEFAULT '[]',
    source VARCHAR(20) DEFAULT 'rentcast',
    agg_data JSONB NOT NULL DEFAULT '{}',
    geom GEOGRAPHY(POINT, 4326),
    last_enriched TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_geom ON properties USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_agg ON properties USING GIN(agg_data);
CREATE INDEX IF NOT EXISTS idx_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_zip ON properties(zip_code);
