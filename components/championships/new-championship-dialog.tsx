"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useChampionshipApi } from "@/hooks/use-championship-api";
import { LoadingSpinner } from "../ui/loading-spinner";
import { Championship, MatchFormat, Season } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { MatchFormatSelect } from "../match-formats/match-format-select";
import { SeasonSelect } from "../seasons/season-select";
import CreatableSelect from "react-select/creatable";

const supabase = createClient();

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  gender: z.enum(["female", "male", "mixte"], {
    required_error: "Gender is required",
  }),
  age_category: z.enum(["U10", "U12", "U14", "U16", "U18", "U21", "senior"], {
    required_error: "Age category is required",
  }),
  default_match_format: z.string().min(1, "Match format is required"),
  season_id: z.string().nullable(),
});

type NewChampionshipDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (championshipId: string) => void;
};

type TypeOption = {
  label: string;
  value: string;
};

const TYPE_SUGGESTIONS: TypeOption[] = [
  { label: "Regional", value: "Regional" },
  { label: "National", value: "National" },
  { label: "International", value: "International" },
  { label: "Club", value: "Club" },
];

export function NewChampionshipDialog({
  open,
  onClose,
  onSuccess,
}: NewChampionshipDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const championshipApi = useChampionshipApi();

  const [selectedMatchFormat, setSelectedMatchFormat] =
    useState<MatchFormat | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [selectedType, setSelectedType] = useState<TypeOption | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      gender: undefined,
      age_category: undefined,
      default_match_format: "",
      season_id: null,
    },
  });

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
        type: values.type,
        gender: values.gender,
        age_category: values.age_category,
        default_match_format: values.default_match_format,
        season_id: values.season_id,
        ext_code: null,
        ext_source: null,
        user_id: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createdChampionship =
        await championshipApi.createChampionship(newChampionship);

      toast({
        title: "Championship created",
        description: `${values.name} has been created successfully.`,
      });

      form.reset();
      setSelectedMatchFormat(null);
      setSelectedSeason(null);
      setSelectedType(null);
      onSuccess?.(createdChampionship.id);
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
    setSelectedSeason(null);
    setSelectedType(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Championship</DialogTitle>
          <DialogDescription>
            Add a new championship with all required details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <FormControl>
                    <CreatableSelect<TypeOption>
                      options={TYPE_SUGGESTIONS}
                      value={selectedType}
                      onChange={(option) => {
                        setSelectedType(option);
                        field.onChange(option?.value || "");
                      }}
                      onCreateOption={(inputValue) => {
                        const newOption = {
                          label: inputValue,
                          value: inputValue,
                        };
                        setSelectedType(newOption);
                        field.onChange(inputValue);
                      }}
                      placeholder="Select or create a type..."
                      isDisabled={isLoading}
                      isClearable
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="mixte">Mixte</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="age_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age Category *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select age category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="U10">U10</SelectItem>
                      <SelectItem value="U12">U12</SelectItem>
                      <SelectItem value="U14">U14</SelectItem>
                      <SelectItem value="U16">U16</SelectItem>
                      <SelectItem value="U18">U18</SelectItem>
                      <SelectItem value="U21">U21</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="default_match_format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Format *</FormLabel>
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

            <FormField
              control={form.control}
              name="season_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season (Optional)</FormLabel>
                  <FormControl>
                    <SeasonSelect
                      value={selectedSeason}
                      onChange={(season) => {
                        setSelectedSeason(season);
                        field.onChange(season?.id || null);
                      }}
                      isClearable={true}
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
