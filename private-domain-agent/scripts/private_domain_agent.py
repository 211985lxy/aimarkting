#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RADAR = ROOT / "repos" / "wechat-ai-radar"
MESSAGE = ROOT / "repos" / "wechat-personal-message"
WECHAT_MCP = ROOT / "repos" / "WeChat-MCP"
WX_CLI = ROOT / "repos" / "wx-cli"
WECHAT_PROXY = ROOT / "repos" / "wechat-macos-proxy"
VENV_PYTHON = ROOT / ".venv" / "bin" / "python"


def python_bin():
    return VENV_PYTHON if VENV_PYTHON.exists() else Path(sys.executable)


def run(cmd, cwd=None):
    print("+ " + " ".join(str(x) for x in cmd), file=sys.stderr)
    return subprocess.call([str(x) for x in cmd], cwd=str(cwd) if cwd else None)


def check():
    print("私域成交智能体环境检查")
    print("=" * 40)
    ok = True
    for name, path in [("朋友圈AI雷达", RADAR), ("微信消息助手", MESSAGE)]:
        exists = path.exists()
        print(f"{name}: {'OK' if exists else 'MISSING'} - {path}")
        ok = ok and exists

    automator = MESSAGE / "scripts" / "wechat_automator.py"
    if automator.exists():
        print("\n检查微信消息助手权限:")
        code = run([python_bin(), automator, "check"], cwd=MESSAGE)
        ok = ok and (code == 0)
    else:
        print("\n未找到 wechat_automator.py")
        ok = False
    return 0 if ok else 1


def modules():
    items = [
        ("wechat-personal-message", MESSAGE, "已接入：单联系人确认后发送、OCR校验"),
        ("wechat-ai-radar", RADAR, "流程壳：朋友圈商机雷达，完整采集模块待补齐"),
        ("WeChat-MCP", WECHAT_MCP, "候选：读取最近聊天、确认后回复、朋友圈文本草稿"),
        ("wx-cli", WX_CLI, "候选：读取本地微信历史、搜索、朋友圈缓存"),
        ("wechat-macos-proxy", WECHAT_PROXY, "候选：GUI自动化发送/读取/导出，批量发送默认禁用"),
    ]
    print("私域成交智能体本地模块")
    print("=" * 40)
    for name, path, note in items:
        print(f"{name}: {'OK' if path.exists() else 'MISSING'}")
        print(f"  位置: {path}")
        print(f"  用途: {note}")
    return 0


def radar(command):
    script = RADAR / "scripts" / "wechat_radar.sh"
    if not script.exists():
        print(f"未找到雷达脚本: {script}", file=sys.stderr)
        return 1

    missing = [
        item for item in ["automation", "db", "reports", "run_300.py", "config.py"]
        if not (RADAR / item).exists()
    ]
    if missing and command in {"collect", "full", "report", "status", "open"}:
        print("朋友圈AI雷达当前仓库缺少完整运行模块，已先作为 Skill/流程说明接入。")
        print(f"缺少: {', '.join(missing)}")
        print("可用动作: 用 draft 生成跟进话术；等补齐雷达实现后再运行采集/状态/报告。")
        print(f"仓库位置: {RADAR}")
        return 2

    return run(["bash", script, command], cwd=RADAR)


def draft(args):
    scenario = args.scenario or "客户跟进"
    customer = args.customer or "客户"
    need = args.need or "对AI商业变现感兴趣"
    tone = args.tone or "真诚、直接、有商业判断"

    print(f"场景：{scenario}")
    print(f"对象：{customer}")
    print(f"需求：{need}")
    print()
    print("版本A｜自然欢迎版")
    print(f"{customer}，欢迎进群。你这个情况我建议先别急着追工具，先把自己的业务场景拆清楚。")
    print("群里先看《AI商业变现7步法》，然后你可以把你现在做什么、想用AI解决什么、最卡在哪里发我，我帮你判断先从哪一步开始。")
    print()
    print("版本B｜专业引导版")
    print(f"欢迎加入。这个群不是工具群，主要帮大家把AI接进内容、获客和成交系统。你现在的核心问题是：{need}。")
    print("建议你先按资料里的7步法做一次自测：场景、资产、选题、脚本、IP、承接、复盘。做完以后我们再看哪个环节最接近变现。")
    print()
    print("版本C｜轻成交版")
    print("如果你后面想更快落地，可以先把你的账号/业务/产品发我，我给你一个初步判断：适合做个人IP、老板IP，还是AI短视频市场部。")
    print()
    print(f"风格要求：{tone}")
    return 0


def send(args):
    if not args.confirm_send:
        print("安全拦截：发送微信消息必须显式传入 --confirm-send。")
        print("当前只展示将发送的内容：")
        print(f"联系人：{args.contact}")
        print(f"消息：{args.message}")
        return 2

    automator = MESSAGE / "scripts" / "wechat_automator.py"
    if not automator.exists():
        print(f"未找到发送脚本: {automator}", file=sys.stderr)
        return 1
    return run([python_bin(), automator, "send", "-c", args.contact, "-m", args.message], cwd=MESSAGE)


def main():
    parser = argparse.ArgumentParser(description="李相宇私域成交智能体")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("check", help="检查两个本地模块和微信权限")
    sub.add_parser("modules", help="查看已接入/候选模块")

    radar_parser = sub.add_parser("radar", help="朋友圈AI雷达")
    radar_parser.add_argument("radar_command", choices=["briefing", "collect", "full", "report", "status", "open"])

    draft_parser = sub.add_parser("draft", help="生成客户跟进话术")
    draft_parser.add_argument("--scenario")
    draft_parser.add_argument("--customer")
    draft_parser.add_argument("--need")
    draft_parser.add_argument("--tone")

    send_parser = sub.add_parser("send", help="发送单条微信消息")
    send_parser.add_argument("--contact", required=True)
    send_parser.add_argument("--message", required=True)
    send_parser.add_argument("--confirm-send", action="store_true")

    args = parser.parse_args()
    if args.command == "check":
        return check()
    if args.command == "modules":
        return modules()
    if args.command == "radar":
        return radar(args.radar_command)
    if args.command == "draft":
        return draft(args)
    if args.command == "send":
        return send(args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
