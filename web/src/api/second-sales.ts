import { request } from './request'
import type {
  BatchFinanceReviewPayload,
  FinanceReviewActionPayload,
  SecondSalesAssignmentItem,
  SalesUserOption,
  SecondSalesCustomerSearchResult,
  SecondSalesAssignPayload,
  SecondSalesOrderListItem,
  SecondSalesOrderPayload,
  TransferToMediationPayload,
  PaginatedResponse,
} from '../types'

export const fetchSecondSalesAssignments = async () => {
  const { data } = await request.get<SecondSalesAssignmentItem[]>('/second-sales/assignments')
  return data
}

export const fetchSecondSalesUsers = async () => {
  const { data } = await request.get<SalesUserOption[]>('/second-sales/users')
  return data
}

export const fetchSecondSalesOrders = async (params?: {
  page?: number
  pageSize?: number
  customerName?: string
  phone?: string
  firstSalesUserName?: string
  paymentAccountName?: string
  paymentSerialNo?: string
  tailPaymentSerialNo?: string
  paymentStatus?: string
  departmentId?: string
  financeReviewStatus?: string
  startTime?: string
  endTime?: string
}) => {
  const { data } = await request.get<PaginatedResponse<SecondSalesOrderListItem>>('/second-sales/orders', { params })
  return data
}

export const searchCustomerByPhone = async (phone: string) => {
  const { data } = await request.post<SecondSalesCustomerSearchResult | null>('/second-sales/search', { phone })
  return data
}

export const assignSecondSales = async (payload: SecondSalesAssignPayload) => {
  const { data } = await request.post('/second-sales/assignments', payload)
  return data
}

export const transferToMediation = async (payload: TransferToMediationPayload) => {
  const { data } = await request.post('/second-sales/transfer-to-mediation', payload)
  return data
}

export const createSecondSalesOrder = async (payload: SecondSalesOrderPayload) => {
  const formData = new FormData()
  formData.append('phone', payload.phone)
  formData.append('secondSalesUserId', String(payload.secondSalesUserId))
  formData.append('orderType', payload.orderType)
  formData.append('contractAmount', String(payload.contractAmount))
  formData.append('secondPaymentAmount', String(payload.secondPaymentAmount))
  formData.append('paymentAccountId', String(payload.paymentAccountId))
  formData.append('includesHearing', String(payload.includesHearing))
  formData.append('paymentSerialNo', payload.paymentSerialNo)
  formData.append('nextStage', payload.nextStage)
  if (payload.orderDate) {
    formData.append('orderDate', payload.orderDate)
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

  if (payload.paymentScreenshot) {
    formData.append('paymentScreenshot', payload.paymentScreenshot)
  }

  if (payload.chatRecordFile) {
    formData.append('chatRecordFile', payload.chatRecordFile)
  }

  payload.evidenceFiles?.forEach((file) => {
    formData.append('evidenceFiles', file)
  })

  const { data } = await request.post('/second-sales/orders', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const updateSecondSalesOrder = async (id: number, payload: SecondSalesOrderPayload) => {
  const formData = new FormData()
  formData.append('phone', payload.phone)
  formData.append('secondSalesUserId', String(payload.secondSalesUserId))
  formData.append('orderType', payload.orderType)
  formData.append('contractAmount', String(payload.contractAmount))
  formData.append('secondPaymentAmount', String(payload.secondPaymentAmount))
  formData.append('paymentAccountId', String(payload.paymentAccountId))
  formData.append('includesHearing', String(payload.includesHearing))
  formData.append('paymentSerialNo', payload.paymentSerialNo)
  formData.append('nextStage', payload.nextStage)
  if (payload.orderDate) {
    formData.append('orderDate', payload.orderDate)
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

  if (payload.paymentScreenshot) {
    formData.append('paymentScreenshot', payload.paymentScreenshot)
  }

  if (payload.chatRecordFile) {
    formData.append('chatRecordFile', payload.chatRecordFile)
  }

  payload.evidenceFiles?.forEach((file) => {
    formData.append('evidenceFiles', file)
  })

  const { data } = await request.patch<SecondSalesOrderListItem>(`/second-sales/orders/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const deleteSecondSalesOrder = async (id: number) => {
  const { data } = await request.delete<{ success: boolean }>(`/second-sales/orders/${id}`)
  return data
}

export const reviewSecondSalesOrder = async (id: number, payload: FinanceReviewActionPayload) => {
  const { data } = await request.post<SecondSalesOrderListItem>(`/second-sales/orders/${id}/finance-review`, payload)
  return data
}

export const batchReviewSecondSalesOrders = async (payload: BatchFinanceReviewPayload) => {
  const { data } = await request.post<SecondSalesOrderListItem[]>('/second-sales/orders/finance-review/batch', payload)
  return data
}
