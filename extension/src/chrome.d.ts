// Declarações mínimas da API Chrome/Edge Manifest V3 para validação TypeScript isolada

declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      origin?: string;
    }

    const lastError: { message?: string } | undefined;

    function getManifest(): { version: string; name: string };
    function sendMessage<T = any, R = any>(
      message: T,
      responseCallback?: (response: R) => void
    ): void;
    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      status?: string;
      active?: boolean;
      windowId?: number;
    }

    function query(queryInfo: { url?: string | string[] }): Promise<Tab[]>;
    function get(tabId: number): Promise<Tab>;
    function create(createProperties: { url?: string; active?: boolean }): Promise<Tab>;
    function update(
      tabId: number,
      updateProperties: { url?: string; active?: boolean }
    ): Promise<Tab>;
    function sendMessage<T = any, R = any>(tabId: number, message: T): Promise<R>;

    const onUpdated: {
      addListener(
        callback: (tabId: number, changeInfo: { status?: string; url?: string }, tab: Tab) => void
      ): void;
      removeListener(
        callback: (tabId: number, changeInfo: { status?: string; url?: string }, tab: Tab) => void
      ): void;
    };

    const onRemoved: {
      addListener(callback: (tabId: number) => void): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | null): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
    }
    const local: StorageArea;
    const session: StorageArea | undefined;
  }
}
