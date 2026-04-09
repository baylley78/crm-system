import { request } from './request'
import type { ApprovalActionPayload, ApprovalCreatePayload, ApprovalListItem, ApprovalListResponse, ApprovalQueryParams } from '../types'

export const fetchApprovals = async (params: ApprovalQueryParams = {}) => {
  const { data } = await request.get<ApprovalListResponse>('/approvals', { params })
  return data
}

export const createApproval = async (payload: ApprovalCreatePayload) => {
  const formData = new FormData()

  if (payload.customerId) {
    formData.append('customerId', String(payload.customerId))
  }

  formData.append('approvalType', payload.approvalType)
  formData.append('title', payload.title)
  formData.append('reason', payload.reason)

  if (payload.amount !== undefined) {
    formData.append('amount', String(payload.amount))
  }
  if (payload.leaveDays !== undefined) {
    formData.append('leaveDays', String(payload.leaveDays))
  }
  if (payload.punchDate) {
    formData.append('punchDate', payload.punchDate)
  }
  if (payload.punchTime) {
    formData.append('punchTime', payload.punchTime)
  }
  if (payload.reimbursementAccountName) {
    formData.append('reimbursementAccountName', payload.reimbursementAccountName)
  }
  if (payload.reimbursementPayeeName) {
    formData.append('reimbursementPayeeName', payload.reimbursementPayeeName)
  }
  if (payload.reimbursementBankName) {
    formData.append('reimbursementBankName', payload.reimbursementBankName)
  }
  if (payload.reimbursementCardNo) {
    formData.append('reimbursementCardNo', payload.reimbursementCardNo)
  }
  if (payload.reimbursementVoucher) {
    formData.append('reimbursementVoucher', payload.reimbursementVoucher)
  }
  if (payload.reimbursementVoucherUrl) {
    formData.append('reimbursementVoucherUrl', payload.reimbursementVoucherUrl)
  }
  if (payload.remark) {
    formData.append('remark', payload.remark)
  }

  const { data } = await request.post<ApprovalListItem>('/approvals', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
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
