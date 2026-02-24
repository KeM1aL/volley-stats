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
import { useTranslations } from "next-intl";

const supabase = createClient();

type NewChampionshipDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (championshipId: string) => void;
};

type TypeOption = {
  label: string;
  value: string;
};

export function NewChampionshipDialog({
  open,
  onClose,
  onSuccess,
}: NewChampionshipDialogProps) {
  const t = useTranslations('championships');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const championshipApi = useChampionshipApi();

  const TYPE_SUGGESTIONS: TypeOption[] = [
    { label: t('types.regional'), value: "Regional" },
    { label: t('types.national'), value: "National" },
    { label: t('types.international'), value: "International" },
    { label: t('types.club'), value: "Club" },
  ];

  const formSchema = z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    type: z.string().min(1, t('validation.typeRequired')),
    gender: z.enum(["female", "male", "mixte"], {
      required_error: t('validation.genderRequired'),
    }),
    age_category: z.enum(["U10", "U12", "U14", "U16", "U18", "U21", "senior"], {
      required_error: t('validation.ageCategoryRequired'),
    }),
    default_match_format: z.string().min(1, t('validation.formatRequired')),
    season_id: z.string().nullable(),
  });

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
      if (!session) throw new Error(tc('errors.notAuthenticated'));

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
        title: t('toast.created'),
        description: t('toast.createdDesc', { name: values.name }),
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
        title: t('toast.error'),
        description: t('toast.createError'),
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
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>
            {t('create.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.name')} *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('form.namePlaceholder')}
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
                  <FormLabel>{t('form.type')} *</FormLabel>
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
                      placeholder={t('form.typePlaceholder')}
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
                  <FormLabel>{t('form.gender')} *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.selectGender')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="female">{t('gender.female')}</SelectItem>
                      <SelectItem value="male">{t('gender.male')}</SelectItem>
                      <SelectItem value="mixte">{t('gender.mixte')}</SelectItem>
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
                  <FormLabel>{t('form.ageCategory')} *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.selectAgeCategory')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="U10">{te("championshipAgeCategory.U10")}</SelectItem>
                      <SelectItem value="U12">{te("championshipAgeCategory.U12")}</SelectItem>
                      <SelectItem value="U14">{te("championshipAgeCategory.U14")}</SelectItem>
                      <SelectItem value="U16">{te("championshipAgeCategory.U16")}</SelectItem>
                      <SelectItem value="U18">{te("championshipAgeCategory.U18")}</SelectItem>
                      <SelectItem value="U21">{te("championshipAgeCategory.U21")}</SelectItem>
                      <SelectItem value="senior">{te("championshipAgeCategory.senior")}</SelectItem>
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
                  <FormLabel>{t('form.format')} *</FormLabel>
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
                  <FormLabel>{t('form.season')}</FormLabel>
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
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    {t('create.creating')}
                  </>
                ) : (
                  t('form.createChampionship')
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
