import DestinationsChrome from '@/components/shared/DestinationsChrome'

export default function TrainLayout({ children }: { children: React.ReactNode }) {
  return <DestinationsChrome active="train">{children}</DestinationsChrome>
}
