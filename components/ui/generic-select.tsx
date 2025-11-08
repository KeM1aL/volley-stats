'use client';

import * as React from "react";
import Select from 'react-select';

type GenericSelectProps = {
  options: { label: string; value: string }[];
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  isClearable?: boolean;
};

export function GenericSelect({
  options,
  placeholder,
  value,
  onValueChange,
  label,
  isClearable = false
}: GenericSelectProps) {
  const selectedOption = options.find(option => option.value === value) || null;

  const handleChange = (newValue: { label: string; value: string } | null) => {
    onValueChange(newValue?.value || '');
  };

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm font-medium mb-2 block">
          {label}
        </label>
      )}
      <Select
        value={selectedOption}
        onChange={handleChange}
        options={options}
        placeholder={placeholder}
        isClearable={isClearable}
        classNamePrefix="react-select"
        className="react-select-container"
        classNames={{
          control: () =>
            "!min-h-10 !border-input !bg-background hover:!bg-accent",
          menu: () =>
            "!bg-popover !border !border-border !rounded-md !shadow-md",
          option: (state) =>
            state.isFocused
              ? "!bg-accent !text-accent-foreground"
              : "!bg-popover !text-popover-foreground",
          singleValue: () =>
            "!text-foreground",
          placeholder: () =>
            "!text-muted-foreground",
          input: () =>
            "!text-foreground",
          menuList: () =>
            "!p-1",
        }}
        styles={{
          control: (base) => ({
            ...base,
            borderRadius: 'var(--radius)',
          }),
          menu: (base) => ({
            ...base,
            borderRadius: 'var(--radius)',
          }),
        }}
      />
    </div>
  );
}
