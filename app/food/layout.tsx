import DestinationsChrome from '@/components/shared/DestinationsChrome'

export default function FuelingLayout({ children }: { children: React.ReactNode }) {
  return <DestinationsChrome active="fueling">{children}</DestinationsChrome>
}
