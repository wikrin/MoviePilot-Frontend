<script setup lang="ts">
import api from '@/api'
import { doneNProgress, startNProgress } from '@/api/nprogress'
import { SubscribeShare } from '@/api/types'
import router from '@/router'
import { useToast } from 'vue-toast-notification'
import { VBtn } from 'vuetify/lib/components/index.mjs'

// 输入参数
const props = defineProps({
  media: Object as PropType<SubscribeShare>,
})

// 定义事件
const emit = defineEmits(['fork', 'delete', 'close'])

// 从 provide 中获取全局设置
const globalSettings: any = inject('globalSettings')

// 提示框
const $toast = useToast()

// 处理中
const processing = ref(false)

// 删除中
const deleting = ref(false)

// 计算海报图片地址
const posterUrl = computed(() => {
  const url = props.media?.poster
  // 使用图片缓存
  if (globalSettings.GLOBAL_IMAGE_CACHE && url)
    return `${import.meta.env.VITE_API_BASE_URL}system/cache/image?url=${encodeURIComponent(url)}`
  return url
})

// 查看媒体详情
async function viewMediaDetail() {
  router.push({
    path: '/media',
    query: {
      mediaid: `${props.media?.tmdbid ? `tmdb:${props.media?.tmdbid}` : `douban:${props.media?.doubanid}`}`,
      type: props.media?.type,
    },
  })
}

// 复用订阅
async function doFork() {
  // 开始处理
  startNProgress()
  try {
    processing.value = true
    // 请求API
    const result: { [key: string]: any } = await api.post('subscribe/fork', props.media)
    // 订阅状态
    if (result.success) {
      $toast.success(`${props.media?.share_title} 添加订阅成功！`)
      // 完成
      emit('fork', result.data.id)
    } else {
      $toast.error(`${props.media?.share_title} 添加订阅失败：${result.message}！`)
    }
  } catch (error) {
    console.error(error)
  } finally {
    processing.value = false
    doneNProgress()
  }
}

// 删除订阅分享
async function doDelete() {
  // 开始处理
  startNProgress()
  try {
    deleting.value = true
    // 请求API
    const result: { [key: string]: any } = await api.delete(`subscribe/share/${props.media?.id}`, {
      params: {
        share_uid: globalSettings.USER_UNIQUE_ID,
      },
    })
    // 订阅状态
    if (result.success) {
      $toast.success(`${props.media?.share_title} 取消分享成功！`)
      // 完成
      emit('delete', result.data.id)
    } else {
      $toast.error(`${props.media?.share_title} 取消分享失败：${result.message}！`)
    }
  } catch (error) {
    console.error(error)
  } finally {
    deleting.value = false
    doneNProgress()
  }
}
</script>
<template>
  <VDialog max-width="40rem">
    <VCard>
      <DialogCloseBtn @click="emit('close')" />
      <VCardText>
        <VCol>
          <div class="d-flex justify-space-between flex-wrap flex-md-nowrap flex-column flex-md-row">
            <div class="ma-auto">
              <VImg
                width="10rem"
                aspect-ratio="2/3"
                class="object-cover aspect-w-2 aspect-h-3 rounded-lg ring-1 ring-gray-500"
                :src="posterUrl"
                @click="viewMediaDetail"
                cover
              >
                <template #placeholder>
                  <div class="w-full h-full">
                    <VSkeletonLoader class="object-cover aspect-w-2 aspect-h-3" />
                  </div>
                </template>
              </VImg>
            </div>
            <div class="flex-grow">
              <VCardItem>
                <VCardTitle class="text-center text-md-left">
                  {{ props.media?.share_title }}
                </VCardTitle>
                <VCardSubtitle
                  class="text-center text-md-left break-words whitespace-break-spaces line-clamp-2 overflow-hidden text-ellipsis ..."
                >
                  {{ props.media?.share_comment }}
                </VCardSubtitle>
                <VList lines="one">
                  <VListItem class="ps-0">
                    <VListItemTitle class="text-center text-md-left">
                      <span class="font-weight-medium">分享人：</span>
                      <span class="text-body-1"> {{ media?.share_user }}</span>
                    </VListItemTitle>
                  </VListItem>
                  <VListItem class="ps-0" v-if="media?.keyword">
                    <VListItemTitle class="text-center text-md-left">
                      <span class="font-weight-medium">搜索词：</span>
                      <span class="text-body-1"> {{ media?.keyword }}</span>
                    </VListItemTitle>
                  </VListItem>
                  <VListItem class="ps-0" v-if="media?.custom_words">
                    <VListItemTitle
                      class="text-center text-md-left break-words whitespace-break-spaces line-clamp-10 overflow-hidden text-ellipsis ..."
                    >
                      <span class="font-weight-medium">识别词：</span>
                      <span class="text-body-1"> {{ media?.custom_words }}</span>
                    </VListItemTitle>
                  </VListItem>
                </VList>
                <div class="text-center text-md-left">
                  <div>
                    <VBtn
                      color="primary"
                      :disabled="processing"
                      @click="doFork"
                      prepend-icon="mdi-heart"
                      :loading="processing"
                    >
                      添加到我的订阅
                    </VBtn>
                    <VBtn
                      v-if="props.media?.share_uid && props.media?.share_uid === globalSettings.USER_UNIQUE_ID"
                      color="error"
                      :disabled="deleting"
                      @click="doDelete"
                      prepend-icon="mdi-delete"
                      :loading="deleting"
                      class="ms-2"
                    >
                      取消分享
                    </VBtn>
                  </div>
                  <div class="text-xs mt-2" v-if="props.media?.count">
                    <VIcon icon="mdi-fire" />共 {{ props.media?.count?.toLocaleString() }} 次复用
                  </div>
                </div>
              </VCardItem>
            </div>
          </div>
        </VCol>
      </VCardText>
    </VCard>
  </VDialog>
</template>
