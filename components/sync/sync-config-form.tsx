"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CollectionName } from '@/lib/rxdb/schema';
import { SyncConfig, SyncFilter } from '@/lib/rxdb/sync/types';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Minus } from 'lucide-react';

const filterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']),
  value: z.string().min(1),
});

const formSchema = z.object({
  enabled: z.boolean(),
  batchSize: z.number().min(1).max(1000).optional(),
  syncInterval: z.number().min(1000).optional(),
  retryAttempts: z.number().min(1).max(10).optional(),
  filters: z.array(filterSchema).optional(),
});

interface SyncConfigFormProps {
  collection: CollectionName;
  initialConfig?: SyncConfig;
  onSubmit: (collection: CollectionName, config: SyncConfig) => void;
}

export function SyncConfigForm({ collection, initialConfig, onSubmit }: SyncConfigFormProps) {
  const [filters, setFilters] = useState<SyncFilter[]>(initialConfig?.filters || []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: initialConfig?.enabled ?? true,
      batchSize: initialConfig?.batchSize ?? 100,
      syncInterval: initialConfig?.syncInterval ?? 30000,
      retryAttempts: initialConfig?.retryAttempts ?? 3,
      filters: initialConfig?.filters || [],
    },
  });

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'eq', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(collection, {
      ...values,
      filters,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Enable Sync</FormLabel>
                <FormDescription>
                  Enable or disable synchronization for this collection
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="batchSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Batch Size</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={e => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                Number of records to sync in each batch
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="syncInterval"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sync Interval (ms)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={e => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                Time between sync operations in milliseconds
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="retryAttempts"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Retry Attempts</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={e => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                Number of retry attempts for failed operations
              </FormDescription>
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FormLabel>Sync Filters</FormLabel>
            <Button type="button" variant="outline" size="sm" onClick={addFilter}>
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </div>

          {filters.map((filter, index) => (
            <div key={index} className="flex items-center gap-4">
              <Input
                placeholder="Field"
                value={filter.field}
                onChange={e => {
                  const newFilters = [...filters];
                  newFilters[index].field = e.target.value;
                  setFilters(newFilters);
                }}
              />
              <Select
                value={filter.operator}
                onValueChange={value => {
                  const newFilters = [...filters];
                  newFilters[index].operator = value as SyncFilter['operator'];
                  setFilters(newFilters);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eq">Equals</SelectItem>
                  <SelectItem value="gt">Greater Than</SelectItem>
                  <SelectItem value="lt">Less Than</SelectItem>
                  <SelectItem value="gte">Greater Than or Equal</SelectItem>
                  <SelectItem value="lte">Less Than or Equal</SelectItem>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Value"
                value={filter.value}
                onChange={e => {
                  const newFilters = [...filters];
                  newFilters[index].value = e.target.value;
                  setFilters(newFilters);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFilter(index)}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="submit">Save Configuration</Button>
      </form>
    </Form>
  );
}