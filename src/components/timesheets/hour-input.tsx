'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { HOUR_RULES } from '@/lib/validations/timesheet'

interface HourInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}

export function HourInput({ value, onChange, disabled = false, className }: HourInputProps) {
  // Track editing state separately from focus
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Display either the edit value (when editing) or the prop value
  const displayValue = isEditing ? editValue : (value > 0 ? String(value) : '')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value

    // Allow empty string or valid number patterns
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
      setEditValue(val)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)

    if (editValue === '') {
      onChange(0)
      return
    }

    let num = parseFloat(editValue)

    // Clamp to valid range
    if (isNaN(num)) {
      num = 0
    }
    num = Math.max(0, Math.min(HOUR_RULES.maxPerDay, num))

    // Round to nearest increment
    num = Math.round(num / HOUR_RULES.increment) * HOUR_RULES.increment

    onChange(num)
  }

  const handleFocus = () => {
    setIsEditing(true)
    setEditValue(value > 0 ? String(value) : '')
    // Select all text on focus
    setTimeout(() => {
      inputRef.current?.select()
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Arrow up/down to increment/decrement
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newVal = Math.min(HOUR_RULES.maxPerDay, (value || 0) + HOUR_RULES.increment)
      onChange(newVal)
      setEditValue(newVal > 0 ? String(newVal) : '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newVal = Math.max(0, (value || 0) - HOUR_RULES.increment)
      onChange(newVal)
      setEditValue(newVal > 0 ? String(newVal) : '')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleBlur()
      // Move to next input
      const form = inputRef.current?.form
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input[type="text"]'))
        const currentIndex = inputs.indexOf(inputRef.current!)
        const nextInput = inputs[currentIndex + 1] as HTMLInputElement
        nextInput?.focus()
      }
    }
  }

  const isWarning = value > HOUR_RULES.warnIfOver
  const isError = value > HOUR_RULES.maxPerDay

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={cn(
        'h-10 w-full rounded-md border bg-background px-2 text-center text-sm',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        isError && 'border-destructive bg-destructive/10',
        isWarning && !isError && 'border-orange-400 bg-orange-50',
        !isError && !isWarning && 'border-input',
        className
      )}
      placeholder="-"
    />
  )
}
