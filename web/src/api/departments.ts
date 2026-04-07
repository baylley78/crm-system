import { request } from './request'
import type { DepartmentTreeItem, DepartmentUpsertPayload } from '../types'

export const fetchDepartmentTree = async () => {
  const { data } = await request.get<DepartmentTreeItem[]>('/departments/tree')
  return data
}

export const createDepartment = async (payload: DepartmentUpsertPayload) => {
  const { data } = await request.post('/departments', payload)
  return data
}

export const updateDepartment = async (id: number, payload: DepartmentUpsertPayload) => {
  const { data } = await request.patch(`/departments/${id}`, payload)
  return data
}

export const deleteDepartment = async (id: number) => {
  const { data } = await request.delete(`/departments/${id}`)
  return data
}
