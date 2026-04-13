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

export const saveInvalidLead = async (payload: SaveInvalidLeadPayload) => {
  const { data } = await request.post<InvalidLeadItem>('/invalid-leads', payload)
  return data
}
