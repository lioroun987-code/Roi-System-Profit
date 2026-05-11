'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DiscountRules } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const schema = z.object({
  qty2Percent: z.coerce.number().min(0).max(100),
  qty3Percent: z.coerce.number().min(0).max(100),
  section10Percent: z.boolean(),
  section15Percent: z.boolean(),
  coupon50Ils: z.boolean(),
  surpriseCapsuleCostUsd: z.coerce.number().min(0),
  giftCapsuleThresholdIls: z.coerce.number().min(0),
  giftCapsuleCostUsd: z.coerce.number().min(0),
})

type FormValues = z.infer<typeof schema>

interface DiscountRulesFormProps {
  defaultValues: DiscountRules
  onSave: (data: DiscountRules) => Promise<void>
}

export function DiscountRulesForm({ defaultValues, onSave }: DiscountRulesFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(data => onSave(data as DiscountRules))} className="space-y-6">
      <div>
        <h4 className="text-white text-sm font-medium mb-3">הנחת כמות (על דילים בלבד)</h4>
        <div className="grid gap-3">
          <div className="flex items-center gap-4">
            <Label className="w-64 shrink-0 text-right">הנחה על 2 יחידות זהות</Label>
            <div className="relative flex-1 max-w-xs">
              <Input type="number" min="0" max="100" {...register('qty2Percent')} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-64 shrink-0 text-right">הנחה על 3 יחידות זהות</Label>
            <div className="relative flex-1 max-w-xs">
              <Input type="number" min="0" max="100" {...register('qty3Percent')} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          * הנחת כמות חלה רק על דילים, לא על קפסולות או בקבוקים. הנחת מדור 10%/15% מחליפה אותה.
        </p>
      </div>

      <div className="border-t border-white/10 pt-4">
        <h4 className="text-white text-sm font-medium mb-3">הנחות מדור</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('section10Percent')} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-gray-300 text-sm">הנחת מדור 10% (מחליפה הנחת כמות, חלה על הכל)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('section15Percent')} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-gray-300 text-sm">הנחת מדור 15% (מחליפה הנחת כמות, חלה על הכל)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register('coupon50Ils')} className="w-4 h-4 rounded text-blue-600" />
            <span className="text-gray-300 text-sm">קופון 50 ₪ (מצטבר עם הנחת כמות)</span>
          </label>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <h4 className="text-white text-sm font-medium mb-3">קפסולות מתנה והפתעה</h4>
        <div className="grid gap-3">
          <div className="flex items-center gap-4">
            <Label className="w-64 shrink-0 text-right">עלות קפסולת הפתעה</Label>
            <div className="relative flex-1 max-w-xs">
              <Input type="number" step="0.01" min="0" {...register('surpriseCapsuleCostUsd')} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-64 shrink-0 text-right">סף מתנה (הזמנה מעל)</Label>
            <div className="relative flex-1 max-w-xs">
              <Input type="number" min="0" {...register('giftCapsuleThresholdIls')} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₪</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-64 shrink-0 text-right">עלות קפסולת מתנה</Label>
            <div className="relative flex-1 max-w-xs">
              <Input type="number" step="0.01" min="0" {...register('giftCapsuleCostUsd')} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            </div>
          </div>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <p className="text-red-400 text-sm">יש שגיאות בטופס, אנא בדוק את השדות</p>
      )}

      <div className="flex justify-start pt-2">
        <Button type="submit" loading={isSubmitting}>
          שמור כללי הנחה
        </Button>
      </div>
    </form>
  )
}
