'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Brush
} from 'recharts'
import { ActivityData } from '@/lib/types'

interface ActivityChartProps {
  data: ActivityData[]
  metricsTimeFilter: string
}

const LINES = [
  { key: 'userCount', name: 'Users', color: '#3b82f6' },
  { key: 'messageCount', name: 'Messages', color: '#10b981' },
  { key: 'conversationCount', name: 'Conversations', color: '#f59e0b' },
  { key: 'reachoutCount', name: 'Reachouts', color: '#8b5cf6' },
  { key: 'connectionCount', name: 'Connections', color: '#ec4899' },
]

const CHART_TIME_FILTERS = [
  { value: '1h', label: '1H' },
  { value: '3h', label: '3H' },
  { value: '6h', label: '6H' },
  { value: '1d', label: '1D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'all', label: 'All' },
]

export default function ActivityChart({ data: initialData, metricsTimeFilter }: ActivityChartProps) {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set())
  const [chartTimeFilter, setChartTimeFilter] = useState('1d')
  const [chartData, setChartData] = useState<ActivityData[]>(initialData)
  const [loading, setLoading] = useState(false)

  const fetchChartData = useCallback(async (filter: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics?timeFilter=${metricsTimeFilter}&chartTimeFilter=${filter}`)
      const data = await res.json()
      setChartData(data.recentActivity || [])
    } catch (error) {
      console.error('Failed to fetch chart data:', error)
    } finally {
      setLoading(false)
    }
  }, [metricsTimeFilter])

  useEffect(() => {
    if (chartTimeFilter === '1d') {
      setChartData(initialData)
    } else {
      fetchChartData(chartTimeFilter)
    }
  }, [chartTimeFilter, initialData, fetchChartData])

  const formattedData = useMemo(() => chartData.map(item => ({
    ...item,
    time: item.label || item.timestamp,
  })), [chartData])

  const toggleLine = (key: string) => {
    setHiddenLines(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        if (next.size < LINES.length - 1) {
          next.add(key)
        }
      }
      return next
    })
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-400">
        {loading ? 'Loading chart data...' : 'No activity data available'}
      </div>
    )
  }

  return (
    <div>
      {/* Header with time filter */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {/* Toggle line chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {LINES.map(line => {
            const isVisible = !hiddenLines.has(line.key)
            return (
              <button
                key={line.key}
                onClick={() => toggleLine(line.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isVisible ? 'opacity-100 shadow-sm' : 'opacity-40'
                }`}
                style={{
                  backgroundColor: isVisible ? `${line.color}18` : '#f3f4f6',
                  color: isVisible ? line.color : '#9ca3af',
                  border: `1px solid ${isVisible ? `${line.color}40` : '#e5e7eb'}`,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                {line.name}
              </button>
            )
          })}
        </div>

        {/* Time frame selector */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {CHART_TIME_FILTERS.map(filter => (
            <button
              key={filter.value}
              onClick={() => setChartTimeFilter(filter.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                chartTimeFilter === filter.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className={`relative ${loading ? 'opacity-50' : ''} transition-opacity`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-sm text-gray-500 bg-white/80 px-3 py-1.5 rounded-lg">Loading...</div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: '#374151', fontSize: '13px', fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ fontSize: '12px', padding: '2px 0' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px' }}
            />
            <Line
              type="monotone"
              dataKey="userCount"
              name="Users"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
              hide={hiddenLines.has('userCount')}
            />
            <Line
              type="monotone"
              dataKey="messageCount"
              name="Messages"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#10b981' }}
              hide={hiddenLines.has('messageCount')}
            />
            <Line
              type="monotone"
              dataKey="conversationCount"
              name="Conversations"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#f59e0b' }}
              hide={hiddenLines.has('conversationCount')}
            />
            <Line
              type="monotone"
              dataKey="reachoutCount"
              name="Reachouts"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#8b5cf6' }}
              hide={hiddenLines.has('reachoutCount')}
            />
            <Line
              type="monotone"
              dataKey="connectionCount"
              name="Connections"
              stroke="#ec4899"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#ec4899' }}
              hide={hiddenLines.has('connectionCount')}
            />
            <Brush
              dataKey="time"
              height={30}
              stroke="#d1d5db"
              fill="#f9fafb"
              travellerWidth={10}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
