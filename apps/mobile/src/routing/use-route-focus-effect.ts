import { useContext, useEffect, type EffectCallback } from 'react';
import { NavigationContext } from 'expo-router/react-navigation';

/** Focus ownership for route consumers that also support standalone SDK renders. */
export function useRouteFocusEffect(effect: EffectCallback): void {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (!navigation) return effect();
    let cleanup: ReturnType<EffectCallback>;
    let focused = false;
    const onFocus = () => {
      if (focused) return;
      focused = true;
      cleanup = effect();
    };
    const onBlur = () => {
      cleanup?.();
      cleanup = undefined;
      focused = false;
    };
    if (navigation.isFocused()) onFocus();
    const removeFocus = navigation.addListener('focus', onFocus);
    const removeBlur = navigation.addListener('blur', onBlur);
    return () => {
      onBlur();
      removeFocus();
      removeBlur();
    };
  }, [navigation, effect]);
}
