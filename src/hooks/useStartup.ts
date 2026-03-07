import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import { useModelStore } from '../store/modelStore';

export function useStartup() {
  const started = useRef(false);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const detectCapabilities = useModelStore((s) => s.detectCapabilities);
  const initSubscription = useModelStore((s) => s.initSubscription);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    loadConversations();
    detectCapabilities();
    const unsub = initSubscription();

    return unsub;
  }, [loadConversations, detectCapabilities, initSubscription]);
}
