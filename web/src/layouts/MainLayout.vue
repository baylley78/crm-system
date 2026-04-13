<script setup lang="ts">
import { UserFilled, Document, DataBoard, Money, Setting, Briefcase, Management, SwitchButton, Histogram, Service } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import type { TabsPaneContext } from 'element-plus'
import { computed, markRaw, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authStorage } from '../auth'
import { hasAnyPermission } from '../utils/permissions'

const VISITED_TABS_KEY = 'crm_visited_tabs'
const ACTIVE_TAB_KEY = 'crm_active_tab'
const DASHBOARD_PATH = '/dashboard'

type MenuChild = {
  title: string
  index: string
  permission?: string
}

type MenuItem = {
  title: string
  index: string
  icon?: unknown
  permission?: string
  children?: MenuChild[]
}

type VisitedTab = {
  path: string
  title: string
  closable: boolean
}

const route = useRoute()
const router = useRouter()
const currentUser = computed(() => authStorage.getUser())

const hasPermission = (permission?: string) => !permission || currentUser.value?.roleCode === 'SUPER_ADMIN' || currentUser.value?.permissions?.includes(permission)

const allMenus: MenuItem[] = [
  {
    title: '首页',
    index: '/dashboard',
    icon: markRaw(DataBoard),
    permission: 'dashboard.view',
  },
  {
    title: '客户管理',
    index: '/customers',
    icon: markRaw(UserFilled),
    permission: 'customers.view',
  },
  {
    title: '合同档案',
    index: '/contracts',
    icon: markRaw(Document),
    permission: 'contracts.view',
  },
  {
    title: '一销业绩（调解）',
    index: '/first-sales/list',
    icon: markRaw(Money),
    permission: 'firstSales.view',
  },
  {
    title: '二销管理',
    index: '/second-sales',
    icon: markRaw(Briefcase),
    children: [
      { title: '二销接待', index: '/second-sales/assignments', permission: 'secondSales.view' },
      { title: '二销业绩列表', index: '/second-sales/litigation', permission: 'secondSales.view' },
    ],
  },
  {
    title: '法务系统',
    index: '/legal',
    icon: markRaw(Document),
    permission: 'legal.view',
  },
  {
    title: '调解系统',
    index: '/mediation',
    icon: markRaw(SwitchButton),
    permission: 'mediation.view',
  },
  {
    title: '售后管理',
    index: '/after-sales',
    icon: markRaw(Service),
    children: [
      { title: '退款系统', index: '/refund', permission: 'refund.view' },
      { title: '司法投诉', index: '/after-sales/judicial-complaints', permission: 'judicialComplaint.view' },
      { title: '质检管理', index: '/quality', permission: 'quality.view' },
    ],
  },
  {
    title: '三销管理',
    index: '/third-sales',
    icon: markRaw(Management),
    children: [
      { title: '三销接待', index: '/third-sales/reception', permission: 'thirdSales.view' },
      { title: '三销业绩（开庭）', index: '/third-sales/performance', permission: 'thirdSales.view' },
    ],
  },
  {
    title: '业绩报表',
    index: '/reports-group',
    icon: markRaw(Histogram),
    permission: hasAnyPermission([
      'reports.firstSales.view',
      'reports.firstSales.teamView',
      'reports.secondSales.view',
      'reports.secondSales.teamView',
      'reports.thirdSales.view',
      'reports.thirdSales.teamView',
    ])
      ? undefined
      : '__hidden__',
    children: [
      { title: '一销业绩（个人）', index: '/reports/first-sales/personal', permission: 'reports.firstSales.view' },
      { title: '一销业绩（团队）', index: '/reports/first-sales/team', permission: 'reports.firstSales.teamView' },
      { title: '二销业绩（个人）', index: '/reports/second-sales/personal', permission: 'reports.secondSales.view' },
      { title: '二销业绩（团队）', index: '/reports/second-sales/team', permission: 'reports.secondSales.teamView' },
      { title: '三销业绩（个人）', index: '/reports/third-sales/personal', permission: 'reports.thirdSales.view' },
      { title: '三销业绩（团队）', index: '/reports/third-sales/team', permission: 'reports.thirdSales.teamView' },
    ],
  },
  {
    title: 'OA审批',
    index: '/oa',
    icon: markRaw(Document),
    children: [
      { title: '报销申请', index: '/oa/reimbursements', permission: 'oa.approvals.view' },
      { title: '请假申请', index: '/oa/leaves', permission: 'oa.approvals.view' },
      { title: '补卡申请', index: '/oa/punch-cards', permission: 'oa.approvals.view' },
    ],
  },
  {
    title: '来客统计',
    index: '/traffic-stats',
    icon: markRaw(Histogram),
    permission: hasAnyPermission(['trafficStats.submit', 'trafficStats.view']) ? undefined : '__hidden__',
  },
  {
    title: '无效客资',
    index: '/invalid-leads',
    icon: markRaw(Service),
    permission: hasAnyPermission(['invalidLeads.submit', 'invalidLeads.view']) ? undefined : '__hidden__',
  },
  {
    title: '系统管理',
    index: '/system',
    icon: markRaw(Setting),
    children: [
      { title: '用户管理', index: '/system/users', permission: 'system.users.view' },
      { title: '部门管理', index: '/system/departments', permission: 'system.departments.view' },
      { title: '收款配置', index: '/system/payment-accounts', permission: 'system.paymentAccounts.manage' },
      { title: '开庭配置', index: '/system/court-config', permission: 'system.courtConfig.manage' },
      { title: '钉钉报单', index: '/system/dingtalk-report', permission: 'system.dingTalkReports.manage' },
      { title: '权限组配置', index: '/system/roles', permission: 'system.roles.view' },
      { title: '权限组人员分配', index: '/system/role-assignments', permission: 'system.roles.assign' },
    ],
  },
]

const menus = computed<MenuItem[]>(() => {
  return allMenus.reduce<MenuItem[]>((result, menu) => {
    if (!menu.children) {
      if (hasPermission(menu.permission)) {
        result.push(menu)
      }
      return result
    }

    const children = menu.children.filter((child) => hasPermission(child.permission))
    if (children.length) {
      result.push({ ...menu, children, permission: undefined })
    }
    return result
  }, [])
})

const flatMenuItems = computed(() =>
  menus.value.flatMap((menu) =>
    menu.children?.length
      ? menu.children.map((child) => ({ path: child.index, title: child.title }))
      : [{ path: menu.index, title: menu.title }],
  ),
)

const menuTitleMap = computed(() => new Map(flatMenuItems.value.map((item) => [item.path, item.title])))
const activeTab = ref(route.path)

const restoreVisitedTabs = (): VisitedTab[] => {
  const raw = sessionStorage.getItem(VISITED_TABS_KEY)
  if (!raw) {
    return [{ path: DASHBOARD_PATH, title: menuTitleMap.value.get(DASHBOARD_PATH) || '首页', closable: false }]
  }

  try {
    const parsed = JSON.parse(raw) as VisitedTab[]
    const allowedPaths = new Set(flatMenuItems.value.map((item) => item.path))
    const restored = parsed.filter((item) => allowedPaths.has(item.path))
    const withDashboard = restored.some((item) => item.path === DASHBOARD_PATH)
      ? restored.map((item) => (item.path === DASHBOARD_PATH ? { ...item, closable: false } : item))
      : [{ path: DASHBOARD_PATH, title: menuTitleMap.value.get(DASHBOARD_PATH) || '首页', closable: false }, ...restored]
    return withDashboard.length ? withDashboard : [{ path: DASHBOARD_PATH, title: '首页', closable: false }]
  } catch {
    return [{ path: DASHBOARD_PATH, title: menuTitleMap.value.get(DASHBOARD_PATH) || '首页', closable: false }]
  }
}

const visitedTabs = ref<VisitedTab[]>(restoreVisitedTabs())

const persistTabs = () => {
  sessionStorage.setItem(VISITED_TABS_KEY, JSON.stringify(visitedTabs.value))
  sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab.value)
}

const ensureTab = (path: string) => {
  const title = menuTitleMap.value.get(path)
  if (!title) {
    return
  }

  const existing = visitedTabs.value.find((item) => item.path === path)
  if (existing) {
    existing.title = title
    existing.closable = path !== DASHBOARD_PATH
    return
  }

  visitedTabs.value.push({ path, title, closable: path !== DASHBOARD_PATH })
}

watch(
  [menuTitleMap, () => route.path],
  () => {
    ensureTab(route.path)
    activeTab.value = route.path
    persistTabs()
  },
  { immediate: true },
)

const handleSelect = (index: string) => {
  router.push(index)
}

const handleTabClick = (name: string | number) => {
  if (typeof name === 'string' && name !== route.path) {
    router.push(name)
  }
}

const handleTabPaneClick = (tab: TabsPaneContext) => {
  if (tab.paneName !== undefined) {
    handleTabClick(tab.paneName)
  }
}

const closeTab = (path: string) => {
  const index = visitedTabs.value.findIndex((item) => item.path === path)
  if (index < 0) {
    return
  }

  const closingCurrent = route.path === path
  visitedTabs.value.splice(index, 1)

  if (!closingCurrent) {
    persistTabs()
    return
  }

  const nextTab = visitedTabs.value[index] || visitedTabs.value[index - 1] || visitedTabs.value[0]
  const nextPath = nextTab?.path || DASHBOARD_PATH
  activeTab.value = nextPath
  persistTabs()
  router.push(nextPath)
}

const handleTabRemove = (name: string | number) => {
  if (typeof name === 'string') {
    closeTab(name)
  }
}

const closeCurrentTab = () => {
  if (route.path === DASHBOARD_PATH) {
    return
  }
  closeTab(route.path)
}

const closeOtherTabs = () => {
  visitedTabs.value = visitedTabs.value.filter((item) => item.path === DASHBOARD_PATH || item.path === route.path)
  persistTabs()
}

const closeAllTabs = () => {
  visitedTabs.value = visitedTabs.value.filter((item) => item.path === DASHBOARD_PATH)
  activeTab.value = DASHBOARD_PATH
  persistTabs()
  if (route.path !== DASHBOARD_PATH) {
    router.push(DASHBOARD_PATH)
  }
}

const logout = async () => {
  await ElMessageBox.confirm('确认退出当前账号吗？', '退出登录', {
    type: 'warning',
  })
  sessionStorage.removeItem(VISITED_TABS_KEY)
  sessionStorage.removeItem(ACTIVE_TAB_KEY)
  authStorage.clear()
  router.replace('/login')
}
</script>

<template>
  <el-container class="layout-shell">
    <el-aside width="208px" class="layout-aside">
      <div class="brand">上民佳律所</div>
      <el-menu :default-active="route.path" class="menu" unique-opened @select="handleSelect">
        <template v-for="menu in menus" :key="menu.index">
          <el-sub-menu v-if="menu.children" :index="menu.index">
            <template #title>
              <el-icon><component :is="menu.icon" /></el-icon>
              <span>{{ menu.title }}</span>
            </template>
            <el-menu-item v-for="child in menu.children" :key="child.index" :index="child.index">
              {{ child.title }}
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="menu.index">
            <el-icon><component :is="menu.icon" /></el-icon>
            <span>{{ menu.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <div>
          <div class="title">业务管理后台</div>
          <div class="subtitle">客户全流程管理</div>
        </div>
        <div class="header-actions">
          <div class="user-panel">
            <div class="user-name">{{ currentUser?.realName || '未登录' }}</div>
            <div class="user-role">{{ currentUser?.roleName || '-' }}</div>
          </div>
          <el-button @click="logout">退出登录</el-button>
        </div>
      </el-header>
      <div class="tabs-toolbar">
        <el-tabs
          :model-value="activeTab"
          type="card"
          closable
          class="visited-tabs"
          @tab-click="handleTabPaneClick"
          @tab-remove="handleTabRemove"
        >
          <el-tab-pane
            v-for="tab in visitedTabs"
            :key="tab.path"
            :name="tab.path"
            :label="tab.title"
            :closable="tab.closable"
          />
        </el-tabs>
        <el-dropdown>
          <el-button text>标签操作</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="route.path === DASHBOARD_PATH" @click="closeCurrentTab">关闭当前</el-dropdown-item>
              <el-dropdown-item @click="closeOtherTabs">关闭其他</el-dropdown-item>
              <el-dropdown-item @click="closeAllTabs">关闭全部</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-shell {
  min-height: 100vh;
}

.layout-aside {
  background: linear-gradient(180deg, #334155, #475569);
  border-right: none;
}

.brand {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 18px;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.menu {
  height: calc(100vh - 56px);
  padding: 8px;
  border-right: none;
  background: transparent;
}

:deep(.menu .el-menu) {
  background: transparent;
}

:deep(.menu .el-sub-menu__title),
:deep(.menu .el-menu-item) {
  height: 42px;
  margin-bottom: 4px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.94);
}

:deep(.menu .el-sub-menu__title .el-icon),
:deep(.menu .el-menu-item .el-icon),
:deep(.menu .el-sub-menu__title span),
:deep(.menu .el-menu-item span) {
  color: inherit;
}

:deep(.menu .el-sub-menu__title:hover),
:deep(.menu .el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

:deep(.menu .el-sub-menu.is-active > .el-sub-menu__title) {
  color: #fff;
}

:deep(.menu .el-menu-item.is-active) {
  background: rgba(59, 130, 246, 0.38);
  color: #fff;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 56px;
  padding: 0 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-panel {
  text-align: right;
}

.user-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.user-role {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.tabs-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 0;
  background: transparent;
}

.visited-tabs {
  flex: 1;
  min-width: 0;
}

:deep(.visited-tabs .el-tabs__header) {
  margin: 0;
}

:deep(.visited-tabs .el-tabs__nav-wrap::after) {
  display: none;
}

:deep(.visited-tabs .el-tabs__item) {
  height: 34px;
  border-radius: 10px 10px 0 0;
}

.layout-main {
  background: transparent;
}
</style>
