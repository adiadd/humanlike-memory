import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '@/lib/utils'
import {
  disabledStyles,
  formControlRing,
  inputBase,
} from '@/components/ui/styles'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        inputBase,
        formControlRing,
        disabledStyles,
        'disabled:bg-input/50 dark:disabled:bg-input/80 h-8 px-2.5 py-1 text-xs transition-colors file:h-6 file:text-xs file:font-medium md:text-xs file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
