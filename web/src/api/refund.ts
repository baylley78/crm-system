import { request } from './request'
import type {
  AssignRefundCasePayload,
  CloseRefundCasePayload,
  CreateRefundCasePayload,
  FollowRefundCasePayload,
  PaginatedResponse,
  RefundCaseFilters,
  RefundCaseItem,
  RefundFirstSalesDepartmentOption,
  ReviewRefundCasePayload,
  SalesUserOption,
} from '../types'

const normalizeRefundFilters = (params: RefundCaseFilters = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null))

export const fetchRefundCases = async (params: RefundCaseFilters = {}) => {
  const { data } = await request.get<PaginatedResponse<RefundCaseItem>>('/refund/cases', { params: normalizeRefundFilters(params) })
  return data
}

export const fetchRefundCaseDetail = async (id: number) => {
  const { data } = await request.get<RefundCaseItem>(`/refund/cases/${id}`)
  return data
}

export const fetchRefundUsers = async () => {
  const { data } = await request.get<SalesUserOption[]>('/refund/users')
  return data
}

export const fetchRefundFirstSalesDepartments = async () => {
  const { data } = await request.get<RefundFirstSalesDepartmentOption[]>('/refund/first-sales-departments')
  return data
}

export const createRefundCase = async (payload: CreateRefundCasePayload) => {
  const { data } = await request.post<RefundCaseItem>('/refund/cases', payload)
  return data
}

export const updateRefundFirstSalesDepartment = async (id: number, payload: { firstSalesDepartmentId?: number }) => {
  const { data } = await request.patch<RefundCaseItem>(`/refund/cases/${id}/first-sales-department`, payload)
  return data
}

export const reviewRefundCase = async (id: number, payload: ReviewRefundCasePayload) => {
  const { data } = await request.post<RefundCaseItem>(`/refund/cases/${id}/review`, payload)
  return data
}

export const assignRefundCase = async (id: number, payload: AssignRefundCasePayload) => {
  const { data } = await request.post<RefundCaseItem>(`/refund/cases/${id}/assign`, payload)
  return data
}

export const followRefundCase = async (id: number, payload: FollowRefundCasePayload) => {
  const { data } = await request.post<RefundCaseItem>(`/refund/cases/${id}/follow`, payload)
  return data
}

export const closeRefundCase = async (id: number, payload: CloseRefundCasePayload) => {
  const { data } = await request.post<RefundCaseItem>(`/refund/cases/${id}/close`, payload)
  return data
}

export const deleteRefundCase = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/refund/cases/${id}`)
  return data
}
