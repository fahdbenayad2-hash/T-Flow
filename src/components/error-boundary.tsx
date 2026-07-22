import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '~/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center" dir="rtl">
          <div className="rounded-2xl bg-destructive/10 p-5 mb-5">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-bold mb-2">حدث خطأ غير متوقع</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-1 leading-relaxed">
            حدث خطأ أثناء عرض هذه الصفحة. يمكنك المحاولة مرة أخرى أو العودة للصفحة الرئيسية.
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-muted-foreground/60 max-w-md mb-5 font-mono" dir="ltr">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = '/dashboard'
              }}
            >
              لوحة التحكم
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
