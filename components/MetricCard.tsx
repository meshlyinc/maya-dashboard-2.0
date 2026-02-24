import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  icon: LucideIcon
  trend?: string
  suffix?: string
  onClick?: () => void
}

export default function MetricCard({ title, value, icon: Icon, trend, suffix, onClick }: MetricCardProps) {
  return (
    <div className={`bg-white rounded-lg p-6${onClick ? ' cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-semibold text-gray-900">{value}</p>
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
      {trend && (
        <p className="text-xs text-green-600 mt-2">{trend} from last period</p>
      )}
    </div>
  )
}
