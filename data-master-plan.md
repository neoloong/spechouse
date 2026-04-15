# SpecHouse Data Master Plan
**Date:** 2026-04-15
**Author:** Cleo (with agent research)

---

## 1. Executive Summary

### What's Possible Right Now (No New APIs)

| City | Redfin On-Market Listings |
|------|------------------------|
| San Francisco | 348 |
| Los Angeles | 349 |
| San Diego | 350 |
| Austin | 348 |
| Seattle | 349 |
| Miami | 347 |
| Phoenix | 350 |
| Atlanta | 350 |
| Portland | 332 |
| Dallas | 347 |
| Las Vegas | 348 |
| Washington DC | 343 |
| Philadelphia | 349 |
| Boston | 334 |
| New York | 187 |
| Chicago | 64 |
| Denver | 18 |
| **Total (17 cities)** | **~4,000+** |

**结论：** 不需要任何新 API，现有的 Redfin 爬虫每个城市能拿 300-350 条活跃房源。17 个主要城市 × 300+ = **5,000+ 真实房源立即可用**。

---

### Off-Market Data (不上市房源)

| 来源 | 覆盖 | 成本 | 可用性 |
|------|------|------|--------|
| MLS (经纪人) | 全国，但需执照 | $0-500/月 | 需 RPR/NAR 会员 |
| County Assessor | 产权信息，但无上市状态 | 免费 | 公开数据，但无实时性 |
| ListSource / OffMLS | 不上市+sold | $200-500/月 | 信用卡绑定，无免费 tier |
| CoreLogic | 仅企业客户 | $5,000+/月 | 不面向小团队 |
| Redfin Sold 页面 | 已售房源 | 免费（但 TOS 灰色） | 可爬，但法律风险 |

**Off-market 建议：** 对 MVP 阶段不重要——lead gen 的核心是买家找房，上市房源足够。Off-market 是 v2 的差异化功能。

---

## 2. On-Market Data — Detailed Plan

### 2.1 现状 vs 目标

**现状：** 前端搜索只返回 3 条 SF mock 数据，每次调 Redfin 都是 fresh scrape，限制 limit=20，不查数据库

**目标：** 查 PostgreSQL 数据库（已有 1,097 条）+ 定期 preload 17 个大城市 × 300+ 条

### 2.2 实现步骤

#### Step 1: 接数据库搜索（今天，45min）

**文件：** `backend/routers/properties.py`

修改 `/properties/search` 逻辑：
1. 优先查 PostgreSQL（已有缓存数据）
2. DB 为空时 → 调 Redfin 补充 → 存入 DB
3. 返回 DB 数据

```python
# 改前
async def search_properties(...):
    raw_listings = await redfin.search_listings(city, state, limit=50)
    # 直接返回，不存 DB

# 改后
async def search_properties(...):
    # 1. 查 DB
    cached = db.query(PropertyORM).filter_by(city=city, state=state).all()
    if cached:
        return cached  # 直接返回
    
    # 2. 调 Redfin
    raw_listings = await redfin.search_listings(city, state, limit=300)
    # 3. 存 DB
    for listing in raw_listings:
        await _upsert_property(db, listing)
    return raw_listings
```

#### Step 2: Preload 17 个大城市（今天，1h）

用现有 `/properties/admin/preload-cities` endpoint 填充 17 个城市：

```python
CITIES_TO_PRELOAD = [
    ("San Francisco", "CA"),
    ("Los Angeles", "CA"),
    ("San Diego", "CA"),
    ("New York", "NY"),
    ("Austin", "TX"),
    ("Seattle", "WA"),
    ("Chicago", "IL"),
    ("Miami", "FL"),
    ("Denver", "CO"),
    ("Boston", "MA"),
    ("Phoenix", "AZ"),
    ("Atlanta", "GA"),
    ("Portland", "OR"),
    ("Dallas", "TX"),
    ("Las Vegas", "NV"),
    ("Washington", "DC"),
    ("Philadelphia", "PA"),
]
```

预计 DB 存量：17 × 300+ = **5,000+ 条**

#### Step 3: 自动定期刷新（本周）

- 每 6 小时增量爬取新城市
- 每 24 小时刷新已有城市的新房源
- 用 APScheduler（已在 backend 中）

---

## 3. Off-Market Data — Realistic Assessment

### 3.1 为什么 MVP 不需要 Off-Market

Lead gen 模式的核心逻辑：
1. 买家在 SpecHouse 找房 → 对比 → 爱上某套房
2. 点击 "联系中介" → 填表 → lead 发给当地中介
3. 中介付 $20-50/lead

**买家要找的是可买房，不是已售房。** Off-market 对这个漏斗没有直接贡献。

### 3.2 Off-Market 的真实来源

**最便宜路径 — MLS/Agent Access：**
- NAR RPR (Realtor Property Resource) 对持牌经纪人免费
- 需要找合作的 agent 提供 MLS 数据
- **策略：** 找 1-2 个 agent，说服他们把 MLS 数据用于 lead gen 交换

**County Assessor（公开数据）：**
- 好处：完全免费，所有县的产权数据都是公开的
- 坏处：无上市状态（不知道是否在售）
- 可用于：历史价格分析、AVM 验证、building size
- 数据库：`sf.gov` SF assessor API, LA County assessor

**ListSource ($149/月起)：**
- 不上市房源数据库
- 包括 pre-foreclosure, REO, auction, off-market pocket listings
- 信用卡必须，无免费 tier
- 适合：有稳定流量后作为增值功能

---

## 4. 数据质量 Gap

### 4.1 照片问题

| 城市 | 现有照片率 | 问题 |
|------|-----------|------|
| Seattle | 100% (337/337) | ✅ |
| San Francisco | 99% (104/105) | ✅ |
| Fremont | 100% (24/24) | ✅ |
| San Diego | 100% (10/10) | ✅ |
| Daly City | 100% (10/10) | ✅ |
| Chicago | 11% (6/55) | 🔴 |
| Atlanta | 0% (0/39) | 🔴 |
| Phoenix | 0% (0/27) | 🔴 |
| Los Angeles | 0% (0/16) | 🔴 |

**原因：** photo_url 只在 `last_enriched` 首次触发时 fetch，之后 enrichment 不重试

**修复：**
```python
# 在 properties.py 的 enrichment check 中加入 photo_url
needs_enrich = (
    prop.last_enriched is None
    or "schools" not in (prop.agg_data or {})
    or prop.photo_url is None  # 新增
)
```

### 4.2 噪音数据（HowLoud API）

- `.env` 中 `HOWLOUD_API_KEY=your_howloud_api_key_here` 占位符
- 免费 tier 有 10,000 lookups/月
- **立即修复：** 填入真实 key
- 数据缺失原因：`environment.noise_db` 和 `lifestyle.noise_*` 路径不匹配

---

## 5. Recommended Data Stack

### MVP (现在 → 30 天)

| 功能 | 数据源 | 成本 |
|------|--------|------|
| 上市房源搜索 | Redfin scraper → DB | $0 |
| 房源照片 | Redfin photo scrape | $0 |
| 噪音数据 | HowLoud API (填 key) | $0 (free tier) |
| 租金估算 | 现有 hardcoded model | $0 |
| 犯罪数据 | City open data + FBI estimates | $0 |
| 房源详情 Enrich | Redfin listing page scrape | $0 |

**结果：** 5,000+ 真实房源，17 个城市，完整 Enrichment

### v1.0 (30-90 天)

| 功能 | 数据源 | 成本 |
|------|--------|------|
| 更多城市覆盖 | 扩大 Redfin preload 到 50 城市 | $0 |
| 历史价格分析 | County assessor public data | $0 |
| MLS 不上市数据 | 合作 agent 提供 | $0 |

### v2.0 (90+ 天)

| 功能 | 数据源 | 成本 |
|------|--------|------|
| 完整 MLS | RPR API 或 ListSource | $149+/月 |
| CoreLogic 产权 | 企业级 | $5,000+/月 |
| AI 估值增强 | RentCast API | $50/月 |

---

## 6. Immediate Action Items

### 今天（今天能完成）

- [ ] **接 DB 搜索** — 改 `/properties/search` 优先查 PG，Redfin 当补充源
- [ ] **Preload 17 城** — 调用 admin endpoint，填充 5,000+ 条到 DB
- [ ] **填 HowLoud key** — 去 api.howloud.com 注册，填入 `.env`
- [ ] **修照片 enrichment** — 把 `photo_url is None` 加入 needs_enrich check
- [ ] **统一分数标准** — 后端 / 前端分数阈值（0-100 vs 0-10）

### 本周

- [ ] 50 城市 preload 计划
- [ ] Denver (18条) 和 Chicago (64条) 特殊处理（可能 Redfin 对这些市场有不同限制）
- [ ] 建立定期刷新 cron

---

## 7. Technical Implementation

### 7.1 接 DB 搜索 — 具体改动

**文件：** `backend/routers/properties.py` — `search_properties` function

```python
@router.get("/search", response_model=List[PropertyListItem])
async def search_properties(
    city: Optional[str] = None,
    state: Optional[str] = None,
    zip_code: Optional[str] = None,
    beds: Optional[int] = None,
    min_baths: Optional[float] = None,
    max_price: Optional[float] = None,
    min_price: Optional[float] = None,
    limit: int = 20,
):
    # 1. 先查 DB
    stmt = select(PropertyORM)
    if city:
        stmt = stmt.where(PropertyORM.city.ilike(f"%{city}%"))
    if state:
        stmt = stmt.where(PropertyORM.state == state)
    if zip_code:
        stmt = stmt.where(PropertyORM.zip_code == zip_code)
    if max_price:
        stmt = stmt.where(PropertyORM.list_price <= max_price)
    
    stmt = stmt.limit(min(limit * 3, 500))  # 缓冲
    result = await db.execute(stmt)
    db_properties = result.scalars().all()
    
    if len(db_properties) >= limit:
        # DB 有足够数据
        return db_properties[:limit]
    
    # 2. DB 数据不够，调 Redfin 补充
    raw_listings = await redfin.search_listings(
        city or "", state or None, limit=300
    )
    # 3. 存入 DB
    for listing in raw_listings:
        await _upsert_property(db, listing)
    
    return raw_listings[:limit]
```

### 7.2 Preload cron — 具体改动

修改 `backend/main.py` 的 APScheduler：

```python
CITIES_TO_PRELOAD = [
    ("San Francisco", "CA"), ("Los Angeles", "CA"), ("San Diego", "CA"),
    ("New York", "NY"), ("Austin", "TX"), ("Seattle", "WA"),
    ("Chicago", "IL"), ("Miami", "FL"), ("Denver", "CO"),
    ("Boston", "MA"), ("Phoenix", "AZ"), ("Atlanta", "GA"),
    ("Portland", "OR"), ("Dallas", "TX"), ("Las Vegas", "NV"),
    ("Washington", "DC"), ("Philadelphia", "PA"),
]

async def daily_preload():
    """每天增量刷新 17 个城市的新房源"""
    for city, state in CITIES_TO_PRELOAD:
        raw = await redfin.search_listings(city, state, limit=350)
        async with SessionLocal() as db:
            for listing in raw:
                await _upsert_property(db, listing)

scheduler.add_job(daily_preload, trigger="cron", hour=4, minute=0)  # 每天凌晨4点
```

---

## 8. Legal / TOS Considerations

### Redfin Scraping

**风险：** Redfin TOS 禁止未经授权的自动化数据收集

**缓解措施：**
- 限制爬虫频率（加 sleep/delay）
- 不重新发布 Redfin 数据（只用于 SpecHouse 内部搜索）
- 5 分钟缓存减少重复请求
- 考虑用 Redfin 官方 API（如果有渠道申请）

**法律观点：** 非营利性个人项目 vs 商业产品的风险不同。SpecHouse 是商业化产品，建议尽快迁移到官方 API 或付费数据源。

### MLS 数据

- MLS 数据受 NAR 规则约束，不可直接使用
- 需要通过持牌经纪人或 RPR 渠道

---

## 9. Cities Coverage Plan

| 优先级 | 城市 | 目标条数 | 预计时间 |
|--------|------|----------|----------|
| P0 | SF, LA, SD, Austin, Seattle, Miami, Phoenix, Atlanta, Portland, Dallas, LV, DC, Phil, Boston | 17 × 300+ | 今天 |
| P1 | NYC, Chicago | 特殊处理 | 1h |
| P2 | Baltimore, Charlotte, Nashville, Minneapolis, Tampa | 各 200+ | 本周 |
| P3 | Denver, Salt Lake City, Raleigh, Columbus, Indianapolis | 各 150+ | 下周 |
| P4+ | 其他主要城市 | 各 100+ | 持续补充 |

**总目标：50 个城市 × 200+ 条 = 10,000+ 真实房源**
