import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { Button } from './ui/button'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'

export interface FeedbackDialogState {
  title: string
  message: string
  variant?: 'success' | 'error'
}

interface FeedbackDialogProps {
  open: boolean
  feedback: FeedbackDialogState | null
  onOpenChange: (open: boolean) => void
  confirmText?: string
}

export function FeedbackDialog({
  open,
  feedback,
  onOpenChange,
  confirmText = '知道了',
}: FeedbackDialogProps) {
  const variant = feedback?.variant ?? 'error'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{feedback?.title}</DialogTitle>
        </DialogHeader>
        <Alert variant={variant === 'error' ? 'destructive' : 'default'}>
          {variant === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>{variant === 'error' ? '操作未完成' : '操作已完成'}</AlertTitle>
          <AlertDescription className="break-words whitespace-pre-wrap">
            {feedback?.message}
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{confirmText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
