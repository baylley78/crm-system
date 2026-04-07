import { request } from './request'
import type {
  CreateJudicialComplaintPayload,
  JudicialComplaintCaseFilters,
  JudicialComplaintCaseItem,
  JudicialComplaintCustomerSearchResult,
  PaginatedResponse,
} from '../types'

const normalizeFilters = (params: JudicialComplaintCaseFilters = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null))

export const fetchJudicialComplaintCases = async (params: JudicialComplaintCaseFilters = {}) => {
  const { data } = await request.get<PaginatedResponse<JudicialComplaintCaseItem>>('/judicial-complaints/cases', { params: normalizeFilters(params) })
  return data
}

export const fetchJudicialComplaintCaseDetail = async (id: number) => {
  const { data } = await request.get<JudicialComplaintCaseItem>(`/judicial-complaints/cases/${id}`)
  return data
}

export const searchJudicialComplaintCustomer = async (phone: string) => {
  const { data } = await request.post<JudicialComplaintCustomerSearchResult | null>('/judicial-complaints/customers/search', { phone })
  return data
}

export const createJudicialComplaintCase = async (payload: CreateJudicialComplaintPayload) => {
  const { data } = await request.post<JudicialComplaintCaseItem>('/judicial-complaints/cases', payload)
  return data
}
