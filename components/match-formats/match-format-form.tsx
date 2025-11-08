"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMatchFormatApi } from "@/hooks/use-match-format-api";
import { LoadingSpinner } from "../ui/loading-spinner";
import { MatchFormat } from "@/lib/types";

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  format: z.enum(["2x2", "3x3", "4x4", "6x6"], {
    required_error: "Please select a volleyball format",
  }),
  sets_to_win: z.coerce
    .number()
    .min(1, "Sets to win must be at least 1")
    .max(5, "Sets to win cannot exceed 5"),
  rotation: z.boolean().default(false),
  point_by_set: z.coerce
    .number()
    .min(1, "Points per set must be at least 1")
    .max(50, "Points per set cannot exceed 50"),
  point_final_set: z.coerce
    .number()
    .min(1, "Points in final set must be at least 1")
    .max(50, "Points in final set cannot exceed 50"),
  decisive_point: z.boolean().default(false),
});

type MatchFormatFormProps = {
  onSuccess?: (matchFormat: MatchFormat) => void;
  onCancel?: () => void;
};

export function MatchFormatForm({ onSuccess, onCancel }: MatchFormatFormProps) {
  const { toast } = useToast();
  const matchFormatApi = useMatchFormatApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      format: "6x6",
      sets_to_win: 3,
      rotation: true,
      point_by_set: 25,
      point_final_set: 15,
      decisive_point: true,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const matchFormat = await matchFormatApi.createMatchFormat({
        ...values,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      toast({
        title: "Match format created",
        description: "Your new match format has been created successfully.",
      });

      if (onSuccess) {
        onSuccess(matchFormat);
      }
    } catch (error) {
      console.error("Failed to create match format:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create match format. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Standard 6x6 - Best of 5"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Volleyball Format</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="2x2">2x2</SelectItem>
                  <SelectItem value="3x3">3x3</SelectItem>
                  <SelectItem value="4x4">4x4</SelectItem>
                  <SelectItem value="6x6">6x6</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sets_to_win"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sets to Win</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="point_by_set"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Points per Set</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="point_final_set"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Points in Final Set</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rotation"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Enable Rotation</FormLabel>
                <FormDescription>
                  Players rotate positions after winning serve
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="decisive_point"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Decisive Point</FormLabel>
                <FormDescription>
                  Win by 2 points or play to decisive point
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <div className="flex gap-3 justify-end">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating...
              </>
            ) : (
              "Create Match Format"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
