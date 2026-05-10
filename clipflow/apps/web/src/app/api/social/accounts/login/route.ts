import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * POST /api/social/accounts/login
 * 启动社交平台账号登录流程（简化版 - 直接返回文件路径）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, account } = body;

    // 验证必需参数
    if (!platform || !account) {
      return NextResponse.json(
        { error: '缺少必需参数：platform, account' },
        { status: 400 }
      );
    }

    // 验证平台支持
    const supportedPlatforms = ['douyin', 'xiaohongshu', 'bilibili', 'kuaishou'];
    if (!supportedPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: `不支持的平台：${platform}` },
        { status: 400 }
      );
    }

    // 设置环境变量
    const lightpandaEndpoint = process.env.LIGHTPANDA_CDP_ENDPOINT || 'ws://127.0.0.1:9223';
    const env = {
      ...process.env,
      LIGHTPANDA_CDP_ENDPOINT: lightpandaEndpoint,
      PLAYWRIGHT_CHROMIUM_URL: lightpandaEndpoint,
      LIGHTPANDA_DISABLE_TELEMETRY: 'true',
    };

    // 启动登录流程（后台执行）
    const command = `sau ${platform} login --account ${account}`;
    console.log('[Social Login] 执行命令:', command);

    exec(command, {
      timeout: 120000,
      env,
    });

    // 立即返回，告诉用户二维码正在生成
    return NextResponse.json({
      success: true,
      message: '登录流程已启动',
      platform,
      account,
      qrCodeUrl: '', // 暂时为空
      instructions: '正在生成二维码，请稍候...',
      directFileUrl: `/qrcodes/${platform}.png`, // 提供直接文件访问路径
      estimatedTime: '5-10秒'
    });
  } catch (error: any) {
    console.error('[Social Login] 异常:', error);

    return NextResponse.json(
      {
        error: '登录启动失败',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/accounts/login
 * 检查二维码文件是否生成
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');
  const account = searchParams.get('account');

  if (!platform || !account) {
    return NextResponse.json(
      { error: '缺少必需参数：platform, account' },
      { status: 400 }
    );
  }

  try {
    // 查找二维码文件
    const cookiesDir = '/Users/xiangyu/Desktop/ai智能体-发布页面管理/social-auto-upload/cookies';
    const pattern = `${platform}_${account}_login_qrcode_*.png`;

    if (fs.existsSync(cookiesDir)) {
      const files = fs.readdirSync(cookiesDir);
      const qrCodeFiles = files.filter(f =>
        f.includes(platform) &&
        f.includes(account) &&
        f.includes('qrcode') &&
        f.endsWith('.png')
      );

      if (qrCodeFiles.length > 0) {
        // 复制到 public 目录
        const publicDir = path.join(process.cwd(), 'public/qrcodes');
        fs.mkdirSync(publicDir, { recursive: true });

        const latestFile = qrCodeFiles.sort((a, b) => {
          const statA = fs.statSync(path.join(cookiesDir, a));
          const statB = fs.statSync(path.join(cookiesDir, b));
          return statB.mtimeMs - statA.mtimeMs;
        })[0];

        const sourcePath = path.join(cookiesDir, latestFile);
        const targetPath = path.join(publicDir, `${platform}.png`);

        fs.copyFileSync(sourcePath, targetPath);

        // 转换为 base64
        const qrCodeBuffer = fs.readFileSync(targetPath);
        const qrCodeBase64 = qrCodeBuffer.toString('base64');

        return NextResponse.json({
          success: true,
          hasQrCode: true,
          qrCodeUrl: `data:image/png;base64,${qrCodeBase64}`,
          fileUrl: `/qrcodes/${platform}.png`,
          message: '二维码已生成'
        });
      }
    }

    // 二维码还没生成
    return NextResponse.json({
      success: true,
      hasQrCode: false,
      message: '二维码正在生成中，请稍后刷新页面',
      retryAfter: 3000
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}
