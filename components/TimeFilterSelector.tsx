interface TimeFilterSelectorProps {
  value: string
  onChange: (value: string) => void
}

const filters = [
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '3m', label: '3 Months' },
  { value: 'all', label: 'All Time' },
]

export default function TimeFilterSelector({ value, onChange }: TimeFilterSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Time range:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
      >
        {filters.map(filter => (
          <option key={filter.value} value={filter.value}>
            {filter.label}
          </option>
        ))}
      </select>
    </div>
  )
}
