<script lang="ts" setup>
import type { Message } from '@/api/types'
import MessageCard from '@/components/cards/MessageCard.vue'
import api from '@/api'
import { useI18n } from 'vue-i18n'
import { useBackgroundOptimization } from '@/composables/useBackgroundOptimization'

// 国际化
const { t } = useI18n()
const { useSSE } = useBackgroundOptimization()

// 定义事件
const emit = defineEmits(['scroll'])

// 消息列表
const messages = ref<Message[]>([])
// 当前页数据
const currData = ref<Message[]>([])

// 是否完成加载
const isLoaded = ref(false)

// 是否加载中
const loading = ref(false)

// 当前页码
const page = ref(1)

// 存量消息最新时间
const lastTime = ref('')

// SSE消息处理函数
function handleSSEMessage(event: MessageEvent) {
  const message = event.data
  if (message) {
    const object = JSON.parse(message)
    // 使用reg_time或date字段进行比较
    const messageTime = object.reg_time || object.date
    if (compareTime(messageTime, lastTime.value) <= 0) return
    messages.value.push(object)
    nextTick(() => {
      emit('scroll') // 新消息到达时触发智能滚动
    })
  }
}

// 使用优化的SSE连接
const { manager, isConnected } = useSSE(
  `${import.meta.env.VITE_API_BASE_URL}system/message?role=user`,
  handleSSEMessage,
  'message-view',
  {
    backgroundCloseDelay: 5000,
    reconnectDelay: 3000,
    maxReconnectAttempts: 3,
  },
)

// 调用API加载存量消息
async function loadMessages({ done }: { done: any }) {
  // 如果正在加载中，直接返回
  if (loading.value) {
    done('ok')
    return
  }
  try {
    // 设置加载中
    loading.value = true
    currData.value = await api.get('message/web', {
      params: {
        page: page.value,
        size: 20,
      },
    })
    // 已加载过
    isLoaded.value = true
    if (currData.value.length > 0) {
      // 按时间排序，确保最新的消息在最后
      currData.value.sort((a, b) => {
        const timeA = a.reg_time || a.date || ''
        const timeB = b.reg_time || b.date || ''
        return compareTime(timeA, timeB)
      })

      // 取最后一条时间为存量消息最新时间
      const lastMessage = currData.value[currData.value.length - 1]
      lastTime.value = lastMessage.reg_time || lastMessage.date || ''

      // 合并数据并重新排序
      const allMessages = [...currData.value, ...messages.value]
      allMessages.sort((a, b) => {
        const timeA = a.reg_time || a.date || ''
        const timeB = b.reg_time || b.date || ''
        return compareTime(timeA, timeB)
      })
      messages.value = allMessages

      // 首次加载时滚动到底部
      if (page.value === 1) {
        nextTick(() => {
          emit('scroll')
        })
      }
      // 页码+1
      page.value++
      // 完成
      done('ok')
    } else {
      // 没有新数据
      done('empty')
    }
    // 取消加载中
    loading.value = false
  } catch (error) {
    console.error('加载消息失败:', error)
    loading.value = false
    done('error')
  }
}

// 比较yyyy-MM-dd HH:mm:ss时间大小
function compareTime(time1: string, time2: string) {
  if (!time1 && !time2) return 0
  if (!time1) return -1
  if (!time2) return 1

  try {
    // 统一时间格式处理，支持多种格式
    const normalizeTime = (time: string) => {
      // 如果是ISO格式，直接使用
      if (time.includes('T')) {
        return new Date(time).getTime()
      }
      // 如果是yyyy-MM-dd HH:mm:ss格式，替换-为/
      return new Date(time.replaceAll(/-/g, '/')).getTime()
    }

    const timestamp1 = normalizeTime(time1)
    const timestamp2 = normalizeTime(time2)

    return timestamp1 - timestamp2
  } catch (error) {
    console.error('时间比较错误:', error, 'time1:', time1, 'time2:', time2)
    return 0
  }
}

// 图片加载完成时触发智能滚动
function handleImageLoad() {
  emit('scroll')
}

// 暂停SSE连接
function pauseSSE() {
  if (manager) {
    manager.removeMessageListener('message-view')
  }
}

// 恢复SSE连接
function resumeSSE() {
  if (manager) {
    manager.addMessageListener('message-view', handleSSEMessage)
  }
}

// 暴露方法给父组件
defineExpose({
  pauseSSE,
  resumeSSE,
})

onMounted(() => {
  // 组件挂载后触发一次滚动事件
  nextTick(() => {
    emit('scroll')
  })
})
</script>

<template>
  <VInfiniteScroll
    :mode="!isLoaded ? 'intersect' : 'manual'"
    side="start"
    :items="messages"
    class="overflow-auto h-full"
    @load="loadMessages"
    :load-more-text="t('message.loadMore') + ' ...'"
  >
    <template #loading>
      <LoadingBanner />
    </template>
    <template #empty> {{ t('message.noMoreData') }} </template>
    <div>
      <div
        v-for="(msg, index) in messages"
        :key="index"
        class="chat-group d-flex mt-5 mb-8"
        :class="msg.action == 1 ? 'flex-row align-start' : 'flex-row-reverse align-end'"
      >
        <div class="d-inline-flex flex-column" :class="msg.action == 1 ? 'align-start' : 'align-end'">
          <MessageCard :message="msg" @imageload="handleImageLoad" />
        </div>
      </div>
    </div>
  </VInfiniteScroll>
</template>
