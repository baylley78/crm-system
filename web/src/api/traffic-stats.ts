import { request } from './request'
import type {
  ReportOptionsResponse,
  ReportQueryParams,
  ReportRowsResponse,
  SaveTrafficStatPayload,
  TrafficStatDailyForm,
  TrafficStatItem,
  TrafficStatSummaryResponse,
} from '../types'

export const fetchMyTrafficStat = async (date?: string) => {
  const { data } = await request.get<TrafficStatDailyForm>('/traffic-stats/me', {
    params: date ? { date } : undefined,
  })
  return data
}

export const saveMyTrafficStat = async (payload: SaveTrafficStatPayload) => {
  const { data } = await request.post<TrafficStatItem>('/traffic-stats/me', payload)
  return data
}

export const deleteTrafficStat = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/traffic-stats/${id}`)
  return data
}

export const fetchTrafficStats = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<TrafficStatItem>>('/traffic-stats', { params })
  return data
}

export const fetchTrafficStatsSummary = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<TrafficStatSummaryResponse>('/traffic-stats/summary', { params })
  return data
}

export const fetchTrafficStatDepartments = async () => {
  const { data } = await request.get<ReportOptionsResponse>('/traffic-stats/departments')
  return data
}
