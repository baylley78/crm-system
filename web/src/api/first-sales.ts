import { request } from './request'
import type {
  BatchFinanceReviewPayload,
  FinanceReviewActionPayload,
  FirstSalesForm,
  FirstSalesCreateResult,
  FirstSalesListItem,
  FirstSalesTailOrderPayload,
  SalesUserOption,
} from '../types'

const toFirstSalesFormData = (payload: FirstSalesForm) => {
  const formData = new FormData()
  formData.append('customerName', payload.customerName)
  formData.append('phone', payload.phone)
  formData.append('wechat', payload.wechat || '')
  formData.append('gender', payload.gender || '')
  formData.append('age', payload.age ? String(payload.age) : '')
  formData.append('province', payload.province || '')
  formData.append('city', payload.city || '')
  formData.append('source', payload.source || '')
  formData.append('caseType', payload.caseType || '')
  formData.append('intentionLevel', payload.intentionLevel || '')
  formData.append('salesUserId', String(payload.salesUserId))
  formData.append('orderType', payload.orderType)
  formData.append('isTimelyDeal', String(payload.isTimelyDeal))
  formData.append('targetAmount', String(payload.targetAmount))
  formData.append('contractAmount', String(payload.contractAmount))
  formData.append('paymentAmount', String(payload.paymentAmount))
  formData.append('arrearsAmount', String(payload.arrearsAmount))
  formData.append('paymentAccountId', String(payload.paymentAccountId))
  formData.append('paymentSerialNo', payload.paymentSerialNo)
  if (payload.orderDate) {
    formData.append('orderDate', payload.orderDate)
  }
  if (payload.remark) {
    formData.append('remark', payload.remark)
  }
  if (payload.paymentScreenshot) {
    formData.append('paymentScreenshot', payload.paymentScreenshot)
  }
  if (payload.chatRecordFile) {
    formData.append('chatRecordFile', payload.chatRecordFile)
  }
  for (const file of payload.evidenceImages || []) {
    formData.append('evidenceImages', file)
  }
  return formData
}

const toFirstSalesTailFormData = (payload: FirstSalesTailOrderPayload) => {
  const formData = new FormData()
  formData.append('salesUserId', String(payload.salesUserId))
  formData.append('isTimelyDeal', String(payload.isTimelyDeal))
  formData.append('targetAmount', String(payload.targetAmount))
  formData.append('contractAmount', String(payload.contractAmount))
  formData.append('paymentAmount', String(payload.paymentAmount))
  formData.append('arrearsAmount', String(payload.arrearsAmount))
  formData.append('paymentAccountId', String(payload.paymentAccountId))
  formData.append('paymentSerialNo', payload.paymentSerialNo)
  if (payload.orderDate) {
    formData.append('orderDate', payload.orderDate)
  }
  if (payload.remark) {
    formData.append('remark', payload.remark)
  }
  if (payload.paymentScreenshot) {
    formData.append('paymentScreenshot', payload.paymentScreenshot)
  }
  if (payload.chatRecordFile) {
    formData.append('chatRecordFile', payload.chatRecordFile)
  }
  for (const file of payload.evidenceImages || []) {
    formData.append('evidenceImages', file)
  }
  return formData
}

export const fetchFirstSalesOrders = async (params?: { paymentAccountName?: string; paymentSerialNo?: string; tailPaymentSerialNo?: string }) => {
  const { data } = await request.get<FirstSalesListItem[]>('/first-sales/orders', { params })
  return data
}

export const fetchFirstSalesUsers = async () => {
  const { data } = await request.get<SalesUserOption[]>('/first-sales/users')
  return data
}

export const createFirstSalesOrder = async (payload: FirstSalesForm) => {
  const { data } = await request.post<FirstSalesCreateResult>('/first-sales/orders', toFirstSalesFormData(payload), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const createFirstSalesTailOrder = async (customerId: number, payload: FirstSalesTailOrderPayload) => {
  const { data } = await request.post<FirstSalesCreateResult>(`/first-sales/customers/${customerId}/tail-order`, toFirstSalesTailFormData(payload), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const updateFirstSalesOrder = async (id: number, payload: FirstSalesForm) => {
  const { data } = await request.patch<FirstSalesListItem>(`/first-sales/orders/${id}`, toFirstSalesFormData(payload), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const deleteFirstSalesOrder = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/first-sales/orders/${id}`)
  return data
}

export const reviewFirstSalesOrder = async (id: number, payload: FinanceReviewActionPayload) => {
  const { data } = await request.post<FirstSalesListItem>(`/first-sales/orders/${id}/finance-review`, payload)
  return data
}

export const batchReviewFirstSalesOrders = async (payload: BatchFinanceReviewPayload) => {
  const { data } = await request.post<FirstSalesListItem[]>('/first-sales/orders/finance-review/batch', payload)
  return data
}
