import { request } from './request'
import type {
  InvalidLeadItem,
  ReportOptionsResponse,
  ReportQueryParams,
  ReportRowsResponse,
  SaveInvalidLeadPayload,
} from '../types'

export const fetchInvalidLeads = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<InvalidLeadItem>>('/invalid-leads', { params })
  return data
}

export const fetchInvalidLeadDepartments = async () => {
  const { data } = await request.get<ReportOptionsResponse>('/invalid-leads/departments')
  return data
}

export const deleteInvalidLead = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/invalid-leads/${id}`)
  return data
}

export const batchDeleteInvalidLeads = async (ids: number[]) => {
  const { data } = await request.post<{ success: boolean; count: number }>('/invalid-leads/batch-delete', { ids })
  return data
}

export const saveInvalidLead = async (payload: SaveInvalidLeadPayload) => {
  const { data } = await request.post<InvalidLeadItem>('/invalid-leads', payload)
  return data
}
