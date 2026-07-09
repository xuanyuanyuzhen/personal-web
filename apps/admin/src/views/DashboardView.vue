<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { getDashboardStatistics, type DashboardStatistics, type TrendPoint } from '../services/content';

echarts.use([GridComponent, LegendComponent, LineChart, TooltipComponent, CanvasRenderer]);

const statistics = ref<DashboardStatistics | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const visitChartElement = ref<HTMLElement | null>(null);
const likeChartElement = ref<HTMLElement | null>(null);

let visitChart: EChartsType | null = null;
let likeChart: EChartsType | null = null;

const metricCards = computed(() => [
  {
    label: '总访问量',
    value: formatNumber(statistics.value?.visits.total ?? 0),
  },
  {
    label: '今日访问量',
    value: formatNumber(statistics.value?.visits.today ?? 0),
  },
  {
    label: '点赞总数',
    value: formatNumber(statistics.value?.likes.total ?? 0),
  },
]);

const shortcuts = [
  { description: '发布短句、整理置顶与标签', label: '碎碎念', to: '/dashboard/thoughts' },
  { description: '维护文章、分类和封面', label: '随笔', to: '/dashboard/essays' },
  { description: '上传照片、调整相册排序', label: '照片墙', to: '/dashboard/photos' },
  { description: '处理留言与评论审核', label: '留言审核', to: '/dashboard/messages' },
  { description: '站点信息、关于我与公告', label: '系统设置', to: '/dashboard/settings' },
];

onMounted(() => {
  loadDashboard();
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  visitChart?.dispose();
  likeChart?.dispose();
});

async function loadDashboard() {
  loading.value = true;
  errorMessage.value = '';

  try {
    statistics.value = await getDashboardStatistics();
    await nextTick();
    renderCharts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '统计数据加载失败';
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  renderLineChart({
    color: '#2f5fd0',
    element: visitChartElement.value,
    name: '访问量',
    points: statistics.value?.visits.last30Days ?? [],
    target: 'visit',
  });
  renderLineChart({
    color: '#d9467e',
    element: likeChartElement.value,
    name: '点赞数',
    points: statistics.value?.likes.last7Days ?? [],
    target: 'like',
  });
}

function renderLineChart(input: {
  color: string;
  element: HTMLElement | null;
  name: string;
  points: TrendPoint[];
  target: 'like' | 'visit';
}) {
  if (!input.element) {
    return;
  }

  const chart = input.target === 'visit' ? (visitChart ??= echarts.init(input.element)) : (likeChart ??= echarts.init(input.element));
  const option: EChartsCoreOption = {
    color: [input.color],
    grid: {
      bottom: 34,
      containLabel: true,
      left: 8,
      right: 16,
      top: 24,
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        color: '#718096',
      },
      axisLine: {
        lineStyle: {
          color: '#d8dee9',
        },
      },
      axisTick: {
        show: false,
      },
      boundaryGap: false,
      data: input.points.map((item) => item.date.slice(5)),
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        color: '#718096',
      },
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: '#eef2f7',
        },
      },
      type: 'value',
    },
    series: [
      {
        areaStyle: {
          color: `${input.color}18`,
        },
        data: input.points.map((item) => item.count),
        lineStyle: {
          color: input.color,
          width: 3,
        },
        name: input.name,
        smooth: true,
        symbolSize: 6,
        type: 'line',
      },
    ],
  };

  chart.setOption(option, true);
}

function resizeCharts() {
  visitChart?.resize();
  likeChart?.resize();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatPageType(value: string) {
  const labels: Record<string, string> = {
    ESSAY: '随笔',
    MESSAGE: '留言板',
    PAGE: '页面',
    PHOTO: '照片墙',
    SITE: '站点',
    THOUGHT: '碎碎念',
  };

  return labels[value] ?? value;
}
</script>

<template>
  <section
    class="dashboard-page"
    aria-labelledby="dashboard-title"
  >
    <div class="dashboard-heading">
      <div>
        <p class="eyebrow">
          Statistics
        </p>
        <h2 id="dashboard-title">
          仪表盘
        </h2>
        <p>
          访问量与点赞趋势概览。
        </p>
      </div>
      <el-button
        type="primary"
        :loading="loading"
        @click="loadDashboard"
      >
        刷新数据
      </el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      class="dashboard-alert"
      type="error"
      :title="errorMessage"
      show-icon
      :closable="false"
    />

    <div class="metric-grid">
      <div
        v-for="card in metricCards"
        :key="card.label"
        class="metric-item"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </div>
    </div>

    <div class="chart-grid">
      <section class="dashboard-block">
        <div class="block-title">
          <h3>最近 30 天访问趋势</h3>
          <span>PV</span>
        </div>
        <div
          ref="visitChartElement"
          class="statistics-chart"
        />
      </section>

      <section class="dashboard-block">
        <div class="block-title">
          <h3>最近 7 天点赞趋势</h3>
          <span>Like</span>
        </div>
        <div
          ref="likeChartElement"
          class="statistics-chart"
        />
      </section>
    </div>

    <div class="dashboard-lower-grid">
      <section class="dashboard-block">
        <div class="block-title">
          <h3>页面浏览排行</h3>
          <span>Top pages</span>
        </div>
        <div
          v-if="statistics?.visits.topPages.length"
          class="page-rank-list"
        >
          <div
            v-for="item in statistics.visits.topPages"
            :key="`${item.pageType}-${item.pageId ?? item.path}`"
            class="page-rank-item"
          >
            <div>
              <strong>{{ item.path }}</strong>
              <span>{{ formatPageType(item.pageType) }} · {{ item.pageId ?? '列表页' }}</span>
            </div>
            <b>{{ formatNumber(item.count) }}</b>
          </div>
        </div>
        <el-empty
          v-else
          description="暂无访问记录"
        />
      </section>

      <section class="dashboard-block">
        <div class="block-title">
          <h3>常用入口</h3>
          <span>Quick actions</span>
        </div>
        <div class="shortcut-grid">
          <RouterLink
            v-for="item in shortcuts"
            :key="item.to"
            class="shortcut-link"
            :to="item.to"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.description }}</span>
          </RouterLink>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 18px;
}

.dashboard-heading {
  align-items: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  padding: 24px;
}

.dashboard-heading h2 {
  color: #172033;
  font-size: 24px;
  line-height: 1.2;
  margin: 0 0 10px;
}

.dashboard-heading p:not(.eyebrow) {
  color: #5f6b7c;
  margin: 0;
}

.dashboard-alert {
  border-radius: 8px;
}

.metric-grid,
.chart-grid,
.dashboard-lower-grid {
  display: grid;
  gap: 16px;
}

.metric-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.chart-grid,
.dashboard-lower-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.metric-item,
.dashboard-block {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.metric-item {
  padding: 20px;
}

.metric-item span {
  color: #718096;
  display: block;
  font-size: 13px;
  margin-bottom: 10px;
}

.metric-item strong {
  color: #172033;
  font-size: 28px;
  line-height: 1;
}

.dashboard-block {
  min-width: 0;
  padding: 20px;
}

.block-title {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.block-title h3 {
  color: #172033;
  font-size: 16px;
  margin: 0;
}

.block-title span {
  color: #718096;
  font-size: 12px;
}

.statistics-chart {
  height: 280px;
  width: 100%;
}

.page-rank-list {
  display: grid;
  gap: 10px;
}

.page-rank-item {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #edf1f7;
  border-radius: 8px;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 12px 14px;
}

.page-rank-item strong,
.shortcut-link strong {
  color: #172033;
  display: block;
  font-size: 14px;
}

.page-rank-item span,
.shortcut-link span {
  color: #718096;
  display: block;
  font-size: 12px;
  margin-top: 4px;
}

.page-rank-item b {
  color: #2f5fd0;
  font-size: 16px;
}

.shortcut-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.shortcut-link {
  background: #f8fafc;
  border: 1px solid #edf1f7;
  border-radius: 8px;
  padding: 14px;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.shortcut-link:hover,
.shortcut-link:focus {
  border-color: #2f5fd0;
  transform: translateY(-1px);
}
</style>
