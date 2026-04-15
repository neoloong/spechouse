from typing import Any, Optional
from sqlalchemy import Integer, String, Numeric, Double, Text, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geography
from pydantic import BaseModel, Field
from datetime import datetime
from backend.db import Base


# ── SQLAlchemy ORM model ──────────────────────────────────────────────────────

class PropertyORM(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    address_display: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(50))
    state: Mapped[Optional[str]] = mapped_column(String(2))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    beds: Mapped[Optional[int]] = mapped_column(Integer)
    baths: Mapped[Optional[float]] = mapped_column(Numeric(3, 1))
    sqft: Mapped[Optional[int]] = mapped_column(Integer)
    lot_sqft: Mapped[Optional[int]] = mapped_column(Integer)
    year_built: Mapped[Optional[int]] = mapped_column(Integer)
    hoa_fee: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    property_tax: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    list_price: Mapped[Optional[float]] = mapped_column(Numeric(15, 2))
    property_type: Mapped[Optional[str]] = mapped_column(String(50))
    latitude: Mapped[Optional[float]] = mapped_column(Double)
    longitude: Mapped[Optional[float]] = mapped_column(Double)
    photo_url: Mapped[Optional[str]] = mapped_column(Text)
    photos: Mapped[list] = mapped_column(JSONB, default=list)
    source: Mapped[Optional[str]] = mapped_column(String(20), default="rentcast")
    agg_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    geom: Mapped[Any] = mapped_column(Geography("POINT", 4326), nullable=True)
    last_enriched: Mapped[Optional[datetime]] = mapped_column(DateTime)
    noise_db: Mapped[Optional[float]] = mapped_column(Double)
    status: Mapped[Optional[str]] = mapped_column(String(20), default="for_sale")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RentalData(BaseModel):
    estimate: Optional[float] = None
    yield_pct: Optional[float] = None
    cap_rate: Optional[float] = None


class EnvironmentData(BaseModel):
    noise_db: Optional[float] = None
    noise_label: Optional[str] = None
    crime_score: Optional[float] = None


class ScoresData(BaseModel):
    overall: Optional[float] = None
    value: Optional[float] = None
    investment: Optional[float] = None


class AggData(BaseModel):
    comparisons: dict = Field(default_factory=dict)
    rental: RentalData = Field(default_factory=RentalData)
    environment: EnvironmentData = Field(default_factory=EnvironmentData)
    scores: ScoresData = Field(default_factory=ScoresData)


class PropertyBase(BaseModel):
    external_id: Optional[str] = None
    address_display: str
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    beds: Optional[int] = None
    baths: Optional[float] = None
    sqft: Optional[int] = None
    lot_sqft: Optional[int] = None
    year_built: Optional[int] = None
    hoa_fee: Optional[float] = None
    property_tax: Optional[float] = None
    list_price: Optional[float] = None
    property_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo_url: Optional[str] = None
    photos: list = Field(default_factory=list)
    source: Optional[str] = None
    agg_data: dict = Field(default_factory=dict)


class PropertyOut(PropertyBase):
    id: int
    noise_db: Optional[float] = None
    last_enriched: Optional[datetime] = None
    created_at: Optional[datetime] = None
    score_overall: Optional[float] = None
    score_value: Optional[float] = None
    score_investment: Optional[float] = None
    score_environment: Optional[float] = None
    score_confidence: Optional[float] = None

    model_config = {"from_attributes": True}


class PropertyListItem(BaseModel):
    id: int
    external_id: Optional[str] = None
    address_display: str
    city: Optional[str] = None
    noise_db: Optional[float] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    beds: Optional[int] = None
    baths: Optional[float] = None
    sqft: Optional[int] = None
    list_price: Optional[float] = None
    property_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo_url: Optional[str] = None
    photos: list = Field(default_factory=list)
    agg_data: dict = Field(default_factory=dict)
    status: Optional[str] = None
    last_enriched: Optional[datetime] = None

    model_config = {"from_attributes": True}
