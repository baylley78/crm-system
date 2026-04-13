import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authStorage } from '../auth'
import { fetchCurrentUser } from '../api/auth'

const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/login/LoginView.vue'),
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: '/dashboard', name: 'dashboard', component: () => import('../views/dashboard/DashboardView.vue'), meta: { permission: 'dashboard.view' } },
      { path: '/customers', name: 'customers', component: () => import('../views/customers/CustomerListView.vue'), meta: { permission: 'customers.view' } },
      { path: '/contracts', name: 'contracts', component: () => import('../views/contracts/ContractArchiveView.vue'), meta: { permission: 'contracts.view' } },
      { path: '/first-sales/create', redirect: '/first-sales/list' },
      { path: '/first-sales/list', name: 'first-sales-list', component: () => import('../views/first-sales/FirstSalesListView.vue'), meta: { permission: 'firstSales.view' } },
      { path: '/second-sales/assignments', name: 'second-sales-assignments', component: () => import('../views/second-sales/SecondSalesAssignmentView.vue'), meta: { permission: 'secondSales.view' } },
      { path: '/second-sales/create', name: 'second-sales-create', component: () => import('../views/second-sales/SecondSalesCreateView.vue'), meta: { permission: 'secondSales.view' } },
      { path: '/second-sales/litigation', name: 'second-sales-litigation', component: () => import('../views/second-sales/SecondSalesLitigationView.vue'), meta: { permission: 'secondSales.view' } },
      { path: '/legal', name: 'legal', component: () => import('../views/legal/LegalListView.vue'), meta: { permission: 'legal.view' } },
      { path: '/mediation', name: 'mediation', component: () => import('../views/mediation/MediationListView.vue'), meta: { permission: 'mediation.view' } },
      { path: '/refund', name: 'refund', component: () => import('../views/refund/RefundListView.vue'), meta: { permission: 'refund.view' } },
      { path: '/after-sales/judicial-complaints', name: 'judicial-complaints', component: () => import('../views/after-sales/JudicialComplaintListView.vue'), meta: { permission: 'judicialComplaint.view' } },
      { path: '/third-sales/create', redirect: '/third-sales/performance' },
      { path: '/third-sales/reception', name: 'third-sales-reception', component: () => import('../views/third-sales/ThirdSalesReceptionView.vue'), meta: { permission: 'thirdSales.view' } },
      { path: '/third-sales/performance', name: 'third-sales-performance', component: () => import('../views/third-sales/ThirdSalesPerformanceView.vue'), meta: { permission: 'thirdSales.view' } },
      { path: '/reports', name: 'reports', component: () => import('../views/reports/ReportsView.vue'), meta: { permission: 'reports.firstSales.view' } },
      { path: '/reports/first-sales/personal', name: 'reports-first-sales-personal', component: () => import('../views/reports/PerformanceReportView.vue'), props: { stage: 'first-sales', scope: 'personal', title: '一销业绩（个人）' }, meta: { permission: 'reports.firstSales.view' } },
      { path: '/reports/first-sales/team', name: 'reports-first-sales-team', component: () => import('../views/reports/PerformanceReportView.vue'), props: { stage: 'first-sales', scope: 'team', title: '一销业绩（团队）' }, meta: { permission: 'reports.firstSales.teamView' } },
      { path: '/reports/second-sales/personal', name: 'reports-second-sales-personal', component: () => import('../views/reports/PerformanceReportView.vue'), props: { stage: 'second-sales', scope: 'personal', title: '二销业绩（个人）' }, meta: { permission: 'reports.secondSales.view' } },
      { path: '/reports/second-sales/team', name: 'reports-second-sales-team', component: () => import('../views/reports/PerformanceReportView.vue'), props: { stage: 'second-sales', scope: 'team', title: '二销业绩（团队）' }, meta: { permission: 'reports.secondSales.teamView' } },
      { path: '/reports/third-sales/personal', name: 'reports-third-sales-personal', component: () => import('../views/reports/PerformanceReportView.vue'), props: { stage: 'third-sales', scope: 'personal', title: '三销业绩（个人）' }, meta: { permission: 'reports.thirdSales.view' } },
      { path: '/reports/third-sales/team', name: 'reports-third-sales-team', component: () => import('../views/reports/PerformanceReportView.vue'), props: { stage: 'third-sales', scope: 'team', title: '三销业绩（团队）' }, meta: { permission: 'reports.thirdSales.teamView' } },
      { path: '/oa/reimbursements', name: 'oa-reimbursements', component: () => import('../views/oa/ApprovalManageView.vue'), meta: { permission: 'oa.approvals.view' } },
      { path: '/oa/leaves', name: 'oa-leaves', component: () => import('../views/oa/LeaveApprovalView.vue'), meta: { permission: 'oa.approvals.view' } },
      { path: '/oa/punch-cards', name: 'oa-punch-cards', component: () => import('../views/oa/PunchCardApprovalView.vue'), meta: { permission: 'oa.approvals.view' } },
      { path: '/quality', name: 'quality', component: () => import('../views/quality/QualityManageView.vue'), meta: { permission: 'quality.view' } },
      { path: '/traffic-stats', name: 'traffic-stats', component: () => import('../views/traffic-stats/TrafficStatsView.vue'), meta: { permission: 'trafficStats.view' } },
      { path: '/invalid-leads', name: 'invalid-leads', component: () => import('../views/invalid-leads/InvalidLeadsView.vue'), meta: { permission: 'invalidLeads.submit' } },
      { path: '/system/users', name: 'system-users', component: () => import('../views/system/UserManageView.vue'), meta: { permission: 'system.users.view' } },
      { path: '/system/departments', name: 'system-departments', component: () => import('../views/system/DepartmentManageView.vue'), meta: { permission: 'system.departments.view' } },
      { path: '/system/payment-accounts', name: 'system-payment-accounts', component: () => import('../views/system/PaymentAccountManageView.vue'), meta: { permission: 'system.paymentAccounts.manage' } },
      { path: '/system/court-config', name: 'system-court-config', component: () => import('../views/system/CourtConfigManageView.vue'), meta: { permission: 'system.courtConfig.manage' } },
      { path: '/system/dingtalk-report', name: 'system-dingtalk-report', component: () => import('../views/system/DingTalkReportManageView.vue'), meta: { permission: 'system.dingTalkReports.manage' } },
      { path: '/system/roles', name: 'system-roles', component: () => import('../views/system/RolePermissionView.vue'), meta: { permission: 'system.roles.view' } },
      { path: '/system/role-assignments', name: 'system-role-assignments', component: () => import('../views/system/RoleAssignmentView.vue'), meta: { permission: 'system.roles.assign' } },
    ],
  },
]

const rootChildren = (routes.find((route) => route.path === '/')?.children || []) as RouteRecordRaw[]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const findFirstAccessibleRoute = (userPermissions: string[] = [], roleCode?: string) => {
  return rootChildren.find((route) => {
    const permission = typeof route.meta?.permission === 'string' ? route.meta.permission : undefined
    return !permission || roleCode === SUPER_ADMIN_ROLE_CODE || userPermissions.includes(permission)
  })
}

let currentUserRefreshPromise: Promise<void> | null = null

const refreshCurrentUser = async () => {
  const token = authStorage.getToken()
  if (!token) {
    return null
  }

  if (!currentUserRefreshPromise) {
    currentUserRefreshPromise = fetchCurrentUser()
      .then((user) => {
        authStorage.setSession(token, user)
      })
      .catch(() => {
        authStorage.clear()
        throw new Error('CURRENT_USER_REFRESH_FAILED')
      })
      .finally(() => {
        currentUserRefreshPromise = null
      })
  }

  await currentUserRefreshPromise
  return authStorage.getUser()
}

router.beforeEach(async (to) => {
  const token = authStorage.getToken()
  let user = authStorage.getUser()

  if (token && to.path !== '/login') {
    try {
      user = (await refreshCurrentUser()) || user
    } catch {
      return '/login'
    }
  }

  if (to.path === '/login' && token) {
    const fallback = findFirstAccessibleRoute(user?.permissions || [], user?.roleCode)
    return fallback?.path || '/login'
  }

  if (to.path !== '/login' && !token) {
    return '/login'
  }

  const requiredPermission = typeof to.meta.permission === 'string' ? to.meta.permission : undefined
  if (requiredPermission && user?.roleCode !== SUPER_ADMIN_ROLE_CODE && !user?.permissions?.includes(requiredPermission)) {
    const fallback = findFirstAccessibleRoute(user?.permissions || [], user?.roleCode)
    if (!fallback) {
      authStorage.clear()
      return '/login'
    }
    return fallback.path
  }

  return true
})

export default router
