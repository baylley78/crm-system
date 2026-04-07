import { request } from './request'
import type { LoginPayload, LoginResponse } from '../auth'
import type {
  BatchAssignRoleUsersPayload,
  BatchUpdateUserStatusPayload,
  CopyRolePayload,
  CreateRolePayload,
  PermissionItem,
  RegisterPayload,
  RoleOption,
  RoleUserAssignmentResponse,
  SystemUserItem,
  SystemUserPayload,
  UpdateRoleMetaPayload,
  UpdateRolePermissionsPayload,
} from '../types'

export const login = async (payload: LoginPayload) => {
  const { data } = await request.post<LoginResponse>('/auth/login', payload)
  return data
}

export const register = async (payload: RegisterPayload) => {
  const { data } = await request.post<{ success: boolean; message: string }>('/auth/register', payload)
  return data
}

export const fetchRoles = async () => {
  const { data } = await request.get<RoleOption[]>('/auth/roles')
  return data
}

export const createRole = async (payload: CreateRolePayload) => {
  const { data } = await request.post<RoleOption>('/auth/roles', payload)
  return data
}

export const updateRoleMeta = async (id: number, payload: UpdateRoleMetaPayload) => {
  const { data } = await request.patch<RoleOption>(`/auth/roles/${id}/meta`, payload)
  return data
}

export const copyRole = async (id: number, payload: CopyRolePayload) => {
  const { data } = await request.post<RoleOption>(`/auth/roles/${id}/copy`, payload)
  return data
}

export const deleteRole = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/auth/roles/${id}`)
  return data
}

export const fetchPermissions = async () => {
  const { data } = await request.get<PermissionItem[]>('/auth/permissions')
  return data
}

export const syncBuiltInRolePermissions = async () => {
  const { data } = await request.post<{ success: boolean; count: number }>('/auth/roles/sync-built-in')
  return data
}

export const fetchCurrentUser = async () => {
  const { data } = await request.get<LoginResponse['user']>('/auth/me')
  return data
}

export const fetchSystemUsers = async () => {
  const { data } = await request.get<SystemUserItem[]>('/auth/users')
  return data
}

export const createSystemUser = async (payload: SystemUserPayload) => {
  const { data } = await request.post<SystemUserItem>('/auth/users', payload)
  return data
}

export const updateSystemUser = async (id: number, payload: SystemUserPayload) => {
  const { data } = await request.patch<SystemUserItem>(`/auth/users/${id}`, payload)
  return data
}

export const updateSystemUsersStatusBatch = async (payload: BatchUpdateUserStatusPayload) => {
  const { data } = await request.patch<{ success: boolean; count: number }>('/auth/users/status/batch', payload)
  return data
}

export const deleteSystemUser = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/auth/users/${id}`)
  return data
}

export const updateRolePermissions = async (id: number, payload: UpdateRolePermissionsPayload) => {
  const { data } = await request.patch<RoleOption>(`/auth/roles/${id}/permissions`, payload)
  return data
}

export const fetchRoleUsers = async (id: number) => {
  const { data } = await request.get<RoleUserAssignmentResponse>(`/auth/roles/${id}/users`)
  return data
}

export const assignUsersToRole = async (id: number, payload: BatchAssignRoleUsersPayload) => {
  const { data } = await request.patch<RoleUserAssignmentResponse>(`/auth/roles/${id}/users`, payload)
  return data
}
