/** 解析 JWT payload，失败返回 null */
function parsePayload(token: string): { exp?: number } | null {
  try {
    const base64 = token.split('.')[1]
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** 判断 token 是否已过期（不存在或解析失败视为过期） */
export function isTokenExpired(): boolean {
  const token = localStorage.getItem('auth_token')
  if (!token) return true
  const payload = parsePayload(token)
  if (!payload?.exp) return true
  return Date.now() / 1000 > payload.exp
}
