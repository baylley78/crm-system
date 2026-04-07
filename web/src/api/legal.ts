import { request } from './request'
import type { LegalCaseItem, PaginatedResponse, SalesUserOption, SaveLegalCasePayload } from '../types'

export const fetchLegalCases = async (params?: { page?: number; pageSize?: number; stage?: string }) => {
  const { data } = await request.get<PaginatedResponse<LegalCaseItem>>('/legal/cases', { params })
  return data
}

export const fetchLegalUsers = async () => {
  const { data } = await request.get<SalesUserOption[]>('/legal/users')
  return data
}

export const saveLegalCase = async (payload: SaveLegalCasePayload) => {
  const { data } = await request.post('/legal/cases', payload)
  return data
}

export const transferLegalCaseToThirdSales = async (customerId: number) => {
  const { data } = await request.post('/legal/cases/transfer-to-third-sales', { customerId })
  return data
}
