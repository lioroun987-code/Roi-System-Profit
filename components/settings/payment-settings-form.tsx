'use client'

import { useState } from 'react'
import { PaymentSettings } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const DEFAULT_PAYMENT_METHODS = [
  { name: 'Bit', feePercent: 3, enabled: true },
  { name: 'כרטיס אשראי רגיל', feePercent: 1, enabled: true },
  { name: 'PayPal', feePercent: 4.5, enabled: false },
  { name: 'מזומן', feePercent: 0, enabled: false },
]

interface PaymentSettingsFormProps {
  defaultValues: PaymentSettings
  onSave: (data: PaymentSettings) => Promise<void>
}

export function PaymentSettingsForm({ defaultValues, onSave }: PaymentSettingsFormProps) {
  const [vatEnabled, setVatEnabled] = useState(defaultValues.vatEnabled)
  const [vatPercent, setVatPercent] = useState(defaultValues.vatPercent)
  const [methods, setMethods] = useState(
    defaultValues.paymentMethods.length > 0
      ? defaultValues.paymentMethods
      : DEFAULT_PAYMENT_METHODS
  )
  const [saving, setSaving] = useState(false)

  function toggleMethod(index: number) {
    setMethods(prev => prev.map((m, i) => i === index ? { ...m, enabled: !m.enabled } : m))
  }

  function updateFee(index: number, value: string) {
    setMethods(prev => prev.map((m, i) => i === index ? { ...m, feePercent: parseFloat(value) || 0 } : m))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ vatEnabled, vatPercent, paymentMethods: methods })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-white text-sm font-medium mb-3">מע"מ</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={vatEnabled}
              onChange={e => setVatEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600"
            />
            <span className="text-gray-300 text-sm">העסק גובה מע"מ</span>
          </label>
          {vatEnabled && (
            <div className="flex items-center gap-4 mr-7">
              <Label className="w-32 shrink-0 text-right">אחוז מע"מ</Label>
              <div className="relative max-w-xs">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={vatPercent}
                  onChange={e => setVatPercent(parseFloat(e.target.value) || 0)}
                  className="max-w-24"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <h4 className="text-white text-sm font-medium mb-3">אמצעי תשלום ועמלות</h4>
        <div className="space-y-3">
          {methods.map((method, i) => (
            <div key={i} className="flex items-center gap-4">
              <label className="flex items-center gap-3 w-48 cursor-pointer">
                <input
                  type="checkbox"
                  checked={method.enabled}
                  onChange={() => toggleMethod(i)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-gray-300 text-sm">{method.name}</span>
              </label>
              {method.enabled && (
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={method.feePercent}
                    onChange={e => updateFee(i, e.target.value)}
                    className="max-w-24"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-start pt-2">
        <Button onClick={handleSave} loading={saving}>
          שמור הגדרות תשלום
        </Button>
      </div>
    </div>
  )
}
