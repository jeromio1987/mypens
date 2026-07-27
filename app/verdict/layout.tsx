import DestinationsChrome from '@/components/shared/DestinationsChrome'

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <DestinationsChrome active="audit">{children}</DestinationsChrome>
}
