'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'

import { CaretDownIcon, CaretUpIcon, CheckIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import {
  formControlRing,
  listItemBase,
  popupAnimation,
  popupContainer,
  svgBehavior,
  svgSize,
} from '@/components/ui/styles'

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1', className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('flex flex-1 text-left', className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        formControlRing,
        svgBehavior,
        svgSize,
        'border-input data-[placeholder]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 gap-1.5 rounded-none border bg-transparent py-2 pr-2 pl-2.5 text-xs transition-colors select-none data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-none *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <CaretDownIcon className="text-muted-foreground size-4 pointer-events-none" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            popupContainer,
            popupAnimation,
            'min-w-36 duration-100 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('text-muted-foreground px-2 py-2 text-xs', className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        listItemBase,
        'focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 gap-2 shrink-0 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('bg-border -mx-1 h-px pointer-events-none', className)}
      {...props}
    />
  )
}

function SelectScrollButton({
  direction,
  className,
  ...props
}: { direction: 'up' | 'down' } & React.ComponentProps<
  typeof SelectPrimitive.ScrollUpArrow
>) {
  const Icon = direction === 'up' ? CaretUpIcon : CaretDownIcon
  const Component =
    direction === 'up'
      ? SelectPrimitive.ScrollUpArrow
      : SelectPrimitive.ScrollDownArrow

  return (
    <Component
      data-slot={`select-scroll-${direction}-button`}
      className={cn(
        svgSize,
        'bg-popover z-10 flex cursor-default items-center justify-center py-1 w-full',
        direction === 'up' ? 'top-0' : 'bottom-0',
        className,
      )}
      {...props}
    >
      <Icon />
    </Component>
  )
}

function SelectScrollUpButton(
  props: Omit<React.ComponentProps<typeof SelectScrollButton>, 'direction'>,
) {
  return <SelectScrollButton direction="up" {...props} />
}

function SelectScrollDownButton(
  props: Omit<React.ComponentProps<typeof SelectScrollButton>, 'direction'>,
) {
  return <SelectScrollButton direction="down" {...props} />
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
