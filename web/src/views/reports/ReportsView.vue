<script setup lang="ts">
import { computed } from 'vue'
import PerformanceReportView from './PerformanceReportView.vue'
import { hasAnyPermission, hasPermission } from '../../utils/permissions'

const canViewFirstSalesPersonal = computed(() => hasPermission('reports.firstSales.view'))
const canViewFirstSalesTeam = computed(() => hasPermission('reports.firstSales.teamView'))
const canViewSecondSalesPersonal = computed(() => hasPermission('reports.secondSales.view'))
const canViewSecondSalesTeam = computed(() => hasPermission('reports.secondSales.teamView'))
const canViewThirdSalesPersonal = computed(() => hasPermission('reports.thirdSales.view'))
const canViewThirdSalesTeam = computed(() => hasPermission('reports.thirdSales.teamView'))

const hasAnyReportPermission = computed(() =>
  hasAnyPermission([
    'reports.firstSales.view',
    'reports.firstSales.teamView',
    'reports.secondSales.view',
    'reports.secondSales.teamView',
    'reports.thirdSales.view',
    'reports.thirdSales.teamView',
  ]),
)
</script>

<template>
  <div v-if="hasAnyReportPermission" class="page-stack">
    <PerformanceReportView v-if="canViewFirstSalesPersonal" stage="first-sales" scope="personal" title="一销业绩（个人）" />
    <PerformanceReportView v-if="canViewFirstSalesTeam" stage="first-sales" scope="team" title="一销业绩（团队）" />
    <PerformanceReportView v-if="canViewSecondSalesPersonal" stage="second-sales" scope="personal" title="二销业绩（个人）" />
    <PerformanceReportView v-if="canViewSecondSalesTeam" stage="second-sales" scope="team" title="二销业绩（团队）" />
    <PerformanceReportView v-if="canViewThirdSalesPersonal" stage="third-sales" scope="personal" title="三销业绩（个人）" />
    <PerformanceReportView v-if="canViewThirdSalesTeam" stage="third-sales" scope="team" title="三销业绩（团队）" />
  </div>
</template>
