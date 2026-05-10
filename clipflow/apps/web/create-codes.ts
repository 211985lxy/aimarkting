import { PrismaClient } from './src/generated/prisma/index.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function createActivationCodes() {
  try {
    // 获取第一个用户作为创建者
    const users = await prisma.user.findMany({ take: 1 });
    if (users.length === 0) {
      console.log('❌ 没有找到用户，请先注册一个账号');
      return;
    }

    const creatorId = users[0].id;
    console.log(`📧 使用用户 ${users[0].email} 创建激活码`);

    // 生成激活码
    const codes = [
      'TEST2024A',
      'TEST2024B',
      'TEST2024C',
      'DEMO1234',
      'BETA5678'
    ];

    const batchId = crypto.randomUUID();

    for (const code of codes) {
      try {
        const activationCode = await prisma.activationCode.create({
          data: {
            code: code,
            batchId: batchId,
            batchNote: '本地测试激活码',
            durationDays: 30,
            status: 'unused',
            createdBy: creatorId,
          },
        });
        console.log(`✅ ${code} - 创建成功`);
      } catch (error) {
        console.log(`❌ ${code} - 创建失败: ${error.message}`);
      }
    }

    console.log('\n🎉 激活码创建完成！');
    console.log('\n使用方法：');
    console.log('1. 先注册账号: http://localhost:3000/register');
    console.log('2. 登录后访问: http://localhost:3000/activate');
    console.log('3. 输入激活码激活账号');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createActivationCodes();
