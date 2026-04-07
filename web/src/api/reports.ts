import { request } from './request'
import type {
  FirstSalesPersonalRow,
  FirstSalesTeamRow,
  ReportOptionsResponse,
  ReportQueryParams,
  ReportRowsResponse,
  ReportsSummaryResponse,
  SecondSalesPersonalRow,
  SecondSalesTeamRow,
  ThirdSalesPersonalRow,
  ThirdSalesTeamRow,
} from '../types'

export const fetchReportsSummary = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportsSummaryResponse>('/reports/summary', { params })
  return data
}

export const fetchReportDepartments = async (stage: 'first-sales' | 'second-sales' | 'third-sales') => {
  const { data } = await request.get<ReportOptionsResponse>('/reports/departments', { params: { stage } })
  return data
}

export const fetchFirstSalesPersonal = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<FirstSalesPersonalRow>>('/reports/first-sales/personal', { params })
  return data
}

export const fetchFirstSalesTeam = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<FirstSalesTeamRow>>('/reports/first-sales/team', { params })
  return data
}

export const fetchSecondSalesPersonal = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<SecondSalesPersonalRow>>('/reports/second-sales/personal', { params })
  return data
}

export const fetchSecondSalesTeam = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<SecondSalesTeamRow>>('/reports/second-sales/team', { params })
  return data
}

export const fetchThirdSalesPersonal = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<ThirdSalesPersonalRow>>('/reports/third-sales/personal', { params })
  return data
}

export const fetchThirdSalesTeam = async (params: ReportQueryParams = {}) => {
  const { data } = await request.get<ReportRowsResponse<ThirdSalesTeamRow>>('/reports/third-sales/team', { params })
  return data
}
