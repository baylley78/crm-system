import { request } from './request'
import type {
  BatchFinanceReviewPayload,
  FinanceReviewActionPayload,
  SalesUserOption,
  ThirdSalesCustomerSearchResult,
  ThirdSalesOrderListItem,
  ThirdSalesOrderPayload,
  ThirdSalesReceptionItem,
  PaginatedResponse,
} from '../types'

export const fetchThirdSalesUsers = async () => {
  const { data } = await request.get<SalesUserOption[]>('/third-sales/users')
  return data
}

export const fetchThirdSalesOrders = async (params?: { page?: number; pageSize?: number; paymentAccountName?: string; paymentSerialNo?: string }) => {
  const { data } = await request.get<PaginatedResponse<ThirdSalesOrderListItem>>('/third-sales/orders', { params })
  return data
}

export const fetchThirdSalesReceptions = async (params?: { page?: number; pageSize?: number }) => {
  const { data } = await request.get<PaginatedResponse<ThirdSalesReceptionItem>>('/third-sales/receptions', { params })
  return data
}

export const searchThirdSalesCustomer = async (phone: string) => {
  const { data } = await request.post<ThirdSalesCustomerSearchResult | null>('/third-sales/search', { phone })
  return data
}

export const createThirdSalesOrder = async (payload: ThirdSalesOrderPayload) => {
  const formData = new FormData()
  formData.append('phone', payload.phone)
  formData.append('thirdSalesUserId', String(payload.thirdSalesUserId))
  formData.append('productName', payload.productName)
  formData.append('paymentAmount', payload.paymentAmount)
  formData.append('paymentAccountId', String(payload.paymentAccountId))
  formData.append('paymentSerialNo', payload.paymentSerialNo)
  if (payload.orderDate) {
    formData.append('orderDate', payload.orderDate)
  }
  if (payload.paymentScreenshot) {
    formData.append('paymentScreenshot', payload.paymentScreenshot)
  }
  if (payload.customerName) {
    formData.append('customerName', payload.customerName)
  }
  if (payload.caseType) {
    formData.append('caseType', payload.caseType)
  }
  if (payload.source) {
    formData.append('source', payload.source)
  }
  if (payload.intentionLevel) {
    formData.append('intentionLevel', payload.intentionLevel)
  }
  if (payload.remark) {
    formData.append('remark', payload.remark)
  }
  for (const file of payload.evidenceFiles || []) {
    formData.append('evidenceFiles', file)
  }

  const { data } = await request.post('/third-sales/orders', formData)
  return data
}

export const updateThirdSalesOrder = async (id: number, payload: ThirdSalesOrderPayload) => {
  const formData = new FormData()
  formData.append('phone', payload.phone)
  formData.append('thirdSalesUserId', String(payload.thirdSalesUserId))
  formData.append('productName', payload.productName)
  formData.append('paymentAmount', payload.paymentAmount)
  formData.append('paymentAccountId', String(payload.paymentAccountId))
  formData.append('paymentSerialNo', payload.paymentSerialNo)
  if (payload.orderDate) {
    formData.append('orderDate', payload.orderDate)
  }
  if (payload.paymentScreenshot) {
    formData.append('paymentScreenshot', payload.paymentScreenshot)
  }
  if (payload.customerName) {
    formData.append('customerName', payload.customerName)
  }
  if (payload.caseType) {
    formData.append('caseType', payload.caseType)
  }
  if (payload.source) {
    formData.append('source', payload.source)
  }
  if (payload.intentionLevel) {
    formData.append('intentionLevel', payload.intentionLevel)
  }
  if (payload.remark) {
    formData.append('remark', payload.remark)
  }
  for (const file of payload.evidenceFiles || []) {
    formData.append('evidenceFiles', file)
  }

  const { data } = await request.patch<ThirdSalesOrderListItem>(`/third-sales/orders/${id}`, formData)
  return data
}

export const deleteThirdSalesOrder = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/third-sales/orders/${id}`)
  return data
}

export const reviewThirdSalesOrder = async (id: number, payload: FinanceReviewActionPayload) => {
  const { data } = await request.post<ThirdSalesOrderListItem>(`/third-sales/orders/${id}/finance-review`, payload)
  return data
}

export const batchReviewThirdSalesOrders = async (payload: BatchFinanceReviewPayload) => {
  const { data } = await request.post<ThirdSalesOrderListItem[]>('/third-sales/orders/finance-review/batch', payload)
  return data
}
