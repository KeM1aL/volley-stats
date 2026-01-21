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
import { useClubApi } from "@/hooks/use-club-api";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Club } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const formSchema = z.object({
  name: z.string().min(1, "Club name is required"),
});

type QuickCreateClubDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (clubId: string) => void;
  defaultName?: string;
};

export function QuickCreateClubDialog({
  open,
  onClose,
  onSuccess,
  defaultName,
}: QuickCreateClubDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const clubApi = useClubApi();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultName || "",
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

      const newClub: Partial<Club> = {
        id: crypto.randomUUID(),
        name: values.name,
        user_id: session.user.id,
        website: null,
        contact_email: null,
        contact_phone: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createdClub = await clubApi.createClub(newClub);

      toast({
        title: "Club created",
        description: `${values.name} has been created. You can add more details later.`,
      });

      form.reset();
      onSuccess(createdClub.id);
      onClose();
    } catch (error) {
      console.error("Error creating club:", error);
      toast({
        title: "Error",
        description: "Failed to create club. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Create Club</DialogTitle>
          <DialogDescription>
            Create a new club with just a name. You can add more details later.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter club name"
                      {...field}
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
                  "Create Club"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
