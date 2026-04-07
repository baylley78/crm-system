import { request } from './request'
import type { CourtConfigItem, CourtConfigPayload } from '../types'

export const fetchCourtConfig = async () => {
  const { data } = await request.get<CourtConfigItem>('/court-config')
  return data
}

export const saveCourtConfig = async (payload: CourtConfigPayload) => {
  const { data } = await request.put<CourtConfigItem>('/court-config', payload)
  return data
}
