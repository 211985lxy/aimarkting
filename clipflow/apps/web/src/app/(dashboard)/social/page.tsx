'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Video, Loader2, CheckCircle, AlertCircle, QrCode, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Platform {
  id: string;
  name: string;
  features: string[];
}

export default function SocialPublishPage() {
  const [platform, setPlatform] = useState<string>('');
  const [account, setAccount] = useState<string>('');
  const [videoFile, setVideoFile] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  // 登录相关状态
  const [loggingIn, setLoggingIn] = useState<boolean>(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [loginMessage, setLoginMessage] = useState<string>('');

  const [platforms] = useState<Platform[]>([
    { id: 'douyin', name: '抖音', features: ['video', 'note'] },
    { id: 'xiaohongshu', name: '小红书', features: ['video', 'note'] },
    { id: 'bilibili', name: 'Bilibili', features: ['video'] },
    { id: 'kuaishou', name: '快手', features: ['video', 'note'] },
  ]);

  const handleLogin = async () => {
    if (!platform) {
      setLoginMessage('请先选择平台');
      return;
    }

    // 如果账号名为空，自动生成一个默认账号名
    const accountName = account || 'default_account';

    setLoggingIn(true);
    setShowQrCode(false);
    setQrCodeUrl('');
    setLoginMessage('正在启动登录流程，请稍候...');

    try {
      // 启动登录流程
      const response = await fetch('/api/social/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, account: accountName }),
      });

      const data = await response.json();

      if (response.ok) {
        setLoginMessage(data.instructions || '登录流程已启动');

        // 开始轮询检查二维码是否生成
        const checkInterval = setInterval(async () => {
          try {
            const checkResponse = await fetch(
              `/api/social/accounts/login?platform=${platform}&account=${accountName}`
            );
            const checkData = await checkResponse.json();

            if (checkData.hasQrCode && checkData.qrCodeUrl) {
              // 二维码已生成
              clearInterval(checkInterval);
              setQrCodeUrl(checkData.qrCodeUrl);
              setShowQrCode(true);
              setLoggingIn(false);
              setLoginMessage('请使用手机APP扫描二维码登录');
            }
          } catch (error) {
            console.error('[QR Code Check] Error:', error);
          }
        }, 3000); // 每3秒检查一次

        // 30秒后停止轮询
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!showQrCode) {
            setLoggingIn(false);
            setLoginMessage('二维码生成超时，请重试或使用终端方式登录');
          }
        }, 30000);
      } else {
        setLoginMessage(data.error || '登录启动失败');
        setLoggingIn(false);
      }
    } catch (error: any) {
      setLoginMessage(error.message || '登录失败');
      setLoggingIn(false);
    }
  };

  const handleUpload = async () => {
    // 验证表单
    if (!platform || !account || !videoFile || !title) {
      setUploadResult({
        success: false,
        message: '请填写所有必需字段',
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const tagsArray = tags.split(',').map((tag) => tag.trim()).filter(Boolean);

      const response = await fetch('/api/social/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          account,
          file: videoFile,
          title,
          desc: description,
          tags: tagsArray,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: '视频上传成功！',
        });
      } else {
        setUploadResult({
          success: false,
          message: data.error || '上传失败',
        });
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || '上传失败',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file.path || file.name);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">社交平台发布</h1>
        <p className="text-muted-foreground mt-2">一键发布视频到多个社交平台</p>
      </div>

      <div className="grid gap-6">
        {/* 平台选择 */}
        <Card>
          <CardHeader>
            <CardTitle>选择平台</CardTitle>
            <CardDescription>选择要发布的社交平台和账号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="platform">平台</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="选择平台" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="account">账号名称</Label>
                <Input
                  id="account"
                  placeholder="输入账号名称（如：my_account）"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                />
              </div>
            </div>

            {platform && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">使用说明：</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>首次使用需要先登录账号</li>
                  <li>点击"登录账号"按钮扫描二维码</li>
                  <li>登录成功后再上传视频</li>
                </ol>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={handleLogin}
                  disabled={loggingIn}
                >
                  {loggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      启动中...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      登录账号
                    </>
                  )}
                </Button>

                {!account && (
                  <p className="text-xs text-muted-foreground mt-2">
                    * 请先在上方输入账号名称
                  </p>
                )}

                {loginMessage && (
                  <div className="mt-3 p-3 bg-background rounded border">
                    <p className="text-sm">{loginMessage}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 视频信息 */}
        <Card>
          <CardHeader>
            <CardTitle>视频信息</CardTitle>
            <CardDescription>填写视频标题和描述</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="video">视频文件</Label>
              <div className="flex gap-2">
                <Input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                {videoFile && (
                  <div className="text-sm text-muted-foreground flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                    已选择
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                placeholder="输入视频标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div>
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                placeholder="输入视频描述（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="tags">标签</Label>
              <Input
                id="tags"
                placeholder="输入标签，用逗号分隔（如：科技, AI, 创新）"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={uploading}
              />
            </div>
          </CardContent>
        </Card>

        {/* 上传按钮 */}
        <Button
          onClick={handleUpload}
          disabled={uploading || !platform || !account || !videoFile || !title}
          size="lg"
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              发布到社交平台
            </>
          )}
        </Button>

        {/* 上传结果 */}
        {uploadResult && (
          <Card
            className={
              uploadResult.success
                ? 'border-green-500 bg-green-50'
                : 'border-red-500 bg-red-50'
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {uploadResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      uploadResult.success ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {uploadResult.success ? '成功' : '失败'}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      uploadResult.success ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {uploadResult.message}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 二维码弹窗 - 使用 Dialog 组件 */}
      <Dialog open={showQrCode} onOpenChange={setShowQrCode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>扫描二维码登录</DialogTitle>
            <DialogDescription>
              使用{platforms.find(p => p.id === platform)?.name}APP扫描二维码完成登录
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            {qrCodeUrl && (
              <div className="relative">
                <img
                  src={qrCodeUrl}
                  alt="登录二维码"
                  className="w-64 h-64 border-2 border-border rounded-lg"
                />
              </div>
            )}
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">
                请用{platforms.find(p => p.id === platform)?.name}APP扫描二维码
              </p>
              <p className="text-xs text-muted-foreground">
                登录窗口将在30秒后自动关闭
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
