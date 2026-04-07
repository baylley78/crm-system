import { request } from './request'
import type { PaymentAccountItem, PaymentAccountOption, PaymentAccountPayload } from '../types'

export const fetchPaymentAccounts = async () => {
  const { data } = await request.get<PaymentAccountItem[]>('/payment-accounts')
  return data
}

export const fetchPaymentAccountOptions = async () => {
  const { data } = await request.get<PaymentAccountOption[]>('/payment-accounts/options')
  return data
}

export const createPaymentAccount = async (payload: PaymentAccountPayload) => {
  const { data } = await request.post<PaymentAccountItem>('/payment-accounts', payload)
  return data
}

export const updatePaymentAccount = async (id: number, payload: PaymentAccountPayload) => {
  const { data } = await request.patch<PaymentAccountItem>(`/payment-accounts/${id}`, payload)
  return data
}
