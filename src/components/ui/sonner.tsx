"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon, Alert02Icon, MultiplicationSignCircleIcon, Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { useTheme } from "@/components/theme-provider"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      expand={false}
      icons={{
        success: (
          <span aria-hidden="true" className="cn-toast-success-icon">
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.4} />
          </span>
        ),
        info: (
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />
        ),
        warning: (
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />
        ),
        error: (
          <HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2} className="size-4" />
        ),
        loading: (
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      position="bottom-center"
      offset={{ bottom: 16 }}
      mobileOffset={{ bottom: 16 }}
      visibleToasts={1}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "cn-toast",
          content: "cn-toast-content",
          description: "cn-toast-description",
          icon: "cn-toast-icon",
          title: "cn-toast-title",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
