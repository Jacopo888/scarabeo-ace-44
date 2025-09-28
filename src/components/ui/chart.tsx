import * as React from "react"

export type ChartConfig = Record<string, { label?: React.ReactNode; icon?: React.ComponentType; color?: string }>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

const ChartContainer = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { config: ChartConfig }>(
  ({ className, children, config, ...props }, ref) => {
    return (
      <ChartContext.Provider value={{ config }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </ChartContext.Provider>
    )
  }
)
ChartContainer.displayName = "Chart"

const ChartStyle = (_props: { id: string; config: ChartConfig }) => null
const ChartTooltip = (_props: any) => null
const ChartTooltipContent = React.forwardRef<HTMLDivElement, any>((_props, _ref) => null)
ChartTooltipContent.displayName = "ChartTooltip"
const ChartLegend = (_props: any) => null
const ChartLegendContent = React.forwardRef<HTMLDivElement, any>((_props, _ref) => null)
ChartLegendContent.displayName = "ChartLegend"

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle }
