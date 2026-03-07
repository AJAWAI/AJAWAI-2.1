import { Plus, Trash2, MessageSquare, X } from 'lucide-react';
import clsx from 'clsx';
import { useChatStore } from '../../store/chatStore';
import { useSettingsStore } from '../../store/settingsStore';
import { truncate, formatTimestamp } from '../../lib/utils';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const createConversation = useChatStore((s) => s.createConversation);
  const setActive = useChatStore((s) => s.setActiveConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  const handleNew = () => {
    createConversation();
    if (window.innerWidth < 768) toggleSidebar();
  };

  const handleSelect = (id: string) => {
    setActive(id);
    if (window.innerWidth < 768) toggleSidebar();
  };

  return (
    <>
      {sidebarOpen && <div className={styles.overlay} onClick={toggleSidebar} />}
      <aside className={clsx(styles.sidebar, sidebarOpen && styles.open)}>
        <div className={styles.top}>
          <span className={styles.logo}>AJAWAI 2.1</span>
          <button className={styles.closeBtn} onClick={toggleSidebar} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <button className={styles.newChat} onClick={handleNew}>
          <Plus size={16} />
          New Chat
        </button>

        <nav className={styles.list}>
          {conversations.map((c) => (
            <div
              key={c.id}
              className={clsx(styles.item, c.id === activeId && styles.active)}
              onClick={() => handleSelect(c.id)}
            >
              <MessageSquare size={14} className={styles.itemIcon} />
              <div className={styles.itemContent}>
                <span className={styles.itemTitle}>{truncate(c.title, 28)}</span>
                <span className={styles.itemTime}>{formatTimestamp(c.updatedAt)}</span>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(c.id);
                }}
                aria-label="Delete conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {conversations.length === 0 && (
            <p className={styles.empty}>No conversations yet</p>
          )}
        </nav>
      </aside>
    </>
  );
}
