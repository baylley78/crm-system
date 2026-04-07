export interface LoginPayload {
  phone: string
  password: string
}

export interface CurrentUser {
  id: number
  username: string
  realName: string
  phone?: string
  roleCode: string
  roleName: string
  departmentId?: number
  department?: string
  permissions: string[]
  customerScope: 'SELF' | 'DEPARTMENT' | 'DEPARTMENT_AND_CHILDREN' | 'ALL'
  reportScope: 'SELF' | 'DEPARTMENT' | 'DEPARTMENT_AND_CHILDREN' | 'ALL'
}

export interface LoginResponse {
  token: string
  user: CurrentUser
}

const TOKEN_KEY = 'crm_token'
const USER_KEY = 'crm_user'

export const authStorage = {
  getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  },
  setSession(token: string, user: CurrentUser) {
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  },
  getUser(): CurrentUser | null {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  },
}
