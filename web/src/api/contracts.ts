import { request } from './request'
import type { ContractArchiveItem, ContractArchivePayload, ContractCustomerOption, ContractRelatedOrderOption, SalesUserOption } from '../types'

export const fetchContractArchives = async () => {
  const { data } = await request.get<ContractArchiveItem[]>('/contracts')
  return data
}

export const fetchContractCustomers = async () => {
  const { data } = await request.get<ContractCustomerOption[]>('/contracts/customers')
  return data
}

export const fetchContractUsers = async () => {
  const { data } = await request.get<SalesUserOption[]>('/contracts/users')
  return data
}

export const fetchCustomerContractOrders = async (customerId: number) => {
  const { data } = await request.get<ContractRelatedOrderOption[]>(`/contracts/customer/${customerId}/orders`)
  return data
}

export const createContractArchive = async (payload: ContractArchivePayload) => {
  const formData = new FormData()
  formData.append('contractNo', payload.contractNo)
  formData.append('customerId', String(payload.customerId))
  formData.append('salesStage', payload.salesStage)
  formData.append('relatedOrderId', String(payload.relatedOrderId))
  formData.append('amount', String(payload.amount))
  formData.append('signDate', payload.signDate)
  formData.append('contractSpecialistId', String(payload.contractSpecialistId))
  if (payload.remark) {
    formData.append('remark', payload.remark)
  }
  if (payload.contractFile) {
    formData.append('contractFile', payload.contractFile)
  }

  const { data } = await request.post<ContractArchiveItem>('/contracts', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}
