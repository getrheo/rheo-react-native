import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Upstream RN entry bundles Flow-era syntax Vitest/esbuild rejects; stubs keep unit tests runnable.
      'react-native': path.resolve(dirname, 'src/test-stubs/react-native.ts'),
      '@react-native-async-storage/async-storage': path.resolve(
        dirname,
        'src/test-stubs/async-storage.ts',
      ),
      // Real package pulls native codegen that Vitest/Vite cannot parse; tests use this stub instead.
      'react-native-permissions': path.resolve(
        dirname,
        'src/test-stubs/react-native-permissions.ts',
      ),
      'react-native-gesture-handler': path.resolve(
        dirname,
        'src/test-stubs/react-native-gesture-handler.ts',
      ),
      'react-native-reanimated': path.resolve(
        dirname,
        'src/test-stubs/react-native-reanimated.ts',
      ),
      'react-native-safe-area-context': path.resolve(
        dirname,
        'src/test-stubs/react-native-safe-area-context.ts',
      ),
      'react-native-svg': path.resolve(dirname, 'src/test-stubs/react-native-svg.ts'),
      'react-native-linear-gradient': path.resolve(
        dirname,
        'src/test-stubs/react-native-linear-gradient.ts',
      ),
      'lottie-react-native': path.resolve(dirname, 'src/test-stubs/lottie-react-native.ts'),
      'expo-video': path.resolve(dirname, 'src/test-stubs/expo-video.ts'),
      'react-native-vector-icons/Ionicons': path.resolve(
        dirname,
        'src/test-stubs/react-native-vector-icons-ionicons.ts',
      ),
      'react-native-worklets': path.resolve(dirname, 'src/test-stubs/react-native-worklets.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
});
