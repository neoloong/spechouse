# Reddit 水军测试计划

## 目标社群

### 1. r/realestate
- **定位**: 房产投资专业人士和买家
- **角度**: "Built a better property search with noise/crime data - feedback?"
- **内容**: 展示独特功能（噪音/犯罪评分、对比功能）

### 2. r/Austin (及其他城市分版)
- **定位**: 本地买房者
- **角度**: "Austin house hunting? Check out this new tool I built"
- **内容**: 本地化示例 + 真实数据

### 3. r/python
- **定位**: 开发者社区
- **角度**: "Wrote Next.js + FastAPI real estate scraper"
- **内容**: 技术栈 + 开源链接 + 性能提升

## 帖子模板

### r/realestate 模板
```
Built a property comparison tool to solve my own house hunting frustration. 

Unlike Zillow, SpecHouse shows:
• Noise levels & crime scores (way more important than you think!)
• Side-by-side comparison of up to 4 properties
• Investment metrics (rental yield, cap rate)

Trying to solve: "How do you compare the 15 listings you've saved" problem

Built with Next.js + FastAPI, 100% free. Looking for feedback!

https://spechouse.vercel.app
```

### r/Austin 模板
```
Austin house hunting folks - built something that might help.

SpecHouse lets you compare Austin properties with data Zillow doesn't show:
• Real noise/crime scores for each neighborhood
• Investment indicators
• Clean comparison interface

Here's how it looks for South Austin:
[截图示例 1]
[对比效果截图 2]

Completely free, just trying to make house hunting suck less: 

https://spechouse.vercel.app/listings?city=Austin
```

### r/python 模板
```
r/python - deployed a Next.js/FastAPI real estate tool that beats the big guys

Python stack:
• FastAPI + PostgreSQL + GeoAlchemy2 for spatial queries
• BeautifulSoup for Redfin scraping (no API costs!)
• Async enrichment with noise/crime/schools data

Frontend:
• Next.js 15 with App Router
• Debounced search + progressive loading
• GIS data visualization

Open sourced the whole thing: github.com/neoloong/spechouse

Live demo: https://spechouse.vercel.app

Technical challenges solved:
- Spatial indexing for map view performance
- Background task system for data enrichment
- Avoiding Redfin rate limits

Would love technical feedback!
```

## 执行计划

1. **今天**: r/python 帖子 (最容易获得建设性反馈)
2. **明天**: r/realestate (专业用户)
3. **后天**: r/Austin + r/SanFrancisco (本地用户)

## 成功指标
- 点击率 > 5%
- 留言数 > 10 个
- GitHub stars > 5 个
- 直访问问 > 50 次/天

## 备注
- 准备好回复常见问题
- 记录所有反馈到 `spechouse/feedback.md`
- 监控 GA4 实时流量