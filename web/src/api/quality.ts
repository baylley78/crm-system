import { request } from './request'
import type { QualityCreatePayload, QualityRecordItem, QualityResponsibleOption } from '../types'

export const fetchQualityRecords = async (responsibleId?: number) => {
  const { data } = await request.get<QualityRecordItem[]>('/quality/records', {
    params: responsibleId ? { responsibleId } : undefined,
  })
  return data
}

export const fetchQualityResponsibles = async () => {
  const { data } = await request.get<QualityResponsibleOption[]>('/quality/responsibles')
  return data
}

export const createQualityRecord = async (payload: QualityCreatePayload) => {
  const formData = new FormData()
  formData.append('recordDate', payload.recordDate)
  formData.append('responsibleId', String(payload.responsibleId))
  formData.append('matter', payload.matter)
  formData.append('penaltyAmount', String(payload.penaltyAmount))
  if (payload.screenshot) {
    formData.append('screenshot', payload.screenshot)
  }

  const { data } = await request.post<QualityRecordItem>('/quality/records', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}
