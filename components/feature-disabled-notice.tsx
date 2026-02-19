import { AlertTriangle } from "lucide-react"

export function FeatureDisabledNotice({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="max-w-xl mx-auto glass rounded-2xl p-10 text-center">
      <AlertTriangle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
