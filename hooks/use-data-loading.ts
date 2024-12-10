import { useState, useEffect } from 'react';
import { DataLoadingState, DataOperationResult, DataLoadingOptions } from '@/lib/data/types';
import { DataManager } from '@/lib/data/data-manager';
import { CollectionName } from '@/lib/rxdb/schema';
import { toast } from './use-toast';

export function useDataLoading<T>(
  collection: CollectionName,
  query: any,
  options: DataLoadingOptions = {}
) {
  const [state, setState] = useState<DataLoadingState>({
    isLoading: true,
    error: null,
    dataSource: 'supabase'
  });
  const [data, setData] = useState<T[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        const dataManager = DataManager.getInstance();
        const result = await dataManager.loadData<T>(collection, query, options);

        if (!isMounted) return;

        setData(result.data);
        setState({
          isLoading: false,
          error: null,
          dataSource: result.source
        });

        if (result.source === 'rxdb') {
          toast({
            title: 'Offline Mode',
            description: 'Working with locally cached data',
          });
        }
      } catch (error) {
        if (!isMounted) return;

        setState({
          isLoading: false,
          error: error instanceof Error ? error : new Error('Failed to load data'),
          dataSource: 'rxdb'
        });

        toast({
          variant: "destructive",
          title: 'Error loading data',
          description: 'Please check your connection and try again',
        });
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [collection, JSON.stringify(query), JSON.stringify(options)]);

  return {
    data,
    ...state,
    reload: () => setState(prev => ({ ...prev, isLoading: true }))
  };
}