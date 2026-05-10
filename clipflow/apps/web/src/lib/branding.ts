import { prisma } from "./prisma"
import { redis } from "./redis"
import { withCache } from "./cache"
import {
  BRANDING_SETTING_KEYS,
  FALLBACK_BRANDING,
  isBrandingSettingKey,
  type BrandingConfig,
} from "./branding-config"

const BRANDING_CACHE_KEY = "system:branding:v1"
const BRANDING_CACHE_TTL_SECONDS = 60 * 60

export async function getBrandingConfig(): Promise<BrandingConfig> {
  try {
    return await withCache(BRANDING_CACHE_KEY, BRANDING_CACHE_TTL_SECONDS, async () => {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: Object.values(BRANDING_SETTING_KEYS),
          },
        },
      })

      const values = new Map(settings.map((setting) => [setting.key, setting.value]))

      return {
        name: values.get(BRANDING_SETTING_KEYS.name) || FALLBACK_BRANDING.name,
        logoUrl: values.get(BRANDING_SETTING_KEYS.logoUrl) || FALLBACK_BRANDING.logoUrl,
        defaultName:
          values.get(BRANDING_SETTING_KEYS.defaultName)
          || FALLBACK_BRANDING.defaultName,
        defaultLogoUrl:
          values.get(BRANDING_SETTING_KEYS.defaultLogoUrl)
          || FALLBACK_BRANDING.defaultLogoUrl,
      }
    })
  } catch {
    return FALLBACK_BRANDING
  }
}

export async function invalidateBrandingCache() {
  try {
    await redis.del(BRANDING_CACHE_KEY)
  } catch {
    // Cache eviction failure must not block settings writes.
  }
}

export { isBrandingSettingKey }
