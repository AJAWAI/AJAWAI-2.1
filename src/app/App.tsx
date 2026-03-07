import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ChatLayout } from '../components/ChatLayout';
import { SettingsPanel } from '../components/SettingsPanel';
import { useStartup } from '../hooks/useStartup';
import styles from './App.module.css';

export function App() {
  useStartup();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Header />
        <ChatLayout />
      </div>
      <SettingsPanel />
    </div>
  );
}
