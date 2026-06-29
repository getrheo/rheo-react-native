import type {ReactNode} from 'react';

export const SafeAreaProvider = (props: { children?: ReactNode }) => props.children ?? null;
export const SafeAreaView = (props: { children?: ReactNode }) => props.children ?? null;
export const useSafeAreaInsets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
