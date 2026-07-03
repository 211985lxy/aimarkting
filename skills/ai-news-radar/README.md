# AI News Radar for AIM

这个 skill 用来把“客户信源抓取”先做成可判断、可分层、可验证的流程。

## 客户信源录入表

| 客户 | 信源名称 | URL/账号 | 类型 | 是否私有 | 为什么要看它 |
|---|---|---|---|---|---|
| 示例客户 | OpenAI News | https://openai.com/news/ | 网站/RSS | 否 | 官方更新 |
| 示例客户 | 行业 newsletter | newsletter archive 或邮箱桥 | Newsletter | 是 | 产品和行业周报 |
| 示例客户 | 对标账号 | @account | X/社媒 | 否/是 | 观点和选题信号 |

## 决策顺序

1. 能用 RSS/Atom/OPML 就不用爬网页。
2. 能读公开 JSON/feed 就不复刻别人的爬虫。
3. 客户私有源进私有 OPML、环境变量、Secret 或客户隔离配置。
4. 需要登录、cookie、浏览器态的源默认跳过，除非明确做私有集成。
5. 接入前先给出决策表，再写代码。

## 适合接入 AIM 的方式

- 第一阶段：用 skill 生成客户信源决策表。
- 第二阶段：对 accepted 源做本地抓取验证，输出结构化 JSON。
- 第三阶段：有稳定客户源后，再接入 `mingyuan/apps/web` 的热点/选题/知识库链路。

Skipped for now: database schema, admin UI, scheduler, and provider-specific crawlers. Add them after the first real customer source list validates the shape.
