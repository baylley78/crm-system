import { request } from './request'
import type { ApprovalActionPayload, ApprovalCreatePayload, ApprovalListItem, ApprovalListResponse, ApprovalQueryParams } from '../types'

export const fetchApprovals = async (params: ApprovalQueryParams = {}) => {
  const { data } = await request.get<ApprovalListResponse>('/approvals', { params })
  return data
}

export const createApproval = async (payload: ApprovalCreatePayload) => {
  const { data } = await request.post<ApprovalListItem>('/approvals', payload)
  return data
}

export const actionApproval = async (id: number, payload: ApprovalActionPayload) => {
  const { data } = await request.post<ApprovalListItem>(`/approvals/${id}/action`, payload)
  return data
}

export const payApproval = async (id: number, payload: { remark?: string } = {}) => {
  const { data } = await request.post<ApprovalListItem>(`/approvals/${id}/pay`, payload)
  return data
}
