import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * POST /api/social/upload
 * 上传视频到社交平台
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, account, file, title, desc, tags } = body;

    // 验证必需参数
    if (!platform || !account || !file || !title) {
      return NextResponse.json(
        { error: '缺少必需参数：platform, account, file, title' },
        { status: 400 }
      );
    }

    // 验证平台支持
    const supportedPlatforms = ['douyin', 'xiaohongshu', 'bilibili', 'kuaishou'];
    if (!supportedPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: `不支持的平台：${platform}。支持的平台：${supportedPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // 验证文件是否存在
    if (!fs.existsSync(file)) {
      return NextResponse.json(
        { error: `文件不存在：${file}` },
        { status: 404 }
      );
    }

    // 构建 sau 命令
    const commandParts = [
      'sau',
      platform,
      'upload-video',
      `--account ${account}`,
      `--file ${file}`,
      `--title "${title}"`,
    ];

    if (desc) {
      commandParts.push(`--desc "${desc}"`);
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      commandParts.push(`--tags ${tags.join(',')}`);
    }

    const command = commandParts.join(' ');

    // 设置 Lightpanda 环境变量（如果配置了）
    const lightpandaEndpoint = process.env.LIGHTPANDA_CDP_ENDPOINT || 'ws://127.0.0.1:9223';

    const env = {
      ...process.env,
      // Lightpanda CDP 端点
      LIGHTPANDA_CDP_ENDPOINT: lightpandaEndpoint,
      // 如果 sau 使用 Playwright，设置浏览器端点
      PLAYWRIGHT_CHROMIUM_URL: lightpandaEndpoint,
      // 禁用遥测（可选）
      LIGHTPANDA_DISABLE_TELEMETRY: 'true',
    };

    console.log('[Social Upload] 执行命令:', command);
    console.log('[Social Upload] 使用 Lightpanda:', lightpandaEndpoint);

    // 使用 Lightpanda 环境执行上传命令
    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5分钟超时
      env,
    });

    if (stderr && !stdout) {
      console.error('[Social Upload] 错误:', stderr);
      return NextResponse.json(
        { error: '上传失败', details: stderr },
        { status: 500 }
      );
    }

    console.log('[Social Upload] 成功:', stdout);

    return NextResponse.json({
      success: true,
      message: '上传成功',
      platform,
      output: stdout,
    });
  } catch (error: any) {
    console.error('[Social Upload] 异常:', error);

    return NextResponse.json(
      {
        error: '上传失败',
        details: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social/upload
 * 获取支持的平台列表
 */
export async function GET() {
  return NextResponse.json({
    platforms: [
      {
        id: 'douyin',
        name: '抖音',
        features: ['video', 'note'],
      },
      {
        id: 'xiaohongshu',
        name: '小红书',
        features: ['video', 'note'],
      },
      {
        id: 'bilibili',
        name: 'Bilibili',
        features: ['video'],
      },
      {
        id: 'kuaishou',
        name: '快手',
        features: ['video', 'note'],
      },
    ],
  });
}
