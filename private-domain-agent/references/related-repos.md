# 类似仓库与升级候选

以下项目可作为“私域成交智能体”的后续升级参考。优先评估安全性、稳定性、是否本地运行、是否支持确认后发送。

## 已接入

1. https://github.com/Jeremy676767/wechat-personal-message  
   微信自动化助手，通过 macOS 辅助功能实现微信消息自动发送，支持 OCR 视觉反馈校验。适合做“单联系人、确认后发送”的执行层。

2. https://github.com/Jeremy676767/wechat-ai-radar  
   微信朋友圈AI雷达，自动采集朋友圈内容，AI视觉提取、商机发现，生成结构化简报。适合做私域商机发现层。
   当前风险：仓库内主要是 Skill 与脚本入口，缺少 `automation`、`db`、`reports` 等完整运行模块；已先作为流程能力接入，采集实现需要后续补齐。

## 候选升级

1. https://github.com/BiboyQG/WeChat-MCP  
   macOS 微信 MCP，可读取最近消息、发送回复、搜索聊天、发布朋友圈文本草稿。适合把微信真正接成 Codex / Claude Code 可调用的工具。需要保留“确认后发送”。

2. https://pypi.org/project/wechat-mcp-macos/  
   macOS WeChat MCP，支持读取/搜索微信本地数据库，并通过 osascript 发送消息。适合做“客户历史聊天检索 + 跟进前上下文回顾”。涉及本地数据库解密副本，隐私配置要谨慎。

3. https://github.com/fastclaw-ai/weclaw  
   WeChat ClawBot / WeChat agent bridge。适合评估为“微信接入AI Agent”的桥接层。

4. https://github.com/chairmanmiao/wechat-macos-proxy  
   macOS微信自动化代理，SkillNav显示其通过 macOS GUI 自动化实现微信消息收发。适合比较“读取消息/发送消息”的稳定性。

5. https://github.com/tiancheng91/wechat-msg-send  
   macOS微信消息发送 Skill，通过 AppleScript 自动化发送。适合做轻量发送模块候选。

6. https://github.com/jackwener/wx-cli  
   本地微信数据 CLI，偏读取本地数据和daemon架构。适合评估“消息历史读取/客户上下文检索”。

7. https://github.com/0xranx/golembot  
   多IM桥接 Agent 项目，支持 WeChat/Feishu/Telegram/Discord 等。适合未来做“手机端指挥智能体”。

8. https://github.com/Frica01/WeChatMassTool  
   Windows微信群发工具。因涉及群发，更适合研究，不建议直接接入当前私域成交智能体。

9. https://github.com/iniwap/AIWriteX  
   公众号/多平台内容生产工具，适合补充内容生产和公众号发布链路，不适合直接做微信私域执行层。

10. https://github.com/gotoolkits/mcp-wecombot-server  
    企业微信群机器人 MCP，支持文本、Markdown、图片等消息。适合承载社群日报、资料提醒、成交案例复盘。

11. https://github.com/loonghao/wecom-bot-mcp-server  
    企业微信机器人 MCP。适合做更稳定的群内容自动化，前提是社群迁移到企微。

## 选型建议

- 当前主线：`wechat-personal-message` 半自动跟进，`wechat-ai-radar` 暂作朋友圈雷达流程壳。
- 如果要让 AI 读取聊天上下文，优先评估 `BiboyQG/WeChat-MCP` 或 `wechat-mcp-macos`。
- 如果要稳定自动发社群内容，优先评估企微机器人 MCP，不建议个人微信直接群发。
- 如果后续要手机端远程调度，评估 `weclaw` 或 `golembot`。
- 安全线：成交跟进永远默认生成草稿，只有用户明确确认才发送。
