<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { isToday } from '@/@core/utils/index'
import dayjs from 'dayjs'
import { useBackgroundOptimization } from '@/composables/useBackgroundOptimization'

// 定义输入变量
const props = defineProps<{
  logfile: string
}>()

// 国际化
const { t } = useI18n()
const { useSSE } = useBackgroundOptimization()

// 已解析的日志列表
const parsedLogs = ref<{ level: string; date: string; time: string; program: string; content: string }[]>([])

// 组件是否已挂载
const isMounted = ref(false)

// 表头
const headers = [
  { title: t('logging.level'), value: 'level' },
  { title: t('logging.time'), value: 'time' },
  { title: t('logging.program'), value: 'program' },
  { title: t('logging.content'), value: 'content' },
]

// 日志颜色映射表
const logColorMap: Record<string, string> = {
  DEBUG: 'secondary',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
}

// 获取日志颜色
function getLogColor(level: string): string {
  return logColorMap[level] || 'secondary'
}

// 日志缓冲区和超时处理
const buffer: string[] = []
let timeoutId: number | null = null

// SSE消息处理函数
function handleSSEMessage(event: MessageEvent) {
  const message = event.data
  if (message) {
    buffer.push(message)
    if (!timeoutId) {
      timeoutId = window.setTimeout(() => {
        // 解析新日志
        const newParsedLogs = buffer
          .map(log => {
            const logPattern = /^【(.*?)】\s*([\d]{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)\s+(.*?)\s*-\s*(.*?)\s*-\s*(.*)$/
            const matches = log.match(logPattern)
            if (matches) {
              const [, level, date, time, program, content] = matches
              return { level, date, time, program, content }
            }
            return null
          })
          .filter(Boolean)
        // 倒序后插入parsedLogs顶部
        parsedLogs.value.unshift(...(newParsedLogs.reverse() as any[]))
        // 保留最新的200条日志
        parsedLogs.value = parsedLogs.value.slice(0, 200)
        // 重置buffer
        buffer.length = 0
        timeoutId = null
      }, 100)
    }
  }
}

// 使用优化的SSE连接，添加延迟确保弹窗完全打开
const { manager, isConnected } = useSSE(
  `${import.meta.env.VITE_API_BASE_URL}system/logging?logfile=${encodeURIComponent(props.logfile) ?? 'moviepilot.log'}`,
  handleSSEMessage,
  `logging-${props.logfile}`,
  {
    backgroundCloseDelay: 5000,
    reconnectDelay: 3000,
    maxReconnectAttempts: 3,
    connectDelay: 300, // 延迟300ms建立连接，确保弹窗完全打开
  },
)

// 监听弹窗状态变化，确保弹窗完全打开后再建立连接
onMounted(() => {
  // 延迟标记组件已挂载，确保弹窗完全渲染
  setTimeout(() => {
    isMounted.value = true
  }, 200)
})

// 监听连接状态变化
watch(isConnected, connected => {})

// 监听日志数据变化
watch(parsedLogs, logs => {}, { deep: true })
</script>

<template>
  <LoadingBanner
    v-if="!isMounted || !isConnected || parsedLogs.length === 0"
    class="mt-12"
    :text="!isMounted ? t('logging.initializing') + ' ...' : t('logging.refreshing') + ' ...'"
  />
  <div v-else>
    <VTable class="table-rounded" hide-default-footer disable-sort>
      <tbody>
        <VDataTableVirtual
          :headers="headers"
          :items="parsedLogs"
          height="100%"
          density="compact"
          hover
          hide-default-header
        >
          <template #item.level="{ item }">
            <VChip size="small" :color="getLogColor(item.level)" variant="elevated" v-text="item.level" />
          </template>
          <template #item.time="{ item }">
            <span class="text-sm">
              {{
                isToday(dayjs(item.date).toDate())
                  ? item.time
                  : `${item.date}
              ${item.time}`
              }}
            </span>
          </template>
          <template #item.program="{ item }">
            <h6 class="text-sm font-weight-medium">{{ item.program }}</h6>
          </template>
          <template #item.content="{ item }">
            <span class="text-sm" :class="`text-${getLogColor(item.level)}`">
              {{ item.content }}
            </span>
          </template>
        </VDataTableVirtual>
      </tbody>
    </VTable>
  </div>
</template>
