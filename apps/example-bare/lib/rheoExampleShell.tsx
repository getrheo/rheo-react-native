import AsyncStorage from '@react-native-async-storage/async-storage';
import { RheoProvider, type RheoConfig } from '@getrheo/react-native-bare';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  buildExampleRheoConfig,
  canStartExampleConfig,
  EXAMPLE_CONFIG_STORAGE_KEY,
  type SavedConfig,
} from './exampleRheoConfig';

type ExampleRheoShellState = {
  config: RheoConfig;
  channelId: string;
};

type ExampleRheoContextValue = {
  reloadFromStorage: () => Promise<void>;
  syncFromSavedConfig: (saved: SavedConfig) => void;
  clearShell: () => void;
};

const ExampleRheoContext = createContext<ExampleRheoContextValue | null>(null);

const shellFromSavedConfig = (saved: SavedConfig): ExampleRheoShellState | null => {
  if (!canStartExampleConfig(saved)) return null;
  return {
    config: buildExampleRheoConfig(saved),
    channelId: saved.channelId.trim(),
  };
};

/** Single app-root `RheoProvider` for the example app (no automatic prefetch). */
export const RheoExampleShell = ({ children }: { children: ReactNode }) => {
  const [shell, setShell] = useState<ExampleRheoShellState | null>(null);

  const syncFromSavedConfig = useCallback((saved: SavedConfig) => {
    setShell(shellFromSavedConfig(saved));
  }, []);

  const reloadFromStorage = useCallback(async () => {
    const raw = await AsyncStorage.getItem(EXAMPLE_CONFIG_STORAGE_KEY);
    if (!raw) {
      setShell(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as SavedConfig;
      syncFromSavedConfig(parsed);
    } catch {
      setShell(null);
    }
  }, [syncFromSavedConfig]);

  const clearShell = useCallback(() => {
    setShell(null);
  }, []);

  useEffect(() => {
    void reloadFromStorage();
  }, [reloadFromStorage]);

  const contextValue = useMemo<ExampleRheoContextValue>(
    () => ({
      reloadFromStorage,
      syncFromSavedConfig,
      clearShell,
    }),
    [reloadFromStorage, syncFromSavedConfig, clearShell],
  );

  return (
    <ExampleRheoContext.Provider value={contextValue}>
      {shell ? (
        <RheoProvider config={shell.config}>{children}</RheoProvider>
      ) : (
        children
      )}
    </ExampleRheoContext.Provider>
  );
};

export const useExampleRheoShell = (): ExampleRheoContextValue => {
  const ctx = useContext(ExampleRheoContext);
  if (!ctx) {
    throw new Error('useExampleRheoShell must be used within RheoExampleShell');
  }
  return ctx;
};
