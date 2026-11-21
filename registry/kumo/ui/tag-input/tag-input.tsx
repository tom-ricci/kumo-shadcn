"use client";

// Kumo, packages/kumo/src/components/tag-input/tag-input.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths, and the "use client" line Kumo's build adds.
// Unofficial; not affiliated with or endorsed by Cloudflare.
//
// MIT License Copyright (c) 2026 Cloudflare, Inc.
//
// Permission is hereby granted, free of
// charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice
// (including the next paragraph) shall be included in all copies or substantial
// portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
// ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
// EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { XIcon } from "@/lib/kumo/icons";
import { Field as FieldBase } from "@base-ui/react/field";
import {
  forwardRef,
  useId,
  useState,
  type ClipboardEvent,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button/button";
import {
  Field,
  normalizeFieldError,
  type FieldErrorMatch,
} from "@/components/ui/field/field";
import { cn } from "@/lib/kumo/cn";
import { inputVariants, type KumoInputVariant } from "@/components/ui/input/input";

export const KUMO_TAG_INPUT_VARIANTS = {
  variant: {
    default: { classes: "", description: "Default tag input appearance." },
    error: { classes: "", description: "Error state for validation failures." },
  },
} as const;

export const KUMO_TAG_INPUT_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export const KUMO_TAG_INPUT_STYLING = {
  baseClasses: "flex flex-wrap items-center",
} as const;

/** Labels for TagInput feedback and controls. Override these for localization. */
export interface TagInputLabels {
  /** Accessible name used when neither `label` nor `aria-label` is provided. */
  input?: string;
  /** Accessible name for a tag's remove button. */
  removeValue?: (value: string) => string;
  /** Validation feedback shown when `validateValue` rejects a value. */
  invalidValue?: (value: string) => string;
  /** Feedback shown when adding a tag would exceed `maxValues`. */
  maxValuesReached?: (maxValues: number) => string;
}

const DEFAULT_LABELS: Required<TagInputLabels> = {
  input: "Add tag",
  removeValue: (value) => `Remove ${value}`,
  invalidValue: (value) => `"${value}" is not valid.`,
  maxValuesReached: (maxValues) => `Limit of ${maxValues} tags reached.`,
};

type NativeInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "defaultValue" | "disabled" | "size" | "value"
>;

export interface TagInputProps extends NativeInputProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  validateValue?: (value: string, acceptedValues: string[]) => boolean;
  maxValues?: number;
  /** Translated labels for generated input, action, and validation text. */
  labels?: TagInputLabels;
  label?: ReactNode;
  labelTooltip?: ReactNode;
  description?: ReactNode;
  error?: string | { message: ReactNode; match: FieldErrorMatch };
  variant?: KumoInputVariant;
  disabled?: boolean;
  /** Submits each accepted tag as a separate form value under this name. */
  name?: string;
  /**
   * Requires at least one accepted tag for native form validation. Like a
   * native input, a `readOnly` TagInput is skipped by validation.
   */
  required?: boolean;
  /** Prevents adding or removing tags while keeping the input focusable. */
  readOnly?: boolean;
}

function splitValues(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const TagInput = forwardRef<HTMLInputElement, TagInputProps>(
  (
    {
      value,
      defaultValue = [],
      onValueChange,
      validateValue,
      maxValues,
      labels,
      label,
      labelTooltip,
      description,
      error,
      variant,
      disabled,
      readOnly,
      name,
      form,
      required,
      className,
      placeholder,
      id,
      autoComplete = "off",
      onBlur,
      onChange,
      onKeyDown: onKeyDownProp,
      onPaste: onPasteProp,
      ...inputProps
    },
    forwardedRef,
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const [inputValue, setInputValue] = useState("");
    const [message, setMessage] = useState<string>();
    const inputId = useId();
    const values = value ?? uncontrolledValue;

    const setValues = (nextValue: string[]) => {
      if (value === undefined) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    };

    const commit = (rawValue: string) => {
      const entries = splitValues(rawValue);
      const nextValues = [...values];
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (nextValues.includes(entry)) continue;
        if (maxValues !== undefined && nextValues.length >= maxValues) {
          setInputValue(entries.slice(index).join(", "));
          setMessage(
            (labels?.maxValuesReached ?? DEFAULT_LABELS.maxValuesReached)(
              maxValues,
            ),
          );
          setValues(nextValues);
          return false;
        }
        if (validateValue && !validateValue(entry, nextValues)) {
          setInputValue(entries.slice(index).join(", "));
          setMessage(
            (labels?.invalidValue ?? DEFAULT_LABELS.invalidValue)(entry),
          );
          setValues(nextValues);
          return false;
        }
        nextValues.push(entry);
      }
      setValues(nextValues);
      setInputValue("");
      setMessage(undefined);
      return true;
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      onKeyDownProp?.(event);
      if (event.defaultPrevented || readOnly) return;
      // Enter/Tab/comma while an IME is composing confirm the conversion, not the tag.
      // keyCode 229 covers Safari, which fires compositionend before keydown.
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (!inputValue && event.key === "Backspace") {
        setValues(values.slice(0, -1));
        return;
      }
      if (!inputValue || !["Enter", ",", "Tab"].includes(event.key)) return;
      const didCommit = commit(inputValue);
      if (event.key !== "Tab" || didCommit) event.preventDefault();
    };

    const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
      onPasteProp?.(event);
      if (event.defaultPrevented || readOnly) return;
      const text = event.clipboardData.getData("text");
      if (!/[\n,]/.test(text)) return;
      event.preventDefault();
      const { selectionStart, selectionEnd } = event.currentTarget;
      const start = selectionStart ?? inputValue.length;
      const end = selectionEnd ?? start;
      commit(inputValue.slice(0, start) + text + inputValue.slice(end));
    };

    const fieldError =
      normalizeFieldError(error) ?? normalizeFieldError(message);
    const inputVariant = variant ?? (fieldError ? "error" : "default");
    const chipClassName = cn(
      "flex w-fit max-w-full shrink-0 items-center gap-2.5 rounded-sm bg-kumo-overlay ring-1 ring-kumo-hairline",
      "h-6 py-0 pr-[3px] pl-2 text-sm",
    );
    const input = (controlProps?: ComponentPropsWithoutRef<"input">) => (
      <input
        {...controlProps}
        {...inputProps}
        ref={forwardedRef}
        aria-invalid={Boolean(fieldError)}
        aria-label={
          inputProps["aria-label"] ??
          (typeof label === "string"
            ? label
            : (labels?.input ?? DEFAULT_LABELS.input))
        }
        className={cn(
          "min-w-32 flex-1 border-0 bg-transparent outline-none",
          "px-1 py-0.5",
        )}
        disabled={disabled}
        readOnly={readOnly}
        form={form}
        required={required && values.length === 0}
        autoComplete={autoComplete}
        id={controlProps?.id ?? id ?? inputId}
        placeholder={placeholder}
        value={inputValue}
        onBlur={(event) => {
          onBlur?.(event);
          if (!event.defaultPrevented && !readOnly) commit(inputValue);
        }}
        onChange={(event) => {
          setInputValue(event.target.value);
          setMessage(undefined);
          onChange?.(event);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
    );
    const hasField = Boolean(label || description || fieldError);
    const control = (
      <div
        className={cn(
          inputVariants({
            variant: inputVariant,
            parentFocusIndicator: true,
          }),
          "flex h-auto min-h-9 flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-1.5",
          className,
        )}
      >
        {values.map((item) => (
          <span key={item} className={cn(chipClassName, "text-kumo-default")}>
            <span className="truncate">{item}</span>
            <Button
              aria-label={(labels?.removeValue ?? DEFAULT_LABELS.removeValue)(
                item,
              )}
              icon={<XIcon size={10} />}
              shape="square"
              size="xs"
              variant="ghost"
              disabled={disabled || readOnly}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                setValues(values.filter((value) => value !== item))
              }
            />
            {name ? (
              <input
                type="hidden"
                name={name}
                form={form}
                disabled={disabled}
                value={item}
              />
            ) : null}
          </span>
        ))}
        {hasField ? (
          <FieldBase.Control render={(controlProps) => input(controlProps)} />
        ) : (
          input()
        )}
      </div>
    );
    if (hasField) {
      return (
        <Field
          label={label}
          labelTooltip={labelTooltip}
          description={description}
          error={fieldError}
        >
          {control}
        </Field>
      );
    }

    return control;
  },
);
TagInput.displayName = "TagInput";
