/**
 * SSE连接管理器
 * 优化后台SSE连接，减少iOS系统杀掉应用的概率
 */
export class SSEManager {
  private eventSource: EventSource | null = null
  private url: string
  private isBackground = false
  private reconnectTimer: number | null = null
  private backgroundCloseTimer: number | null = null
  private listeners: Map<string, (event: MessageEvent) => void> = new Map()
  private options: {
    backgroundCloseDelay: number
    reconnectDelay: number
    maxReconnectAttempts: number
  }
  private reconnectAttempts = 0
  private isConnecting = false

  constructor(url: string, options: Partial<typeof SSEManager.prototype.options> = {}) {
    this.url = url
    this.options = {
      backgroundCloseDelay: 5000, // 5秒后关闭后台连接
      reconnectDelay: 3000, // 3秒后重连
      maxReconnectAttempts: 3,
      ...options,
    }

    this.setupVisibilityListener()
  }

  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleBackground()
      } else {
        this.handleForeground()
      }
    })

    // 页面卸载时关闭连接
    window.addEventListener('beforeunload', () => {
      this.close()
    })
  }

  private handleBackground() {
    this.isBackground = true

    // 延迟关闭SSE连接，避免频繁切换
    if (this.backgroundCloseTimer) {
      clearTimeout(this.backgroundCloseTimer)
    }

    this.backgroundCloseTimer = window.setTimeout(() => {
      if (this.isBackground && this.eventSource) {
        this.eventSource.close()
        this.eventSource = null
      }
    }, this.options.backgroundCloseDelay)
  }

  private handleForeground() {
    this.isBackground = false

    // 清除后台关闭定时器
    if (this.backgroundCloseTimer) {
      clearTimeout(this.backgroundCloseTimer)
      this.backgroundCloseTimer = null
    }

    // 立即重新建立连接
    if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
      this.reconnectSSE()
    }
  }

  private reconnectSSE(attemptCount = 0) {
    if (attemptCount >= this.options.maxReconnectAttempts) {
      return
    }

    if (this.isConnecting) {
      return
    }

    this.isConnecting = true
    this.reconnectAttempts = attemptCount

    try {
      this.eventSource = new EventSource(this.url)

      this.eventSource.onopen = () => {
        this.isConnecting = false
        this.reconnectAttempts = 0
      }

      this.eventSource.onerror = error => {
        this.isConnecting = false

        if (this.eventSource?.readyState === EventSource.CLOSED) {
          // 连接已关闭，尝试重连
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
          }

          this.reconnectTimer = window.setTimeout(() => {
            if (!this.isBackground) {
              this.reconnectSSE(this.reconnectAttempts + 1)
            }
          }, this.options.reconnectDelay)
        }
      }

      this.eventSource.onmessage = event => {
        // 分发消息给所有监听器
        this.listeners.forEach(listener => {
          try {
            listener(event)
          } catch (error) {
            console.error('SSE: 监听器错误', error)
          }
        })
      }
    } catch (error) {
      this.isConnecting = false

      // 连接创建失败，尝试重连
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
      }

      this.reconnectTimer = window.setTimeout(() => {
        if (!this.isBackground) {
          this.reconnectSSE(this.reconnectAttempts + 1)
        }
      }, this.options.reconnectDelay)
    }
  }

  /**
   * 添加消息监听器
   */
  addMessageListener(id: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(id, listener)

    // 如果还没有连接且不在后台，现在建立连接
    if (!this.eventSource && !this.isBackground && !this.isConnecting) {
      this.reconnectSSE()
    }
  }

  /**
   * 移除消息监听器
   */
  removeMessageListener(id: string) {
    this.listeners.delete(id)

    // 如果没有监听器了，关闭连接
    if (this.listeners.size === 0) {
      this.close()
    }
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.backgroundCloseTimer) {
      clearTimeout(this.backgroundCloseTimer)
      this.backgroundCloseTimer = null
    }

    this.listeners.clear()
    this.isConnecting = false
    this.reconnectAttempts = 0
  }

  /**
   * 获取连接状态
   */
  get readyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED
  }

  /**
   * 获取连接URL
   */
  get connectionUrl(): string {
    return this.url
  }

  /**
   * 强制重新连接
   */
  forceReconnect() {
    this.close()
    if (!this.isBackground) {
      this.reconnectSSE()
    }
  }

  /**
   * 检查是否有活跃的监听器
   */
  get hasActiveListeners(): boolean {
    return this.listeners.size > 0
  }

  /**
   * 获取当前重连次数
   */
  get currentReconnectAttempts(): number {
    return this.reconnectAttempts
  }

  /**
   * 检查是否达到最大重连次数
   */
  get hasReachedMaxAttempts(): boolean {
    return this.reconnectAttempts >= this.options.maxReconnectAttempts
  }
}

/**
 * SSE管理器单例
 */
class SSEManagerSingleton {
  private managers: Map<string, SSEManager> = new Map()

  /**
   * 获取或创建SSE管理器
   */
  getManager(url: string, options?: ConstructorParameters<typeof SSEManager>[1]): SSEManager {
    if (!this.managers.has(url)) {
      this.managers.set(url, new SSEManager(url, options))
    }
    return this.managers.get(url)!
  }

  /**
   * 关闭指定URL的管理器
   */
  closeManager(url: string) {
    const manager = this.managers.get(url)
    if (manager) {
      manager.close()
      this.managers.delete(url)
    }
  }

  /**
   * 关闭所有管理器
   */
  closeAllManagers() {
    this.managers.forEach(manager => manager.close())
    this.managers.clear()
  }
}

export const sseManagerSingleton = new SSEManagerSingleton()
