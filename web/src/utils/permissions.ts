import { authStorage } from '../auth'

const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN'

export const hasPermission = (permission: string) => {
  const user = authStorage.getUser()
  if (!user) {
    return false
  }

  if (user.roleCode === SUPER_ADMIN_ROLE_CODE) {
    return true
  }

  return Boolean(user.permissions?.includes(permission))
}

export const hasAnyPermission = (permissions: string[]) => permissions.some((permission) => hasPermission(permission))

export const canViewUnmaskedPhone = () => hasPermission('customers.phone.unmask')
export const canViewOwnUnmaskedPhone = () => hasPermission('customers.phone.unmask.self')

export interface PhoneOwnershipPayload {
  currentOwnerId?: number | null
  firstSalesUserId?: number | null
  secondSalesUserId?: number | null
  legalUserId?: number | null
  thirdSalesUserId?: number | null
  salesUserId?: number | null
}

const canViewOwnedCustomerPhone = (ownership?: PhoneOwnershipPayload) => {
  const currentUserId = authStorage.getUser()?.id
  if (!currentUserId || !ownership) {
    return false
  }

  const ownerIds = [
    ownership.currentOwnerId,
    ownership.firstSalesUserId,
    ownership.secondSalesUserId,
    ownership.legalUserId,
    ownership.thirdSalesUserId,
    ownership.salesUserId,
  ]

  return ownerIds.some((ownerId) => ownerId === currentUserId)
}

export const maskPhone = (phone?: string | null) => {
  const normalizedPhone = phone?.trim()
  if (!normalizedPhone) {
    return '-'
  }

  if (normalizedPhone.length < 7) {
    return normalizedPhone
  }

  return `${normalizedPhone.slice(0, 3)}****${normalizedPhone.slice(-4)}`
}

export const formatPhone = (phone?: string | null, ownership?: PhoneOwnershipPayload) => {
  const normalizedPhone = phone?.trim()
  if (!normalizedPhone) {
    return '-'
  }

  if (canViewUnmaskedPhone()) {
    return normalizedPhone
  }

  if (canViewOwnUnmaskedPhone() && canViewOwnedCustomerPhone(ownership)) {
    return normalizedPhone
  }

  return maskPhone(normalizedPhone)
}
