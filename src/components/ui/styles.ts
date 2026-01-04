/**
 * Shared className patterns for UI components
 *
 * These constants reduce duplication across UI components and ensure consistency.
 * Use these with template literals or cn() utility for combining with other classes.
 */

/**
 * Default SVG icon size - applies size-4 to SVGs without explicit size class
 */
export const svgSize = "[&_svg:not([class*='size-'])]:size-4"

/**
 * SVG icon behavior - prevents pointer events and prevents shrinking
 */
export const svgBehavior = '[&_svg]:pointer-events-none [&_svg]:shrink-0'

/**
 * Combined SVG styles - size + behavior
 */
export const svgStyles = `${svgSize} ${svgBehavior}`

/**
 * Focus ring styles for interactive elements
 */
export const focusRing =
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1'

/**
 * Invalid/error state styles for form elements
 */
export const invalidRing =
  'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-1'

/**
 * Combined focus and invalid styles for form inputs
 */
export const formControlRing = `${focusRing} ${invalidRing}`

/**
 * Standard input background and border styles
 */
export const inputBase =
  'dark:bg-input/30 border-input rounded-none border bg-transparent'

/**
 * Disabled state styles for form elements
 */
export const disabledStyles =
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Dropdown/popup animation styles
 */
export const popupAnimation =
  'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'

/**
 * Standard popup container styles
 */
export const popupContainer =
  'bg-popover text-popover-foreground ring-foreground/10 rounded-none shadow-md ring-1'

/**
 * List item styles for select/combobox items
 */
export const listItemBase = `gap-2 rounded-none py-2 pr-8 pl-2 text-xs ${svgSize} relative flex w-full cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${svgBehavior}`
