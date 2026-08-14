import { useCallback, useEffect, useState } from 'react';

interface StorageSource {
  key: string;
  eventName: string;
}

export function useGuardStorageSubscription<T>(
  load: () => T,
  sources: StorageSource[]
) {
  const [value, setValue] = useState<T>(() => load());
  const [isLoaded, setIsLoaded] = useState(false);

  const reload = useCallback(() => {
    setValue(load());
  }, [load]);

  useEffect(() => {
    reload();
    setIsLoaded(true);

    const handleStorage = (event: StorageEvent) => {
      if (sources.some((source) => source.key === event.key)) reload();
    };
    sources.forEach((source) =>
      window.addEventListener(source.eventName, reload)
    );
    window.addEventListener('storage', handleStorage);

    return () => {
      sources.forEach((source) =>
        window.removeEventListener(source.eventName, reload)
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, [reload, sources]);

  return { value, isLoaded, reload };
}
