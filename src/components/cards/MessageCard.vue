<script lang="ts" setup>
import { isNullOrEmptyObject } from '@/@core/utils'
import type { Message } from '@/api/types'
import { formatDateDifference } from '@core/utils/formatters'

// 输入参数
const props = defineProps({
  message: Object as PropType<Message>,
  width: String,
  height: String,
})

// 图片是否加载完成
const isImageLoaded = ref(false)

// 图片是否加载失败
const imageLoadError = ref(false)

// 图片加载完成
async function imageLoaded() {
  isImageLoaded.value = true
}

// 链接打开新窗口
function openLink() {
  if (props.message?.link) window.open(props.message.link, '_blank')
}

// 将note转换为json
function noteToJson() {
  if (props.message?.note) {
    try {
      return JSON.parse(props.message.note)
    } catch (error) {
      return props.message.note
    }
  }
  return {}
}

// 将\n转换为html属性的换行符
function replaceNewLine(value: string) {
  if (!value) return ''
  return value.replace(/\n/g, '<br/>')
}
</script>

<template>
  <VCard variant="tonal" :width="props.width" :height="props.height" @click="openLink" max-width="23rem">
    <div v-if="props.message?.image" class="relative text-center card-cover-blurred">
      <VImg
        :src="props.message?.image"
        aspect-ratio="3/2"
        cover
        position="top"
        :class="{ shadow: isImageLoaded }"
        @load="imageLoaded"
        @error="imageLoadError = true"
      />
    </div>
    <div
      v-if="
        props.message?.title &&
        !props.message?.text &&
        !props.message?.image &&
        isNullOrEmptyObject(props.message?.note) &&
        props.message?.action === 0
      "
      class="rounded-md text-body-1 py-2 px-4 elevation-2 bg-primary text-white chat-right mb-1"
    >
      <p class="mb-0">{{ props.message?.title }}</p>
    </div>
    <VCardTitle v-else-if="props.message?.title" class="break-words whitespace-break-spaces">
      {{ props.message?.title }}
    </VCardTitle>
    <div
      v-if="props.message?.text && props.message?.action === 0"
      class="rounded-md text-body-1 py-2 px-4 elevation-2 bg-primary text-white chat-right mb-1"
    >
      <p class="mb-0">{{ props.message?.text }}</p>
    </div>
    <VCardText v-if="props.message?.text && props.message?.action === 1" v-html="replaceNewLine(props.message?.text)" />
    <VCardText v-if="!isNullOrEmptyObject(props.message?.note)">
      <VList>
        <VListItem v-for="(value, key) in noteToJson()" :key="key" two-line>
          <VListItemTitle v-if="value.title_year" class="font-bold break-words whitespace-break-spaces">
            {{ key + 1 }}. {{ value.title_year }}
          </VListItemTitle>
          <VListItemTitle v-if="value.enclosure" class="font-bold break-words whitespace-break-spaces">
            {{ key + 1 }}. {{ value.title }} {{ value.volume_factor }} ↑{{ value.seeders }}
          </VListItemTitle>
          <VListItemSubtitle v-if="value.type">
            类型：{{ value.type }} 评分：{{ value.vote_average }}
          </VListItemSubtitle>
          <VListItemSubtitle v-if="value.enclosure" class="whitespace-break-spaces">
            {{ value.description }}
          </VListItemSubtitle>
        </VListItem>
      </VList>
    </VCardText>
  </VCard>
  <div class="text-end">
    <span v-if="props.message?.action === 0" class="text-sm italic me-2">{{ props.message?.userid }}</span>
    <span class="text-sm italic me-2">{{
      formatDateDifference(props.message?.reg_time || props.message?.date || '')
    }}</span>
  </div>
</template>
