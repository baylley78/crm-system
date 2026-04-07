import { request } from './request'
import type { DingTalkReportConfigItem, DingTalkReportConfigPayload } from '../types'

export const fetchDingTalkReportConfigs = async () => {
  const { data } = await request.get<DingTalkReportConfigItem[]>('/dingtalk-report-configs')
  return data
}

export const createDingTalkReportConfig = async (payload: DingTalkReportConfigPayload) => {
  const { data } = await request.post<DingTalkReportConfigItem>('/dingtalk-report-configs', payload)
  return data
}

export const updateDingTalkReportConfig = async (id: number, payload: Partial<DingTalkReportConfigPayload>) => {
  const { data } = await request.patch<DingTalkReportConfigItem>(`/dingtalk-report-configs/${id}`, payload)
  return data
}
