export type CustomerStatusCode =
  | 'INITIAL'
  | 'PENDING_TAIL_PAYMENT'
  | 'PENDING_SECOND_SALES_ASSIGNMENT'
  | 'SECOND_SALES_FOLLOWING'
  | 'PENDING_LEGAL'
  | 'LEGAL_PROCESSING'
  | 'PENDING_MEDIATION'
  | 'PENDING_THIRD_SALES'
  | 'THIRD_SALES_FOLLOWING'
  | 'COMPLETED_THIRD_SALES'
  | 'MEDIATION_PROCESSING'
  | 'MEDIATION_COMPLETED'

export type CustomerFollowStage = 'FIRST_SALES' | 'SECOND_SALES' | 'LEGAL' | 'THIRD_SALES' | 'MEDIATION'

export type CustomerStatus =
  | '初始建档'
  | '待补尾款'
  | '待分配二销'
  | '二销跟进中'
  | '待转法务'
  | '法务处理中'
  | '待转调解'
  | '待转三销'
  | '三销开发中'
  | '已完成三销'
  | '调解处理中'
  | '调解完成'

export interface CustomerItem {
  id: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  wechat?: string
  gender?: string
  age?: number | null
  province?: string
  city?: string
  source?: string
  caseType?: string
  intentionLevel?: string
  currentStatus: CustomerStatus
  firstSalesUserName?: string
  firstSalesDepartmentName?: string
  firstSalesTeamName?: string
  secondSalesUserName?: string
  legalUserName?: string
  thirdSalesUserName?: string
  targetAmount: number
  firstPaymentAmount: number
  secondPaymentAmount: number
  thirdPaymentAmount: number
  totalPaymentAmount: number
  arrearsAmount: number
  isTailPaymentCompleted?: boolean
  latestFollowOperatorName?: string
  latestFollowContent?: string
  latestFollowTime?: string
  hasApprovalRecord?: boolean
  hasQualityRecord?: boolean
  remark?: string
  followOwnerName?: string
  followStageLabel?: string
  createdAt: string
  updatedAt: string
}

export interface CustomerFilters {
  name?: string
  phone?: string
  wechat?: string
  status?: string
  source?: string
  caseType?: string
  intentionLevel?: string
  isTailPaymentCompleted?: string
  hasApprovalRecord?: string
  hasQualityRecord?: string
  page?: number
  pageSize?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface CreateCustomerFollowPayload {
  content: string
  nextFollowTime?: string
}

export interface UpdateCustomerStatusPayload {
  status: CustomerStatusCode
}

export interface CustomerContractArchive {
  id: number
  contractNo: string
  amount: number
  signDate: string
  fileUrl?: string
  contractSpecialistName?: string
  remark?: string
}

export interface CustomerEvidenceSummaryItem {
  label: string
  url: string
  source: 'FIRST_SALES' | 'SECOND_SALES' | 'MEDIATION' | 'THIRD_SALES'
}

export interface CustomerDetail extends CustomerItem {
  wechat?: string
  gender?: string
  age?: number | null
  province?: string
  city?: string
  source?: string
  caseType?: string
  intentionLevel?: string
  remark?: string
  isTailPaymentCompleted?: boolean
  ownerChain: {
    firstSalesUserName?: string
    firstSalesTeamName?: string
    secondSalesUserName?: string
    legalUserName?: string
    thirdSalesUserName?: string
  }
  followOwnerName?: string
  followStageLabel?: string
  paymentSummary: {
    targetAmount: number
    firstPaymentAmount: number
    secondPaymentAmount: number
    thirdPaymentAmount: number
    totalPaymentAmount: number
    arrearsAmount: number
  }
  legalCase:
    | {
        legalUserName?: string
        progressStatus: string
        caseResult?: string
        remark?: string
        isCompleted: boolean
        filingApproved: boolean
        createdAt: string
        updatedAt: string
      }
    | null
  mediationCase:
    | {
        ownerName?: string
        progressStatus: string
        mediationResult?: string
        remark?: string
        evidenceFileUrls: string[]
        finishDate?: string | null
        createdAt: string
        updatedAt: string
      }
    | null
  evidenceSummary: {
    firstSales: CustomerEvidenceSummaryItem[]
    secondSales: CustomerEvidenceSummaryItem[]
    mediation: CustomerEvidenceSummaryItem[]
    thirdSales: CustomerEvidenceSummaryItem[]
    combinedForSecondSales: CustomerEvidenceSummaryItem[]
    combinedForLegalAndThirdSales: CustomerEvidenceSummaryItem[]
    combinedAll: CustomerEvidenceSummaryItem[]
  }
  salesSummary: {
    customerRemark?: string
    firstSalesRemark?: string
    secondSalesRemark?: string
  }
  approvals: Array<{
    id: number
    applicantName?: string
    approverName?: string
    approvalType: 'REIMBURSEMENT' | 'LEAVE'
    title: string
    amount: number
    leaveDays: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    remark?: string
    approvedAt?: string
    createdAt: string
  }>
  refundCases: Array<{
    id: number
    sourceStage: 'FIRST_SALES' | 'SECOND_SALES' | 'LEGAL' | 'MEDIATION' | 'THIRD_SALES' | 'CUSTOMER'
    relatedOrderStage?: 'FIRST' | 'SECOND' | 'THIRD'
    relatedOrderId?: number
    status: 'PENDING_REVIEW' | 'PENDING_ASSIGNMENT' | 'PROCESSING' | 'REJECTED' | 'CLOSED'
    reason: string
    expectedRefundAmount: number
    remark?: string
    reviewRemark?: string
    requestedByName?: string
    reviewerName?: string
    assigneeName?: string
    reviewedAt?: string
    assignedAt?: string
    closedAt?: string
    createdAt: string
    logs: Array<{
      id: number
      action: string
      content: string
      operatorName?: string
      createdAt: string
    }>
  }>
  qualityRecords: Array<{
    id: number
    title: string
    inspectorName?: string
    score: number
    result: string
    content: string
    remark?: string
    createdAt: string
  }>
  firstSalesOrders: Array<{
    id: number
    orderType: string
    isTimelyDeal?: boolean
    targetAmount?: number
    contractAmount: number
    paymentAmount: number
    arrearsAmount: number
    paymentSerialNo?: string
    paymentScreenshotUrl?: string
    chatRecordUrl?: string
    evidenceImageUrls: string[]
    paymentStatus?: string
    contractArchive?: CustomerContractArchive | null
    createdAt: string
  }>
  secondSalesOrders: Array<{
    id: number
    secondPaymentAmount: number
    paymentSerialNo?: string
    paymentScreenshotUrl?: string
    chatRecordUrl?: string
    evidenceFileUrls: string[]
    contractArchive?: CustomerContractArchive | null
    createdAt: string
  }>
  thirdSalesOrders: Array<{
    id: number
    thirdSalesUserName?: string
    productName: string
    paymentAmount: number
    performanceAmount: number
    remark?: string
    evidenceFileUrls: string[]
    orderDate: string
    contractArchive?: CustomerContractArchive | null
    createdAt: string
  }>
  followLogs: Array<{
    id: number
    stage: string
    content: string
    operatorName: string
    nextFollowTime?: string
    createdAt: string
  }>
}

export interface DashboardStat {
  label: string
  value: string | number
  type?: 'primary' | 'success' | 'warning' | 'danger'
}

export interface ReportQueryParams {
  startDate?: string
  endDate?: string
  departmentId?: number
  export?: boolean
  page?: number
  pageSize?: number
}

export interface ReportDepartmentOption {
  id: number
  name: string
}

export interface ReportSummaryCard {
  title: string
  value: number
}

export interface FirstSalesPersonalRow {
  userName: string
  timelyCount: number
  depositCount: number
  tailCount: number
  fullCount: number
  depositAmount: number
  tailAmount: number
  fullAmount: number
  totalAmount: number
  avgAmount: number
}

export interface FirstSalesTeamRow {
  date: string
  timelyCount: number
  depositCount: number
  tailCount: number
  fullCount: number
  depositAmount: number
  tailAmount: number
  fullAmount: number
  totalAmount: number
  avgAmount: number
}

export interface SecondSalesPersonalRow {
  userName: string
  receptionCount: number
  targetAmount: number
  dealCount: number
  dealAmount: number
  conversionRate: number
  avgAmount: number
  unitQ: number
}

export interface SecondSalesTeamRow {
  date: string
  receptionCount: number
  targetAmount: number
  dealCount: number
  dealAmount: number
  conversionRate: number
  avgAmount: number
  unitQ: number
}

export interface ThirdSalesPersonalRow {
  userName: string
  dealAmount: number
}

export interface ThirdSalesTeamRow {
  date: string
  dealAmount: number
}

export interface ReportRowsResponse<T> {
  rows: T[]
}

export interface ReportOptionsResponse {
  options: ReportDepartmentOption[]
}

export interface ReportDetailRow {
  id: number
  customerName: string
  phone: string
  operatorName: string
  departmentName?: string
  paymentAmount: number
  performanceAmount: number
  extraLabel: string
  status: string
  orderDate: string
}

export interface ReportsSummaryResponse {
  cards: ReportSummaryCard[]
}


export interface DashboardTodoCard {
  title: string
  count: number
}

export interface DashboardSummary {
  stats: DashboardStat[]
  todoCards: DashboardTodoCard[]
}

export interface SalesUserOption {
  id: number
  realName: string
  roleName: string
  roleCode?: string
}

export interface PaymentAccountItem {
  id: number
  accountName: string
  bankName?: string
  accountNo: string
  remark?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface PaymentAccountPayload {
  accountName: string
  bankName?: string
  accountNo: string
  remark?: string
  isActive?: boolean
}

export type PaymentAccountOption = PaymentAccountItem

export interface FinanceReviewActionPayload {
  action: 'APPROVE' | 'REJECT'
  reviewerId: number
  remark?: string
}

export interface BatchFinanceReviewPayload extends FinanceReviewActionPayload {
  orderIds: number[]
}

export interface FirstSalesListItem {
  id: number
  customerId: number
  customerNo: string
  name: string
  phone: string
  wechat?: string
  gender?: string
  age?: number | null
  province?: string
  city?: string
  source?: string
  caseType?: string
  intentionLevel?: string
  orderType: string
  isTimelyDeal?: boolean
  targetAmount?: number
  contractAmount: number
  paymentAmount: number
  arrearsAmount: number
  paymentAccountName?: string
  paymentAccountId?: number
  paymentSerialNo?: string
  paymentScreenshotUrl?: string
  evidenceImageUrls: string[]
  paymentStatus: string
  currentStatus: string
  salesUserName: string
  salesUserId?: number
  firstSalesDepartmentId?: number
  firstSalesTeamName?: string
  firstSalesDepartmentName?: string
  financeReviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  financeReviewStatusLabel: string
  financeReviewerId?: number
  financeReviewerName?: string
  financeReviewedAt?: string
  financeReviewRemark?: string
  remark?: string
  orderDate: string
  createdAt: string
}

export interface FirstSalesForm {
  customerName: string
  phone: string
  wechat?: string
  gender?: string
  age?: number | null
  province?: string
  city?: string
  source?: string
  caseType?: string
  intentionLevel?: string
  salesUserId: number
  orderType: 'DEPOSIT' | 'TAIL' | 'FULL'
  isTimelyDeal: 'true' | 'false'
  targetAmount: number
  contractAmount: number
  paymentAmount: number
  arrearsAmount: number
  paymentAccountId: number
  paymentSerialNo: string
  orderDate?: string
  paymentScreenshot?: File | null
  chatRecordFile?: File | null
  evidenceImages?: File[]
  remark?: string
}

export interface FirstSalesTailOrderPayload {
  salesUserId: number
  isTimelyDeal: 'true' | 'false'
  targetAmount: number
  contractAmount: number
  paymentAmount: number
  arrearsAmount: number
  paymentAccountId: number
  paymentSerialNo: string
  orderDate?: string
  paymentScreenshot?: File | null
  chatRecordFile?: File | null
  evidenceImages?: File[]
  remark?: string
}

export interface FirstSalesCreateResult {
  id: number
  customerId: number
  customerNo: string
  currentStatus: string
}

export interface MediationCaseItem {
  customerId: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  currentStatus: string
  firstSalesUserName?: string
  secondSalesUserName?: string
  caseType?: string
  source?: string
  intentionLevel?: string
  firstPaymentAmount: number
  secondPaymentAmount: number
  arrearsAmount: number
  ownerId?: number
  ownerName?: string
  progressStatus: string
  mediationResult?: string
  remark?: string
  evidenceFileUrls: string[]
  startDate?: string
  isCompleted: boolean
  customerRemark?: string
  firstSalesRemark?: string
  firstSalesPaymentScreenshotUrl?: string
  firstSalesChatRecordUrl?: string
  firstSalesEvidenceFileUrls: string[]
}

export interface SaveMediationCasePayload {
  customerId: number
  progressStatus: string
  mediationResult?: string
  remark?: string
  evidenceFiles?: File[]
  startDate?: string
  isCompleted?: boolean
  ownerId?: number
}

export interface TransferToMediationPayload {
  customerId: number
}

export type LegalCaseStage = 'ASSISTANT' | 'FILING_SPECIALIST' | 'PRE_TRIAL' | 'CLOSED'

export interface LegalCaseItem {
  customerId: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  secondPaymentAmount: number
  currentStatus: string
  legalUserName?: string
  progressStatus: string
  caseResult?: string
  remark?: string
  customerSituationRemark?: string
  firstSalesRemark?: string
  secondSalesRemark?: string
  thirdSalesRemark?: string
  upstreamEvidenceFileUrls: string[]
  firstSalesEvidenceFileUrls: string[]
  secondSalesEvidenceFileUrls: string[]
  thirdSalesEvidenceFileUrls: string[]
  secondSalesPaymentScreenshotUrl?: string
  thirdSalesPaymentScreenshotUrl?: string
  secondSalesChatRecordUrl?: string
  thirdSalesChatRecordUrl?: string
  secondSalesPaymentStatus?: string
  thirdSalesPaymentStatus?: string
  secondSalesPaymentAmount?: number
  thirdSalesPaymentAmount?: number
  startDate?: string
  isCompleted: boolean
  filingApproved: boolean
  stage: LegalCaseStage
  assistantUserId?: number
  assistantUserName?: string
  filingSpecialistUserId?: number
  filingSpecialistUserName?: string
  preTrialUserId?: number
  preTrialUserName?: string
  assistantCollected: boolean
  assistantDocumented: boolean
  archiveNeeded: boolean
  archiveCompleted: boolean
  filingReviewed: boolean
  transferredToPreTrial: boolean
  acceptedAt?: string
  assistantTransferredAt?: string
  filingApprovedAt?: string
  preTrialTransferredAt?: string
  closeResult?: string
}

export interface SaveLegalCasePayload {
  customerId: number
  progressStatus: string
  caseResult?: string
  remark?: string
  startDate?: string
  isCompleted?: boolean
  filingApproved?: boolean
  stage?: LegalCaseStage
  assistantUserId?: number
  filingSpecialistUserId?: number
  preTrialUserId?: number
  assistantCollected?: boolean
  assistantDocumented?: boolean
  archiveNeeded?: boolean
  archiveCompleted?: boolean
  filingReviewed?: boolean
  transferredToPreTrial?: boolean
  closeResult?: string
}

export type RefundSourceStage = 'FIRST_SALES' | 'SECOND_SALES' | 'LEGAL' | 'MEDIATION' | 'THIRD_SALES' | 'CUSTOMER'
export type RefundRelatedOrderStage = 'FIRST' | 'SECOND' | 'THIRD'
export type RefundStatus = 'PENDING_REVIEW' | 'PENDING_ASSIGNMENT' | 'PROCESSING' | 'REJECTED' | 'CLOSED'

export interface RefundCaseLogItem {
  id: number
  action: string
  content: string
  operatorId: number
  operatorName?: string
  createdAt: string
}

export interface RefundCaseCustomerInfo {
  id: number
  customerNo: string
  name: string
  phone: string
  source?: string
  caseType?: string
  intentionLevel?: string
  firstSalesUserName?: string
  firstSalesTeamName?: string
  secondSalesUserName?: string
  legalUserName?: string
  thirdSalesUserName?: string
  firstPaymentAmount: number
  secondPaymentAmount: number
  thirdPaymentAmount: number
  totalPaymentAmount: number
  arrearsAmount: number
}

export interface RefundFirstSalesDepartmentOption {
  id: number
  name: string
  parentId?: number
  teamName?: string
}

export interface RefundCaseItem {
  id: number
  customerId: number
  customerNo: string
  customerName: string
  phone: string
  sourceStage: RefundSourceStage
  sourceStageLabel: string
  relatedOrderId?: number
  relatedOrderStage?: RefundRelatedOrderStage
  firstSalesUserId?: number
  firstSalesUserName?: string
  firstSalesDepartmentId?: number
  firstSalesDepartmentName?: string
  firstSalesTeamName?: string
  status: RefundStatus
  statusLabel: string
  reason: string
  expectedRefundAmount: number
  remark?: string
  reviewRemark?: string
  reviewerId?: number
  reviewerName?: string
  assigneeId?: number
  assigneeName?: string
  requestedById: number
  requestedByName?: string
  reviewedAt?: string
  assignedAt?: string
  closedAt?: string
  createdAt: string
  updatedAt: string
  logs: RefundCaseLogItem[]
  relatedComplaint?: {
    id: number
    complaintSubject: string
    handlingStatus: JudicialComplaintHandlingStatus
    handlingStatusLabel: string
    shouldHandle: boolean
    qualityChecked: boolean
    qualityCheckedAt?: string
    complaintTime: string
    complaintReason: string
    qualityRecordId?: number
  }
  relatedQualityRecord?: QualityRecordItem
  customer?: RefundCaseCustomerInfo
}

export interface CreateRefundCasePayload {
  customerId?: number
  customerName?: string
  phone?: string
  sourceStage: RefundSourceStage
  relatedOrderId?: number
  relatedOrderStage?: RefundRelatedOrderStage
  firstSalesUserId?: number
  firstSalesUserName?: string
  firstSalesDepartmentId?: number
  reason: string
  expectedRefundAmount?: number
  remark?: string
}

export interface ReviewRefundCasePayload {
  action: 'APPROVE' | 'REJECT'
  remark?: string
}

export interface AssignRefundCasePayload {
  assigneeId: number
  remark?: string
}

export interface FollowRefundCasePayload {
  content: string
  remark?: string
}

export interface CloseRefundCasePayload {
  remark?: string
}

export interface RefundCaseFilters {
  page?: number
  pageSize?: number
  status?: RefundStatus | ''
  sourceStage?: RefundSourceStage | ''
}

export type JudicialComplaintHandlingStatus = 'PENDING' | 'PROCESSING' | 'HANDLED' | 'IGNORED'
export type ThirdSalesSourceStage = 'SECOND_SALES' | 'LEGAL'

export interface JudicialComplaintCaseItem {
  id: number
  customerId?: number
  complaintSubject: string
  teamName?: string
  departmentName?: string
  complaintTime: string
  customerName: string
  phone: string
  relationToCustomer?: string
  firstSignTime?: string
  secondSignTime?: string
  firstDealAmount: number
  secondDealAmount: number
  firstSalesName?: string
  secondSalesName?: string
  legalAssistantName?: string
  summary?: string
  complaintReason: string
  progress?: string
  refundAmount: number
  intervenedBeforeComplaint: boolean
  suddenRefundRequest: boolean
  thirdPartyGuidance: boolean
  shouldHandle: boolean
  handlingStatus: JudicialComplaintHandlingStatus
  handlingStatusLabel: string
  handledAt?: string
  qualityChecked: boolean
  qualityCheckedAt?: string
  qualityRecordId?: number
  qualityRecord?: QualityRecordItem
  submittedById: number
  submittedByName?: string
  handledById?: number
  handledByName?: string
  createdAt: string
  updatedAt: string
  customer?: {
    id: number
    customerNo: string
    name: string
    phone: string
    source?: string
    caseType?: string
    intentionLevel?: string
  }
}

export interface CreateJudicialComplaintPayload {
  customerId?: number
  complaintSubject: string
  teamName?: string
  departmentName?: string
  complaintTime: string
  customerName: string
  phone: string
  relationToCustomer?: string
  firstSignTime?: string
  secondSignTime?: string
  firstDealAmount?: number
  secondDealAmount?: number
  firstSalesName?: string
  secondSalesName?: string
  legalAssistantName?: string
  summary?: string
  complaintReason: string
  progress?: string
  refundAmount?: number
  intervenedBeforeComplaint: boolean
  suddenRefundRequest: boolean
  thirdPartyGuidance: boolean
  shouldHandle: boolean
}

export interface JudicialComplaintCaseFilters {
  page?: number
  pageSize?: number
  handlingStatus?: JudicialComplaintHandlingStatus | ''
}

export interface JudicialComplaintCustomerSearchResult {
  id: number
  customerNo: string
  name: string
  phone: string
  currentStatus: string
  source?: string
  caseType?: string
  intentionLevel?: string
  departmentName?: string
  firstSalesTeamName?: string
  firstSalesUserName?: string
  secondSalesUserName?: string
  legalUserName?: string
  firstPaymentAmount: number
  secondPaymentAmount: number
  totalPaymentAmount: number
  arrearsAmount: number
}

export interface SecondSalesAssignmentItem {
  id: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  firstSalesUserName?: string
  secondSalesUserName?: string
  firstPaymentAmount: number
  arrearsAmount: number
  remark?: string
  currentStatus: string
  thirdSalesSourceStage?: ThirdSalesSourceStage
  firstSalesRemark?: string
  firstSalesEvidence?: CustomerEvidenceSummaryItem[]
}

export interface ThirdSalesReceptionItem {
  id: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  currentStatus: string
  caseType?: string
  source?: string
  intentionLevel?: string
  firstSalesUserName?: string
  secondSalesUserName?: string
  thirdSalesUserName?: string
  thirdSalesSourceStage?: ThirdSalesSourceStage
  firstPaymentAmount: number
  secondPaymentAmount: number
  thirdPaymentAmount: number
  totalPaymentAmount: number
  arrearsAmount: number
}

export interface ThirdSalesCustomerSearchResult {
  id: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  currentStatus: string
  caseType?: string
  source?: string
  intentionLevel?: string
  firstSalesUserName?: string
  secondSalesUserName?: string
  thirdSalesUserName?: string
  thirdSalesSourceStage?: ThirdSalesSourceStage
  firstPaymentAmount: number
  secondPaymentAmount: number
  thirdPaymentAmount: number
  totalPaymentAmount: number
  arrearsAmount: number
}

export interface ThirdSalesOrderListItem {
  id: number
  customerId: number
  customerNo: string
  customerName: string
  phone: string
  firstSalesUserId?: number
  firstSalesUserName?: string
  firstSalesTeamName?: string
  firstSalesDepartmentName?: string
  thirdSalesUserName: string
  thirdSalesUserId?: number
  sourceStage?: ThirdSalesSourceStage
  orderType: string
  productName: string
  paymentAmount: number
  contractAmount: number
  arrearsAmount: number
  rawPerformanceAmount: number
  hearingCostAmount: number
  performanceAmount: number
  paymentStatus?: string
  paymentAccountName?: string
  paymentAccountId?: number
  paymentSerialNo?: string
  paymentScreenshotUrl?: string
  chatRecordUrl?: string
  financeReviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  financeReviewStatusLabel: string
  financeReviewerId?: number
  financeReviewerName?: string
  financeReviewedAt?: string
  financeReviewRemark?: string
  remark?: string
  evidenceFileUrls: string[]
  orderDate: string
  createdAt: string
}

export interface ThirdSalesOrderPayload {
  phone: string
  thirdSalesUserId: number
  orderType: 'DEPOSIT' | 'TAIL' | 'FULL'
  productName: string
  paymentAmount: string
  contractAmount: string
  paymentAccountId: number
  paymentSerialNo: string
  orderDate?: string
  paymentScreenshot?: File | null
  chatRecordFile?: File | null
  customerName?: string
  caseType?: string
  source?: string
  intentionLevel?: string
  remark?: string
  evidenceFiles?: File[]
}

export interface CourtConfigItem {
  id: number
  hearingCost: number
  remark?: string
  createdAt: string
  updatedAt: string
}

export interface CourtConfigPayload {
  hearingCost: number
  remark?: string
}

export type DingTalkReportTemplateType = 'FIRST_SALES' | 'LITIGATION'

export interface DingTalkReportConfigItem {
  id: number
  templateType: DingTalkReportTemplateType
  departmentIds: number[]
  departmentNames: string[]
  webhookUrl: string
  dailyTarget?: string
  messageTemplate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DingTalkReportConfigPayload {
  templateType: DingTalkReportTemplateType
  departmentIds: number[]
  departmentNames: string[]
  webhookUrl: string
  dailyTarget?: string
  messageTemplate: string
  isActive?: boolean
}

export interface SystemUserItem {
  id: number
  realName: string
  phone?: string
  roleCode: string
  roleName: string
  departmentId?: number
  department?: string
  status: UserStatusCode
  createdAt: string
}

export type DataScope = 'SELF' | 'DEPARTMENT' | 'DEPARTMENT_AND_CHILDREN' | 'ALL'

export interface PermissionItem {
  id: number
  code: string
  name: string
  description?: string
}

export interface RoleOption {
  id: number
  name: string
  code: string
  description?: string
  customerScope?: DataScope
  reportScope?: DataScope
  userManageScope?: DataScope
  isSystem?: boolean
  userCount?: number
  permissions?: PermissionItem[]
}

export interface CreateRolePayload {
  name: string
  code: string
  description?: string
  customerScope: DataScope
  reportScope: DataScope
  userManageScope: DataScope
  permissionIds?: number[]
}

export interface CopyRolePayload {
  name: string
  code: string
  description?: string
}

export interface UpdateRoleMetaPayload {
  name: string
  code: string
  description?: string
  customerScope: DataScope
  reportScope: DataScope
  userManageScope: DataScope
}

export interface UpdateRolePermissionsPayload {
  permissionIds: number[]
  customerScope: DataScope
  reportScope: DataScope
  userManageScope: DataScope
}

export interface RoleUserAssignmentResponse {
  assignedUsers: SystemUserItem[]
  availableUsers: SystemUserItem[]
}

export interface BatchAssignRoleUsersPayload {
  userIds: number[]
  removeToFirstSales?: boolean
}

export interface RegisterPayload {
  realName: string
  phone: string
  password: string
  department?: string
  departmentId?: number
}

export type UserStatusCode = 'PENDING' | 'ACTIVE' | 'DISABLED'

export interface BatchUpdateUserStatusPayload {
  userIds: number[]
  status: UserStatusCode
}

export interface SystemUserPayload {
  password?: string
  realName: string
  phone: string
  department?: string
  departmentId?: number
  roleId: number
  status: UserStatusCode
}

export interface DepartmentTreeItem {
  id: number
  name: string
  parentId?: number
  sort?: number
  leaderUserId?: number
  leaderName?: string
  hrUserId?: number
  hrName?: string
  children?: DepartmentTreeItem[]
}

export interface DepartmentUpsertPayload {
  name: string
  parentId?: number
  sort?: number
  leaderUserId?: number
  hrUserId?: number
}

export interface SecondSalesCustomerSearchResult {
  id: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  currentStatus: string
  firstSalesUserName?: string
  secondSalesUserName?: string
  caseType?: string
  source?: string
  intentionLevel?: string
  firstPaymentAmount: number
  secondPaymentAmount: number
  totalPaymentAmount: number
  arrearsAmount: number
}

export interface SecondSalesAssignPayload {
  customerId: number
  secondSalesUserId: number
  remark?: string
}

export interface SecondSalesOrderListItem {
  id: number
  customerId: number
  customerNo: string
  customerName: string
  phone: string
  firstSalesTeamName?: string
  secondSalesUserName: string
  secondSalesUserId?: number
  currentStatus?: string
  orderType: string
  contractAmount: number
  secondPaymentAmount: number
  arrearsAmount: number
  includesHearing: boolean
  hearingCostAmount: number
  performanceAmount: number
  paymentStatus?: string
  paymentAccountName?: string
  paymentAccountId?: number
  paymentSerialNo?: string
  paymentScreenshotUrl?: string
  chatRecordUrl?: string
  evidenceFileUrls: string[]
  remark?: string
  financeReviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  financeReviewStatusLabel: string
  financeReviewerId?: number
  financeReviewerName?: string
  financeReviewedAt?: string
  financeReviewRemark?: string
  orderDate: string
  createdAt: string
}

export interface SecondSalesOrderPayload {
  phone: string
  secondSalesUserId?: number
  orderType: 'DEPOSIT' | 'TAIL' | 'FULL'
  contractAmount: number
  secondPaymentAmount: number
  includesHearing: boolean
  paymentAccountId?: number
  paymentSerialNo: string
  nextStage: 'LEGAL' | 'THIRD_SALES'
  orderDate?: string
  customerName?: string
  caseType?: string
  source?: string
  intentionLevel?: string
  remark?: string
  paymentScreenshot?: File | null
  chatRecordFile?: File | null
  evidenceFiles?: File[]
}

export interface ContractArchiveItem {
  id: number
  contractNo: string
  customerId: number
  customerNo?: string
  customerName: string
  customerPhone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  salesStage: 'FIRST' | 'SECOND' | 'THIRD'
  relatedOrderId: number
  amount: number
  signDate: string
  fileUrl?: string
  contractSpecialistId: number
  contractSpecialistName: string
  remark?: string
  createdAt: string
}

export interface ContractCustomerOption {
  id: number
  customerNo: string
  name: string
  phone: string
  currentOwnerId?: number
  firstSalesUserId?: number
  secondSalesUserId?: number
  legalUserId?: number
  thirdSalesUserId?: number
  currentStatus: string
}

export interface ContractRelatedOrderOption {
  id: number
  salesStage: 'FIRST' | 'SECOND' | 'THIRD'
  label: string
}

export interface ContractArchivePayload {
  contractNo: string
  customerId: number
  salesStage: 'FIRST' | 'SECOND' | 'THIRD'
  relatedOrderId: number
  amount: number
  signDate: string
  contractSpecialistId: number
  remark?: string
  contractFile?: File | null
}

export interface ApprovalSummary {
  dailyAmount: number
  monthlyAmount: number
}

export interface ApprovalListResponse {
  myApplications: ApprovalListItem[]
  pendingApprovals: ApprovalListItem[]
  processedApprovals: ApprovalListItem[]
  allApplications: ApprovalListItem[]
  reimbursementItems: ApprovalListItem[]
  summary?: ApprovalSummary
}

export interface ApprovalSummary {
  paidAmount: number
  unpaidAmount: number
  totalAmount: number
}

export interface ApprovalListItem {
  id: number
  applicantId: number
  applicantName: string
  approverId?: number
  approverName?: string
  customerId?: number
  customerName?: string
  approvalType: 'REIMBURSEMENT' | 'LEAVE' | 'PUNCH_CARD'
  title: string
  amount: number
  leaveDays: number
  punchDate?: string
  punchTime?: string
  reason: string
  reimbursementAccountName?: string
  reimbursementPayeeName?: string
  reimbursementBankName?: string
  reimbursementCardNo?: string
  reimbursementVoucherUrl?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  paymentStatus?: 'UNPAID' | 'PAID'
  currentStep: number
  maxStep: number
  canApprove: boolean
  paidAt?: string
  paidByName?: string
  steps: Array<{
    step: number
    approverId: number
    approverName: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    remark?: string
    handledAt?: string
  }>
  remark?: string
  approvedAt?: string
  createdAt: string
}

export interface ApprovalQueryParams {
  approvalType?: 'REIMBURSEMENT' | 'LEAVE' | 'PUNCH_CARD'
  statusView?: 'ALL' | 'PENDING' | 'PROCESSED' | 'UNPAID' | 'PAID'
  startDate?: string
  endDate?: string
  quickRange?: 'DAY' | 'WEEK' | 'MONTH'
}

export interface ApprovalCreatePayload {
  customerId?: number
  approvalType: 'REIMBURSEMENT' | 'LEAVE' | 'PUNCH_CARD'
  title: string
  amount?: number
  leaveDays?: number
  punchDate?: string
  punchTime?: string
  reason: string
  reimbursementAccountName?: string
  reimbursementPayeeName?: string
  reimbursementBankName?: string
  reimbursementCardNo?: string
  reimbursementVoucher?: File | null
  reimbursementVoucherUrl?: string
  remark?: string
}

export interface ApprovalActionPayload {
  action: 'APPROVE' | 'REJECT'
  remark?: string
}

export interface QualityRecordItem {
  id: number
  recordDate: string
  responsibleId: number
  responsibleName: string
  customerId?: number
  customerName?: string
  customerPhone?: string
  judicialComplaintCaseId?: number
  judicialComplaintQualityCheckedAt?: string
  judicialComplaintHandledByName?: string
  penaltyAmount: number
  matter: string
  screenshotUrl?: string
  createdAt: string
}

export interface QualityCreatePayload {
  recordDate: string
  responsibleId: number
  customerId?: number
  judicialComplaintCaseId?: number
  matter: string
  penaltyAmount: number
  screenshot?: File | null
}

export interface QualityResponsibleOption {
  id: number
  name: string
}
