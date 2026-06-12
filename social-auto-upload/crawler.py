#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
ClipFlow AIM 智能体对标账号本地拦截爬虫引擎 (借鉴 MediaCrawler 精髓)
- 异步 Playwright 驱动，支持 stealth 防检测。
- 运行时拦截抖音和小红书个人主页网络响应，零逆向绕过动态指纹加密。
- 数据洗涤并进行 TikHub 规范对齐，最终以纯粹 of JSON 输出到 stdout。
- 日志以 stderr 输出，实现流式管道隔离。
"""

import os
import sys
import json
import asyncio
import argparse
import traceback

# ─── Imports with graceful fallback ───────────────────────
try:
    from patchright.async_api import async_playwright
    PLAYWRIGHT_PROVIDER = "patchright"
except ImportError:
    try:
        from playwright.async_api import async_playwright
        PLAYWRIGHT_PROVIDER = "playwright"
    except ImportError:
        print("Error: 依赖缺失。请在 python 环境中运行 'pip install playwright patchright' 并执行 'playwright install chromium'", file=sys.stderr)
        sys.exit(1)

# ─── System Level Configuration ───────────────────────────
DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# macOS 常见 Chrome 默认物理路径 (自适应查找)
MAC_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

STEALTH_JS = """
() => {
    // 1. 抹除 webdriver 特征
    try {
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
    } catch (e) {}
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. 伪造 window.chrome 属性（无头浏览器通常为空，而真实 Chrome 必须有）
    window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
    };

    // 3. 伪造 plugins 列表，使其不为空（有些检测会数 plugins 数量）
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const DummyPlugin = function() {};
            DummyPlugin.prototype = Object.create(Plugin.prototype);
            const plugin = new DummyPlugin();
            return [plugin, plugin, plugin];
        }
    });

    // 4. 伪造 languages（防止无头浏览器暴露默认的 en-US 或者是空值）
    Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
    });

    // 5. 伪造 WebGL 供应商和渲染器
    try {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) {
                return 'Intel(R) Iris(TM) Plus Graphics 640';
            }
            return getParameter.apply(this, arguments);
        };
    } catch (e) {}
}
"""

def get_executable_path():
    """多级自适应查找系统已有的浏览器"""
    if sys.platform == "darwin" and os.path.exists(MAC_CHROME_PATH):
        print(f"[Crawler] 检测到系统内置 Chrome 路径: {MAC_CHROME_PATH}", file=sys.stderr)
        return MAC_CHROME_PATH
    return None

# ─── Douyin Crawler Implement ─────────────────────────────
class DouyinCrawler:
    def __init__(self, target_url, count, headless, cdp_port=None):
        self.target_url = target_url
        self.count = count
        self.headless = headless
        self.cdp_port = cdp_port
        
        # 数据收集槽
        self.account_info = None
        self.videos = []
        self.video_comments = {} # videoId -> list of comments

    async def handle_response(self, response):
        """核心拦截机制：截获抖音主页 XHR 数据"""
        url = response.url
        try:
            # 1. 拦截博主视频/帖子列表接口
            if "/aweme/v1/web/aweme/post/" in url or "/aweme/v1/web/aweme/list/" in url:
                data = await response.json()
                items = data.get("aweme_list", [])
                if items:
                    print(f"[Crawler] [Douyin] 拦截到视频列表，成功获取 {len(items)} 条视频数据", file=sys.stderr)
                    for item in items:
                        # 转换并规范化视频数据
                        vid = item.get("aweme_id")
                        if not vid:
                            continue
                        
                        # 规避重复添加
                        if any(v["videoId"] == vid for v in self.videos):
                            continue
                        
                        video_desc = item.get("desc", "")
                        create_time = item.get("create_time", 0)
                        
                        video_media = item.get("video", {})
                        cover = video_media.get("cover", {}).get("url_list", [""])[0]
                        play_addr = video_media.get("play_addr", {}).get("url_list", [""])[0]
                        duration = round(video_media.get("duration", 0) / 1000)
                        
                        stats = item.get("statistics", {})
                        
                        self.videos.append({
                            "videoId": vid,
                            "title": video_desc,
                            "coverUrl": cover,
                            "videoUrl": play_addr,
                            "createTime": create_time,
                            "duration": duration,
                            "views": stats.get("play_count", 0),
                            "likes": stats.get("digg_count", 0),
                            "comments": stats.get("comment_count", 0),
                            "shares": stats.get("share_count", 0),
                            "collects": stats.get("collect_count", 0)
                        })

                        # 如果当前博主账号数据还没获取，首选从视频列表中的作者字段提取，保证100%精准
                        if not self.account_info:
                            author = item.get("author", {})
                            if author:
                                self.extract_account_info(author)

            # 2. 拦截单独的博主个人主页基础信息接口
            elif "/aweme/v1/web/user/profile/other/" in url:
                data = await response.json()
                user = data.get("user", {})
                if user:
                    print(f"[Crawler] [Douyin] 拦截到个人主页数据，成功解析博主画像", file=sys.stderr)
                    self.extract_account_info(user)

        except Exception as e:
            print(f"[Crawler] [Douyin] 拦截处理异常: {str(e)}", file=sys.stderr)

    def extract_account_info(self, user):
        uid = user.get("uid") or user.get("sec_uid", "")
        nickname = user.get("nickname", "")
        avatar = user.get("avatar_thumb", {}).get("url_list", [""])[0]
        
        self.account_info = {
            "platformUserId": uid,
            "nickname": nickname,
            "avatar": avatar,
            "signature": user.get("signature", ""),
            "followerCount": user.get("follower_count", 0),
            "followingCount": user.get("following_count", 0),
            "totalLikes": int(user.get("total_favorited", 0) or 0),
            "videoCount": user.get("aweme_count", 0),
            "isVerified": bool(user.get("custom_verify") or user.get("enterprise_verify_reason")),
            "verifyInfo": user.get("custom_verify") or user.get("enterprise_verify_reason", "")
        }

    async def run(self):
        print(f"[Crawler] 正在启动 {PLAYWRIGHT_PROVIDER} 抖音抓取管线...", file=sys.stderr)
        async with async_playwright() as p:
            # 浏览器启动设置
            launch_options = {
                "headless": self.headless
            }
            
            # CDP复用或物理自适应查找
            if self.cdp_port:
                print(f"[Crawler] 尝试连接本地 CDP 端口: {self.cdp_port}", file=sys.stderr)
                browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{self.cdp_port}")
                context = browser.contexts[0] if browser.contexts else await browser.new_context()
            else:
                exec_path = get_executable_path()
                if exec_path:
                    launch_options["executable_path"] = exec_path
                browser = await p.chromium.launch(**launch_options)
                context = await browser.new_context(
                    user_agent=DEFAULT_USER_AGENT,
                    viewport={"width": 1280, "height": 800}
                )

            # 注入 stealth 混淆检测
            page = await context.new_page()
            await page.add_init_script(STEALTH_JS)

            # 监听网络
            page.on("response", self.handle_response)

            print(f"[Crawler] 正在打开目标主页: {self.target_url}", file=sys.stderr)
            await page.goto(self.target_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2)

            # 模拟人类滚动页面，直至抓取到预期数量
            scroll_count = 0
            while len(self.videos) < self.count and scroll_count < 6:
                print(f"[Crawler] 向下滚动页面以加载更多... ({len(self.videos)}/{self.count})", file=sys.stderr)
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                await asyncio.sleep(1.5)
                scroll_count += 1

            # 兜底解析：若从接口未成功提取到博主个人资料，尝试从 DOM 中解析出基础的昵称与头像
            if not self.account_info:
                print("[Crawler] [WARN] 未拦截到博主资料接口，尝试从 DOM 兜底解析...", file=sys.stderr)
                try:
                    nickname = await page.locator(".user-info-name").first.text_content(timeout=3000)
                    self.account_info = {
                        "platformUserId": self.target_url.split("/")[-1].split("?")[0],
                        "nickname": nickname.strip() if nickname else "抖音博主",
                        "avatar": "",
                        "signature": "",
                        "followerCount": 0,
                        "followingCount": 0,
                        "totalLikes": 0,
                        "videoCount": len(self.videos),
                        "isVerified": False,
                        "verifyInfo": ""
                    }
                except Exception as dom_err:
                    print(f"[Crawler] [ERROR] DOM 兜底解析失败: {str(dom_err)}", file=sys.stderr)

            # Top 5 视频评论区深度抓取 (MediaCrawler 置顶评论拦截机制)
            if self.videos:
                top_5 = sorted(self.videos, key=lambda x: x["likes"], reverse=True)[:5]
                print(f"[Crawler] 正在深度抓取置顶评论，目标视频数: {len(top_5)}", file=sys.stderr)
                
                for v in top_5:
                    v_comments = []
                    
                    async def handle_comment_response(response, video_id=v["videoId"]):
                        if "/aweme/v1/web/comment/list/" in response.url:
                            try:
                                c_data = await response.json()
                                c_items = c_data.get("comments", [])
                                if c_items:
                                    for c in c_items:
                                        v_comments.append({
                                            "commentId": c.get("cid"),
                                            "text": c.get("text", ""),
                                            "likes": c.get("digg_count", 0),
                                            "createTime": c.get("create_time", 0),
                                            "isTop": c.get("stick_position", 0) > 0,
                                            "videoId": video_id
                                        })
                            except Exception:
                                pass

                    # 在新页面打开视频详情页以截获评论
                    comment_page = await context.new_page()
                    comment_page.on("response", handle_comment_response)
                    detail_url = f"https://www.douyin.com/video/{v['videoId']}"
                    
                    try:
                        await comment_page.goto(detail_url, wait_until="domcontentloaded", timeout=15000)
                        await asyncio.sleep(2) # 留时间等数据拦截
                    except Exception:
                        pass
                    finally:
                        await comment_page.close()
                    
                    self.video_comments[v["videoId"]] = v_comments[:20]

            # 优雅关闭
            if not self.cdp_port:
                await browser.close()

            # 打包组合最终数据并对齐 TikHub 的 Normalized 契约
            return {
                "account": self.account_info,
                "videos": self.videos[:self.count],
                "comments": [c for comments in self.video_comments.values() for c in comments]
            }

# ─── Xiaohongshu Crawler Implement ────────────────────────
class XiaohongshuCrawler:
    def __init__(self, target_url, count, headless, cdp_port=None):
        self.target_url = target_url
        self.count = count
        self.headless = headless
        self.cdp_port = cdp_port
        
        self.account_info = None
        self.videos = []
        self.video_comments = {}

    async def handle_response(self, response):
        """拦截小红书接口"""
        url = response.url
        try:
            # 1. 拦截笔记列表
            if "/api/sns/web/v1/user_posted" in url:
                data = await response.json()
                notes = data.get("data", {}).get("notes", [])
                if notes:
                    print(f"[Crawler] [XHS] 拦截到笔记列表，成功解析 {len(notes)} 条数据", file=sys.stderr)
                    for n in notes:
                        nid = n.get("note_id") or n.get("id")
                        if not nid:
                            continue
                        
                        if any(v["videoId"] == nid for v in self.videos):
                            continue
                        
                        title = n.get("display_title") or n.get("title") or ""
                        cover = n.get("cover", {}).get("url_default") or n.get("cover", {}).get("url", "")
                        create_time = n.get("time", 0) or int(n.get("create_time", 0) / 1000)
                        
                        interact = n.get("interact_info", {})
                        
                        self.videos.append({
                            "videoId": nid,
                            "title": title,
                            "coverUrl": cover,
                            "videoUrl": "",
                            "createTime": create_time,
                            "duration": 0,
                            "views": 0,
                            "likes": interact.get("liked_count", 0) or interact.get("liked", 0) or 0,
                            "comments": interact.get("comment_count", 0) or interact.get("comments", 0) or 0,
                            "shares": interact.get("share_count", 0) or 0,
                            "collects": interact.get("collected_count", 0) or 0
                        })

            # 2. 拦截博主详细画像
            elif "/api/sns/web/v1/user/other" in url:
                data = await response.json()
                user = data.get("data", {})
                if user:
                    print(f"[Crawler] [XHS] 拦截到博主个人资料", file=sys.stderr)
                    uid = user.get("user_id") or user.get("id", "")
                    nickname = user.get("nickname", "")
                    avatar = user.get("avatar", "")
                    
                    self.account_info = {
                        "platformUserId": uid,
                        "nickname": nickname,
                        "avatar": avatar,
                        "signature": user.get("desc", ""),
                        "followerCount": int(user.get("fans", 0) or 0),
                        "followingCount": int(user.get("follows", 0) or 0),
                        "totalLikes": int(user.get("interaction", 0) or 0),
                        "videoCount": 0,
                        "isVerified": bool(user.get("tag_list")),
                        "verifyInfo": user.get("tag_list", [{}])[0].get("name", "") if user.get("tag_list") else ""
                    }

        except Exception as e:
            print(f"[Crawler] [XHS] 拦截处理异常: {str(e)}", file=sys.stderr)

    async def run(self):
        print(f"[Crawler] 正在启动 {PLAYWRIGHT_PROVIDER} 小红书抓取管线...", file=sys.stderr)
        async with async_playwright() as p:
            launch_options = {
                "headless": self.headless
            }
            
            if self.cdp_port:
                print(f"[Crawler] 尝试连接本地 CDP 端口: {self.cdp_port}", file=sys.stderr)
                browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{self.cdp_port}")
                context = browser.contexts[0] if browser.contexts else await browser.new_context()
            else:
                exec_path = get_executable_path()
                if exec_path:
                    launch_options["executable_path"] = exec_path
                browser = await p.chromium.launch(**launch_options)
                context = await browser.new_context(
                    user_agent=DEFAULT_USER_AGENT,
                    viewport={"width": 1280, "height": 800}
                )

            page = await context.new_page()
            await page.add_init_script(STEALTH_JS)

            page.on("response", self.handle_response)

            print(f"[Crawler] 正在打开目标主页: {self.target_url}", file=sys.stderr)
            await page.goto(self.target_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2)

            scroll_count = 0
            while len(self.videos) < self.count and scroll_count < 6:
                print(f"[Crawler] 向下滚动页面以加载更多... ({len(self.videos)}/{self.count})", file=sys.stderr)
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                await asyncio.sleep(1.5)
                scroll_count += 1

            # 兜底 DOM 解析
            if not self.account_info:
                print("[Crawler] [WARN] 未拦截到小红书博主资料，尝试 DOM 兜底...", file=sys.stderr)
                try:
                    nickname = await page.locator(".name-box").first.text_content(timeout=3000)
                    self.account_info = {
                        "platformUserId": self.target_url.split("/")[-1].split("?")[0],
                        "nickname": nickname.strip() if nickname else "小红书博主",
                        "avatar": "",
                        "signature": "",
                        "followerCount": 0,
                        "followingCount": 0,
                        "totalLikes": 0,
                        "videoCount": len(self.videos),
                        "isVerified": False,
                        "verifyInfo": ""
                    }
                except Exception as dom_err:
                    print(f"[Crawler] [ERROR] DOM 兜底失败: {str(dom_err)}", file=sys.stderr)

            # Top 5 笔记置顶评论深度拦截
            if self.videos:
                top_5 = sorted(self.videos, key=lambda x: x["likes"], reverse=True)[:5]
                print(f"[Crawler] 正在深度抓取置顶评论，目标笔记数: {len(top_5)}", file=sys.stderr)
                
                for v in top_5:
                    v_comments = []
                    
                    async def handle_comment_response(response, video_id=v["videoId"]):
                        if "/api/sns/web/v2/comment/page" in response.url:
                            try:
                                c_data = await response.json()
                                c_items = c_data.get("data", {}).get("comments", [])
                                if c_items:
                                    for c in c_items:
                                        v_comments.append({
                                            "commentId": c.get("id"),
                                            "text": c.get("content", ""),
                                            "likes": c.get("like_count", 0),
                                            "createTime": int(c.get("create_time", 0) / 1000),
                                            "isTop": bool(c.get("pinned")),
                                            "videoId": video_id
                                        })
                            except Exception:
                                pass

                    comment_page = await context.new_page()
                    comment_page.on("response", handle_comment_response)
                    detail_url = f"https://www.xiaohongshu.com/explore/{v['videoId']}"
                    
                    try:
                        await comment_page.goto(detail_url, wait_until="domcontentloaded", timeout=15000)
                        await asyncio.sleep(2)
                    except Exception:
                        pass
                    finally:
                        await comment_page.close()
                    
                    self.video_comments[v["videoId"]] = v_comments[:20]

            if not self.cdp_port:
                await browser.close()

            return {
                "account": self.account_info,
                "videos": self.videos[:self.count],
                "comments": [c for comments in self.video_comments.values() for c in comments]
            }

# ─── Command Line & Output Entry ─────────────────────────
async def main():
    parser = argparse.ArgumentParser(description="ClipFlow AIM 对标分析本地 Python 拦截爬虫内核")
    parser.add_argument("--platform", required=True, choices=["douyin", "xiaohongshu"], help="抓取的目标平台")
    parser.add_argument("--url", required=True, help="博主个人主页物理 URL")
    parser.add_argument("--count", type=int, default=50, help="最多抓取视频/笔记数量")
    parser.add_argument("--headless", type=str, default="true", help="是否无头模式 ('true' 或 'false')")
    parser.add_argument("--cdp-port", type=int, default=None, help="复用本地 Chrome CDP 调试端口")

    args = parser.parse_args()
    headless_bool = args.headless.lower() == "true"

    try:
        if args.platform == "douyin":
            crawler = DouyinCrawler(args.url, args.count, headless_bool, args.cdp_port)
        else:
            crawler = XiaohongshuCrawler(args.url, args.count, headless_bool, args.cdp_port)
            
        result = await crawler.run()
        
        # 验证抓取完整性，必须输出格式正确的 JSON
        if not result or not result.get("account"):
            raise ValueError("本地爬虫未能成功拦截解析到有效的账号基本资料。")
            
        # 100% 物理向 stdout 打印纯净 JSON
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
        print(f"\n[Crawler] [Success] 抓取完成！成功获取 {len(result['videos'])} 个作品与 {len(result['comments'])} 条精选评论！", file=sys.stderr)
        sys.exit(0)

    except Exception as e:
        err_msg = f"[Crawler] [Fatal Error] 爬虫执行崩溃: {str(e)}\n{traceback.format_exc()}"
        print(err_msg, file=sys.stderr)
        
        # 封装错误响应，确保 stdout 始终是 JSON 契约以供 Node.js 稳健解析
        error_payload = {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "diagnose": "请尝试配置 '云端 API 密钥' 以启用极速云端解析，或确保您的本地网络可以流畅访问平台（可能需要配置网络代理），若问题持续，可在本地开启有头模式进行调试。"
        }
        sys.stdout.write(json.dumps(error_payload))
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    # 针对 asyncio EventLoopPolicy 在 Windows/Mac 的平滑处理
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
