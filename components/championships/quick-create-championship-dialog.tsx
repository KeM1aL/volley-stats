"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useChampionshipApi } from "@/hooks/use-championship-api";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Championship, MatchFormat } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { MatchFormatSelect } from "../match-formats/match-format-select";

const supabase = createClient();

const formSchema = z.object({
  name: z.string().min(1, "Championship name is required"),
  default_match_format: z.string().min(1, "Match format is required"),
});

type QuickCreateChampionshipDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (championshipId: string) => void;
  defaultName?: string;
};

export function QuickCreateChampionshipDialog({
  open,
  onClose,
  onSuccess,
  defaultName,
}: QuickCreateChampionshipDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMatchFormat, setSelectedMatchFormat] = useState<MatchFormat | null>(null);
  const championshipApi = useChampionshipApi();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultName || "",
      default_match_format: "",
    },
  });

  useEffect(() => {
    if (open && defaultName) {
      form.setValue("name", defaultName);
    }
  }, [open, defaultName, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const newChampionship: Omit<Championship, "match_formats"> = {
        id: crypto.randomUUID(),
        name: values.name,
        type: "Other",
        gender: "mixte",
        age_category: "senior",
        default_match_format: values.default_match_format,
        user_id: session.user.id,
        season_id: null,
        ext_code: null,
        ext_source: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createdChampionship = await championshipApi.createChampionship(newChampionship);

      toast({
        title: "Championship created",
        description: `${values.name} has been created. You can add more details later.`,
      });

      form.reset();
      setSelectedMatchFormat(null);
      onSuccess(createdChampionship.id);
      onClose();
    } catch (error) {
      console.error("Error creating championship:", error);
      toast({
        title: "Error",
        description: "Failed to create championship. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedMatchFormat(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Create Championship</DialogTitle>
          <DialogDescription>
            Create a new championship with minimal details. Defaults: type &quot;Other&quot;, gender &quot;Mixte&quot;, age category &quot;Senior&quot;.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Championship Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter championship name"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="default_match_format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Format</FormLabel>
                  <FormControl>
                    <MatchFormatSelect
                      value={selectedMatchFormat}
                      onChange={(format) => {
                        setSelectedMatchFormat(format);
                        field.onChange(format?.id || "");
                      }}
                      isClearable={false}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Championship"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
