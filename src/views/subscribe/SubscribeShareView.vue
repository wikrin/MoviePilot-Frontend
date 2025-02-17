<script lang="ts" setup>
import api from '@/api'
import type { SubscribeShare } from '@/api/types'
import NoDataFound from '@/components/NoDataFound.vue'
import SubscribeShareCard from '@/components/cards/SubscribeShareCard.vue'

// 判断是否有滚动条
function hasScroll() {
  return document.body.scrollHeight - (window.innerHeight || document.documentElement.clientHeight) > 2
}

// API
const apipath = 'subscribe/shares'

// 当前页码
const page = ref(1)

// 是否加载中
const loading = ref(false)

// 是否加载完成
const isRefreshed = ref(false)

// 数据列表
const dataList = ref<SubscribeShare[]>([])
const currData = ref<SubscribeShare[]>([])

// 拼装参数
function getParams() {
  let params = {
    page: page.value,
    count: 30,
  }
  return params
}

// 获取列表数据
async function fetchData({ done }: { done: any }) {
  try {
    // 如果正在加载中，直接返回
    if (loading.value) {
      done('ok')
      return
    }

    // 加载到满屏或者加载出错
    if (!hasScroll()) {
      // 加载多次
      while (!hasScroll()) {
        // 设置加载中
        loading.value = true
        // 请求API
        currData.value = await api.get(apipath, {
          params: getParams(),
        })
        // 取消加载中
        loading.value = false
        // 标计为已请求完成
        isRefreshed.value = true
        if (currData.value.length === 0) {
          // 如果没有数据，跳出
          done('empty')
          return
        }
        // 合并数据
        dataList.value = [...dataList.value, ...currData.value]
        // 页码+1
        page.value++
        // 返回加载成功
        done('ok')
      }
    } else {
      // 设置加载中
      loading.value = true
      // 请求API
      currData.value = await api.get(apipath, {
        params: getParams(),
      })
      loading.value = false
      // 标计为已请求完成
      isRefreshed.value = true
      if (currData.value.length === 0) {
        // 如果没有数据，跳出
        done('empty')
      } else {
        // 合并数据
        dataList.value = [...dataList.value, ...currData.value]
        // 页码+1
        page.value++
        // 返回加载成功
        done('ok')
      }
    }
  } catch (error) {
    console.error(error)
    // 返回加载失败
    done('error')
  }
}

// 将数据从列表中移除
function removeData(id: number) {
  dataList.value = dataList.value.filter(item => item.id !== id)
}
</script>

<template>
  <LoadingBanner v-if="!isRefreshed" class="mt-12" />
  <VInfiniteScroll mode="intersect" side="end" :items="dataList" class="overflow-hidden" @load="fetchData">
    <template #loading />
    <template #empty />
    <div v-if="dataList.length > 0" class="grid gap-4 grid-subscribe-card mx-3" tabindex="0">
      <div v-for="data in dataList" :key="data.id">
        <SubscribeShareCard :media="data" @delete="removeData(data.id || 0)" />
      </div>
    </div>
    <NoDataFound
      v-if="dataList.length === 0 && isRefreshed"
      error-code="404"
      error-title="没有数据"
      error-description="未获取到共享订阅数据，未开启数据分享或服务器无法连接。"
    />
  </VInfiniteScroll>
</template>
