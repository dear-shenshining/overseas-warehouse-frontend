'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateRangePickerProps {
  dateFrom?: string
  dateTo?: string
  onDateChange?: (dateFrom: string | undefined, dateTo: string | undefined) => void
  className?: string
  placeholder?: string
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onDateChange,
  className,
  placeholder = "选择日期范围",
}: DateRangePickerProps) {
  // 将字符串日期转换为 Date 对象
  const fromDate = dateFrom && dateFrom.trim() ? new Date(dateFrom) : undefined
  const toDate = dateTo && dateTo.trim() ? new Date(dateTo) : undefined
  
  const [date, setDate] = React.useState<DateRange | undefined>(
    fromDate && toDate
      ? { from: fromDate, to: toDate }
      : fromDate
      ? { from: fromDate, to: undefined }
      : undefined
  )

  // 当外部传入的日期变化时，更新内部状态
  React.useEffect(() => {
    const from = dateFrom && dateFrom.trim() ? new Date(dateFrom) : undefined
    const to = dateTo && dateTo.trim() ? new Date(dateTo) : undefined
    
    if (from && to) {
      setDate({ from, to })
    } else if (from) {
      setDate({ from, to: undefined })
    } else {
      setDate(undefined)
    }
  }, [dateFrom, dateTo])

  // 处理日期选择
  const handleSelect = (range: DateRange | undefined) => {
    setDate(range)
    
    if (range?.from) {
      const fromStr = format(range.from, 'yyyy-MM-dd')
      const toStr = range.to ? format(range.to, 'yyyy-MM-dd') : undefined
      onDateChange?.(fromStr, toStr)
    } else {
      onDateChange?.(undefined, undefined)
    }
  }

  // 格式化显示文本
  const displayText = React.useMemo(() => {
    if (date?.from && date?.to) {
      return `${format(date.from, 'MM月dd日', { locale: zhCN })} - ${format(date.to, 'MM月dd日', { locale: zhCN })}`
    } else if (date?.from) {
      return `${format(date.from, 'MM月dd日', { locale: zhCN })} - ...`
    }
    return placeholder
  }, [date, placeholder])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
            formatters={{
              formatWeekdayName: (date) => {
                const weekdays = ['日', '一', '二', '三', '四', '五', '六']
                return weekdays[date.getDay()]
              },
              formatCaption: (date) => {
                const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
                return `${months[date.getMonth()]} ${date.getFullYear()}`
              },
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

