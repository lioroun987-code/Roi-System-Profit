'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ProductCosts } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const schema = z.object({
  dealCost: z.coerce.number().min(0),
  coolDealCost: z.coerce.number().min(0),
  bottleCost: z.coerce.number().min(0),
  singleCapsuleCost: z.coerce.number().min(0),
  pack3Price: z.coerce.number().min(0),
  pack7Price: z.coerce.number().min(0),
  secondUnitDiscount: z.coerce.number().min(0),
  homeDeliveryCostUsd: z.coerce.number().min(0),
  homeDeliveryChargeIls: z.coerce.number().min(0),
  pickupFeeThresholdIls: z.coerce.number().min(0),
  pickupFeeAmountIls: z.coerce.number().min(0),
  exchangeRate: z.coerce.number().min(1),
})

type FormValues = z.infer<typeof schema>

interface ProductCostsFormProps {
  defaultValues: ProductCosts
  onSave: (data: ProductCosts) => Promise<void>
}

function FieldRow({
  label,
  name,
  currency,
  register,
  error,
}: {
  label: string
  name: keyof FormValues
  currency: string
  register: ReturnType<typeof useForm<FormValues>>['register']
  error?: string
}) {
  return (
    <div className="flex items-center gap-4">
      <Label className="w-64 shrink-0 text-right">{label}</Label>
      <div className="relative flex-1 max-w-xs">
        <Input
          type="number"
          step="0.01"
          min="0"
          {...register(name)}
          className={error ? 'border-red-500' : ''}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency}</span>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export function ProductCostsForm({ defaultValues, onSave }: ProductCostsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(data => onSave(data as ProductCosts))} className="space-y-4">
      <div className="grid gap-3">
        <FieldRow label='דיל (בקבוק + 7 קפסולות) - עלות' name="dealCost" currency="$" register={register} error={errors.dealCost?.message} />
        <FieldRow label='Cool Deal (שומר קור) - עלות' name="coolDealCost" currency="$" register={register} error={errors.coolDealCost?.message} />
        <FieldRow label='בקבוק בלבד - עלות' name="bottleCost" currency="$" register={register} error={errors.bottleCost?.message} />
        <FieldRow label='קפסולה בודדת - עלות' name="singleCapsuleCost" currency="$" register={register} error={errors.singleCapsuleCost?.message} />
        <div className="border-t border-white/10 my-2" />
        <FieldRow label='מחיר חבילת 3 קפסולות בחנות' name="pack3Price" currency="₪" register={register} error={errors.pack3Price?.message} />
        <FieldRow label='מחיר חבילת 7 קפסולות בחנות' name="pack7Price" currency="₪" register={register} error={errors.pack7Price?.message} />
        <div className="border-t border-white/10 my-2" />
        <FieldRow label='הנחה על יחידה שניה ומעלה' name="secondUnitDiscount" currency="$" register={register} error={errors.secondUnitDiscount?.message} />
        <div className="border-t border-white/10 my-2" />
        <FieldRow label='עלות משלוח לבית (לעסק)' name="homeDeliveryCostUsd" currency="$" register={register} error={errors.homeDeliveryCostUsd?.message} />
        <FieldRow label='חיוב משלוח לבית (מלקוח)' name="homeDeliveryChargeIls" currency="₪" register={register} error={errors.homeDeliveryChargeIls?.message} />
        <div className="border-t border-white/10 my-2" />
        <FieldRow label='סף לחיוב עמלת נקודת איסוף' name="pickupFeeThresholdIls" currency="₪" register={register} error={errors.pickupFeeThresholdIls?.message} />
        <FieldRow label='גובה עמלת נקודת איסוף' name="pickupFeeAmountIls" currency="₪" register={register} error={errors.pickupFeeAmountIls?.message} />
        <div className="border-t border-white/10 my-2" />
        <FieldRow label='שער חליפין (₪ לדולר)' name="exchangeRate" currency="₪/$" register={register} error={errors.exchangeRate?.message} />
      </div>

      <div className="flex justify-start pt-2">
        <Button type="submit" loading={isSubmitting}>
          שמור עלויות מוצרים
        </Button>
      </div>
    </form>
  )
}
