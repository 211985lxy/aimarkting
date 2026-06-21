import { readFile } from "fs/promises"
import path from "path"

let cachedMethodology: string | null = null

export async function buildBusinessDiagnosisMethodologyBlock(): Promise<string> {
  if (cachedMethodology !== null) return cachedMethodology

  const candidates = [
    path.resolve(process.cwd(), "../../docs/business-diagnosis-methodology-core.md"),
    path.resolve(process.cwd(), "mingyuan/docs/business-diagnosis-methodology-core.md"),
  ]

  for (const file of candidates) {
    try {
      const content = await readFile(file, "utf8")
      cachedMethodology = `\n\n=== 商业诊断方法论库 ===\n${content.trim()}\n`
      return cachedMethodology
    } catch {
      // ponytail: two deploy cwd shapes; ignore missing candidate and try the next.
    }
  }

  cachedMethodology = ""
  return cachedMethodology
}

