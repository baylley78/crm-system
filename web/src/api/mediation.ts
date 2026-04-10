import { request } from './request'
import type { MediationCaseItem, PaginatedResponse, SalesUserOption, SaveMediationCasePayload } from '../types'

const buildMediationFormData = (payload: SaveMediationCasePayload) => {
  const formData = new FormData()
  formData.append('customerId', String(payload.customerId))
  formData.append('progressStatus', payload.progressStatus)
  if (payload.mediationResult) {
    formData.append('mediationResult', payload.mediationResult)
  }
  if (payload.remark) {
    formData.append('remark', payload.remark)
  }
  if (payload.startDate) {
    formData.append('startDate', payload.startDate)
  }
  if (payload.ownerId) {
    formData.append('ownerId', String(payload.ownerId))
  }
  for (const file of payload.evidenceFiles || []) {
    formData.append('evidenceFiles', file)
  }
  return formData
}

export const fetchMediationCases = async (params: { page?: number; pageSize?: number } = {}) => {
  const { data } = await request.get<PaginatedResponse<MediationCaseItem>>('/mediation/cases', { params })
  return data
}

export const fetchMediationUsers = async () => {
  const { data } = await request.get<SalesUserOption[]>('/mediation/users')
  return data
}

export const followMediationCase = async (payload: SaveMediationCasePayload) => {
  const { data } = await request.post('/mediation/cases/follow', buildMediationFormData(payload))
  return data
}

export const completeMediationCase = async (payload: SaveMediationCasePayload) => {
  const { data } = await request.post('/mediation/cases/complete', buildMediationFormData(payload))
  return data
}
