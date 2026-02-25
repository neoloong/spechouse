# SpecHouse 项目开发蓝图：AI 驱动的房产聚合对比平台

## 1. 项目概览 (Executive Summary)
- **定位**：房产界的 "GSMarena" + "Levels.fyi"。
- **核心理念**：极简入口（Google Style）、深度数据（Aggregated Data）、硬核对比（Spec-by-Spec）。
- **目标用户**：对数据敏感、追求决策效率、厌恶 Zillow/Redfin 广告干扰的购房者与投资者。

---

## 2. 核心功能模块 (Core Modules)

### A. 首页 (The Zen Entry)
- **UI 逻辑**：摒弃默认大地图，采用 Google 式极简搜索框。
- **智能 Feed**：基于“价值洼地（Deals）”、“生活方式（Quiet/ADU）”、“通勤偏好”进行异步加载的瀑布流。

### B. 专门对比页 (The Comparison Sanctuary)
- **多列平铺**：支持 2-4 套房产原子级参数对比。
- **视觉增强**：优势项（如单价更低、噪音更小）绿色高亮。
- **差异化视图**：一键开启“仅显示差异项（Show Diffs Only）”。

### C. 详情页 (The Deep Dive)
- **多源价格对冲**：并列展示 Zillow Zestimate, Redfin Estimate, 及其历史变动。
- **原生环境指标**：集成噪音分贝（HowLoud）、犯罪热力、PM2.5。
- **弹幕系统**：照片流之上的实时匿名评论。

---

## 3. 技术架构 (Technical Stack)

| 层级 | 推荐技术 | 理由 |
| :--- | :--- | :--- |
| **前端** | Next.js 15 (App Router) | SEO 友好，服务器组件性能极致。 |
| **样式** | Tailwind CSS + Shadcn UI | 快速构建 GSMarena 式的密集型表格。 |
| **数据库** | PostgreSQL + JSONB | 兼顾结构化搜索与多源数据的灵活性。 |
| **地理引擎** | PostGIS + Maplibre GL | 轻量、免费、高性能矢量渲染。 |
| **后端** | Node.js / Python (FastAPI) | 处理 API 聚合与 AVM 算法逻辑。 |

---

## 4. 数据 Schema 设计 (Database)

```sql
-- 房产主表：核心属性与动态数据分离
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    address_display TEXT NOT NULL,
    city VARCHAR(50),
    zip_code VARCHAR(10),
    beds INT,
    baths DECIMAL(3,1),
    sqft INT,
    list_price DECIMAL(15,2),
    
    -- 核心：存储第三方聚合数据的 JSONB 字段
    agg_data JSONB NOT NULL DEFAULT '{
        "comparisons": {
            "zillow": {"price": 0, "url": "", "trend": []},
            "redfin": {"price": 0, "url": "", "trend": []}
        },
        "environment": {
            "noise_db": 0,
            "crime_score": 0
        },
        "investment": {
            "adu_score": 0,
            "cap_rate": 0
        }
    }',
    
    geom GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX idx_properties_geom ON properties USING GIST (geom);
CREATE INDEX idx_properties_agg ON properties USING GIN (agg_data);
