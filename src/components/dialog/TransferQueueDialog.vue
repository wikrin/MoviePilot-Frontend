<script lang="ts" setup>
import { formatFileSize } from '@/@core/utils/formatters'
import api from '@/api'
import { FileItem, TransferQueue } from '@/api/types'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useBackgroundOptimization } from '@/composables/useBackgroundOptimization'

// 多语言支持
const { t } = useI18n()
const { useProgressSSE } = useBackgroundOptimization()

// 显示器宽度
const display = useDisplay()
// 定义触发的自定义事件
const emit = defineEmits(['close'])

// 数据列表
const dataList = ref<TransferQueue[]>([])

// 整理进度文本
const progressText = ref(t('dialog.transferQueue.processing'))

// 整理进度
const progressValue = ref(0)

// 数据可刷新标志
const refreshFlag = ref(false)

// 进度是否激活
const progressActive = ref(false)

// 活动标签
const activeTab = ref('')

// 状态标签
const stateDict: { [key: string]: string } = {
  'waiting': t('dialog.transferQueue.waitingState'),
  'running': t('dialog.transferQueue.runningState'),
  'completed': t('dialog.transferQueue.finishedState'),
  'failed': t('dialog.transferQueue.failedState'),
  'cancelled': t('dialog.transferQueue.cancelledState'),
}

// 获取状态颜色
function getStateColor(state: string) {
  if (state === 'waiting') return 'gray'
  else if (state === 'running') return 'primary'
  else if (state === 'completed') return 'success'
  else return 'error'
}

// 从dataList中提取所有的媒体信息
const mediaList = computed(() => {
  return dataList.value.map(item => item.media)
})

// 按media计算总数和完成数，返回 x/x
function getMediaCount(title_year: string) {
  // 按title_year查询出所有media列表
  const medias = dataList.value.filter(item => item.media.title_year === title_year)
  // 计算media下任务的总数
  const total = medias.reduce((acc, cur) => acc + cur.tasks.length, 0)
  // 计算media下任务的完成数
  const completed = medias.reduce((acc, cur) => acc + cur.tasks.filter(task => task.state === 'completed').length, 0)
  return `${completed} / ${total}`
}

// 根据媒体信息获取对应的整理任务
const activeTasks = computed(() => {
  return dataList.value.find(item => item.media.title_year === activeTab.value)?.tasks
})

// 调用API获取队列信息
async function get_transfer_queue() {
  try {
    dataList.value = await api.get('transfer/queue')
    if (dataList.value.length > 0) {
      if (!activeTab.value || activeTasks.value?.length == 0) activeTab.value = dataList.value[0].media.title_year || ''
    }
  } catch (error) {
    console.error(error)
  }
}

// 移除队列任务
async function remove_queue_task(fileitem: FileItem) {
  try {
    await api.delete(`transfer/queue`, { data: fileitem })
    get_transfer_queue()
  } catch (error) {
    console.error(error)
  }
}

// 进度SSE消息处理函数
function handleProgressMessage(event: MessageEvent) {
  const progress = JSON.parse(event.data)
  if (progress) {
    if (!progress.enable) {
      progressText.value = t('dialog.transferQueue.processing')
      progressValue.value = 0
      if (refreshFlag.value) {
        refreshFlag.value = false
        get_transfer_queue()
      }
      return
    }
    progressText.value = progress.text
    progressValue.value = progress.value
    if (progress.value >= 100 && refreshFlag.value) {
      refreshFlag.value = false
      get_transfer_queue()
    } else {
      if (progress.value > 0 && refreshFlag.value && progress.text?.includes('整理完成')) {
        refreshFlag.value = false
        get_transfer_queue()
      } else {
        refreshFlag.value = true
      }
    }
  }
}

// 使用优化的进度SSE连接
const progressSSE = useProgressSSE(
  `${import.meta.env.VITE_API_BASE_URL}system/progress/filetransfer`,
  handleProgressMessage,
  'transfer-queue-progress',
  progressActive,
)

// 使用SSE监听加载进度
function startLoadingProgress() {
  progressText.value = t('dialog.transferQueue.processing')
  progressActive.value = true
  progressSSE.start()
}

// 停止监听加载进度
function stopLoadingProgress() {
  progressActive.value = false
  progressSSE.stop()
}

onMounted(() => {
  get_transfer_queue()
  startLoadingProgress()
})

onUnmounted(() => {
  stopLoadingProgress()
})
</script>

<template>
  <DialogWrapper scrollable max-width="50rem" :fullscreen="!display.mdAndUp.value">
    <VCard class="mx-auto" width="100%">
      <VCardItem>
        <VCardTitle>{{ t('dialog.transferQueue.title') }}</VCardTitle>
      </VCardItem>
      <VDialogCloseBtn @click="emit('close')" />
      <VDivider />
      <VProgressLinear
        v-if="dataList.length > 0 && progressValue > 0"
        :value="progressValue"
        color="primary"
        indeterminate
        :height="2"
      />
      <VCardItem v-if="dataList.length > 0 && progressValue > 0" class="text-center pt-2">
        <span class="text-sm">{{ progressText }}</span>
      </VCardItem>
      <VCardText v-if="dataList.length === 0" class="text-center"> {{ t('dialog.transferQueue.noTasks') }} </VCardText>
      <VCardText>
        <VTabs v-model="activeTab" show-arrows class="v-tabs-pill" stacked>
          <VTab
            v-for="media in mediaList"
            :value="media.title_year"
            selected-class="v-slide-group-item--active v-tab--selected"
          >
            <div class="font-bold text-lg">{{ media.title }}</div>
            <div>({{ getMediaCount(media.title_year || '') }})</div>
          </VTab>
        </VTabs>
        <VWindow v-model="activeTab" class="mt-5 disable-tab-transition" :touch="false">
          <VWindowItem v-for="media in mediaList" :value="media.title_year">
            <VList>
              <VListItem v-for="task in activeTasks">
                <VListItemTitle>{{ task.fileitem.name }}</VListItemTitle>
                <VListItemSubtitle>
                  {{ t('dialog.transferQueue.sizeTitle') }}：{{ formatFileSize(task.fileitem.size || 0) }}
                  <VChip size="small" :color="getStateColor(task.state)" class="ms-2">
                    {{ stateDict[task.state] }}
                  </VChip>
                </VListItemSubtitle>
                <template #append>
                  <IconBtn size="small" icon="mdi-cancel" @click="remove_queue_task(task.fileitem)" />
                </template>
              </VListItem>
            </VList>
          </VWindowItem>
        </VWindow>
      </VCardText>
    </VCard>
  </DialogWrapper>
</template>
