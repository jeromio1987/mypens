import Link from 'next/link'
import { Scale, UtensilsCrossed, Moon, Dumbbell, LayoutDashboard, Ruler } from 'lucide-react'

const modules = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Weekly summary across all modules. Export your data to CSV.',
    color: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
    iconColor: 'text-gray-700',
    badge: 'Phase 4',
    badgeColor: 'bg-gray-200 text-gray-600',
  },
  {
    href: '/weight',
    icon: Scale,
    title: 'Weight Tracker',
    description: 'Log daily weight with creatine, alcohol, and glycogen correction. See true weight vs scale.',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    iconColor: 'text-blue-600',
    badge: 'Phase 1',
    badgeColor: 'bg-blue-100 text-blue-600',
  },
  {
    href: '/food',
    icon: UtensilsCrossed,
    title: 'Food Log',
    description: 'Track meals by type with macros. Progress bars vs daily targets.',
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    iconColor: 'text-emerald-600',
    badge: 'Phase 2',
    badgeColor: 'bg-emerald-100 text-emerald-600',
  },
  {
    href: '/sleep',
    icon: Moon,
    title: 'Sleep',
    description: 'Log bedtime, wake time, quality and HRV. 30-day duration and quality trend.',
    color: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
    iconColor: 'text-violet-600',
    badge: 'Phase 3',
    badgeColor: 'bg-violet-100 text-violet-600',
  },
  {
    href: '/training',
    icon: Dumbbell,
    title: 'Training',
    description: 'Log exercises, sets, reps, weight and RPE. Session volume + weekly trend.',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    iconColor: 'text-orange-500',
    badge: 'Phase 3',
    badgeColor: 'bg-orange-100 text-orange-600',
  },
  {
    href: '/measurements',
    icon: Ruler,
    title: 'Body Measurements',
    description: 'Track waist, chest, hips, arms and more. Delta vs previous + trend chart.',
    color: 'bg-rose-50 border-rose-200 hover:bg-rose-100',
    iconColor: 'text-rose-600',
    badge: 'Phase 4',
    badgeColor: 'bg-rose-100 text-rose-600',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">MY PENS</h1>
          <p className="text-gray-400 mt-1">Personal health tracker</p>
        </div>

        <div className="space-y-4">
          {modules.map(({ href, icon: Icon, title, description, color, iconColor, badge, badgeColor }) => (
            <Link
              key={href}
              href={href}
              className={`block border rounded-2xl p-5 transition-colors ${color}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2.5 bg-white rounded-xl shadow-sm ${iconColor}`}>
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-900">{title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
                      {badge}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
