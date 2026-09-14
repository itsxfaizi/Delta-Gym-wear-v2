"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { saveAddress } from "@/features/account/actions";
import { addressSchema, type AddressInput } from "@/features/account/schemas";

type AddressFormValues = z.input<typeof addressSchema>;

const EMPTY_ADDRESS: AddressFormValues = {
  id: "",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postalCode: "",
  country: "PK",
  isDefault: false,
};

/** Blank optional inputs are stored as NULL, never as an empty string. */
function normalize(values: AddressInput): AddressInput {
  return { ...values, line2: values.line2 || null, postalCode: values.postalCode || null };
}

export function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address?: AddressInput;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues, unknown, AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: address ?? EMPTY_ADDRESS,
  });

  async function onSubmit(values: AddressInput) {
    const result = await saveAddress(normalize(values));

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(address ? "Address updated." : "Address added.");
    onSaved();
  }

  return (
    <form className="account-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <input type="hidden" {...register("id")} />

      <div className="account-field">
        <label htmlFor="address-fullName">Full name</label>
        <input id="address-fullName" autoComplete="name" aria-invalid={errors.fullName ? "true" : "false"} {...register("fullName")} />
        {errors.fullName ? <span className="auth-field-error" role="alert">{errors.fullName.message}</span> : null}
      </div>

      <div className="account-field">
        <label htmlFor="address-phone">Phone</label>
        <input id="address-phone" inputMode="tel" autoComplete="tel" aria-invalid={errors.phone ? "true" : "false"} {...register("phone")} />
        {errors.phone ? <span className="auth-field-error" role="alert">{errors.phone.message}</span> : null}
      </div>

      <div className="account-field account-field--wide">
        <label htmlFor="address-line1">Address</label>
        <input id="address-line1" autoComplete="address-line1" aria-invalid={errors.line1 ? "true" : "false"} {...register("line1")} />
        {errors.line1 ? <span className="auth-field-error" role="alert">{errors.line1.message}</span> : null}
      </div>

      <div className="account-field account-field--wide">
        <label htmlFor="address-line2">Apartment, suite (optional)</label>
        <input id="address-line2" autoComplete="address-line2" {...register("line2")} />
      </div>

      <div className="account-field">
        <label htmlFor="address-city">City</label>
        <input id="address-city" autoComplete="address-level2" aria-invalid={errors.city ? "true" : "false"} {...register("city")} />
        {errors.city ? <span className="auth-field-error" role="alert">{errors.city.message}</span> : null}
      </div>

      <div className="account-field">
        <label htmlFor="address-province">Province</label>
        <input id="address-province" autoComplete="address-level1" aria-invalid={errors.province ? "true" : "false"} {...register("province")} />
        {errors.province ? <span className="auth-field-error" role="alert">{errors.province.message}</span> : null}
      </div>

      <div className="account-field">
        <label htmlFor="address-postalCode">Postal code (optional)</label>
        <input id="address-postalCode" autoComplete="postal-code" {...register("postalCode")} />
      </div>

      <div className="account-field">
        <label htmlFor="address-country">Country code</label>
        <input id="address-country" autoComplete="country" aria-invalid={errors.country ? "true" : "false"} {...register("country")} />
        {errors.country ? <span className="auth-field-error" role="alert">{errors.country.message}</span> : null}
      </div>

      <label className="account-checkbox">
        <input type="checkbox" {...register("isDefault")} />
        Use as my default address
      </label>

      <div className="account-form-actions">
        <button className="account-button account-button--primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save address"}
        </button>
        <button className="account-button" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
