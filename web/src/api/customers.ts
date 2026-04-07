import { request } from './request'
import type {
  CreateCustomerFollowPayload,
  CustomerDetail,
  CustomerFilters,
  CustomerItem,
  PaginatedResponse,
  UpdateCustomerStatusPayload,
} from '../types'

const normalizeCustomerFilters = (params: CustomerFilters = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null))

export const fetchCustomers = async (params: CustomerFilters = {}) => {
  const { data } = await request.get<PaginatedResponse<CustomerItem>>('/customers', { params: normalizeCustomerFilters(params) })
  return data
}

export const fetchCustomerDetail = async (id: number) => {
  const { data } = await request.get<CustomerDetail>(`/customers/${id}`)
  return data
}

export const createCustomerFollow = async (id: number, payload: CreateCustomerFollowPayload) => {
  const { data } = await request.post<CustomerDetail>(`/customers/${id}/follows`, payload)
  return data
}

export const updateCustomerStatus = async (id: number, payload: UpdateCustomerStatusPayload) => {
  const { data } = await request.patch<CustomerDetail>(`/customers/${id}/status`, payload)
  return data
}

export const deleteCustomer = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/customers/${id}`)
  return data
}
